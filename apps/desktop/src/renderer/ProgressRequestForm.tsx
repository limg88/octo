import {
  computeProgress,
  orderTotal,
  type ProgressRequest,
  type ProgressSettings,
  progressWarnings,
} from '@octo/domain'
import { useState } from 'react'
import { amountField, amountText } from './forecast-text.ts'
import { messages } from './messages.ts'
import { ProgressShares } from './ProgressShares.tsx'
import { problemText, warningRequest, warningText } from './progress-words.ts'

type Props = {
  settings: ProgressSettings
  /** The place of the request in the order of time: an existing one, or the one after the last. */
  n: number
  onSave: (settings: ProgressSettings, compile: boolean) => void
  onCancel: () => void
}

const text = messages.progress
const CENT = 0.01

type Draft = {
  from: string
  to: string
  amount: string
  note: string
  /** True when the request goes on the positions the PM ticks, not on the first ones open. */
  choosing: boolean
  chosen: string[]
}

function draftOf(settings: ProgressSettings, n: number): Draft {
  const existing = settings.requests[n - 1]
  return {
    // A request starts where the one before ends.
    from: existing?.from ?? settings.requests[n - 2]?.to ?? '',
    to: existing?.to ?? '',
    amount: amountText(existing?.amount ?? null),
    note: existing?.note ?? '',
    choosing: (existing?.positions.length ?? 0) > 0,
    chosen: existing?.positions ?? [],
  }
}

/** One request, new or to correct, with the shares it gives shown while it is typed. */
export function ProgressRequestForm({ settings, n, onSave, onCancel }: Props) {
  const [draft, setDraft] = useState<Draft>(() => draftOf(settings, n))
  const [refused, setRefused] = useState(false)
  const change = (part: Partial<Draft>) => setDraft((current) => ({ ...current, ...part }))

  const isNew = n > settings.requests.length
  const before = settings.requests.slice(0, n - 1)
  const after = settings.requests.slice(n)
  const typed = amountField(draft.amount)
  const amount = typed.values[0]

  // What the order looks like before this request: what is left, in all and on each position.
  const until = computeProgress(settings.positions, before)
  const last = until.ok ? until.steps.at(-1) : undefined
  const left = orderTotal(settings.positions) - (last?.cumulative ?? 0)
  const leftOn = (index: number, whole: number) => whole * (1 - (last?.current[index] ?? 0))

  const request: ProgressRequest = {
    n,
    from: draft.from,
    to: draft.to,
    amount: amount ?? 0,
    positions: draft.choosing ? draft.chosen : [],
    note: draft.note,
  }
  const next: ProgressSettings = { ...settings, requests: [...before, request, ...after] }
  const computation = amount === undefined ? null : computeProgress(next.positions, next.requests)
  const step = computation?.ok ? computation.steps[n - 1] : undefined
  const warnings = progressWarnings(next).filter((warning) => warningRequest(warning) === n)
  const ready = amount !== undefined && computation?.ok === true

  function submit(compile: boolean) {
    if (!ready) return setRefused(true)
    onSave(next, compile)
  }

  return (
    <form
      className="settings-form request-form"
      aria-label={isNew ? text.request.titleNew(n) : text.request.titleEdit(n)}
      onSubmit={(event) => {
        event.preventDefault()
        submit(true)
      }}
    >
      <h3>{isNew ? text.request.titleNew(n) : text.request.titleEdit(n)}</h3>
      {after.length > 0 && <p className="badge badge-warning">{text.request.laterRecomputed}</p>}
      <div className="range-fields">
        <label>
          {text.from}
          <input
            type="date"
            value={draft.from}
            onChange={(event) => change({ from: event.target.value })}
          />
        </label>
        <label>
          {text.to}
          <input
            type="date"
            value={draft.to}
            onChange={(event) => change({ to: event.target.value })}
          />
        </label>
        <label>
          {text.request.amount}
          <input
            type="text"
            inputMode="decimal"
            className="amount"
            value={draft.amount}
            onChange={(event) => change({ amount: event.target.value })}
          />
        </label>
        {left >= CENT && (
          <button type="button" onClick={() => change({ amount: amountText(left) })}>
            {text.request.allLeft(text.money(left))}
          </button>
        )}
      </div>
      {(typed.problems.length > 0 || (refused && amount === undefined)) && (
        <p className="field-problems" role="alert">
          {messages.lines.single.amount()}
        </p>
      )}
      {computation && !computation.ok && (
        <p className="field-problems" role="alert">
          {problemText(computation.problem)}
        </p>
      )}
      <label>
        {text.request.note}
        <input
          type="text"
          value={draft.note}
          onChange={(event) => change({ note: event.target.value })}
        />
      </label>
      <fieldset>
        <legend>{text.request.positionsLegend}</legend>
        <label className="check">
          <input
            type="radio"
            name="request-positions"
            checked={!draft.choosing}
            onChange={() => change({ choosing: false })}
          />
          {text.request.inOrder}
        </label>
        <label className="check">
          <input
            type="radio"
            name="request-positions"
            checked={draft.choosing}
            onChange={() => change({ choosing: true })}
          />
          {text.request.chosen}
        </label>
        {draft.choosing && (
          <div className="checks">
            {settings.positions.map((position, index) => (
              <label key={position.code} className="check">
                <input
                  type="checkbox"
                  checked={draft.chosen.includes(position.code)}
                  onChange={() =>
                    change({
                      chosen: draft.chosen.includes(position.code)
                        ? draft.chosen.filter((code) => code !== position.code)
                        : // Kept in the order of the order, whatever the order of the clicks.
                          settings.positions
                            .map(({ code }) => code)
                            .filter(
                              (code) => code === position.code || draft.chosen.includes(code),
                            ),
                    })
                  }
                />
                {text.request.positionLeft(
                  position.code,
                  text.money(leftOn(index, position.amount)),
                )}
              </label>
            ))}
          </div>
        )}
      </fieldset>
      <section aria-label={text.request.preview}>
        <h4>{text.request.preview}</h4>
        {step ? (
          <>
            {step.closing && <p className="badge badge-ok">{text.closing}</p>}
            <ProgressShares step={step} positions={settings.positions} />
            {warnings.map((warning) => (
              <p key={warning.kind} className="hint">
                {warningText(warning)}
              </p>
            ))}
          </>
        ) : (
          <p className="hint">{text.request.previewNone}</p>
        )}
      </section>
      <div className="actions">
        <button type="submit">{text.request.saveAndCompile}</button>
        <button type="button" onClick={() => submit(false)}>
          {text.request.saveOnly}
        </button>
        <button type="button" className="quiet" onClick={onCancel}>
          {messages.cancel}
        </button>
      </div>
    </form>
  )
}
