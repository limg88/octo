import type { FeedIndex, FeedName } from './feeds.ts'
import type { Project } from './project.ts'
import type { SourceState } from './sources.ts'

export const BACKUP_FORMAT = 'octo-backup'
export const BACKUP_VERSION = 1
const BACKUP_FILE_PREFIX = 'octo-copia'

/** What Octo wrote of a feed in a project, with the perimeter it was read with. */
export type BackupFeedIndex = { scope: string; items: FeedIndex }

/** A project of the list with what this computer knows of its readings. */
export type BackupProject = {
  project: Project
  /** Where each source had got to, by the name of the source. */
  sources: Record<string, SourceState>
  feeds: Partial<Record<FeedName, BackupFeedIndex>>
}

/**
 * What a new computer needs to go on from where the old one stopped: the list of the projects and
 * the state of their readings. Never the credentials: they are entered again. The memory, the
 * settings and the questions of a project are in its folder, and are copied with it.
 */
export type Backup = {
  format: typeof BACKUP_FORMAT
  version: typeof BACKUP_VERSION
  createdAt: string
  projects: BackupProject[]
}

/** What a restore did, by the names of the projects. */
export type RestoreOutcome = {
  restored: string[]
  /** Already in the list of this computer: left as they are. */
  alreadyHere: string[]
  /** Their folder is not on this computer and none was given. */
  skipped: string[]
}

/** The name proposed for the file of a backup made at this instant. */
export function backupFileName(at: Date): string {
  return `${BACKUP_FILE_PREFIX}-${at.toISOString().slice(0, 10)}.json`
}
