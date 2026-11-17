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
  /**
   * Fixed price: the costs of the whole project at budget; progress is the costs so far over
   * this. Written once, it holds for the months after until another is written.
   */
  budgetCosts: number | null
  /** The costs expected for the whole project, for the margin at its end. */
  totalCosts: number | null
  /** True when `totalCosts` stops at the month before: the costs of the month are added. */
  totalCostsBeforeMonth: boolean
  note: string
}

/** How the revenue of a project code is told each month. */
export const FORECAST_KINDS = ['time_material', 'fixed_price', 'fee'] as const
/**
 * `time_material`: days worked at the rate of who worked them. `fixed_price`: the share of the
 * order the costs so far are of the costs at budget. `fee`: the order in equal monthly parts.
 */
export type ForecastKind = (typeof FORECAST_KINDS)[number]

/** What is known of a project code whatever the month. */
export type ForecastProject = {
  kind: ForecastKind
  /** As the company's system names the project. */
  description: string
  /** What the client ordered; null while it is not known. */
  ordered: number | null
  /** A fee: the months the order is spread over. */
  feeMonths: number | null
}

/**
 * The items of the company's system whose sale is of one kind: a line of a sales order names one
 * of them. An item not listed here says nothing about how the project is sold.
 */
const KIND_OF_ORDER_ITEM: Readonly<Record<string, ForecastKind>> = {
  'PROG-CORPO': 'fixed_price',
  SERVPRO: 'time_material',
}

/**
 * How a project is sold, as the items of its sales orders tell it; null when they tell nothing,
 * or more than one thing.
 */
export function forecastKindOfItems(items: readonly string[]): ForecastKind | null {
  const kinds = new Set(
    items.flatMap((item) => {
      const kind = KIND_OF_ORDER_ITEM[item.trim().toUpperCase()]
      return kind === undefined ? [] : [kind]
    }),
  )
  const [only] = [...kinds]
  return kinds.size === 1 && only !== undefined ? only : null
}

export const DEFAULT_FEE_MONTHS = 12
export const NO_FORECAST_PROJECT: ForecastProject = {
  kind: 'time_material',
  description: '',
  ordered: null,
  feeMonths: null,
}

/** How a PM fills the monthly forecast the administration asks for. */
export type ForecastSettings = {
  /** The spreadsheet of the administration, inside the project folder; empty: none is filled. */
  modelPath: string
  /** By project code. */
  projects: Record<string, ForecastProject>
  hoursPerDay: number
  rates: ForecastRate[]
  externals: ForecastExternalRate[]
  /** Month (`YYYY-MM`), then project code. */
  months: Record<string, Record<string, ForecastRowInputs>>
}

export const DEFAULT_HOURS_PER_DAY = 8

export const DEFAULT_FORECAST_SETTINGS: ForecastSettings = {
  modelPath: '',
  projects: {},
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

/** A project code as it is compared: no spaces around, capital letters. */
export const forecastCode = (code: string): string => code.trim().toUpperCase()

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
  const projects: ForecastSettings['projects'] = {}
  for (const [typed, project] of Object.entries(settings.projects)) {
    const code = forecastCode(typed)
    if (code === '') continue
    const feeMonths = project.feeMonths
    projects[code] = {
      kind: FORECAST_KINDS.includes(project.kind) ? project.kind : NO_FORECAST_PROJECT.kind,
      description: project.description.trim(),
      ordered: amount(project.ordered),
      feeMonths:
        feeMonths !== null && Number.isInteger(feeMonths) && feeMonths > 0 ? feeMonths : null,
    }
  }
  const hours = settings.hoursPerDay
  return {
    modelPath: settings.modelPath.trim(),
    projects,
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

/** A line of the model: one project code, at the row the sheet keeps it. */
export type ForecastModelRow = {
  number: number
  code: string
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
/** The headings are looked for in the first rows only: a model starts with them. */
const HEADING_ROWS = 10

const lettersOf = (ref: string): string => /^[A-Z]+/.exec(ref)?.[0] ?? ''
const heading = (text: string): string => text.trim().toLowerCase().replace(/\s+/g, ' ')

function columnsOf(row: SheetRow): Partial<Record<ForecastColumn, string>> {
  const found: Partial<Record<ForecastColumn, string>> = {}
  for (const cell of row.cells) {
    const text = heading(cell.text)
    const column = lettersOf(cell.ref)
    const key = text.startsWith(HEADINGS.marginEnd)
      ? 'marginEnd'
      : FORECAST_COLUMNS.find((name) => name !== 'marginEnd' && text.startsWith(HEADINGS[name]))
    if (key !== undefined) found[key] ??= column
  }
  return found
}

export type ForecastModelReading =
  | { ok: true; model: ForecastModel }
  /** The headings the sheet lacks, as the model writes them. */
  | { ok: false; missing: string[] }

/** Finds in a sheet the columns of the forecast and the rows of the project codes it lists. */
export function readForecastModel(grid: SheetGrid): ForecastModelReading {
  const top = grid.rows.slice(0, HEADING_ROWS)
  const header = top.find((row) => columnsOf(row).code !== undefined)
  const found = header ? columnsOf(header) : {}
  const missing = FORECAST_COLUMNS.filter((name) => found[name] === undefined)
  if (header === undefined || missing.length > 0) {
    return { ok: false, missing: missing.map((name) => HEADINGS[name]) }
  }
  const columns = found as Record<ForecastColumn, string>
  const rows: ForecastModelRow[] = []
  for (const row of grid.rows) {
    if (row.number <= header.number) continue
    const code = forecastCode(
      row.cells.find((cell) => lettersOf(cell.ref) === columns.code)?.text ?? '',
    )
    if (code !== '') rows.push({ number: row.number, code })
  }
  return { ok: true, model: { columns, rows } }
}
