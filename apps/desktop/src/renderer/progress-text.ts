import type { OrderPosition, ProgressForm } from '@octo/domain'
import { amountOf, amountText } from './forecast-text.ts'
import { type Lines, readLines, readValue } from './lines.ts'

const FIELD_SEPARATOR = ';'
const CELL_SEPARATOR = '='
const LIST_SEPARATOR = ','

/** A cell of a sheet as Excel names it. */
const CELL = /^[A-Za-z]{1,3}[1-9]\d*$/
const COLUMN = /^[A-Za-z]{1,3}$/

/** `code; amount` per line. */
export function positionsOf(text: string): Lines<OrderPosition> {
  return readLines(text, (line) => {
    const [code = '', amount = '', ...rest] = line
      .split(FIELD_SEPARATOR)
      .map((field) => field.trim())
    if (code === '' || amount === '' || rest.length > 0) return { reason: 'shape' }
    const value = amountOf(amount)
    return value === null ? { reason: 'amount' } : { value: { code, amount: value } }
  })
}

export const positionLines = (positions: readonly OrderPosition[]): string =>
  positions.map((position) => `${position.code}; ${amountText(position.amount)}`).join('\n')

/** `cell = text` per line; the text may hold the separator itself. */
export function fieldsOf(text: string): Lines<ProgressForm['fields'][number]> {
  return readLines(text, (line) => {
    const at = line.indexOf(CELL_SEPARATOR)
    if (at < 0) return { reason: 'shape' }
    const ref = line.slice(0, at).trim()
    if (!CELL.test(ref)) return { reason: 'cell' }
    return { value: { ref: ref.toUpperCase(), text: line.slice(at + 1).trim() } }
  })
}

export const fieldLines = (fields: ProgressForm['fields']): string =>
  fields.map((field) => `${field.ref} ${CELL_SEPARATOR} ${field.text}`).join('\n')

/** `first row; rows; position; previous; current; period`: one table, or none when empty. */
export function tableOf(text: string): Lines<NonNullable<ProgressForm['table']>> {
  return readValue(text, (line) => {
    const pieces = line.split(FIELD_SEPARATOR).map((field) => field.trim())
    const [firstRow = '', rows = '', ...columns] = pieces
    const whole = (typed: string) => /^[1-9]\d*$/.test(typed)
    if (pieces.length !== 6 || !whole(firstRow) || !whole(rows)) return { reason: 'shape' }
    if (!columns.every((column) => COLUMN.test(column))) return { reason: 'shape' }
    const [position = '', previous = '', current = '', period = ''] = columns.map((column) =>
      column.toUpperCase(),
    )
    return {
      value: {
        firstRow: Number(firstRow),
        rows: Number(rows),
        position,
        previous,
        current,
        period,
      },
    }
  })
}

export const tableLine = (table: ProgressForm['table']): string =>
  table === null
    ? ''
    : [
        table.firstRow,
        table.rows,
        table.position,
        table.previous,
        table.current,
        table.period,
      ].join(`${FIELD_SEPARATOR} `)

export const listOf = (text: string): string[] =>
  text
    .split(LIST_SEPARATOR)
    .map((item) => item.trim())
    .filter((item) => item !== '')

export const listText = (items: readonly string[]): string => items.join(`${LIST_SEPARATOR} `)
