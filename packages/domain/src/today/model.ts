import type { DomainErrorCode } from '../errors.ts'
import type { ForecastGap } from '../forecast/compile.ts'
import type { HoursStatus } from '../hours/reconcile.ts'

/** Where in the day a signal stands: the first is a warning above everything else. */
export const TODAY_BANDS = ['alert', 'due', 'waiting', 'numbers', 'watch'] as const
export type TodayBand = (typeof TODAY_BANDS)[number]

/** The place of Octo where a signal is put right. */
export const TODAY_TARGETS = [
  'sources',
  'hours',
  'forecast',
  'dashboard',
  'alignment',
  'deliverables',
  'risks',
  'mail',
] as const
export type TodayTarget = (typeof TODAY_TARGETS)[number]

export const IMPORTANCES = ['alta', 'media', 'bassa'] as const
export type Importance = (typeof IMPORTANCES)[number]

/** What Claude said of a mail: a judgement, kept apart from what the code computed. */
export type MailJudgement = {
  importance: Importance
  reason: string
  /** Words of the mail that back the judgement, and whether the code found them in the file. */
  quote: string
  quoteVerified: boolean
  /** A day the mail asks an answer by, `YYYY-MM-DD`; null when it names none. */
  deadline: string | null
}

/** The people whose hours of a month do not add up. */
export type HoursPersonFact = {
  person: string
  status: Extract<HoursStatus, 'outlier' | 'no_worklog' | 'no_timesheet'>
  timesheetHours: number
  worklogHours: number
}

/** What a signal says, as data: the interface puts it into words. */
export type TodayFacts =
  | {
      kind: 'source'
      source: string
      reason: 'error' | 'stale' | 'never' | 'no_secret'
      days: number | null
      error: DomainErrorCode | null
    }
  | { kind: 'tracker_old'; days: number }
  | {
      kind: 'mail_reply'
      id: string
      path: string
      from: string
      subject: string
      days: number
      judgement: MailJudgement | null
    }
  | { kind: 'mail_waiting'; id: string; path: string; to: string; subject: string; days: number }
  | {
      kind: 'hours'
      month: string
      people: HoursPersonFact[]
      tieOutOk: boolean
      duplicates: number
    }
  | { kind: 'forecast'; month: string; gaps: ForecastGap[] }
  | { kind: 'month_due'; month: string; what: 'forecast' }
  | { kind: 'bugs_stuck'; count: number; stuckDays: number; oldestDays: number }
  | { kind: 'requirements'; count: number; ids: string[] }
  | {
      kind: 'alignment'
      sprint: string
      missing: number
      needsUpdate: number
      duplicates: number
      orphans: number
    }
  | {
      kind: 'draft'
      id: string
      title: string
      status: 'review' | 'failed'
      days: number
      fixFirst: boolean
    }
  | {
      kind: 'calendar'
      what: 'period_ends' | 'person_leaves'
      name: string
      day: string
      inDays: number
    }
  | { kind: 'meeting'; subject: string; start: string; location: string; path: string }
  | {
      kind: 'meeting_unassigned'
      id: string
      title: string
      start: string
      minutes: number
      days: number
    }
  | { kind: 'risk'; id: string; title: string; since: string }
  | { kind: 'risk_candidates'; count: number }

export type TodayKind = TodayFacts['kind']

/** Why a signal the PM had put away is shown again. */
export type TodayReturn =
  | { why: 'later' }
  | { why: 'still'; since: string }
  | { why: 'worse'; was: number; now: number }

/** One thing Octo tells the PM today: where it comes from and where it is put right. */
export type TodayItem = {
  /** Stable from a day to the next, so a decision of the PM finds its signal again. */
  key: string
  band: TodayBand
  facts: TodayFacts
  /** How bad it is, as a number that grows when it gets worse. */
  weight: number
  target: TodayTarget
  /** When the data it stands on was read; null when the source does not say. */
  asOf: string | null
  /** Why it is in the band of what is due, when a date moved it there. */
  dueBecause?: 'month_end' | 'sprint_end' | 'deadline'
  returned?: TodayReturn
}

