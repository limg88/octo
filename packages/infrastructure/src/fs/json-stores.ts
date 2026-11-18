import { access, constants, mkdir, stat, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type {
  BackupFiles,
  FolderProbe,
  PreferencesStore,
  ProjectRegistry,
  ProjectScaffold,
  QuestionLog,
} from '@octo/application'
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  type Backup,
  CITATION_STATUSES,
  DOMAIN_ERROR_CODES,
  DomainError,
  FEED_NAMES,
  HISTORY_FOLDER,
  type Project,
  type QuestionRecord,
} from '@octo/domain'
import { z } from 'zod'
import { readJsonOr, removeFile, writeJson } from './json-file.ts'
import { createPersonalFiles, type ProjectOfFolder } from './personal-files.ts'

const projectSchema = z.object({
  id: z.string(),
  name: z.string(),
  folder: z.string(),
  addedAt: z.string(),
  owner: z.string().optional(),
})

const citationSchema = z.object({
  n: z.number(),
  path: z.string(),
  quote: z.string(),
  status: z.enum(CITATION_STATUSES),
  modifiedAt: z.string().nullable(),
})

const questionSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  question: z.string(),
  askedAt: z.string(),
  durationMs: z.number(),
  answer: z
    .object({
      text: z.string(),
      citations: z.array(citationSchema),
      missing: z.array(z.string()),
      markersWithoutCitation: z.array(z.number()),
      tables: z
        .array(
          z.object({
            title: z.string(),
            columns: z.array(z.string()),
            rows: z.array(z.array(z.string())),
            sources: z.array(z.object({ path: z.string(), found: z.boolean() })),
            file: z.string(),
            fileWritten: z.boolean(),
          }),
        )
        .optional(),
    })
    .nullable(),
  error: z.enum(DOMAIN_ERROR_CODES).nullable(),
  conversationId: z.string().optional(),
  model: z.string().nullable().optional(),
  work: z.object({ files: z.array(z.string()), keptIn: z.string().nullable() }).optional(),
})

const PROJECTS_FILE = 'projects.json'
const SET_ASIDE_FILE = 'projects-set-aside.json'
const QUESTIONS_FILE = 'domande.json'
const PREFERENCES_FILE = 'preferences.json'
const PRIVATE_FILE_MODE = 0o600

/** The app's own state lives in its data folder, never in the project folder. */
export function createJsonProjectRegistry(dataFolder: string): ProjectRegistry {
  return projectListIn(join(dataFolder, PROJECTS_FILE))
}

/** The projects taken off the list, beside the list itself. */
export function createJsonSetAsideProjects(dataFolder: string): ProjectRegistry {
  return projectListIn(join(dataFolder, SET_ASIDE_FILE))
}

/** What the person set for the app on this computer, beside the list of the projects. */
export function createJsonPreferences(dataFolder: string): PreferencesStore {
  const file = join(dataFolder, PREFERENCES_FILE)
  return {
    load: () => readJsonOr(file, null),
    save: (preferences) => writeJson(file, preferences, PRIVATE_FILE_MODE),
  }
}

function projectListIn(file: string): ProjectRegistry {
  return {
    list: async (): Promise<Project[]> => z.array(projectSchema).parse(await readJsonOr(file, [])),
    save: (projects) => writeJson(file, projects, PRIVATE_FILE_MODE),
  }
}

const QUESTIONS_AREA = 'questions'

/**
 * The questions one person asked of a project, kept with the app: a folder other people open
 * too is not where one's own conversations live. What an Octo from before a folder could be
 * shared left in the folder is taken out of it once, by the computer that asked it: each
 * question carries the id the project has on the computer it was asked from.
 */
