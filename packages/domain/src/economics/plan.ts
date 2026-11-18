import type { ForecastSettings } from '../forecast/model.ts'
import { type HoursEntry, personKey } from '../hours/model.ts'

/**
 * The groups of lines of the sheet the administration keeps for a project code: who works on it
 * inside and outside the company, what is bought to be sold, and the other costs of the people.
 */
export const PLAN_GROUPS = [
  'internal',
  'external',
  'product',
  'other_internal',
  'other_external',
] as const
export type PlanGroup = (typeof PLAN_GROUPS)[number]

/** The groups planned in hours: their quantities are also told in days. */
const HOURLY_GROUPS: ReadonlySet<PlanGroup> = new Set(['internal', 'external'])

/** A quantity for each month, `YYYY-MM`: hours for people, units for the rest. */
export type MonthQuantities = Record<string, number>

/** A line of the plan of a project code. */
export type PlanLine = {
  group: PlanGroup
  /** The person as the timesheets write them, the supplier, the product, the kind of cost. */
  name: string
  /** What a unit costs; null: what an hour of the person costs today, when that is known. */
  unitCost: number | null
  /** What a unit is sold for; null: the line earns nothing. */
  unitPrice: number | null
  /** What was planned when the project was sold. */
  budget: MonthQuantities
  /** What is planned now for the months still to come; a month not written is as the budget. */
  forecast: MonthQuantities
  /** What is declared to the client where it differs from what was worked: it prices the revenue. */
  declared: MonthQuantities
}

/** An invoice the PM plans to issue: on which sales order, in which month, for how much. */
export type BillingMilestone = { salesOrder: string; month: string; amount: number }

/** What the sheet says of the project code beyond its figures, as the PM writes it. */
export type SheetRegistry = {
  clientBilling: string
  clientPayment: string
  supplierBilling: string
  supplierPayment: string
  sales: string
  serviceLine: string
  intercompany: string
  offerCode: string
}

export const REGISTRY_FIELDS = [
  'clientBilling',
  'clientPayment',
  'supplierBilling',
  'supplierPayment',
  'sales',
  'serviceLine',
  'intercompany',
  'offerCode',
] as const satisfies ReadonlyArray<keyof SheetRegistry>

export const NO_SHEET_REGISTRY: SheetRegistry = {
  clientBilling: '',
  clientPayment: '',
  supplierBilling: '',
  supplierPayment: '',
  sales: '',
  serviceLine: '',
  intercompany: '',
  offerCode: '',
}

/** The plan of a project code: its budget, how it is planned now, what is to be invoiced. */
export type SheetPlan = {
  lines: PlanLine[]
  /** The day the budget was confirmed, `YYYY-MM-DD`: from then its costs do not follow today's. */
  confirmedOn: string | null
  milestones: BillingMilestone[]
  /** The share of the work done the PM declares at the end of a month, between 0 and 1. */
  declaredProgress: Record<string, number>
  registry: SheetRegistry
}

/** The plans of the project codes of a project, by code. */
export type SheetPlans = Record<string, SheetPlan>

export const NO_SHEET_PLAN: SheetPlan = {
  lines: [],
  confirmedOn: null,
  milestones: [],
  declaredProgress: {},
  registry: NO_SHEET_REGISTRY,
}

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/
const DAY = /^\d{4}-\d{2}-\d{2}$/
const WHOLE = 1
const MAX_TEXT = 200

const positive = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0
const amountOrNull = (value: number | null): number | null =>
  value !== null && Number.isFinite(value) && value >= 0 ? value : null

function cleanQuantities(quantities: MonthQuantities): MonthQuantities {
  return Object.fromEntries(
    Object.entries(quantities)
      .filter(([month, quantity]) => MONTH.test(month) && positive(quantity))
      .sort(([a], [b]) => a.localeCompare(b)),
  )
}

/** A declared quantity may be zero: nothing declared of what was worked is a thing to say. */
function cleanDeclared(quantities: MonthQuantities): MonthQuantities {
  return Object.fromEntries(
    Object.entries(quantities)
      .filter(
        ([month, quantity]) => MONTH.test(month) && Number.isFinite(quantity) && quantity >= 0,
      )
      .sort(([a], [b]) => a.localeCompare(b)),
  )
}

