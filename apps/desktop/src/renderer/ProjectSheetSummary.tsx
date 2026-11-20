import type { Lifetime, LifetimeLine } from '@octo/domain'
import { type ReactNode, useEffect, useState } from 'react'
import { type DataColumn, DataTable } from './DataTable.tsx'
import { lifetimeMail, lifetimeSourceText, progressSourceInTable } from './forecast-text.ts'
import { messages } from './messages.ts'
import { Resizable } from './Resizable.tsx'
import { monthText } from './today-text.ts'

type Props = {
  /** The project code shown, from its start to the month that runs. */
  sheet: Lifetime
  /** Keeps as the costs at budget of the code what its people's caps propose. */
  onUseBudget?: ((sheet: Lifetime, costs: number) => Promise<void>) | undefined
  /** Opens the forecast, where the people declared by hand are taken away. */
  onOpenForecast?: (() => void) | undefined
}

const text = messages.sheet.summary
const { money, share, hours } = messages.forecast
const UNKNOWN = '—'

/** Where a figure comes from: read from a source, computed by Octo, or to be checked. */
type Origin = { label: string; tone: 'source' | 'computed' | 'check' }
const ORIGIN_CLASS: Record<Origin['tone'], string> = {
  source: 'pill pill-source',
  computed: 'pill',
  check: 'pill pill-warning',
}
const BY_OCTO: Origin = { label: text.byOcto, tone: 'computed' }
const BY_SYSTEM: Origin = { label: text.bySystem, tone: 'source' }
/** Kept with the forecast of the project: what stands in for NetSuite while it was not read. */
const BY_FORECAST: Origin = { label: text.byForecast, tone: 'computed' }
/** A figure nothing tells has no source either: the cell says so, it is never left empty. */
const NOT_KNOWN: Origin = { label: text.notKnown, tone: 'computed' }

function OriginMark({ origin }: { origin: Origin }) {
  return <span className={ORIGIN_CLASS[origin.tone]}>{origin.label}</span>
}

/** A line of who worked on the code, already in words: a person, or the suppliers together. */
type PersonRow = { key: string; person: string; hours: string; cost: string; origin: Origin }
const PEOPLE_COLUMNS: DataColumn<PersonRow>[] = [
  {
    key: 'person',
    label: text.person,
    width: '28%',
    cell: (row) => <strong>{row.person}</strong>,
  },
  { key: 'hours', label: text.hours, kind: 'number', width: '60px', cell: (row) => row.hours },
  { key: 'cost', label: text.cost, kind: 'number', width: '88px', cell: (row) => row.cost },
  { key: 'source', label: text.source, cell: (row) => <OriginMark origin={row.origin} /> },
]
/** Hours somebody wrote down are read from a source; those declared by hand are to be checked. */
const LINE_TONE: Record<LifetimeLine['source'], Origin['tone']> = {
  timesheet: 'source',
  no_timesheet: 'source',
  declared: 'check',
  estimate: 'computed',
}
const amount = (value: number | null): string => (value === null ? UNKNOWN : money(value))

const CENTS = 100
const CENT = 0.01
const roundMoney = (value: number): number => Math.round(value * CENTS) / CENTS
const sameAmount = (proposed: number, written: number | null): boolean =>
  written !== null && roundMoney(proposed) === roundMoney(written)

/** A figure of the band: what it is called, what it is worth, and what reads it. */
type Figure = { label: string; value: string; note?: ReactNode }

/** The share of the order an amount is, in words; nothing when either is unknown. */
const ofOrdered = (value: number | null, ordered: number | null): string | undefined =>
  value === null || !ordered ? undefined : text.ofOrdered(share(value / ordered))

/** What the costs Octo computes differ by from those the company's system booked; null unread. */
const varianceOf = (sheet: Lifetime): number | null => {
  const ledger = sheet.economics?.ledger
  return ledger === undefined ? null : sheet.costs - ledger.costs
}

/** The five figures to read first; the last one only when the system's costs were read. */
function bandFigures(sheet: Lifetime): Figure[] {
  const orders = sheet.economics?.billing ?? []
  const [only] = orders
  const variance = varianceOf(sheet)
  return [
    {
      label: text.ordered,
      value: amount(sheet.ordered),
      note:
        orders.length > 1
          ? text.ordersNote(orders.length)
          : only && only.salesOrder !== ''
            ? text.orderNote(only.salesOrder)
            : undefined,
    },
    {
      label: text.invoiced,
      value: amount(sheet.invoiced),
      note: ofOrdered(sheet.invoiced, sheet.ordered),
    },
    {
      label: text.costs,
      value: money(sheet.costs),
      note:
        sheet.supplierCosts > 0
          ? text.withSuppliers(hours(sheet.hours), money(sheet.supplierCosts))
          : text.hoursWorked(hours(sheet.hours)),
    },
    {
      label: text.marginToDate,
      value: share(sheet.marginToDate),
      note: sheet.marginAtEnd === null ? undefined : text.atEnd(share(sheet.marginAtEnd)),
    },
    ...(variance === null
      ? []
      : [
          {
            label: text.variance,
            value: money(variance),
            note:
              Math.abs(variance) < CENT ? (
                <span className="status status-ok">{text.varianceNone}</span>
              ) : (
                <span className="status status-warning">{text.varianceToCheck}</span>
              ),
          },
        ]),
  ]
}

