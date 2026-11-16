import { romeDateString, romeMidnight } from '../rome-time.ts'
import { utcDay } from '../workdays.ts'

/** What of a meeting tells the days it falls on. */
export type RepeatingMeeting = {
  start: string
  end: string | null
  recurrence?: string | null
  excluded?: readonly string[]
}

/** One time a meeting is held: when it starts and ends, as instants. */
export type MeetingTime = { start: string; end: string | null }

const FREQUENCIES = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY'] as const
type Frequency = (typeof FREQUENCIES)[number]

const WEEKDAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'] as const
/** A weekday of a rule, with its place in the month when the rule gives one (`2TU`, `-1FR`). */
type RuleDay = { weekday: number; nth: number | null }

type Rule = {
  frequency: Frequency
  interval: number
  count: number | null
  /** The last day the series is held, `YYYY-MM-DD`. */
  until: string | null
  days: RuleDay[]
  monthDays: number[]
  months: number[]
}

const DAY_MS = 24 * 60 * 60 * 1000
const WEEK_DAYS = 7
const MONTHS = 12
/** 1 January 1970 was a Thursday: this many days before it a week began, on a Monday. */
const EPOCH_FROM_MONDAY = 3
/** How far a series with a count is followed: past this it is taken as ended. */
const MAX_SERIES_DAYS = 3660
const RULE_DAY = /^([+-]?\d+)?(SU|MO|TU|WE|TH|FR|SA)$/
const UNTIL = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/

const numbers = (value: string | undefined): number[] =>
  (value ?? '')
    .split(',')
    .map((part) => Number(part))
    .filter((part) => Number.isInteger(part) && part !== 0)

