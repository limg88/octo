import type { Lifetime } from '@octo/domain'
import { useEffect, useState } from 'react'
import { lifetimeMail, lifetimeSourceText, progressSourceText } from './forecast-text.ts'
import { messages } from './messages.ts'
import { monthText } from './today-text.ts'

type Props = {
  /** The project code shown, from its start to the month that runs. */
  sheet: Lifetime
  /** Keeps as the costs at budget of the code what its people's caps propose. */
  onUseBudget?: ((sheet: Lifetime, costs: number) => Promise<void>) | undefined
}

const text = messages.sheet.summary
const { money, share, hours } = messages.forecast
const UNKNOWN = '—'
const amount = (value: number | null): string => (value === null ? UNKNOWN : money(value))

const CENTS = 100
const roundMoney = (value: number): number => Math.round(value * CENTS) / CENTS
const sameAmount = (proposed: number, written: number | null): boolean =>
  written !== null && roundMoney(proposed) === roundMoney(written)

/** A figure of the sheet: what it is called, what it is worth, and a line that reads it. */
export type Figure = { label: string; value: string; note?: string | undefined }

/** The share of the order an amount is, in words; nothing when either is unknown. */
const ofOrdered = (value: number | null, ordered: number | null): string | undefined =>
  value === null || !ordered ? undefined : text.ofOrdered(share(value / ordered))

function orderFigures(sheet: Lifetime): Figure[] {
  const { ordered, invoiced, recognized } = sheet
  const toInvoice = ordered === null || invoiced === null ? null : ordered - invoiced
  return [
    { label: text.ordered, value: amount(ordered) },
    { label: text.invoiced, value: amount(invoiced), note: ofOrdered(invoiced, ordered) },
    { label: text.toInvoice, value: amount(toInvoice), note: ofOrdered(toInvoice, ordered) },
    { label: text.recognized, value: amount(recognized), note: ofOrdered(recognized, ordered) },
  ]
}

function marginFigures(sheet: Lifetime): Figure[] {
  return [
    {
      label: text.costs,
      value: money(sheet.costs),
      note:
        sheet.supplierCosts > 0
          ? text.withSuppliers(hours(sheet.hours), money(sheet.supplierCosts))
          : text.hoursWorked(hours(sheet.hours)),
    },
    { label: text.marginToDate, value: share(sheet.marginToDate) },
    sheet.progress === null
      ? { label: text.progress, value: UNKNOWN, note: text.noProgress }
      : {
          label: text.progress,
          value: share(sheet.progress.share),
          note: progressSourceText(sheet.progress),
        },
    sheet.marginAtEnd === null
      ? { label: text.marginAtEnd, value: UNKNOWN, note: text.noExpected }
      : {
          label: text.marginAtEnd,
          value: share(sheet.marginAtEnd),
          note: text.onCosts(money(sheet.expectedCosts ?? 0)),
        },
  ]
}

/** What is left to settle between what the project cost, what it earned and what was invoiced. */
function settleFigures(sheet: Lifetime): Figure[] {
  return [
    { label: text.wip, value: amount(sheet.wip), note: text.wipNote },
    { label: text.toBill, value: amount(sheet.toBill), note: text.toBillNote },
  ]
}

const CENT = 0.01

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
          <div className="table-wide table-intrinsic">
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
          </div>
          <p className="hint">
            {Math.abs(difference) < CENT
              ? text.ledger.same(money(sheet.costs))
              : text.ledger.compare(money(sheet.costs), money(difference))}
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

export function Figures({ title, figures }: { title: string; figures: readonly Figure[] }) {
  return (
    <section aria-label={title}>
      <h4>{title}</h4>
      <dl className="figures figures-four">
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
    </section>
  )
}

/**
 * A project code over its whole life, as the PM keeps it by hand: what was ordered and invoiced,
 * what it cost so far and by whom, the margin today and at the end.
 */
export function ProjectSheetSummary({ sheet, onUseBudget }: Props) {
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
    <section aria-label={text.title}>
      <p className="hint">{text.through(monthText(sheet.through))}</p>
      {sheet.unreadMonths.length > 0 && (
        <p className="warning" role="alert">
          {messages.forecast.unreadMonths(sheet.unreadMonths.join(', '))}
        </p>
      )}
      <Figures title={text.groups.order} figures={orderFigures(sheet)} />
      <Figures title={text.groups.margin} figures={marginFigures(sheet)} />
      <Figures title={text.groups.settle} figures={settleFigures(sheet)} />
      {sheet.supplierCosts > 0 && sheet.lines.some((line) => line.source === 'declared') && (
        <p className="warning">{text.doubleCount}</p>
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
      <section aria-label={text.people}>
        <h4>{text.people}</h4>
        {sheet.lines.length === 0 ? (
          <p className="hint">{text.noLines}</p>
        ) : (
          <div className="table-wide table-intrinsic">
            <table className="data" aria-label={text.people}>
              <thead>
                <tr>
                  <th scope="col">{text.person}</th>
                  <th scope="col" className="number">
                    {text.hours}
                  </th>
                  <th scope="col" className="number">
                    {text.cost}
                  </th>
                  <th scope="col">{text.source}</th>
                </tr>
              </thead>
              <tbody>
                {sheet.lines.map((line) => (
                  <tr key={`${line.source} ${line.person}`}>
                    <th scope="row">{line.person}</th>
                    <td className="number">{hours(line.hours)}</td>
                    <td className="number">{amount(line.cost)}</td>
                    <td>{lifetimeSourceText(line)}</td>
                  </tr>
                ))}
                {sheet.supplierCosts > 0 && (
                  <tr>
                    <th scope="row">{text.suppliersLine}</th>
                    <td />
                    <td className="number">{money(sheet.supplierCosts)}</td>
                    <td>{text.suppliersSource}</td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row">{text.total}</th>
                  <td className="number">{hours(sheet.hours)}</td>
                  <td className="number">{money(sheet.costs)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
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
      <Rules />
      <div className="actions">
        <button type="button" onClick={() => void copy()}>
          {text.copy}
        </button>
        {copied && (
          <span className="hint" role="status">
            {text.copied}
          </span>
        )}
      </div>
    </section>
  )
}
