import type { Lifetime, Project } from '@octo/domain'
import { useEffect, useState } from 'react'
import type { ErrorCode, OctoApi } from '../shared/api.ts'
import { Failure } from './Failure.tsx'
import { lifetimeMail, lifetimeSourceText } from './forecast-text.ts'
import { messages } from './messages.ts'
import { Waiting } from './Spinner.tsx'
import type { Section } from './sections.ts'

type Props = {
  api: Pick<OctoApi, 'forecastLifetime'>
  project: Project
  onOpenSection?: ((section: Section) => void) | undefined
  /** Keeps as the costs at budget of a code what its people's caps propose. */
  onUseBudget?: ((life: Lifetime, costs: number) => Promise<void>) | undefined
  /** Changes when the settings are saved: the life of the codes is then read again. */
  version?: number
}

const text = messages.forecast.lifetime
const { money, share, hours } = messages.forecast
const amount = (value: number | null): string => (value === null ? '—' : money(value))
/** An amount with the share of the order it is, when both are known. */
const ofOrder = (value: number | null, ordered: number | null): string =>
  value === null ? '—' : ordered ? `${money(value)} (${share(value / ordered)})` : money(value)

const CENTS = 100
const roundMoney = (value: number): number => Math.round(value * CENTS) / CENTS
const sameAmount = (proposed: number, written: number | null): boolean =>
  written !== null && roundMoney(proposed) === roundMoney(written)

/**
 * A project code over its whole life, as the PM of a fixed price keeps it by hand: who worked
 * how much and at what cost, what was invoiced and recognised, the margin today and at the end.
 */
export function ForecastLifetime({ api, project, onOpenSection, onUseBudget, version }: Props) {
  const [lifetimes, setLifetimes] = useState<Lifetime[] | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState<ErrorCode | null>(null)
  const [copied, setCopied] = useState(false)

  // biome-ignore lint/correctness/useExhaustiveDependencies: `version` only says when to read again.
  useEffect(() => {
    setError(null)
    setCopied(false)
    void api.forecastLifetime(project.id).then((result) => {
      if (!result.ok) return setError(result.code)
      setLifetimes(result.value)
      // A fixed price is what this page is for: it is shown first when there is one.
      const first = result.value.find((entry) => entry.kind === 'fixed_price') ?? result.value[0]
      setCode((current) =>
        result.value.some((entry) => entry.code === current) ? current : (first?.code ?? ''),
      )
    })
  }, [api, project.id, version])

  if (error) return <Failure code={error} onOpen={onOpenSection} />
  if (lifetimes === null) return <Waiting>{text.loading}</Waiting>
  const life = lifetimes.find((entry) => entry.code === code)
  if (!life) return <p className="hint">{messages.forecast.noRows}</p>

  async function copy(shown: Lifetime) {
    await navigator.clipboard?.writeText(lifetimeMail(shown))
    setCopied(true)
  }

  const withoutCost = life.lines.filter((line) => line.cost === null)
  const proposal = life.proposedBudget
  return (
    <section aria-label={text.title}>
      {lifetimes.length > 1 && (
        <label>
          {text.code}{' '}
          <select
            value={code}
            onChange={(event) => {
              setCode(event.target.value)
              setCopied(false)
            }}
          >
            {lifetimes.map((entry) => (
              <option key={entry.code} value={entry.code}>
                {entry.description === '' ? entry.code : `${entry.code} · ${entry.description}`}
              </option>
            ))}
          </select>
        </label>
      )}
      <h3>
        {life.code}
        {life.description !== '' && <> · {life.description}</>}{' '}
        <span className="hint">({messages.forecast.kinds[life.kind]})</span>
      </h3>
      <p className="hint">{text.through(life.through)}</p>
      <dl className="lifetime-figures">
        <dt>{text.ordered}</dt>
        <dd>{amount(life.ordered)}</dd>
        <dt>{text.invoiced}</dt>
        <dd>{ofOrder(life.invoiced, life.ordered)}</dd>
        <dt>{text.recognized}</dt>
        <dd>{ofOrder(life.recognized, life.ordered)}</dd>
      </dl>
      {life.unreadMonths.length > 0 && (
        <p className="warning" role="alert">
          {messages.forecast.unreadMonths(life.unreadMonths.join(', '))}
        </p>
      )}
      {life.lines.length === 0 ? (
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
              {life.lines.map((line) => (
                <tr key={`${line.source} ${line.person}`}>
                  <th scope="row">{line.person}</th>
                  <td className="number">{hours(line.hours)}</td>
                  <td className="number">{amount(line.cost)}</td>
                  <td>{lifetimeSourceText(line)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">{text.total}</th>
                <td className="number">{hours(life.hours)}</td>
                <td className="number">{money(life.costs)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      {life.estimatedHours > 0 && (
        <p className="hint">
          {text.estimated(hours(life.estimatedHours), money(life.estimatedCosts))}
        </p>
      )}
      {withoutCost.length > 0 && (
        <p className="warning">
          {text.withoutCost(withoutCost.map((line) => line.person).join(', '))}
        </p>
      )}
      {life.notApprovedHours > 0 && (
        <p className="hint">{messages.forecast.notApproved(hours(life.notApprovedHours))}</p>
      )}
      <dl className="lifetime-figures">
        <dt>{text.marginToDate}</dt>
        <dd>{share(life.marginToDate)}</dd>
        <dt>{text.budgetCosts}</dt>
        <dd>
          {life.budgetCosts === null
            ? text.noBudget
            : `${money(life.budgetCosts)} · ${text.progress(share(life.progress))}`}
        </dd>
        <dt>{text.marginAtEnd}</dt>
        <dd>
          {life.marginAtEnd === null
            ? text.noExpected
            : `${share(life.marginAtEnd)} · ${text.onCosts(money(life.expectedCosts ?? 0))}`}
        </dd>
      </dl>
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
          {sameAmount(proposal.costs, life.budgetCosts) ? (
            text.proposedInUse
          ) : onUseBudget ? (
            <button
              type="button"
              onClick={() => void onUseBudget(life, roundMoney(proposal.costs))}
            >
              {text.useProposed}
            </button>
          ) : null}
        </p>
      )}
      <div className="actions">
        <button type="button" onClick={() => void copy(life)}>
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
