import { ConnectorError } from '../errors.ts'
import { readAdf } from '../jira/adf.ts'
import type {
  Connector,
  ConnectorCheck,
  ConnectorContext,
  ExternalItem,
  ExternalPerson,
  PerimeterOption,
  SyncBatch,
  SyncLimits,
} from '../port.ts'
import { basicAuthorization, sendJson } from '../shared/http.ts'
import { bad, date, isRecord, text } from '../shared/values.ts'
import {
  type ConfluenceConfig,
  type ConfluenceEndpoint,
  confluenceEndpoint,
  confluenceRules,
  confluenceUrl,
  parseConfluenceConfig,
} from './config.ts'

/**
 * Where a sync is. `since` is the instant up to which everything was read by the last finished
 * sync; while a sync runs, `space` and `next` say which space of the perimeter is being listed
 * and from which page of its list, and `seen` is the latest change met so far, which becomes
 * `since` when the sync ends.
 */
export type ConfluenceCursor = {
  since: string
  space: number
  next: string | null
  seen: string
} | null

/** Spaces or pages per call of a list: the most Confluence gives. */
export const LIST_PAGE_SIZE = 250
/** Calls of a list made in one batch at most. */
export const MAX_LIST_CALLS = 40
/** Pages of the list of the spaces read at most. */
const MAX_SPACE_CALLS = 20
/** The first instant: a sync with no cursor reads every page. */
const BEGINNING = new Date(0).toISOString()
const SPACE_OPTION = /^space:(\d{1,18})$/
const ID = /^\d{1,18}$/
/** The parameter of a list that says where its next page starts. */
const NEXT_PARAMETER = 'cursor'
const MAX_NEXT_LENGTH = 2_000
const PAGE_MEDIA_TYPE = 'text/markdown; charset=utf-8'

export interface ConfluenceConnectorOptions {
  /** Where the API of a configuration is; the public Atlassian host by default. */
  endpoint?: (config: ConfluenceConfig) => ConfluenceEndpoint
}

type Ctx = ConnectorContext<ConfluenceConfig>

function parseCursor(raw: unknown): ConfluenceCursor {
  if (raw === null) return null
  if (!isRecord(raw)) throw new TypeError('confluence cursor')
  const { since, space, next, seen } = raw
  const instant = (value: unknown): value is string =>
    typeof value === 'string' && !Number.isNaN(Date.parse(value))
  if (
    !instant(since) ||
    !instant(seen) ||
    typeof space !== 'number' ||
    !Number.isInteger(space) ||
    space < 0 ||
    !(next === null || (typeof next === 'string' && next.length <= MAX_NEXT_LENGTH))
  ) {
    throw new TypeError('confluence cursor')
  }
  return { since, space, next, seen }
}

/**
 * Where the next page of a list starts, from the link the system gives: only the value of its
 * `cursor` parameter is taken, never the link itself, so the system cannot send the connector
 * to an address of its choosing.
 */
function nextOf(json: Record<string, unknown>): string | null {
  const link = isRecord(json._links) ? json._links.next : undefined
  if (typeof link !== 'string') return null
  const value = new URLSearchParams(link.split('?')[1] ?? '').get(NEXT_PARAMETER)
  return value !== null && value !== '' && value.length <= MAX_NEXT_LENGTH ? value : null
}

interface Space {
  id: string
  key: string
  name: string
}

function spacesOf(json: unknown): { spaces: Space[]; next: string | null } {
  if (!isRecord(json) || !Array.isArray(json.results)) return bad()
  const spaces = json.results.map((entry): Space => {
    const id = isRecord(entry) ? String(entry.id) : ''
    const key = isRecord(entry) ? text(entry.key) : null
    const name = isRecord(entry) ? text(entry.name) : null
    if (!ID.test(id) || key === null || name === null) return bad()
    return { id, key, name }
  })
  return { spaces, next: nextOf(json) }
}

/** A page as its list shows it: enough to know whether it changed and where it is. */
interface Listed {
  id: string
  title: string
  changedAt: Date
  version: number
  webui: string | null
}

function listedOf(entry: unknown): Listed {
  if (!isRecord(entry) || !isRecord(entry.version)) return bad()
  const id = String(entry.id)
  const title = text(entry.title)
  const changedAt = date(entry.version.createdAt)
  const version = entry.version.number
  if (!ID.test(id) || title === null || changedAt === null || typeof version !== 'number') {
    return bad()
  }
  const webui = isRecord(entry._links) ? text(entry._links.webui) : null
  return { id, title, changedAt, version, webui }
}

type PageBody = { text: string; mentions: ExternalPerson[]; refused: boolean }

/**
 * The text of a page from its body in Atlassian Document Format, which Confluence gives as a
 * JSON text. A page with no body, or one that is not readable, has no text: it is still a page.
 */
function bodyOf(json: unknown): PageBody {
  const value =
    isRecord(json) && isRecord(json.body) && isRecord(json.body.atlas_doc_format)
      ? json.body.atlas_doc_format.value
      : undefined
  if (typeof value !== 'string' || value === '') return { text: '', mentions: [], refused: false }
  let doc: unknown
  try {
    doc = JSON.parse(value)
  } catch {
    return bad()
  }
  const read = readAdf(doc)
  return { text: read.text, mentions: read.mentions, refused: read.mentionsRefused }
}

