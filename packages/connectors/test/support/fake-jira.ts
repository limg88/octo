import type { IncomingMessage, ServerResponse } from 'node:http'
import { type FakeServer, json, startFakeServer } from './fake-server.ts'

/**
 * A fake Jira Cloud site on loopback, with the shapes of the REST API v3:
 *
 * - `GET /rest/api/3/myself`: `{ accountId, accountType, emailAddress, displayName, active,
 *   timeZone, locale }`;
 * - `GET /rest/api/3/project/search?startAt&maxResults&orderBy&id…`: `{ self, nextPage?,
 *   maxResults, startAt, total, isLast, values: [{ id, key, name, projectTypeKey, simplified,
 *   style, isPrivate, self }] }`, filtered by the repeated `id` parameter when given;
 * - `GET /rest/api/3/search/jql?jql&fields&maxResults&nextPageToken`: `{ issues: [{ id, key,
 *   self, fields }], nextPageToken?, isLast }`, with only the asked fields (none asked: the id
 *   only, as the enhanced search does) and at most 100 issues a page; the JQL is read for its
 *   `project in (…)` and `updated >= "-Nm"` clauses, the relative date taken from the fake's
 *   own clock (`now`), as Jira takes it from its own; ordered by `updated` then key; an issue
 *   not yet indexed (`unindexed`) is not found, as with Jira's eventually consistent index;
 * - the `comment` field: `{ comments, maxResults, total, startAt }`, the first ones only when
 *   `inlineComments` is set (oldest first);
 * - `GET /rest/api/3/issue/{id}/comment?orderBy&maxResults`: `{ startAt, maxResults, total,
 *   comments }`.
 *
 * The credentials are checked as Basic `email:token`: none or wrong gives 401. Any other method
 * or path answers 405 or 404. Every request is recorded.
 */

export interface FakeProject {
  id: string
  key: string
  name: string
}

export interface FakeIssue {
  id: string
  key: string
  /** Every field the issue has, worklog and time tracking included: the fake gives the asked ones. */
  fields: Record<string, unknown>
  /** The changes of the issue, oldest first, as its changelog gives them. */
  changelog?: unknown[]
}

export interface FakeJiraOptions {
  email: string
  token: string
  /** The account's time zone, as `/myself` shows it; Europe/Rome by default. */
  timeZone?: string
  projects: FakeProject[]
  issues: FakeIssue[]
  /** Projects per page of the list. */
  projectPageSize?: number
  /** Worklogs per page of an issue, whatever is asked. */
  worklogPageSize?: number
  /** Changes per page of an issue, whatever is asked. */
  changelogPageSize?: number
}

export interface FakeJira {
  server: FakeServer
  options: FakeJiraOptions
  /** Answers the search with every issue, ignoring the projects (a misbehaving system). */
  leakPerimeter: boolean
  /** Refuses the list of fields, as a site does to an account that may not see it. */
  hideFields: boolean
  /**
   * Orders the search by the minute of the update only, then by key: issues changed within the
   * same minute come out of their millisecond order (a misbehaving system).
   */
  orderByMinuteOnly: boolean
  /** Gives every field of an issue whatever is asked, worklog included (a misbehaving system). */
  allFields: boolean
  /** Comments given inline in a search, the first ones; all when undefined. */
  inlineComments: number | undefined
  /** Says more pages follow without a token to them (a misbehaving system). */
  dropNextPageToken: boolean
  /** Ids of issues the search index does not have yet: the search does not find them. */
  unindexed: Set<string>
  /** The clock of Jira, which relative JQL dates are read against; the real one when null. */
  now: Date | null
  /** Paths that answer with this status once. */
  failNext: Map<string, number>
  /** The JQL of every search received. */
  searches: string[]
  /** The `fields` of every search received. */
  fieldLists: string[]
}

const API = '/rest/api/3'

