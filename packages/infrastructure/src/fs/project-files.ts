import { mkdir, readFile, realpath, rm } from 'node:fs/promises'
import { dirname, join, relative, resolve, sep } from 'node:path'
import type {
  FeedIndexes,
  LegacyFeedIndexes,
  MemoryWriter,
  SharedReadings,
  SourceSettings,
  SourceStates,
} from '@octo/application'
import {
  cleanFeedConfig,
  cleanMailSource,
  cleanMeetingsSource,
  DOMAIN_ERROR_CODES,
  DomainError,
  type FeedName,
  mergeSources,
  NEVER_READ,
  NEVER_SHARED,
  NO_PERSONAL_SOURCES,
  NO_SOURCES,
  OCTO_FOLDER,
  type PersonalSources,
  SETTINGS_FOLDER,
  type SourceState,
  type SourcesConfig,
  STATE_FOLDER,
  splitSources,
  UNCITABLE_FOLDERS,
  WAREHOUSE_TLS_MODES,
} from '@octo/domain'
import { z } from 'zod'
import { isMissing, readJsonOr, writeAtomic, writeJson } from './json-file.ts'
import type { ProjectOfFolder } from './personal-files.ts'

const mailSchema = z.object({
  since: z.string(),
  keywords: z.array(z.string()),
  folders: z.array(z.string()),
  excludeSenders: z.array(z.string()),
  keepQuoted: z.boolean(),
  targetFolder: z.string(),
})

