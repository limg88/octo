import type { ForecastExternal, ForecastRate } from '@octo/domain'

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

/** `name; cost; rate` per line; a line without a cost is not a rate. */
export function ratesOf(text: string): ForecastRate[] {
  return fieldsOf(text).flatMap(([person = '', cost = '', rate = '']) => {
    const costPerDay = amountOf(cost)
    return costPerDay === null ? [] : [{ person, costPerDay, ratePerDay: amountOf(rate) }]
  })
}

export const rateLines = (rates: readonly ForecastRate[]): string =>
  rates
    .map((rate) =>
      [rate.person, amountText(rate.costPerDay), amountText(rate.ratePerDay)]
        .join(`${FIELD_SEPARATOR} `)
        .replace(/; $/, ''),
    )
    .join('\n')

/** `name; days; cost; rate` per line; a line that lacks a number is left out. */
export function externalsOf(text: string): ForecastExternal[] {
  return fieldsOf(text).flatMap(([name = '', days = '', cost = '', rate = '']) => {
    const numbers = [amountOf(days), amountOf(cost), amountOf(rate)]
    const [daysValue, costPerDay, ratePerDay] = numbers
    if (daysValue == null || costPerDay == null || ratePerDay == null) return []
    return [{ name, days: daysValue, costPerDay, ratePerDay }]
  })
}

export const externalLines = (externals: readonly ForecastExternal[]): string =>
  externals
    .map((external) =>
      [
        external.name,
        amountText(external.days),
        amountText(external.costPerDay),
        amountText(external.ratePerDay),
      ].join(`${FIELD_SEPARATOR} `),
    )
    .join('\n')
