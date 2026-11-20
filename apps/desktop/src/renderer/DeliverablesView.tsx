import type { AgentProgress } from '@octo/application'
import {
  clientFilter,
  costOf,
  type Deliverable,
  type DeliverableKind,
  isOwnKind,
  type OwnKindInput,
  ownKindInput,
  type Project,
  type RedTeamFinding,
  type RedTeamReport,
  registerTotals,
} from '@octo/domain'
import {
  type ChangeEvent,
  type FormEvent,
  Fragment,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react'
import type { ErrorCode, OctoApi, Result } from '../shared/api.ts'
import { AnswerChecks, AnswerView } from './AnswerView.tsx'
import type { OpenSource } from './CitationPanel.tsx'
import type { Handoff } from './context.ts'
import { type DataColumn, DataTable } from './DataTable.tsx'
import { citedPaths, handoffField, handoffText } from './handoff-text.ts'
import { KindCorrection } from './KindCorrection.tsx'
import { KindTemplate, type KindTemplateApi } from './KindTemplate.tsx'
import { MeetingField } from './MeetingField.tsx'
import { dateText, errorText, messages, progressText } from './messages.ts'
import { ScriptedDeliverables } from './ScriptedDeliverables.tsx'
import { BusyButton, Waiting } from './Spinner.tsx'
import { useReentry } from './use-reentry.ts'

type Props = {
  api: OctoApi
  project: Project
  /** An answer of «Chiedi» the next deliverable starts from. */
  handoff?: Handoff | null
  /** Told when the context was used, or put aside by the PM. */
  onHandoffDone?: () => void
  /** False while the page stays mounted out of sight: back in sight, kinds and list are read again. */
  active?: boolean
}

/** Which step on a deliverable is running: the button that started it says so. */
type Step = 'start' | 'revise' | 'approve'

/** What the right side shows: the catalog, the form of a kind, or a deliverable. */
type Shown =
  | { view: 'catalog' }
  | { view: 'register' }
  | { view: 'own'; kindId: string | null }
  | { view: 'form'; kindId: string }
  | { view: 'one'; id: string }

/** The deliverables of a project: the catalog, the ones in the making, the approved ones. */
export function DeliverablesView({
  api,
  project,
  handoff = null,
  onHandoffDone,
  active = true,
}: Props) {
  const [catalog, setCatalog] = useState<DeliverableKind[]>([])
  const [all, setAll] = useState<Deliverable[]>([])
  const [shown, setShown] = useState<Shown>({ view: 'catalog' })
  const [step, setStep] = useState<Step | null>(null)
  const busy = step !== null
  /** The deliverable being written, not yet a draft: its kind and what the PM filled in. */
  const [making, setMaking] = useState<{ kindId: string; inputs: Record<string, string> } | null>(
    null,
  )
  /** The project on the page now: a draft that comes back for another one is not shown here. */
  const live = useRef<string | null>(project.id)
  live.current = project.id
  // When the page goes away nothing that comes back is shown; when it is put back, it is again.
  useEffect(() => {
    live.current = project.id
    return () => {
      live.current = null
    }
  }, [project.id])
  const [progress, setProgress] = useState<AgentProgress | null>(null)
  const [error, setError] = useState<ErrorCode | null>(null)

  useEffect(() => {
    let current = true
    setAll([])
    setShown({ view: 'catalog' })
    setError(null)
    setStep(null)
    setMaking(null)
    setProgress(null)
    void api.deliverableCatalog(project.id).then((result) => {
      if (!current) return
      // A catalog that cannot be read offers no kind, and says why.
      if (result.ok) setCatalog(result.value)
      else setError(result.code)
    })
    void api.listDeliverables(project.id).then((result) => {
      if (!current) return
      if (result.ok) setAll(result.value)
      else setError(result.code)
    })
    const stop = api.onDeliverableProgress((projectId, step) => {
      if (projectId === project.id) setProgress(step)
    })
    // The draft is shown as soon as it is written: the critical reading goes on meanwhile.
    const stopDraft = api.onDeliverableDraft((projectId, drafted) => {
      if (projectId !== project.id) return
      setMaking(null)
      setAll((previous) => [drafted, ...previous.filter((other) => other.id !== drafted.id)])
      setShown({ view: 'one', id: drafted.id })
    })
    return () => {
      current = false
      stop()
      stopDraft()
    }
  }, [api, project.id])

  // Back in sight: the kinds may have been corrected in the settings. What runs is left alone.
  useReentry(active, () => {
    const projectId = project.id
    void api.deliverableCatalog(projectId).then((result) => {
      if (live.current === projectId && result.ok) setCatalog(result.value)
    })
    if (busy) return
    void api.listDeliverables(projectId).then((result) => {
      if (live.current === projectId && result.ok) setAll(result.value)
    })
  })

  /** Runs one step on a deliverable and puts what comes back in the list. */
  const run = useCallback(
    async (which: Step, work: () => Promise<Result<Deliverable>>): Promise<boolean> => {
      const projectId = project.id
      setStep(which)
      setError(null)
      setProgress(null)
      const result = await work()
      if (live.current !== projectId) return false
      setStep(null)
      if (!result.ok) {
        setError(result.code)
        return false
      }
      const made = result.value
      setAll((previous) => [made, ...previous.filter((other) => other.id !== made.id)])
      setShown({ view: 'one', id: made.id })
      return true
    },
    [project.id],
  )

  /** Changes the kinds of the project, then shows the catalog as it is now. */
  async function changeCatalog(step: () => Promise<Result<unknown>>) {
    setError(null)
    const result = await step()
    if (!result.ok) return setError(result.code)
    const next = await api.deliverableCatalog(project.id)
    if (next.ok) setCatalog(next.value)
    setShown({ view: 'catalog' })
  }

  const kindOf = (kindId: string) => catalog.find((kind) => kind.id === kindId)
  const one = shown.view === 'one' ? all.find((candidate) => candidate.id === shown.id) : undefined
  const formKind = shown.view === 'form' ? kindOf(shown.kindId) : undefined

  return (
    <section className="deliverables" aria-label={messages.deliverablesTab}>
      <nav className="deliverable-list" aria-label={messages.deliverablesTab}>
        <button
          type="button"
          className={shown.view === 'catalog' ? 'primary' : undefined}
          onClick={() => setShown({ view: 'catalog' })}
        >
          {messages.deliverableNew}
        </button>
        <button
          type="button"
          className={shown.view === 'register' ? 'quiet deliverable-list-shown' : 'quiet'}
          onClick={() => setShown({ view: 'register' })}
        >
          {messages.deliverableRegister}
        </button>
        <ul>
          {making && (
            <li>
              <button
                type="button"
                className={
                  formKind?.id === making.kindId
                    ? 'project list-row project-selected'
                    : 'project list-row'
                }
                onClick={() => setShown({ view: 'form', kindId: making.kindId })}
              >
                <span className="list-row-text">
                  {kindOf(making.kindId)?.title ?? making.kindId}
                </span>
                <span className="status">{messages.deliverableMaking}</span>
              </button>
            </li>
          )}
          {all.map((deliverable) => (
            <li key={deliverable.id}>
              <button
                type="button"
                className={
                  one?.id === deliverable.id
                    ? 'project list-row project-selected'
                    : 'project list-row'
                }
                title={kindOf(deliverable.kindId)?.title ?? deliverable.kindId}
                onClick={() => setShown({ view: 'one', id: deliverable.id })}
              >
                <span className="list-row-text">{deliverable.title}</span>
                <StatusMark status={deliverable.status} />
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
          <Waiting>{progress ? progressText(progress) : messages.deliverableWriting}</Waiting>
        )}
        {handoff && (shown.view === 'catalog' || shown.view === 'form') && (
          <section className="box box-source handoff" aria-label={messages.handoff.title}>
            <strong>{messages.handoff.title}</strong>
            <p>{messages.handoff.from(handoff.question)}</p>
            <p className="hint">
              {messages.handoff.sources(citedPaths(handoff).length)}{' '}
              {shown.view === 'catalog' && messages.handoff.choose}
            </p>
            <div className="actions">
              <button type="button" className="quiet" onClick={onHandoffDone}>
                {messages.handoff.drop}
              </button>
            </div>
          </section>
        )}
        {shown.view === 'catalog' && (
          <>
            <Catalog
              catalog={catalog}
              empty={all.length === 0}
              onChoose={(kindId) => setShown({ view: 'form', kindId })}
              onEdit={(kindId) => setShown({ view: 'own', kindId })}
              onRemove={(kindId) =>
                void changeCatalog(() => api.removeDeliverableKind(project.id, kindId))
              }
            />
            <ScriptedDeliverables api={api} project={project} />
          </>
        )}
        {shown.view === 'register' && (
          <Register all={all} titleOf={(id) => kindOf(id)?.title ?? id} />
        )}
        {shown.view === 'own' && (
          <OwnKindForm
            api={api}
            project={project}
            kind={shown.kindId ? kindOf(shown.kindId) : undefined}
            onSave={(input, withTemplate) =>
              void changeCatalog(async () => {
                const saved = await api.saveDeliverableKind(project.id, input)
                // The kind exists only once saved: its template is chosen right after.
                if (!saved.ok || !withTemplate) return saved
                return api.chooseKindTemplate(project.id, saved.value.id)
              })
            }
          />
        )}
        {formKind && (
          <KindForm
            api={api}
            project={project}
            kind={formKind}
            busy={busy}
            writing={step === 'start'}
            handoff={handoff}
            started={making?.kindId === formKind.id ? making.inputs : null}
            onKindChanged={() => {
              void api.deliverableCatalog(project.id).then((next) => {
                if (next.ok) setCatalog(next.value)
              })
            }}
            onStart={async (inputs) => {
              setMaking({ kindId: formKind.id, inputs })
              const made = await run('start', () =>
                api.startDeliverable(project.id, formKind.id, inputs),
              )
              setMaking((current) => (current?.inputs === inputs ? null : current))
              // The context went into the draft: the next deliverable starts empty.
              if (made) onHandoffDone?.()
            }}
          />
        )}
        {one && (
          <Review
            deliverable={one}
            kind={kindOf(one.kindId)}
            step={step}
            onOpen={(path, quote) => api.openEvidence(project.id, path, quote)}
            onRevise={(request) =>
              void run('revise', () => api.reviseDeliverable(project.id, one.id, request))
            }
            onApprove={() => void run('approve', () => api.approveDeliverable(project.id, one.id))}
          />
        )}
      </div>
    </section>
  )
}

/** The kinds of the catalog go by who reads them: what leaves the company first. */
const AUDIENCES: ReadonlyArray<DeliverableKind['audience']> = ['client', 'internal']

/** The state of a deliverable as a mark: amber while it waits for the PM, green once approved. */
function StatusMark({ status }: { status: Deliverable['status'] }) {
  const tone = status === 'review' ? ' status-warning' : status === 'approved' ? ' status-ok' : ''
  return <span className={`status${tone}`}>{messages.deliverableStatus[status]}</span>
}

function Catalog({
  catalog,
  empty,
  onChoose,
  onEdit,
  onRemove,
}: {
  catalog: DeliverableKind[]
  empty: boolean
  onChoose: (kindId: string) => void
  onEdit: (kindId: string | null) => void
  onRemove: (kindId: string) => void
}) {
  const row = (kind: DeliverableKind, title: string) => (
    <li key={kind.id} className="list-row">
      <button
        type="button"
        className="quiet kind-name"
        aria-label={kind.title}
        onClick={() => onChoose(kind.id)}
      >
        {title}
      </button>
      {isOwnKind(kind.id) && <span className="status">{messages.ownKindBadge}</span>}
      <span className="list-row-text hint">{kind.summary}</span>
      {isOwnKind(kind.id) && (
        <>
          <button
            type="button"
            className="quiet"
            aria-label={`${messages.ownKindEdit} ${kind.title}`}
            onClick={() => onEdit(kind.id)}
          >
            {messages.ownKindEdit}
          </button>
          <button
            type="button"
            className="quiet"
            aria-label={`${messages.ownKindRemove} ${kind.title}`}
            onClick={() => onRemove(kind.id)}
          >
            {messages.ownKindRemove}
          </button>
        </>
      )}
    </li>
  )
  // The pages of the memory are not texts to send: they stand apart, and say what they are for.
  const memory = catalog.filter((kind) => kind.memoryPage !== undefined)
  const toSend = catalog.filter((kind) => kind.memoryPage === undefined)
  return (
    <>
      <div className="title-row">
        <h3>{messages.deliverableChoose}</h3>
        <button type="button" onClick={() => onEdit(null)}>
          {messages.ownKindNew}
        </button>
      </div>
      {empty && <p className="hint">{messages.deliverableNone}</p>}
      <div className="grouped">
        {AUDIENCES.map((audience) => {
          const kinds = toSend.filter((kind) => kind.audience === audience)
          if (kinds.length === 0) return null
          const label = messages.deliverableFor[audience]
          return (
            <Fragment key={audience}>
              <div className="list-group">
                <span className="eyebrow">
                  {label} · {kinds.length}
                </span>
              </div>
              <ul className="entries" aria-label={label}>
                {kinds.map((kind) => row(kind, kind.title))}
              </ul>
            </Fragment>
          )
        })}
      </div>
      {memory.length > 0 && (
        <section className="catalog-part" aria-label={messages.memoryKinds.title}>
          <h3>{messages.memoryKinds.title}</h3>
          <p className="hint">{messages.memoryKinds.about}</p>
          <ul className="entries">
            {memory.map((kind) => row(kind, kind.title.replace(messages.memoryKinds.prefix, '')))}
          </ul>
        </section>
      )}
    </>
  )
}

function KindForm({
  api,
  project,
  kind,
  busy,
  writing,
  handoff,
  started,
  onStart,
  onKindChanged,
}: {
  api: OctoApi
  project: Project
  kind: DeliverableKind
  busy: boolean
  writing: boolean
  handoff: Handoff | null
  /** What was filled in for the deliverable of this kind being written now, when there is one. */
  started: Record<string, string> | null
  onStart: (inputs: Record<string, string>) => void
  /** How the kind is written changed: the catalog is read again. */
  onKindChanged: () => void
}) {
  const filledField = handoff ? handoffField(kind) : null
  /** What the form starts with: the context of an answer in its field, when there is one. */
  const initial = (): Record<string, string> =>
    started ?? (handoff && filledField ? { [filledField]: handoffText(handoff) } : {})
  const [inputs, setInputs] = useState<Record<string, string>>(initial)
  const [instructions, setInstructions] = useState('')
  const [saved, setSaved] = useState(false)

  // biome-ignore lint/correctness/useExhaustiveDependencies: the form starts again with another kind or another context, not at every render.
  useEffect(() => {
    let current = true
    setInputs(initial())
    setSaved(false)
    void api.deliverableInstructions(project.id, kind.id).then((result) => {
      if (current && result.ok) setInstructions(result.value)
    })
    return () => {
      current = false
    }
  }, [api, project.id, kind.id, handoff])

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
              {field.kind === 'meeting' ? (
                <MeetingField
                  api={api}
                  projectId={project.id}
                  id={id}
                  value={inputs[field.key] ?? ''}
                  onChange={(value) => setInputs({ ...inputs, [field.key]: value })}
                />
              ) : field.kind === 'long' ? (
                <textarea rows={field.key === filledField ? 10 : 3} {...control} />
              ) : (
                <input type="text" {...control} />
              )}
              {field.hint && <span className="hint">{field.hint}</span>}
              {field.key === filledField && <span className="hint">{messages.handoff.filled}</span>}
            </label>
          )
        })}
        <div className="actions">
          <BusyButton
            type="submit"
            busy={writing}
            busyLabel={messages.wait.writing}
            disabled={busy || missing}
          >
            {messages.deliverableWrite}
          </BusyButton>
        </div>
      </form>
      <KindTemplate api={api} project={project} kind={kind} />
      {!isOwnKind(kind.id) && (
        <KindCorrection api={api} project={project} kind={kind} onChanged={onKindChanged} />
      )}
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

