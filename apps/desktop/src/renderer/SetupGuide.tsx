import type { FeedingStatus, FeedingStep } from '@octo/application'
import { FEED_NAMES, type Project } from '@octo/domain'
import { useCallback, useEffect, useState } from 'react'
import type { ErrorCode, OctoApi } from '../shared/api.ts'
import { errorText, messages } from './messages.ts'

type Props = {
  api: OctoApi
  project: Project
}

/**
 * The start of a project in one place: how much is linked, and one button that feeds the memory
 * from everything linked.
 */
export function SetupGuide({ api, project }: Props) {
  const [status, setStatus] = useState<FeedingStatus | null>(null)
  const [steps, setSteps] = useState<FeedingStep[]>([])
  const [busy, setBusy] = useState(false)
  const [finished, setFinished] = useState(false)
  const [error, setError] = useState<ErrorCode | null>(null)

  const reload = useCallback(async () => {
    const result = await api.feedingStatus(project.id)
    if (result.ok) setStatus(result.value)
    else setError(result.code)
  }, [api, project.id])

  useEffect(() => {
    setStatus(null)
    setSteps([])
    setFinished(false)
    setError(null)
    void reload()
    const stopSources = api.onSourcesChanged((projectId) => {
      if (projectId === project.id) void reload()
    })
    const stopSteps = api.onFeedingStep((projectId, step) => {
      if (projectId === project.id) setSteps((previous) => [...previous, step])
    })
    return () => {
      stopSources()
      stopSteps()
    }
  }, [api, project.id, reload])

  async function fill() {
    setBusy(true)
    setFinished(false)
    setError(null)
    setSteps([])
    const result = await api.fill(project.id)
    setBusy(false)
    if (!result.ok) return setError(result.code)
    setSteps(result.value)
    setFinished(true)
  }

  const linked = (status?.mail ? 1 : 0) + (status?.feeds.length ?? 0)

  return (
    <section className="sources guide" aria-label={messages.guideTitle}>
      <h3>{messages.guideTitle}</h3>
      <p className="hint">{messages.guideIntro}</p>
      {status && <p>{messages.guideLinked(linked, FEED_NAMES.length + 1)}</p>}
      {error && (
        <p className="warning" role="alert">
          {errorText(error)}
        </p>
      )}
      <div className="actions">
        <button type="button" className="primary" disabled={busy} onClick={() => void fill()}>
          {messages.guideFill}
        </button>
      </div>
      {busy && (
        <p className="progress" role="status">
          {messages.guideFilling}
        </p>
      )}
      {steps.length > 0 && (
        <ul className="guide-outcome">
          {steps.map((step) => (
            <li key={step.source}>{outcomeText(step)}</li>
          ))}
        </ul>
      )}
      {finished && <p className="badge badge-ok">{messages.guideAsk}</p>}
    </section>
  )
}

function outcomeText(step: FeedingStep): string {
  const label = messages.guideSources[step.source]
  const run = step.run
  if (!run || run.error) return messages.guideStepFailed(label)
  return messages.guideStep(label, run.written, run.unchanged)
}
