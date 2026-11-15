import { type HoursEntry, personKey } from '../hours/model.ts'
import {
  type ForecastColumn,
  type ForecastModel,
  type ForecastRate,
  type ForecastSettings,
  NO_ROW_INPUTS,
} from './model.ts'

/** What goes in a cell of the model. A formula carries the value it gives, so any reader shows it. */
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
  | { kind: 'no_rate'; code: string; person: string; hours: number }
  | { kind: 'no_external_rate'; code: string; person: string; hours: number }
  | { kind: 'no_total_costs'; code: string }
  | { kind: 'no_ordered'; code: string }

export type ForecastRow = {
  number: number
  code: string
  description: string
  ordered: number | null
  hours: number
  values: ForecastValues
  note: string
  /** What is written, by column; the code and the ordered amount stay the model's. */
  cells: Partial<Record<ForecastColumn, ForecastCell>>
}

export type Forecast = {
  month: string
  rows: ForecastRow[]
  gaps: ForecastGap[]
  /** Hours of the month on the codes of the model that are not approved yet: left out. */
  notApprovedHours: number
  /** Codes with approved hours in the month that the model does not list. */
  otherCodes: string[]
}

export type ForecastTexts = {
  noActivity: string
  timesheet: (hours: number, days: number) => string
  external: (name: string, days: number) => string
  progress: (share: number, budgetCosts: number) => string
  revenueDecided: string
  left: (people: string[]) => string
  externalLeft: (people: string[]) => string
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
  progress: (share, budgetCosts) =>
    `avanzamento ${italian(share * 100, 2)}% = costi del mese / costi a budget ${italian(budgetCosts, 2)}`,
  revenueDecided: 'ricavi indicati dal PM',
  left: (people) => `ore senza costo nei timesheet, fuori dai costi: ${people.join(', ')}`,
}

const DAYS_DECIMALS = 3
const MONEY_DECIMALS = 2
const round = (value: number, decimals: number): number => Number(value.toFixed(decimals))

/** A number as a formula writes it: a point for the decimals, no needless zeros. */
const literal = (value: number): string => String(round(value, 6))

const sum = (terms: readonly string[]): string => terms.join('+')

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

/**
 * Fills the monthly forecast: for each project code of the model, internal costs and revenue from
 * the approved timesheet hours and the rates, external costs from what the PM declared, margins as
 * formulas of the sheet. What has no source is left empty and listed as a gap.
 */
