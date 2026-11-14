import type { ForecastCell } from '../forecast/compile.ts'
import type { OrderPosition, ProgressRequest, ProgressSettings } from './model.ts'

/** A request with the share of each position it brings the order to. Shares are 0 to 1. */
export type ProgressStep = {
  request: ProgressRequest
  /** Everything asked up to this request. */
  cumulative: number
  /** True for the request that reaches the total of the order: every position is at 100%. */
  closing: boolean
  previous: number[]
  current: number[]
  period: number[]
  /** The shares of this request turned back into money, to see what the rounding leaves. */
  rebuilt: number
}

export type ProgressProblem =
  | { kind: 'no_positions' }
  | { kind: 'over_total'; n: number; excess: number }
  | { kind: 'unknown_positions'; n: number; codes: string[] }
  | { kind: 'over_positions'; n: number; excess: number }

export type ProgressComputation =
  | { ok: true; total: number; steps: ProgressStep[] }
  | { ok: false; total: number; problem: ProgressProblem }

/** Things the PM should look at before sending a form; none stops the computation. */
export type ProgressWarning =
  | { kind: 'total_differs'; declared: number; positions: number }
  | { kind: 'dates_missing'; n: number }
  | { kind: 'dates_not_chained'; n: number }
  | { kind: 'note_missing'; n: number }

const SHARE_DECIMALS = 4
/** Amounts closer than this are the same amount. */
const CENT = 0.01
const cents = (value: number): number => Number(value.toFixed(2))
const share = (value: number): number => Number(value.toFixed(SHARE_DECIMALS))

export const orderTotal = (positions: readonly OrderPosition[]): number =>
  cents(positions.reduce((sum, position) => sum + position.amount, 0))

/**
 * The share of each position after each request. What is asked fills the positions one after the
 * other, always from the running total and never by adding rounded steps, so the error of the
 * rounding does not grow. A request that names its positions fills only those. The request that
 * reaches the total of the order closes every position at 100%: with four decimals the sum would
 * otherwise stop a hair short.
 */
export function computeProgress(
  positions: readonly OrderPosition[],
  requests: readonly ProgressRequest[],
): ProgressComputation {
  const total = orderTotal(positions)
  if (positions.length === 0) return { ok: false, total, problem: { kind: 'no_positions' } }
  const codes = positions.map((position) => position.code)
  const filled = positions.map(() => 0)
  const steps: ProgressStep[] = []
  let previous = positions.map(() => 0)
  let cumulative = 0

  for (const request of requests) {
    cumulative = cents(cumulative + request.amount)
    if (cumulative - total > CENT) {
      const problem = {
        kind: 'over_total' as const,
        n: request.n,
        excess: cents(cumulative - total),
      }
      return { ok: false, total, problem }
    }
    const unknown = request.positions.filter((code) => !codes.includes(code))
    if (unknown.length > 0) {
      const problem = { kind: 'unknown_positions' as const, n: request.n, codes: unknown }
      return { ok: false, total, problem }
    }
    const targets =
      request.positions.length > 0 ? request.positions.map((code) => codes.indexOf(code)) : null
    // Without named positions the whole running total is poured again from the first one.
    let left = targets === null ? cumulative : request.amount
    if (targets === null) filled.fill(0)
    for (const index of targets ?? positions.keys()) {
      const room = cents((positions[index]?.amount ?? 0) - (filled[index] ?? 0))
      const poured = Math.min(room, left)
      filled[index] = cents((filled[index] ?? 0) + poured)
      left = cents(left - poured)
    }
    if (left > CENT) {
      return { ok: false, total, problem: { kind: 'over_positions', n: request.n, excess: left } }
    }
    const closing = Math.abs(cumulative - total) < CENT
    const current = positions.map((position, index) =>
      closing ? 1 : share((filled[index] ?? 0) / position.amount),
    )
    steps.push({
      request,
      cumulative,
      closing,
      previous,
      current,
      period: current.map((value, index) => share(value - (previous[index] ?? 0))),
      rebuilt: cents(
        current.reduce((sum, value, index) => sum + value * (positions[index]?.amount ?? 0), 0),
      ),
    })
    previous = current
  }
  return { ok: true, total, steps }
}

export function progressWarnings(settings: ProgressSettings): ProgressWarning[] {
  const warnings: ProgressWarning[] = []
  const positions = orderTotal(settings.positions)
  if (settings.total !== null && Math.abs(settings.total - positions) >= CENT) {
    warnings.push({ kind: 'total_differs', declared: settings.total, positions })
  }
  settings.requests.forEach((request, index) => {
    const before = settings.requests[index - 1]
    if (request.from === '' || request.to === '') {
      warnings.push({ kind: 'dates_missing', n: request.n })
    } else if (before && before.to !== '' && before.to !== request.from) {
      warnings.push({ kind: 'dates_not_chained', n: request.n })
    }
    if (request.note === '') warnings.push({ kind: 'note_missing', n: request.n })
  })
  return warnings
}

export type ProgressFormProblem = { kind: 'too_many_positions'; rows: number; positions: number }

export type ProgressFormCells =
  | { ok: true; writes: Array<{ ref: string; cell: ForecastCell }> }
  | { ok: false; problem: ProgressFormProblem }

/** `2026-06-30` as the form writes it: `30/06/2026`. Empty stays empty. */
const formDay = (day: string): string => day.split('-').reverse().join('/')

const PLACEHOLDER = /\{([a-z_]+)\}/g
const NUMBER_FIELD = '{n}'

/**
 * What to write in the form for one request: the fields of the map with their names replaced,
 * and one row of the table per position, shares as numbers shown as percentages.
 * Rows of the table the order does not need are emptied.
 */
export function progressFormCells(
  settings: ProgressSettings,
  step: ProgressStep,
  previousTo: string,
): ProgressFormCells {
  const { positions, form } = settings
  const touched =
    step.request.positions.length > 0 ? step.request.positions : positions.map((p) => p.code)
  const range = touched.length > 1 ? `${touched[0]}:${touched.at(-1)}` : (touched[0] ?? '')
  const values: Record<string, string> = {
    n: String(step.request.n),
    ordine: settings.order,
    posizioni: range,
    dal: formDay(step.request.from),
    al: formDay(step.request.to),
    al_precedente: formDay(previousTo),
    nota: step.request.note,
  }
  const writes: Array<{ ref: string; cell: ForecastCell }> = form.fields.map((field) => ({
    ref: field.ref,
    cell:
      field.text === NUMBER_FIELD
        ? { kind: 'number', value: step.request.n }
        : {
            kind: 'text',
            value: field.text.replace(PLACEHOLDER, (whole, name: string) => values[name] ?? whole),
          },
  }))
  const { table } = form
  if (table !== null) {
    if (positions.length > table.rows) {
      const problem = {
        kind: 'too_many_positions' as const,
        rows: table.rows,
        positions: positions.length,
      }
      return { ok: false, problem }
    }
    for (let index = 0; index < table.rows; index += 1) {
      const row = table.firstRow + index
      const position = positions[index]
      const number = (value: number | undefined): ForecastCell =>
        position === undefined
          ? { kind: 'empty' }
          : { kind: 'number', value: value ?? 0, percent: true }
      writes.push(
        {
          ref: `${table.position}${row}`,
          cell: position === undefined ? { kind: 'empty' } : { kind: 'text', value: position.code },
        },
        { ref: `${table.previous}${row}`, cell: number(step.previous[index]) },
        { ref: `${table.current}${row}`, cell: number(step.current[index]) },
        { ref: `${table.period}${row}`, cell: number(step.period[index]) },
      )
    }
  }
  return { ok: true, writes }
}
