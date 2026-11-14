import type { MailSourceView } from '@octo/application'
import type { MailSourceConfig, Project, SourceState } from '@octo/domain'
import { type FormEvent, useCallback, useEffect, useState } from 'react'
import type { ErrorCode, OctoApi } from '../shared/api.ts'
import { dateTimeText, errorText, messages } from './messages.ts'

type Props = {
  api: OctoApi
  project: Project
  now?: () => Date
}

/** What the PM types: lists are one item per line. */
type MailForm = {
  keywords: string
  folders: string
  excludeSenders: string
  since: string
  targetFolder: string
  keepQuoted: boolean
}

const DAY_MS = 24 * 60 * 60 * 1000
const DEFAULT_DAYS_BACK = 30

const lines = (text: string): string[] => text.split('\n')
const joined = (values: readonly string[]): string => values.join('\n')
const dayOf = (date: Date): string => date.toISOString().slice(0, 10)

function formOf(view: MailSourceView, now: Date): MailForm {
  const config = view.config
  return {
    keywords: joined(config?.keywords ?? []),
    folders: joined(config?.folders ?? []),
    excludeSenders: joined(config?.excludeSenders ?? []),
    since: config?.since ?? dayOf(new Date(now.getTime() - DEFAULT_DAYS_BACK * DAY_MS)),
    targetFolder: config?.targetFolder ?? view.suggestedFolder,
    keepQuoted: config?.keepQuoted ?? false,
  }
}

const configOf = (form: MailForm): MailSourceConfig => ({
  keywords: lines(form.keywords),
  folders: lines(form.folders),
  excludeSenders: lines(form.excludeSenders),
  since: form.since,
  targetFolder: form.targetFolder,
  keepQuoted: form.keepQuoted,
})

/** The sources that feed the memory of a project: today the mail. */
/** One function for the life of the page: a new one at every render would reload it forever. */
const systemNow = (): Date => new Date()

export function SourcesView({ api, project, now = systemNow }: Props) {
  const [view, setView] = useState<MailSourceView | null>(null)
  const [form, setForm] = useState<MailForm | null>(null)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<ErrorCode | null>(null)

  const show = useCallback(
    (next: MailSourceView, resetForm: boolean) => {
      setView(next)
      if (resetForm) setForm(formOf(next, now()))
    },
    [now],
  )

  const reload = useCallback(
    async (resetForm: boolean) => {
      const result = await api.mailSource(project.id)
      if (result.ok) show(result.value, resetForm)
      else setError(result.code)
    },
    [api, project.id, show],
  )

  useEffect(() => {
    setView(null)
    setForm(null)
    setError(null)
    setSaved(false)
    void reload(true)
    return api.onSourcesChanged((projectId) => {
      if (projectId === project.id) void reload(false)
    })
  }, [api, project.id, reload])

  async function save(event: FormEvent) {
    event.preventDefault()
    if (!form) return
    setError(null)
    const result = await api.saveMailSource(project.id, configOf(form))
    setSaved(result.ok)
    if (result.ok) show(result.value, true)
    else setError(result.code)
  }

  async function sync() {
    setBusy(true)
    setError(null)
    setSaved(false)
    const result = await api.syncMail(project.id)
    setBusy(false)
    if (!result.ok) setError(result.code)
    await reload(false)
  }

  if (!view || !form) {
    return <section className="sources">{error && <Alert code={error} />}</section>
  }
  const set = (change: Partial<MailForm>) => setForm({ ...form, ...change })

  return (
    <section className="sources" aria-label={messages.sourcesTab}>
      <h3>{messages.mailTitle}</h3>
      <p className="hint">{messages.mailIntro}</p>
      <Freshness state={view.state} configured={view.config !== null} busy={busy} now={now()} />
      {error && <Alert code={error} />}
      <form className="source-form" onSubmit={(event) => void save(event)}>
        <ListField
          label={messages.mailKeywords}
          hint={messages.mailKeywordsHint}
          value={form.keywords}
          onChange={(keywords) => set({ keywords })}
        />
        <ListField
          label={messages.mailFolders}
          hint={messages.mailFoldersHint}
          value={form.folders}
          onChange={(folders) => set({ folders })}
        />
        <ListField
          label={messages.mailExclude}
          value={form.excludeSenders}
          onChange={(excludeSenders) => set({ excludeSenders })}
        />
        <label>
          {messages.mailSince}
          <input
            type="date"
            value={form.since}
            onChange={(event) => set({ since: event.target.value })}
          />
        </label>
        <label>
          {messages.mailTarget}
          <input
            type="text"
            value={form.targetFolder}
            onChange={(event) => set({ targetFolder: event.target.value })}
          />
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={form.keepQuoted}
            onChange={(event) => set({ keepQuoted: event.target.checked })}
          />
          {messages.mailKeepQuoted}
        </label>
        <div className="actions">
          <button type="submit">{messages.mailSave}</button>
          <button type="button" disabled={busy || view.config === null} onClick={() => void sync()}>
            {messages.mailSync}
          </button>
          {saved && <span className="hint">{messages.mailSaved}</span>}
        </div>
      </form>
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

function Freshness({
  state,
  configured,
  busy,
  now,
}: {
  state: SourceState
  configured: boolean
  busy: boolean
  now: Date
}) {
  if (busy) {
    return (
      <p className="progress" role="status">
        {messages.mailSyncing}
      </p>
    )
  }
  if (!configured) return <p className="badge">{messages.mailNotConfigured}</p>
  const run = state.lastRun
  if (!run) return <p className="badge badge-warning">{messages.mailNeverRead}</p>
  const at = dateTimeText(run.at)
  if (run.error) {
    return (
      <div className="warning" role="alert">
        <p>{messages.mailLastFailed(at)}</p>
        <p>{errorText(run.error)}</p>
      </div>
    )
  }
  const stale = now.getTime() - Date.parse(run.at) > DAY_MS
  return (
    <>
      <p className="badge badge-ok">{messages.mailLastRun(at, run.written, run.unchanged)}</p>
      {stale && <p className="badge badge-warning">{messages.mailStale}</p>}
    </>
  )
}

function ListField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string
  hint?: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label>
      {label}
      <textarea value={value} rows={3} onChange={(event) => onChange(event.target.value)} />
      {hint && <span className="hint">{hint}</span>}
    </label>
  )
}
