import type { FeedView } from '@octo/application'
import {
  type FeedChoices,
  type FeedConfig,
  type FeedName,
  feedLabel,
  type Project,
  WAREHOUSE_TLS_MODES,
} from '@octo/domain'
import { type FormEvent, useCallback, useEffect, useState } from 'react'
import type { ErrorCode, OctoApi } from '../shared/api.ts'
import { dateTimeText, errorText, messages } from './messages.ts'

type Props = {
  api: OctoApi
  project: Project
  feed: FeedName
  now?: () => Date
}

type FieldKey = keyof typeof messages.feedFields
type FieldKind = 'text' | 'list' | 'number' | 'date' | 'tls'
type Field = { key: FieldKey; kind: FieldKind; initial?: string; optional?: true }
/** What the PM types, as text: lists are one item per line. */
type Form = Partial<Record<FieldKey, string>>

const SHARED: Field[] = [
  { key: 'since', kind: 'date' },
  { key: 'targetFolder', kind: 'text' },
]
const DEFAULT_WAREHOUSE_PORT = '5432'

const FIELDS: Readonly<Record<FeedName, Field[]>> = {
  ado: [
    { key: 'organization', kind: 'text' },
    { key: 'project', kind: 'text' },
    { key: 'areas', kind: 'list', optional: true },
  ],
  jira: [
    { key: 'site', kind: 'text' },
    { key: 'email', kind: 'text' },
    { key: 'projects', kind: 'list' },
  ],
  dwsi: [
    { key: 'host', kind: 'text' },
    { key: 'port', kind: 'number', initial: DEFAULT_WAREHOUSE_PORT },
    { key: 'database', kind: 'text' },
    { key: 'user', kind: 'text' },
    { key: 'ownerEmail', kind: 'text' },
    { key: 'projectCodes', kind: 'list' },
    { key: 'tls', kind: 'tls', initial: WAREHOUSE_TLS_MODES[0] },
  ],
}

const DAY_MS = 24 * 60 * 60 * 1000
const DEFAULT_DAYS_BACK = 30
const NOTHING_MISSING = { fields: [], secret: false }
const systemNow = (): Date => new Date()
const dayOf = (date: Date): string => date.toISOString().slice(0, 10)
const fieldsOf = (feed: FeedName): Field[] => [...FIELDS[feed], ...SHARED]

function formOf(view: FeedView, now: Date): Form {
  const stored = (view.config ?? {}) as Record<string, unknown>
  const defaults: Form = {
    since: dayOf(new Date(now.getTime() - DEFAULT_DAYS_BACK * DAY_MS)),
    targetFolder: view.suggestedFolder,
  }
  const form: Form = {}
  for (const field of fieldsOf(view.feed)) {
    const value = stored[field.key]
    form[field.key] = Array.isArray(value)
      ? value.join('\n')
      : value === undefined
        ? (defaults[field.key] ?? field.initial ?? '')
        : String(value)
  }
  return form
}

function configOf(feed: FeedName, form: Form): FeedConfig {
  const config: Record<string, unknown> = {}
  for (const field of fieldsOf(feed)) {
    const text = form[field.key] ?? ''
    config[field.key] =
      field.kind === 'list' ? text.split('\n') : field.kind === 'number' ? Number(text) : text
  }
  // Checked field by field where it is saved: here it is only what the PM typed.
  return config as unknown as FeedConfig
}

