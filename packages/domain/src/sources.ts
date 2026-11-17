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

/** Who read a source: the person who uses Octo and the computer Octo runs on. */
export type Reader = { name: string; computer: string }

/** What a reading of a source did. */
export type SourceRun = {
  at: string
  written: number
  unchanged: number
  error: DomainErrorCode | null
  /** Who read; absent in what was read before a folder could be shared. */
  by?: Reader | undefined
}

/** What this computer keeps of a source: its own last reading, gone well or not. */
export type SourceState = {
  /** Where the next reading starts. */
  cursor: string | null
  lastRun: SourceRun | null
}

/** A reading under way: whose it is, and until when it holds without being renewed. */
export type ReadingLease = { by: Reader; until: string }

/**
 * What the folder of a project knows of a source, the same for every computer that opens it: the
 * last reading that went well, where the next one goes on from, and who is reading right now.
 */
export type SharedReading = {
  cursor: string | null
  lastRun: SourceRun | null
  lease: ReadingLease | null
}

export const NEVER_SHARED: SharedReading = { cursor: null, lastRun: null, lease: null }

/** A reading that stops without a word frees the source after this long. */
export const READING_LEASE_MS = 10 * 60 * 1000

/** Two readers are the same when they read from the same computer, whoever is signed in. */
export const sameComputer = (a: Reader, b: Reader): boolean => a.computer === b.computer

/** Who reads the source from another computer right now; null when nobody does. */
export function readingElsewhere(shared: SharedReading, me: Reader, now: Date): Reader | null {
  const lease = shared.lease
  if (lease === null || sameComputer(lease.by, me)) return null
  return Date.parse(lease.until) > now.getTime() ? lease.by : null
}

export type ReadingTurn = 'read' | 'fresh' | 'busy_elsewhere'

/**
 * Whether this computer reads a source now. Not while another computer is reading it; and, when
 * `maxAgeMs` is given, not when another computer read it less than that long ago: its reading
 * stands for this one too. Null asks for a reading whatever its age.
 */
export function readingTurn(
  shared: SharedReading,
  me: Reader,
  now: Date,
  maxAgeMs: number | null,
): ReadingTurn {
  if (readingElsewhere(shared, me, now) !== null) return 'busy_elsewhere'
  const last = shared.lastRun
  const byAnother = last?.by !== undefined && !sameComputer(last.by, me)
  if (maxAgeMs !== null && last && byAnother && now.getTime() - Date.parse(last.at) < maxAgeMs) {
    return 'fresh'
  }
  return 'read'
}

/**
 * What the page of the sources shows: the newest of this computer's own last reading, which may
 * have failed, and the last good reading the folder holds, which may be of another computer.
 */
export function shownState(local: SourceState, shared: SharedReading): SourceState {
  const mine = local.lastRun
  const theirs = shared.lastRun
  const newest =
    mine === null || (theirs !== null && Date.parse(theirs.at) > Date.parse(mine.at))
      ? theirs
      : mine
  return { cursor: shared.cursor ?? local.cursor, lastRun: newest }
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
