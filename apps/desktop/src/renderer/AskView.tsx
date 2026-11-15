import type { AgentProgress } from '@octo/application'
import type { Project, QuestionRecord } from '@octo/domain'
import { type FormEvent, useEffect, useRef, useState } from 'react'
import type { ErrorCode, OctoApi } from '../shared/api.ts'
import { AnswerView } from './AnswerView.tsx'
import type { Handoff } from './context.ts'
import { dateTimeText, errorText, messages, progressText } from './messages.ts'
import { BusyButton, Waiting } from './Spinner.tsx'

type AskApi = Pick<OctoApi, 'listQuestions' | 'ask' | 'cancelAsk' | 'openEvidence' | 'onProgress'>

type Props = {
  api: AskApi
  project: Project
  /** A question written elsewhere about something of the project: put in the field, not asked. */
  seed?: string | null
  onSeedUsed?: () => void
  /** Starts a deliverable from an answer, with its question and its sources. */
  onDraft?: (handoff: Handoff) => void
}

/** The conversation with one project: past questions, the one in progress, the composer. */
export function AskView({ api, project, seed = null, onSeedUsed, onDraft }: Props) {
  const [records, setRecords] = useState<QuestionRecord[]>([])
  const [question, setQuestion] = useState('')
  const [pending, setPending] = useState<string | null>(null)
  const [progress, setProgress] = useState<AgentProgress | null>(null)
  const [error, setError] = useState<ErrorCode | null>(null)
  const end = useRef<HTMLDivElement>(null)
  const field = useRef<HTMLTextAreaElement>(null)
  /** The project on the page now: an answer that comes back for another one is not shown here. */
  const live = useRef<string | null>(project.id)
  live.current = project.id
  useEffect(
    () => () => {
      live.current = null
    },
    [],
  )

  // biome-ignore lint/correctness/useExhaustiveDependencies: the question is taken once, when it arrives.
  useEffect(() => {
    if (seed === null) return
    setQuestion(seed)
    field.current?.focus()
    onSeedUsed?.()
  }, [seed])

  useEffect(() => {
    let current = true
    setRecords([])
    setError(null)
    setPending(null)
    setProgress(null)
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

  // The page follows the conversation when it grows, not when a source is looked at.
  // biome-ignore lint/correctness/useExhaustiveDependencies: what is watched is how much there is to read.
  useEffect(() => {
    end.current?.scrollIntoView?.({ block: 'end' })
  }, [records.length, pending])

  async function submit(event: FormEvent) {
    event.preventDefault()
    const asked = question.trim()
    if (asked.length === 0 || pending !== null) return
    setPending(asked)
    setQuestion('')
    setError(null)
    const projectId = project.id
    const result = await api.ask(projectId, asked)
    if (live.current !== projectId) return
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
                onOpenSource={(path) => api.openEvidence(project.id, path)}
                actions={
                  onDraft && (
                    <button
                      type="button"
                      onClick={() =>
                        record.answer &&
                        onDraft({ question: record.question, answer: record.answer })
                      }
                    >
                      {messages.askDraft}
                    </button>
                  )
                }
              />
            )}
            {record.error && <p className="warning">{errorText(record.error)}</p>}
          </article>
        ))}
        {pending !== null && (
          <article className="exchange">
            <p className="question">{pending}</p>
            <Waiting>{progress ? progressText(progress) : messages.working}</Waiting>
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
          ref={field}
          aria-label={messages.askPlaceholder}
          placeholder={messages.askPlaceholder}
          value={question}
          rows={2}
          onChange={(event) => setQuestion(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) void submit(event)
          }}
        />
        <BusyButton
          type="submit"
          busy={pending !== null}
          busyLabel={messages.wait.asking}
          disabled={question.trim().length === 0}
        >
          {messages.askSubmit}
        </BusyButton>
        {pending !== null && (
          <button type="button" onClick={() => void api.cancelAsk(project.id)}>
            {messages.askCancel}
          </button>
        )}
      </form>
    </section>
  )
}