const text = messages.review
/** What tells a finding of a reading from another: where it is, and what it says. */
const findingKey = (finding: Pick<RedTeamFinding, 'where' | 'finding'>): string =>
  `${finding.where}-${finding.finding}`

function Review({
  deliverable,
  kind,
  step,
  onOpen,
  onRevise,
  onApprove,
}: {
  deliverable: Deliverable
  kind: DeliverableKind | undefined
  step: Step | null
  onOpen: OpenSource
  onRevise: (request: string) => void
  onApprove: () => void
}) {
  const busy = step !== null
  const lastFailed = deliverable.rounds.at(-1)?.error ?? null
  const inReview = deliverable.status === 'review'
  // What the PM marked as seen holds for the draft it was marked on: a new draft starts unmarked.
  const round = `${deliverable.id}:${deliverable.rounds.length}`
  const [seen, setSeen] = useState<{ round: string; keys: readonly string[] }>({ round, keys: [] })
  const seenKeys = seen.round === round ? seen.keys : []
  const toggleSeen = (key: string) =>
    setSeen({
      round,
      keys: seenKeys.includes(key) ? seenKeys.filter((k) => k !== key) : [...seenKeys, key],
    })

  // The general change starts from what the reading found and the PM has not seen yet: a
  // proposal to send as it is or to write over. A new draft starts from its own findings.
  const proposal = text.proposed(
    (deliverable.redTeam?.findings ?? [])
      .filter((finding) => !seenKeys.includes(findingKey(finding)))
      .map((finding) => finding.finding),
  )
  const [typed, setTyped] = useState<{ round: string; text: string } | null>(null)
  const request = typed?.round === round ? typed.text : proposal
  const submit = (event: FormEvent) => {
    event.preventDefault()
    onRevise(request)
    setTyped(null)
  }

  const left = (deliverable.redTeam?.findings.length ?? 0) - seenKeys.length
  const side = (
    <aside className="panel review-panel" aria-label={messages.review.panel}>
      <div className="panel-head">
        <h4>{messages.review.panel}</h4>
      </div>
      {deliverable.draft && (
        <section className="panel-body review-part" aria-label={messages.review.computed}>
          <span className="eyebrow">{messages.review.computed}</span>
          <AnswerChecks answer={deliverable.draft} />
          {kind?.audience === 'client' && <ClientFilter text={deliverable.draft.text} />}
        </section>
      )}
      <section className="panel-body review-part" aria-label={messages.review.judged}>
        <span className="eyebrow">{messages.review.judged}</span>
        {deliverable.status === 'writing' && deliverable.draft && !deliverable.redTeam && (
          <Waiting>{messages.review.pending}</Waiting>
        )}
        {deliverable.redTeam && (
          <RedTeam
            report={deliverable.redTeam}
            approved={deliverable.status === 'approved'}
            seen={inReview ? seenKeys : null}
            onSeen={toggleSeen}
            busy={busy}
            onFix={onRevise}
          />
        )}
        {inReview && (
          <div className="review-row">
            {deliverable.redTeam && (
              <span className="hint" role="status">
                {messages.review.left(left)}
              </span>
            )}
            {kind && (
              <details className="review-fold" aria-label={messages.deliverableChecklist}>
                <summary>{messages.deliverableChecklist}</summary>
                <ul className="missing">
                  {kind.checklist.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
        {inReview && (
          <form className="source-form" onSubmit={submit}>
            <label>
              {messages.deliverableChange}
              <textarea
                rows={request.split('\n').length + 1}
                value={request}
                onChange={(event) => setTyped({ round, text: event.target.value })}
              />
            </label>
            <div className="actions review-commands">
              <BusyButton
                type="submit"
                className="quiet-submit"
                busy={step === 'revise'}
                busyLabel={messages.wait.changing}
                disabled={busy || !request.trim()}
              >
                {messages.deliverableChangeSubmit}
              </BusyButton>
              <BusyButton
                className="primary"
                busy={step === 'approve'}
                busyLabel={messages.wait.approving}
                disabled={busy}
                onClick={onApprove}
              >
                {messages.deliverableApprove}
              </BusyButton>
            </div>
          </form>
        )}
      </section>
    </aside>
  )

  const rounds = costOf(deliverable).rounds
  return (
    <>
      <div>
        <div className="review-head">
          <h3>{deliverable.title}</h3>
          <StatusMark status={deliverable.status} />
        </div>
        <p className="hint">
          {[
            kind?.title ?? deliverable.kindId,
            ...(kind ? [messages.deliverableFor[kind.audience]] : []),
            messages.deliverableRounds(rounds),
            ...(deliverable.models?.write
              ? [
                  messages.models.wroteAndReviewed(
                    deliverable.models.write,
                    deliverable.models.review,
                  ),
                ]
              : []),
          ].join(' · ')}
        </p>
      </div>
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
        <div className="panel">
          <div className="list-row files-row">
            <h4>{messages.deliverableFiles}</h4>
            {deliverable.files.map((path) => (
              <button key={path} type="button" onClick={() => void onOpen(path)}>
                {path.split('/').at(-1)}
              </button>
            ))}
          </div>
        </div>
      )}
      {deliverable.draft ? (
        <div className="draft">
          <AnswerView answer={deliverable.draft} onOpenSource={onOpen} side={side} checksAside />
          {inReview && <p className="hint">{messages.deliverableSourcesNote}</p>}
        </div>
      ) : (
        side
      )}
    </>
  )
}

/** Days of effort and amounts found by the code in a text that goes to the client. */
function ClientFilter({ text }: { text: string }) {
  const found = clientFilter(text)
  if (found.length === 0) return null
  return (
    <section className="red-team" aria-label={messages.deliverableClientFilter}>
      <h4 title={messages.deliverableClientFilterIntro}>{messages.deliverableClientFilter}</h4>
      <ul className="findings">
        {found.map((finding) => (
          <li key={`${finding.kind}-${finding.excerpt}`} className="finding">
            <span className="severity severity-media">
              {messages.deliverableClientFilterKind[finding.kind]}
            </span>
            <strong>{finding.match}</strong>
            <blockquote>{finding.excerpt}</blockquote>
          </li>
        ))}
      </ul>
    </section>
  )
}

function RedTeam({
  report,
  approved,
  seen,
  onSeen,
  busy,
  onFix,
}: {
  report: RedTeamReport
  /** True once the PM approved: what the reading asked to correct is then history. */
  approved: boolean
  /** The findings the PM marked as seen; null when the draft is no longer under review. */
  seen: readonly string[] | null
  onSeen: (key: string) => void
  /** True while a step runs on the deliverable: nothing else is asked meanwhile. */
  busy: boolean
  /** Asks to write again the passage of one finding only, as the PM says. */
  onFix: (request: string) => void
}) {
  /** The finding being corrected, with what the PM wrote of it. */
  const [fixing, setFixing] = useState<{ key: string; words: string } | null>(null)
  const ok = report.verdict === 'deliverable'
  const toCorrect = approved
    ? messages.deliverableRedTeamFixApproved
    : messages.deliverableRedTeamFix
  return (
    <section className="red-team" aria-label={messages.deliverableRedTeam}>
      <p className={ok ? 'badge badge-ok' : 'badge badge-warning'}>
        {ok ? messages.deliverableRedTeamOk : toCorrect}
      </p>
      {report.findings.length > 0 && (
        <ul className="findings">
          {report.findings.map((finding) => {
            const key = findingKey(finding)
            const marked = seen?.includes(key) ?? false
            return (
              <li key={key} className={marked ? 'finding finding-seen' : 'finding'}>
                <details>
                  <summary>
                    <span className={`severity severity-${finding.severity}`}>
                      {messages.deliverableSeverity[finding.severity]}
                    </span>
                    {finding.finding}
                  </summary>
                  <blockquote>{finding.where}</blockquote>
                  {finding.why && <p className="hint">{finding.why}</p>}
                </details>
                {seen && fixing?.key !== key && (
                  <div className="finding-actions">
                    <button
                      type="button"
                      className="link"
                      aria-pressed={marked}
                      onClick={() => onSeen(key)}
                    >
                      {marked ? messages.review.seenDone : messages.review.seen}
                    </button>
                    <button
                      type="button"
                      className="link"
                      disabled={busy}
                      onClick={() => setFixing({ key, words: '' })}
                    >
                      {text.fix}
                    </button>
                  </div>
                )}
                {seen && fixing?.key === key && (
                  <form
                    className="source-form"
                    onSubmit={(event) => {
                      event.preventDefault()
                      onFix(text.fixRequest(finding.where, finding.finding, fixing.words.trim()))
                      setFixing(null)
                    }}
                  >
                    <textarea
                      aria-label={text.fixWhat}
                      placeholder={text.fixWhat}
                      rows={2}
                      value={fixing.words}
                      onChange={(event) => setFixing({ key, words: event.target.value })}
                    />
                    <div className="actions">
                      <button type="submit" className="quiet-submit" disabled={busy}>
                        {text.fixSubmit}
                      </button>
                      <button type="button" className="quiet" onClick={() => setFixing(null)}>
                        {messages.cancel}
                      </button>
                    </div>
                  </form>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

/** The columns of the register that hold words: the total is named across them. */
const REGISTER_WORD_COLUMNS = 4

/** The columns of the register, in the order of their headings. */
function registerColumns(titleOf: (kindId: string) => string): DataColumn<Deliverable>[] {
  const [created, kind, title, status, draft, review, rounds] = messages.deliverableRegisterHead
  const minutes = (
    key: string,
    label: string | undefined,
    of: (deliverable: Deliverable) => number,
  ): DataColumn<Deliverable> => ({
    key,
    label: label ?? '',
    kind: 'number',
    width: '110px',
    cell: (deliverable) => of(deliverable),
    sort: (deliverable) => of(deliverable),
  })
  return [
    {
      key: 'created',
      label: created ?? '',
      width: '100px',
      cell: (deliverable) => dateText(deliverable.createdAt),
      sort: (deliverable) => deliverable.createdAt,
    },
    {
      key: 'kind',
      label: kind ?? '',
      width: '200px',
      cell: (deliverable) => titleOf(deliverable.kindId),
      sort: (deliverable) => titleOf(deliverable.kindId),
      text: (deliverable) => titleOf(deliverable.kindId),
    },
    {
      key: 'title',
      label: title ?? '',
      cell: (deliverable) => <strong>{deliverable.title}</strong>,
      sort: (deliverable) => deliverable.title,
      text: (deliverable) => deliverable.title,
    },
    {
      key: 'status',
      label: status ?? '',
      width: '130px',
      cell: (deliverable) => <StatusMark status={deliverable.status} />,
      sort: (deliverable) => messages.deliverableStatus[deliverable.status],
      text: (deliverable) => messages.deliverableStatus[deliverable.status],
    },
    minutes('draft', draft, (deliverable) => costOf(deliverable).draftMinutes),
    minutes('review', review, (deliverable) => costOf(deliverable).reviewMinutes),
    minutes('rounds', rounds, (deliverable) => costOf(deliverable).rounds),
  ]
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
        <div className="table-wide register-table">
          <DataTable
            label={messages.deliverableRegister}
            columns={registerColumns(titleOf)}
            rows={all}
            rowKey={(deliverable) => deliverable.id}
            footer={
              <tr>
                <th scope="row" colSpan={REGISTER_WORD_COLUMNS}>
                  {messages.deliverableRegisterApproved(totals.deliverables)}
                </th>
                <td className="number">{totals.draftMinutes}</td>
                <td className="number">{totals.reviewMinutes}</td>
                <td className="number">{totals.rounds}</td>
              </tr>
            }
          />
        </div>
      )}
    </>
  )
}

const EMPTY_KIND: OwnKindInput = {
  title: '',
  summary: '',
  audience: 'client',
  questions: [],
  instructions: '',
  checklist: [],
}

/** A kind of deliverable described in words by the PM: new, or one of theirs to change. */
function OwnKindForm({
  api,
  project,
  kind,
  onSave,
}: {
  api: KindTemplateApi
  project: Project
  kind: DeliverableKind | undefined
  /** Saves the kind; with `withTemplate` the PM is then asked for the file of its template. */
  onSave: (input: OwnKindInput, withTemplate: boolean) => void
}) {
  const [input, setInput] = useState<OwnKindInput>(kind ? ownKindInput(kind) : EMPTY_KIND)
  const questionsHint = useId()
  const set = (change: Partial<OwnKindInput>) => setInput({ ...input, ...change })
  const submit = (event: FormEvent) => {
    event.preventDefault()
    onSave(input, false)
  }
  const ready = input.title.trim() !== '' && input.instructions.trim() !== ''

  return (
    <>
      <h3>{kind ? kind.title : messages.ownKindNew}</h3>
      <p className="hint">{messages.ownKindIntro}</p>
      <form className="source-form" onSubmit={submit}>
        <label>
          {messages.ownKindTitle}
          <input
            type="text"
            value={input.title}
            onChange={(event) => set({ title: event.target.value })}
          />
        </label>
        <label>
          {messages.ownKindSummary}
          <input
            type="text"
            value={input.summary}
            onChange={(event) => set({ summary: event.target.value })}
          />
        </label>
        <label>
          {messages.ownKindAudience}
          <select
            value={input.audience}
            onChange={(event) =>
              set({ audience: event.target.value === 'internal' ? 'internal' : 'client' })
            }
          >
            <option value="client">{messages.deliverableFor.client}</option>
            <option value="internal">{messages.deliverableFor.internal}</option>
          </select>
        </label>
        <label>
          {messages.ownKindQuestions}
          <textarea
            rows={3}
            aria-describedby={questionsHint}
            value={input.questions.join('\n')}
            onChange={(event) => set({ questions: event.target.value.split('\n') })}
          />
        </label>
        <p id={questionsHint} className="hint">
          {messages.ownKindQuestionsHint}
        </p>
        <label>
          {messages.ownKindInstructions}
          <textarea
            rows={8}
            value={input.instructions}
            onChange={(event) => set({ instructions: event.target.value })}
          />
          <span className="hint">{messages.ownKindInstructionsHint}</span>
        </label>
        <label>
          {messages.ownKindChecklist}
          <textarea
            rows={3}
            value={input.checklist.join('\n')}
            onChange={(event) => set({ checklist: event.target.value.split('\n') })}
          />
        </label>
        {kind ? (
          <KindTemplate api={api} project={project} kind={kind} />
        ) : (
          <p className="hint">{messages.kindTemplate.newKindHint}</p>
        )}
        <div className="actions">
          <button type="submit" disabled={!ready}>
            {messages.ownKindSave}
          </button>
          {!kind && (
            <button type="button" disabled={!ready} onClick={() => onSave(input, true)}>
              {messages.kindTemplate.saveAndChoose}
            </button>
          )}
        </div>
      </form>
    </>
  )
}
