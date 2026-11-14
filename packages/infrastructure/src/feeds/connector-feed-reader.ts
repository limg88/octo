import type { FeedReader } from '@octo/application'
import {
  ConnectorError,
  type ConnectorReader,
  createConnectorReader,
  createNetGuard,
  dwsiConnector,
  type NetGuardOptions,
  prjOption,
  renderSyncFile,
  SecretValue,
  type SyncErrorCode,
  toDelivery,
} from '@octo/connectors'
import {
  type AdoFeedConfig,
  type Delivery,
  DomainError,
  type DomainErrorCode,
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
  devEndpoints?: { jira?: string | undefined; ado?: string | undefined }
  /** Demos and tests only: lets the warehouse be a database on this computer. */
  allowLoopback?: boolean
  /** Tests only: how the name of the warehouse becomes addresses, instead of the system's DNS. */
  resolveHost?: NetGuardOptions['resolve']
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
    owner: { email: config.ownerEmail },
  }
}

/**
 * Azure DevOps, Jira and the NetSuite warehouse through the read-only connectors, on the PM's
 * computer and with the PM's own credential. What they give becomes files of the memory.
 */
export function createConnectorFeedReader(options: ConnectorFeedOptions = {}): FeedReader {
  const trackers: ConnectorReader = createConnectorReader(
    options.devEndpoints ? { devEndpoints: options.devEndpoints } : {},
  )

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

  return {
    async check(feed, config, secret) {
      try {
        if (feed === 'dwsi') {
          const ctx = warehouseContext(config as WarehouseFeedConfig, secret, options)
          const outcome = await dwsiConnector.test(ctx)
          if (!outcome.ok) throw new ConnectorError(outcome.code)
          return
        }
        const { kind, config: raw, scope } = tracker(feed, config)
        await trackers.connect(kind, raw, secret, scope)
      } catch (error) {
        throw failure(error)
      }
    },
    async *read(feed, config, secret, cursor, signal) {
      try {
        yield* feed === 'dwsi'
          ? readWarehouse(config as WarehouseFeedConfig, secret)
          : readTracker(feed, config, secret, cursor, signal)
      } catch (error) {
        throw failure(error)
      }
    },
  }
}