/** A line of the table of the other figures: what it is, a few words on it, where it comes from. */
type Entry = { label: string; note?: string | undefined; value: string; origin: Origin }

/** What the order, the revenue and what is left to settle are worth, each with where it is from. */
function entries(sheet: Lifetime): Entry[] {
  const { ordered, invoiced, recognized, progress } = sheet
  // Without NetSuite read the three amounts are those kept with the forecast of the project.
  const kept = sheet.economics === null ? BY_FORECAST : BY_SYSTEM
  const read = (value: number | null): Origin => (value === null ? NOT_KNOWN : kept)
  const toInvoice = ordered === null || invoiced === null ? null : ordered - invoiced
  const computed = (value: number | null): Origin => (value === null ? NOT_KNOWN : BY_OCTO)
  return [
    { label: text.ordered, value: amount(ordered), origin: read(ordered) },
    {
      label: text.invoicedPlain,
      note: ofOrdered(invoiced, ordered),
      value: amount(invoiced),
      origin: read(invoiced),
    },
    {
      label: text.toInvoice,
      note: ofOrdered(toInvoice, ordered),
      value: amount(toInvoice),
      origin: computed(toInvoice),
    },
    {
      label: text.recognizedPlain,
      note: ofOrdered(recognized, ordered),
      value: amount(recognized),
      origin: read(recognized),
    },
    progress === null
      ? { label: text.progress, note: text.noProgress, value: UNKNOWN, origin: NOT_KNOWN }
      : {
          label: text.progress,
          note: progressSourceInTable(progress),
          value: share(progress.share),
          origin: progress.source === 'system' ? BY_SYSTEM : BY_OCTO,
        },
    sheet.marginAtEnd === null
      ? { label: text.marginAtEnd, note: text.noExpected, value: UNKNOWN, origin: NOT_KNOWN }
      : {
          label: text.marginAtEnd,
          note: text.onCostsInTable(money(sheet.expectedCosts ?? 0)),
          value: share(sheet.marginAtEnd),
          origin: BY_OCTO,
        },
    { label: text.wip, note: text.wipNote, value: amount(sheet.wip), origin: computed(sheet.wip) },
    {
      label: text.toBill,
      note: text.toBillNote,
      value: amount(sheet.toBill),
      origin: computed(sheet.toBill),
    },
  ]
}

const ENTRY_COLUMNS: DataColumn<Entry>[] = [
  {
    key: 'entry',
    label: text.entry,
    cell: (entry) => (
      <>
        {entry.label}
        {entry.note !== undefined && <span className="hint"> · {entry.note}</span>}
      </>
    ),
  },
  { key: 'value', label: text.value, kind: 'number', width: '96px', cell: (entry) => entry.value },
  {
    key: 'source',
    label: text.source,
    width: '110px',
    cell: (entry) => <OriginMark origin={entry.origin} />,
  },
]

