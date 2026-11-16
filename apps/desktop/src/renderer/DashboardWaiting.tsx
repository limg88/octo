import type { Reminder, DashboardView as View } from '@octo/application'
import type { WaitingRow } from '@octo/domain'
import { useState } from 'react'
import type { ErrorCode, Result } from '../shared/api.ts'
import { OpenItem } from './DashboardParts.tsx'
import { Failure } from './Failure.tsx'
import { dateText, messages } from './messages.ts'
import { BusyButton } from './Spinner.tsx'

const text = messages.dashboard

type Props = {
  view: View
  answerWorkdays: number
  /** Whether Claude can be asked on this computer. */
  canAsk: boolean
  onOpenItem: ((id: string) => void) | undefined
  onReminder: (id: string) => Promise<Result<Reminder>>
}

type Draft = { busy: boolean; reminder: Reminder | null; error: ErrorCode | null; copied: boolean }
const NO_DRAFT: Draft = { busy: false, reminder: null, error: null, copied: false }

/**
 * The items whose last comment asks something nobody answered. The code finds them; Claude, when
 * asked, drafts the reminder, and the PM copies it: nothing is sent and nothing is written.
 */
export function Waiting({ view, answerWorkdays, canAsk, onOpenItem, onReminder }: Props) {
  const [onlyClient, setOnlyClient] = useState(true)
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const filtered = view.tellsSides && onlyClient
  const rows = filtered ? view.waiting.filter((row) => row.fromClient) : view.waiting
  const patch = (id: string, change: Partial<Draft>) =>
    setDrafts((current) => ({ ...current, [id]: { ...(current[id] ?? NO_DRAFT), ...change } }))

  async function draft(row: WaitingRow) {
    patch(row.id, { busy: true, error: null, copied: false })
    const result = await onReminder(row.id)
    if (result.ok) patch(row.id, { busy: false, reminder: result.value })
    else patch(row.id, { busy: false, error: result.code })
  }

  async function copy(id: string, reminder: Reminder) {
    await navigator.clipboard?.writeText(reminder.text)
    patch(id, { copied: true })
  }

  return (
    <details className="dashboard-fold" open={rows.length > 0 || undefined}>
      <summary className="fold-title">{text.waitingTitle(rows.length)}</summary>
      <p className="hint">{text.waitingIntro(answerWorkdays)}</p>
      {view.tellsSides ? (
        <label className="check">
          <input
            type="checkbox"
            checked={onlyClient}
            onChange={(event) => setOnlyClient(event.target.checked)}
          />
          {text.onlyClient}
        </label>
      ) : (
        view.waiting.length > 0 && <p className="hint">{text.sidesUnknown}</p>
      )}
      {rows.length === 0 ? (
        <p className="hint">{filtered ? text.waitingNoneFromClient : text.waitingNone}</p>
      ) : (
        <ul className="chase-list" aria-label={text.waitingTitle(rows.length)}>
          {rows.map((row) => {
            const state = drafts[row.id] ?? NO_DRAFT
            return (
              <li key={row.id} className="box chase-item">
                <span className="entry-meta">
                  <span className="mono">#{row.id}</span>
                  <span>{text.kinds[row.type]}</span>
                  <span>{row.assignee ?? text.unassigned}</span>
                  <span className="pill pill-warning">
                    {text.asked(row.askedBy, dateText(row.askedAt), row.workdays)}
                  </span>
                </span>
                <strong className="entry-title">{row.title}</strong>
                <p className="quote">«{row.question}»</p>
                <div className="actions">
                  <BusyButton
                    busy={state.busy}
                    busyLabel={text.draftingReminder}
                    disabled={!canAsk}
                    onClick={() => void draft(row)}
                  >
                    {text.draftReminder}
                  </BusyButton>
                  <OpenItem id={row.id} onOpen={onOpenItem} />
                  {!canAsk && <span className="hint">{text.needsClaude}</span>}
                </div>
                {state.error && <Failure code={state.error} />}
                {state.reminder && (
                  <div className="box box-source">
                    <strong>{text.reminderFor(state.reminder.to)}</strong>
                    <p className="reminder">{state.reminder.text}</p>
                    <div className="actions">
                      <button
                        type="button"
                        onClick={() => state.reminder && void copy(row.id, state.reminder)}
                      >
                        {text.copy}
                      </button>
                      <span className="hint" role="status">
                        {state.copied ? text.copied : text.reminderHint}
                      </span>
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </details>
  )
}
