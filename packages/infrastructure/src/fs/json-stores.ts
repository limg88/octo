import { randomUUID } from 'node:crypto'
import { access, constants, mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { FolderProbe, ProjectRegistry, QuestionLog } from '@octo/application'
import {
  CITATION_STATUSES,
  DOMAIN_ERROR_CODES,
  type Project,
  type QuestionRecord,
} from '@octo/domain'
import { z } from 'zod'

const projectSchema = z.object({
  id: z.string(),
  name: z.string(),
  folder: z.string(),
  addedAt: z.string(),
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
})

const PROJECTS_FILE = 'projects.json'
const QUESTIONS_FOLDER = 'questions'
const PRIVATE_FILE_MODE = 0o600

/** The app's own state lives in its data folder, never in the project folder. */
export function createJsonProjectRegistry(dataFolder: string): ProjectRegistry {
  const file = join(dataFolder, PROJECTS_FILE)
  return {
    list: async (): Promise<Project[]> => z.array(projectSchema).parse(await readJson(file, [])),
    save: (projects) => writeJson(file, projects),
  }
}

export function createJsonQuestionLog(dataFolder: string): QuestionLog {
  const fileOf = (projectId: string) =>
    join(dataFolder, QUESTIONS_FOLDER, `${encodeURIComponent(projectId)}.json`)
  const list = async (projectId: string): Promise<QuestionRecord[]> =>
    z.array(questionSchema).parse(await readJson(fileOf(projectId), []))
  return {
    list,
    append: async (record) => {
      await writeJson(fileOf(record.projectId), [...(await list(record.projectId)), record])
    },
    removeProject: (projectId) => rm(fileOf(projectId), { force: true }),
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

async function readJson(file: string, fallback: unknown): Promise<unknown> {
  try {
    return JSON.parse(await readFile(file, 'utf8'))
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return fallback
    throw error
  }
}

/** Written beside the target and renamed over it: a crash never leaves half a file. */
async function writeJson(file: string, value: unknown): Promise<void> {
  await mkdir(dirname(file), { recursive: true })
  const temporary = `${file}.${randomUUID()}.tmp`
  await writeFile(temporary, JSON.stringify(value, null, 2), { mode: PRIVATE_FILE_MODE })
  await rename(temporary, file)
}