export function compileForecast(
  model: ForecastModel,
  timesheet: readonly HoursEntry[],
  settings: ForecastSettings,
  month: string,
  texts: ForecastTexts = FORECAST_TEXTS,
): Forecast {
  const inMonth = timesheet.filter((entry) => entry.day.startsWith(`${month}-`))
  const codes = new Set(model.rows.map((row) => row.code))
  const gaps: ForecastGap[] = []
  const inputs = settings.months[month] ?? {}

  const rows = model.rows.map((line): ForecastRow => {
    const input = inputs[line.code] ?? NO_ROW_INPUTS
    const ref = (column: ForecastColumn): string => `${model.columns[column]}${line.number}`
    const people = hoursByPerson(
      inMonth.filter((entry) => entry.approved && entry.project === line.code),
    )
    const sold = input.budgetCosts === null && input.revenue === null
    const costTerms: string[] = []
    const revenueTerms: string[] = []
    const left: string[] = []
    const notes: string[] = []
    let internalCosts = 0
    let revenue = 0
    let days = 0
    let hours = 0

    for (const { person, hours: personHours, cost, hoursWithoutCost } of people) {
      const personDays = personHours / settings.hoursPerDay
      hours += personHours
      days += personDays
      if (hoursWithoutCost > 0) {
        gaps.push({ kind: 'no_cost', code: line.code, person, hours: hoursWithoutCost })
        left.push(person)
      }
      if (hoursWithoutCost < personHours) {
        costTerms.push(literal(round(cost, MONEY_DECIMALS)))
        internalCosts += cost
      }
      if (!sold) continue
      const rate = rateOf(settings.rates, person, line.code)
      if (rate === null) {
        gaps.push({ kind: 'no_rate', code: line.code, person, hours: personHours })
        continue
      }
      revenueTerms.push(`${literal(personDays)}*${literal(rate.ratePerDay)}`)
      revenue += personDays * rate.ratePerDay
    }
    if (people.length > 0) notes.push(texts.timesheet(hours, round(days, DAYS_DECIMALS)))
    if (left.length > 0) notes.push(texts.left(left))

    const externalTerms: string[] = []
    const externalLeft: string[] = []
    let externalCosts = 0
    for (const external of input.externals) {
      const rate = ofPerson(
        settings.externals.filter((candidate) => candidate.code === line.code),
        (candidate) => candidate.name,
        external.name,
      )
      if (rate === null) {
        gaps.push({
          kind: 'no_external_rate',
          code: line.code,
          person: external.name,
          hours: external.hours,
        })
        externalLeft.push(external.name)
        continue
      }
      const externalDays = external.hours / settings.hoursPerDay
      externalTerms.push(`${literal(externalDays)}*${literal(rate.costPerDay)}`)
      externalCosts += externalDays * rate.costPerDay
      days += externalDays
      if (sold) {
        revenueTerms.push(`${literal(externalDays)}*${literal(rate.ratePerDay)}`)
        revenue += externalDays * rate.ratePerDay
      }
      notes.push(texts.external(external.name, round(externalDays, DAYS_DECIMALS)))
    }
    if (externalLeft.length > 0) notes.push(texts.externalLeft(externalLeft))

    const amountCell = (terms: readonly string[], value: number): ForecastCell =>
      terms.length > 0
        ? { kind: 'formula', formula: sum(terms), value }
        : { kind: 'number', value: 0 }
    const cells: ForecastRow['cells'] = {
      internalCosts: amountCell(costTerms, internalCosts),
      externalCosts: amountCell(externalTerms, externalCosts),
    }
    const costs = `${ref('internalCosts')}+${ref('externalCosts')}`
    const monthCosts = internalCosts + externalCosts

    let quantity = round(days, DAYS_DECIMALS)
    if (input.revenue !== null) {
      revenue = input.revenue
      cells.revenue = { kind: 'number', value: revenue }
      notes.push(texts.revenueDecided)
    } else if (input.budgetCosts !== null) {
      quantity = monthCosts / input.budgetCosts
      revenue = (line.ordered ?? 0) * quantity
      if (line.ordered === null) gaps.push({ kind: 'no_ordered', code: line.code })
      cells.revenue = {
        kind: 'formula',
        formula: `${ref('ordered')}*${ref('quantity')}`,
        value: revenue,
      }
      notes.push(texts.progress(quantity, input.budgetCosts))
    } else {
      cells.revenue = amountCell(revenueTerms, revenue)
    }
    const share = input.budgetCosts !== null
    cells.quantity = share
      ? {
          kind: 'formula',
          formula: `(${costs})/${literal(input.budgetCosts ?? 1)}`,
          value: quantity,
          percent: true,
        }
      : { kind: 'number', value: quantity }

    const marginMonth = revenue === 0 ? null : (revenue - monthCosts) / revenue
    cells.marginMonth = {
      kind: 'formula',
      formula: `IFERROR((${ref('revenue')}-${ref('internalCosts')}-${ref('externalCosts')})/${ref('revenue')},"")`,
      value: marginMonth,
    }

    let marginEnd: number | null = null
    if (input.totalCosts === null) {
      cells.marginEnd = { kind: 'empty' }
      if (hours > 0 || input.externals.length > 0)
        gaps.push({ kind: 'no_total_costs', code: line.code })
    } else {
      const total = input.totalCostsBeforeMonth
        ? `(${literal(input.totalCosts)}+${costs})`
        : literal(input.totalCosts)
      const totalValue = input.totalCosts + (input.totalCostsBeforeMonth ? monthCosts : 0)
      marginEnd = line.ordered ? (line.ordered - totalValue) / line.ordered : null
      cells.marginEnd = {
        kind: 'formula',
        formula: `IFERROR((${ref('ordered')}-${total})/${ref('ordered')},"")`,
        value: marginEnd,
      }
    }

    const toInvoice = input.toInvoice ?? 0
    cells.toInvoice = { kind: 'number', value: toInvoice }
    const active = people.length > 0 || input.externals.length > 0 || input.revenue !== null
    if (!active) notes.unshift(texts.noActivity)
    if (input.note !== '') notes.push(input.note)
    const note = notes.join(' · ')
    cells.note = { kind: 'text', value: note }

    return {
      number: line.number,
      code: line.code,
      description: line.description,
      ordered: line.ordered,
      hours,
      values: {
        internalCosts,
        externalCosts,
        revenue,
        quantity,
        quantityIsShare: share,
        marginMonth,
        marginEnd,
        toInvoice,
      },
      note,
      cells,
    }
  })

  const otherCodes = new Set<string>()
  let notApprovedHours = 0
  for (const entry of inMonth) {
    if (entry.project === null) continue
    if (!codes.has(entry.project)) {
      if (entry.approved) otherCodes.add(entry.project)
    } else if (!entry.approved) notApprovedHours += entry.hours
  }
  return { month, rows, gaps, notApprovedHours, otherCodes: [...otherCodes].sort() }
}
