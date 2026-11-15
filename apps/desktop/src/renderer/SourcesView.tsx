import type { MailSourceView } from '@octo/application'
import type { MailPreview, MailSourceConfig, Project, SourceState } from '@octo/domain'
import { type FormEvent, useCallback, useEffect, useState } from 'react'
import type { ErrorCode, OctoApi } from '../shared/api.ts'
import { dateTimeText, errorText, messages } from './messages.ts'
import { SourceHeader } from './SourceHeader.tsx'

type Props = {
  api: OctoApi
  project: Project
  now?: () => Date
  /** False when the mail is one folded row of the list of the sources. */
  open?: boolean
  onToggle?: (() => void) | undefined
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

function formOf(view: MailSourceView, now: Date, projectName: string): MailForm {
  const config = view.config
  return {
    // A project not set up yet starts from its own name: the PM corrects it if it is not enough.
    keywords: joined(config?.keywords ?? [projectName]),
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

export function SourcesView({ api, project, now = systemNow, open = true, onToggle }: Props) {
  const [view, setView] = useState<MailSourceView | null>(null)
  const [form, setForm] = useState<MailForm | null>(null)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [preview, setPreview] = useState<MailPreview | 'loading' | null>(null)
  const [error, setError] = useState<ErrorCode | null>(null)

  const show = useCallback(
    (next: MailSourceView, resetForm: boolean) => {
      setView(next)
      if (resetForm) setForm(formOf(next, now(), project.name))
    },
    [now, project.name],
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
    setPreview(null)
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

  async function showPreview() {
    if (!form) return
    setError(null)
    setPreview('loading')
    const result = await api.previewMail(project.id, configOf(form))
    setPreview(result.ok ? result.value : null)
    if (!result.ok) setError(result.code)
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
    <section className="sources" aria-label={messages.mailTitle}>
      <SourceHeader
        title={messages.mailTitle}
        linked={view.config !== null}
        open={open}
        onToggle={onToggle}
        status={
          <Freshness state={view.state} configured={view.config !== null} busy={busy} now={now()} />
        }
      >
        {view.config !== null && (
          <button type="button" disabled={busy} onClick={() => void sync()}>
            {messages.mailSync}
          </button>
        )}
      </SourceHeader>
      {error && <Alert code={error} />}
      {open && <p className="hint">{messages.mailIntro}</p>}
      <form className="source-form" hidden={!open} onSubmit={(event) => void save(event)}>
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
        <details className="advanced">
          <summary>{messages.advanced}</summary>
          <label>
            {messages.mailTarget}
            <input
              type="text"
              value={form.targetFolder}
              onChange={(event) => set({ targetFolder: event.target.value })}
            />
          </label>
        </details>
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
          <button type="button" disabled={preview === 'loading'} onClick={() => void showPreview()}>
            {messages.mailPreview}
          </button>
          {saved && <span className="hint">{messages.mailSaved}</span>}
        </div>
      </form>
      {open && preview === 'loading' && (
        <p className="progress" role="status">
          {messages.mailPreviewing}
        </p>
      )}
      {open && preview !== null && preview !== 'loading' && (
        <div className="preview">
          <p>{messages.mailPreviewCount(preview.count)}</p>
          {preview.subjects.length > 0 && (
            <>
              <p className="hint">{messages.mailPreviewNewest}</p>
              <ul>
                {preview.subjects.map((subject) => (
                  <li key={subject}>{subject}</li>
                ))}
              </ul>
            </>
          )}
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
