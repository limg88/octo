/** A line of a purchase order: what it is called there and what it is worth. */
export type OrderPosition = { code: string; amount: number }

/** A request to have a share of the order recognised: one per invoice, in order of time. */
export type ProgressRequest = {
  n: number
  /** `YYYY-MM-DD`. */
  from: string
  to: string
  /** The amount of this request alone, not the running total. */
  amount: number
  note: string
  /** The positions this amount goes to, in order; none: the order is filled from its first. */
  positions: string[]
}

/** Where the form of the client wants each thing. The form is the client's: only this map is ours. */
export type ProgressForm = {
  /** A cell and what goes in it; `{…}` names are replaced with the values of the request. */
  fields: Array<{ ref: string; text: string }>
  /** The table of the positions; null: the form has none. */
  table: {
    firstRow: number
    rows: number
    position: string
    previous: string
    current: string
    period: string
  } | null
}

export type ProgressSettings = {
  /** The empty form, a spreadsheet inside the project folder. */
  modelPath: string
  /** The order as the form names it. */
  order: string
  /** The sales orders of the company system that are this order; none: nothing is compared. */
  salesOrders: string[]
  /** The total the order declares, to check the positions against; null: not given. */
  total: number | null
  positions: OrderPosition[]
  requests: ProgressRequest[]
  form: ProgressForm
}

export const DEFAULT_PROGRESS_SETTINGS: ProgressSettings = {
  modelPath: '',
  order: '',
  salesOrders: [],
  total: null,
  positions: [],
  requests: [],
  form: { fields: [], table: null },
}

/** What a field of the form may name. */
export const PROGRESS_PLACEHOLDERS = [
  'n',
  'ordine',
  'posizioni',
  'dal',
  'al',
  'al_precedente',
  'nota',
] as const
export type ProgressPlaceholder = (typeof PROGRESS_PLACEHOLDERS)[number]

const DAY = /^\d{4}-\d{2}-\d{2}$/
const CELL = /^[A-Z]{1,3}[1-9][0-9]{0,6}$/
const COLUMN = /^[A-Z]{1,3}$/
const MAX_TABLE_ROWS = 200

const cents = (value: number): number => Number(value.toFixed(2))
const positiveAmount = (value: number): boolean => Number.isFinite(value) && value > 0
const day = (value: string): string => (DAY.test(value.trim()) ? value.trim() : '')

function cleanTable(table: ProgressForm['table']): ProgressForm['table'] {
  if (table === null) return null
  const columns = {
    position: table.position.trim().toUpperCase(),
    previous: table.previous.trim().toUpperCase(),
    current: table.current.trim().toUpperCase(),
    period: table.period.trim().toUpperCase(),
  }
  const whole = Number.isInteger(table.firstRow) && Number.isInteger(table.rows)
  const sized = table.firstRow >= 1 && table.rows >= 1 && table.rows <= MAX_TABLE_ROWS
  if (!whole || !sized || !Object.values(columns).every((column) => COLUMN.test(column))) {
    return null
  }
  return { firstRow: table.firstRow, rows: table.rows, ...columns }
}

/** Settings as the PM typed them, made tidy: requests numbered in order of time. */
export function cleanProgressSettings(settings: ProgressSettings): ProgressSettings {
  const codes = new Set<string>()
  const positions = settings.positions
    .map((position) => ({ code: position.code.trim(), amount: cents(position.amount) }))
    .filter((position) => {
      if (position.code === '' || !positiveAmount(position.amount)) return false
      if (codes.has(position.code)) return false
      codes.add(position.code)
      return true
    })
  const requests = settings.requests
    .filter((request) => positiveAmount(request.amount))
    .map((request, index) => ({
      n: index + 1,
      from: day(request.from),
      to: day(request.to),
      amount: cents(request.amount),
      note: request.note.trim(),
      positions: [...new Set(request.positions.map((code) => code.trim()))].filter(
        (code) => code !== '',
      ),
    }))
  const total = settings.total
  return {
    modelPath: settings.modelPath.trim(),
    order: settings.order.trim(),
    salesOrders: [...new Set(settings.salesOrders.map((order) => order.trim()))].filter(
      (order) => order !== '',
    ),
    total: total !== null && positiveAmount(total) ? cents(total) : null,
    positions,
    requests,
    form: {
      fields: settings.form.fields
        .map((field) => ({ ref: field.ref.trim().toUpperCase(), text: field.text.trim() }))
        .filter((field) => CELL.test(field.ref) && field.text !== ''),
      table: cleanTable(settings.form.table),
    },
  }
}
