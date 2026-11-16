import type { MeetingsSourceView } from '@octo/application'
import type { Project } from '@octo/domain'
import { type FormEvent, useCallback, useEffect, useState } from 'react'
import type { ErrorCode, OctoApi } from '../shared/api.ts'
import { dateTimeText, errorText, messages } from './messages.ts'
import { PathField } from './PathField.tsx'
import { SourceHeader } from './SourceHeader.tsx'

type Props = {
  api: OctoApi
  project: Project
  open: boolean
  onToggle: () => void
  now?: () => Date
}

/** One function for the life of the page: a new one at every render would reload it forever. */
const systemNow = (): Date => new Date()
const dayOf = (date: Date): string => date.toISOString().slice(0, 10)

/** The meetings recorded with Verbale: which folder is read, when it last was, and a way to read it now. */
export function MeetingsSection({ api, project, open, onToggle, now = systemNow }: Props) {
  const [view, setView] = useState<MeetingsSourceView | null>(null)
  const [root, setRoot] = useState('')
  const [since, setSince] = useState('')
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<ErrorCode | null>(null)

  const reload = useCallback(
    async (resetForm: boolean) => {
      const result = await api.meetingsSource(project.id)
      if (!result.ok) return setError(result.code)
      setView(result.value)
      if (!resetForm) return
      const config = result.value.config
      setRoot(config?.root ?? result.value.suggestedRoot ?? '')
      // A project linked now starts from today: what Verbale holds from before is seldom its own.
      setSince(config ? (config.since ?? '') : dayOf(now()))
    },
    [api, project.id, now],
  )

  useEffect(() => {
    setView(null)
    setError(null)
    setSaved(false)
    void reload(true)
    return api.onSourcesChanged((projectId) => {
      if (projectId === project.id) void reload(false)
    })
  }, [api, project.id, reload])

  async function save(event: FormEvent) {
    event.preventDefault()
    setError(null)
    const result = await api.saveMeetingsSource(project.id, { root, since: since || null })
    setSaved(result.ok)
    if (!result.ok) return setError(result.code)
    setView(result.value)
    setRoot(result.value.config?.root ?? '')
    setSince(result.value.config?.since ?? '')
  }

  async function sync() {
    setBusy(true)
    setError(null)
    setSaved(false)
    const result = await api.syncMeetings(project.id)
    setBusy(false)
    if (!result.ok) setError(result.code)
    await reload(false)
  }

  async function choose(): Promise<string | null> {
    const result = await api.chooseMeetingsRoot()
    if (!result.ok) setError(result.code)
    return result.ok ? result.value : null
  }

  if (!view) {
    return (
      <section className="sources">
        {error && (
          <p className="warning" role="alert">
            {errorText(error)}
          </p>
        )}
      </section>
    )
  }
  const linked = view.config !== null
  const run = view.state.lastRun

  return (
    <section className="sources" aria-label={messages.meetingsTitle}>
      <SourceHeader
        title={messages.meetingsTitle}
        linked={linked}
        open={open}
        onToggle={onToggle}
        status={
          busy ? (
            <p className="progress" role="status">
              {messages.meetingsSyncing}
            </p>
          ) : !linked ? (
            <p className="badge">{messages.meetingsNotConfigured}</p>
          ) : !run ? (
            <p className="badge badge-warning">{messages.meetingsNever}</p>
          ) : run.error ? (
            <p className="warning" role="alert">
              {errorText(run.error)}
            </p>
          ) : (
            <p className="badge badge-ok">
              {messages.meetingsLastRun(dateTimeText(run.at), run.written, run.unchanged)}
            </p>
          )
        }
      >
        {linked && (
          <button type="button" disabled={busy} onClick={() => void sync()}>
            {messages.meetingsSync}
          </button>
        )}
      </SourceHeader>
      {error && (
        <p className="warning" role="alert">
          {errorText(error)}
        </p>
      )}
      {open && <p className="hint">{messages.meetingsIntro}</p>}
      <form className="source-form" hidden={!open} onSubmit={(event) => void save(event)}>
        <PathField
          label={messages.meetingsRoot}
          value={root}
          onChange={setRoot}
          onChoose={choose}
        />
        {!linked && (
          <p className="hint">
            {view.suggestedRoot ? messages.meetingsRootFound : messages.meetingsRootMissing}
          </p>
        )}
        <label>
          {messages.meetingsSince}
          <input type="date" value={since} onChange={(event) => setSince(event.target.value)} />
          <span className="hint">{messages.meetingsSinceHint}</span>
        </label>
        <p className="hint">{messages.meetingsTarget(view.targetFolder)}</p>
        <div className="actions">
          <button type="submit" disabled={root.trim() === ''}>
            {messages.meetingsSave}
          </button>
          <button type="button" disabled={busy || !linked} onClick={() => void sync()}>
            {messages.meetingsSync}
          </button>
          {saved && <span className="hint">{messages.meetingsSaved}</span>}
        </div>
      </form>
    </section>
  )
}
