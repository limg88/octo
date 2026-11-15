import type { Alignment } from '../alignment/align.ts'
import type { Deliverable } from '../deliverables/deliverable.ts'
import type { DomainErrorCode } from '../errors.ts'
import type { Forecast } from '../forecast/compile.ts'
import type { Reconciliation } from '../hours/reconcile.ts'
import type { SourceState } from '../sources.ts'
import type { ProjectTeam } from '../team/model.ts'
import type { BugRow } from '../tracker/bugs.ts'
import type { ExportAge } from '../tracker/export.ts'
import type { RequirementRow } from '../tracker/requirements.ts'
import {
  daysBetweenDays,
  type HoursPersonFact,
  isMonthClosing,
  type TodayItem,
  workdaysBetween,
} from './model.ts'

const DAY_MS = 24 * 60 * 60 * 1000
const HOUR_MS = 60 * 60 * 1000
const wholeDays = (from: string, now: Date): number =>
  Math.max(0, Math.floor((now.getTime() - Date.parse(from)) / DAY_MS))

/** A source not read for longer than this is said: what follows on the page may be old. */
export const SOURCE_STALE_HOURS = 24

/** What a source of the project is, as far as the page needs to know. */
export type SourceReading = {
  source: string
  state: SourceState
  /** False for a system whose credential is not on this computer. */
  hasSecret: boolean
}

/** A source set up for the project that failed, was never read, or was not read for a day. */
export function sourceItems(readings: readonly SourceReading[], now: Date): TodayItem[] {
  const items: TodayItem[] = []
  for (const { source, state, hasSecret } of readings) {
    const run = state.lastRun
    const error: DomainErrorCode | null = run?.error ?? null
    const reason = !hasSecret
      ? 'no_secret'
      : run === null
        ? 'never'
        : error !== null
          ? 'error'
          : now.getTime() - Date.parse(run.at) > SOURCE_STALE_HOURS * HOUR_MS
            ? 'stale'
            : null
    if (reason === null) continue
    const days = run === null ? null : wholeDays(run.at, now)
    items.push({
      key: `source:${source}`,
      band: 'alert',
      facts: { kind: 'source', source, reason, days, error },
      weight: days ?? 0,
      target: 'sources',
      asOf: run?.at ?? null,
    })
  }
  return items
}

/** The export of the client's tracker, when it is old enough to make its numbers doubtful. */
export function trackerAgeItems(exportedAt: string | null, age: ExportAge, now: Date): TodayItem[] {
  if (exportedAt === null || age !== 'stale') return []
  const days = wholeDays(exportedAt, now)
  return [
    {
      key: 'tracker-old',
      band: 'alert',
      facts: { kind: 'tracker_old', days },
      weight: days,
      target: 'dashboard',
      asOf: exportedAt,
    },
  ]
}

const HOURS_TO_SAY = ['outlier', 'no_worklog', 'no_timesheet'] as const

/** The hours of a month that do not add up: one signal for the month, with the people in it. */
export function hoursItems(
  month: string,
  reconciliation: Reconciliation,
  today: string,
): TodayItem[] {
  const people = reconciliation.rows.flatMap((row): HoursPersonFact[] =>
    (HOURS_TO_SAY as readonly string[]).includes(row.status)
      ? [
          {
            person: row.person,
            status: row.status as HoursPersonFact['status'],
            timesheetHours: row.timesheetHours,
            worklogHours: row.worklogHours,
          },
        ]
      : [],
  )
  const duplicates = reconciliation.possibleDuplicates.length
  const tieOutOk = reconciliation.tieOut.ok
  if (people.length === 0 && duplicates === 0 && tieOutOk) return []
  const closing = isMonthClosing(today)
  return [
    {
      key: `hours:${month}`,
      band: closing ? 'due' : 'numbers',
      facts: { kind: 'hours', month, people, tieOutOk, duplicates },
      weight: people.length + duplicates + (tieOutOk ? 0 : 1),
      target: 'hours',
      asOf: null,
      ...(closing ? { dueBecause: 'month_end' as const } : {}),
    },
  ]
}

/** What the forecast of a month still lacks: one signal for the month. */
export function forecastItems(forecast: Forecast, today: string): TodayItem[] {
  if (forecast.gaps.length === 0) return []
  const closing = isMonthClosing(today)
  return [
    {
      key: `forecast:${forecast.month}`,
      band: closing ? 'due' : 'numbers',
      facts: { kind: 'forecast', month: forecast.month, gaps: forecast.gaps },
      weight: forecast.gaps.length,
      target: 'forecast',
      asOf: null,
      ...(closing ? { dueBecause: 'month_end' as const } : {}),
    },
  ]
}

/** The forecast of last month not written yet, said only while the month is being closed. */
export function monthDueItems(month: string, compiled: boolean, today: string): TodayItem[] {
  if (compiled || !isMonthClosing(today)) return []
  return [
    {
      key: `due:forecast:${month}`,
      band: 'due',
      facts: { kind: 'month_due', month, what: 'forecast' },
      weight: 1,
      target: 'forecast',
      asOf: null,
      dueBecause: 'month_end',
    },
  ]
}