/** The instant a relative JQL date (`-Nm`) means at Jira's clock: N minutes before it. */
type FakeWorklog = { started: string; timeSpentSeconds: number; author?: { displayName?: string } }

/** The worklogs an issue carries in its fields. */
function worklogsOf(issue: FakeIssue): FakeWorklog[] {
  const worklog = issue.fields.worklog as { worklogs?: FakeWorklog[] } | undefined
  return (worklog?.worklogs ?? []).filter((w) => typeof w.started === 'string')
}

export function jqlInstant(relative: string, now: Date): number {
  const m = /^-(\d+)m$/.exec(relative)
  if (!m) throw new Error(`bad JQL date ${relative}`)
  return now.getTime() - Number(m[1]) * 60_000
}

/** Issue keys compared as Jira does: project key, then number. */
function keyOrder(a: string, b: string): number {
  const [pa, na] = a.split('-')
  const [pb, nb] = b.split('-')
  return (pa ?? '').localeCompare(pb ?? '') || Number(na) - Number(nb)
}

const updatedOf = (i: FakeIssue) => Date.parse(String(i.fields.updated))

export async function startFakeJira(options: FakeJiraOptions): Promise<FakeJira> {
  const expected = `Basic ${Buffer.from(`${options.email}:${options.token}`).toString('base64')}`
  const fake: FakeJira = {
    server: undefined as unknown as FakeServer,
    options,
    leakPerimeter: false,
    hideFields: false,
    orderByMinuteOnly: false,
    allFields: false,
    inlineComments: undefined,
    dropNextPageToken: false,
    unindexed: new Set(),
    now: null,
    failNext: new Map(),
    searches: [],
    fieldLists: [],
  }

  const projectOf = (p: FakeProject) => ({
    id: p.id,
    key: p.key,
    name: p.name,
    projectTypeKey: 'software',
    simplified: false,
    style: 'classic',
    isPrivate: false,
    self: `${fake.server.origin}${API}/project/${p.id}`,
  })

  const commentsOf = (issue: FakeIssue): unknown[] => {
    const c = issue.fields.comment as { comments?: unknown[] } | undefined
    return c?.comments ?? []
  }

  const shown = (issue: FakeIssue, asked: string[]) => {
    const fields: Record<string, unknown> = {}
    const all = fake.allFields || asked.includes('*all')
    for (const [name, value] of Object.entries(issue.fields)) {
      if (!all && !asked.includes(name)) continue
      if (name === 'comment') {
        const comments = commentsOf(issue)
        const inline =
          fake.inlineComments === undefined ? comments : comments.slice(0, fake.inlineComments)
        fields.comment = {
          comments: inline,
          self: `${fake.server.origin}${API}/issue/${issue.id}/comment`,
          maxResults: inline.length,
          total: comments.length,
          startAt: 0,
        }
      } else {
        fields[name] = value
      }
    }
    return {
      expand: 'renderedFields,names,schema,operations,editmeta,changelog,versionedRepresentations',
      id: issue.id,
      self: `${fake.server.origin}${API}/issue/${issue.id}`,
      key: issue.key,
      fields,
    }
  }

  function search(url: URL, res: ServerResponse): void {
    const jql = url.searchParams.get('jql') ?? ''
    fake.searches.push(jql)
    const asked = (url.searchParams.get('fields') ?? '').split(',').filter((f) => f !== '')
    fake.fieldLists.push(url.searchParams.get('fields') ?? '')
    const inProjects = /project in \(([^)]*)\)/
      .exec(jql)?.[1]
      ?.split(',')
      .map((s) => s.trim())
    const since = /updated >= "([^"]+)"/.exec(jql)?.[1]
    const from = since === undefined ? null : jqlInstant(since, fake.now ?? new Date())
    const byKey = /ORDER BY key ASC$/.test(jql)
    if (!byKey && !/ORDER BY updated ASC, key ASC$/.test(jql)) {
      json(res, 400, { errorMessages: ['order expected'], errors: {} })
      return
    }
    const projectId = (i: FakeIssue) => (i.fields.project as { id: string }).id
    const loggedFrom = /worklogDate >= "([^"]+)"/.exec(jql)?.[1]
    const loggedTo = /worklogDate <= "([^"]+)"/.exec(jql)?.[1]
    const loggedIn = (i: FakeIssue) =>
      loggedFrom === undefined ||
      loggedTo === undefined ||
      worklogsOf(i).some(
        (w) => w.started.slice(0, 10) >= loggedFrom && w.started.slice(0, 10) <= loggedTo,
      )
    const matches = options.issues
      .filter(loggedIn)
      .filter((i) => !fake.unindexed.has(i.id))
      .filter((i) => fake.leakPerimeter || (inProjects ?? []).includes(projectId(i)))
      .filter((i) => from === null || updatedOf(i) >= from)
      .sort((a, b) => {
        if (byKey) return keyOrder(a.key, b.key)
        const at = (i: FakeIssue) =>
          fake.orderByMinuteOnly ? Math.floor(updatedOf(i) / 60_000) : updatedOf(i)
        return at(a) - at(b) || keyOrder(a.key, b.key)
      })
    const size = Math.min(Number(url.searchParams.get('maxResults') ?? '50'), 100)
    const start = Number(url.searchParams.get('nextPageToken') ?? '0')
    const page = matches.slice(start, start + size)
    const more = start + size < matches.length
    const shownFields = asked.length === 0 ? [] : asked
    json(res, 200, {
      issues: page.map((i) =>
        shownFields.length === 0 && !fake.allFields ? { id: i.id } : shown(i, shownFields),
      ),
      ...(more && !fake.dropNextPageToken ? { nextPageToken: String(start + size) } : {}),
      isLast: !more,
    })
  }

  function handle(req: IncomingMessage, res: ServerResponse): void {
    const url = new URL(req.url ?? '/', 'http://fake')
    const path = decodeURIComponent(url.pathname)
    if (req.method !== 'GET') {
      json(res, 405, { errorMessages: ['method not allowed'] })
      return
    }
    if (req.headers.authorization !== expected) {
      json(res, 401, { errorMessages: ['Client must be authenticated to access this resource.'] })
      return
    }
    const failing = fake.failNext.get(path)
    if (failing !== undefined) {
      fake.failNext.delete(path)
      json(
        res,
        failing,
        { errorMessages: ['failure'] },
        failing === 429 ? { 'retry-after': '1' } : {},
      )
      return
    }
    if (path === `${API}/myself`) {
      json(res, 200, {
        self: `${fake.server.origin}${API}/user?accountId=5b10a2844c20165700ede21g`,
        accountId: '5b10a2844c20165700ede21g',
        accountType: 'atlassian',
        emailAddress: options.email,
        displayName: 'Octobrief Service',
        active: true,
        timeZone: options.timeZone ?? 'Europe/Rome',
        locale: 'it_IT',
      })
      return
    }
    if (path === `${API}/field`) {
      if (fake.hideFields) {
        json(res, 403, { errorMessages: ['forbidden'] })
        return
      }
      json(res, 200, [
        { id: 'summary', name: 'Summary', custom: false, schema: { type: 'string' } },
        {
          id: 'customfield_10016',
          name: 'Story Points',
          custom: true,
          schema: {
            type: 'number',
            custom: 'com.atlassian.jira.plugin.system.customfieldtypes:float',
          },
        },
        {
          id: 'customfield_10020',
          name: 'Sprint',
          custom: true,
          schema: { type: 'array', custom: 'com.pyxis.greenhopper.jira:gh-sprint' },
        },
      ])
      return
    }
    if (path === `${API}/project/search`) {
      const ids = url.searchParams.getAll('id')
      const all =
        ids.length > 0 ? options.projects.filter((p) => ids.includes(p.id)) : options.projects
      const size = Math.min(
        Number(url.searchParams.get('maxResults') ?? '50'),
        options.projectPageSize ?? 50,
      )
      const start = Number(url.searchParams.get('startAt') ?? '0')
      const page = all.slice(start, start + size)
      const isLast = start + size >= all.length
      json(res, 200, {
        self: `${fake.server.origin}${url.pathname}${url.search}`,
        ...(isLast
          ? {}
          : { nextPage: `${fake.server.origin}${API}/project/search?startAt=${start + size}` }),
        maxResults: size,
        startAt: start,
        total: all.length,
        isLast,
        values: page.map(projectOf),
      })
      return
    }
    if (path === `${API}/search/jql`) {
      search(url, res)
      return
    }
    const commentPath = new RegExp(`^${API}/issue/(\\d+)/comment$`).exec(path)
    if (commentPath) {
      const issue = options.issues.find((i) => i.id === commentPath[1])
      if (!issue) {
        json(res, 404, {
          errorMessages: ['Issue does not exist or you do not have permission to see it.'],
        })
        return
      }
      const all = commentsOf(issue)
      const ordered = url.searchParams.get('orderBy') === '-created' ? [...all].reverse() : all
      const max = Number(url.searchParams.get('maxResults') ?? '5000')
      const page = ordered.slice(0, max)
      json(res, 200, { startAt: 0, maxResults: max, total: all.length, comments: page })
      return
    }
    const changelogPath = new RegExp(`^${API}/issue/(\\d+)/changelog$`).exec(path)
    if (changelogPath) {
      const issue = options.issues.find((i) => i.id === changelogPath[1])
      if (!issue) {
        json(res, 404, { errorMessages: ['Issue does not exist.'] })
        return
      }
      const all = issue.changelog ?? []
      const startAt = Number(url.searchParams.get('startAt') ?? '0')
      const size = Math.min(
        Number(url.searchParams.get('maxResults') ?? '100'),
        options.changelogPageSize ?? 100,
      )
      const values = all.slice(startAt, startAt + size)
      json(res, 200, {
        startAt,
        maxResults: size,
        total: all.length,
        isLast: startAt + size >= all.length,
        values,
      })
      return
    }
    const worklogPath = new RegExp(`^${API}/issue/(\\d+)/worklog$`).exec(path)
    if (worklogPath) {
      const issue = options.issues.find((i) => i.id === worklogPath[1])
      if (!issue) {
        json(res, 404, { errorMessages: ['Issue does not exist.'] })
        return
      }
      const after = Number(url.searchParams.get('startedAfter') ?? '-Infinity')
      const before = Number(url.searchParams.get('startedBefore') ?? 'Infinity')
      const all = worklogsOf(issue).filter((w) => {
        const at = Date.parse(w.started)
        return at >= after && at <= before
      })
      const startAt = Number(url.searchParams.get('startAt') ?? '0')
      const size = Math.min(
        Number(url.searchParams.get('maxResults') ?? '5000'),
        options.worklogPageSize ?? 5000,
      )
      json(res, 200, {
        startAt,
        maxResults: size,
        total: all.length,
        worklogs: all.slice(startAt, startAt + size),
      })
      return
    }
    json(res, 404, { errorMessages: ['not found'] })
  }

  fake.server = await startFakeServer((req, res) => {
    try {
      handle(req, res)
    } catch {
      json(res, 500, { errorMessages: ['fake failure'] })
    }
  })
  return fake
}

