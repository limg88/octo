import { FEED_NAMES, type FeedName, type Project, scopeWithoutAccount } from '@octo/domain'
import type {
  FeedIndexes,
  FolderProbe,
  LegacyFeedIndexes,
  SharedReadings,
  SourceName,
  SourceStates,
  ThisReader,
} from './ports.ts'

export type FolderMigrationDeps = {
  /** What an earlier Octo kept on this computer of what each feed wrote. */
  legacy: LegacyFeedIndexes
  indexes: FeedIndexes
  states: SourceStates
  shared: SharedReadings
  folders: FolderProbe
  me: ThisReader
}

export type FolderMigration = {
  /**
   * Hands over to the folder of a project what an earlier Octo kept on this computer of its
   * readings: what each feed wrote, where its next reading starts, when each source was last
   * read. Whoever opens the folder from another computer goes on from there, and nothing is
   * read again from the start. What the folder already says is never written over. Safe at
   * every start: once handed over there is nothing left to do.
   */
  run(project: Project): Promise<void>
}

const OWN_TO_COMPUTER: readonly SourceName[] = ['mail', 'meetings']
const SOURCES: readonly SourceName[] = ['mail', 'meetings', 'documents', ...FEED_NAMES]

export function createFolderMigration(deps: FolderMigrationDeps): FolderMigration {
  /** The last good reading of this computer, told to a folder that knows of none. */
  async function tellReading(project: Project, source: SourceName): Promise<void> {
    const shared = await deps.shared.get(project.folder, source)
    const local = await deps.states.get(project.id, source)
    if (shared.lastRun !== null || shared.cursor !== null) return
    if (local.lastRun === null || local.lastRun.error !== null) return
    await deps.shared.set(project.folder, source, {
      // Where the mail and the meetings go on from stays with the computer that holds them.
      cursor: OWN_TO_COMPUTER.includes(source) ? null : local.cursor,
      lastRun: { ...local.lastRun, by: local.lastRun.by ?? deps.me() },
      lease: null,
    })
  }

  async function handOverIndex(project: Project, feed: FeedName): Promise<void> {
    const kept = await deps.legacy.load(project.id, feed)
    if (kept.scope === null) return
    const held = await deps.indexes.load(project.folder, feed)
    if (held.scope === null) {
      // The account was part of the perimeter: without it, it is the perimeter of today.
      const scope = scopeWithoutAccount(feed, kept.scope) ?? kept.scope
      await deps.indexes.save(project.folder, feed, scope, kept.items)
    }
    await deps.legacy.remove(project.id, feed)
  }

  return {
    async run(project) {
      if (!(await deps.folders.isReadableFolder(project.folder))) return
      for (const feed of FEED_NAMES) await handOverIndex(project, feed)
      for (const source of SOURCES) await tellReading(project, source)
    },
  }
}
