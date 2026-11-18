import type { ProjectEconomics } from './model.ts'

/** The characters of a month in a day written `YYYY-MM-DD`. */
const MONTH_LENGTH = 7
const monthOf = (day: string): string => day.slice(0, MONTH_LENGTH)
const total = (amounts: readonly number[]): number =>
  amounts.reduce((sum, amount) => sum + amount, 0)

/** What was invoiced on a sales order, month by month. */
export type OrderBilling = {
  /** Empty for the invoices the system ties to no sales order. */
  salesOrder: string
  /** By month, `YYYY-MM`: only the months with an invoice. */
  months: Record<string, number>
  invoiced: number
}

/** An order to a supplier: what was ordered, what was delivered, what the supplier invoiced. */
export type SupplierOrder = {
  order: string
  vendor: string
  ordered: number
  /** What was received: the cost of the project so far. */
  received: number
  invoiced: number
}

/** The orders to the suppliers of a project code, with their totals. */
export type SupplierCycle = {
  ordered: number
  received: number
  invoiced: number
  /** What was ordered and not yet invoiced by the suppliers. */
  toInvoice: number
  orders: SupplierOrder[]
}

/** What the company's system booked up to a month: the revenue and the costs, group by group. */
export type LedgerTotals = {
  revenue: number
  costs: number
  groups: Array<{ group: string; cost: number }>
}

/** The money of a project code up to a month, as the company's system tells it. */
export type SheetEconomics = {
  /** The sum of the lines of the invoices to the client, credit notes included. */
  invoiced: number
  /** The months with an invoice to the client, in order. */
  billingMonths: string[]
  billing: OrderBilling[]
  ledger: LedgerTotals
  /** What the ledger booked in each month, `YYYY-MM`: the revenue and all the costs. */
  ledgerMonths: Record<string, { revenue: number; costs: number }>
  /** Null when the project code has no order to a supplier, no receipt and no invoice of one. */
  suppliers: SupplierCycle | null
}

function billingOf(economics: ProjectEconomics, through: string): OrderBilling[] {
  const orders = new Map<string, OrderBilling>()
  for (const line of economics.invoices) {
    const month = monthOf(line.day)
    if (month > through) continue
    const known = orders.get(line.salesOrder) ?? {
      salesOrder: line.salesOrder,
      months: {},
      invoiced: 0,
    }
    known.months[month] = (known.months[month] ?? 0) + line.amount
    known.invoiced += line.amount
    orders.set(line.salesOrder, known)
  }
  return [...orders.values()].sort((a, b) => a.salesOrder.localeCompare(b.salesOrder))
}

function ledgerOf(economics: ProjectEconomics, through: string): LedgerTotals {
  const entries = economics.ledger.filter((entry) => entry.month <= through)
  const groups = new Map<string, number>()
  for (const entry of entries) groups.set(entry.group, (groups.get(entry.group) ?? 0) + entry.cost)
  return {
    revenue: total(entries.map((entry) => entry.revenue)),
    costs: total(entries.map((entry) => entry.cost)),
    groups: [...groups.entries()]
      .filter(([, cost]) => cost !== 0)
      .map(([group, cost]) => ({ group, cost }))
      .sort((a, b) => a.group.localeCompare(b.group)),
  }
}

function ledgerMonthsOf(
  economics: ProjectEconomics,
  through: string,
): SheetEconomics['ledgerMonths'] {
  const months: SheetEconomics['ledgerMonths'] = {}
  for (const entry of economics.ledger) {
    if (entry.month > through) continue
    const known = months[entry.month] ?? { revenue: 0, costs: 0 }
    months[entry.month] = {
      revenue: known.revenue + entry.revenue,
      costs: known.costs + entry.cost,
    }
  }
  return months
}

function suppliersOf(economics: ProjectEconomics, through: string): SupplierCycle | null {
  const upTo = <Line extends { day: string }>(lines: readonly Line[]): Line[] =>
    lines.filter((line) => monthOf(line.day) <= through)
  const purchases = upTo(economics.purchases)
  const receipts = upTo(economics.receipts)
  const invoices = upTo(economics.vendorInvoices)
  if (purchases.length + receipts.length + invoices.length === 0) return null
  const orders = new Map<string, SupplierOrder>()
  const orderOf = (order: string, vendor: string): SupplierOrder => {
    const known = orders.get(order) ?? { order, vendor, ordered: 0, received: 0, invoiced: 0 }
    // The order names its supplier; a receipt or an invoice does only when the order does not.
    if (known.vendor === '') known.vendor = vendor
    orders.set(order, known)
    return known
  }
  for (const line of purchases) orderOf(line.order, line.vendor).ordered += line.amount
  for (const line of receipts) orderOf(line.order, line.vendor).received += line.amount
  for (const line of invoices) orderOf(line.order, line.vendor).invoiced += line.amount
  const rows = [...orders.values()].sort(
    (a, b) => a.vendor.localeCompare(b.vendor, 'it') || a.order.localeCompare(b.order),
  )
  const ordered = total(rows.map((row) => row.ordered))
  const invoiced = total(rows.map((row) => row.invoiced))
  return {
    ordered,
    received: total(rows.map((row) => row.received)),
    invoiced,
    toInvoice: ordered - invoiced,
    orders: rows,
  }
}

/**
 * The money of a project code up to a month, with the rules of the sheet the administration
 * keeps: invoiced is the sum of the lines of the invoices, the cost of a supplier is what was
 * received against its orders, and the ledger of the company's system stands beside as a check.
 */
export function sheetEconomics(economics: ProjectEconomics, through: string): SheetEconomics {
  const billing = billingOf(economics, through)
  return {
    invoiced: total(billing.map((order) => order.invoiced)),
    billingMonths: [...new Set(billing.flatMap((order) => Object.keys(order.months)))].sort(),
    billing,
    ledger: ledgerOf(economics, through),
    ledgerMonths: ledgerMonthsOf(economics, through),
    suppliers: suppliersOf(economics, through),
  }
}