// A file written before the first day existed takes every meeting.
const meetingsSchema = z.object({
  root: z.string(),
  since: z.string().nullable().default(null),
  released: z.array(z.string()).optional(),
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
const confluenceSchema = z.object({
  ...feedBase,
  site: z.string(),
  email: z.string(),
  spaces: z.array(z.string()),
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
  meetings: meetingsSchema.nullable().default(null),
  ado: adoSchema.nullable().default(null),
  jira: jiraSchema.nullable().default(null),
  confluence: confluenceSchema.nullable().default(null),
  dwsi: dwsiSchema.nullable().default(null),
})

const indexSchema = z.object({
  scope: z.string().nullable(),
  items: z.record(z.string(), z.object({ version: z.string(), path: z.string() })),
})

const readerSchema = z.object({ name: z.string(), computer: z.string() })

const runSchema = z.object({
  at: z.string(),
  written: z.number(),
  unchanged: z.number(),
  error: z.enum(DOMAIN_ERROR_CODES).nullable(),
  by: readerSchema.optional(),
})

const stateSchema = z.object({ cursor: z.string().nullable(), lastRun: runSchema.nullable() })

const statesSchema = z.record(z.string(), stateSchema)

const sharedSchema = z.object({
  cursor: z.string().nullable().default(null),
  lastRun: runSchema.nullable().default(null),
  lease: z.object({ by: readerSchema, until: z.string() }).nullable().default(null),
})

const personalSchema = z.object({
  meetings: z.object({ root: z.string() }).optional(),
  feeds: z.record(z.string(), z.record(z.string(), z.string())).optional(),
})

/** Octo's settings of a project: with the rest of what Octo writes, under its own folder. */
export const PROJECT_SETTINGS_FOLDER = SETTINGS_FOLDER
const SOURCES_FILE = 'sources.json'
const STATES_FOLDER = 'sources'
const MAIL_FOLDER = `${OCTO_FOLDER}/posta`
const FEEDS_FOLDER = `${OCTO_FOLDER}/fonti`
const FEED_FOLDERS: Readonly<Record<FeedName, string>> = {
  ado: 'ADO',
  jira: 'Jira',
  confluence: 'Confluence',
  dwsi: 'NetSuite',
}
const INDEXES_FOLDER = 'feeds'
const PERSONAL_SOURCES_FOLDER = 'personal-sources'
const INDEX_SUFFIX = '.indice.json'
const READING_SUFFIX = '.json'
/** Tells git to leave Octo's folder alone: a versioned project is never dirtied by Octo. */
const GIT_IGNORE = { name: '.gitignore', content: '*\n' }
/**
 * Tells the search tools to look inside it all the same: they skip what git ignores, and the
 * agent would not find the mail and the texts Octo writes.
 */
const SEARCH_ALLOW = { name: '.ignore', content: '!*\n' }
/** Tells the search tools to leave a folder out: settings, costs and earlier answers. */
const SEARCH_DENY = { name: '.ignore', content: '*\n' }
const PRIVATE_FILE_MODE = 0o600

/**
 * Writes inside the project folder only: the real path of the place written must be under the
 * real path of the project, so neither `..` nor a link leads outside.
 */
/** The place of a file to write, with its folder made; a path leading outside is refused. */
async function targetInside(projectFolder: string, relativePath: string): Promise<string> {
  const root = await realpath(projectFolder)
  const target = resolve(root, relativePath)
  await mkdir(dirname(target), { recursive: true })
  const parent = await realpath(dirname(target))
  const fromRoot = relative(root, parent)
  if (fromRoot === '..' || fromRoot.startsWith(`..${sep}`) || resolve(root, fromRoot) !== parent) {
    throw new DomainError('source_config_invalid', relativePath)
  }
  return target
}

export function createFsMemoryWriter(): MemoryWriter {
  return {
    async write(projectFolder, relativePath, content) {
      const target = await targetInside(projectFolder, relativePath)
      const current = await readFile(target, 'utf8').catch((error: unknown) => {
        if (isMissing(error)) return null
        throw error
      })
      if (current === content) return 'unchanged'
      await writeAtomic(target, content)
      return 'written'
    },
    writeBytes: async (projectFolder, relativePath, bytes) =>
      writeAtomic(await targetInside(projectFolder, relativePath), bytes),
    async claim(projectFolder) {
      const folder = join(await realpath(projectFolder), OCTO_FOLDER)
      await mkdir(folder, { recursive: true })
      const mark = async (inFolder: string, marker: { name: string; content: string }) => {
        const file = join(inFolder, marker.name)
        const current = await readFile(file, 'utf8').catch(() => null)
        if (current !== marker.content) await writeAtomic(file, marker.content)
      }
      for (const marker of [GIT_IGNORE, SEARCH_ALLOW]) await mark(folder, marker)
      // What is not a source is left out of the search again, folder by folder.
      for (const kept of UNCITABLE_FOLDERS) {
        await mark(join(folder, ...kept.split('/').slice(1)), SEARCH_DENY)
      }
    },
  }
}

export function createFsSourceSettings(): SourceSettings {
  const fileOf = (projectFolder: string) =>
    join(projectFolder, PROJECT_SETTINGS_FOLDER, SOURCES_FILE)
  return {
    async load(projectFolder): Promise<SourcesConfig> {
      const parsed = sourcesSchema.safeParse(await readJsonOr(fileOf(projectFolder), NO_SOURCES))
      if (!parsed.success) throw new DomainError('source_config_invalid', SOURCES_FILE)
      const { mail, meetings, ado, jira, confluence, dwsi } = parsed.data
      return {
        mail: mail ? cleanMailSource(mail) : null,
        meetings: meetings ? cleanMeetingsSource(meetings) : null,
        ado: ado ? cleanFeedConfig('ado', ado) : null,
        jira: jira ? cleanFeedConfig('jira', jira) : null,
        confluence: confluence ? cleanFeedConfig('confluence', confluence) : null,
        dwsi: dwsi ? cleanFeedConfig('dwsi', dwsi) : null,
      }
    },
    save: (projectFolder, config) => writeJson(fileOf(projectFolder), config),
    // Never under the PM's own folders: a vault's `raw/` is its owner's inbox, not Octo's.
    suggestMailFolder: async () => MAIL_FOLDER,
    suggestFeedFolder: async (_projectFolder, feed) => `${FEEDS_FOLDER}/${FEED_FOLDERS[feed]}`,
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
    ofProject: all,
    set: async (projectId, source, state) => {
      const next = { ...(await all(projectId)), [source]: state }
      await writeJson(fileOf(projectId), next, PRIVATE_FILE_MODE)
    },
    removeProject: (projectId) => rm(fileOf(projectId), { force: true }),
  }
}

/** Where the folder of a project keeps what it knows of its own readings. */
const stateFile = (projectFolder: string, name: string): string =>
  join(projectFolder, ...STATE_FOLDER.split('/'), name)

/**
 * JSON a folder shared between computers holds. A file a sync client left half way, or one that
 * is no longer what Octo wrote, reads as nothing: the next reading writes it again.
 */
async function sharedJson(file: string): Promise<unknown> {
  try {
    return await readJsonOr(file, null)
  } catch (error) {
    if (error instanceof SyntaxError) return null
    throw error
  }
}

/** What the folder of a project knows of the readings of each source, one small file each. */
export function createFsSharedReadings(): SharedReadings {
  const fileOf = (projectFolder: string, source: string) =>
    stateFile(projectFolder, `${source}${READING_SUFFIX}`)
  return {
    async get(projectFolder, source) {
      const parsed = sharedSchema.safeParse(await sharedJson(fileOf(projectFolder, source)))
      return parsed.success ? parsed.data : NEVER_SHARED
    },
    set: (projectFolder, source, reading) => writeJson(fileOf(projectFolder, source), reading),
  }
}

/** What each feed wrote in a project, in the folder of the project. */
export function createFsFeedIndexes(): FeedIndexes {
  const fileOf = (projectFolder: string, feed: FeedName) =>
    stateFile(projectFolder, `${feed}${INDEX_SUFFIX}`)
  return {
    async load(projectFolder, feed) {
      const parsed = indexSchema.safeParse(await sharedJson(fileOf(projectFolder, feed)))
      return parsed.success ? parsed.data : { scope: null, items: {} }
    },
    save: (projectFolder, feed, scope, items) =>
      writeJson(fileOf(projectFolder, feed), { scope, items }),
  }
}

/** What each feed wrote, as an Octo from before a folder could be shared kept it on this computer. */
export function createLegacyFeedIndexes(dataFolder: string): LegacyFeedIndexes {
  const fileOf = (projectId: string, feed: FeedName) =>
    join(dataFolder, INDEXES_FOLDER, encodeURIComponent(projectId), `${feed}.json`)
  return {
    async load(projectId, feed) {
      const parsed = indexSchema.safeParse(
        await readJsonOr(fileOf(projectId, feed), null).catch(() => null),
      )
      return parsed.success ? parsed.data : { scope: null, items: {} }
    },
    remove: (projectId, feed) => rm(fileOf(projectId, feed), { force: true }),
  }
}

/** What of the sources of a project is of who reads them here: kept with the app, by project. */
export type PersonalSourcesStore = {
  load(projectFolder: string): Promise<PersonalSources>
  save(projectFolder: string, personal: PersonalSources): Promise<void>
}

export function createJsonPersonalSources(
  dataFolder: string,
  projectOf: ProjectOfFolder,
): PersonalSourcesStore {
  const fileOf = async (projectFolder: string): Promise<string | null> => {
    const project = await projectOf(projectFolder)
    return project === null
      ? null
      : join(dataFolder, PERSONAL_SOURCES_FOLDER, `${encodeURIComponent(project.id)}.json`)
  }
  return {
    async load(projectFolder) {
      const file = await fileOf(projectFolder)
      if (file === null) return NO_PERSONAL_SOURCES
      const parsed = personalSchema.safeParse(await readJsonOr(file, {}))
      return parsed.success ? parsed.data : NO_PERSONAL_SOURCES
    },
    async save(projectFolder, personal) {
      const file = await fileOf(projectFolder)
      if (file !== null) await writeJson(file, personal, PRIVATE_FILE_MODE)
    },
  }
}

/**
 * The sources of a project as one person reads them on one computer. The folder holds what is
 * of the project; the account each system is entered with and the folder of Verbale are kept
 * with the app, so two people share a project without changing each other's.
 */
export function createSplitSourceSettings(
  shared: SourceSettings,
  personal: PersonalSourcesStore,
): SourceSettings {
  return {
    ...shared,
    load: async (projectFolder) =>
      mergeSources(await shared.load(projectFolder), await personal.load(projectFolder)),
    async save(projectFolder, config) {
      const split = splitSources(config, await shared.load(projectFolder))
      await personal.save(projectFolder, split.personal)
      await shared.save(projectFolder, split.shared)
    },
  }
}
