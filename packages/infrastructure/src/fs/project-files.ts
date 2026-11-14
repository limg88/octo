import { mkdir, readFile, realpath, rm, stat } from 'node:fs/promises'
import { dirname, join, relative, resolve, sep } from 'node:path'
import type { FeedIndexes, MemoryWriter, SourceSettings, SourceStates } from '@octo/application'
import {
  cleanFeedConfig,
  cleanMailSource,
  DOMAIN_ERROR_CODES,
  DomainError,
  type FeedName,
  NEVER_READ,
  NO_SOURCES,
  type SourceState,
  type SourcesConfig,
  WAREHOUSE_TLS_MODES,
} from '@octo/domain'
import { z } from 'zod'
import { isMissing, readJsonOr, writeAtomic, writeJson } from './json-file.ts'

const mailSchema = z.object({
  since: z.string(),
  keywords: z.array(z.string()),
  folders: z.array(z.string()),
  excludeSenders: z.array(z.string()),
  keepQuoted: z.boolean(),
  targetFolder: z.string(),
})

const feedBase = { since: z.string(), targetFolder: z.string() }
const adoSchema = z.object({
  ...feedBase,
  organization: z.string(),
  project: z.string(),
  areas: z.array(z.string()),
})
const jiraSchema = z.object({
  ...feedBase,
  site: z.string(),
  email: z.string(),
  projects: z.array(z.string()),
})
const dwsiSchema = z.object({
  ...feedBase,
  host: z.string(),
  port: z.number(),
  database: z.string(),
  user: z.string(),
  ownerEmail: z.string(),
  projectCodes: z.array(z.string()),
  tls: z.enum(WAREHOUSE_TLS_MODES),
})

// A file written before a source existed simply does not name it.
const sourcesSchema = z.object({
  mail: mailSchema.nullable().default(null),
  ado: adoSchema.nullable().default(null),
  jira: jiraSchema.nullable().default(null),
  dwsi: dwsiSchema.nullable().default(null),
})

const indexSchema = z.object({
  scope: z.string().nullable(),
  items: z.record(z.string(), z.object({ version: z.string(), path: z.string() })),
})

const stateSchema = z.object({
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

const statesSchema = z.record(z.string(), stateSchema)

/** Octo's own files inside a project folder: what must travel with the project. */
export const PROJECT_SETTINGS_FOLDER = '.octo'
const SOURCES_FILE = 'sources.json'
const STATES_FOLDER = 'sources'
/** A vault of the Suite keeps what arrives under `raw/`: the mail goes beside it. */
const VAULT_INBOX = 'raw'
const MAIL_FOLDER_IN_VAULT = 'raw/Mail'
const MAIL_FOLDER = 'Posta'
const FEEDS_FOLDER = 'Fonti'
const FEED_FOLDERS: Readonly<Record<FeedName, string>> = {
  ado: 'ADO',
  jira: 'Jira',
  dwsi: 'NetSuite',
}
const INDEXES_FOLDER = 'feeds'
const PRIVATE_FILE_MODE = 0o600

/**
 * Writes inside the project folder only: the real path of the place written must be under the
 * real path of the project, so neither `..` nor a link leads outside.
 */
export function createFsMemoryWriter(): MemoryWriter {
  return {
    async write(projectFolder, relativePath, content) {
      const root = await realpath(projectFolder)
      const target = resolve(root, relativePath)
      await mkdir(dirname(target), { recursive: true })
      const parent = await realpath(dirname(target))
      const fromRoot = relative(root, parent)
      if (
        fromRoot === '..' ||
        fromRoot.startsWith(`..${sep}`) ||
        resolve(root, fromRoot) !== parent
      ) {
        throw new DomainError('source_config_invalid', relativePath)
      }
      const current = await readFile(target, 'utf8').catch((error: unknown) => {
        if (isMissing(error)) return null
        throw error
      })
      if (current === content) return 'unchanged'
      await writeAtomic(target, content)
      return 'written'
    },
  }
}

async function hasVaultInbox(projectFolder: string): Promise<boolean> {
  const inbox = await stat(join(projectFolder, VAULT_INBOX)).catch(() => null)
  return inbox?.isDirectory() === true
}

export function createFsSourceSettings(): SourceSettings {
  const fileOf = (projectFolder: string) =>
    join(projectFolder, PROJECT_SETTINGS_FOLDER, SOURCES_FILE)
  return {
    async load(projectFolder): Promise<SourcesConfig> {
      const parsed = sourcesSchema.safeParse(await readJsonOr(fileOf(projectFolder), NO_SOURCES))
      if (!parsed.success) throw new DomainError('source_config_invalid', SOURCES_FILE)
      const { mail, ado, jira, dwsi } = parsed.data
      return {
        mail: mail ? cleanMailSource(mail) : null,
        ado: ado ? cleanFeedConfig('ado', ado) : null,
        jira: jira ? cleanFeedConfig('jira', jira) : null,
        dwsi: dwsi ? cleanFeedConfig('dwsi', dwsi) : null,
      }
    },
    save: (projectFolder, config) => writeJson(fileOf(projectFolder), config),
    async suggestMailFolder(projectFolder) {
      return (await hasVaultInbox(projectFolder)) ? MAIL_FOLDER_IN_VAULT : MAIL_FOLDER
    },
    async suggestFeedFolder(projectFolder, feed) {
      const base = (await hasVaultInbox(projectFolder)) ? VAULT_INBOX : FEEDS_FOLDER
      return `${base}/${FEED_FOLDERS[feed]}`
    },
  }
}

/** Cursors and last readings belong to this computer: they stay in the app's data folder. */
export function createJsonSourceStates(dataFolder: string): SourceStates {
  const fileOf = (projectId: string) =>
    join(dataFolder, STATES_FOLDER, `${encodeURIComponent(projectId)}.json`)
  const all = async (projectId: string): Promise<Record<string, SourceState>> =>
    statesSchema.parse(await readJsonOr(fileOf(projectId), {}))
  return {
    get: async (projectId, source) => (await all(projectId))[source] ?? NEVER_READ,
    set: async (projectId, source, state) => {
      const next = { ...(await all(projectId)), [source]: state }
      await writeJson(fileOf(projectId), next, PRIVATE_FILE_MODE)
    },
    removeProject: (projectId) => rm(fileOf(projectId), { force: true }),
  }
}

/** What each feed wrote from this computer: kept in the app's data folder, beside the cursors. */
export function createJsonFeedIndexes(dataFolder: string): FeedIndexes {
  const folderOf = (projectId: string) =>
    join(dataFolder, INDEXES_FOLDER, encodeURIComponent(projectId))
  const fileOf = (projectId: string, feed: FeedName) => join(folderOf(projectId), `${feed}.json`)
  return {
    load: async (projectId, feed) =>
      indexSchema.parse(await readJsonOr(fileOf(projectId, feed), { scope: null, items: {} })),
    save: (projectId, feed, scope, items) =>
      writeJson(fileOf(projectId, feed), { scope, items }, PRIVATE_FILE_MODE),
    removeProject: (projectId) => rm(folderOf(projectId), { recursive: true, force: true }),
  }
}
