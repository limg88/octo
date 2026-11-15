import type { AgentProgress } from '@octo/application'
import type { Project, QuestionRecord } from '@octo/domain'
import { type FormEvent, useEffect, useRef, useState } from 'react'
import type { ErrorCode, OctoApi } from '../shared/api.ts'
import { AnswerView } from './AnswerView.tsx'
import { dateTimeText, errorText, messages, progressText } from './messages.ts'

type Props = {
  api: OctoApi
  project: Project
}

/** The conversation with one project: past questions, the one in progress, the composer. */
export function AskView({ api, project }: Props) {
  const [records, setRecords] = useState<QuestionRecord[]>([])
  const [question, setQuestion] = useState('')
  const [pending, setPending] = useState<string | null>(null)
  const [progress, setProgress] = useState<AgentProgress | null>(null)
  const [error, setError] = useState<ErrorCode | null>(null)
  const end = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let current = true
    setRecords([])
    setError(null)
    void api.listQuestions(project.id).then((result) => {
      if (!current) return
      if (result.ok) setRecords(result.value)
      else setError(result.code)
    })
    const stop = api.onProgress((projectId, step) => {
      if (projectId === project.id) setProgress(step)
    })
    return () => {
      current = false
      stop()
    }
  }, [api, project.id])

  useEffect(() => {
    end.current?.scrollIntoView?.({ block: 'end' })
  })

  async function submit(event: FormEvent) {
    event.preventDefault()
    const asked = question.trim()
    if (asked.length === 0 || pending !== null) return
    setPending(asked)
    setQuestion('')
    setError(null)
    const result = await api.ask(project.id, asked)
    setPending(null)
    setProgress(null)
    if (result.ok) setRecords((previous) => [...previous, result.value])
    else setError(result.code)
  }

  return (
    <section className="ask" aria-label={messages.ask}>
      <div className="conversation">
        {records.length === 0 && pending === null && <p className="hint">{messages.askEmpty}</p>}
        {records.map((record) => (
          <article key={record.id} className="exchange">
            <p className="question">{record.question}</p>
            <p className="asked-at">
              {dateTimeText(record.askedAt)}
              {record.model && ` · ${messages.models.used(record.model)}`}
            </p>
            {record.answer && (
              <AnswerView
                answer={record.answer}
                onOpenSource={(path) => void api.openEvidence(project.id, path)}
              />
            )}
            {record.error && <p className="warning">{errorText(record.error)}</p>}
          </article>
        ))}
        {pending !== null && (
          <article className="exchange">
            <p className="question">{pending}</p>
            <p className="progress" role="status">
              {progress ? progressText(progress) : messages.working}
            </p>
          </article>
        )}
        {error && (
          <p className="warning" role="alert">
            {errorText(error)}
          </p>
        )}
        <div ref={end} />
      </div>
      {pending === null && (
        // biome-ignore lint/a11y/useSemanticElements: a group of buttons, not a set of form fields.
        <div className="actions" role="group" aria-label={messages.askReadyTitle}>
          {messages.askReady.map((ready) => (
            <button
              key={ready.label}
              type="button"
              className="quiet"
              title={ready.question}
              onClick={() => setQuestion(ready.question)}
            >
              {ready.label}
            </button>
          ))}
        </div>
      )}
      <form className="composer" onSubmit={(event) => void submit(event)}>
        <textarea
          aria-label={messages.askPlaceholder}
          placeholder={messages.askPlaceholder}
          value={question}
          rows={2}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) void submit(event)
          }}
        />
        {pending === null ? (
          <button type="submit" disabled={question.trim().length === 0}>
            {messages.askSubmit}
          </button>
        ) : (
          <button type="button" onClick={() => void api.cancelAsk(project.id)}>
            {messages.askCancel}
          </button>
        )}
      </form>
    </section>
  )
}