/** The costs the company's system booked, group by group, beside those Octo computes. */
function Ledger({ sheet }: { sheet: Lifetime }) {
  const ledger = sheet.economics?.ledger
  if (ledger === undefined) return null
  const difference = sheet.costs - ledger.costs
  return (
    <section aria-label={text.ledger.title}>
      <h4>{text.ledger.title}</h4>
      {ledger.groups.length === 0 ? (
        <p className="hint">{text.ledger.none}</p>
      ) : (
        <>
          <Resizable name={text.ledger.title} className="table-wide table-intrinsic">
            <table className="data" aria-label={text.ledger.title}>
              <thead>
                <tr>
                  <th scope="col">{text.ledger.group}</th>
                  <th scope="col" className="number">
                    {text.ledger.cost}
                  </th>
                </tr>
              </thead>
              <tbody>
                {ledger.groups.map((group) => (
                  <tr key={group.group}>
                    <th scope="row">{group.group}</th>
                    <td className="number">{money(group.cost)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">{text.ledger.total}</th>
                  <td className="number">{money(ledger.costs)}</td>
                </tr>
              </tfoot>
            </table>
          </Resizable>
          <p className="hint">
            {Math.abs(difference) < CENT
              ? text.ledger.same(money(sheet.costs))
              : text.ledger.compare(money(sheet.costs))}
          </p>
        </>
      )}
    </section>
  )
}

/** How each figure is computed, said once and read on request. */
function Rules() {
  return (
    <details className="dashboard-fold">
      <summary className="fold-title">{text.rules.title}</summary>
      <p className="hint">{text.rules.intro}</p>
      <dl className="rules">
        {text.rules.items.map(([name, rule]) => (
          <div key={name}>
            <dt>{name}</dt>
            <dd>{rule}</dd>
          </div>
        ))}
      </dl>
    </details>
  )
}

/** The figures to read first, in one band. */
function Band({ figures }: { figures: readonly Figure[] }) {
  return (
    <dl className="figures" aria-label={text.band}>
      {figures.map((figure) => (
        <div key={figure.label} className="figure">
          <dt>{figure.label}</dt>
          <dd>
            {figure.value}
            {figure.note !== undefined && <span className="figure-note">{figure.note}</span>}
          </dd>
        </div>
      ))}
    </dl>
  )
}

/**
 * A project code over its whole life, as the PM keeps it by hand: what was ordered and invoiced,
 * what it cost so far and by whom, the margin today and at the end.
 */
export function ProjectSheetSummary({ sheet, onUseBudget, onOpenForecast }: Props) {
  const [copied, setCopied] = useState(false)

  // biome-ignore lint/correctness/useExhaustiveDependencies: another code, or the same read again, was not copied yet.
  useEffect(() => setCopied(false), [sheet])

  async function copy() {
    await navigator.clipboard?.writeText(lifetimeMail(sheet))
    setCopied(true)
  }

  const withoutCost = sheet.lines.filter((line) => line.cost === null)
  const proposal = sheet.proposedBudget
  return (
    <section className="sheet-summary" aria-label={text.title}>
      <div className="title-row">
        <p className="hint">{text.through(monthText(sheet.through))}</p>
        <div className="actions">
          {copied && (
            <span className="hint" role="status">
              {text.copied}
            </span>
          )}
          <button type="button" onClick={() => void copy()}>
            {text.copy}
          </button>
        </div>
      </div>
      {sheet.unreadMonths.length > 0 && (
        <p className="warning" role="alert">
          {messages.forecast.unreadMonths(sheet.unreadMonths.join(', '))}
        </p>
      )}
      <Band figures={bandFigures(sheet)} />
      {sheet.supplierCosts > 0 &&
        sheet.lines.some((line) => line.source === 'declared' && (line.cost ?? 0) > 0) && (
          <div className="notice-bar notice-bar-warning">
            <p>{text.doubleCount}</p>
            {onOpenForecast && (
              <button type="button" onClick={onOpenForecast}>
                {messages.openSection(messages.sheet.parts.forecast)}
              </button>
            )}
          </div>
        )}
      {proposal && (
        <p className="hint">
          {text.proposed(
            money(proposal.costs),
            proposal.people
              .map((person) => text.proposedPerson(person.person, hours(person.days)))
              .join(', '),
          )}{' '}
          {proposal.withoutCost.length > 0 && (
            <>{text.proposedWithoutCost(proposal.withoutCost.join(', '))} </>
          )}
          {sameAmount(proposal.costs, sheet.budgetCosts) ? (
            text.proposedInUse
          ) : onUseBudget ? (
            <button
              type="button"
              onClick={() => void onUseBudget(sheet, roundMoney(proposal.costs))}
            >
              {text.useProposed}
            </button>
          ) : null}
        </p>
      )}
      <div className="sheet-columns">
        <div className="sheet-column">
          <section aria-label={text.entries}>
            <h4>{text.entries}</h4>
            <DataTable
              label={text.entries}
              columns={ENTRY_COLUMNS}
              rows={entries(sheet)}
              rowKey={(entry) => entry.label}
            />
          </section>
          <Rules />
        </div>
        <div className="sheet-column">
          <section aria-label={text.people}>
            <h4>{text.people}</h4>
            {sheet.lines.length === 0 ? (
              <p className="hint">{text.noLines}</p>
            ) : (
              <DataTable
                label={text.people}
                columns={PEOPLE_COLUMNS}
                rows={[
                  ...sheet.lines.map((line) => ({
                    key: `${line.source} ${line.person}`,
                    person: line.person,
                    hours: hours(line.hours),
                    cost: amount(line.cost),
                    origin: { label: lifetimeSourceText(line), tone: LINE_TONE[line.source] },
                  })),
                  ...(sheet.supplierCosts > 0
                    ? [
                        {
                          key: 'suppliers',
                          person: text.suppliersLine,
                          hours: '',
                          cost: money(sheet.supplierCosts),
                          origin: { label: text.suppliersSource, tone: 'source' as const },
                        },
                      ]
                    : []),
                ]}
                rowKey={(row) => row.key}
                footer={
                  <tr>
                    <th scope="row">{text.total}</th>
                    <td className="number">{hours(sheet.hours)}</td>
                    <td className="number">{money(sheet.costs)}</td>
                    <td />
                  </tr>
                }
              />
            )}
            {sheet.estimatedHours > 0 && (
              <p className="hint">
                {text.estimated(hours(sheet.estimatedHours), money(sheet.estimatedCosts))}
              </p>
            )}
            {withoutCost.length > 0 && (
              <p className="warning">
                {text.withoutCost(withoutCost.map((line) => line.person).join(', '))}
              </p>
            )}
            {sheet.notApprovedHours > 0 && (
              <p className="hint">{messages.forecast.notApproved(hours(sheet.notApprovedHours))}</p>
            )}
          </section>
          <Ledger sheet={sheet} />
        </div>
      </div>
    </section>
  )
}
