import { type HoursEntry, type HoursSettings, personKey } from './model.ts'

export const HOURS_STATUSES = ['ok', 'outlier', 'no_worklog', 'no_timesheet', 'expected'] as const
export type HoursStatus = (typeof HOURS_STATUSES)[number]

export type HoursRow = {
  person: string
  timesheetHours: number
  worklogHours: number
  /** The difference as a share of the timesheet hours; null when there are none. */
  deltaPct: number | null
  status: HoursStatus
}

export type HoursPeriod = { from: string; to: string }

export type Reconciliation = {
  rows: HoursRow[]
  totals: { timesheetHours: number; worklogHours: number; deltaPct: number | null }
  /** What was left out of the comparison, so nothing disappears unseen. */
  excluded: {
    /** Timesheet hours not approved yet. */
    notApprovedHours: number
    /** Timesheet hours after the cutoff, approved but of a period not complete. */
    partialTimesheetHours: number
    partialWorklogHours: number
    /** Timesheet hours on project codes that are not of this project. */
    otherProjects: Array<{ project: string; hours: number }>
  }
  /**
   * The same person, day and hours found on two project codes: often hours moved from one code
   * to the other and still present in an older export. They are counted, and said.
   */
  possibleDuplicates: Array<{ projects: [string, string]; hours: number }>
  /**
   * The check before anyone reads the table: the approved hours of the period on the project's
   * codes must equal what the rows compare plus what the cutoff left out.
   */
  tieOut: { approvedHours: number; accountedHours: number; ok: boolean }
}

const HOURS_DECIMALS = 100
const PCT_DECIMALS = 10
const TIE_OUT_TOLERANCE = 0.01

const round = (value: number, decimals: number): number => Math.round(value * decimals) / decimals
const hours = (value: number): number => round(value, HOURS_DECIMALS)

/** The difference between two amounts of hours, as a share of the first. */
export function deltaPct(timesheetHours: number, worklogHours: number): number | null {
  if (timesheetHours <= 0) return null
  return round((Math.abs(timesheetHours - worklogHours) / timesheetHours) * 100, PCT_DECIMALS)
}

const inPeriod = (entry: HoursEntry, period: HoursPeriod): boolean =>
  entry.day >= period.from && entry.day <= period.to

type Person = { name: string; timesheet: number; worklog: number }

function statusOf(person: Person, key: string, settings: Expected, threshold: number): HoursStatus {
  if (person.worklog === 0) return settings.noWorklog.has(key) ? 'expected' : 'no_worklog'
  if (person.timesheet === 0) return settings.noTimesheet.has(key) ? 'expected' : 'no_timesheet'
  return (deltaPct(person.timesheet, person.worklog) ?? 0) > threshold ? 'outlier' : 'ok'
}

type Expected = { noWorklog: ReadonlySet<string>; noTimesheet: ReadonlySet<string> }

/** The rows that need a look come first; inside a group, the larger amounts first. */
const ATTENTION: Record<HoursStatus, number> = {
  outlier: 0,
  no_worklog: 1,
  no_timesheet: 2,
  ok: 3,
  expected: 4,
}

/**
 * Compares, person by person, the approved hours of the timesheets with the hours logged on the
 * tracker over a period. Every number is a sum of the entries given: nothing is estimated.
 */
export function reconcileHours(
  timesheet: readonly HoursEntry[],
  worklog: readonly HoursEntry[],
  settings: HoursSettings,
  period: HoursPeriod,
): Reconciliation {
  const projects = new Set(settings.projects)
  const aliases = new Map(
    settings.aliases.map((alias) => [personKey(alias.worklog), personKey(alias.timesheet)]),
  )
  const expected: Expected = {
    noWorklog: new Set(settings.noWorklogExpected.map(personKey)),
    noTimesheet: new Set(settings.noTimesheetExpected.map(personKey)),
  }
  const afterCutoff = (entry: HoursEntry) => settings.cutoff !== '' && entry.day > settings.cutoff
  const people = new Map<string, Person>()
  const personOf = (key: string, name: string): Person => {
    const known = people.get(key)
    if (known) return known
    const added = { name, timesheet: 0, worklog: 0 }
    people.set(key, added)
    return added
  }

  const sameHours = new Map<string, Set<string>>()
  const doubled = new Map<string, number>()
  /** Notes an entry and, when its twin on another code was already seen, the hours counted twice. */
  const noteTwin = (entry: HoursEntry): void => {
    const code = entry.project ?? ''
    const key = `${personKey(entry.person)}|${entry.day}|${entry.hours}`
    const codes = sameHours.get(key) ?? new Set<string>()
    for (const other of codes) {
      if (other === code) continue
      const pair = [other, code].sort().join('|')
      doubled.set(pair, (doubled.get(pair) ?? 0) + entry.hours)
    }
    codes.add(code)
    sameHours.set(key, codes)
  }

  let notApproved = 0
  let partialTimesheet = 0
  let approved = 0
  const others = new Map<string, number>()
  for (const entry of timesheet) {
    if (!inPeriod(entry, period)) continue
    if (projects.size > 0 && (entry.project === null || !projects.has(entry.project))) {
      const code = entry.project ?? ''
      others.set(code, (others.get(code) ?? 0) + entry.hours)
      continue
    }
    if (!entry.approved) {
      notApproved += entry.hours
      continue
    }
    approved += entry.hours
    noteTwin(entry)
    if (afterCutoff(entry)) partialTimesheet += entry.hours
    else personOf(personKey(entry.person), entry.person).timesheet += entry.hours
  }

  let partialWorklog = 0
  for (const entry of worklog) {
    if (!inPeriod(entry, period)) continue
    if (afterCutoff(entry)) {
      partialWorklog += entry.hours
      continue
    }
    const key = personKey(entry.person)
    // The timesheet's spelling of a name is the one shown, when both have the person.
    const person = personOf(aliases.get(key) ?? key, entry.person)
    person.worklog += entry.hours
  }

  const rows: HoursRow[] = [...people.entries()]
    .map(([key, person]) => ({
      person: person.name,
      timesheetHours: hours(person.timesheet),
      worklogHours: hours(person.worklog),
      deltaPct: deltaPct(person.timesheet, person.worklog),
      status: statusOf(person, key, expected, settings.thresholdPct),
    }))
    .sort(
      (a, b) =>
        ATTENTION[a.status] - ATTENTION[b.status] ||
        b.timesheetHours + b.worklogHours - (a.timesheetHours + a.worklogHours) ||
        a.person.localeCompare(b.person, 'it'),
    )

  const compared = rows.reduce((sum, row) => sum + row.timesheetHours, 0)
  const logged = rows.reduce((sum, row) => sum + row.worklogHours, 0)
  const accounted = compared + partialTimesheet
  return {
    rows,
    totals: {
      timesheetHours: hours(compared),
      worklogHours: hours(logged),
      deltaPct: deltaPct(compared, logged),
    },
    excluded: {
      notApprovedHours: hours(notApproved),
      partialTimesheetHours: hours(partialTimesheet),
      partialWorklogHours: hours(partialWorklog),
      otherProjects: [...others.entries()]
        .map(([project, total]) => ({ project, hours: hours(total) }))
        .sort((a, b) => b.hours - a.hours),
    },
    possibleDuplicates: [...doubled.entries()].map(([pair, total]) => {
      const [first = '', second = ''] = pair.split('|')
      return { projects: [first, second], hours: hours(total) }
    }),
    tieOut: {
      approvedHours: hours(approved),
      accountedHours: hours(accounted),
      ok: Math.abs(approved - accounted) <= TIE_OUT_TOLERANCE,
    },
  }
}
