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
  DashboardSettingsStore,
  MemoryWriter,
  SecretVault,
  SourceSettings,
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
}

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
    const snapshot = await deps.tracker.read(config, secret, settings.bugTypes, signal)
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

  return {
    async read(project) {
      if (running.has(project.id)) throw new DomainError('source_busy', 'ado')
      running.add(project.id)
      try {
        return await read(project)
      } finally {
        running.delete(project.id)
      }
    },
  }
}