/** One system of record of a project: its link, its credential, when it was last read. */
export function FeedSection({ api, project, feed, now = systemNow }: Props) {
  const [view, setView] = useState<FeedView | null>(null)
  const [form, setForm] = useState<Form>({})
  const [secret, setSecret] = useState('')
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [choices, setChoices] = useState<FeedChoices | null>(null)
  const [error, setError] = useState<ErrorCode | null>(null)
  /** What the last attempt to save found empty. */
  const [missing, setMissing] = useState<{ fields: FieldKey[]; secret: boolean }>(NOTHING_MISSING)

  const show = useCallback(
    (next: FeedView, resetForm: boolean) => {
      setView(next)
      if (resetForm) setForm(formOf(next, now()))
    },
    [now],
  )

  const reload = useCallback(
    async (resetForm: boolean) => {
      const result = await api.feed(project.id, feed)
      if (result.ok) show(result.value, resetForm)
      else setError(result.code)
    },
    [api, project.id, feed, show],
  )

  useEffect(() => {
    setView(null)
    setError(null)
    setSaved(false)
    setSecret('')
    setChoices(null)
    setMissing(NOTHING_MISSING)
    void reload(true)
    return api.onSourcesChanged((projectId) => {
      if (projectId === project.id) void reload(false)
    })
  }, [api, project.id, reload])

  async function save(config: FeedConfig | null) {
    setBusy(true)
    setError(null)
    setSaved(false)
    const result = await api.saveFeed(project.id, feed, config, secret === '' ? null : secret)
    setBusy(false)
    if (!result.ok) return setError(result.code)
    setSecret('')
    setSaved(config !== null)
    show(result.value, true)
  }

  async function search() {
    setBusy(true)
    setError(null)
    const typed = secret === '' ? null : secret
    const result = await api.feedChoices(project.id, feed, configOf(feed, form), typed)
    setBusy(false)
    if (result.ok) setChoices(result.value)
    else setError(result.code)
  }

  const listField: FieldKey = feed === 'ado' ? 'areas' : 'projects'
  /** A project chosen names the one read (Azure DevOps) or joins those read (Jira). */
  const pickProject = (value: string) =>
    feed === 'ado' ? setForm({ ...form, project: value }) : addLine(listField, value)
  const addLine = (key: FieldKey, value: string) => {
    const lines = (form[key] ?? '').split('\n').filter((line) => line.trim() !== '')
    if (!lines.includes(value)) setForm({ ...form, [key]: [...lines, value].join('\n') })
  }

  async function sync() {
    setBusy(true)
    setError(null)
    setSaved(false)
    const result = await api.syncFeed(project.id, feed)
    setBusy(false)
    if (!result.ok) setError(result.code)
    await reload(false)
  }

  const label = feedLabel(feed)
  if (!view) {
    return (
      <section className="sources" aria-label={label}>
        <h3>{label}</h3>
        {error && <Alert code={error} />}
      </section>
    )
  }
  const submit = (event: FormEvent) => {
    event.preventDefault()
    const empty = fieldsOf(feed)
      .filter((field) => !field.optional && (form[field.key] ?? '').trim() === '')
      .map((field) => field.key)
    const secretMissing = !view.hasSecret && secret === ''
    setMissing({ fields: empty, secret: secretMissing })
    // Asked with a field empty, the system would answer with an error about something else.
    if (empty.length > 0 || secretMissing) return
    void save(configOf(feed, form))
  }

  return (
    <section className="sources" aria-label={label}>
      <h3>{label}</h3>
      <p className="hint">{messages.feedIntro[feed]}</p>
      <Freshness view={view} busy={busy} now={now()} />
      {error && <Alert code={error} />}
      <form className="source-form" onSubmit={submit}>
        {fieldsOf(feed).map((field) => (
          <FieldInput
            key={field.key}
            field={field}
            value={form[field.key] ?? ''}
            missing={missing.fields.includes(field.key)}
            onChange={(value) => setForm({ ...form, [field.key]: value })}
          />
        ))}
        <label>
          {messages.feedSecret[feed]}
          <input
            type="password"
            autoComplete="off"
            value={secret}
            onChange={(event) => setSecret(event.target.value)}
          />
          <span className="hint">
            {view.hasSecret ? messages.feedSecretKept : messages.feedSecretHint}
          </span>
        </label>
        {missing.secret && <Missing />}
        <div className="actions">
          <button type="submit" disabled={busy}>
            {messages.feedSave}
          </button>
          <button type="button" disabled={busy || view.config === null} onClick={() => void sync()}>
            {messages.feedSync}
          </button>
          {view.config !== null && (
            <button type="button" className="quiet" disabled={busy} onClick={() => void save(null)}>
              {messages.feedOff}
            </button>
          )}
          {feed !== 'dwsi' && (
            <button type="button" disabled={busy} onClick={() => void search()}>
              {messages.feedChoices}
            </button>
          )}
          {saved && <span className="hint">{messages.feedSaved}</span>}
          {(missing.fields.length > 0 || missing.secret) && (
            <span className="field-problems" role="status">
              {messages.feedMissingFields}
            </span>
          )}
        </div>
      </form>
      {choices && (
        <div className="preview">
          {choices.projects.length === 0 && <p>{messages.feedChoicesNone}</p>}
          <ChoiceList
            title={messages.feedChoicesProjects}
            choices={choices.projects}
            onPick={pickProject}
          />
          <ChoiceList
            title={messages.feedChoicesAreas}
            choices={choices.areas}
            onPick={(value) => addLine('areas', value)}
          />
        </div>
      )}
    </section>
  )
}

function Alert({ code }: { code: ErrorCode }) {
  return (
    <p className="warning" role="alert">
      {errorText(code)}
    </p>
  )
}

function Freshness({ view, busy, now }: { view: FeedView; busy: boolean; now: Date }) {
  if (busy) {
    return (
      <p className="progress" role="status">
        {messages.feedSyncing}
      </p>
    )
  }
  if (view.config === null) return <p className="badge">{messages.feedNotConfigured}</p>
  const run = view.state.lastRun
  if (!run) return <p className="badge badge-warning">{messages.feedNeverRead}</p>
  if (run.error) return <Alert code={run.error} />
  const stale = now.getTime() - Date.parse(run.at) > DAY_MS
  return (
    <>
      <p className="badge badge-ok">
        {messages.feedLastRun(dateTimeText(run.at), run.written, run.unchanged)}
      </p>
      {stale && <p className="badge badge-warning">{messages.feedStale}</p>}
    </>
  )
}

function Missing() {
  return (
    <span className="field-problems" role="alert">
      {messages.feedFieldMissing}
    </span>
  )
}

function FieldInput({
  field,
  value,
  missing,
  onChange,
}: {
  field: Field
  value: string
  missing: boolean
  onChange: (value: string) => void
}) {
  const label = messages.feedFields[field.key]
  if (field.kind === 'list') {
    return (
      <>
        <label>
          {label}
          <textarea value={value} rows={2} onChange={(event) => onChange(event.target.value)} />
        </label>
        {missing && <Missing />}
      </>
    )
  }
  if (field.kind === 'tls') {
    return (
      <label>
        {label}
        <select value={value} onChange={(event) => onChange(event.target.value)}>
          {WAREHOUSE_TLS_MODES.map((mode) => (
            <option key={mode} value={mode}>
              {messages.feedTls[mode]}
            </option>
          ))}
        </select>
      </label>
    )
  }
  const type = field.kind === 'text' ? 'text' : field.kind
  return (
    <>
      <label>
        {label}
        <input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
      </label>
      {missing && <Missing />}
    </>
  )
}

function ChoiceList({
  title,
  choices,
  onPick,
}: {
  title: string
  choices: FeedChoices['projects']
  onPick: (value: string) => void
}) {
  if (choices.length === 0) return null
  return (
    <>
      <p className="hint">{title}</p>
      <div className="choices">
        {choices.map((choice) => (
          <button key={choice.value} type="button" onClick={() => onPick(choice.value)}>
            {choice.label}
          </button>
        ))}
      </div>
    </>
  )
}
