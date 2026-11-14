import type { AgentProgress } from '@octo/application'
import {
  costOf,
  type Deliverable,
  type DeliverableKind,
  type Project,
  type RedTeamReport,
  registerTotals,
} from '@octo/domain'
import { type ChangeEvent, type FormEvent, useCallback, useEffect, useState } from 'react'
import type { ErrorCode, OctoApi, Result } from '../shared/api.ts'
import { AnswerView } from './AnswerView.tsx'
import { dateText, errorText, messages, progressText } from './messages.ts'

type Props = {
  api: OctoApi
  project: Project
}

/** What the right side shows: the catalog, the form of a kind, or a deliverable. */
type Shown =
  | { view: 'catalog' }
  | { view: 'register' }
  | { view: 'form'; kindId: string }
  | { view: 'one'; id: string }

/** The deliverables of a project: the catalog, the ones in the making, the approved ones. */
export function DeliverablesView({ api, project }: Props) {
  const [catalog, setCatalog] = useState<DeliverableKind[]>([])
  const [all, setAll] = useState<Deliverable[]>([])
  const [shown, setShown] = useState<Shown>({ view: 'catalog' })
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<AgentProgress | null>(null)
  const [error, setError] = useState<ErrorCode | null>(null)

  useEffect(() => {
    let current = true
    setAll([])
    setShown({ view: 'catalog' })
    setError(null)
    void api.deliverableCatalog().then((result) => {
      if (current && result.ok) setCatalog(result.value)
    })
    void api.listDeliverables(project.id).then((result) => {
      if (!current) return
      if (result.ok) setAll(result.value)
      else setError(result.code)
    })
    const stop = api.onDeliverableProgress((projectId, step) => {
      if (projectId === project.id) setProgress(step)
    })
    return () => {
      current = false
      stop()
    }
  }, [api, project.id])

  /** Runs one step on a deliverable and puts what comes back in the list. */
  const run = useCallback(async (step: () => Promise<Result<Deliverable>>) => {
    setBusy(true)
    setError(null)
    setProgress(null)
    const result = await step()
    setBusy(false)
    if (!result.ok) return setError(result.code)
    const made = result.value
    setAll((previous) => [made, ...previous.filter((other) => other.id !== made.id)])
    setShown({ view: 'one', id: made.id })
  }, [])

  const kindOf = (kindId: string) => catalog.find((kind) => kind.id === kindId)
  const one = shown.view === 'one' ? all.find((candidate) => candidate.id === shown.id) : undefined
  const formKind = shown.view === 'form' ? kindOf(shown.kindId) : undefined

  return (
    <section className="deliverables" aria-label={messages.deliverablesTab}>
      <nav className="deliverable-list" aria-label={messages.deliverablesTab}>
        <button type="button" onClick={() => setShown({ view: 'catalog' })}>
          {messages.deliverableNew}
        </button>
        <button type="button" className="quiet" onClick={() => setShown({ view: 'register' })}>
          {messages.deliverableRegister}
        </button>
        <ul>
          {all.map((deliverable) => (
            <li key={deliverable.id}>
              <button
                type="button"
                className={one?.id === deliverable.id ? 'project project-selected' : 'project'}
                onClick={() => setShown({ view: 'one', id: deliverable.id })}
              >
                <span>{deliverable.title}</span>
                <span className="hint">
                  {kindOf(deliverable.kindId)?.title ?? deliverable.kindId} ·{' '}
                  {messages.deliverableStatus[deliverable.status]}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <div className="deliverable-body">
        {error && (
          <p className="warning" role="alert">
            {errorText(error)}
          </p>
        )}
        {busy && (
          <p className="progress" role="status">
            {progress ? progressText(progress) : messages.deliverableWriting}
          </p>
        )}
        {shown.view === 'catalog' && (
          <Catalog
            catalog={catalog}
            empty={all.length === 0}
            onChoose={(kindId) => setShown({ view: 'form', kindId })}
          />
        )}
        {shown.view === 'register' && (
          <Register all={all} titleOf={(id) => kindOf(id)?.title ?? id} />
        )}
        {formKind && (
          <KindForm
            api={api}
            project={project}
            kind={formKind}
            busy={busy}
            onStart={(inputs) => run(() => api.startDeliverable(project.id, formKind.id, inputs))}
          />
        )}
        {one && (
          <Review
            deliverable={one}
            kind={kindOf(one.kindId)}
            busy={busy}
            onOpen={(path) => void api.openEvidence(project.id, path)}
            onRevise={(request) => run(() => api.reviseDeliverable(project.id, one.id, request))}
            onApprove={() => run(() => api.approveDeliverable(project.id, one.id))}
          />
        )}
      </div>
    </section>
  )
}

function Catalog({
  catalog,
  empty,
  onChoose,
}: {
  catalog: DeliverableKind[]
  empty: boolean
  onChoose: (kindId: string) => void
}) {
  return (
    <>
      <h3>{messages.deliverableChoose}</h3>
      {empty && <p className="hint">{messages.deliverableNone}</p>}
      <div className="kinds">
        {catalog.map((kind) => (
          <button key={kind.id} type="button" className="kind" onClick={() => onChoose(kind.id)}>
            <strong>{kind.title}</strong>
            <span className="hint">{messages.deliverableFor[kind.audience]}</span>
            <span>{kind.summary}</span>
          </button>
        ))}
      </div>
    </>
  )
}

function KindForm({
  api,
  project,
  kind,
  busy,
  onStart,
}: {
  api: OctoApi
  project: Project
  kind: DeliverableKind
  busy: boolean
  onStart: (inputs: Record<string, string>) => void
}) {
  const [inputs, setInputs] = useState<Record<string, string>>({})
  const [instructions, setInstructions] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let current = true
    setInputs({})
    setSaved(false)
    void api.deliverableInstructions(project.id, kind.id).then((result) => {
      if (current && result.ok) setInstructions(result.value)
    })
    return () => {
      current = false
    }
  }, [api, project.id, kind.id])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    onStart(inputs)
  }
  const missing = kind.fields.some((field) => field.required && !inputs[field.key]?.trim())

  async function saveInstructions() {
    const result = await api.saveDeliverableInstructions(project.id, kind.id, instructions)
    setSaved(result.ok)
  }

  return (
    <>
      <h3>{kind.title}</h3>
      <p className="hint">{kind.summary}</p>
      <form className="source-form" onSubmit={submit}>
        {kind.fields.map((field) => {
          const id = `deliverable-${kind.id}-${field.key}`
          const control = {
            id,
            value: inputs[field.key] ?? '',
            onChange: (event: ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) =>
              setInputs({ ...inputs, [field.key]: event.target.value }),
          }
          return (
            <label key={field.key} htmlFor={id}>
              {field.label}
              {field.kind === 'long' ? (
                <textarea rows={3} {...control} />
              ) : (
                <input type="text" {...control} />
              )}
              {field.hint && <span className="hint">{field.hint}</span>}
            </label>
          )
        })}
        <div className="actions">
          <button type="submit" disabled={busy || missing}>
            {messages.deliverableWrite}
          </button>
        </div>
      </form>
      <details className="project-instructions">
        <summary>{messages.deliverableProjectInstructions}</summary>
        <p className="hint">{messages.deliverableProjectInstructionsHint}</p>
        <textarea
          aria-label={messages.deliverableProjectInstructions}
          rows={5}
          value={instructions}
          onChange={(event) => {
            setInstructions(event.target.value)
            setSaved(false)
          }}
        />
        <div className="actions">
          <button type="button" onClick={() => void saveInstructions()}>
            {messages.deliverableInstructionsSave}
          </button>
          {saved && <span className="hint">{messages.deliverableInstructionsSaved}</span>}
        </div>
      </details>
    </>
  )
}

