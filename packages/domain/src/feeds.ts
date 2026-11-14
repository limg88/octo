import { DomainError } from './errors.ts'
import { cleanTargetFolder, startOfDay } from './sources.ts'

/** The systems of record a project is fed from, beside mail and documents. */
export const FEED_NAMES = ['ado', 'jira', 'dwsi'] as const
export type FeedName = (typeof FEED_NAMES)[number]

type FeedBase = {
  /** First day read, `YYYY-MM-DD`. */
  since: string
  /** Where the items are written, inside the project folder. */
  targetFolder: string
}

export type AdoFeedConfig = FeedBase & {
  organization: string
  project: string
  /** Area paths to read; none: the whole project. */
  areas: string[]
}

export type JiraFeedConfig = FeedBase & {
  /** `contoso` or `contoso.atlassian.net`. */
  site: string
  email: string
  /** Project keys or names; none: every project the account sees. */
  projects: string[]
}

export const WAREHOUSE_TLS_MODES = ['verify_full', 'unverified', 'plaintext'] as const
export type WarehouseTls = (typeof WAREHOUSE_TLS_MODES)[number]

export type WarehouseFeedConfig = FeedBase & {
  host: string
  port: number
  database: string
  user: string
  /** The PM the reading is bound to: only projects that person works on are read. */
  ownerEmail: string
  /** Project codes, `PRJ` and six digits. */
  projectCodes: string[]
  tls: WarehouseTls
}

export type FeedConfigs = {
  ado: AdoFeedConfig
  jira: JiraFeedConfig
  dwsi: WarehouseFeedConfig
}
export type FeedConfig = FeedConfigs[FeedName]

/** What the reader of a feed hands over for one item: a file of the memory. */
export type FeedFile = {
  externalId: string
  /** The version in the source system: the file is written again only when it changes. */
  version: string
  /** Path inside the folder of the feed, with `/` on every system. */
  relativePath: string
  content: string
}

/** One step of a reading: files to write, items gone, and where the next step starts. */
export type FeedStep = {
  files: FeedFile[]
  removed: string[]
  cursor: unknown
  /** Up to when the system's data has been read; null when the system does not say. */
  dataAsOf: Date | null
}

/** What was written for each item, so an unchanged one is not written again. */
export type FeedIndex = Record<string, { version: string; path: string }>

const PRJ_CODE = /^PRJ\d{6}$/
const MAX_PORT = 65_535
const invalid = (field: string): DomainError => new DomainError('source_config_invalid', field)

function required(value: string, field: string): string {
  const cleaned = value.trim()
  if (cleaned.length === 0) throw invalid(field)
  return cleaned
}

const list = (values: readonly string[]): string[] => [
  ...new Set(values.map((value) => value.trim()).filter((value) => value.length > 0)),
]

function base(config: FeedBase): FeedBase {
  startOfDay(config.since)
  return { since: config.since, targetFolder: cleanTargetFolder(config.targetFolder) }
}

const cleaners: { [Name in FeedName]: (config: FeedConfigs[Name]) => FeedConfigs[Name] } = {
  ado: (config) => ({
    ...base(config),
    organization: required(config.organization, 'organization'),
    project: required(config.project, 'project'),
    areas: list(config.areas),
  }),
  jira: (config) => ({
    ...base(config),
    site: required(config.site, 'site'),
    email: required(config.email, 'email'),
    projects: list(config.projects),
  }),
  dwsi: (config) => {
    const projectCodes = list(config.projectCodes).map((code) => code.toUpperCase())
    if (projectCodes.length === 0 || !projectCodes.every((code) => PRJ_CODE.test(code))) {
      throw invalid('projectCodes')
    }
    if (!Number.isInteger(config.port) || config.port <= 0 || config.port > MAX_PORT) {
      throw invalid('port')
    }
    if (!WAREHOUSE_TLS_MODES.includes(config.tls)) throw invalid('tls')
    return {
      ...base(config),
      host: required(config.host, 'host'),
      port: config.port,
      database: required(config.database, 'database'),
      user: required(config.user, 'user'),
      ownerEmail: required(config.ownerEmail, 'ownerEmail'),
      projectCodes,
      tls: config.tls,
    }
  },
}

/** The configuration of a feed as it is saved: trimmed, without doubles, checked. */
export function cleanFeedConfig<Name extends FeedName>(
  feed: Name,
  config: FeedConfigs[Name],
): FeedConfigs[Name] {
  return cleaners[feed](config)
}

/**
 * What of the system a configuration reads. When it changes, the files of the feed are from
 * another perimeter: they are removed and the reading starts over.
 */
export function feedScope(config: FeedConfig): string {
  const { targetFolder: _folder, ...what } = config
  return JSON.stringify(what, Object.keys(what).sort())
}

const FEED_LABELS: Readonly<Record<FeedName, string>> = {
  ado: 'Azure DevOps',
  jira: 'Jira',
  dwsi: 'NetSuite (DWSI)',
}

export const feedLabel = (feed: FeedName): string => FEED_LABELS[feed]

/** The name of the note every feed keeps in its folder: when it was read and how fresh it is. */
export const FEED_NOTE_FILE = '_lettura.md'

/**
 * The note an answer cites for the age of the data: when the system was last read from this
 * computer, up to when its data goes, and how many items are in the folder.
 */
export function feedNote(
  feed: FeedName,
  reading: { readAt: Date; dataAsOf: Date | null; items: number },
): string {
  const dataAsOf = reading.dataAsOf ? reading.dataAsOf.toISOString() : 'non dichiarato dal sistema'
  return [
    '---',
    'tipo: "lettura-fonte"',
    `fonte: ${JSON.stringify(FEED_LABELS[feed])}`,
    `letta-il: ${JSON.stringify(reading.readAt.toISOString())}`,
    `dati-aggiornati-al: ${JSON.stringify(dataAsOf)}`,
    `elementi: ${reading.items}`,
    '---',
    '',
    `# Ultima lettura di ${FEED_LABELS[feed]}`,
    '',
    `- Letta il: ${reading.readAt.toISOString()}`,
    `- Dati aggiornati al: ${dataAsOf}`,
    `- Elementi in questa cartella: ${reading.items}`,
    '',
    'Per l’età dei dati di questa fonte vale questa nota.',
    '',
  ].join('\n')
}
