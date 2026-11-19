import type { TicketOutcome, TicketsToCreate } from '@octo/application'
import { useState } from 'react'
import type { ErrorCode, OctoApi } from '../shared/api.ts'
import { errorText, messages } from './messages.ts'
import { BusyButton } from './Spinner.tsx'

type Props = {
  api: Pick<OctoApi, 'missingTickets' | 'createTickets'>
  projectId: string
  /** The run of the alignment whose missing tickets are offered. */
  runId: string
}

const text = messages.tickets
const KEY = /^[A-Z][A-Z0-9_]{1,19}$/

/**
 * The tickets an alignment found missing, to create in the internal Jira: the PM sees them,
 * chooses, says where, and confirms. Nothing is written before the confirmation, and nothing but
 * what is ticked.
 */
export function MissingTickets({ api, projectId, runId }: Props) {
  const [found, setFound] = useState<TicketsToCreate | null>(null)
  const [chosen, setChosen] = useState<readonly string[]>([])
  const [projectKey, setProjectKey] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [outcomes, setOutcomes] = useState<TicketOutcome[]>([])
  const [error, setError] = useState<ErrorCode | null>(null)

  async function load() {
    setError(null)
    const result = await api.missingTickets(projectId, runId)
    if (!result.ok) return setError(result.code)
    setFound(result.value)
    setProjectKey(result.value.projectKey)
    setChosen(result.value.tickets.filter((ticket) => ticket.key === null).map((t) => t.summary))
  }

  async function create() {
    setBusy(true)
    setError(null)
    const result = await api.createTickets(projectId, runId, [...chosen], projectKey)
    setBusy(false)
    setConfirming(false)
    if (!result.ok) return setError(result.code)
    setOutcomes(result.value)
    await load()
  }

  if (found === null) {
    return (
      <div className="actions">
        <button type="button" onClick={() => void load()}>
          {text.open}
        </button>
        {error && <span className="warning">{errorText(error)}</span>}
      </div>
    )
  }
  const errorOf = (summary: string) => outcomes.find((o) => o.summary === summary)?.error ?? null
  const ready = chosen.length > 0 && KEY.test(projectKey)
  return (
    <section className="box tickets" aria-label={text.title}>
      <strong>{text.title}</strong>
      <p className="hint">{text.about(found.site)}</p>
      {found.tickets.length === 0 ? (
        <p className="hint">{text.none}</p>
      ) : (
        <ul className="tickets-list">
          {found.tickets.map((ticket) => (
            <li key={ticket.summary}>
              <label className="check">
                <input
                  type="checkbox"
                  disabled={ticket.key !== null || busy}
                  checked={ticket.key !== null || chosen.includes(ticket.summary)}
                  onChange={(event) =>
                    setChosen(
                      event.target.checked
                        ? [...chosen, ticket.summary]
                        : chosen.filter((summary) => summary !== ticket.summary),
                    )
                  }
                />
                <span>
                  {ticket.summary} <span className="hint">· {ticket.type}</span>
                </span>
              </label>
              {ticket.key !== null && (
                <span className="badge badge-ok">{text.created(ticket.key)}</span>
              )}
              {errorOf(ticket.summary) !== null && (
                <span className="badge badge-warning">{text.refused}</span>
              )}
            </li>
          ))}
        </ul>
      )}
      <label className="field">
        {text.project}
        <input
          value={projectKey}
          placeholder={text.projectHint}
          onChange={(event) => setProjectKey(event.target.value.trim().toUpperCase())}
        />
      </label>
      {confirming ? (
        <div className="actions" role="alert">
          <span>{text.confirm(chosen.length, projectKey, found.site)}</span>
          <BusyButton
            className="primary"
            busy={busy}
            busyLabel={text.creating}
            onClick={() => void create()}
          >
            {text.yes}
          </BusyButton>
          <button
            type="button"
            className="quiet"
            disabled={busy}
            onClick={() => setConfirming(false)}
          >
            {messages.cancel}
          </button>
        </div>
      ) : (
        <div className="actions">
          <button type="button" disabled={!ready} onClick={() => setConfirming(true)}>
            {text.create(chosen.length)}
          </button>
        </div>
      )}
      {error && (
        <p className="warning" role="alert">
          {errorText(error)}
        </p>
      )}
    </section>
  )
}
