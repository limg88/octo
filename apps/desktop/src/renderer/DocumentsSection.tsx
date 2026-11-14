import type { Project, SourceState } from '@octo/domain'
import { useCallback, useEffect, useState } from 'react'
import type { ErrorCode, OctoApi } from '../shared/api.ts'
import { dateTimeText, errorText, messages } from './messages.ts'

type Props = {
  api: OctoApi
  project: Project
}

/** Office and PDF files of the project made readable: when it last ran, and a way to run it now. */
export function DocumentsSection({ api, project }: Props) {
  const [state, setState] = useState<SourceState | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<ErrorCode | null>(null)

  const reload = useCallback(async () => {
    const result = await api.documentsState(project.id)
    if (result.ok) setState(result.value)
    else setError(result.code)
  }, [api, project.id])

  useEffect(() => {
    setState(null)
    setError(null)
    void reload()
    return api.onSourcesChanged((projectId) => {
      if (projectId === project.id) void reload()
    })
  }, [api, project.id, reload])

  async function convert() {
    setBusy(true)
    setError(null)
    const result = await api.convertDocuments(project.id)
    setBusy(false)
    if (!result.ok) setError(result.code)
    await reload()
  }

  const run = state?.lastRun ?? null
  return (
    <section className="sources" aria-label={messages.documentsTitle}>
      <h3>{messages.documentsTitle}</h3>
      <p className="hint">{messages.documentsIntro}</p>
      {busy ? (
        <p className="progress" role="status">
          {messages.documentsConverting}
        </p>
      ) : run ? (
        <p className={run.error ? 'warning' : 'badge badge-ok'}>
          {run.error
            ? errorText(run.error)
            : messages.documentsLastRun(dateTimeText(run.at), run.written, run.unchanged)}
        </p>
      ) : (
        state && <p className="badge badge-warning">{messages.documentsNever}</p>
      )}
      {error && (
        <p className="warning" role="alert">
          {errorText(error)}
        </p>
      )}
      <div className="actions">
        <button type="button" disabled={busy} onClick={() => void convert()}>
          {messages.documentsConvert}
        </button>
      </div>
    </section>
  )
}
