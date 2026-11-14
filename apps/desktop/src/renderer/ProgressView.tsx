import type { ProgressFile, ProgressView as View } from '@octo/application'
import type {
  OrderPosition,
  ProgressProblem,
  ProgressSettings,
  ProgressStep,
  ProgressWarning,
  Project,
} from '@octo/domain'
import { useEffect, useState } from 'react'
import type { ErrorCode, OctoApi } from '../shared/api.ts'
import { amountOf, amountText } from './forecast-text.ts'
import { dateText, errorText, messages } from './messages.ts'
import {
  fieldLines,
  fieldsOf,
  listOf,
  listText,
  positionLines,
  positionsOf,
  tableLine,
  tableOf,
} from './progress-text.ts'

type ProgressApi = Pick<
  OctoApi,
  | 'progressSettings'
  | 'saveProgressSettings'
  | 'progressCandidates'
  | 'progressView'
  | 'compileProgress'
  | 'openEvidence'
>

type Props = { api: ProgressApi; project: Project }

const text = messages.progress
/** Rounding leaves less than this on a request that the form can show. */
const CENT = 0.01

/** The requests to have a share of the order recognised, on the form of the client. */
export function ProgressView({ api, project }: Props) {
  const [settings, setSettings] = useState<ProgressSettings | null>(null)
  const [candidates, setCandidates] = useState<string[]>([])
  const [view, setView] = useState<View | null>(null)
  const [error, setError] = useState<ErrorCode | null>(null)
  const [file, setFile] = useState<ProgressFile | null>(null)

  async function loadView() {
    setFile(null)
    const result = await api.progressView(project.id)
    if (result.ok) setView(result.value)
    else setError(result.code)
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new project starts from its settings.
  useEffect(() => {
    setSettings(null)
    setView(null)
    setError(null)
    setFile(null)
    void api.progressSettings(project.id).then(async (result) => {
      if (!result.ok) return setError(result.code)
      setSettings(result.value)
      await loadView()
      if (result.value.modelPath !== '') return
      const found = await api.progressCandidates(project.id)
      if (found.ok) setCandidates(found.value)
    })
  }, [api, project.id])

  async function save(next: ProgressSettings) {
    setError(null)
    const result = await api.saveProgressSettings(project.id, next)
    if (!result.ok) return setError(result.code)
    setSettings(result.value)
    await loadView()
  }

  async function compile(n: number) {
    setError(null)
    setFile(null)
    const result = await api.compileProgress(project.id, n)
    if (result.ok) setFile(result.value)
    else setError(result.code)
  }

  if (settings === null) {
    return error ? <Failure code={error} /> : <p className="progress">{text.loading}</p>
  }
  const configured = settings.positions.length > 0

  return (
    <div className="dashboard">
      {error && <Failure code={error} />}
      <p className="hint">{text.intro}</p>
      {view && configured && (
        <Result
          view={view}
          positions={settings.positions}
          file={file}
          onCompile={(n) => void compile(n)}
          onOpen={(path) => void api.openEvidence(project.id, path)}
        />
      )}
      {configured ? (
        <details className="dashboard-settings">
          <summary>{text.orderTitle}</summary>
          <SettingsForm settings={settings} candidates={candidates} onSave={save} />
        </details>
      ) : (
        <section aria-label={text.orderTitle}>
          <h3>{text.orderTitle}</h3>
          <SettingsForm settings={settings} candidates={candidates} onSave={save} />
        </section>
      )}
    </div>
  )
}

function Failure({ code }: { code: ErrorCode }) {
  return (
    <p className="warning" role="alert">
      {errorText(code)}
    </p>
  )
}

function problemText(problem: ProgressProblem): string {
  switch (problem.kind) {
    case 'no_positions':
      return text.problem.no_positions
    case 'over_total':
      return text.problem.over_total(problem.n, text.money(problem.excess))
    case 'unknown_positions':
      return text.problem.unknown_positions(problem.n, problem.codes.join(', '))
    case 'over_positions':
      return text.problem.over_positions(problem.n, text.money(problem.excess))
  }
}

function warningText(warning: ProgressWarning): string {
  switch (warning.kind) {
    case 'total_differs':
      return text.warning.total_differs(text.money(warning.declared), text.money(warning.positions))
    case 'dates_missing':
      return text.warning.dates_missing(warning.n)
    case 'dates_not_chained':
      return text.warning.dates_not_chained(warning.n)
    case 'note_missing':
      return text.warning.note_missing(warning.n)
  }
}

function Result({
  view,
  positions,
  file,
  onCompile,
  onOpen,
}: {
  view: View
  positions: OrderPosition[]
  file: ProgressFile | null
  onCompile: (n: number) => void
  onOpen: (path: string) => void
}) {
  const { computation, warnings } = view
  return (
    <>
      {warnings.map((warning) => (
        <p key={`${warning.kind}-${'n' in warning ? warning.n : ''}`} className="warning">
          {warningText(warning)}
        </p>
      ))}
      {!computation.ok && (
        <p className="warning" role="alert">
          {problemText(computation.problem)}
        </p>
      )}
      {computation.ok && computation.steps.length === 0 && (
        <p className="hint">{text.noRequests}</p>
      )}
      {computation.ok &&
        computation.steps.map((step) => (
          <Step
            key={step.request.n}
            step={step}
            total={computation.total}
            positions={positions}
            file={file?.n === step.request.n ? file : null}
            onCompile={onCompile}
            onOpen={onOpen}
          />
        ))}
    </>
  )
}

function Step({
  step,
  total,
  positions,
  file,
  onCompile,
  onOpen,
}: {
  step: ProgressStep
  total: number
  positions: OrderPosition[]
  file: ProgressFile | null
  onCompile: (n: number) => void
  onOpen: (path: string) => void
}) {
  const { request } = step
  const day = (value: string) => (value === '' ? '' : dateText(value))
  const drift = Math.abs(step.rebuilt - step.cumulative)
  return (
    <section aria-label={text.requestN(request.n)}>
      <h3>{text.requestN(request.n)}</h3>
      <p className="hint">
        {text.summary(
          text.period(day(request.from), day(request.to)),
          text.money(request.amount),
          text.money(step.cumulative),
          text.money(total),
        )}
      </p>
      {step.closing && <p className="badge badge-ok">{text.closing}</p>}
      <table className="data">
        <thead>
          <tr>
            <th>{text.columnPosition}</th>
            <th className="number">{text.columnAmount}</th>
            <th className="number">{text.columnPrevious}</th>
            <th className="number">{text.columnCurrent}</th>
            <th className="number">{text.columnPeriod}</th>
          </tr>
        </thead>
        <tbody>
          {positions.map((position, index) => (
            <tr key={position.code}>
              <td>{position.code}</td>
              <td className="number">{text.money(position.amount)}</td>
              <td className="number">{text.share(step.previous[index] ?? 0)}</td>
              <td className="number">{text.share(step.current[index] ?? 0)}</td>
              <td className="number">{text.share(step.period[index] ?? 0)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {drift >= CENT && <p className="hint">{text.drift(text.money(drift))}</p>}
      <div className="actions">
        <button type="button" onClick={() => onCompile(request.n)}>
          {text.compile(request.n)}
        </button>
      </div>
      {file && (
        <p className="badge badge-ok">
          {text.compiled(file.path)}{' '}
          <button type="button" className="quiet" onClick={() => onOpen(file.path)}>
            {text.open}
          </button>
        </p>
      )}
    </section>
  )
}

type RequestDraft = { from: string; to: string; amount: string; positions: string; note: string }
type Draft = {
  order: string
  total: string
  positions: string
  requests: RequestDraft[]
  modelPath: string
  fields: string
  table: string
}

const EMPTY_REQUEST: RequestDraft = { from: '', to: '', amount: '', positions: '', note: '' }

const draftOf = (settings: ProgressSettings): Draft => ({
  order: settings.order,
  total: amountText(settings.total),
  positions: positionLines(settings.positions),
  requests: settings.requests.map((request) => ({
    from: request.from,
    to: request.to,
    amount: amountText(request.amount),
    positions: listText(request.positions),
    note: request.note,
  })),
  modelPath: settings.modelPath,
  fields: fieldLines(settings.form.fields),
  table: tableLine(settings.form.table),
})

const settingsOf = (draft: Draft): ProgressSettings => ({
  modelPath: draft.modelPath,
  order: draft.order,
  total: amountOf(draft.total),
  positions: positionsOf(draft.positions),
  requests: draft.requests.map((request, index) => ({
    n: index + 1,
    from: request.from,
    to: request.to,
    amount: amountOf(request.amount) ?? 0,
    positions: listOf(request.positions),
    note: request.note,
  })),
  form: { fields: fieldsOf(draft.fields), table: tableOf(draft.table) },
})

type TextField = 'order' | 'total' | 'positions' | 'modelPath' | 'fields' | 'table'

function SettingsForm({
  settings,
  candidates,
  onSave,
}: {
  settings: ProgressSettings
  candidates: string[]
  onSave: (settings: ProgressSettings) => Promise<void>
}) {
  const [draft, setDraft] = useState<Draft>(() => draftOf(settings))
  useEffect(() => setDraft(draftOf(settings)), [settings])
  // The only form found is proposed without asking.
  useEffect(() => {
    setDraft((current) => ({
      ...current,
      modelPath: current.modelPath || (candidates.length === 1 ? (candidates[0] ?? '') : ''),
    }))
  }, [candidates])

  const set = (name: TextField, value: string) =>
    setDraft((current) => ({ ...current, [name]: value }))
  const setRequest = (index: number, change: Partial<RequestDraft>) =>
    setDraft((current) => ({
      ...current,
      requests: current.requests.map((request, at) =>
        at === index ? { ...request, ...change } : request,
      ),
    }))
  const input = (name: TextField, label: string) => (
    <label>
      {label}
      <input type="text" value={draft[name]} onChange={(event) => set(name, event.target.value)} />
    </label>
  )
  const area = (name: TextField, label: string) => (
    <label>
      {label}
      <textarea value={draft[name]} onChange={(event) => set(name, event.target.value)} />
    </label>
  )
  const requestInput = (
    index: number,
    name: keyof RequestDraft,
    label: string,
    type: 'text' | 'date' = 'text',
  ) => (
    <label>
      {label}
      <input
        type={type}
        value={draft.requests[index]?.[name] ?? ''}
        onChange={(event) => setRequest(index, { [name]: event.target.value })}
      />
    </label>
  )

  return (
    <form
      className="settings-form"
      onSubmit={(event) => {
        event.preventDefault()
        void onSave(settingsOf(draft))
      }}
    >
      {input('order', text.order)}
      {input('total', text.total)}
      {area('positions', text.positions)}
      <h4>{text.requestsTitle}</h4>
      {draft.requests.map((_request, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: a request is its place in the order of time.
        <fieldset key={index} aria-label={text.requestN(index + 1)}>
          <legend>{text.requestN(index + 1)}</legend>
          {requestInput(index, 'from', text.from, 'date')}
          {requestInput(index, 'to', text.to, 'date')}
          {requestInput(index, 'amount', text.amount)}
          {requestInput(index, 'positions', text.requestPositions)}
          {requestInput(index, 'note', text.note)}
          <button
            type="button"
            className="quiet"
            onClick={() =>
              setDraft((current) => ({
                ...current,
                requests: current.requests.filter((_kept, at) => at !== index),
              }))
            }
          >
            {text.removeRequest(index + 1)}
          </button>
        </fieldset>
      ))}
      <div className="actions">
        <button
          type="button"
          className="quiet"
          onClick={() =>
            setDraft((current) => ({
              ...current,
              // A request starts where the one before ends.
              requests: [
                ...current.requests,
                { ...EMPTY_REQUEST, from: current.requests.at(-1)?.to ?? '' },
              ],
            }))
          }
        >
          {text.addRequest}
        </button>
      </div>
      <h4>{text.formTitle}</h4>
      <label>
        {text.modelPath}
        <input
          type="text"
          list={candidates.length > 0 ? 'progress-models' : undefined}
          value={draft.modelPath}
          onChange={(event) => set('modelPath', event.target.value)}
        />
        {candidates.length > 0 && (
          <datalist id="progress-models">
            {candidates.map((candidate) => (
              <option key={candidate} value={candidate} />
            ))}
          </datalist>
        )}
      </label>
      {area('fields', text.fields)}
      <p className="hint">{text.fieldsHint}</p>
      {input('table', text.table)}
      <div className="actions">
        <button type="submit">{text.save}</button>
      </div>
    </form>
  )
}
