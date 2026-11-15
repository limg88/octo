import { personKey } from '../hours/model.ts'

/**
 * What a day of a person is sold for. With a project code it holds on that code only; without,
 * wherever the person has no rate of their own for the code.
 */
export type ForecastRate = {
  person: string
  code: string | null
  ratePerDay: number
}

/** Someone with no timesheet here: what a day costs and is sold for on a project code. */
export type ForecastExternalRate = {
  name: string
  code: string
  costPerDay: number
  ratePerDay: number
}

/** The hours an external worked on a project code in a month, as they declared them. */
export type ForecastExternal = {
  name: string
  hours: number
}

/** What the PM adds for a project code in a month: what no timesheet can tell. */
export type ForecastRowInputs = {
  externals: ForecastExternal[]
  /** What is asked to the client in the month; null: nothing. */
  toInvoice: number | null
  /** Revenue decided by the PM: it replaces the computed one. */
  revenue: number | null
  /** Fixed price: the costs of the whole project at budget; progress is costs over this. */
  budgetCosts: number | null
  /** The costs expected for the whole project, for the margin at its end. */
  totalCosts: number | null
  /** True when `totalCosts` stops at the month before: the costs of the month are added. */
  totalCostsBeforeMonth: boolean
  note: string
}

/** How a PM fills the monthly forecast the administration asks for. */
export type ForecastSettings = {
  /** The spreadsheet of the administration, inside the project folder. */
  modelPath: string
  hoursPerDay: number
  rates: ForecastRate[]
  externals: ForecastExternalRate[]
  /** Month (`YYYY-MM`), then project code. */
  months: Record<string, Record<string, ForecastRowInputs>>
}

export const DEFAULT_HOURS_PER_DAY = 8

export const DEFAULT_FORECAST_SETTINGS: ForecastSettings = {
  modelPath: '',
  hoursPerDay: DEFAULT_HOURS_PER_DAY,
  rates: [],
  externals: [],
  months: {},
}

export const NO_ROW_INPUTS: ForecastRowInputs = {
  externals: [],
  toInvoice: null,
  revenue: null,
  budgetCosts: null,
  totalCosts: null,
  totalCostsBeforeMonth: false,
  note: '',
}

export const FORECAST_MONTH = /^\d{4}-(0[1-9]|1[0-2])$/
const MAX_HOURS_PER_DAY = 24

const amount = (value: number | null): number | null =>
  value !== null && Number.isFinite(value) && value >= 0 ? value : null

const positive = (value: number): boolean => Number.isFinite(value) && value > 0

function cleanRow(row: ForecastRowInputs): ForecastRowInputs {
  const budgetCosts = amount(row.budgetCosts)
  return {
    externals: row.externals
      .map((external) => ({ ...external, name: external.name.trim() }))
      .filter((external) => external.name !== '' && positive(external.hours)),
    toInvoice: amount(row.toInvoice),
    revenue: amount(row.revenue),
    budgetCosts: budgetCosts === 0 ? null : budgetCosts,
    totalCosts: amount(row.totalCosts),
    totalCostsBeforeMonth: row.totalCostsBeforeMonth,
    note: row.note.trim(),
  }
}

const isEmptyRow = (row: ForecastRowInputs): boolean =>
  row.externals.length === 0 &&
  row.toInvoice === null &&
  row.revenue === null &&
  row.budgetCosts === null &&
  row.totalCosts === null &&
  row.note === ''

/** Settings as the PM typed them, made tidy: one rate per person and code, no empty month or row. */
export function cleanForecastSettings(settings: ForecastSettings): ForecastSettings {
  const rates = new Map<string, ForecastRate>()
  for (const rate of settings.rates) {
    const person = personKey(rate.person)
    const code = rate.code?.trim().toUpperCase() || null
    if (person === '' || amount(rate.ratePerDay) === null) continue
    rates.set(`${person}|${code ?? ''}`, {
      person: rate.person.trim(),
      code,
      ratePerDay: rate.ratePerDay,
    })
  }
  const externals = new Map<string, ForecastExternalRate>()
  for (const external of settings.externals) {
    const name = personKey(external.name)
    const code = external.code.trim().toUpperCase()
    const valid = amount(external.costPerDay) !== null && amount(external.ratePerDay) !== null
    if (name === '' || code === '' || !valid) continue
    externals.set(`${name}|${code}`, { ...external, name: external.name.trim(), code })
  }
  const months: ForecastSettings['months'] = {}
  for (const [month, rows] of Object.entries(settings.months)) {
    if (!FORECAST_MONTH.test(month)) continue
    const kept = Object.entries(rows)
      .map(([code, row]) => [code.trim(), cleanRow(row)] as const)
      .filter(([code, row]) => code !== '' && !isEmptyRow(row))
    if (kept.length > 0) months[month] = Object.fromEntries(kept)
  }
  const hours = settings.hoursPerDay
  return {
    modelPath: settings.modelPath.trim(),
    hoursPerDay: positive(hours) && hours <= MAX_HOURS_PER_DAY ? hours : DEFAULT_HOURS_PER_DAY,
    rates: [...rates.values()],
    externals: [...externals.values()],
    months,
  }
}