/** How fresh each source of the page is. */
export type TodayFreshness = {
  source: string
  /** When it was last read with success; null when never. */
  readAt: string | null
}

const BAND_ORDER: Readonly<Record<TodayBand, number>> = {
  alert: 0,
  due: 1,
  waiting: 2,
  numbers: 3,
  watch: 4,
}

const IMPORTANCE_ORDER: Readonly<Record<Importance, number>> = { alta: 0, media: 1, bassa: 2 }

const importanceRank = (item: TodayItem): number =>
  item.facts.kind === 'mail_reply' && item.facts.judgement
    ? IMPORTANCE_ORDER[item.facts.judgement.importance]
    : IMPORTANCE_ORDER.media

/**
 * The order of the page: by band, then what the PM put off until today, then the mail by how
 * much it matters, then the heavier first. No ranking by a model: every place has a rule.
 */
export function orderToday(items: readonly TodayItem[]): TodayItem[] {
  return [...items].sort(
    (a, b) =>
      BAND_ORDER[a.band] - BAND_ORDER[b.band] ||
      Number(b.returned?.why === 'later') - Number(a.returned?.why === 'later') ||
      importanceRank(a) - importanceRank(b) ||
      b.weight - a.weight ||
      a.key.localeCompare(b.key),
  )
}

/** Signals shown before «the others»: few enough to be read every morning. */
export const TODAY_LIMIT = 7

/** The bands that ask for something today, as opposed to what is only watched. */
export const isToDo = (item: TodayItem): boolean => item.band !== 'watch' && item.band !== 'alert'

const DAY_MS = 24 * 60 * 60 * 1000
const SATURDAY = 6
const SUNDAY = 0

const utcDay = (day: string): Date => new Date(`${day}T00:00:00.000Z`)
const isWorkday = (date: Date): boolean =>
  date.getUTCDay() !== SATURDAY && date.getUTCDay() !== SUNDAY

/** Working days from a day (excluded) to another (included); 0 when the second is not later. */
export function workdaysBetween(from: string, to: string): number {
  let count = 0
  for (let at = utcDay(from).getTime() + DAY_MS; at <= utcDay(to).getTime(); at += DAY_MS) {
    if (isWorkday(new Date(at))) count += 1
  }
  return count
}

/** Whole days from a day to another; negative when the second comes first. */
export const daysBetweenDays = (from: string, to: string): number =>
  Math.round((utcDay(to).getTime() - utcDay(from).getTime()) / DAY_MS)

export const monthOf = (day: string): string => day.slice(0, 7)

/** The month before the one a day falls in, `YYYY-MM`. */
export function previousMonth(day: string): string {
  const date = utcDay(`${monthOf(day)}-01`)
  date.setUTCMonth(date.getUTCMonth() - 1)
  return date.toISOString().slice(0, 7)
}

/** The first and the last day of a month. */
export function monthPeriod(month: string): { from: string; to: string } {
  const first = utcDay(`${month}-01`)
  const last = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0))
  return { from: `${month}-01`, to: last.toISOString().slice(0, 10) }
}

/** Working days at the start of a month in which last month's numbers are due. */
export const MONTH_CLOSING_WORKDAYS = 5
/** Working days at the end of a month in which its numbers are due. */
export const MONTH_ENDING_WORKDAYS = 3

/** Whether a day falls where the numbers of the month have to be closed. */
export function isMonthClosing(day: string): boolean {
  const { from, to } = monthPeriod(monthOf(day))
  const before = utcDay(from).getTime() - DAY_MS
  const sinceStart = workdaysBetween(new Date(before).toISOString().slice(0, 10), day)
  return sinceStart <= MONTH_CLOSING_WORKDAYS || workdaysBetween(day, to) < MONTH_ENDING_WORKDAYS
}
