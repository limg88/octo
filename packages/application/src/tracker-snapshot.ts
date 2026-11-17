import {
  assignedToOwnPeople,
  cleanDashboardSettings,
  DomainError,
  isDomainError,
  type Project,
  type ProjectTeam,
  parseTrackerExport,
  type SourcesConfig,
  TRACKER_PATHS,
  TRACKER_SUMMARY_PATH,
  type TrackerKind,
  trackerOfExport,
  trackerSummary,
} from '@octo/domain'
import { secretKey } from './feeds.ts'
import type {
  Clock,
  DashboardSettingsStore,
  MemoryWriter,
  SecretVault,
  SourceSettings,
  TrackerExports,
  TrackerSnapshotReader,
  TrackerSource,
} from './ports.ts'
import type { Readings } from './readings.ts'

export type TrackerSnapshotsDeps = {
  settings: DashboardSettingsStore
  sources: SourceSettings
  secrets: SecretVault
  tracker: TrackerSnapshotReader
  writer: MemoryWriter
  /** The people of the project: who the supplier's own are, when only their items count. */
  team?: (project: Project) => Promise<ProjectTeam>
  /** With these, the tracker is read again by itself when its reading is old enough. */
  exports?: Pick<TrackerExports, 'readJson'>
  clock?: Clock
  /**
   * The turns of the readings: with them the tracker is read by one computer at a time among
   * those that share the folder of the project.
   */
  readings?: Pick<Readings, 'exclusive' | 'busyElsewhere'>
}

const SOURCE = 'tracker'

/**
 * The tracker the dashboard is read from: Azure DevOps when the project has it, Jira otherwise;
 * null when it has neither.
 */
export function trackerSource(sources: Pick<SourcesConfig, 'ado' | 'jira'>): TrackerSource | null {
  if (sources.ado) return { kind: 'ado', config: sources.ado }
  return sources.jira ? { kind: 'jira', config: sources.jira } : null
}

/** A reading younger than this is not asked again by the periodic one. */
export const TRACKER_REFRESH_MS = 60 * 60 * 1000

/** What a reading of the tracker brought. */
export type TrackerSnapshotRun = {
  /** The tracker that was read. */
  tracker: TrackerKind
  /** The instant the data of the tracker hold. */
  at: string
  items: number
  /** How many of them have their history of states and their comments. */
  withHistory: number
}

export type TrackerSnapshots = {
  /**
   * Reads the tracker as it is now with the credential of its source (Azure DevOps, or Jira for
   * a project without it), writes it in the project as the export the dashboard reads, and points
   * the dashboard at it.
   */
  read(project: Project): Promise<TrackerSnapshotRun>
  /**
   * Reads the tracker again when the dashboard is computed from Octo's own reading and that
   * reading is older than `olderThanMs`. Null when there was nothing to do: no tracker
   * linked, an export kept by hand, a reading still fresh or already under way. It never throws
   * for a source that is not there: a periodic reading has nobody to tell.
   */
  refresh(project: Project, olderThanMs?: number): Promise<TrackerSnapshotRun | null>
}

const json = (value: unknown): string => `${JSON.stringify(value)}\n`

export function createTrackerSnapshots(deps: TrackerSnapshotsDeps): TrackerSnapshots {
  const running = new Set<string>()

  async function read(project: Project): Promise<TrackerSnapshotRun> {
    const source = trackerSource(await deps.sources.load(project.folder))
    if (!source) throw new DomainError('source_not_configured', 'tracker')
    const secret = await deps.secrets.get(secretKey(project, source.kind))
    if (!secret) throw new DomainError('secret_missing', source.kind)
    const paths = TRACKER_PATHS[source.kind]
    const settings = await deps.settings.load(project.folder)
    const signal = new AbortController().signal
    // The stories too: their comments tell who waits for an answer, their changes when they closed.
    const detailTypes = [...new Set([...settings.bugTypes, ...settings.storyTypes])]
    const snapshot = await deps.tracker.read(source, secret, detailTypes, signal)
    await deps.writer.write(
      project.folder,
      paths.snapshot,
      json({ exported_at: snapshot.exportedAt, items: snapshot.items }),
    )
    await deps.writer.write(
      project.folder,
      paths.history,
      json({ exported_at: snapshot.exportedAt, bugs: snapshot.history }),
    )
    await deps.settings.save(
      project.folder,
      cleanDashboardSettings({
        ...settings,
        exportPath: paths.snapshot,
        historyPath: paths.history,
      }),
    )
    // The same reading in numbers, as a text a report can cite instead of counting.
    const parsed = parseTrackerExport({ exported_at: snapshot.exportedAt, items: snapshot.items })
    if (parsed) {
      await deps.writer.write(
        project.folder,
        TRACKER_SUMMARY_PATH,
        trackerSummary(
          settings.ownPeopleOnly && deps.team
            ? { ...parsed, items: assignedToOwnPeople(parsed.items, await deps.team(project)) }
            : parsed,
          settings,
        ),
      )
    }
    return {
      tracker: source.kind,
      at: snapshot.exportedAt,
      items: snapshot.items.length,
      withHistory: Object.keys(snapshot.history).length,
    }
  }

  async function guarded(project: Project): Promise<TrackerSnapshotRun> {
    if (running.has(project.id)) throw new DomainError('source_busy', 'tracker')
    running.add(project.id)
    try {
      return await (deps.readings
        ? deps.readings.exclusive(project, SOURCE, () => read(project))
        : read(project))
    } finally {
      running.delete(project.id)
    }
  }

  /** When the reading the dashboard uses was made; null when it does not say. */
  async function readAt(project: Project, exportPath: string): Promise<number | null> {
    const raw = await deps.exports?.readJson(project.folder, exportPath).catch(() => null)
    const at =
      typeof raw === 'object' && raw !== null && 'exported_at' in raw ? raw.exported_at : null
    const instant = typeof at === 'string' ? Date.parse(at) : Number.NaN
    return Number.isNaN(instant) ? null : instant
  }

  return {
    read: guarded,

    async refresh(project, olderThanMs = TRACKER_REFRESH_MS) {
      if (running.has(project.id)) return null
      const settings = await deps.settings.load(project.folder)
      const source = trackerSource(await deps.sources.load(project.folder))
      // An export kept by hand, or the reading of a tracker no longer the one to read.
      if (!source || trackerOfExport(settings.exportPath) !== source.kind) return null
      if (!(await deps.secrets.get(secretKey(project, source.kind)))) return null
      const last = await readAt(project, settings.exportPath)
      const now = (deps.clock?.now() ?? new Date()).getTime()
      if (last !== null && now - last < olderThanMs) return null
      // Another computer is reading it right now: its reading is the one the dashboard will use.
      if (await deps.readings?.busyElsewhere(project, SOURCE)) return null
      try {
        return await guarded(project)
      } catch (error) {
        if (isDomainError(error) && error.code === 'source_busy_elsewhere') return null
        throw error
      }
    },
  }
}
