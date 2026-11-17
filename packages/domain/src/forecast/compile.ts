import { type HoursEntry, personKey } from '../hours/model.ts'
import {
  type ForecastColumn,
  type ForecastExternal,
  type ForecastExternalRate,
  type ForecastKind,
  type ForecastRate,
  type ForecastSettings,
  forecastCode,
  forecastMonthsBetween,
  NO_FORECAST_PROJECT,
  NO_ROW_INPUTS,
} from './model.ts'
import {
  type ForecastWorklog,
  NO_FORECAST_WORKLOG,
  type NoTimesheetCost,
  noTimesheetCosts,
} from './worklog-costs.ts'

/**
 * What goes in a cell of the model. A formula names the other cells of its row by their column
 * between braces (`{revenue}`), whatever sheet it ends in, and carries the value it gives, so any
 * reader shows it.
 */
export type ForecastCell =
  | {
      kind: 'formula'
      formula: string
      value: number | null
      /** Shown as a percentage even where the model's column holds days. */
      percent?: true
    }
  | { kind: 'number'; value: number; percent?: true }
  | { kind: 'text'; value: string }
  | { kind: 'empty' }

export type ForecastValues = {
  internalCosts: number
  externalCosts: number
  revenue: number
  /** Days sold, or the share of the project done when it is at a fixed price. */
  quantity: number
  quantityIsShare: boolean
  marginMonth: number | null
  marginEnd: number | null
  toInvoice: number
}

/** A missing piece the PM has to supply; nothing is ever estimated in its place. */
export type ForecastGap =
  | { kind: 'no_cost'; code: string; person: string; hours: number }
  | {
      kind: 'no_rate'
      code: string
      person: string
      hours: number
      /** The rate the person has on the code a rate was last written for: to propose, not to use. */
      proposed: { code: string; ratePerDay: number } | null
    }
  | { kind: 'no_external_rate'; code: string; person: string; hours: number }
  | { kind: 'no_total_costs'; code: string }
  | { kind: 'no_ordered'; code: string }
  | { kind: 'no_budget_costs'; code: string }
  | { kind: 'no_fee_months'; code: string }
  /** Months of timesheets the figures of the code need and nobody read: its costs miss them. */
  | { kind: 'unread_months'; code: string; months: string[] }

export type ForecastRow = {
  code: string
  description: string
  revenueKind: ForecastKind
  ordered: number | null
  hours: number
  values: ForecastValues
  note: string
  /** What a model is filled with, by column; the code and the ordered amount stay the model's. */
  cells: Partial<Record<ForecastColumn, ForecastCell>>
}

export type Forecast = {
  month: string
  rows: ForecastRow[]
  gaps: ForecastGap[]
  /** Hours of the month on the codes of the project that are not approved yet: left out. */
  notApprovedHours: number
  /** Codes with approved hours in the month that are not of the project. */
  otherCodes: string[]
  /** The months of timesheets the forecast needs and nobody read, the oldest first. */
  unreadMonths: string[]
  /**
   * Codes the PM wrote something for in this month that are not of the project: what is written
   * there (hours of externals, revenue, an amount to invoice) is not counted anywhere.
   */
  orphanCodes: string[]
}

export type ForecastTexts = {
  noActivity: string
  timesheet: (hours: number, days: number) => string
  external: (name: string, days: number) => string
  progress: (share: number, before: number, budgetCosts: number) => string
  fee: (months: number) => string
  revenueDecided: string
  left: (people: string[]) => string
  externalLeft: (people: string[]) => string
  unread: (months: string[]) => string
  noTimesheet: (name: string, hours: number) => string
}

const italian = (value: number, decimals: number): string =>
  value.toLocaleString('it-IT', { maximumFractionDigits: decimals, useGrouping: 'always' })

/** The notes the model carries beside each figure: where it comes from, in one line. */
export const FORECAST_TEXTS: ForecastTexts = {
  noActivity: 'nessuna attività nel mese',
  timesheet: (hours, days) =>
    `timesheet approvati: ${italian(hours, 1)} h = ${italian(days, 3)} gg`,
  external: (name, days) => `${name}: ${italian(days, 3)} gg dichiarati`,
  externalLeft: (people) =>
    `esterni senza costo e tariffa, fuori dal calcolo: ${people.join(', ')}`,
  progress: (share, before, budgetCosts) =>
    `avanzamento ${italian(share * 100, 2)}% (mese prima ${italian(before * 100, 2)}%) = costi fino al mese / costi a budget ${italian(budgetCosts, 2)}`,
  fee: (months) => `canone: ordinato in ${months} rate mensili`,
  revenueDecided: 'ricavi indicati dal PM',
  left: (people) => `ore senza costo nei timesheet, fuori dai costi: ${people.join(', ')}`,
  unread: (months) => `timesheet non letti, costi incompleti: ${months.join(', ')}`,
  noTimesheet: (name, hours) =>
    `${name}: ${italian(hours, 1)} h dal tracker, senza timesheet, a costo orario`,
}