const lineKey = (line: Pick<PlanLine, 'group' | 'name'>): string =>
  `${line.group} ${line.group === 'internal' ? personKey(line.name) : line.name.toLowerCase()}`

function cleanPlan(plan: SheetPlan): SheetPlan {
  const seen = new Set<string>()
  const lines = plan.lines
    .map((line) => ({ ...line, name: line.name.trim().slice(0, MAX_TEXT) }))
    .filter((line) => {
      // A line with no name is nobody's; the same name twice in a group is one line, the first.
      if (line.name === '' || seen.has(lineKey(line))) return false
      seen.add(lineKey(line))
      return true
    })
    .map((line) => ({
      group: line.group,
      name: line.name,
      unitCost: amountOrNull(line.unitCost),
      unitPrice: amountOrNull(line.unitPrice),
      budget: cleanQuantities(line.budget),
      forecast: cleanDeclared(line.forecast),
      declared: cleanDeclared(line.declared),
    }))
  const registry = Object.fromEntries(
    REGISTRY_FIELDS.map((field) => [field, (plan.registry[field] ?? '').trim().slice(0, MAX_TEXT)]),
  ) as SheetRegistry
  return {
    lines,
    confirmedOn: plan.confirmedOn !== null && DAY.test(plan.confirmedOn) ? plan.confirmedOn : null,
    milestones: plan.milestones
      .map((milestone) => ({ ...milestone, salesOrder: milestone.salesOrder.trim() }))
      .filter((milestone) => MONTH.test(milestone.month) && positive(milestone.amount))
      .sort((a, b) => a.month.localeCompare(b.month) || a.salesOrder.localeCompare(b.salesOrder)),
    declaredProgress: Object.fromEntries(
      Object.entries(plan.declaredProgress)
        .filter(([month, share]) => MONTH.test(month) && positive(share) && share <= WHOLE)
        .sort(([a], [b]) => a.localeCompare(b)),
    ),
    registry,
  }
}

const emptyPlan = (plan: SheetPlan): boolean =>
  plan.lines.length === 0 &&
  plan.milestones.length === 0 &&
  Object.keys(plan.declaredProgress).length === 0 &&
  REGISTRY_FIELDS.every((field) => plan.registry[field] === '')

/** The plans as the PM typed them, made tidy: a plan that says nothing is not kept. */
export function cleanSheetPlans(plans: SheetPlans): SheetPlans {
  return Object.fromEntries(
    Object.entries(plans)
      .map(([code, plan]): [string, SheetPlan] => [code.trim().toUpperCase(), cleanPlan(plan)])
      .filter(([code, plan]) => code !== '' && !emptyPlan(plan))
      .sort(([a], [b]) => a.localeCompare(b)),
  )
}

/** The money of a month, or of more: what is earned, what it costs by kind, the days worked. */
export type PlanMoney = {
  revenue: number
  /** People of the company and their other costs. */
  internalCosts: number
  /** Suppliers and their other costs. */
  externalCosts: number
  productCosts: number
  costs: number
  internalDays: number
  externalDays: number
}

const NO_MONEY: PlanMoney = {
  revenue: 0,
  internalCosts: 0,
  externalCosts: 0,
  productCosts: 0,
  costs: 0,
  internalDays: 0,
  externalDays: 0,
}

const COST_OF_GROUP: Readonly<
  Record<PlanGroup, 'internalCosts' | 'externalCosts' | 'productCosts'>
> = {
  internal: 'internalCosts',
  other_internal: 'internalCosts',
  external: 'externalCosts',
  other_external: 'externalCosts',
  product: 'productCosts',
}

function add(money: PlanMoney, more: PlanMoney): PlanMoney {
  return {
    revenue: money.revenue + more.revenue,
    internalCosts: money.internalCosts + more.internalCosts,
    externalCosts: money.externalCosts + more.externalCosts,
    productCosts: money.productCosts + more.productCosts,
    costs: money.costs + more.costs,
    internalDays: money.internalDays + more.internalDays,
    externalDays: money.externalDays + more.externalDays,
  }
}

