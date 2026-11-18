import type { ProjectEconomics } from '../economics/model.ts'
import { type SheetProgress, sheetProgress } from '../economics/progress.ts'
import { type SheetEconomics, sheetEconomics } from '../economics/sheet.ts'
import { type HoursEntry, personKey } from '../hours/model.ts'
import type { PersonCap } from '../team/model.ts'
import { unreadForecastMonths } from './compile.ts'
import {
  type ForecastKind,
  type ForecastSettings,
  forecastCode,
  NO_FORECAST_PROJECT,
} from './model.ts'
import {
  type ForecastWorklog,
  hourlyCostsOf,
  loggedOn,
  NO_FORECAST_WORKLOG,
  noTimesheetCosts,
} from './worklog-costs.ts'

/**
 * Where the hours and the cost of a line come from. `timesheet`: approved rows, with their cost.
 * `declared`: an external the PM declared month by month. `no_timesheet`: who has no timesheet,
 * by the hours logged on the tracker at the cost of an hour the PM wrote. `estimate`: hours
 * logged on the tracker in months whose timesheets have not come yet, at what an hour of the
 * person cost in their last timesheet: an estimate, always said to be one.
 */
export const LIFETIME_SOURCES = ['timesheet', 'declared', 'no_timesheet', 'estimate'] as const
export type LifetimeSource = (typeof LIFETIME_SOURCES)[number]

/** What a person did on a project code since it began: one line of the PM's own sheet. */
export type LifetimeLine = {
  person: string
  hours: number
  /** Null when no row of the person carries a cost: the hours are there, the cost is not. */
  cost: number | null
  source: LifetimeSource
  /** The months an estimate stands for, `YYYY-MM`; empty for what is not one. */
  months: string[]
}

/**
 * The costs at budget as the caps of the people tell them: for each person the days they are to
 * spend, at what an hour of theirs costs. A proposal for the PM, never written by itself.
 */
export type BudgetProposal = {
  costs: number
  people: Array<{ person: string; days: number; costPerHour: number }>
  /** Who has a cap and no cost of an hour: their days are not in the proposal. */
  withoutCost: string[]
}

/**
 * What the project would cost if every person spent the days of their cap: the cost of an hour
 * is the one the PM wrote for who has no timesheet, else the one of their last timesheet. Null
 * when nobody has a cap, or no cost is known for anybody.
 */
export function budgetFromCaps(
  caps: readonly PersonCap[],
  timesheet: readonly HoursEntry[],
  settings: Pick<ForecastSettings, 'hourlyCosts' | 'hoursPerDay'>,
): BudgetProposal | null {
  const fromTimesheets = hourlyCostsOf(timesheet)
  const written = new Map(
    settings.hourlyCosts.map((entry) => [personKey(entry.person), entry.costPerHour]),
  )
  const people: BudgetProposal['people'] = []
  const withoutCost: string[] = []
  for (const cap of caps) {
    const key = personKey(cap.person)
    const costPerHour = written.get(key) ?? fromTimesheets.get(key)
    if (costPerHour === undefined) withoutCost.push(cap.person)
    else people.push({ person: cap.person, days: cap.days, costPerHour })
  }
  if (people.length === 0) return null
  const costs = people.reduce(
    (total, person) => total + person.days * settings.hoursPerDay * person.costPerHour,
    0,
  )
  return { costs, people, withoutCost }
}

/**
 * A project code over its whole life, as a PM of a fixed price asks it: what was spent so far and
 * by whom, what was invoiced and recognised, the margin today and the one at the end.
 */
export type Lifetime = {
  code: string
  description: string
  kind: ForecastKind
  /** The last month counted, `YYYY-MM`. */
  through: string
  ordered: number | null
  invoiced: number | null
  recognized: number | null
  lines: LifetimeLine[]
  hours: number
  /** The costs so far: the lines of the people and what the suppliers delivered. */
  costs: number
  /** What the suppliers delivered against their orders so far; zero without any. */
  supplierCosts: number
  /**
   * The costs so far less what was invoiced: work done the client has not been billed for when
   * positive. Null while nothing tells what was invoiced.
   */
  wip: number | null
  /**
   * The revenue recognised less what was invoiced: invoices still to issue when positive, billed
   * in advance when negative. Null while either is not told.
   */
  toBill: number | null
  /** What the company's system says of the money of the code; null when it was not read. */
  economics: SheetEconomics | null
  /** The part of the hours and of the costs that is an estimate from the tracker. */
  estimatedHours: number
  estimatedCosts: number
  /** What is left of the order after the costs so far, over the order; null without an order. */
  marginToDate: number | null
  /** The costs of the whole project at budget, as last written; null when never written. */
  budgetCosts: number | null
  /** The costs at budget the caps of the people would give; null when they tell nothing. */
  proposedBudget: BudgetProposal | null
  /** How far the work is, as the company's system tells it, with what says so. */
  progress: SheetProgress | null
  /** What the whole project is expected to cost: as the PM wrote it, else the budget. */
  expectedCosts: number | null
  /** The margin when the project ends, on the expected costs or on those so far when higher. */
  marginAtEnd: number | null
  /** Hours on the code not approved yet: left out. */
  notApprovedHours: number
  /** Months of timesheets since the code began that nobody read: the costs miss them. */
  unreadMonths: string[]
}