const DAYS_DECIMALS = 3
const MONEY_DECIMALS = 2
const round = (value: number, decimals: number): number => Number(value.toFixed(decimals))

/** A number as a formula writes it: a point for the decimals, no needless zeros. */
const literal = (value: number): string => String(round(value, 6))

const sum = (terms: readonly string[]): string => terms.join('+')

const cell = (column: ForecastColumn): string => `{${column}}`
const MONTH_COSTS = `${cell('internalCosts')}+${cell('externalCosts')}`
const WHOLE = 1

/** A formula of the forecast with its cells at a row of a sheet. */
export function forecastFormulaAt(
  formula: string,
  columns: Readonly<Record<ForecastColumn, string>>,
  row: number,
): string {
  return formula.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in columns ? `${columns[name as ForecastColumn]}${row}` : whole,
  )
}

/**
 * The one among `named` that is this person, whatever the order of the name; a name written with
 * fewer words (no middle name) is theirs when it is the only one that fits.
 */
function ofPerson<T>(named: readonly T[], nameOf: (entry: T) => string, person: string): T | null {
  const key = personKey(person)
  const exact = named.find((entry) => personKey(nameOf(entry)) === key)
  if (exact) return exact
  const words = new Set(key.split(' '))
  const fitting = named.filter((entry) =>
    personKey(nameOf(entry))
      .split(' ')
      .every((word) => words.has(word)),
  )
  return fitting.length === 1 ? (fitting[0] ?? null) : null
}

/** The rate of a person on a code: the one written for that code, else the person's own. */
function rateOf(rates: readonly ForecastRate[], person: string, code: string): ForecastRate | null {
  const named = (rate: ForecastRate) => rate.person
  return (
    ofPerson(
      rates.filter((rate) => rate.code === code),
      named,
      person,
    ) ??
    ofPerson(
      rates.filter((rate) => rate.code === null),
      named,
      person,
    )
  )
}

/**
 * The rate a person has on another code, the one written last: what a new code of the same
 * project most likely sells the person for. Null when the person has a rate on no code.
 */
function rateElsewhere(
  rates: readonly ForecastRate[],
  person: string,
  code: string,
): { code: string; ratePerDay: number } | null {
  const key = personKey(person)
  for (const rate of [...rates].reverse()) {
    if (rate.code !== null && rate.code !== code && personKey(rate.person) === key) {
      return { code: rate.code, ratePerDay: rate.ratePerDay }
    }
  }
  return null
}

type PersonHours = {
  person: string
  hours: number
  /** The cost of the rows that carry one, and the hours of those that do not. */
  cost: number
  hoursWithoutCost: number
}

/** The hours and the cost each person has on a code, under the name the timesheet writes first. */
function hoursByPerson(entries: readonly HoursEntry[]): PersonHours[] {
  const people = new Map<string, PersonHours>()
  for (const entry of entries) {
    const key = personKey(entry.person)
    const known = people.get(key) ?? {
      person: entry.person,
      hours: 0,
      cost: 0,
      hoursWithoutCost: 0,
    }
    known.hours += entry.hours
    if (entry.cost === null || entry.cost === undefined) known.hoursWithoutCost += entry.hours
    else known.cost += entry.cost
    people.set(key, known)
  }
  return [...people.values()].sort((a, b) => a.person.localeCompare(b.person))
}

type ExternalCosts = {
  costs: number
  days: number
  /** Each external counted: the days, what a day costs and what it is sold for. */
  counted: Array<{ name: string; days: number; costPerDay: number; ratePerDay: number }>
  /** Those with no cost and rate for the code: left out. */
  left: ForecastExternal[]
}

/** What the externals declared on a code cost, by the cost written once for the code. */
function externalCosts(
  declared: readonly ForecastExternal[],
  rates: readonly ForecastExternalRate[],
  code: string,
  hoursPerDay: number,
): ExternalCosts {
  const ofCode = rates.filter((rate) => rate.code === code)
  const result: ExternalCosts = { costs: 0, days: 0, counted: [], left: [] }
  for (const external of declared) {
    const rate = ofPerson(ofCode, (candidate) => candidate.name, external.name)
    if (rate === null) {
      result.left.push(external)
      continue
    }
    const days = external.hours / hoursPerDay
    result.costs += days * rate.costPerDay
    result.days += days
    result.counted.push({
      name: external.name,
      days,
      costPerDay: rate.costPerDay,
      ratePerDay: rate.ratePerDay,
    })
  }
  return result
}

