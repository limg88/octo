/** What the company's system booked on a project code in a month, for a group of costs. */
export type LedgerEntry = {
  /** `YYYY-MM`. */
  month: string
  /** The group the system books the cost under: labour from timesheets, services, expenses. */
  group: string
  cost: number
  /** The revenue the system recognised in the month. */
  revenue: number
}

/** A line of an invoice to the client. */
export type SalesInvoiceLine = {
  invoice: string
  /** The sales order the line bills; empty when the system does not say. */
  salesOrder: string
  /** `YYYY-MM-DD`. */
  day: string
  /** Negative for a credit note. */
  amount: number
}

/** A line of an order to a supplier. */
export type PurchaseLine = { order: string; vendor: string; day: string; amount: number }

/** What a supplier delivered against an order: the cost the project bears, when it bears it. */
export type ReceiptLine = { order: string; vendor: string; day: string; amount: number }

/** A line of an invoice of a supplier. */
export type VendorInvoiceLine = {
  invoice: string
  order: string
  vendor: string
  day: string
  amount: number
}

/** How far the work is at the end of a period, as the company's system says. */
export type ProgressReading = {
  /** The last day of the period, `YYYY-MM-DD`. */
  day: string
  /** The share of the work done, between 0 and 1. */
  share: number
}

/** Everything the company's system says of the money of a project code. */
export type ProjectEconomics = {
  /** What an hour costs today of who wrote hours on the code, by name. */
  standardCosts: Array<{ person: string; costPerHour: number }>
  ledger: LedgerEntry[]
  invoices: SalesInvoiceLine[]
  purchases: PurchaseLine[]
  receipts: ReceiptLine[]
  vendorInvoices: VendorInvoiceLine[]
  /** How far the work is, period by period; empty when the system does not tell. */
  progress: ProgressReading[]
}

export const NO_PROJECT_ECONOMICS: ProjectEconomics = {
  standardCosts: [],
  ledger: [],
  invoices: [],
  purchases: [],
  receipts: [],
  vendorInvoices: [],
  progress: [],
}
