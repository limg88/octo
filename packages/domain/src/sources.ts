import { DomainError, type DomainErrorCode } from './errors.ts'
import type { MailRules } from './mail/match.ts'

/** How the mail of one project is taken from the PM's mail program. */
export type MailSourceConfig = MailRules & {
  /** First day read, `YYYY-MM-DD`. */
  since: string
  keepQuoted: boolean
  /** Where the mail is written, inside the project folder. */
  targetFolder: string
}

/** What the last reading of a source did, kept on this computer. */
export type SourceRun = {
  at: string
  written: number
  unchanged: number
  error: DomainErrorCode | null
}

export type SourceState = {
  /** Where the next reading starts. */
  cursor: string | null
  lastRun: SourceRun | null
}

/** What a configuration of the mail would bring in, shown before anything is written. */
export type MailPreview = {
  count: number
  /** The subjects of the newest ones, to see at a glance whether the rules are right. */
  subjects: string[]
}

export const NEVER_READ: SourceState = { cursor: null, lastRun: null }

const DAY = /^\d{4}-\d{2}-\d{2}$/
const SAFE_SEGMENT = /^[^\\/:*?"<>|]+$/

/** A day as the instant it starts, or a domain error when it is not a real day. */
export function startOfDay(day: string): Date {
  const start = new Date(`${day}T00:00:00.000Z`)
  if (!DAY.test(day) || Number.isNaN(start.getTime())) {
    throw new DomainError('source_config_invalid', `since: ${day}`)
  }
  return start
}

/** A folder inside the project: relative, no `..`, no characters a file system refuses. */
export function cleanTargetFolder(folder: string): string {
  const segments = folder
    .split(/[\\/]+/)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0)
  const safe = segments.every(
    (segment) => segment !== '..' && segment !== '.' && SAFE_SEGMENT.test(segment),
  )
  if (segments.length === 0 || !safe) {
    throw new DomainError('source_config_invalid', `targetFolder: ${folder}`)
  }
  return segments.join('/')
}

const cleanList = (values: readonly string[]): string[] => [
  ...new Set(values.map((value) => value.trim()).filter((value) => value.length > 0)),
]

/** The configuration as it is saved: trimmed, without doubles, checked. */
export function cleanMailSource(config: MailSourceConfig): MailSourceConfig {
  startOfDay(config.since)
  return {
    since: config.since,
    keywords: cleanList(config.keywords),
    folders: cleanList(config.folders),
    excludeSenders: cleanList(config.excludeSenders),
    keepQuoted: config.keepQuoted,
    targetFolder: cleanTargetFolder(config.targetFolder),
  }
}
