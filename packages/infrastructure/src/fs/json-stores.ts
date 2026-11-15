import { access, constants, mkdir, stat, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type {
  BackupFiles,
  FolderProbe,
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
import { readJsonOr, writeJson } from './json-file.ts'

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
    })
    .nullable(),
  error: z.enum(DOMAIN_ERROR_CODES).nullable(),
  model: z.string().nullable().optional(),
})

const PROJECTS_FILE = 'projects.json'
const SET_ASIDE_FILE = 'projects-set-aside.json'
const QUESTIONS_FILE = 'domande.json'
const PRIVATE_FILE_MODE = 0o600

/** The app's own state lives in its data folder, never in the project folder. */
export function createJsonProjectRegistry(dataFolder: string): ProjectRegistry {
  return projectListIn(join(dataFolder, PROJECTS_FILE))
}

/** The projects taken off the list, beside the list itself. */
export function createJsonSetAsideProjects(dataFolder: string): ProjectRegistry {
  return projectListIn(join(dataFolder, SET_ASIDE_FILE))
}

function projectListIn(file: string): ProjectRegistry {
  return {
    list: async (): Promise<Project[]> => z.array(projectSchema).parse(await readJsonOr(file, [])),
    save: (projects) => writeJson(file, projects, PRIVATE_FILE_MODE),
  }
}

/** Tells the search tools to leave the folder out: an earlier answer is not a source. */
const SEARCH_DENY = { name: '.ignore', content: '*\n' }

/** The questions of a project in its own folder: they follow it to another computer. */
export function createFsQuestionLog(): QuestionLog {
  const folderOf = (projectFolder: string) => join(projectFolder, ...HISTORY_FOLDER.split('/'))
  const fileOf = (projectFolder: string) => join(folderOf(projectFolder), QUESTIONS_FILE)
  const list = async (projectFolder: string): Promise<QuestionRecord[]> =>
    z.array(questionSchema).parse(await readJsonOr(fileOf(projectFolder), []))
  return {
    list,
    append: async (projectFolder, record) => {
      await writeJson(fileOf(projectFolder), [...(await list(projectFolder)), record])
      const marker = join(folderOf(projectFolder), SEARCH_DENY.name)
      await writeFile(marker, SEARCH_DENY.content, 'utf8')
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
