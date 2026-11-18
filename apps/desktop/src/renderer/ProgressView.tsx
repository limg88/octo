import type { ProgressFile, ProgressView as View } from '@octo/application'
import {
  type InvoicedOrder,
  orderTotal,
  type ProgressSettings,
  type ProgressStep,
  type ProgressWarning,
  type Project,
} from '@octo/domain'
import { useEffect, useState } from 'react'
import type { ErrorCode, OctoApi } from '../shared/api.ts'
import { Failure } from './Failure.tsx'
import { dateText, messages } from './messages.ts'
import { ProgressInvoices } from './ProgressInvoices.tsx'
import { ProgressRequestForm } from './ProgressRequestForm.tsx'
import { ProgressSetup } from './ProgressSetup.tsx'
import { ProgressShares } from './ProgressShares.tsx'
import { problemText, warningRequest, warningText } from './progress-words.ts'
import { useSavedNote } from './SavedNote.tsx'
import { Waiting } from './Spinner.tsx'
import type { Section } from './sections.ts'

type ProgressApi = Pick<
  OctoApi,
  | 'progressSettings'
  | 'saveProgressSettings'
  | 'progressCandidates'
  | 'progressView'
  | 'compileProgress'
  | 'registerProgressInvoices'
  | 'openEvidence'
  | 'chooseProjectPath'
>

type Props = {
  api: ProgressApi
  project: Project
  /**
   * True for a project sold only at a fixed price: until the PM sets a form of the client, what
   * was ordered and invoiced is in the sheet of the project code, and the page sends there.
   */
  fixedPrice?: boolean
  onOpenSection?: ((section: Section) => void) | undefined
}

const text = messages.progress
/** Rounding leaves less than this on a request that the form can show. */
const CENT = 0.01

/** What the page is showing beside the requests: nothing, the settings, or one request typed. */
type Panel = { kind: 'none' } | { kind: 'setup' } | { kind: 'request'; n: number }
const CLOSED: Panel = { kind: 'none' }

/** With these three a form can be filled: the form itself, its table, and the order. */
const ready = (settings: ProgressSettings): boolean =>
  settings.modelPath !== '' && settings.form.table !== null && settings.positions.length > 0