/** The last day of a series, from the moment its rule names: universal time when it ends in `Z`. */
function untilDay(value: string | undefined): string | null {
  const found = UNTIL.exec((value ?? '').trim())
  if (!found) return null
  const [year, month, day, hour, minute, second] = found.slice(1, 7).map((part) => part ?? '00')
  return found[7]
    ? romeDateString(new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`))
    : `${year}-${month}-${day}`
}

/** A rule as Octo follows it, or null when it repeats in a way Octo does not know. */
function parseRule(recurrence: string): Rule | null {
  const parts = new Map<string, string>()
  for (const part of recurrence.split(';')) {
    const [name, value] = part.split('=')
    if (name && value !== undefined)
      parts.set(name.trim().toUpperCase(), value.trim().toUpperCase())
  }
  const frequency = FREQUENCIES.find((known) => known === parts.get('FREQ'))
  if (!frequency) return null
  const days: RuleDay[] = []
  for (const part of (parts.get('BYDAY') ?? '').split(',').filter((entry) => entry !== '')) {
    const found = RULE_DAY.exec(part)
    if (!found) return null
    days.push({
      weekday: WEEKDAYS.indexOf(found[2] as (typeof WEEKDAYS)[number]),
      nth: found[1] === undefined ? null : Number(found[1]),
    })
  }
  // «The first Monday» is also written as every Monday, the first of them.
  const position = numbers(parts.get('BYSETPOS'))
  if (position.length > 0) {
    if (position.length > 1 || days.length !== 1) return null
    days[0] = { weekday: days[0]?.weekday ?? 0, nth: position[0] ?? null }
  }
  const interval = Number(parts.get('INTERVAL') ?? 1)
  const count = parts.has('COUNT') ? Number(parts.get('COUNT')) : null
  if (!Number.isInteger(interval) || interval < 1) return null
  if (count !== null && (!Number.isInteger(count) || count < 1)) return null
  return {
    frequency,
    interval,
    count,
    until: untilDay(parts.get('UNTIL')),
    days,
    monthDays: numbers(parts.get('BYMONTHDAY')),
    months: numbers(parts.get('BYMONTH')),
  }
}

const dayNumber = (day: string): number => Math.round(utcDay(day).getTime() / DAY_MS)
const weekNumber = (day: string): number =>
  Math.floor((dayNumber(day) + EPOCH_FROM_MONDAY) / WEEK_DAYS)
const monthNumber = (day: string): number =>
  Number(day.slice(0, 4)) * MONTHS + Number(day.slice(5, 7))
const dayOfMonth = (day: string): number => Number(day.slice(8, 10))
const weekdayOf = (day: string): number => utcDay(day).getUTCDay()
const daysInMonth = (day: string): number =>
  new Date(Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)), 0)).getUTCDate()

/** Whether a day is the weekday a rule names, at the place in its month the rule gives. */
function isRuleDay(day: string, { weekday, nth }: RuleDay): boolean {
  if (weekdayOf(day) !== weekday) return false
  if (nth === null) return true
  const date = dayOfMonth(day)
  const fromStart = Math.ceil(date / WEEK_DAYS)
  const fromEnd = -Math.ceil((daysInMonth(day) - date + 1) / WEEK_DAYS)
  return nth === fromStart || nth === fromEnd
}

/** Whether a day is the day of the month a rule falls on. */
function isDayInMonth(rule: Rule, first: string, day: string): boolean {
  if (rule.monthDays.length > 0) {
    const date = dayOfMonth(day)
    return rule.monthDays.some(
      (wanted) => wanted === date || wanted === date - daysInMonth(day) - 1,
    )
  }
  if (rule.days.length > 0) return rule.days.some((ruleDay) => isRuleDay(day, ruleDay))
  return dayOfMonth(day) === dayOfMonth(first)
}

/** Whether a rule falls on a day after the first, leaving aside where the series ends. */
function fallsOn(rule: Rule, first: string, day: string): boolean {
  const every = (apart: number): boolean => apart % rule.interval === 0
  switch (rule.frequency) {
    case 'DAILY':
      return (
        every(dayNumber(day) - dayNumber(first)) &&
        (rule.days.length === 0 || rule.days.some((ruleDay) => ruleDay.weekday === weekdayOf(day)))
      )
    case 'WEEKLY': {
      const weekdays =
        rule.days.length > 0 ? rule.days.map((ruleDay) => ruleDay.weekday) : [weekdayOf(first)]
      return every(weekNumber(day) - weekNumber(first)) && weekdays.includes(weekdayOf(day))
    }
    case 'MONTHLY':
      return every(monthNumber(day) - monthNumber(first)) && isDayInMonth(rule, first, day)
    case 'YEARLY': {
      const month = Number(day.slice(5, 7))
      const months = rule.months.length > 0 ? rule.months : [Number(first.slice(5, 7))]
      return (
        every(Number(day.slice(0, 4)) - Number(first.slice(0, 4))) &&
        months.includes(month) &&
        isDayInMonth(rule, first, day)
      )
    }
  }
}

const nextDay = (day: string): string =>
  new Date(utcDay(day).getTime() + DAY_MS).toISOString().slice(0, 10)

/** Whether a series still runs on a day it falls on: its count is not used up before it. */
function withinCount(rule: Rule, first: string, day: string): boolean {
  if (rule.count === null) return true
  if (dayNumber(day) - dayNumber(first) > MAX_SERIES_DAYS) return false
  let held = 1
  for (let at = nextDay(first); at < day; at = nextDay(at)) {
    if (fallsOn(rule, first, at)) held += 1
    if (held >= rule.count) return false
  }
  return true
}

const romeStart = (day: string): number => {
  const [year, month, date] = day.split('-').map(Number)
  return romeMidnight(year as number, month as number, date as number).getTime()
}

/**
 * When a meeting is held on a day of Italy, or null when it is not. The first time is the one
 * the invitation names; the others follow its rule, at the same hour and for as long. A rule
 * Octo cannot follow gives the first time only: a meeting is never told on a day by guess.
 */
export function occurrenceOn(meeting: RepeatingMeeting, day: string): MeetingTime | null {
  const first = romeDateString(new Date(meeting.start))
  const excluded = (meeting.excluded ?? []).map((instant) => romeDateString(new Date(instant)))
  if (day < first || excluded.includes(day)) return null
  if (day === first) return { start: meeting.start, end: meeting.end }
  const rule = meeting.recurrence ? parseRule(meeting.recurrence) : null
  if (rule === null || (rule.until !== null && day > rule.until)) return null
  if (!fallsOn(rule, first, day) || !withinCount(rule, first, day)) return null
  const startMs = Date.parse(meeting.start)
  const at = romeStart(day) + (startMs - romeStart(first))
  return {
    start: new Date(at).toISOString(),
    end:
      meeting.end === null ? null : new Date(at + Date.parse(meeting.end) - startMs).toISOString(),
  }
}
