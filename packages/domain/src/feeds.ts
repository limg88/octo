import { DomainError } from './errors.ts'
import { cleanTargetFolder, startOfDay } from './sources.ts'

/** The systems of record a project is fed from, beside mail and documents. */
export const FEED_NAMES = ['ado', 'jira', 'confluence', 'dwsi'] as const
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

export type ConfluenceFeedConfig = FeedBase & {
  /** `contoso` or `contoso.atlassian.net`: the same site as Jira. */
  site: string
  email: string
  /** Space keys or names: at least one, a whole site is never read. */
  spaces: string[]
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
  confluence: ConfluenceFeedConfig
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

/** One thing the PM can pick instead of typing it: a project of the system, an area of it. */
export type FeedChoice = { value: string; label: string }

/** What a credential can see in a system, offered while the feed is being set up. */
export type FeedChoices = { projects: FeedChoice[]; areas: FeedChoice[] }

export const NO_CHOICES: FeedChoices = { projects: [], areas: [] }

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
  confluence: (config) => {
    const spaces = list(config.spaces)
    if (spaces.length === 0) throw invalid('spaces')
    return {
      ...base(config),
      site: required(config.site, 'site'),
      email: required(config.email, 'email'),
      spaces,
    }
  },
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
 * What of a configuration is of the person who reads, not of the project: the account a system
 * is entered with. Two people read the same items with two accounts.
 */
export const PERSONAL_FEED_FIELDS: { readonly [Name in FeedName]: readonly string[] } = {
  ado: [],
  jira: ['email'],
  confluence: ['email'],
  dwsi: ['user', 'ownerEmail'],
}

const sorted = (what: Record<string, unknown>): string =>
  JSON.stringify(what, Object.keys(what).sort())

/**
 * What of the system a configuration reads. When it changes, the files of the feed are from
 * another perimeter: they are removed and the reading starts over. The account it is read with
 * is not part of it: the same perimeter read by another person is the same reading.
 */
export function feedScope(feed: FeedName, config: FeedConfig): string {
  const left = ['targetFolder', ...PERSONAL_FEED_FIELDS[feed]]
  const settings = Object.fromEntries(
    Object.entries(config).filter(([field]) => !left.includes(field)),
  )
  // An issue tracker read for more fields than before is another reading: it starts over once.
  return sorted(feed === 'jira' ? { ...settings, fields: ISSUE_FIELDS_REVISION } : settings)
}

/**
 * A perimeter written when the account was part of it, as it is written now: what an earlier
 * Octo left on a computer is recognised as the same reading. Null when it cannot be read.
 */
export function scopeWithoutAccount(feed: FeedName, scope: string): string | null {
  try {
    const what: unknown = JSON.parse(scope)
    if (typeof what !== 'object' || what === null || Array.isArray(what)) return null
    return sorted(
      Object.fromEntries(
        Object.entries(what).filter(([field]) => !PERSONAL_FEED_FIELDS[feed].includes(field)),
      ),
    )
  } catch {
    return null
  }
}

/**
 * Whether a file of the folder of a feed is the copy a sync client leaves beside a file when two
 * computers wrote it at once: the name of a file the feed holds, then a dash or a space and what
 * the client added, with the same extension.
 */
export function isConflictCopy(path: string, held: ReadonlySet<string>): boolean {
  if (held.has(path)) return false
  const dot = path.lastIndexOf('.')
  const slash = path.lastIndexOf('/')
  if (dot <= slash) return false
  const extension = path.slice(dot)
  const stem = path.slice(0, dot)
  for (let at = stem.length - 1; at > slash + 1; at -= 1) {
    const separator = stem[at]
    if ((separator === '-' || separator === ' ') && held.has(`${stem.slice(0, at)}${extension}`)) {
      return true
    }
  }
  return false
}

/** Raised when the fields read of every issue change: the sprint and the estimate, since 2. */
const ISSUE_FIELDS_REVISION = 2

const FEED_LABELS: Readonly<Record<FeedName, string>> = {
  ado: 'Azure DevOps',
  jira: 'Jira',
  confluence: 'Confluence',
  dwsi: 'NetSuite',
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