/** The requests to have a share of the order recognised, on the form of the client. */
export function ProgressView({ api, project, fixedPrice = false, onOpenSection }: Props) {
  const [settings, setSettings] = useState<ProgressSettings | null>(null)
  const [candidates, setCandidates] = useState<string[]>([])
  const [view, setView] = useState<View | null>(null)
  const [error, setError] = useState<ErrorCode | null>(null)
  const savedNote = useSavedNote()
  const [file, setFile] = useState<ProgressFile | null>(null)
  const [panel, setPanel] = useState<Panel>(CLOSED)

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
    setPanel(CLOSED)
    void api.progressSettings(project.id).then(async (result) => {
      if (!result.ok) return setError(result.code)
      setSettings(result.value)
      await loadView()
      const found = await api.progressCandidates(project.id)
      if (found.ok) setCandidates(found.value)
    })
  }, [api, project.id])

  /** True when the settings were saved: what follows a save happens only then. */
  async function save(next: ProgressSettings): Promise<boolean> {
    setError(null)
    savedNote.clear()
    const result = await api.saveProgressSettings(project.id, next)
    if (!result.ok) {
      setError(result.code)
      return false
    }
    setSettings(result.value)
    savedNote.saved()
    setPanel(CLOSED)
    await loadView()
    return true
  }

  async function compile(n: number) {
    setError(null)
    setFile(null)
    const result = await api.compileProgress(project.id, n)
    if (result.ok) setFile(result.value)
    else setError(result.code)
  }

  async function registerInvoices() {
    setError(null)
    savedNote.clear()
    const result = await api.registerProgressInvoices(project.id)
    if (!result.ok) return setError(result.code)
    setSettings(result.value)
    savedNote.saved()
    await loadView()
  }

  if (settings === null) {
    return error ? (
      <Failure code={error} />
    ) : (
      <div className="page-wait">
        <Waiting>{text.loading}</Waiting>
      </div>
    )
  }

  if (fixedPrice && !ready(settings) && panel.kind !== 'setup') {
    return (
      <div className="dashboard">
        {error && <Failure code={error} />}
        <p className="hint">{text.fixedPrice.intro}</p>
        <div className="actions">
          {onOpenSection && (
            <button type="button" className="primary" onClick={() => onOpenSection('sheet')}>
              {messages.openSection(messages.sheetTab)}
            </button>
          )}
          <button type="button" className="quiet" onClick={() => setPanel({ kind: 'setup' })}>
            {text.fixedPrice.useForm}
          </button>
        </div>
      </div>
    )
  }

  if (!ready(settings) || panel.kind === 'setup') {
    return (
      <div className="dashboard">
        {error && <Failure code={error} />}
        <p className="hint">{ready(settings) ? text.intro : text.setup.firstTime}</p>
        <ProgressSetup
          settings={settings}
          candidates={candidates}
          onSave={async (next) => {
            await save(next)
          }}
          onChooseModel={async () => {
            setError(null)
            const result = await api.chooseProjectPath(project.id, 'file', ['xlsx'])
            if (result.ok) return result.value
            setError(result.code)
            return null
          }}
          onClose={ready(settings) ? () => setPanel(CLOSED) : undefined}
        />
      </div>
    )
  }

  const { requests } = settings
  const steps = view?.computation.ok ? view.computation.steps : []
  const warnings = view?.warnings ?? []
  const invoiced = view?.invoices?.order ?? null
  /** Everything billed and every invoice known to Octo: there is nothing left to ask. */
  const nothingToAsk = invoiced?.fulfilled === true && invoiced.unregistered.length === 0

  return (
    <div className="dashboard">
      {error && <Failure code={error} />}
      {savedNote.note}
      <Overview
        settings={settings}
        invoiced={invoiced}
        onSetup={() => setPanel({ kind: 'setup' })}
      />
      {warnings
        .filter((warning) => warningRequest(warning) === null)
        .map((warning) => (
          <p key={warning.kind} className="warning">
            {warningText(warning)}
          </p>
        ))}
      {view && !view.computation.ok && (
        <p className="warning" role="alert">
          {problemText(view.computation.problem)}
        </p>
      )}
      {panel.kind === 'request' ? (
        <ProgressRequestForm
          // A request opened after another starts from its own values.
          key={panel.n}
          settings={settings}
          n={panel.n}
          onCancel={() => setPanel(CLOSED)}
          onSave={async (next, andCompile) => {
            if ((await save(next)) && andCompile) await compile(panel.n)
          }}
        />
      ) : (
        !nothingToAsk && (
          <div className="actions">
            <button
              type="button"
              className="primary"
              onClick={() => setPanel({ kind: 'request', n: requests.length + 1 })}
            >
              {text.newRequest}
            </button>
          </div>
        )
      )}
      {view?.invoices && (
        <ProgressInvoices
          invoices={view.invoices}
          order={settings.order}
          linked={settings.salesOrders}
          onLink={(salesOrders) => void save({ ...settings, salesOrders })}
          onRegister={() => void registerInvoices()}
        />
      )}
      {requests.length === 0 && <p className="hint">{text.noRequests}</p>}
      {[...requests].reverse().map((request) => (
        <Request
          key={request.n}
          n={request.n}
          last={request.n === requests.length}
          step={steps[request.n - 1]}
          settings={settings}
          warnings={warnings.filter((warning) => warningRequest(warning) === request.n)}
          file={file?.n === request.n ? file : null}
          onCompile={() => void compile(request.n)}
          onOpen={(path) => void api.openEvidence(project.id, path)}
          onCorrect={() => setPanel({ kind: 'request', n: request.n })}
          onRemove={() => void save({ ...settings, requests: requests.slice(0, -1) })}
        />
      ))}
    </div>
  )
}

