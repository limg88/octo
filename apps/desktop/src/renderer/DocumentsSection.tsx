import type { ReadingView } from '@octo/application'
import type { Project } from '@octo/domain'
import { useCallback, useEffect, useState } from 'react'
import type { ErrorCode, OctoApi } from '../shared/api.ts'
import { Elsewhere } from './Elsewhere.tsx'
import { dateTimeText, errorText, messages } from './messages.ts'
import { SourceHeader } from './SourceHeader.tsx'

type Props = {
  api: OctoApi
  project: Project
}

/** Office and PDF files of the project made readable: when it last ran, and a way to run it now. */
export function DocumentsSection({ api, project }: Props) {
  const [state, setState] = useState<ReadingView | null>(null)
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

  const run = state?.state.lastRun ?? null
  return (
    <section className="sources" aria-label={messages.documentsTitle}>
      <SourceHeader
        title={messages.documentsTitle}
        linked
        open={false}
        status={
          <>
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
            <Elsewhere
              readBy={state?.readBy ?? null}
              readingBy={state?.readingBy ?? null}
              notHere={null}
            />
          </>
        }
      >
        <button type="button" disabled={busy} onClick={() => void convert()}>
          {messages.documentsConvert}
        </button>
      </SourceHeader>
      <p className="hint">{messages.documentsIntro}</p>
      {error && (
        <p className="warning" role="alert">
          {errorText(error)}
        </p>
      )}
    </section>
  )
}