const CENTS = 100
/** An amount to the cent: a product of hours and a cost is no longer a sum of rows. */
const cents = (value: number): number => Math.round(value * CENTS) / CENTS

/** The last value written for a code up to a month, among what the PM adds month by month. */
function lastWritten(
  settings: ForecastSettings,
  code: string,
  month: string,
  field: 'budgetCosts' | 'totalCosts',
): number | null {
  const written = Object.entries(settings.months)
    .filter(([at, rows]) => at <= month && (rows[code]?.[field] ?? null) !== null)
    .sort(([a], [b]) => a.localeCompare(b))
  return written.at(-1)?.[1][code]?.[field] ?? null
}

/**
 * The approved hours of each person, at what an hour of theirs costs today, as the sheet of the
 * administration prices every hour at the current cost of the person. Without a row that carries a cost the hours are there and the cost is not.
 */
function timesheetLines(
  entries: readonly HoursEntry[],
  costs: ReadonlyMap<string, number>,
): LifetimeLine[] {
  const people = new Map<string, LifetimeLine>()
  for (const entry of entries) {
    const key = personKey(entry.person)
    const line = people.get(key) ?? {
      person: entry.person,
      hours: 0,
      cost: null,
      source: 'timesheet' as const,
      months: [],
    }
    line.hours += entry.hours
    const costPerHour = costs.get(key)
    line.cost = costPerHour === undefined ? null : cents(line.hours * costPerHour)
    people.set(key, line)
  }
  return [...people.values()].sort((a, b) => a.person.localeCompare(b.person, 'it'))
}

/** The externals the PM declared month by month, each one a line, at the cost written once. */
function declaredLines(settings: ForecastSettings, code: string, month: string): LifetimeLine[] {
  const people = new Map<string, LifetimeLine>()
  for (const [at, rows] of Object.entries(settings.months)) {
    if (at > month) continue
    for (const external of rows[code]?.externals ?? []) {
      const key = personKey(external.name)
      const rate = settings.externals.find(
        (candidate) => candidate.code === code && personKey(candidate.name) === key,
      )
      const line = people.get(key) ?? {
        person: external.name,
        hours: 0,
        cost: null,
        source: 'declared' as const,
        months: [],
      }
      line.hours += external.hours
      if (rate) {
        line.cost = (line.cost ?? 0) + (external.hours / settings.hoursPerDay) * rate.costPerDay
      }
      people.set(key, line)
    }
  }
  return [...people.values()].sort((a, b) => a.person.localeCompare(b.person, 'it'))
}

/** Who has no timesheet, by the hours logged on the tracker at the cost of an hour written. */
function noTimesheetLines(
  worklog: ForecastWorklog,
  timesheet: readonly HoursEntry[],
  settings: ForecastSettings,
  code: string,
  month: string,
): LifetimeLine[] {
  return noTimesheetCosts(worklog, timesheet, settings, code, (at) => at <= month).map(
    ({ person, hours, costPerHour }) => ({
      person,
      hours,
      cost: hours * costPerHour,
      source: 'no_timesheet',
      months: [],
    }),
  )
}

/**
 * The hours logged on the tracker in the months the code has no approved timesheet for, by who
 * has timesheets: the company's system gets them when the month is closed. Each at what an hour
 * of the person cost in their last timesheet; without one, the hours are there and the cost is not.
 */
function estimateLines(
  worklog: ForecastWorklog,
  timesheet: readonly HoursEntry[],
  settings: ForecastSettings,
  code: string,
  month: string,
): LifetimeLine[] {
  const covered = new Set(
    timesheet
      .filter((entry) => entry.approved && entry.project === code)
      .map((entry) => entry.day.slice(0, month.length)),
  )
  const declared = new Set(settings.hourlyCosts.map((entry) => personKey(entry.person)))
  const costs = hourlyCostsOf(timesheet)
  // The tracker often writes a user name: who has timesheets is called as they call them.
  const names = new Map(timesheet.map((entry) => [personKey(entry.person), entry.person]))
  const lines = loggedOn(worklog, code, month).flatMap((logged): LifetimeLine[] => {
    if (declared.has(logged.key)) return []
    const months = [...logged.months.keys()].filter((at) => !covered.has(at)).sort()
    const hours = months.reduce((total, at) => total + (logged.months.get(at) ?? 0), 0)
    if (hours <= 0) return []
    const costPerHour = costs.get(logged.key)
    return [
      {
        person: names.get(logged.key) ?? logged.person,
        hours,
        cost: costPerHour === undefined ? null : hours * costPerHour,
        source: 'estimate',
        months,
      },
    ]
  })
  return lines.sort((a, b) => a.person.localeCompare(b.person, 'it'))
}

