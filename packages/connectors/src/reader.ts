import { MAX_ITEMS_PER_DELIVERY, type PullSourceKind } from '@octo/domain'
import { type AdoConnector, type AdoTrackerOptions, createAdoConnector } from './ado/connector.ts'
import type { AdoTrackerSnapshot } from './ado/tracker.ts'
import { type ConnectorDelivery, toDelivery } from './delivery.ts'
import { ConnectorError } from './errors.ts'
import {
  createJiraConnector,
  type JiraConnector,
  type JiraTrackerOptions,
  type NewJiraIssue,
} from './jira/connector.ts'
import type { JiraTrackerSnapshot } from './jira/tracker.ts'
import type { JiraWorklog, WorklogPeriod } from './jira/worklogs.ts'
import { createNetGuard } from './net-guard.ts'
import type { AnyConnector, ConnectorContext, Json, PerimeterOption, SyncBatch } from './port.ts'
import type { HttpRule } from './rules.ts'
import { createSafeHttp } from './safe-http.ts'
import { SecretValue } from './secret-value.ts'

const PROJECT_OPTION_PREFIX = 'project:'
const AREA_OPTION_PREFIX = 'area:'
/** The code when the scope the PM gave matches nothing the credential can see. */
const NOTHING_TO_READ = 'source_not_configured'

export interface ConnectorReaderOptions {
  /**
   * Development only: the loopback address of a fake Jira or Azure DevOps to read instead of
   * the public hosts. Never set in production.
   */
  readonly devEndpoints?: { readonly jira?: string | undefined; readonly ado?: string | undefined }
  /** Told of every call the safe HTTP client refused before the network. */
  readonly onBlocked?: (call: { reason: string; method: string; host: string }) => Promise<void>
}

/** A tracker to read: its settings, what to read of it, its credential. */
export interface ReadableSource {
  readonly kind: PullSourceKind
  readonly config: unknown
  readonly perimeter: readonly string[]
  readonly secret: string | null
}

export interface ConnectorReader {
  /**
   * Checks the settings and the credential against the system and returns the settings to keep
   * with the perimeter to read: the entries of the system that match `scope` (project keys or
   * names), or all of them when it is empty.
   */
  connect(
    kind: PullSourceKind,
    rawConfig: unknown,
    secret: string,
    scope: readonly string[],
  ): Promise<{ config: Record<string, unknown>; perimeter: string[] }>
  /**
   * What the credential can see, for the PM to choose from: the projects of the system or, for an
   * Azure DevOps configuration that names its project (`projectId`), its areas and iterations.
   */
  entries(kind: PullSourceKind, rawConfig: unknown, secret: string): Promise<PerimeterOption[]>
  /** The next batch after `cursor` (null: from the beginning). */
  pull(source: ReadableSource, cursor: unknown, signal: AbortSignal): Promise<ConnectorDelivery>
  /** The hours logged on a Jira source over a period: read only when the PM asks for them. */
  worklogs(
    source: Omit<ReadableSource, 'kind'>,
    period: WorklogPeriod,
    signal: AbortSignal,
  ): Promise<JiraWorklog[]>
  /**
   * Creates issues on a Jira source, one call each, because the PM asked for exactly these. The
   * client it uses may do nothing but that call. Each issue gives its key or the code of what
   * refused it: one that fails does not stop the others.
   */
  createIssues(
    source: Omit<ReadableSource, 'kind'>,
    issues: readonly NewJiraIssue[],
    signal: AbortSignal,
  ): Promise<Array<{ key: string } | { error: string }>>
  /**
   * Every work item of an Azure DevOps source, or every issue of a Jira one, as it is now: read
   * only when the PM asks.
   */
  tracker(
    source: ReadableSource,
    options: AdoTrackerOptions & JiraTrackerOptions,
    signal: AbortSignal,
  ): Promise<AdoTrackerSnapshot | JiraTrackerSnapshot>
}

