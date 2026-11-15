import type {
  FeedReader,
  TimesheetReader,
  TrackerHoursReader,
  TrackerSnapshotReader,
} from '@octo/application'
import {
  type ConfluenceCursor,
  ConnectorError,
  type ConnectorReader,
  createConfluenceConnector,
  createConnectorReader,
  createNetGuard,
  createSafeHttp,
  dwsiConnector,
  type NetGuardOptions,
  type PerimeterOption,
  prjOption,
  renderSyncFile,
  SecretValue,
  type SyncErrorCode,
  toDelivery,
} from '@octo/connectors'
import {
  type AdoFeedConfig,
  type ConfluenceFeedConfig,
  type Delivery,
  DomainError,
  type DomainErrorCode,
  type FeedChoice,
  type FeedChoices,
  type FeedConfig,
  type FeedFile,
  type FeedName,
  type FeedStep,
  type JiraFeedConfig,
  MAX_ITEMS_PER_DELIVERY,
  type PullSourceKind,
  recordBody,
  rowsBody,
  shortHash,
  slugOf,
  startOfDay,
  type WarehouseFeedConfig,
} from '@octo/domain'

export type ConnectorFeedOptions = {
  /** Demos and tests only: a fake Jira or Azure DevOps on this computer instead of the real one. */
  devEndpoints?: {
    jira?: string | undefined
    ado?: string | undefined
    confluence?: string | undefined
  }
  /** Demos and tests only: lets the warehouse be a database on this computer. */
  allowLoopback?: boolean
  /** Tests only: how the name of the warehouse becomes addresses, instead of the system's DNS. */
  resolveHost?: NetGuardOptions['resolve']
  /**
   * The addresses of who is signed in. With them the warehouse is read as that person, whatever
   * address the configuration carries; null or absent: the address of the configuration.
   */
  owner?: () => { email: string; upn: string } | null
}

/** Batches one reading takes at most; the next reading goes on from the saved cursor. */
export const MAX_BATCHES_PER_READING = 500
const ADO_HOST = 'dev.azure.com'
const TEXT_TYPES = /^text\/|^application\/json$/
/** The view a first day applies to, and its date column. The other views are read whole. */
const DATED_VIEWS: Readonly<Record<string, string>> = { v_timesheet_all: 'timesheetdate' }

const FAILURES: Partial<Record<SyncErrorCode, DomainErrorCode>> = {
  source_auth_failed: 'feed_credential_refused',
  source_forbidden: 'feed_credential_refused',
  source_not_authorized: 'feed_credential_refused',
  source_credentials_missing: 'feed_credential_refused',
  credentials_expired: 'feed_credential_refused',
  write_scope_refused: 'feed_write_access_refused',
  scope_too_broad: 'feed_write_access_refused',
  tls_not_verified: 'feed_connection_not_secure',
  auth_not_secure: 'feed_connection_not_secure',
  source_timeout: 'feed_unreachable',
  source_unreachable: 'feed_unreachable',
  source_rate_limited: 'feed_unreachable',
  source_unavailable: 'feed_unreachable',
  call_blocked: 'feed_unreachable',
  redirect_refused: 'feed_unreachable',
  source_not_found: 'feed_not_found',
  source_not_configured: 'feed_not_found',
}

/** A failure of a connector as a code the interface explains; the detail stays a constant name. */
function failure(error: unknown): unknown {
  if (!(error instanceof ConnectorError)) return error
  const detail = error.reason ? `${error.code} (${error.reason})` : error.code
  return new DomainError(FAILURES[error.code] ?? 'feed_failed', detail)
}

