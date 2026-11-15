import type { ForecastExternal, ForecastExternalRate, ForecastRate } from '@octo/domain'

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

/** An amount back in the form it is typed in; empty for none. */
export const amountText = (value: number | null): string =>
  value === null ? '' : String(value).replace('.', ',')

const fieldsOf = (text: string): string[][] =>
  text
    .split('\n')
    .map((line) => line.split(FIELD_SEPARATOR).map((field) => field.trim()))
    .filter((fields) => (fields[0] ?? '') !== '')

const line = (...fields: string[]): string => fields.join(`${FIELD_SEPARATOR} `)

/**
 * `name; rate` for the rate of a person wherever they work, `name; project code; rate` for one
 * code only. A line as it was written when the cost was typed too (`name; cost; rate`) is read
 * for its rate; a line without a rate is not one.
 */
export function ratesOf(text: string): ForecastRate[] {
  return fieldsOf(text).flatMap(([person = '', second = '', third]): ForecastRate[] => {
    if (third === undefined) {
      const ratePerDay = amountOf(second)
      return ratePerDay === null ? [] : [{ person, code: null, ratePerDay }]
    }
    const ratePerDay = amountOf(third)
    if (ratePerDay === null) return []
    const writtenWithCost = second === '' || amountOf(second) !== null
    return [{ person, code: writtenWithCost ? null : second.toUpperCase(), ratePerDay }]
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

/** `name; project code; cost; rate` per line; a line that lacks one of them is left out. */
export function externalRatesOf(text: string): ForecastExternalRate[] {
  return fieldsOf(text).flatMap(([name = '', code = '', cost = '', rate = '']) => {
    const costPerDay = amountOf(cost)
    const ratePerDay = amountOf(rate)
    if (code === '' || costPerDay === null || ratePerDay === null) return []
    return [{ name, code: code.toUpperCase(), costPerDay, ratePerDay }]
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
export function externalsOf(text: string): ForecastExternal[] {
  return fieldsOf(text).flatMap(([name = '', worked = '']) => {
    const hours = amountOf(worked)
    return hours === null ? [] : [{ name, hours }]
  })
}

export const externalLines = (externals: readonly ForecastExternal[]): string =>
  externals.map((external) => line(external.name, amountText(external.hours))).join('\n')
