import type { Lifetime, SupplierCycle } from '@octo/domain'
import { type DataColumn, DataTable } from './DataTable.tsx'
import { shortMonthText } from './forecast-text.ts'
import { messages } from './messages.ts'
import { Resizable } from './Resizable.tsx'
import type { Section } from './sections.ts'

type Props = {
  /** The project code shown, from its start to the month that runs. */
  sheet: Lifetime
  onOpenSection?: ((section: Section) => void) | undefined
}

const text = messages.sheet.billing
const { money } = messages.forecast
const BLANK = ''

type SupplierOrder = SupplierCycle['orders'][number]
/** Everything on this page is read from the company's system: each row says so. */
const fromSystem = <span className="pill pill-source">{text.fromSystem}</span>
const SOURCE_WIDTH = '140px'
const paid = (
  key: 'ordered' | 'received' | 'invoiced',
  label: string,
): DataColumn<SupplierOrder> => ({
  key,
  label,
  kind: 'number',
  width: '120px',
  cell: (order) => money(order[key]),
})
const SUPPLIER_COLUMNS: DataColumn<SupplierOrder>[] = [
  {
    key: 'vendor',
    label: text.vendor,
    cell: (order) => <strong>{order.vendor === '' ? text.noVendor : order.vendor}</strong>,
  },
  {
    key: 'order',
    label: text.order,
    cell: (order) => (order.order === '' ? text.noOrder : order.order),
  },
  paid('ordered', text.ordered),
  paid('received', text.received),
  paid('invoiced', text.invoiced),
  {
    key: 'toInvoice',
    label: text.toInvoice,
    kind: 'number',
    width: '120px',
    cell: (order) => money(order.ordered - order.invoiced),
  },
  { key: 'source', label: text.source, width: SOURCE_WIDTH, cell: () => fromSystem },
]

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
        <Resizable name={text.clientTable} className="table-wide table-intrinsic">
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
                <th scope="col" style={{ width: SOURCE_WIDTH }}>
                  {text.source}
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
                  <td>{fromSystem}</td>
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
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </Resizable>
      )}
    </section>
  )
}

/** The orders to the suppliers: what was ordered, what was delivered, what they invoiced. */
function SupplierBilling({ suppliers }: { suppliers: SupplierCycle }) {
  return (
    <section aria-label={text.suppliers}>
      <h4>{text.suppliers}</h4>
      <DataTable
        label={text.suppliersTable}
        columns={SUPPLIER_COLUMNS}
        rows={suppliers.orders}
        rowKey={(order) => `${order.vendor} ${order.order}`}
        footer={
          <tr>
            <th scope="row">{text.total}</th>
            <td />
            <td className="number">{money(suppliers.ordered)}</td>
            <td className="number">{money(suppliers.received)}</td>
            <td className="number">{money(suppliers.invoiced)}</td>
            <td className="number">{money(suppliers.toInvoice)}</td>
            <td />
          </tr>
        }
      />
      <p className="hint">{text.receivedNote}</p>
    </section>
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