function connectorsOf(options: ConnectorReaderOptions): Record<PullSourceKind, AnyConnector> {
  const { jira, ado } = options.devEndpoints ?? {}
  const local = (origin: string) => ({ origin, host: new URL(origin).host, prefix: [] })
  return {
    jira: createJiraConnector(
      jira ? { endpoint: () => ({ ...local(jira), browse: jira }) } : undefined,
    ),
    // As on dev.azure.com, the organization is the first segment of every path.
    ado: createAdoConnector(
      ado
        ? {
            endpoint: (config) => ({ ...local(ado), prefix: [config.organization], web: ado }),
          }
        : undefined,
    ),
  }
}

/** Whether an entry of the system is one the PM named: by its label, or its key in brackets. */
function inScope(option: PerimeterOption, scope: readonly string[]): boolean {
  const label = option.label.toLowerCase()
  return scope.some((raw) => {
    const wanted = raw.trim().toLowerCase()
    return wanted !== '' && (label === wanted || label.endsWith(`(${wanted})`))
  })
}

const pathKey = (path: string): string =>
  path
    .split(/[\\/]/)
    .map((part) => part.trim().toLowerCase())
    .filter((part) => part !== '')
    .join('\\')

/**
 * The areas of an Azure DevOps project to read. With none named, the root areas: the whole
 * project (naming every node would make a query too long). Otherwise the areas named by their
 * path, with or without the project in front; one that the project does not have is an error,
 * never a perimeter read in part.
 */
function areasOf(nodes: readonly PerimeterOption[], named: readonly string[]): PerimeterOption[] {
  const areas = nodes.filter((node) => node.id.startsWith(AREA_OPTION_PREFIX))
  const roots = areas.filter((node) => node.parentId === undefined)
  if (named.length === 0) return roots
  const byId = new Map(areas.map((node) => [node.id, node]))
  const pathOf = (node: PerimeterOption): string[] => {
    const parent = node.parentId === undefined ? undefined : byId.get(node.parentId)
    return [...(parent ? pathOf(parent) : []), node.label]
  }
  const byPath = new Map<string, PerimeterOption>()
  for (const node of areas) {
    const path = pathOf(node)
    byPath.set(pathKey(path.join('\\')), node)
    // Without the project in front, as people write it; a root keeps its own name only.
    if (path.length > 1) byPath.set(pathKey(path.slice(1).join('\\')), node)
  }
  for (const root of roots) byPath.set(pathKey(root.label), root)
  return named.map((name) => {
    const found = byPath.get(pathKey(name))
    if (!found) throw new ConnectorError('source_not_found')
    return found
  })
}

/**
 * Jira and Azure DevOps through the read-only connectors: every call goes through the safe HTTP
 * client (allowlisted paths, no redirects, no private addresses). Failures are `ConnectorError`s
 * with a code only. Used by the worker and by the sync add-on alike.
 */