/** The bugs that stay in a state longer than the project allows: one signal, with the count. */
export function bugItems(
  open: readonly BugRow[],
  stuckDays: number,
  exportedAt: string | null,
): TodayItem[] {
  const stuck = open.filter((bug) => bug.daysInState !== null && bug.daysInState >= stuckDays)
  if (stuck.length === 0) return []
  return [
    {
      key: 'bugs-stuck',
      band: 'watch',
      facts: {
        kind: 'bugs_stuck',
        count: stuck.length,
        stuckDays,
        oldestDays: Math.max(...stuck.map((bug) => bug.daysInState ?? 0)),
      },
      weight: stuck.length,
      target: 'dashboard',
      asOf: exportedAt,
    },
  ]
}

/** How many ids a signal names: the others are a click away. */
const IDS_SHOWN = 5

export function requirementItems(
  rows: readonly RequirementRow[],
  exportedAt: string | null,
): TodayItem[] {
  if (rows.length === 0) return []
  return [
    {
      key: 'requirements',
      band: 'watch',
      facts: {
        kind: 'requirements',
        count: rows.length,
        ids: rows.slice(0, IDS_SHOWN).map((row) => row.id),
      },
      weight: rows.length,
      target: 'dashboard',
      asOf: exportedAt,
    },
  ]
}

/** Days before the end of a sprint in which what is not aligned is due. */
export const SPRINT_ENDING_WORKDAYS = 2

/** What the two trackers do not agree on in the sprint compared. */
export function alignmentItems(
  sprint: string,
  alignment: Alignment,
  exportedAt: string | null,
  team: ProjectTeam,
  today: string,
): TodayItem[] {
  const facts = {
    kind: 'alignment' as const,
    sprint,
    missing: alignment.missing.length,
    needsUpdate: alignment.needsUpdate.length,
    duplicates: alignment.duplicates.length,
    orphans: alignment.orphans.length,
  }
  const weight = facts.missing + facts.needsUpdate + facts.duplicates + facts.orphans
  if (weight === 0) return []
  const period = team.periods.find(
    (candidate) => candidate.name.trim().toLowerCase() === sprint.trim().toLowerCase(),
  )
  const ending =
    period !== undefined &&
    today <= period.to &&
    workdaysBetween(today, period.to) <= SPRINT_ENDING_WORKDAYS
  return [
    {
      key: `alignment:${sprint.trim().toLowerCase()}`,
      band: ending ? 'due' : 'numbers',
      facts,
      weight,
      target: 'alignment',
      asOf: exportedAt,
      ...(ending ? { dueBecause: 'sprint_end' as const } : {}),
    },
  ]
}

/** The drafts that wait for the PM: to approve, or failed and to start again. */
export function draftItems(deliverables: readonly Deliverable[], now: Date): TodayItem[] {
  return deliverables.flatMap((deliverable): TodayItem[] => {
    if (deliverable.status !== 'review' && deliverable.status !== 'failed') return []
    const since = deliverable.readyAt ?? deliverable.createdAt
    const days = wholeDays(since, now)
    return [
      {
        key: `draft:${deliverable.id}`,
        band: 'waiting',
        facts: {
          kind: 'draft',
          id: deliverable.id,
          title: deliverable.title,
          status: deliverable.status,
          days,
          fixFirst: deliverable.redTeam?.verdict === 'fix_first',
        },
        weight: days,
        target: 'deliverables',
        asOf: since,
      },
    ]
  })
}

/** Days ahead a date of the calendar is told. */
export const PERIOD_ENDING_DAYS = 3
export const PERSON_LEAVING_DAYS = 7

/** The dates of the calendar that are near: a period that ends, someone who leaves. */
export function calendarItems(team: ProjectTeam, today: string): TodayItem[] {
  const items: TodayItem[] = []
  for (const period of team.periods) {
    const inDays = daysBetweenDays(today, period.to)
    if (inDays < 0 || inDays > PERIOD_ENDING_DAYS) continue
    items.push({
      key: `calendar:period:${period.name.toLowerCase()}:${period.to}`,
      band: inDays === 0 ? 'due' : 'watch',
      facts: { kind: 'calendar', what: 'period_ends', name: period.name, day: period.to, inDays },
      weight: PERIOD_ENDING_DAYS - inDays,
      target: 'sources',
      asOf: null,
    })
  }
  for (const person of team.people) {
    if (person.to === '') continue
    const inDays = daysBetweenDays(today, person.to)
    if (inDays < 0 || inDays > PERSON_LEAVING_DAYS) continue
    items.push({
      key: `calendar:person:${person.name.toLowerCase()}:${person.to}`,
      band: 'watch',
      facts: { kind: 'calendar', what: 'person_leaves', name: person.name, day: person.to, inDays },
      weight: PERSON_LEAVING_DAYS - inDays,
      target: 'sources',
      asOf: null,
    })
  }
  return items
}