/** What a quantity of a line is worth: `sold` is the quantity the client pays, when it differs. */
function moneyOf(
  line: Pick<PlanLine, 'group'>,
  quantity: number,
  sold: number,
  unitCost: number,
  unitPrice: number,
  hoursPerDay: number,
): PlanMoney {
  const cost = quantity * unitCost
  const days = HOURLY_GROUPS.has(line.group) ? quantity / hoursPerDay : 0
  return {
    ...NO_MONEY,
    revenue: sold * unitPrice,
    [COST_OF_GROUP[line.group]]: cost,
    costs: cost,
    internalDays: line.group === 'internal' ? days : 0,
    externalDays: line.group === 'external' ? days : 0,
  }
}

/** A line of the plan as it stands in a month that runs: what was planned and what is. */
export type PlanViewLine = {
  group: PlanGroup
  name: string
  /** The cost of a unit in use: the one written, else what an hour of the person costs today. */
  unitCost: number | null
  unitPrice: number | null
  budget: MonthQuantities
  /** The timesheet up to the month that runs for a person of the company, the plan beyond. */
  current: MonthQuantities
  declared: MonthQuantities
  /** True for who has hours in the timesheets and no line in the plan. */
  unplanned: boolean
}

/** The margin of an amount of money over its revenue; null with no revenue. */
export const planMargin = (money: PlanMoney): number | null =>
  money.revenue === 0 ? null : (money.revenue - money.costs) / money.revenue

/** The plan of a project code read against what happened, as the sheet of the administration. */
export type PlanView = {
  /** The last month that is a fact: what comes after is planned. */
  through: string
  /** Every month the plan or the timesheets touch, in order. */
  months: string[]
  lines: PlanViewLine[]
  budget: Record<string, PlanMoney>
  current: Record<string, PlanMoney>
  totals: {
    budget: PlanMoney
    /** Up to the month that runs. */
    actual: PlanMoney
    /** The months still to come. */
    forecast: PlanMoney
    atEnd: PlanMoney
  }
  /** The share of the budget revenue planned by the end of each month. */
  plannedProgress: Record<string, number>
  /** The share done at the end of each month: declared, else costs so far over all the costs. */
  progress: Record<string, number>
  /** Lines with a quantity and no cost of a unit: their cost is not in the figures. */
  withoutCost: string[]
  confirmedOn: string | null
}

const MONTH_LENGTH = 7
const sumOf = (months: Record<string, PlanMoney>, keep: (month: string) => boolean): PlanMoney =>
  Object.entries(months)
    .filter(([month]) => keep(month))
    .reduce((total, [, money]) => add(total, money), NO_MONEY)

/** What stands for a line that writes no cost or no price of its own; null where nothing does. */
export type PlanStanding = {
  cost: (line: Pick<PlanLine, 'group' | 'name'>) => number | null
  price: (line: Pick<PlanLine, 'group' | 'name'>) => number | null
}
const NO_STANDING: PlanStanding = { cost: () => null, price: () => null }

/** The approved hours of each person on a code, month by month, by the key of the person. */
function workedHours(
  timesheet: readonly HoursEntry[],
  code: string,
  through: string,
): Map<string, { person: string; months: MonthQuantities }> {
  const people = new Map<string, { person: string; months: MonthQuantities }>()
  for (const entry of timesheet) {
    const month = entry.day.slice(0, MONTH_LENGTH)
    if (!entry.approved || entry.project !== code || month > through) continue
    const key = personKey(entry.person)
    const known = people.get(key) ?? { person: entry.person, months: {} }
    known.months[month] = (known.months[month] ?? 0) + entry.hours
    people.set(key, known)
  }
  return people
}

/**
 * The plan of a project code read as the sheet of the administration reads it. The budget is
 * what was planned. What is, month by month: for a person of the company the approved hours of
 * the timesheets up to the month that runs, the plan beyond; for every other line the plan. A
 * person with hours and no line is a line of their own, said to be unplanned. Revenue is the
 * quantity, or the one declared to the client, at the price of the line; costs at its cost.
 */
