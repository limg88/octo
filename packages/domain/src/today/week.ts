import { utcDay } from '../workdays.ts'
import type { Importance, TodayItem, TodayKind } from './model.ts'
import { type BriefPoint, POINT_OLD_WORKDAYS } from './open-points.ts'
import type { Risk } from './risks.ts'

/** What is wrong now and has to be put right, or what a day of the week brings. */
export const WEEK_SIDES = ['ongoing', 'coming'] as const
export type WeekSide = (typeof WEEK_SIDES)[number]

/** What a critical thing of the week is: a point, a risk, a signal of the page, the sprint. */
export type WeekWhat =
  | { kind: 'point'; entry: BriefPoint }
  | { kind: 'risk'; risk: Risk }
  | { kind: 'signal'; item: TodayItem }
  | { kind: 'sprint_end' }

export type WeekEntry = {
  key: string
  side: WeekSide
  what: WeekWhat
  /** The day it is due by or falls on; null when it has none. */
  day: string | null
  /** Days past that day; 0 when not past. */
  overdueDays: number
}

/** The critical things of the week, by the code: what is to put right, and what is coming. */
export type WeekView = {
  /** The last day looked at, `YYYY-MM-DD`. */
  until: string
  ongoing: WeekEntry[]
  coming: WeekEntry[]
}

const DAY_MS = 24 * 60 * 60 * 1000
const SUNDAY = 0
const FRIDAY = 5
const WEEK_DAYS = 7

/**
 * The last day of the week the PM plans: the Sunday of this week, and from Friday on the Sunday
 * of the next, because by then this week is over.
 */
export function weekEnd(today: string): string {
  const weekday = utcDay(today).getUTCDay()
  const toSunday = (WEEK_DAYS - weekday) % WEEK_DAYS
  const late = weekday === SUNDAY || weekday >= FRIDAY
  return new Date(utcDay(today).getTime() + (toSunday + (late ? WEEK_DAYS : 0)) * DAY_MS)
    .toISOString()
    .slice(0, 10)
}

const daysFrom = (from: string, to: string): number =>
  Math.round((utcDay(to).getTime() - utcDay(from).getTime()) / DAY_MS)

/** The signals that are wrong for as long as they are there. */
const ONGOING_KINDS: readonly TodayKind[] = ['source', 'tracker_old', 'bugs_stuck']
/** The signals of numbers: critical only when a date makes them due. */
const DUE_KINDS: readonly TodayKind[] = ['hours', 'forecast']
/** The signals told only while the sprint ends: they are what it leaves behind. */
const SPRINT_KINDS: readonly TodayKind[] = ['requirements', 'alignment']

const SEVERITY_ORDER: Readonly<Record<Importance, number>> = { alta: 0, media: 1, bassa: 2 }
const UNSAID_SEVERITY = 1

export type WeekInput = {
  /** The signals of the page after the PM's decisions. */
  items: readonly TodayItem[]
  /** The open points, as the brief of the morning tells them. */
  points: readonly BriefPoint[]
  /** The open risks of the register. */
  risks: readonly Risk[]
  today: string
  /** The last day of the sprint, when it is still to come. */
  sprintEnd: string | null
}

/** Where a signal of the page stands in the week, or null when it is not critical. */
function signalEntry(item: TodayItem, input: WeekInput, until: string): WeekEntry | null {
  const { facts } = item
  const entry = (side: WeekSide, day: string | null): WeekEntry => ({
    key: `signal:${item.key}`,
    side,
    what: { kind: 'signal', item },
    day,
    overdueDays: 0,
  })
  if (ONGOING_KINDS.includes(facts.kind)) return entry('ongoing', null)
  if (DUE_KINDS.includes(facts.kind)) {
    return item.dueBecause === undefined ? null : entry('ongoing', null)
  }
  if (facts.kind === 'month_due') return entry('coming', null)
  if (SPRINT_KINDS.includes(facts.kind)) return entry('coming', input.sprintEnd)
  if (facts.kind === 'calendar') return facts.day <= until ? entry('coming', facts.day) : null
  if (facts.kind === 'mail_reply') {
    const deadline = facts.judgement?.deadline ?? null
    if (deadline === null || deadline > until) return null
    return deadline < input.today
      ? { ...entry('ongoing', deadline), overdueDays: daysFrom(deadline, input.today) }
      : entry('coming', deadline)
  }
  return null
}

function pointEntry(entry: BriefPoint, until: string): WeekEntry | null {
  const { point } = entry
  const of = (side: WeekSide): WeekEntry => ({
    key: `point:${point.id}`,
    side,
    what: { kind: 'point', entry },
    day: point.due,
    overdueDays: entry.overdueDays,
  })
  if (entry.overdueDays > 0) return of('ongoing')
  if (point.due !== null) return point.due <= until ? of('coming') : null
  return entry.openWorkdays > POINT_OLD_WORKDAYS ? of('ongoing') : null
}

function riskEntry(risk: Risk, today: string, until: string): WeekEntry | null {
  const overdueDays = risk.due !== null && risk.due < today ? daysFrom(risk.due, today) : 0
  // A risk with a day is what that day brings; without one, or past it, it is to deal with now.
  const coming = risk.due !== null && overdueDays === 0
  if (coming && risk.due !== null && risk.due > until) return null
  return {
    key: `risk:${risk.id}`,
    side: coming ? 'coming' : 'ongoing',
    what: { kind: 'risk', risk },
    day: risk.due,
    overdueDays,
  }
}

const severityOf = (entry: WeekEntry): number =>
  entry.what.kind === 'risk' && entry.what.risk.severity
    ? SEVERITY_ORDER[entry.what.risk.severity]
    : UNSAID_SEVERITY

/**
 * The critical things of the week, each once: what is wrong now (points past their day or left
 * open for long, risks, stuck bugs, numbers a date makes due, sources that are not read) and
 * what a day of the week brings (days points, risks and mail are due by, the end of the sprint
 * and what it leaves behind, the closing of the month, the dates of the calendar). No model
 * ranks them: what is past its day comes first, then by day.
 */
export function weekItems(input: WeekInput): WeekView {
  const until = weekEnd(input.today)
  const sprint: WeekEntry[] =
    input.sprintEnd !== null && input.sprintEnd <= until
      ? [
          {
            key: 'sprint-end',
            side: 'coming',
            what: { kind: 'sprint_end' },
            day: input.sprintEnd,
            overdueDays: 0,
          },
        ]
      : []
  const entries = [
    ...input.points.flatMap((entry) => pointEntry(entry, until) ?? []),
    ...input.risks
      .filter((risk) => risk.state === 'open')
      .flatMap((risk) => riskEntry(risk, input.today, until) ?? []),
    ...sprint,
    ...input.items.flatMap((item) => signalEntry(item, input, until) ?? []),
  ]
  // The sort is stable: within the same day points come before risks, risks before signals.
  const ongoing = entries
    .filter((entry) => entry.side === 'ongoing')
    .sort((a, b) => b.overdueDays - a.overdueDays || severityOf(a) - severityOf(b))
  const coming = entries
    .filter((entry) => entry.side === 'coming')
    .sort((a, b) => (a.day ?? '9999').localeCompare(b.day ?? '9999'))
  return { until, ongoing, coming }
}

/** The signals a critical thing of the week already tells: they are not told again as watched. */
export const WEEK_WATCHED_KINDS: readonly TodayKind[] = ['risk', 'calendar', 'bugs_stuck']
