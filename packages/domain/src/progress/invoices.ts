import { orderTotal } from './compute.ts'
import type { OrderPosition, ProgressRequest, ProgressSettings } from './model.ts'

/** One line of an invoice as the company system lists it: an invoice may have several. */
export type InvoiceLine = {
  invoiceId: string
  /** `YYYY-MM-DD`. */
  date: string
  amount: number
  status: string
  /** The sales order the line bills; empty when the system names none. */
  salesOrder: string
}

/** An invoice on a sales order: its lines on that order, added up. */
export type OrderInvoice = {
  id: string
  date: string
  amount: number
  status: string
  salesOrder: string
}

/** A position of the order and the invoice of the same amount, when there is one. */
export type PositionInvoice = OrderPosition & { invoice: OrderInvoice | null }

/** The order as the company system has billed it, beside what Octo knows of it. */
export type InvoicedOrder = {
  invoices: OrderInvoice[]
  invoiced: number
  /** What the positions are worth less what is billed; never below zero. */
  remaining: number
  positions: PositionInvoice[]
  /** Invoices that no request of Octo names as its reference. */
  unregistered: OrderInvoice[]
  /** True when what is billed reaches the total of the order. */
  fulfilled: boolean
}

/** Amounts closer than this are the same amount. */
const CENT = 0.01
const DAY_LENGTH = 10
const FIRST_OF_MONTH = '01'
const cents = (value: number): number => Number(value.toFixed(2))
const sameAmount = (a: number, b: number): boolean => Math.abs(a - b) < CENT
const words = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

function amountOf(value: unknown): number | null {
  const amount = typeof value === 'string' ? Number(value) : value
  return typeof amount === 'number' && Number.isFinite(amount) ? amount : null
}

/** A row of the view of the invoices, when it has what makes it a line of an invoice. */
export function invoiceLineOf(values: Record<string, unknown>): InvoiceLine | null {
  const invoiceId = words(values.invoiceid)
  const amount = amountOf(values.amount)
  if (invoiceId === '' || amount === null) return null
  return {
    invoiceId,
    date: words(values.invoicedate).slice(0, DAY_LENGTH),
    amount,
    status: words(values.status),
    salesOrder: words(values.salesorder),
  }
}

/** The sales orders the invoices name, in order. */
export function knownSalesOrders(lines: readonly InvoiceLine[]): string[] {
  return [...new Set(lines.map((line) => line.salesOrder).filter((order) => order !== ''))].sort()
}

/** The invoices on the sales orders given, oldest first: the lines of each added up. */
export function orderInvoices(
  lines: readonly InvoiceLine[],
  salesOrders: readonly string[],
): OrderInvoice[] {
  const byInvoice = new Map<string, OrderInvoice>()
  for (const line of lines) {
    if (!salesOrders.includes(line.salesOrder)) continue
    const key = `${line.salesOrder}\n${line.invoiceId}`
    const known = byInvoice.get(key)
    if (known) known.amount = cents(known.amount + line.amount)
    else {
      byInvoice.set(key, {
        id: line.invoiceId,
        date: line.date,
        amount: cents(line.amount),
        status: line.status,
        salesOrder: line.salesOrder,
      })
    }
  }
  return [...byInvoice.values()].sort(
    (a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id),
  )
}

/** Each position with the first invoice of its amount that no position before it took. */
function matchPositions(
  positions: readonly OrderPosition[],
  invoices: readonly OrderInvoice[],
): PositionInvoice[] {
  const free = [...invoices]
  return positions.map((position) => {
    const at = free.findIndex((invoice) => sameAmount(invoice.amount, position.amount))
    const [invoice] = at < 0 ? [] : free.splice(at, 1)
    return { ...position, invoice: invoice ?? null }
  })
}

/**
 * The sales orders that look like the order of the client: those with an invoice of the amount
 * of one of its positions. A proposal for the PM, who knows which order is which.
 */
export function suggestedSalesOrders(
  lines: readonly InvoiceLine[],
  positions: readonly OrderPosition[],
): string[] {
  return knownSalesOrders(lines).filter((order) =>
    matchPositions(positions, orderInvoices(lines, [order])).some(
      (position) => position.invoice !== null,
    ),
  )
}

/**
 * What the company system has billed of the order, read through the sales orders the PM said
 * are this order. Null while none is said: nothing ties the two by itself.
 */
export function invoicedOrder(
  settings: ProgressSettings,
  lines: readonly InvoiceLine[],
): InvoicedOrder | null {
  if (settings.salesOrders.length === 0) return null
  const invoices = orderInvoices(lines, settings.salesOrders)
  const invoiced = cents(invoices.reduce((sum, invoice) => sum + invoice.amount, 0))
  const total = orderTotal(settings.positions)
  return {
    invoices,
    invoiced,
    remaining: Math.max(0, cents(total - invoiced)),
    positions: matchPositions(settings.positions, invoices),
    unregistered: invoices.filter(
      (invoice) => !settings.requests.some((request) => request.note.includes(invoice.id)),
    ),
    fulfilled: total > 0 && invoiced > total - CENT,
  }
}

/**
 * The settings with one request more for each invoice Octo did not know: asked outside Octo,
 * they count all the same. Each takes the invoice as its reference, ends on its day and starts
 * where the one before ended, and goes to the position of its amount when there is one.
 */
export function withInvoicesAsRequests(
  settings: ProgressSettings,
  invoiced: InvoicedOrder,
): ProgressSettings {
  const requests: ProgressRequest[] = [...settings.requests]
  for (const invoice of invoiced.unregistered) {
    const before = requests[requests.length - 1]
    const position = invoiced.positions.find((candidate) => candidate.invoice === invoice)
    requests.push({
      n: requests.length + 1,
      from:
        before?.to ||
        `${invoice.date.slice(0, DAY_LENGTH - FIRST_OF_MONTH.length)}${FIRST_OF_MONTH}`,
      to: invoice.date,
      amount: invoice.amount,
      note: invoice.id,
      positions: position ? [position.code] : [],
    })
  }
  return { ...settings, requests }
}