export function planView(
  plan: SheetPlan,
  code: string,
  timesheet: readonly HoursEntry[],
  /** What an hour of each person costs today, by the key of the person. */
  costsOfAnHour: ReadonlyMap<string, number>,
  through: string,
  hoursPerDay: number,
  /**
   * What stands where a line writes no cost or no price of its own: what was written elsewhere
   * before the plan existed. Null where nothing was.
   */
  standing: PlanStanding = NO_STANDING,
): PlanView {
  const worked = workedHours(timesheet, code, through)
  const planned = new Set(
    plan.lines.filter((line) => line.group === 'internal').map((line) => personKey(line.name)),
  )
  const unplanned: PlanLine[] = [...worked.entries()]
    .filter(([key]) => !planned.has(key))
    .map(([, { person }]) => ({
      group: 'internal' as const,
      name: person,
      unitCost: null,
      unitPrice: null,
      budget: {},
      forecast: {},
      declared: {},
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'it'))

  const lines: PlanViewLine[] = [...plan.lines, ...unplanned].map((line, index) => {
    const key = personKey(line.name)
    const hours = line.group === 'internal' ? (worked.get(key)?.months ?? {}) : null
    const months = new Set([
      ...Object.keys(line.budget),
      ...Object.keys(line.forecast),
      ...Object.keys(hours ?? {}),
    ])
    const current: MonthQuantities = {}
    for (const month of [...months].sort()) {
      const plannedNow = line.forecast[month] ?? line.budget[month] ?? 0
      // The timesheets tell the months that are a fact; every other line is as it is planned.
      const quantity = hours !== null && month <= through ? (hours[month] ?? 0) : plannedNow
      if (quantity > 0) current[month] = quantity
    }
    const unitCost =
      line.unitCost ??
      (line.group === 'internal' ? (costsOfAnHour.get(key) ?? null) : standing.cost(line))
    return {
      group: line.group,
      name: line.name,
      unitCost,
      unitPrice: line.unitPrice ?? standing.price(line),
      budget: line.budget,
      current,
      declared: line.declared,
      unplanned: index >= plan.lines.length,
    }
  })

  const budget: Record<string, PlanMoney> = {}
  const current: Record<string, PlanMoney> = {}
  const withoutCost: string[] = []
  for (const line of lines) {
    const [cost, price] = [line.unitCost ?? 0, line.unitPrice ?? 0]
    const priced = (quantity: number, sold: number): PlanMoney =>
      moneyOf(line, quantity, sold, cost, price, hoursPerDay)
    for (const [month, quantity] of Object.entries(line.budget)) {
      budget[month] = add(budget[month] ?? NO_MONEY, priced(quantity, quantity))
    }
    for (const [month, quantity] of Object.entries(line.current)) {
      const sold = month <= through ? (line.declared[month] ?? quantity) : quantity
      current[month] = add(current[month] ?? NO_MONEY, priced(quantity, sold))
    }
    const used = Object.keys(line.budget).length + Object.keys(line.current).length > 0
    if (line.unitCost === null && used) withoutCost.push(line.name)
  }

  const months = [...new Set([...Object.keys(budget), ...Object.keys(current)])].sort()
  const totals = {
    budget: sumOf(budget, () => true),
    actual: sumOf(current, (month) => month <= through),
    forecast: sumOf(current, (month) => month > through),
    atEnd: sumOf(current, () => true),
  }
  const plannedProgress: Record<string, number> = {}
  const progress: Record<string, number> = {}
  let [plannedRevenue, costsSoFar] = [0, 0]
  for (const month of months) {
    plannedRevenue += budget[month]?.revenue ?? 0
    costsSoFar += current[month]?.costs ?? 0
    if (totals.budget.revenue > 0) {
      plannedProgress[month] = Math.min(WHOLE, plannedRevenue / totals.budget.revenue)
    }
    const declared = plan.declaredProgress[month]
    if (declared !== undefined) progress[month] = declared
    else if (totals.atEnd.costs > 0)
      progress[month] = Math.min(WHOLE, costsSoFar / totals.atEnd.costs)
  }
  return {
    through,
    months,
    lines,
    budget,
    current,
    totals,
    plannedProgress,
    progress,
    withoutCost,
    confirmedOn: plan.confirmedOn,
  }
}

/**
 * The budget with the cost of a unit written on every line that follows today's: what confirming
 * a budget does, so that a cost that changes afterwards does not change what was planned.
 */
export function confirmedPlan(
  plan: SheetPlan,
  costsOfAnHour: ReadonlyMap<string, number>,
  day: string,
): SheetPlan {
  return {
    ...plan,
    confirmedOn: day,
    lines: plan.lines.map((line) => ({
      ...line,
      unitCost:
        line.unitCost ??
        (line.group === 'internal' ? (costsOfAnHour.get(personKey(line.name)) ?? null) : null),
    })),
  }
}

/** A line of the long table the administration gathers the sheets with. */
export type SheetDataRow = {
  group: string
  item: string
  /** By month, `YYYY-MM`. */
  months: MonthQuantities
  cost: number
  revenue: number
}

const DATA_GROUPS = { budget: 'BUDGET', current: 'ACTUAL-FORECAST' } as const

/**
 * The plan as rows of a long table: for the budget and for what is, the revenue and the costs by
 * kind month by month, with their totals. What the sheet of the administration calls its data.
 */
export function sheetDataRows(view: PlanView): SheetDataRow[] {
  const items: Array<[string, (money: PlanMoney) => number]> = [
    ['Ricavi', (money) => money.revenue],
    ['Costi interni', (money) => money.internalCosts],
    ['Costi esterni', (money) => money.externalCosts],
    ['Prodotti', (money) => money.productCosts],
    ['GG interne', (money) => money.internalDays],
    ['GG esterne', (money) => money.externalDays],
  ]
  return (['budget', 'current'] as const).flatMap((part) => {
    const total = part === 'budget' ? view.totals.budget : view.totals.atEnd
    return items.map(([item, of]) => ({
      group: DATA_GROUPS[part],
      item,
      months: Object.fromEntries(
        Object.entries(view[part]).map(([month, money]) => [month, of(money)]),
      ),
      cost: item.startsWith('Costi') || item === 'Prodotti' ? of(total) : 0,
      revenue: item === 'Ricavi' ? of(total) : 0,
    }))
  })
}

/** Who and what a plan may start from: read or set elsewhere, never invented. */
export type PlanSources = {
  /** The people with hours on the code, as the timesheets write them. */
  people: readonly string[]
  /** What an hour of a person is sold for, when a rate was written; null else. */
  priceOfAnHour: (person: string) => number | null
  /** Who works on the code from outside, with what an hour costs and is sold for. */
  externals: ReadonlyArray<{ name: string; unitCost: number | null; unitPrice: number | null }>
}

/**
 * A plan with a line for everybody the sources know and the plan does not: a start the PM
 * changes at will. No quantity is proposed: how much each one works is the PM's to say.
 */
export function proposedPlan(plan: SheetPlan, sources: PlanSources): SheetPlan {
  const known = new Set(plan.lines.map(lineKey))
  const blank = { budget: {}, forecast: {}, declared: {} }
  const proposed: PlanLine[] = [
    ...[...sources.people]
      .sort((a, b) => a.localeCompare(b, 'it'))
      .map((name) => ({
        group: 'internal' as const,
        name,
        unitCost: null,
        unitPrice: sources.priceOfAnHour(name),
        ...blank,
      })),
    ...sources.externals.map((external) => ({ group: 'external' as const, ...external, ...blank })),
  ]
  const added: PlanLine[] = []
  for (const line of proposed) {
    if (line.name.trim() === '' || known.has(lineKey(line))) continue
    known.add(lineKey(line))
    added.push(line)
  }
  return { ...plan, lines: [...plan.lines, ...added] }
}

const DATA_HEADINGS = [
  'ProjectID',
  'Anno',
  'Periodo Riferimento',
  'Gruppo',
  'Item',
  'Anno Prec.',
  'Gennaio',
  'Febbraio',
  'Marzo',
  'Aprile',
  'Maggio',
  'Giugno',
  'Luglio',
  'Agosto',
  'Settembre',
  'Ottobre',
  'Novembre',
  'Dicembre',
  'Anno Succ.',
  'Costo',
  'Ricavo',
]
const MONTHS_IN_YEAR = 12
const YEAR_LENGTH = 4
const DATA_DECIMALS = 2
/** A number as a spreadsheet set to Italian reads it: a comma before the decimals. */
const dataNumber = (value: number): string => value.toFixed(DATA_DECIMALS).replace('.', ',')

/**
 * The long table of a project code as a file a spreadsheet opens: one row for each figure of
 * the budget and of what is, with the year before, the twelve months of the year of the month
 * that runs and the year after, as the sheets of the administration are gathered.
 */
export function sheetDataCsv(code: string, view: PlanView): string {
  const year = view.through.slice(0, YEAR_LENGTH)
  const rows = sheetDataRows(view).map((row) => {
    const inYear = Array.from({ length: MONTHS_IN_YEAR }, (_, index) => {
      const month = `${year}-${String(index + 1).padStart(2, '0')}`
      return row.months[month] ?? 0
    })
    const outside = (keep: (rowYear: string) => boolean): number =>
      Object.entries(row.months)
        .filter(([month]) => keep(month.slice(0, YEAR_LENGTH)))
        .reduce((total, [, value]) => total + value, 0)
    return [
      code,
      year,
      view.through,
      row.group,
      row.item,
      dataNumber(outside((rowYear) => rowYear < year)),
      ...inYear.map(dataNumber),
      dataNumber(outside((rowYear) => rowYear > year)),
      dataNumber(row.cost),
      dataNumber(row.revenue),
    ].join(';')
  })
  return `${[DATA_HEADINGS.join(';'), ...rows].join('\n')}\n`
}

const sameName = (a: string, b: string): boolean =>
  a.trim().toLowerCase() === b.trim().toLowerCase()

/**
 * The settings of the monthly forecast as the plans of the project codes change them: what a
 * line of a plan says an hour is sold for, or costs, is what the forecast of that code uses,
 * whatever was written in the settings before. What no plan says stays as it was.
 */
export function settingsWithPlans(settings: ForecastSettings, plans: SheetPlans): ForecastSettings {
  let { rates, externals, hourlyCosts } = settings
  const perDay = (perHour: number): number => perHour * settings.hoursPerDay
  for (const [code, plan] of Object.entries(plans)) {
    for (const line of plan.lines) {
      if (line.group === 'internal' && line.unitPrice !== null) {
        const key = personKey(line.name)
        rates = [
          ...rates.filter((rate) => rate.code !== code || personKey(rate.person) !== key),
          { person: line.name, code, ratePerDay: perDay(line.unitPrice) },
        ]
      }
      if (line.group !== 'external' || (line.unitCost === null && line.unitPrice === null)) continue
      const known = externals.find(
        (external) => external.code === code && sameName(external.name, line.name),
      )
      externals = [
        ...externals.filter((external) => external !== known),
        {
          name: line.name,
          code,
          costPerDay: line.unitCost === null ? (known?.costPerDay ?? 0) : perDay(line.unitCost),
          ratePerDay: line.unitPrice === null ? (known?.ratePerDay ?? 0) : perDay(line.unitPrice),
        },
      ]
      if (line.unitCost !== null) {
        const key = personKey(line.name)
        hourlyCosts = [
          ...hourlyCosts.filter((cost) => personKey(cost.person) !== key),
          { person: line.name, costPerHour: line.unitCost },
        ]
      }
    }
  }
  return { ...settings, rates, externals, hourlyCosts }
}

/**
 * What the settings of the monthly forecast say of a code where its plan says nothing: the rate
 * of a person, the cost and the rate of who works from outside, each by the hour.
 */
export function standingOf(settings: ForecastSettings, code: string): PlanStanding {
  const perHour = (perDay: number): number | null =>
    perDay > 0 ? perDay / settings.hoursPerDay : null
  const external = (name: string) =>
    settings.externals.find((entry) => entry.code === code && sameName(entry.name, name))
  return {
    cost: (line) =>
      line.group === 'external' ? perHour(external(line.name)?.costPerDay ?? 0) : null,
    price: (line) => {
      if (line.group === 'external') return perHour(external(line.name)?.ratePerDay ?? 0)
      if (line.group !== 'internal') return null
      const key = personKey(line.name)
      const rate =
        settings.rates.find((entry) => entry.code === code && personKey(entry.person) === key) ??
        settings.rates.find((entry) => entry.code === null && personKey(entry.person) === key)
      return rate === undefined ? null : perHour(rate.ratePerDay)
    },
  }
}