/** A change of an issue as its changelog returns it: the fields that changed at one instant. */
export function jiraChange(
  created: string,
  ...items: Array<{ field: string; from: string | null; to: string | null }>
): unknown {
  return {
    id: String(Date.parse(created)),
    author: { accountId: '5b10ac8d82e05b22cc7d4ef5', displayName: 'Mario Rossi' },
    created,
    items: items.map(({ field, from, to }) => ({
      field,
      fieldtype: 'jira',
      fieldId: field,
      from: null,
      fromString: from,
      to: null,
      toString: to,
    })),
  }
}

/** An ADF document of paragraphs of plain text. */
export function adf(...paragraphs: string[]): unknown {
  return {
    type: 'doc',
    version: 1,
    content: paragraphs.map((p) => ({ type: 'paragraph', content: [{ type: 'text', text: p }] })),
  }
}

/** A comment as Jira returns it. */
export function jiraComment(id: number, created: string, body: string, author = 'Mario Rossi') {
  return {
    self: `https://example.atlassian.net/rest/api/3/issue/1/comment/${id}`,
    id: String(id),
    author: {
      accountId: `acc-${author}`,
      displayName: author,
      emailAddress: `${author.toLowerCase().replace(' ', '.')}@example.test`,
      active: true,
    },
    body: adf(body),
    updateAuthor: { accountId: `acc-${author}`, displayName: author, active: true },
    created,
    updated: created,
    jsdPublic: true,
  }
}

