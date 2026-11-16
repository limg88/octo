import {
  assignedToOwnPeople,
  cleanDashboardSettings,
  DomainError,
  type Project,
  type ProjectTeam,
  parseTrackerExport,
  TRACKER_HISTORY_PATH,
  TRACKER_SNAPSHOT_PATH,
  TRACKER_SUMMARY_PATH,
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
} from './ports.ts'

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
}

/** A reading younger than this is not asked again by the periodic one. */
export const TRACKER_REFRESH_MS = 60 * 60 * 1000

/** What a reading of the tracker brought. */
export type TrackerSnapshotRun = {
  /** The instant the data of the tracker hold. */
  at: string
  items: number
  /** How many of them have their history of states and their comments. */
  withHistory: number
}

export type TrackerSnapshots = {
  /**
   * Reads the tracker as it is now with the credential of the Azure DevOps source, writes it in
   * the project as the export the dashboard reads, and points the dashboard at it.
   */
  read(project: Project): Promise<TrackerSnapshotRun>
  /**
   * Reads the tracker again when the dashboard is computed from Octo's own reading and that
   * reading is older than `olderThanMs`. Null when there was nothing to do: Azure DevOps not
   * linked, an export kept by hand, a reading still fresh or already under way. It never throws
   * for a source that is not there: a periodic reading has nobody to tell.
   */
  refresh(project: Project, olderThanMs?: number): Promise<TrackerSnapshotRun | null>
}

const json = (value: unknown): string => `${JSON.stringify(value)}\n`

export function createTrackerSnapshots(deps: TrackerSnapshotsDeps): TrackerSnapshots {
  const running = new Set<string>()

  async function read(project: Project): Promise<TrackerSnapshotRun> {
    const config = (await deps.sources.load(project.folder)).ado
    if (!config) throw new DomainError('source_not_configured', 'ado')
    const secret = await deps.secrets.get(secretKey(project, 'ado'))
    if (!secret) throw new DomainError('secret_missing', 'ado')
    const settings = await deps.settings.load(project.folder)
    const signal = new AbortController().signal
    // The stories too: their comments tell who waits for an answer, their changes when they closed.
    const detailTypes = [...new Set([...settings.bugTypes, ...settings.storyTypes])]
    const snapshot = await deps.tracker.read(config, secret, detailTypes, signal)
    await deps.writer.write(
      project.folder,
      TRACKER_SNAPSHOT_PATH,
      json({ exported_at: snapshot.exportedAt, items: snapshot.items }),
    )
    await deps.writer.write(
      project.folder,
      TRACKER_HISTORY_PATH,
      json({ exported_at: snapshot.exportedAt, bugs: snapshot.history }),
    )
    await deps.settings.save(
      project.folder,
      cleanDashboardSettings({
        ...settings,
        exportPath: TRACKER_SNAPSHOT_PATH,
        historyPath: TRACKER_HISTORY_PATH,
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
      at: snapshot.exportedAt,
      items: snapshot.items.length,
      withHistory: Object.keys(snapshot.history).length,
    }
  }

  async function guarded(project: Project): Promise<TrackerSnapshotRun> {
    if (running.has(project.id)) throw new DomainError('source_busy', 'ado')
    running.add(project.id)
    try {
      return await read(project)
    } finally {
      running.delete(project.id)
    }
  }

  /** When the reading the dashboard uses was made; null when it does not say. */
  async function readAt(project: Project): Promise<number | null> {
    const raw = await deps.exports
      ?.readJson(project.folder, TRACKER_SNAPSHOT_PATH)
      .catch(() => null)
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
      if (settings.exportPath !== TRACKER_SNAPSHOT_PATH) return null
      if (!(await deps.sources.load(project.folder)).ado) return null
      if (!(await deps.secrets.get(secretKey(project, 'ado')))) return null
      const last = await readAt(project)
      const now = (deps.clock?.now() ?? new Date()).getTime()
      if (last !== null && now - last < olderThanMs) return null
      return guarded(project)
    },
  }
}