/** The costs at budget of a fixed price: the last written up to the month. */
function budgetCostsAt(settings: ForecastSettings, code: string, month: string): number | null {
  const written = Object.entries(settings.months)
    .filter(([at, rows]) => at <= month && (rows[code]?.budgetCosts ?? null) !== null)
    .sort(([a], [b]) => a.localeCompare(b))
  return written.at(-1)?.[1][code]?.budgetCosts ?? null
}

const costOf = (people: readonly NoTimesheetCost[]): number =>
  people.reduce((total, person) => total + person.hours * person.costPerHour, 0)

/**
 * What a code cost before a month: the approved hours with a cost, the externals declared, and
 * who has no timesheet by the hours logged on the tracker.
 */
function costsBefore(
  timesheet: readonly HoursEntry[],
  settings: ForecastSettings,
  code: string,
  month: string,
  worklog: ForecastWorklog,
): number {
  const internal = timesheet
    .filter((entry) => entry.approved && entry.project === code && entry.day < `${month}-01`)
    .reduce((total, entry) => total + (entry.cost ?? 0), 0)
  const external = Object.entries(settings.months)
    .filter(([at]) => at < month)
    .reduce(
      (total, [, rows]) =>
        total +
        externalCosts(rows[code]?.externals ?? [], settings.externals, code, settings.hoursPerDay)
          .costs,
      0,
    )
  const logged = costOf(noTimesheetCosts(worklog, timesheet, settings, code, (at) => at < month))
  return internal + external + logged
}

/** The revenue of a month with how it is told: the cells, the quantity and the line of the note. */
type Revenue = {
  revenue: number
  cell: ForecastCell
  quantity: number
  quantityCell: ForecastCell
  quantityIsShare: boolean
  notes: string[]
  gaps: ForecastGap[]
}

const amountCell = (terms: readonly string[], value: number): ForecastCell =>
  terms.length > 0 ? { kind: 'formula', formula: sum(terms), value } : { kind: 'number', value: 0 }

const NO_REVENUE = { revenue: 0, cell: { kind: 'number', value: 0 } } as const
const noShare = (code: string, gap: 'no_budget_costs' | 'no_fee_months'): Revenue => ({
  ...NO_REVENUE,
  quantity: 0,
  quantityCell: { kind: 'empty' },
  quantityIsShare: true,
  notes: [],
  gaps: [{ kind: gap, code }],
})

/** Fixed price: the share of the order the costs so far are of the costs at budget, less the share before. */
function progressRevenue(
  code: string,
  ordered: number | null,
  budgetCosts: number | null,
  before: number,
  monthCosts: number,
  texts: ForecastTexts,
): Revenue {
  if (budgetCosts === null) return noShare(code, 'no_budget_costs')
  const shareBefore = Math.min(WHOLE, before / budgetCosts)
  const share = Math.min(WHOLE, (before + monthCosts) / budgetCosts)
  const revenue = (ordered ?? 0) * (share - shareBefore)
  return {
    revenue,
    cell: {
      kind: 'formula',
      formula: `${cell('ordered')}*(${cell('quantity')}-${literal(shareBefore)})`,
      value: revenue,
    },
    quantity: share,
    quantityCell: {
      kind: 'formula',
      formula: `MIN(${WHOLE},(${literal(before)}+${MONTH_COSTS})/${literal(budgetCosts)})`,
      value: share,
      percent: true,
    },
    quantityIsShare: true,
    notes: [texts.progress(share, shareBefore, budgetCosts)],
    gaps: ordered === null ? [{ kind: 'no_ordered', code }] : [],
  }
}

/** A fee: the order in equal monthly parts, whatever was worked. */
function feeRevenue(
  code: string,
  ordered: number | null,
  months: number | null,
  texts: ForecastTexts,
): Revenue {
  if (months === null) return noShare(code, 'no_fee_months')
  const revenue = (ordered ?? 0) / months
  const share = WHOLE / months
  return {
    revenue,
    cell: { kind: 'formula', formula: `${cell('ordered')}/${months}`, value: revenue },
    quantity: share,
    quantityCell: { kind: 'number', value: share, percent: true },
    quantityIsShare: true,
    notes: [texts.fee(months)],
    gaps: ordered === null ? [{ kind: 'no_ordered', code }] : [],
  }
}

