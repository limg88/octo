import type { ProgressInvoices as Invoices } from '@octo/application'
import type { OrderInvoice, PositionInvoice } from '@octo/domain'
import { useEffect, useState } from 'react'
import { type DataColumn, DataTable } from './DataTable.tsx'
import { KnownList } from './KnownList.tsx'
import { dateText, messages } from './messages.ts'

type Props = {
  invoices: Invoices
  /** The order as the form of the client names it. */
  order: string
  /** The sales orders the PM already said are this order. */
  linked: readonly string[]
  onLink: (salesOrders: string[]) => void
  /** Takes the invoices Octo did not know as requests already made. */
  onRegister: () => void
}

const text = messages.progress.invoices

const invoiceWords = (invoice: OrderInvoice): string =>
  text.invoice(invoice.id, invoice.date === '' ? '' : dateText(invoice.date), invoice.status)

/**
 * What the company system has billed of the order, beside what was asked through Octo: which
 * positions have their invoice, and which invoices Octo does not know as requests.
 */
export function ProgressInvoices({ invoices, order, linked, onLink, onRegister }: Props) {
  const [choosing, setChoosing] = useState(linked.length === 0)
  const [chosen, setChosen] = useState<string[]>(() =>
    linked.length > 0 ? [...linked] : invoices.suggested,
  )
  // What is ticked follows what is linked; with nothing linked yet, what Octo proposes.
  useEffect(() => {
    setChosen(linked.length > 0 ? [...linked] : invoices.suggested)
    setChoosing(linked.length === 0)
  }, [linked, invoices.suggested])

  const state = invoices.order
  const columns: DataColumn<PositionInvoice>[] = [
    {
      key: 'position',
      label: text.columnPosition,
      width: '120px',
      cell: (position) => position.code,
      sort: (position) => position.code,
      text: (position) => position.code,
    },
    {
      key: 'amount',
      label: text.columnAmount,
      kind: 'number',
      width: '140px',
      cell: (position) => messages.progress.money(position.amount),
      sort: (position) => position.amount,
    },
    {
      key: 'state',
      label: text.columnState,
      cell: (position) =>
        position.invoice ? (
          <>
            <span className="status status-ok">{text.billed}</span>{' '}
            <span className="hint">{invoiceWords(position.invoice)}</span>
          </>
        ) : (
          <span className="status status-warning">{text.notBilled}</span>
        ),
      sort: (position) => (position.invoice ? 1 : 0),
      text: (position) =>
        position.invoice ? `${text.billed} ${invoiceWords(position.invoice)}` : text.notBilled,
    },
  ]
  const unmatched =
    state?.invoices.filter(
      (invoice) => !state.positions.some((position) => position.invoice === invoice),
    ) ?? []

  return (
    <section className="panel settings-panel progress-invoices" aria-label={text.title}>
      <header className="progress-invoices-head">
        <h4>{text.title}</h4>
        {!choosing && (
          <button type="button" className="quiet" onClick={() => setChoosing(true)}>
            {text.change(linked.join(', '))}
          </button>
        )}
      </header>
      {choosing ? (
        <>
          <p className="hint">{text.linkHint(order)}</p>
          {invoices.suggested.length > 0 && linked.length === 0 && (
            <p className="badge">{text.suggested(invoices.suggested.join(', '))}</p>
          )}
          <KnownList
            label={text.salesOrders}
            known={invoices.salesOrders}
            chosen={chosen}
            onChange={setChosen}
          />
          <div className="actions">
            <button type="button" className="primary" onClick={() => onLink(chosen)}>
              {text.link}
            </button>
            {linked.length > 0 && (
              <button type="button" onClick={() => setChoosing(false)}>
                {messages.cancel}
              </button>
            )}
          </div>
        </>
      ) : (
        state && (
          <>
            {state.fulfilled && <p className="badge badge-ok">{text.fulfilled}</p>}
            {state.unregistered.length > 0 && (
              <div className="notice-bar notice-bar-warning progress-register">
                <p role="status">
                  {text.unregistered(
                    state.unregistered.length,
                    state.unregistered.map((invoice) => invoice.id).join(', '),
                  )}
                </p>
                <button type="button" onClick={onRegister}>
                  {text.register}
                </button>
              </div>
            )}
            <DataTable
              label={text.title}
              columns={columns}
              rows={state.positions}
              rowKey={(position) => position.code}
            />
            {unmatched.length > 0 && (
              <p className="hint">
                {text.unmatched(
                  unmatched
                    .map(
                      (invoice) =>
                        `${invoiceWords(invoice)} · ${messages.progress.money(invoice.amount)}`,
                    )
                    .join('; '),
                )}
              </p>
            )}
            <p className="hint">{text.how}</p>
          </>
        )
      )}
    </section>
  )
}