function Review({
  deliverable,
  kind,
  busy,
  onOpen,
  onRevise,
  onApprove,
}: {
  deliverable: Deliverable
  kind: DeliverableKind | undefined
  busy: boolean
  onOpen: (path: string) => void
  onRevise: (request: string) => void
  onApprove: () => void
}) {
  const [request, setRequest] = useState('')
  const cost = costOf(deliverable)
  const lastFailed = deliverable.rounds.at(-1)?.error ?? null
  const inReview = deliverable.status === 'review'

  const submit = (event: FormEvent) => {
    event.preventDefault()
    onRevise(request)
    setRequest('')
  }

  return (
    <>
      <h3>{deliverable.title}</h3>
      <p className="hint">
        {kind?.title ?? deliverable.kindId} · {messages.deliverableStatus[deliverable.status]} ·{' '}
        {messages.deliverableCost(cost.draftMinutes, cost.reviewMinutes, cost.rounds)}
      </p>
      {deliverable.status === 'failed' && (
        <p className="warning" role="alert">
          {messages.deliverableFailed} {lastFailed && errorText(lastFailed)}
        </p>
      )}
      {inReview && lastFailed && (
        <p className="warning" role="alert">
          {messages.deliverableLastChangeFailed} {errorText(lastFailed)}
        </p>
      )}
      {deliverable.files.length > 0 && (
        <div className="preview">
          <p>{messages.deliverableFiles}</p>
          <div className="choices">
            {deliverable.files.map((path) => (
              <button key={path} type="button" onClick={() => onOpen(path)}>
                {path.split('/').at(-1)}
              </button>
            ))}
          </div>
        </div>
      )}
      {deliverable.draft && (
        <div className="draft">
          <AnswerView answer={deliverable.draft} onOpenSource={onOpen} />
          {inReview && <p className="hint">{messages.deliverableSourcesNote}</p>}
        </div>
      )}
      {deliverable.redTeam && <RedTeam report={deliverable.redTeam} />}
      {inReview && kind && (
        <section aria-label={messages.deliverableChecklist}>
          <h4>{messages.deliverableChecklist}</h4>
          <ul className="missing">
            {kind.checklist.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      )}
      {inReview && (
        <form className="source-form" onSubmit={submit}>
          <label>
            {messages.deliverableChange}
            <textarea
              rows={2}
              value={request}
              onChange={(event) => setRequest(event.target.value)}
            />
          </label>
          <div className="actions">
            <button type="submit" className="quiet-submit" disabled={busy || !request.trim()}>
              {messages.deliverableChangeSubmit}
            </button>
            <button type="button" className="approve" disabled={busy} onClick={onApprove}>
              {messages.deliverableApprove}
            </button>
          </div>
        </form>
      )}
    </>
  )
}

function RedTeam({ report }: { report: RedTeamReport }) {
  const ok = report.verdict === 'deliverable'
  return (
    <section className="red-team" aria-label={messages.deliverableRedTeam}>
      <h4>{messages.deliverableRedTeam}</h4>
      <p className={ok ? 'badge badge-ok' : 'badge badge-warning'}>
        {ok ? messages.deliverableRedTeamOk : messages.deliverableRedTeamFix}
      </p>
      {report.findings.length > 0 && (
        <ul className="findings">
          {report.findings.map((finding) => (
            <li key={`${finding.where}-${finding.finding}`}>
              <span className="status status-warning">
                {messages.deliverableSeverity[finding.severity]}
              </span>
              <strong>{finding.finding}</strong>
              <blockquote>{finding.where}</blockquote>
              <span className="hint">{finding.why}</span>
            </li>
          ))}
        </ul>
      )}
      {report.holds && (
        <p className="hint">
          {messages.deliverableHolds}: {report.holds}
        </p>
      )}
    </section>
  )
}

function Register({ all, titleOf }: { all: Deliverable[]; titleOf: (kindId: string) => string }) {
  const totals = registerTotals(all)
  return (
    <>
      <h3>{messages.deliverableRegister}</h3>
      <p className="hint">{messages.deliverableRegisterIntro}</p>
      {all.length === 0 ? (
        <p className="hint">{messages.deliverableRegisterEmpty}</p>
      ) : (
        <table className="register">
          <thead>
            <tr>
              {messages.deliverableRegisterHead.map((head) => (
                <th key={head}>{head}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {all.map((deliverable) => {
              const cost = costOf(deliverable)
              return (
                <tr key={deliverable.id}>
                  <td>{dateText(deliverable.createdAt)}</td>
                  <td>{titleOf(deliverable.kindId)}</td>
                  <td>{deliverable.title}</td>
                  <td>{messages.deliverableStatus[deliverable.status]}</td>
                  <td>{cost.draftMinutes}</td>
                  <td>{cost.reviewMinutes}</td>
                  <td>{cost.rounds}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
      <p className="badge">
        {messages.deliverableRegisterTotals(
          totals.deliverables,
          totals.draftMinutes,
          totals.reviewMinutes,
          totals.rounds,
        )}
      </p>
    </>
  )
}
