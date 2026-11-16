import type { AgentProgress } from '@octo/application'
import {
  IMPORTANCES,
  type Project,
  type RiskRegister as Register,
  type Risk,
  type RiskCandidate,
  type RiskChange,
} from '@octo/domain'
import { useEffect, useState } from 'react'
import type { ErrorCode, OctoApi } from '../shared/api.ts'
import { Failure } from './Failure.tsx'
import { dateTimeText, messages, progressText } from './messages.ts'

type RiskApi = Pick<
  OctoApi,
  | 'risks'
  | 'proposeRisks'
  | 'acceptRisk'
  | 'dismissRisk'
  | 'addRisk'
  | 'updateRisk'
  | 'cancelEvaluateToday'
  | 'onTodayProgress'
  | 'openEvidence'
>

type Props = {
  api: RiskApi
  project: Project
  canJudge: boolean
  onBack: () => void
}

const text = messages.risks
const italianDay = (day: string): string => day.split('-').reverse().join('/')

/**
 * The risks of the project the PM accepted, and those Claude proposes with their sources. Nothing
 * enters the register by itself: a proposal is accepted or turned down.
 */
export function RiskRegister({ api, project, canJudge, onBack }: Props) {
  const [register, setRegister] = useState<Register | null>(null)
  const [error, setError] = useState<ErrorCode | null>(null)
  const [proposing, setProposing] = useState(false)
  const [step, setStep] = useState<AgentProgress | null>(null)
  const [title, setTitle] = useState('')

  useEffect(() => {
    setRegister(null)
    setError(null)
    void api.risks(project.id).then((result) => {
      if (result.ok) setRegister(result.value)
      else setError(result.code)
    })
  }, [api, project.id])

  useEffect(
    () =>
      api.onTodayProgress((projectId, progress) => {
        if (projectId === project.id) setStep(progress)
      }),
    [api, project.id],
  )

  async function apply(
    change: Promise<{ ok: true; value: Register } | { ok: false; code: ErrorCode }>,
  ) {
    setError(null)
    const result = await change
    if (result.ok) setRegister(result.value)
    else if (result.code !== 'agent_cancelled') setError(result.code)
    return result.ok
  }

  async function propose() {
    setProposing(true)
    setStep(null)
    await apply(api.proposeRisks(project.id))
    setProposing(false)
  }

  async function add() {
    if (await apply(api.addRisk(project.id, title))) setTitle('')
  }

  if (register === null) {
    return error ? <Failure code={error} /> : <p className="progress">{text.loading}</p>
  }
  const open = register.risks.filter((risk) => risk.state === 'open')
  const closed = register.risks.filter((risk) => risk.state === 'closed')

  return (
    <section className="today" aria-label={text.title}>
      <header className="today-head">
        <h3>{text.title}</h3>
        <div className="actions">
          <button type="button" onClick={onBack}>
            {text.back}
          </button>
        </div>
      </header>
      <p className="hint">{text.intro}</p>
      {error && <Failure code={error} />}

      <h4 className="today-title">{text.open}</h4>
      {open.length === 0 && <p className="today-empty">{text.none}</p>}
      <ul className="today-list">
        {open.map((risk) => (
          <RiskRow
            key={risk.id}
            risk={risk}
            onOpenSource={(path) => void api.openEvidence(project.id, path)}
            onState={() => void apply(api.updateRisk(project.id, risk.id, { state: 'closed' }))}
            onNote={(note) => void apply(api.updateRisk(project.id, risk.id, { note }))}
            onChange={(change) => void apply(api.updateRisk(project.id, risk.id, change))}
          />
        ))}
      </ul>
      <form
        className="actions"
        onSubmit={(event) => {
          event.preventDefault()
          void add()
        }}
      >
        <input
          type="text"
          aria-label={text.addLabel}
          placeholder={text.addLabel}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
        <button type="submit" disabled={title.trim() === ''}>
          {text.add}
        </button>
      </form>

      <h4 className="today-title">{text.candidates}</h4>
      <p className="hint">
        {register.proposedAt
          ? text.proposed(dateTimeText(register.proposedAt), register.proposedBy)
          : text.neverProposed}{' '}
        {text.candidatesHint}
      </p>
      {register.candidates.length === 0 && register.proposedAt !== null && (
        <p className="today-empty">{text.noCandidates}</p>
      )}
      <ul className="today-list">
        {register.candidates.map((candidate) => (
          <CandidateRow
            key={candidate.id}
            candidate={candidate}
            onOpenSource={(path) => void api.openEvidence(project.id, path)}
            onAccept={(accepted) => void apply(api.acceptRisk(project.id, candidate.id, accepted))}
            onDismiss={() => void apply(api.dismissRisk(project.id, candidate.id))}
          />
        ))}
      </ul>
      {proposing ? (
        <>
          <p className="progress">{step ? progressText(step) : text.proposing}</p>
          <div className="actions">
            <button type="button" onClick={() => void api.cancelEvaluateToday(project.id)}>
              {messages.today.judgement.stop}
            </button>
          </div>
        </>
      ) : (
        canJudge && (
          <div className="actions">
            <button type="button" onClick={() => void propose()}>
              {text.propose}
            </button>
          </div>
        )
      )}

      {closed.length > 0 && (
        <details className="advanced">
          <summary>
            {text.closed} ({closed.length})
          </summary>
          <ul className="today-watch">
            {closed.map((risk) => (
              <li key={risk.id}>
                <span>{risk.title}</span>
                <button
                  type="button"
                  className="quiet"
                  onClick={() => void apply(api.updateRisk(project.id, risk.id, { state: 'open' }))}
                >
                  {text.reopen}
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}

type SourceProps = {
  source: NonNullable<Risk['source']>
  onOpen: (path: string) => void
}

/** Where a risk comes from: the file, the words, and whether Octo found them there. */
function Source({ source, onOpen }: SourceProps) {
  return (
    <p className="today-judgement">
      <strong>{text.source}:</strong>{' '}
      <button type="button" className="quiet" onClick={() => onOpen(source.path)}>
        {source.path}
      </button>{' '}
      «{source.quote}»{' '}
      <span className={source.verified ? 'badge badge-ok' : 'badge badge-warning'}>
        {source.verified ? text.verified : text.unverified}
      </span>
    </p>
  )
}

type RiskRowProps = {
  risk: Risk
  onOpenSource: (path: string) => void
  onState: () => void
  onNote: (note: string) => void
  /** The day the risk is to be dealt with by, or how much it matters. */
  onChange: (change: Pick<RiskChange, 'due' | 'severity'>) => void
}

function RiskRow({ risk, onOpenSource, onState, onNote, onChange }: RiskRowProps) {
  const [note, setNote] = useState(risk.note)
  return (
    <li className="today-item">
      <p className="today-item-title">{risk.title}</p>
      <p className="hint">{text.since(italianDay(risk.since))}</p>
      {risk.source && <Source source={risk.source} onOpen={onOpenSource} />}
      <div className="actions today-item-actions">
        <label>
          {text.severity}{' '}
          <select
            aria-label={`${text.severity}: ${risk.title}`}
            value={risk.severity ?? ''}
            onChange={(event) =>
              onChange({
                severity: IMPORTANCES.find((known) => known === event.target.value) ?? null,
              })
            }
          >
            <option value="">{text.noSeverity}</option>
            {IMPORTANCES.map((severity) => (
              <option key={severity} value={severity}>
                {severity}
              </option>
            ))}
          </select>
        </label>
        <label>
          {text.due}{' '}
          <input
            type="date"
            aria-label={`${text.due}: ${risk.title}`}
            value={risk.due ?? ''}
            onChange={(event) => onChange({ due: event.target.value || null })}
          />
        </label>
      </div>
      <div className="actions today-item-actions">
        <input
          type="text"
          aria-label={`${text.note}: ${risk.title}`}
          placeholder={text.note}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
        <button type="button" disabled={note === risk.note} onClick={() => onNote(note)}>
          {text.saveNote}
        </button>
        <button type="button" className="quiet" onClick={onState}>
          {text.close}
        </button>
      </div>
    </li>
  )
}

type CandidateRowProps = {
  candidate: RiskCandidate
  onOpenSource: (path: string) => void
  onAccept: (title: string) => void
  onDismiss: () => void
}

function CandidateRow({ candidate, onOpenSource, onAccept, onDismiss }: CandidateRowProps) {
  const [title, setTitle] = useState(candidate.title)
  return (
    <li className="today-item">
      <input
        type="text"
        className="today-risk-title"
        aria-label={text.titleLabel(candidate.title)}
        value={title}
        onChange={(event) => setTitle(event.target.value)}
      />
      <p className="today-item-detail">{candidate.why}</p>
      <Source source={candidate.source} onOpen={onOpenSource} />
      <div className="actions today-item-actions">
        <button type="button" className="primary" onClick={() => onAccept(title)}>
          {text.accept}
        </button>
        <button type="button" className="quiet" onClick={onDismiss}>
          {text.dismiss}
        </button>
      </div>
    </li>
  )
}
