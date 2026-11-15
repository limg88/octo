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

/** An amount typed in a field of its own: its value, or that what is typed is not an amount. */
export type AmountRead = { value: number | null; wrong: boolean }

/** Nothing typed is no amount, and not a mistake; anything else must be a number. */
export function amountField(typed: string): AmountRead {
  const value = amountOf(typed)
  return { value, wrong: typed.trim() !== '' && value === null }
}

/** An amount back in the form it is typed in; empty for none. */
export const amountText = (value: number | null): string =>
  value === null ? '' : String(value).replace('.', ',')
