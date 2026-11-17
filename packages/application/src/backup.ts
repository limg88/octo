import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  type Backup,
  type BackupProject,
  FEED_NAMES,
  type Project,
  type RestoreOutcome,
  sameFolder,
} from '@octo/domain'
import type {
  BackupFiles,
  Clock,
  FeedIndexes,
  FolderProbe,
  ProjectRegistry,
  QuestionLog,
  SourceName,
  SourceStates,
} from './ports.ts'

const SOURCE_NAMES: readonly SourceName[] = ['mail', 'documents', ...FEED_NAMES]

export type BackupsDeps = {
  registry: ProjectRegistry
  sourceStates: SourceStates
  indexes: FeedIndexes
  folders: FolderProbe
  files: BackupFiles
  clock: Clock
  /** The questions of who uses this computer: they are with the app, so the backup takes them. */
  questions?: QuestionLog
}

/** A backup that was opened, and the projects whose folder has to be pointed at by hand. */
export type OpenedBackup = {
  backup: Backup
  /** Not in the list of this computer, and their folder is not where it was. */
  toLocate: Project[]
}

export type Backups = {
  /** Writes the list of the projects and the state of their readings; returns how many projects. */
  save(file: string): Promise<number>
  open(file: string): Promise<OpenedBackup>
  /**
   * Adds the projects of the backup to this computer. `folders` says, by project id, where a
   * project is now; a project without one is looked for where it was.
   */
  restore(backup: Backup, folders: Readonly<Record<string, string>>): Promise<RestoreOutcome>
}

export function createBackups(deps: BackupsDeps): Backups {
  async function entryOf(project: Project): Promise<BackupProject> {
    const feeds: BackupProject['feeds'] = {}
    for (const feed of FEED_NAMES) {
      const index = await deps.indexes.load(project.folder, feed)
      if (index.scope !== null) feeds[feed] = { scope: index.scope, items: index.items }
    }
    const questions = (await deps.questions?.list(project.folder)) ?? []
    return {
      project,
      sources: await deps.sourceStates.ofProject(project.id),
      feeds,
      ...(questions.length > 0 ? { questions } : {}),
    }
  }

  const isHere = (entry: BackupProject, projects: readonly Project[], folder: string): boolean =>
    projects.some(
      (project) => project.id === entry.project.id || sameFolder(project.folder, folder),
    )

  async function save(file: string): Promise<number> {
    const projects = await deps.registry.list()
    const backup: Backup = {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      createdAt: deps.clock.now().toISOString(),
      projects: await Promise.all(projects.map(entryOf)),
    }
    await deps.files.write(file, backup)
    return projects.length
  }

  async function open(file: string): Promise<OpenedBackup> {
    const backup = await deps.files.read(file)
    const projects = await deps.registry.list()
    const toLocate: Project[] = []
    for (const entry of backup.projects) {
      if (isHere(entry, projects, entry.project.folder)) continue
      if (!(await deps.folders.isReadableFolder(entry.project.folder))) toLocate.push(entry.project)
    }
    return { backup, toLocate }
  }

  async function putReadings(entry: BackupProject, folder: string): Promise<void> {
    const { id } = entry.project
    for (const source of SOURCE_NAMES) {
      const state = entry.sources[source]
      if (state) await deps.sourceStates.set(id, source, state)
    }
    for (const feed of FEED_NAMES) {
      const index = entry.feeds[feed]
      // The folder knows what its feeds wrote: what it says is newer than any backup.
      const held = await deps.indexes.load(folder, feed)
      if (index && held.scope === null)
        await deps.indexes.save(folder, feed, index.scope, index.items)
    }
  }

  /** The questions of the backup, unless this computer already holds some for the project. */
  async function putQuestions(folder: string, entry: BackupProject): Promise<void> {
    const questions = entry.questions ?? []
    if (!deps.questions || (await deps.questions.list(folder)).length > 0) return
    for (const question of questions) await deps.questions.append(folder, question)
  }

  async function restore(
    backup: Backup,
    folders: Readonly<Record<string, string>>,
  ): Promise<RestoreOutcome> {
    const outcome: RestoreOutcome = { restored: [], alreadyHere: [], skipped: [] }
    const asked: Array<{ folder: string; entry: BackupProject }> = []
    let projects = await deps.registry.list()
    for (const entry of backup.projects) {
      const folder = folders[entry.project.id] ?? entry.project.folder
      if (isHere(entry, projects, folder)) {
        outcome.alreadyHere.push(entry.project.name)
      } else if (!(await deps.folders.isReadableFolder(folder))) {
        outcome.skipped.push(entry.project.name)
      } else {
        await putReadings(entry, folder)
        projects = [...projects, { ...entry.project, folder }]
        outcome.restored.push(entry.project.name)
        asked.push({ folder, entry })
      }
    }
    await deps.registry.save(projects)
    // After the list: the questions are kept by project, and the project has to be in it.
    for (const { folder, entry } of asked) await putQuestions(folder, entry)
    return outcome
  }

  return { save, open, restore }
}