/**
 * The read-only Confluence Cloud connector. A source is a site; the PM chooses spaces from its
 * list (ids, which stay when a key is renamed). A sync lists the pages of each chosen space,
 * oldest change first, and reads the body of those changed after the cursor: one document per
 * page, its text only. Attachments, comments and the history of a page are never asked. A page
 * deleted from the space is not reported as gone: its file stays until the space is read anew.
 */
export function createConfluenceConnector(
  options: ConfluenceConnectorOptions = {},
): Connector<ConfluenceConfig, ConfluenceCursor> {
  const endpointOf = options.endpoint ?? confluenceEndpoint

  async function getJson(ctx: Ctx, segments: string[], query: [string, string][] = []) {
    const url = confluenceUrl(endpointOf(ctx.config), segments, query)
    const res = await sendJson(
      ctx.http,
      'GET',
      url,
      basicAuthorization(ctx.config.email, ctx.secret),
    )
    return res.json()
  }

  async function listSpaces(ctx: Ctx): Promise<Space[]> {
    const found: Space[] = []
    let next: string | null = null
    for (let call = 0; call < MAX_SPACE_CALLS; call += 1) {
      const query: [string, string][] = [['limit', String(LIST_PAGE_SIZE)]]
      if (next !== null) query.push([NEXT_PARAMETER, next])
      const page = spacesOf(await getJson(ctx, ['api', 'v2', 'spaces'], query))
      found.push(...page.spaces)
      if (page.next === null) return found
      next = page.next
    }
    // More spaces than a list reads: never a list cut short in silence.
    throw new ConnectorError('response_too_large')
  }

  async function pageItem(ctx: Ctx, space: string, listed: Listed): Promise<ExternalItem> {
    const json = await getJson(
      ctx,
      ['api', 'v2', 'pages', listed.id],
      [['body-format', 'atlas_doc_format']],
    )
    const body = bodyOf(json)
    const browse = endpointOf(ctx.config).browse
    return {
      externalId: `page:${listed.id}`,
      version: String(listed.version),
      title: listed.title,
      mediaType: PAGE_MEDIA_TYPE,
      originAt: listed.changedAt,
      author: null,
      url: listed.webui === null ? null : `${browse}/wiki${listed.webui}`,
      perimeter: [`space:${space}`],
      // The people the text mentions: listed, so their names are hidden like an assignee's.
      people: body.mentions,
      bytes: new TextEncoder().encode(`# ${listed.title}\n\n${body.text}\n`),
      // A page that names more people than can be hidden is left out, never sent as it is.
      ...(body.refused ? { peopleIncomplete: true as const } : {}),
    }
  }

  return {
    kind: 'confluence',
    parseConfig: parseConfluenceConfig,
    parseCursor,
    rules: (config) => confluenceRules(endpointOf(config)),

    async test(ctx): Promise<ConnectorCheck> {
      try {
        const account = await getJson(ctx, ['rest', 'api', 'user', 'current'])
        if (!isRecord(account)) return { ok: false, code: 'source_bad_response' }
        return { ok: true }
      } catch (error) {
        if (error instanceof ConnectorError) return { ok: false, code: error.code }
        throw error
      }
    },

    async perimeterOptions(ctx): Promise<PerimeterOption[]> {
      const spaces = await listSpaces(ctx)
      return spaces.map((space) => ({
        id: `space:${space.id}`,
        label: `${space.name} (${space.key})`,
      }))
    },

    async sync(ctx, cursor, limits: SyncLimits): Promise<SyncBatch<ConfluenceCursor>> {
      const spaces = ctx.perimeter.flatMap((option) => {
        const id = SPACE_OPTION.exec(option)?.[1]
        return id === undefined ? [] : [id]
      })
      const since = cursor?.since ?? BEGINNING
      const sinceAt = new Date(since)
      let space = cursor?.space ?? 0
      let next = cursor?.next ?? null
      let seen = cursor?.seen ?? since
      const items: ExternalItem[] = []
      const startedAt = ctx.now()

      for (let call = 0; call < MAX_LIST_CALLS && space < spaces.length; call += 1) {
        const id = spaces[space] as string
        const query: [string, string][] = [
          ['limit', String(LIST_PAGE_SIZE)],
          ['sort', 'modified-date'],
        ]
        if (next !== null) query.push([NEXT_PARAMETER, next])
        const json = await getJson(ctx, ['api', 'v2', 'spaces', id, 'pages'], query)
        if (!isRecord(json) || !Array.isArray(json.results)) return bad()
        const changed = json.results.map(listedOf).filter((page) => page.changedAt > sinceAt)
        // A batch holds whole pages of the list: a page of it larger than the room left waits.
        if (items.length > 0 && items.length + changed.length > limits.maxItems) break
        for (const page of changed) {
          items.push(await pageItem(ctx, id, page))
          if (page.changedAt.toISOString() > seen) seen = page.changedAt.toISOString()
        }
        next = nextOf(json)
        if (next === null) space += 1
      }

      const done = space >= spaces.length
      return {
        items,
        // When every space is read, the next sync starts from the latest change met.
        nextCursor: done
          ? { since: seen, space: 0, next: null, seen }
          : { since, space, next, seen },
        done,
        dataAsOf: startedAt,
      }
    },
  }
}