/**
 * What an hour of each person costs today, by the key of the person: as the company's system
 * says, else as their last timesheet up to the month says.
 */
export function currentHourlyCosts(
  timesheet: readonly HoursEntry[],
  month: string,
  read: ProjectEconomics | null,
): Map<string, number> {
  return new Map([
    ...hourlyCostsOf(timesheet.filter((entry) => entry.day.slice(0, month.length) <= month)),
    ...(read?.standardCosts ?? []).map((cost): [string, number] => [
      personKey(cost.person),
      cost.costPerHour,
    ]),
  ])
}

/**
 * A project code from its start to a month: who worked how much and at what cost, and the
 * margins a PM computes by hand. A cost that is missing is left out and the line says so; what
 * is estimated from the tracker is a line of its own, marked as an estimate. `readMonths` as in
 * the monthly forecast; `worklog`: the hours logged on the tracker, when they are of this code.
 */
export function compileLifetime(
  projectCode: string,
  timesheet: readonly HoursEntry[],
  settings: ForecastSettings,
  month: string,
  readMonths: readonly string[] | null = null,
  worklog: ForecastWorklog = NO_FORECAST_WORKLOG,
  /** The caps of the people of the project: they tell of a code only when it is the only one. */
  caps: readonly PersonCap[] = [],
  /** What the company's system says of the money of the code; null when it was not read. */
  read: ProjectEconomics | null = null,
): Lifetime {
  const code = forecastCode(projectCode)
  const project = settings.projects[code] ?? NO_FORECAST_PROJECT
  const upTo = timesheet.filter(
    (entry) => entry.project === code && entry.day.slice(0, month.length) <= month,
  )
  const costsOfAnHour = currentHourlyCosts(timesheet, month, read)
  const lines = [
    ...timesheetLines(
      upTo.filter((entry) => entry.approved),
      costsOfAnHour,
    ),
    ...declaredLines(settings, code, month),
    ...noTimesheetLines(worklog, timesheet, settings, code, month),
    ...estimateLines(worklog, timesheet, settings, code, month),
  ]
  const economics = read === null ? null : sheetEconomics(read, month)
  const supplierCosts = economics?.suppliers?.received ?? 0
  const hours = lines.reduce((total, line) => total + line.hours, 0)
  const costs = lines.reduce((total, line) => total + (line.cost ?? 0), 0) + supplierCosts
  // The lines of the invoices tell what was invoiced; without any, what the backlog said.
  const invoiced =
    economics !== null && economics.billing.length > 0 ? economics.invoiced : project.invoiced
  // The ledger tells the revenue recognised; while it books nothing, what the backlog said.
  const recognized =
    read !== null && read.ledger.length > 0
      ? (economics?.ledger.revenue ?? null)
      : project.recognized
  const estimates = lines.filter((line) => line.source === 'estimate')
  const { ordered } = project
  const budgetCosts = lastWritten(settings, code, month, 'budgetCosts')
  const expectedCosts = lastWritten(settings, code, month, 'totalCosts') ?? budgetCosts
  const marginOn = (spent: number): number | null => (ordered ? (ordered - spent) / ordered : null)
  return {
    code,
    description: project.description,
    kind: project.kind,
    through: month,
    ordered,
    invoiced,
    recognized,
    lines,
    hours,
    costs,
    supplierCosts,
    wip: invoiced === null ? null : costs - invoiced,
    toBill: invoiced === null || recognized === null ? null : recognized - invoiced,
    economics,
    estimatedHours: estimates.reduce((total, line) => total + line.hours, 0),
    estimatedCosts: estimates.reduce((total, line) => total + (line.cost ?? 0), 0),
    marginToDate: marginOn(costs),
    budgetCosts,
    proposedBudget: budgetFromCaps(caps, timesheet, settings),
    progress: sheetProgress({
      readings: read?.progress ?? [],
      through: month,
      recognized,
      ordered,
      costs,
      totalCosts: expectedCosts,
    }),
    expectedCosts,
    marginAtEnd: expectedCosts === null ? null : marginOn(Math.max(expectedCosts, costs)),
    notApprovedHours: upTo
      .filter((entry) => !entry.approved)
      .reduce((total, entry) => total + entry.hours, 0),
    unreadMonths: unreadForecastMonths(project.startMonth, month, readMonths),
  }
}