export function createJsonQuestionLog(dataFolder: string, projectOf: ProjectOfFolder): QuestionLog {
  const personal = createPersonalFiles(dataFolder, QUESTIONS_AREA, projectOf)
  const ownFile = async (projectFolder: string): Promise<string> =>
    join(await personal.folderOf(projectFolder), QUESTIONS_FILE)
  const legacyFile = (projectFolder: string) =>
    join(projectFolder, ...HISTORY_FOLDER.split('/'), QUESTIONS_FILE)
  const read = async (file: string): Promise<QuestionRecord[] | null> => {
    const raw = await readJsonOr(file, null)
    return raw === null ? null : z.array(questionSchema).parse(raw)
  }

  /** The questions of this computer the folder still holds, moved here; the others stay. */
  async function takeOver(projectFolder: string, own: string): Promise<QuestionRecord[]> {
    const project = await projectOf(projectFolder)
    const legacy = legacyFile(projectFolder)
    const kept = project === null ? null : await read(legacy).catch(() => null)
    const mine = (kept ?? []).filter((record) => record.projectId === project?.id)
    if (kept === null || mine.length === 0) return []
    await writeJson(own, mine, PRIVATE_FILE_MODE)
    const others = kept.filter((record) => record.projectId !== project?.id)
    if (others.length === 0) await removeFile(legacy)
    else await writeJson(legacy, others)
    return mine
  }

  const list = async (projectFolder: string): Promise<QuestionRecord[]> => {
    const own = await ownFile(projectFolder)
    return (await read(own)) ?? takeOver(projectFolder, own)
  }

  return {
    list,
    async append(projectFolder, record) {
      const kept = await list(projectFolder)
      const at = kept.findIndex((known) => known.id === record.id)
      const next = at < 0 ? [...kept, record] : kept.with(at, record)
      await writeJson(await ownFile(projectFolder), next, PRIVATE_FILE_MODE)
    },
  }
}

const sourceStateSchema = z.object({
  cursor: z.string().nullable(),
  lastRun: z
    .object({
      at: z.string(),
      written: z.number(),
      unchanged: z.number(),
      error: z.enum(DOMAIN_ERROR_CODES).nullable(),
    })
    .nullable(),
})

const feedIndexSchema = z.object({
  scope: z.string(),
  items: z.record(z.string(), z.object({ version: z.string(), path: z.string() })),
})

const backupSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.literal(BACKUP_VERSION),
  createdAt: z.string(),
  projects: z.array(
    z.object({
      project: projectSchema,
      sources: z.record(z.string(), sourceStateSchema),
      feeds: z.partialRecord(z.enum(FEED_NAMES), feedIndexSchema),
      questions: z.array(questionSchema).optional(),
    }),
  ),
})

/** A backup as one JSON file, checked whole when it is read: it comes from outside. */
export function createJsonBackupFiles(): BackupFiles {
  return {
    async read(file): Promise<Backup> {
      const parsed = backupSchema.safeParse(await readJsonOr(file, null).catch(() => null))
      if (!parsed.success) throw new DomainError('backup_invalid', file)
      return parsed.data
    },
    async write(file, backup) {
      try {
        await writeJson(file, backup, PRIVATE_FILE_MODE)
      } catch {
        throw new DomainError('backup_not_written', file)
      }
    },
  }
}

export function createFsFolderProbe(): FolderProbe {
  return {
    async isReadableFolder(folder) {
      try {
        await access(folder, constants.R_OK)
        return (await stat(folder)).isDirectory()
      } catch {
        return false
      }
    },
  }
}

/** Makes the folder of a new project on disk; an existing name is never written over. */
export function createFsProjectScaffold(): ProjectScaffold {
  return {
    async create(parent, name, files) {
      const folder = join(parent, name)
      try {
        // Not recursive: it fails when the name is taken or the parent is not there.
        await mkdir(folder)
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code
        throw new DomainError(
          code === 'EEXIST' ? 'project_folder_exists' : 'folder_not_readable',
          folder,
        )
      }
      for (const file of files) {
        const target = join(folder, ...file.path.split('/'))
        await mkdir(dirname(target), { recursive: true })
        await writeFile(target, file.content, 'utf8')
      }
      return folder
    },
  }
}
