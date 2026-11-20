import type { Lifetime, LifetimeLine, SheetProgress } from '@octo/domain'
import { messages } from './messages.ts'
import { monthText, shortDayText } from './today-text.ts'

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

/** Where a line of the life of a code comes from, with the months it stands for when an estimate. */
export function lifetimeSourceText(line: Pick<LifetimeLine, 'source' | 'months'>): string {
  const source = messages.sheet.summary.sources[line.source]
  return line.months.length === 0 ? source : `${source} (${line.months.join(', ')})`
}

/** What says how far a project code is: the page never shows the figure without it. */
export function progressSourceText(progress: SheetProgress): string {
  const sources = messages.sheet.summary.progressSources
  if (progress.source !== 'system') return sources[progress.source]
  return sources.system(progress.day === null ? '' : shortDayText(progress.day))
}

/** The same in the table of the page, where the column beside already names the source. */
export function progressSourceInTable(progress: SheetProgress): string {
  if (progress.source !== 'system') return progressSourceText(progress)
  const day = progress.day === null ? '' : shortDayText(progress.day)
  return messages.sheet.summary.progressSources.systemInTable(day)
}

const SHORT_MONTH = new Intl.DateTimeFormat('it-IT', {
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})

/** A month `YYYY-MM` as the heading of a column: short, with its year. */
export const shortMonthText = (month: string): string =>
  SHORT_MONTH.format(new Date(`${month}-01T00:00:00Z`))

const COLUMN_GAP = 2

/** Rows of text as a table for a mail in plain text: each column as wide as its widest cell. */
function aligned(rows: readonly string[][]): string[] {
  const widths = rows[0]?.map((_, column) =>
    Math.max(...rows.map((row) => row[column]?.length ?? 0)),
  )
  return rows.map((row) =>
    row
      .map((cell, column) =>
        column === 0
          ? cell.padEnd((widths?.[column] ?? 0) + COLUMN_GAP)
          : cell.padStart((widths?.[column] ?? 0) + COLUMN_GAP),
      )
      .join('')
      .trimEnd(),
  )
}

/**
 * A project code over its whole life as a text to paste in a mail: the figures of the page, with
 * what they miss said in so many words. Nothing that is not on the page.
 */
export function lifetimeMail(life: Lifetime): string {
  const text = messages.sheet.summary
  const { money, share, hours } = messages.forecast
  const amount = (value: number | null): string => (value === null ? '—' : money(value))
  const ofOrder = (value: number | null): string =>
    value === null
      ? '—'
      : life.ordered
        ? `${money(value)} (${share(value / life.ordered)})`
        : money(value)
  const table = aligned([
    [text.person, text.hours, text.cost],
    ...life.lines.map((line) => [
      // An estimate is said on its own line: a mail is read without the page beside it.
      line.source === 'estimate' ? `${line.person} (${text.estimateMark})` : line.person,
      hours(line.hours),
      amount(line.cost),
    ]),
    ...(life.supplierCosts > 0 ? [[text.suppliersLine, '', money(life.supplierCosts)]] : []),
    [text.total, hours(life.hours), money(life.costs)],
  ])
  const missing = life.lines.filter((line) => line.cost === null).map((line) => line.person)
  return [
    life.description === '' ? life.code : `${life.code} · ${life.description}`,
    text.through(monthText(life.through)),
    '',
    `${text.ordered}: ${amount(life.ordered)}`,
    `${text.invoiced}: ${ofOrder(life.invoiced)}`,
    `${text.recognized}: ${ofOrder(life.recognized)}`,
    ...(life.wip === null ? [] : [`${text.wip} (${text.wipNote}): ${money(life.wip)}`]),
    ...(life.toBill === null ? [] : [`${text.toBill} (${text.toBillNote}): ${money(life.toBill)}`]),
    '',
    ...table,
    '',
    `${text.marginToDate}: ${share(life.marginToDate)}`,
    ...(life.progress === null
      ? []
      : [text.progressMail(share(life.progress.share), progressSourceText(life.progress))]),
    ...(life.budgetCosts === null ? [] : [`${text.budgetCosts}: ${money(life.budgetCosts)}`]),
    ...(life.marginAtEnd === null
      ? []
      : [
          `${text.marginAtEnd}: ${share(life.marginAtEnd)} · ${text.onCosts(money(life.expectedCosts ?? 0))}`,
        ]),
    ...(life.estimatedHours > 0
      ? ['', text.estimated(hours(life.estimatedHours), money(life.estimatedCosts))]
      : []),
    ...(missing.length > 0 ? ['', text.withoutCost(missing.join(', '))] : []),
    ...(life.unreadMonths.length > 0
      ? ['', messages.forecast.unreadMonths(life.unreadMonths.join(', '))]
      : []),
  ].join('\n')
}