export function createConnectorReader(options: ConnectorReaderOptions = {}): ConnectorReader {
  const connectors = connectorsOf(options)
  const allowLoopback = Boolean(options.devEndpoints?.jira || options.devEndpoints?.ado)
  const onBlocked = options.onBlocked ?? (async () => {})

  /** Runs `work` with the context of one source; the HTTP client is closed afterwards. */
  async function withContext<T>(
    kind: PullSourceKind,
    source: { config: unknown; perimeter: readonly string[]; secret: string | null },
    signal: AbortSignal,
    work: (connector: AnyConnector, ctx: ConnectorContext<unknown>) => Promise<T>,
    /** The rules of the client when it is not there to read. */
    rules?: (connector: AnyConnector) => HttpRule[],
  ): Promise<T> {
    const connector = connectors[kind]
    const http = createSafeHttp({
      rules: rules?.(connector) ?? connector.rules(source.config),
      onBlocked,
      allowLoopbackHttp: allowLoopback,
      signal,
    })
    try {
      return await work(connector, {
        config: source.config,
        perimeter: source.perimeter,
        secret: source.secret === null ? null : new SecretValue(source.secret),
        http,
        net: createNetGuard({ privateHosts: [], onBlocked, allowLoopback }),
        signal,
        now: () => new Date(),
      })
    } finally {
      http.close()
    }
  }

  /** Checks the credential, then lists what it can see for this configuration. */
  function optionsOf(kind: PullSourceKind, config: unknown, secret: string) {
    const signal = new AbortController().signal
    return withContext(kind, { config, perimeter: [], secret }, signal, async (connector, ctx) => {
      const check = await connector.test(ctx)
      if (!check.ok) throw new ConnectorError(check.code)
      return connector.perimeterOptions(ctx) as Promise<PerimeterOption[]>
    })
  }

  /**
   * The settings with the sprint and estimate fields of the site, where they name none: without
   * them every issue is read with no sprint. A site that does not show its fields is read as before.
   */
  async function withJiraFields(config: unknown, secret: string): Promise<unknown> {
    const settings = config as { sprintField: string | null; storyPointsField: string | null }
    if (settings.sprintField !== null && settings.storyPointsField !== null) return config
    const signal = new AbortController().signal
    try {
      const found = await withContext('jira', { config, perimeter: [], secret }, signal, (c, ctx) =>
        (c as unknown as JiraConnector).customFields(ctx as never),
      )
      return {
        ...settings,
        sprintField: settings.sprintField ?? found.sprintField,
        storyPointsField: settings.storyPointsField ?? found.storyPointsField,
      }
    } catch (error) {
      if (error instanceof ConnectorError) return config
      throw error
    }
  }

  return {
    entries: (kind, rawConfig, secret) =>
      optionsOf(kind, connectors[kind].parseConfig(rawConfig), secret),

    async connect(kind, rawConfig, secret, scope) {
      const optionsFor = (config: unknown) => optionsOf(kind, config, secret)
      let config = connectors[kind].parseConfig(rawConfig)
      let entries = await optionsFor(config)
      if (kind === 'ado') {
        // Azure DevOps lists projects first; its areas and iterations are the perimeter.
        const project = entries.find((entry) => inScope(entry, scope.slice(0, 1)))
        if (!project) throw new ConnectorError(NOTHING_TO_READ)
        const projectId = project.id.slice(PROJECT_OPTION_PREFIX.length)
        config = connectors[kind].parseConfig({ ...(rawConfig as object), projectId })
        entries = areasOf(await optionsFor(config), scope.slice(1))
      } else {
        if (scope.length > 0) entries = entries.filter((entry) => inScope(entry, scope))
        config = await withJiraFields(config, secret)
      }
      if (entries.length === 0) throw new ConnectorError(NOTHING_TO_READ)
      return {
        config: config as Record<string, unknown>,
        perimeter: entries.map((entry) => entry.id),
      }
    },

    async worklogs(source, period, signal) {
      const config = connectors.jira.parseConfig(source.config)
      return withContext('jira', { ...source, config }, signal, (connector, ctx) =>
        (connector as unknown as JiraConnector).worklogs(ctx as never, period),
      )
    },

    async createIssues(source, issues, signal) {
      const config = connectors.jira.parseConfig(source.config)
      const jira = connectors.jira as unknown as JiraConnector
      return withContext(
        'jira',
        { ...source, config },
        signal,
        async (_connector, ctx) => {
          const outcomes: Array<{ key: string } | { error: string }> = []
          for (const issue of issues) {
            try {
              outcomes.push({ key: await jira.createIssue(ctx as never, issue) })
            } catch (error) {
              if (!(error instanceof ConnectorError)) throw error
              outcomes.push({ error: error.code })
            }
          }
          return outcomes
        },
        () => jira.writeRules(config),
      )
    },

    async tracker(source, options, signal) {
      const config = connectors[source.kind].parseConfig(source.config)
      return withContext(
        source.kind,
        { ...source, config },
        signal,
        (connector, ctx): Promise<AdoTrackerSnapshot | JiraTrackerSnapshot> =>
          (connector as unknown as AdoConnector | JiraConnector).tracker(ctx as never, options),
      )
    },

    async pull(source, cursor, signal) {
      const config = connectors[source.kind].parseConfig(source.config)
      return withContext(source.kind, { ...source, config }, signal, async (connector, ctx) => {
        let from: unknown
        try {
          from = cursor === null || cursor === undefined ? null : connector.parseCursor(cursor)
        } catch {
          throw new ConnectorError('source_cursor_invalid')
        }
        const batch = await connector.sync(ctx, from, { maxItems: MAX_ITEMS_PER_DELIVERY, signal })
        return toDelivery(batch as SyncBatch<Json>, new Set(source.perimeter))
      })
    },
  }
}