/** The order at a glance: what it is worth, what was asked, what is left. */
function Overview({
  settings,
  invoiced,
  onSetup,
}: {
  settings: ProgressSettings
  /** What the company system has billed of the order; null: Octo knows only its own requests. */
  invoiced: InvoicedOrder | null
  onSetup: () => void
}) {
  const total = orderTotal(settings.positions)
  const asked = settings.requests.reduce((sum, request) => sum + request.amount, 0)
  // What is billed is a fact of the company system; what was asked through Octo may lag behind it.
  const done = invoiced ? Math.max(invoiced.invoiced, asked) : asked
  const figures: Array<[string, number]> = [
    [text.orderTotal, total],
    [text.asked, asked],
    ...(invoiced ? [[text.invoices.billedTotal, invoiced.invoiced] as [string, number]] : []),
    [text.left, Math.max(0, total - done)],
  ]
  return (
    <section className="progress-overview" aria-label={text.orderName(settings.order)}>
      <header>
        <h3>{text.orderName(settings.order)}</h3>
        <button type="button" onClick={onSetup}>
          {text.setup.open}
        </button>
      </header>
      <dl className="figures">
        {figures.map(([label, value]) => (
          <div key={label} className="figure">
            <dt>{label}</dt>
            <dd>{text.money(value)}</dd>
          </div>
        ))}
      </dl>
      <progress max={total} value={Math.min(done, total)} aria-label={text.asked} />
    </section>
  )
}

function Request({
  n,
  last,
  step,
  settings,
  warnings,
  file,
  onCompile,
  onOpen,
  onCorrect,
  onRemove,
}: {
  n: number
  /** The latest request: the one in view, and the only one that can be taken off. */
  last: boolean
  /** Absent while the shares cannot be computed. */
  step: ProgressStep | undefined
  settings: ProgressSettings
  warnings: ProgressWarning[]
  file: ProgressFile | null
  onCompile: () => void
  onOpen: (path: string) => void
  onCorrect: () => void
  onRemove: () => void
}) {
  const [removing, setRemoving] = useState(false)
  const request = settings.requests[n - 1]
  if (!request) return null
  const day = (value: string) => (value === '' ? '' : dateText(value))
  const total = orderTotal(settings.positions)
  const summary = text.summary(
    text.period(day(request.from), day(request.to)),
    text.money(request.amount),
    text.money(step?.cumulative ?? request.amount),
    text.money(total),
  )
  const drift = step ? Math.abs(step.rebuilt - step.cumulative) : 0
  return (
    <details className="request" open={last || undefined}>
      <summary>
        <strong>{text.requestN(n)}</strong> <span className="hint">{summary}</span>
      </summary>
      <section aria-label={text.requestN(n)}>
        {step?.closing && <p className="badge badge-ok">{text.closing}</p>}
        {warnings.map((warning) => (
          <p key={warning.kind} className="badge badge-warning">
            {warningText(warning)}
          </p>
        ))}
        {step && <ProgressShares step={step} positions={settings.positions} />}
        {drift >= CENT && <p className="hint">{text.drift(text.money(drift))}</p>}
        <div className="actions">
          {step && (
            <button type="button" className={last ? 'primary' : undefined} onClick={onCompile}>
              {text.compile(n)}
            </button>
          )}
          <button type="button" aria-label={text.correctN(n)} onClick={onCorrect}>
            {text.correct}
          </button>
          {last && !removing && (
            <button
              type="button"
              className="quiet"
              aria-label={text.removeN(n)}
              onClick={() => setRemoving(true)}
            >
              {text.remove}
            </button>
          )}
        </div>
        {removing && (
          <div className="actions" role="alert">
            <span>{text.removeConfirm(n)}</span>
            <button type="button" className="danger" onClick={onRemove}>
              {text.remove}
            </button>
            <button type="button" onClick={() => setRemoving(false)}>
              {messages.cancel}
            </button>
          </div>
        )}
        {file && (
          <p className="badge badge-ok">
            {text.compiled(file.path)}{' '}
            <button type="button" className="quiet" onClick={() => onOpen(file.path)}>
              {text.open}
            </button>
          </p>
        )}
      </section>
    </details>
  )
}
