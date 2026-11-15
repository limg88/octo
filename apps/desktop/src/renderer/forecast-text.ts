import type { ForecastExternal, ForecastExternalRate, ForecastRate } from '@octo/domain'
import { type Lines, readLines, readValue } from './lines.ts'

const FIELD_SEPARATOR = ';'

const THOUSANDS = /^\d{1,3}(\.\d{3})+$/

/**
 * A number as an Italian PM types it: `1.234,5` and `1234.5` are the same amount, and points
 * every three digits (`120.000`) separate thousands.
 */
export function amountOf(typed: string): number | null {
  const compact = typed.replace(/\s|€/g, '')
  if (compact === '') return null
  const italian = compact.includes(',') || THOUSANDS.test(compact)
  const plain = italian ? compact.replaceAll('.', '').replace(',', '.') : compact
  const value = Number(plain)
  return Number.isFinite(value) ? value : null
}

/** An amount typed in a field of its own; nothing typed is no amount, not a problem. */
export const amountField = (text: string): Lines<number> =>
  readValue(text, (typed) => {
    const value = amountOf(typed)
    return value === null ? { reason: 'amount' } : { value }
  })

/** An amount back in the form it is typed in; empty for none. */
export const amountText = (value: number | null): string =>
  value === null ? '' : String(value).replace('.', ',')

const pieces = (typed: string): string[] =>
  typed.split(FIELD_SEPARATOR).map((field) => field.trim())

const line = (...fields: string[]): string => fields.join(`${FIELD_SEPARATOR} `)

/**
 * `name; rate` for the rate of a person wherever they work, `name; project code; rate` for one
 * code only. A line as it was written when the cost was typed too (`name; cost; rate`) is read
 * for its rate.
 */
export function ratesOf(text: string): Lines<ForecastRate> {
  return readLines(text, (typed) => {
    const [person = '', second = '', third, ...rest] = pieces(typed)
    if (person === '' || rest.length > 0) return { reason: 'shape' }
    if (third === undefined) {
      if (second === '') return { reason: 'shape' }
      const ratePerDay = amountOf(second)
      return ratePerDay === null
        ? { reason: 'amount' }
        : { value: { person, code: null, ratePerDay } }
    }
    const ratePerDay = amountOf(third)
    if (ratePerDay === null) return { reason: third === '' ? 'shape' : 'amount' }
    const writtenWithCost = second === '' || amountOf(second) !== null
    return { value: { person, code: writtenWithCost ? null : second.toUpperCase(), ratePerDay } }
  })
}

export const rateLines = (rates: readonly ForecastRate[]): string =>
  rates
    .map((rate) =>
      rate.code === null
        ? line(rate.person, amountText(rate.ratePerDay))
        : line(rate.person, rate.code, amountText(rate.ratePerDay)),
    )
    .join('\n')

/** `name; project code; cost; rate` per line. */
export function externalRatesOf(text: string): Lines<ForecastExternalRate> {
  return readLines(text, (typed) => {
    const [name = '', code = '', cost = '', rate = '', ...rest] = pieces(typed)
    if (name === '' || code === '' || cost === '' || rate === '' || rest.length > 0) {
      return { reason: 'shape' }
    }
    const costPerDay = amountOf(cost)
    const ratePerDay = amountOf(rate)
    if (costPerDay === null || ratePerDay === null) return { reason: 'amount' }
    return { value: { name, code: code.toUpperCase(), costPerDay, ratePerDay } }
  })
}

export const externalRateLines = (externals: readonly ForecastExternalRate[]): string =>
  externals
    .map((external) =>
      line(
        external.name,
        external.code,
        amountText(external.costPerDay),
        amountText(external.ratePerDay),
      ),
    )
    .join('\n')

/** `name; hours` per line: what an external worked in the month. */
export function externalsOf(text: string): Lines<ForecastExternal> {
  return readLines(text, (typed) => {
    const [name = '', worked = '', ...rest] = pieces(typed)
    if (name === '' || worked === '' || rest.length > 0) return { reason: 'shape' }
    const hours = amountOf(worked)
    return hours === null ? { reason: 'amount' } : { value: { name, hours } }
  })
}

export const externalLines = (externals: readonly ForecastExternal[]): string =>
  externals.map((external) => line(external.name, amountText(external.hours))).join('\n')
