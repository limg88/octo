import { type HoursEntry, personKey } from '../hours/model.ts'
import type { TrackerHours } from '../hours/sources.ts'
import type { ForecastSettings } from './model.ts'

/**
 * The hours logged on the tracker of a project, with the project code they are of. The tracker
 * names no code: the hours can be told of a code only when the project has one, else `code` is
 * null and they are of none.
 */
export type ForecastWorklog = { entries: readonly TrackerHours[]; code: string | null }

export const NO_FORECAST_WORKLOG: ForecastWorklog = { entries: [], code: null }

const MONTH_LENGTH = 7
const monthOf = (day: string): string => day.slice(0, MONTH_LENGTH)

/**
 * What an hour of each person costs, by the rows of timesheet that carry a cost: those of the
 * last month the person has some in, because a cost changes over time. By the key of the person.
 */
export function hourlyCostsOf(timesheet: readonly HoursEntry[]): Map<string, number> {
  const latest = new Map<string, { month: string; hours: number; cost: number }>()
  for (const entry of timesheet) {
    if (!entry.approved || entry.cost === null || entry.cost === undefined || entry.hours <= 0) {
      continue
    }
    const key = personKey(entry.person)
    const month = monthOf(entry.day)
    const known = latest.get(key)
    if (known === undefined || month > known.month) {
      latest.set(key, { month, hours: entry.hours, cost: entry.cost })
    } else if (month === known.month) {
      known.hours += entry.hours
      known.cost += entry.cost
    }
  }
  return new Map([...latest].map(([key, { hours, cost }]) => [key, cost / hours]))
}

/** The hours of a person on the tracker, month by month. */
export type LoggedHours = { person: string; key: string; months: Map<string, number> }

/** The hours of the tracker that are of a code, person by person and month by month. */
export function loggedOn(worklog: ForecastWorklog, code: string, upTo: string): LoggedHours[] {
  if (worklog.code !== code) return []
  const people = new Map<string, LoggedHours>()
  for (const entry of worklog.entries) {
    const month = monthOf(entry.day)
    if (month > upTo) continue
    const key = personKey(entry.person)
    const logged = people.get(key) ?? { person: entry.person, key, months: new Map() }
    logged.months.set(month, (logged.months.get(month) ?? 0) + entry.hours)
    people.set(key, logged)
  }
  return [...people.values()].sort((a, b) => a.person.localeCompare(b.person, 'it'))
}

/** What the people without a timesheet cost on a code in the months asked, by their hours logged. */
export type NoTimesheetCost = { person: string; hours: number; costPerHour: number }

/**
 * The people the PM said have no timesheet, with the hours they logged on the tracker in the
 * months that pass `counts` and what an hour of theirs costs. Who has rows of timesheet on the
 * code after all is left to those: the same hours are never counted twice.
 */
export function noTimesheetCosts(
  worklog: ForecastWorklog,
  timesheet: readonly HoursEntry[],
  settings: Pick<ForecastSettings, 'hourlyCosts'>,
  code: string,
  counts: (month: string) => boolean,
): NoTimesheetCost[] {
  const withTimesheet = new Set(
    timesheet.filter((entry) => entry.project === code).map((entry) => personKey(entry.person)),
  )
  const costs = new Map(
    settings.hourlyCosts.map((entry) => [personKey(entry.person), entry.costPerHour]),
  )
  return loggedOn(worklog, code, '9999-12').flatMap((logged) => {
    const costPerHour = costs.get(logged.key)
    if (costPerHour === undefined || withTimesheet.has(logged.key)) return []
    const hours = [...logged.months]
      .filter(([month]) => counts(month))
      .reduce((total, [, monthHours]) => total + monthHours, 0)
    return hours > 0 ? [{ person: logged.person, hours, costPerHour }] : []
  })
}
