import type { BillingMilestone, Lifetime, SheetPlan, SupplierCycle } from '@octo/domain'
import { useState } from 'react'
import { amountOf, amountText, shortMonthText } from './forecast-text.ts'
import { messages } from './messages.ts'
import { blankRow, orOneRow, type Row, type RowsColumn, RowsField } from './RowsField.tsx'
import type { Section } from './sections.ts'

type Props = {
  /** The project code shown, from its start to the month that runs. */
  sheet: Lifetime
  /** The plan as the PM is typing it: the invoices planned are part of it. */
  draft: SheetPlan
  dirty: boolean
  onChange: (update: (plan: SheetPlan) => SheetPlan) => void
  onSave: () => void
  onOpenSection?: ((section: Section) => void) | undefined
}

const text = messages.sheet.billing
const { money } = messages.forecast
const BLANK = ''

type MilestoneKey = 'salesOrder' | 'month' | 'amount'
const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/

const typedOf = (milestone: BillingMilestone): Row<MilestoneKey> => ({
  salesOrder: milestone.salesOrder,
  month: milestone.month,
  amount: amountText(milestone.amount),
})

/** A row typed as an invoice planned; null when the month or the amount are not what they say. */
function milestoneOf(row: Row<MilestoneKey>): BillingMilestone | null {
  const amount = amountOf(row.amount)
  const month = row.month.trim()
  if (!MONTH.test(month) || amount === null || amount <= 0) return null
  return { salesOrder: row.salesOrder.trim(), month, amount }
}

type PlanProps = Pick<Props, 'sheet' | 'draft' | 'dirty' | 'onChange' | 'onSave'>

/**
 * The invoices the PM plans to issue, typed one per row, and month by month what was planned
 * beside what the company's system says was invoiced.
 */
