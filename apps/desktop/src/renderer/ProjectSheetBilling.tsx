import type { Lifetime, SupplierCycle } from '@octo/domain'
import { shortMonthText } from './forecast-text.ts'
import { messages } from './messages.ts'
import { type Figure, Figures } from './ProjectSheetSummary.tsx'
import type { Section } from './sections.ts'

type Props = {
  /** The project code shown, from its start to the month that runs. */
  sheet: Lifetime
  onOpenSection?: ((section: Section) => void) | undefined
}

const text = messages.sheet.billing
const { money } = messages.forecast
const BLANK = ''

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
  const figures: Figure[] = [
    { label: text.ordered, value: money(suppliers.ordered) },
    { label: text.received, value: money(suppliers.received), note: text.receivedNote },
    { label: text.invoiced, value: money(suppliers.invoiced) },
    { label: text.toInvoice, value: money(suppliers.toInvoice) },
  ]
  return (
    <>
      <Figures title={text.suppliers} figures={figures} />
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
    </>
  )
}

/**
 * The invoices of a project code as the company's system has them: those to the client, by sales
 * order and by month, and the orders to its suppliers when it has any.
 */
export function ProjectSheetBilling({ sheet, onOpenSection }: Props) {
  if (sheet.economics === null) {
    return (
      <section aria-label={text.title}>
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
      {suppliers === null ? (
        <p className="hint">{text.noSuppliers}</p>
      ) : (
        <SupplierBilling suppliers={suppliers} />
      )}
    </section>
  )
}
