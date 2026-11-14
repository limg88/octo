import type { OrderPosition, ProgressForm } from '@octo/domain'
import { amountOf, amountText } from './forecast-text.ts'

const FIELD_SEPARATOR = ';'
const CELL_SEPARATOR = '='
const LIST_SEPARATOR = ','

const lines = (text: string): string[] =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')

/** `code; amount` per line; a line without an amount is left out. */
export function positionsOf(text: string): OrderPosition[] {
  return lines(text).flatMap((line) => {
    const [code = '', amount = ''] = line.split(FIELD_SEPARATOR).map((field) => field.trim())
    const value = amountOf(amount)
    return code === '' || value === null ? [] : [{ code, amount: value }]
  })
}

export const positionLines = (positions: readonly OrderPosition[]): string =>
  positions.map((position) => `${position.code}; ${amountText(position.amount)}`).join('\n')

/** `cell = text` per line; the text may hold the separator itself. */
export function fieldsOf(text: string): ProgressForm['fields'] {
  return lines(text).flatMap((line) => {
    const at = line.indexOf(CELL_SEPARATOR)
    if (at < 0) return []
    return [{ ref: line.slice(0, at).trim(), text: line.slice(at + 1).trim() }]
  })
}

export const fieldLines = (fields: ProgressForm['fields']): string =>
  fields.map((field) => `${field.ref} ${CELL_SEPARATOR} ${field.text}`).join('\n')

/** `first row; rows; position; previous; current; period`; null when a piece is missing. */
export function tableOf(text: string): ProgressForm['table'] {
  const [firstRow = '', rows = '', position = '', previous = '', current = '', period = ''] = text
    .split(FIELD_SEPARATOR)
    .map((field) => field.trim())
  if (period === '') return null
  return { firstRow: Number(firstRow), rows: Number(rows), position, previous, current, period }
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