function BillingPlan({ sheet, draft, dirty, onChange, onSave }: PlanProps) {
  const orders = (sheet.economics?.billing ?? [])
    .map((order) => order.salesOrder)
    .filter((order) => order !== '')
  const columns: RowsColumn<MilestoneKey>[] = [
    { key: 'salesOrder', label: text.planColumns.salesOrder, suggestions: orders },
    { key: 'month', label: text.planColumns.month, width: '150px' },
    { key: 'amount', label: text.planColumns.amount, kind: 'amount', width: '150px' },
  ]
  const [rows, setRows] = useState<Row<MilestoneKey>[]>(() =>
    orOneRow(draft.milestones.map(typedOf), columns),
  )
  const wrong = rows.flatMap((row, index) =>
    blankRow(row) || milestoneOf(row) !== null ? [] : [text.planWrong(index + 1)],
  )
  const planned = new Map<string, number>()
  for (const milestone of draft.milestones) {
    planned.set(milestone.month, (planned.get(milestone.month) ?? 0) + milestone.amount)
  }
  const invoiced = new Map<string, number>()
  for (const order of sheet.economics?.billing ?? []) {
    for (const [month, value] of Object.entries(order.months)) {
      invoiced.set(month, (invoiced.get(month) ?? 0) + value)
    }
  }
  const months = [...new Set([...planned.keys(), ...invoiced.keys()])].sort()
  const sum = (amounts: Iterable<number>): number =>
    [...amounts].reduce((total, value) => total + value, 0)
  return (
    <section aria-label={text.planTitle}>
      <h4>{text.planTitle}</h4>
      <p className="hint">{text.planIntro}</p>
      <RowsField
        label={text.planTitle}
        columns={columns}
        rows={rows}
        onChange={(next) => {
          setRows(next)
          const milestones = next.flatMap((row) => {
            const milestone = milestoneOf(row)
            return milestone === null ? [] : [milestone]
          })
          onChange((plan) => ({ ...plan, milestones }))
        }}
        addLabel={text.planAdd}
        cellLabel={(column, row) => text.planCell(text.planColumns[column], row)}
        removeLabel={text.planRemove}
      />
      {wrong.length > 0 && (
        <ul className="missing" role="alert">
          {wrong.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      )}
      <div className="actions">
        <button
          type="button"
          className={dirty ? 'primary' : undefined}
          disabled={!dirty || wrong.length > 0}
          onClick={onSave}
        >
          {text.planSave}
        </button>
      </div>
      {planned.size > 0 && (
        <div className="table-wide table-intrinsic">
          <table className="data" aria-label={text.compareTable}>
            <thead>
              <tr>
                <th scope="col">{text.month}</th>
                <th scope="col" className="number">
                  {text.planned}
                </th>
                <th scope="col" className="number">
                  {text.invoiced}
                </th>
                <th scope="col" className="number">
                  {text.difference}
                </th>
              </tr>
            </thead>
            <tbody>
              {months.map((month) => (
                <tr key={month}>
                  <th scope="row">{shortMonthText(month)}</th>
                  <td className="number">{money(planned.get(month) ?? 0)}</td>
                  <td className="number">{money(invoiced.get(month) ?? 0)}</td>
                  <td className="number">
                    {money((invoiced.get(month) ?? 0) - (planned.get(month) ?? 0))}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">{text.total}</th>
                <td className="number">{money(sum(planned.values()))}</td>
                <td className="number">{money(sum(invoiced.values()))}</td>
                <td className="number">{money(sum(invoiced.values()) - sum(planned.values()))}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  )
}

/** What was invoiced to the client on each sales order, month by month. */
function ClientBilling({ sheet }: { sheet: Lifetime }) {
  const economics = sheet.economics
  if (economics === null) return null
  const { billing, billingMonths } = economics
  return (
    <section aria-label={text.client}>
      <h4>{text.client}</h4>
      {billing.length === 0 ? (
        <p className="hint">{text.noInvoices}</p>
      ) : (
        <div className="table-wide table-intrinsic">
          <table className="data" aria-label={text.clientTable}>
            <thead>
              <tr>
                <th scope="col">{text.salesOrder}</th>
                {billingMonths.map((month) => (
                  <th key={month} scope="col" className="number">
                    {shortMonthText(month)}
                  </th>
                ))}
                <th scope="col" className="number">
                  {text.total}
                </th>
              </tr>
            </thead>
            <tbody>
              {billing.map((order) => (
                <tr key={order.salesOrder}>
                  <th scope="row">
                    {order.salesOrder === '' ? text.noSalesOrder : order.salesOrder}
                  </th>
                  {billingMonths.map((month) => (
                    <td key={month} className="number">
                      {order.months[month] === undefined ? BLANK : money(order.months[month])}
                    </td>
                  ))}
                  <td className="number">{money(order.invoiced)}</td>
                </tr>
              ))}
            </tbody>
            {billing.length > 1 && (
              <tfoot>
                <tr>
                  <th scope="row">{text.total}</th>
                  {billingMonths.map((month) => (
                    <td key={month} className="number">
                      {money(billing.reduce((sum, order) => sum + (order.months[month] ?? 0), 0))}
                    </td>
                  ))}
                  <td className="number">{money(economics.invoiced)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </section>
  )
}

/** The orders to the suppliers: what was ordered, what was delivered, what they invoiced. */
function SupplierBilling({ suppliers }: { suppliers: SupplierCycle }) {
  const figures: Array<{ label: string; value: number; note?: string }> = [
    { label: text.ordered, value: suppliers.ordered },
    { label: text.received, value: suppliers.received, note: text.receivedNote },
    { label: text.invoiced, value: suppliers.invoiced },
    { label: text.toInvoice, value: suppliers.toInvoice },
  ]
  return (
    <section aria-label={text.suppliers}>
      <h4>{text.suppliers}</h4>
      <dl className="figures figures-four">
        {figures.map((figure) => (
          <div key={figure.label} className="figure">
            <dt>{figure.label}</dt>
            <dd>
              {money(figure.value)}
              {figure.note !== undefined && <span className="figure-note">{figure.note}</span>}
            </dd>
          </div>
        ))}
      </dl>
      <div className="table-wide table-intrinsic">
        <table className="data" aria-label={text.suppliersTable}>
          <thead>
            <tr>
              <th scope="col">{text.vendor}</th>
              <th scope="col">{text.order}</th>
              <th scope="col" className="number">
                {text.ordered}
              </th>
              <th scope="col" className="number">
                {text.received}
              </th>
              <th scope="col" className="number">
                {text.invoiced}
              </th>
            </tr>
          </thead>
          <tbody>
            {suppliers.orders.map((order) => (
              <tr key={`${order.vendor} ${order.order}`}>
                <th scope="row">{order.vendor === '' ? text.noVendor : order.vendor}</th>
                <td>{order.order === '' ? text.noOrder : order.order}</td>
                <td className="number">{money(order.ordered)}</td>
                <td className="number">{money(order.received)}</td>
                <td className="number">{money(order.invoiced)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

/**
 * The invoices of a project code as the company's system has them: those to the client, by sales
 * order and by month, and the orders to its suppliers when it has any.
 */
export function ProjectSheetBilling({
  sheet,
  draft,
  dirty,
  onChange,
  onSave,
  onOpenSection,
}: Props) {
  const plan = (
    <BillingPlan sheet={sheet} draft={draft} dirty={dirty} onChange={onChange} onSave={onSave} />
  )
  if (sheet.economics === null) {
    return (
      <section aria-label={text.title}>
        {plan}
        <p className="hint">{text.notRead}</p>
        {onOpenSection && (
          <div className="actions">
            <button type="button" onClick={() => onOpenSection('sources')}>
              {messages.openSection(messages.sourcesTab)}
            </button>
          </div>
        )}
      </section>
    )
  }
  const { suppliers } = sheet.economics
  return (
    <section aria-label={text.title}>
      <ClientBilling sheet={sheet} />
      {plan}
      {suppliers === null ? (
        <p className="hint">{text.noSuppliers}</p>
      ) : (
        <SupplierBilling suppliers={suppliers} />
      )}
    </section>
  )
}