/** `contoso` from `contoso`, `contoso.atlassian.net` or `https://contoso.atlassian.net/`. */
export function jiraSite(site: string): string {
  return site
    .trim()
    .replace(/^https?:\/\//i, '')
    .replace(/\/.*$/, '')
    .replace(/\.atlassian\.net$/i, '')
}

/**
 * The cursor a connector would have saved after reading everything before a day: the next
 * reading gives what changed from that day on.
 */
function cursorFrom(kind: PullSourceKind, since: Date): unknown {
  const at = since.toISOString()
  return kind === 'jira' ? { updated: at, ids: ['0'] } : { changedAt: at, id: 1 }
}

type Tracker = { kind: PullSourceKind; config: Record<string, unknown>; scope: string[] }

const trackerOf = {
  ado: (config: AdoFeedConfig): Tracker => ({
    kind: 'ado',
    config: { organization: config.organization, host: ADO_HOST, readOnlyToken: true },
    scope: [config.project, ...config.areas],
  }),
  jira: (config: JiraFeedConfig): Tracker => ({
    kind: 'jira',
    config: { site: jiraSite(config.site), email: config.email, readOnlyToken: true },
    scope: config.projects,
  }),
}

const PROJECT_OPTION_PREFIX = 'project:'
const PRJ_OPTION_PREFIX = prjOption('')
const PRJ_CODE = /^PRJ\d{6}$/
/** A well-formed code no project has: it opens a session that reads no project. */
const NO_CODE_YET = 'PRJ000000'
const AREA_OPTION_PREFIX = 'area:'
const KEY_IN_LABEL = /\(([^()]+)\)$/

/** A Jira project is named by its key, which its label carries in brackets. */
function jiraProjectChoice(entry: PerimeterOption): FeedChoice {
  return { value: KEY_IN_LABEL.exec(entry.label)?.[1] ?? entry.label, label: entry.label }
}

/** The areas under the root of a project, each as the path a PM would write. */
function areaChoices(nodes: readonly PerimeterOption[]): FeedChoice[] {
  const areas = nodes.filter((node) => node.id.startsWith(AREA_OPTION_PREFIX))
  const byId = new Map(areas.map((node) => [node.id, node]))
  const pathOf = (node: PerimeterOption): string[] => {
    const parent = node.parentId === undefined ? undefined : byId.get(node.parentId)
    return parent ? [...pathOf(parent), node.label] : []
  }
  return areas
    .map((node) => pathOf(node).join('\\'))
    .filter((path) => path.length > 0)
    .sort()
    .map((path) => ({ value: path, label: path }))
}

const day = (at: Date | null): string => (at ? `${at.toISOString().slice(0, 10)}-` : '')

/** The files of a delivery: one per tracker item, one per view and project, one per text. */
function filesOf(feed: FeedName, delivery: Delivery): FeedFile[] {
  const files: FeedFile[] = []
  for (const record of delivery.records) {
    const key = typeof record.record.key === 'string' ? record.record.key : record.externalId
    files.push({
      externalId: record.externalId,
      version: record.version,
      relativePath: `${slugOf(key)}-${shortHash(record.externalId)}.md`,
      content: renderSyncFile({ system: feed, type: 'record', record, body: recordBody(record) }),
    })
  }
  for (const rows of delivery.rows) {
    files.push({
      externalId: `rows:${rows.view}:${rows.perimeter}`,
      version: shortHash(JSON.stringify(rows.rows)),
      relativePath: `${slugOf(rows.view)}/${slugOf(rows.perimeter)}.md`,
      content: renderSyncFile({ system: feed, type: 'rows', rows, body: rowsBody(rows) }),
    })
  }
  for (const document of delivery.documents) {
    const mediaType = document.mediaType.split(';')[0]?.trim().toLowerCase() ?? ''
    if (!TEXT_TYPES.test(mediaType)) continue
    files.push({
      externalId: document.externalId,
      version: document.version,
      relativePath: `${day(document.originAt)}${slugOf(document.title)}-${shortHash(document.externalId)}.md`,
      content: renderSyncFile({
        system: feed,
        type: 'document',
        externalId: document.externalId,
        version: document.version,
        title: document.title,
        originAt: document.originAt,
        url: document.url,
        people: document.people,
        body: new TextDecoder('utf-8', { fatal: false }).decode(document.bytes),
      }),
    })
  }
  return files
}

const stepOf = (feed: FeedName, delivery: Delivery, cursor: unknown): FeedStep => ({
  files: filesOf(feed, delivery),
  removed: [...delivery.removed],
  cursor,
  dataAsOf: delivery.dataAsOf,
})

/** The rows of the dated views from a day on; every other view as it is. */
function fromDay(delivery: Delivery, since: Date): Delivery {
  return {
    ...delivery,
    rows: delivery.rows.map((view) => {
      const column = DATED_VIEWS[view.view]
      if (!column) return view
      const rows = view.rows.filter((row) => {
        const at = new Date(String(row.values[column]))
        // A row without a readable date is kept: leaving it out would hide data.
        return Number.isNaN(at.getTime()) || at.getTime() >= since.getTime()
      })
      return { ...view, rows }
    }),
  }
}

function warehouseContext(
  config: WarehouseFeedConfig,
  secret: string,
  options: ConnectorFeedOptions,
) {
  const blocked = () => Promise.reject(new ConnectorError('call_blocked'))
  const parsed = dwsiConnector.parseConfig({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    projectCodes: [...config.projectCodes],
  })
  return {
    config: parsed,
    perimeter: config.projectCodes.map(prjOption),
    secret: new SecretValue(secret),
    // The warehouse is not reached over HTTP: any HTTP call is a defect, and is refused.
    http: { request: blocked, getJson: blocked, postJson: blocked, close: () => {} },
    net: createNetGuard({
      privateHosts: [{ host: parsed.host, databaseTls: config.tls, caPem: null }],
      onBlocked: async () => {},
      allowLoopback: options.allowLoopback === true,
      ...(options.resolveHost ? { resolve: options.resolveHost } : {}),
    }),
    signal: new AbortController().signal,
    now: () => new Date(),
    owner: options.owner?.() ?? { email: config.ownerEmail },
  }
}

/** A space is named by its key, which its label carries in brackets, or by its whole name. */
function spaceInScope(option: PerimeterOption, scope: readonly string[]): boolean {
  const label = option.label.toLowerCase()
  return scope.some((raw) => {
    const wanted = raw.trim().toLowerCase()
    return wanted !== '' && (label === wanted || label.endsWith(`(${wanted})`))
  })
}

/**
 * Confluence through its read-only connector: the same safe HTTP client as the trackers
 * (allowlisted paths, no redirects), with the site and the account of Jira.
 */
function confluenceReader(options: ConnectorFeedOptions) {
  const local = options.devEndpoints?.confluence
  const connector = createConfluenceConnector(
    local
      ? {
          endpoint: () => ({
            origin: local,
            host: new URL(local).host,
            prefix: ['wiki'],
            browse: local,
          }),
        }
      : {},
  )
  const allowLoopback = Boolean(local)
  const onBlocked = async () => {}

  /** Runs `work` with the context of one configuration; the HTTP client is closed afterwards. */
  async function withContext<T>(
    config: ConfluenceFeedConfig,
    secret: string,
    perimeter: readonly string[],
    signal: AbortSignal,
    work: (ctx: Parameters<typeof connector.sync>[0]) => Promise<T>,
  ): Promise<T> {
    const parsed = connector.parseConfig({
      site: jiraSite(config.site),
      email: config.email,
      readOnlyToken: true,
    })
    const http = createSafeHttp({
      rules: connector.rules(parsed),
      onBlocked,
      allowLoopbackHttp: allowLoopback,
      signal,
    })
    try {
      return await work({
        config: parsed,
        perimeter,
        secret: new SecretValue(secret),
        http,
        net: createNetGuard({ privateHosts: [], onBlocked, allowLoopback }),
        signal,
        now: () => new Date(),
      })
    } finally {
      http.close()
    }
  }

  /** Checks the credential, then lists the spaces it sees. */
  const spaces = (config: ConfluenceFeedConfig, secret: string): Promise<PerimeterOption[]> =>
    withContext(config, secret, [], new AbortController().signal, async (ctx) => {
      const check = await connector.test(ctx)
      if (!check.ok) throw new ConnectorError(check.code)
      return connector.perimeterOptions(ctx)
    })

  /** The spaces the configuration names, among those the credential sees: never none. */
  async function chosen(config: ConfluenceFeedConfig, secret: string): Promise<string[]> {
    const found = (await spaces(config, secret)).filter((space) =>
      spaceInScope(space, config.spaces),
    )
    if (found.length === 0) throw new ConnectorError('source_not_configured')
    return found.map((space) => space.id)
  }

  return {
    async choices(config: ConfluenceFeedConfig, secret: string): Promise<FeedChoices> {
      const listed = await spaces(config, secret)
      return {
        projects: listed.map((space) => ({
          value: KEY_IN_LABEL.exec(space.label)?.[1] ?? space.label,
          label: space.label,
        })),
        areas: [],
      }
    },
    async check(config: ConfluenceFeedConfig, secret: string): Promise<void> {
      await chosen(config, secret)
    },
    async *read(
      config: ConfluenceFeedConfig,
      secret: string,
      cursor: unknown,
      signal: AbortSignal,
    ): AsyncGenerator<FeedStep> {
      const perimeter = await chosen(config, secret)
      const start = startOfDay(config.since).toISOString()
      let from: ConfluenceCursor =
        cursor === null || cursor === undefined
          ? { since: start, space: 0, next: null, seen: start }
          : connector.parseCursor(cursor)
      for (let batch = 0; batch < MAX_BATCHES_PER_READING; batch++) {
        const read = await withContext(config, secret, perimeter, signal, (ctx) =>
          connector.sync(ctx, from, { maxItems: MAX_ITEMS_PER_DELIVERY, signal }),
        )
        from = read.nextCursor
        yield stepOf('confluence', toDelivery(read, new Set(perimeter)), from)
        if (read.done) return
      }
    },
  }
}

/**
 * Azure DevOps, Jira, Confluence and the NetSuite warehouse through the read-only connectors, on the PM's
 * computer and with the PM's own credential. What they give becomes files of the memory.
 */
export function createConnectorFeedReader(options: ConnectorFeedOptions = {}): FeedReader {
  const trackers: ConnectorReader = createConnectorReader(
    options.devEndpoints ? { devEndpoints: options.devEndpoints } : {},
  )
  const confluence = confluenceReader(options)

  const tracker = (feed: FeedName, config: FeedConfig): Tracker =>
    feed === 'ado'
      ? trackerOf.ado(config as AdoFeedConfig)
      : trackerOf.jira(config as JiraFeedConfig)

  async function* readTracker(
    feed: FeedName,
    config: FeedConfig,
    secret: string,
    cursor: unknown,
    signal: AbortSignal,
  ): AsyncGenerator<FeedStep> {
    const { kind, config: raw, scope } = tracker(feed, config)
    const connected = await trackers.connect(kind, raw, secret, scope)
    const source = { kind, ...connected, secret }
    let from = cursor ?? cursorFrom(kind, startOfDay(config.since))
    for (let batch = 0; batch < MAX_BATCHES_PER_READING; batch++) {
      const read = await trackers.pull(source, from, signal)
      from = read.nextCursor
      yield stepOf(feed, read, from)
      if (read.done) return
    }
  }

  async function* readWarehouse(
    config: WarehouseFeedConfig,
    secret: string,
  ): AsyncGenerator<FeedStep> {
    const ctx = warehouseContext(config, secret, options)
    const perimeter = new Set(ctx.perimeter)
    const since = startOfDay(config.since)
    const limits = { maxItems: MAX_ITEMS_PER_DELIVERY, signal: ctx.signal }
    let cursor: Parameters<typeof dwsiConnector.sync>[1] = null
    for (let batch = 0; batch < MAX_BATCHES_PER_READING; batch++) {
      const read = await dwsiConnector.sync(ctx, cursor, limits)
      cursor = read.nextCursor
      // The warehouse has no cursor between readings: each one reads the perimeter again.
      yield stepOf('dwsi', fromDay(toDelivery(read, perimeter), since), null)
      if (read.done) return
    }
  }

  /** The projects of a tracker and, when the configuration names one, its areas as paths. */
  async function trackerChoices(
    feed: FeedName,
    config: FeedConfig,
    secret: string,
  ): Promise<FeedChoices> {
    const { kind, config: raw } = tracker(feed, config)
    const listed = await trackers.entries(kind, raw, secret)
    if (kind === 'jira') return { projects: listed.map(jiraProjectChoice), areas: [] }
    const projects = listed.map((entry) => ({ value: entry.label, label: entry.label }))
    const wanted = (config as AdoFeedConfig).project.trim().toLowerCase()
    const chosen = listed.find((entry) => entry.label.toLowerCase() === wanted)
    if (!chosen) return { projects, areas: [] }
    const projectId = chosen.id.slice(PROJECT_OPTION_PREFIX.length)
    const nodes = await trackers.entries(kind, { ...raw, projectId }, secret)
    return { projects, areas: areaChoices(nodes) }
  }

  return {
    async choices(feed, config, secret) {
      try {
        if (feed === 'dwsi') {
          // The project codes the person is the project manager of: nothing of anybody else.
          const warehouse = config as WarehouseFeedConfig
          // The listing does not depend on the codes typed so far: a session needs one to open.
          const codes = warehouse.projectCodes.filter((code) => PRJ_CODE.test(code))
          const ctx = warehouseContext(
            { ...warehouse, projectCodes: codes.length > 0 ? codes : [NO_CODE_YET] },
            secret,
            options,
          )
          const assigned = await dwsiConnector.assigned(ctx)
          return {
            projects: assigned.map((option) => ({
              value: option.id.slice(PRJ_OPTION_PREFIX.length),
              label: option.label,
            })),
            areas: [],
          }
        }
        if (feed === 'confluence') {
          return await confluence.choices(config as ConfluenceFeedConfig, secret)
        }
        return await trackerChoices(feed, config, secret)
      } catch (error) {
        throw failure(error)
      }
    },
    async check(feed, config, secret) {
      try {
        if (feed === 'dwsi') {
          const ctx = warehouseContext(config as WarehouseFeedConfig, secret, options)
          const outcome = await dwsiConnector.test(ctx)
          if (!outcome.ok) throw new ConnectorError(outcome.code)
          return
        }
        if (feed === 'confluence') {
          return await confluence.check(config as ConfluenceFeedConfig, secret)
        }
        const { kind, config: raw, scope } = tracker(feed, config)
        await trackers.connect(kind, raw, secret, scope)
      } catch (error) {
        throw failure(error)
      }
    },
    async *read(feed, config, secret, cursor, signal) {
      try {
        if (feed === 'dwsi') yield* readWarehouse(config as WarehouseFeedConfig, secret)
        else if (feed === 'confluence') {
          yield* confluence.read(config as ConfluenceFeedConfig, secret, cursor, signal)
        } else yield* readTracker(feed, config, secret, cursor, signal)
      } catch (error) {
        throw failure(error)
      }
    },
  }
}

const SECONDS_PER_HOUR = 3600

/**
 * The hours logged on Jira, through the same read-only connector the feed uses and with the same
 * credential. Nothing but who, which day, how long and on which issue leaves the connector.
 */
export function createJiraHoursReader(options: ConnectorFeedOptions = {}): TrackerHoursReader {
  const trackers = createConnectorReader(
    options.devEndpoints ? { devEndpoints: options.devEndpoints } : {},
  )
  return {
    async read(config, secret, period, signal) {
      try {
        const { config: raw, scope } = trackerOf.jira(config)
        const source = await trackers.connect('jira', raw, secret, scope)
        const worklogs = await trackers.worklogs({ ...source, secret }, period, signal)
        return worklogs.map((worklog) => ({
          person: worklog.person,
          day: worklog.day,
          hours: worklog.seconds / SECONDS_PER_HOUR,
          issue: worklog.issueKey,
        }))
      } catch (error) {
        throw failure(error)
      }
    },
  }
}

/**
 * Azure DevOps as it is now, through the same read-only connector the feed uses and with the same
 * credential: every work item of the project and areas of the source, with the history and the
 * comments of the types asked.
 */
export function createAdoTrackerReader(options: ConnectorFeedOptions = {}): TrackerSnapshotReader {
  const trackers = createConnectorReader(
    options.devEndpoints ? { devEndpoints: options.devEndpoints } : {},
  )
  return {
    async read(config, secret, detailTypes, signal) {
      try {
        const { config: raw, scope } = trackerOf.ado(config)
        const source = await trackers.connect('ado', raw, secret, scope)
        return await trackers.tracker({ ...source, secret }, { detailTypes }, signal)
      } catch (error) {
        throw failure(error)
      }
    },
  }
}

/**
 * The hours of the timesheets from the NetSuite warehouse, through the same read-only connector
 * the feed uses and with the same credential. Only who, which day, how long, on which project and
 * whether approved leaves the connector: never the cost of an hour.
 */
export function createWarehouseTimesheetReader(
  options: ConnectorFeedOptions = {},
): TimesheetReader {
  return {
    async read(config, secret, period) {
      try {
        const rows = await dwsiConnector.timesheets(
          warehouseContext(config, secret, options),
          period,
        )
        return rows.map((row) => ({ ...row }))
      } catch (error) {
        throw failure(error)
      }
    },
  }
}