/**
 * The months of timesheets a code needs for a month and nobody read: the month itself and, when
 * the start of the code is known, every month since. `readMonths` null: which months were read
 * cannot be told (the PM keeps the files by hand), so nothing is said to miss.
 */
export function unreadForecastMonths(
  startMonth: string | null,
  month: string,
  readMonths: readonly string[] | null,
): string[] {
  if (readMonths === null) return []
  const read = new Set(readMonths)
  const needed =
    startMonth !== null && startMonth <= month ? forecastMonthsBetween(startMonth, month) : [month]
  return needed.filter((needed) => !read.has(needed))
}

/**
 * The monthly forecast of the project codes of a project: internal costs from the approved
 * timesheet hours, external costs from what the PM declared, revenue by how each code is sold
 * (days at a rate, progress of a fixed price, a monthly fee) unless the PM wrote it, margins as
 * formulas. What has no source is left out and listed as a gap. `readMonths` are the months whose
 * timesheets were read: a month needed and not among them is a gap, never a silent zero.
 */
export function compileForecast(
  projectCodes: readonly string[],
  timesheet: readonly HoursEntry[],
  settings: ForecastSettings,
  month: string,
  texts: ForecastTexts = FORECAST_TEXTS,
  readMonths: readonly string[] | null = null,
  worklog: ForecastWorklog = NO_FORECAST_WORKLOG,
): Forecast {
  const inMonth = timesheet.filter((entry) => entry.day.startsWith(`${month}-`))
  const codes = [...new Set(projectCodes.map(forecastCode))].filter((code) => code !== '').sort()
  const gaps: ForecastGap[] = []
  const inputs = settings.months[month] ?? {}
  const allUnread = new Set<string>()

  const rows = codes.map((code): ForecastRow => {
    const input = inputs[code] ?? NO_ROW_INPUTS
    const project = settings.projects[code] ?? NO_FORECAST_PROJECT
    const people = hoursByPerson(
      inMonth.filter((entry) => entry.approved && entry.project === code),
    )
    const byDays = project.kind === 'time_material' && input.revenue === null
    const costTerms: string[] = []
    const revenueTerms: string[] = []
    const left: string[] = []
    const notes: string[] = []
    let internalCosts = 0
    let daysRevenue = 0
    let days = 0
    let hours = 0

    for (const { person, hours: personHours, cost, hoursWithoutCost } of people) {
      const personDays = personHours / settings.hoursPerDay
      hours += personHours
      days += personDays
      if (hoursWithoutCost > 0) {
        gaps.push({ kind: 'no_cost', code, person, hours: hoursWithoutCost })
        left.push(person)
      }
      if (hoursWithoutCost < personHours) {
        costTerms.push(literal(round(cost, MONEY_DECIMALS)))
        internalCosts += cost
      }
      if (!byDays) continue
      const rate = rateOf(settings.rates, person, code)
      if (rate === null) {
        gaps.push({
          kind: 'no_rate',
          code,
          person,
          hours: personHours,
          proposed: rateElsewhere(settings.rates, person, code),
        })
        continue
      }
      revenueTerms.push(`${literal(personDays)}*${literal(rate.ratePerDay)}`)
      daysRevenue += personDays * rate.ratePerDay
    }
    if (people.length > 0) notes.push(texts.timesheet(hours, round(days, DAYS_DECIMALS)))
    if (left.length > 0) notes.push(texts.left(left))

    const externals = externalCosts(input.externals, settings.externals, code, settings.hoursPerDay)
    for (const external of externals.left) {
      gaps.push({ kind: 'no_external_rate', code, person: external.name, hours: external.hours })
    }
    for (const external of externals.counted) {
      if (byDays) {
        revenueTerms.push(`${literal(external.days)}*${literal(external.ratePerDay)}`)
        daysRevenue += external.days * external.ratePerDay
      }
      notes.push(texts.external(external.name, round(external.days, DAYS_DECIMALS)))
    }
    if (externals.left.length > 0) {
      notes.push(texts.externalLeft(externals.left.map((external) => external.name)))
    }
    days += externals.days
    // Who has no timesheet costs by the hours logged on the tracker: said beside the externals.
    const logged = noTimesheetCosts(worklog, timesheet, settings, code, (at) => at === month)
    for (const person of logged) notes.push(texts.noTimesheet(person.person, person.hours))
    const externalTerms = [
      ...externals.counted.map(
        (external) => `${literal(external.days)}*${literal(external.costPerDay)}`,
      ),
      ...logged.map((person) => `${literal(person.hours)}*${literal(person.costPerHour)}`),
    ]
    const outsideCosts = externals.costs + costOf(logged)
    const monthCosts = internalCosts + outsideCosts

    const daysQuantity = round(days, DAYS_DECIMALS)
    const told: Revenue =
      project.kind === 'fixed_price'
        ? progressRevenue(
            code,
            project.ordered,
            budgetCostsAt(settings, code, month),
            costsBefore(timesheet, settings, code, month, worklog),
            monthCosts,
            texts,
          )
        : project.kind === 'fee'
          ? feeRevenue(code, project.ordered, project.feeMonths, texts)
          : {
              revenue: daysRevenue,
              cell: amountCell(revenueTerms, daysRevenue),
              quantity: daysQuantity,
              quantityCell: { kind: 'number', value: daysQuantity },
              quantityIsShare: false,
              notes: [],
              gaps: [],
            }
    // What the PM wrote replaces the revenue however it is told; the quantity stays.
    const decided = input.revenue !== null
    const revenue = input.revenue ?? told.revenue
    if (decided) notes.push(texts.revenueDecided)
    else {
      notes.push(...told.notes)
      gaps.push(...told.gaps)
    }

    const cells: ForecastRow['cells'] = {
      internalCosts: amountCell(costTerms, internalCosts),
      externalCosts: amountCell(externalTerms, outsideCosts),
      revenue: decided ? { kind: 'number', value: revenue } : told.cell,
      quantity: told.quantityCell,
    }

    const marginMonth = revenue === 0 ? null : (revenue - monthCosts) / revenue
    cells.marginMonth = {
      kind: 'formula',
      formula: `IFERROR((${cell('revenue')}-${cell('internalCosts')}-${cell('externalCosts')})/${cell('revenue')},"")`,
      value: marginMonth,
    }

    let marginEnd: number | null = null
    if (input.totalCosts === null) {
      cells.marginEnd = { kind: 'empty' }
      if (hours > 0 || input.externals.length > 0) gaps.push({ kind: 'no_total_costs', code })
    } else {
      const total = input.totalCostsBeforeMonth
        ? `(${literal(input.totalCosts)}+${MONTH_COSTS})`
        : literal(input.totalCosts)
      const totalValue = input.totalCosts + (input.totalCostsBeforeMonth ? monthCosts : 0)
      marginEnd = project.ordered ? (project.ordered - totalValue) / project.ordered : null
      cells.marginEnd = {
        kind: 'formula',
        formula: `IFERROR((${cell('ordered')}-${total})/${cell('ordered')},"")`,
        value: marginEnd,
      }
    }

    const toInvoice = input.toInvoice ?? 0
    cells.toInvoice = { kind: 'number', value: toInvoice }
    const active =
      people.length > 0 ||
      input.externals.length > 0 ||
      logged.length > 0 ||
      decided ||
      project.kind === 'fee'
    // Only what is sold by the costs so far needs the months before; every code needs its own.
    const since = project.kind === 'fixed_price' ? project.startMonth : null
    const unread = unreadForecastMonths(since, month, readMonths)
    if (unread.length > 0) {
      gaps.push({ kind: 'unread_months', code, months: unread })
      notes.unshift(texts.unread(unread))
      for (const missing of unread) allUnread.add(missing)
    }
    // A month nobody read has no hours on disk: that is not «no activity».
    if (!active && !unread.includes(month)) notes.unshift(texts.noActivity)
    if (input.note !== '') notes.push(input.note)
    const note = notes.join(' · ')
    cells.note = { kind: 'text', value: note }

    return {
      code,
      description: project.description,
      revenueKind: project.kind,
      ordered: project.ordered,
      hours,
      values: {
        internalCosts,
        externalCosts: outsideCosts,
        revenue,
        quantity: told.quantity,
        quantityIsShare: told.quantityIsShare,
        marginMonth,
        marginEnd,
        toInvoice,
      },
      note,
      cells,
    }
  })

  const ofProject = new Set(codes)
  const otherCodes = new Set<string>()
  let notApprovedHours = 0
  for (const entry of inMonth) {
    if (entry.project === null) continue
    if (!ofProject.has(entry.project)) {
      if (entry.approved) otherCodes.add(entry.project)
    } else if (!entry.approved) notApprovedHours += entry.hours
  }
  return {
    month,
    rows,
    gaps,
    notApprovedHours,
    otherCodes: [...otherCodes].sort(),
    unreadMonths: [...allUnread].sort(),
    orphanCodes: Object.keys(inputs)
      .map(forecastCode)
      .filter((code) => !ofProject.has(code))
      .sort(),
  }
}