/** A cell of a sheet as it reads: where it is and what it shows. */
export type SheetCell = { ref: string; text: string }
export type SheetRow = { number: number; cells: SheetCell[] }
export type SheetGrid = { rows: SheetRow[] }

export const FORECAST_COLUMNS = [
  'code',
  'ordered',
  'internalCosts',
  'externalCosts',
  'revenue',
  'quantity',
  'marginMonth',
  'marginEnd',
  'toInvoice',
  'note',
] as const
export type ForecastColumn = (typeof FORECAST_COLUMNS)[number]

/** A line of the model: one project code the PM answers for. */
export type ForecastModelRow = {
  number: number
  code: string
  description: string
  ordered: number | null
}

export type ForecastModel = {
  /** The column letter of each thing the model asks. */
  columns: Record<ForecastColumn, string>
  rows: ForecastModelRow[]
}

/**
 * How the headings of the model start, whatever month they name. The margin of the month and the
 * margin at the end of the project start alike: the second one is told by its own word.
 */
const HEADINGS: Readonly<Record<ForecastColumn, string>> = {
  code: 'cod. prog',
  ordered: 'ordinato',
  internalCosts: 'previsione costi interni',
  externalCosts: 'previsione costi esterni',
  revenue: 'previsione ricavi',
  quantity: 'n. gg',
  marginMonth: 'previsionale marginalità',
  marginEnd: 'previsionale marginalità a fine',
  toInvoice: 'importo da fatturare',
  note: 'note',
}
const DESCRIPTION_HEADING = 'descrizione'
/** The headings are looked for in the first rows only: a model starts with them. */
const HEADING_ROWS = 10

const lettersOf = (ref: string): string => /^[A-Z]+/.exec(ref)?.[0] ?? ''
const heading = (text: string): string => text.trim().toLowerCase().replace(/\s+/g, ' ')

function columnsOf(row: SheetRow): {
  found: Partial<Record<ForecastColumn, string>>
  description: string | null
} {
  const found: Partial<Record<ForecastColumn, string>> = {}
  let description: string | null = null
  for (const cell of row.cells) {
    const text = heading(cell.text)
    const column = lettersOf(cell.ref)
    if (text.startsWith(DESCRIPTION_HEADING)) description ??= column
    const key = text.startsWith(HEADINGS.marginEnd)
      ? 'marginEnd'
      : FORECAST_COLUMNS.find((name) => name !== 'marginEnd' && text.startsWith(HEADINGS[name]))
    if (key !== undefined) found[key] ??= column
  }
  return { found, description }
}

/** A number as a sheet keeps it; null for an empty or a written cell. */
function numberOf(text: string | undefined): number | null {
  if (text === undefined || text.trim() === '') return null
  const value = Number(text)
  return Number.isFinite(value) ? value : null
}

export type ForecastModelReading =
  | { ok: true; model: ForecastModel }
  /** The headings the sheet lacks, as the model writes them. */
  | { ok: false; missing: string[] }

/** Finds in a sheet the columns of the forecast and the project codes it lists. */
export function readForecastModel(grid: SheetGrid): ForecastModelReading {
  const top = grid.rows.slice(0, HEADING_ROWS)
  const header = top.find((row) => columnsOf(row).found.code !== undefined)
  const { found, description } = header ? columnsOf(header) : { found: {}, description: null }
  const missing = FORECAST_COLUMNS.filter((name) => found[name] === undefined)
  if (header === undefined || missing.length > 0) {
    return { ok: false, missing: missing.map((name) => HEADINGS[name]) }
  }
  const columns = found as Record<ForecastColumn, string>
  const rows: ForecastModelRow[] = []
  for (const row of grid.rows) {
    if (row.number <= header.number) continue
    const at = (column: string | null) =>
      row.cells.find((cell) => lettersOf(cell.ref) === column)?.text
    const code = at(columns.code)?.trim() ?? ''
    if (code === '') continue
    rows.push({
      number: row.number,
      code,
      description: at(description)?.trim() ?? '',
      ordered: numberOf(at(columns.ordered)),
    })
  }
  return { ok: true, model: { columns, rows } }
}