/** An issue with every field Jira has, worklog and time tracking included. */
export function jiraIssue(
  id: number,
  key: string,
  project: FakeProject,
  fields: { updated: string } & Partial<{
    type: string
    summary: string
    status: string
    assignee: { displayName: string; emailAddress?: string } | null
    priority: string
    storyPoints: number
    sprints: { name: string; state: string }[]
    labels: string[]
    parent: string
    created: string
    resolved: string
    due: string
    description: unknown
    comments: unknown[]
    /** When the issue last changed category of states. */
    stateChanged: string
    changelog: unknown[]
  }>,
): FakeIssue {
  return {
    id: String(id),
    key,
    ...(fields.changelog !== undefined ? { changelog: fields.changelog } : {}),
    fields: {
      statuscategorychangedate: fields.stateChanged ?? null,
      summary: fields.summary ?? `Storia ${key}`,
      issuetype: { id: '10001', name: fields.type ?? 'Story', subtask: false },
      status: {
        name: fields.status ?? 'In Progress',
        id: '3',
        statusCategory: { id: 4, key: 'indeterminate', name: 'In Progress' },
      },
      assignee:
        fields.assignee === null
          ? null
          : {
              accountId: '5b10ac8d82e05b22cc7d4ef5',
              displayName: fields.assignee?.displayName ?? 'Mario Rossi',
              ...(fields.assignee?.emailAddress !== undefined
                ? { emailAddress: fields.assignee.emailAddress }
                : {}),
              active: true,
              timeZone: 'Europe/Rome',
            },
      priority: { id: '3', name: fields.priority ?? 'Medium' },
      project: { id: project.id, key: project.key, name: project.name },
      created: fields.created ?? '2026-10-01T08:00:00.000+0000',
      updated: fields.updated,
      resolutiondate: fields.resolved ?? null,
      duedate: fields.due ?? null,
      labels: fields.labels ?? [],
      ...(fields.parent !== undefined
        ? { parent: { id: '99', key: fields.parent, fields: { summary: 'Epic' } } }
        : {}),
      description: fields.description ?? null,
      comment: { comments: fields.comments ?? [] },
      customfield_10016: fields.storyPoints ?? null,
      customfield_10020:
        fields.sprints?.map((s, i) => ({ id: i + 1, boardId: 1, goal: '', ...s })) ?? null,
      worklog: {
        startAt: 0,
        maxResults: 20,
        total: 1,
        worklogs: [{ id: '1', timeSpent: '3h 20m', timeSpentSeconds: 12000 }],
      },
      timetracking: { originalEstimate: '10h', timeSpent: '3h 20m', timeSpentSeconds: 12000 },
      timespent: 12000,
      timeoriginalestimate: 36000,
      timeestimate: 24000,
      aggregatetimespent: 12000,
      aggregatetimeoriginalestimate: 36000,
      aggregatetimeestimate: 24000,
      aggregateprogress: { progress: 12000, total: 36000, percent: 33 },
    },
  }
}
