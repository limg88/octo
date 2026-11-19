import type { AgentProgress } from '@octo/application'
import {
  type ChatAttachment,
  type Conversation,
  conversationOf,
  conversationsOf,
  LEGACY_CONVERSATION,
  type Project,
  type QuestionRecord,
  type QuestionWork,
} from '@octo/domain'
import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import type { ErrorCode, OctoApi } from '../shared/api.ts'
import { AnswerView } from './AnswerView.tsx'
import type { Handoff } from './context.ts'
import { InfoTip } from './InfoTip.tsx'
import { Logo } from './Logo.tsx'
import { dateTimeText, errorText, messages, progressText } from './messages.ts'
import { Waiting } from './Spinner.tsx'

type AskApi = Pick<
  OctoApi,
  | 'listQuestions'
  | 'ask'
  | 'keepWork'
  | 'cancelAsk'
  | 'openEvidence'
  | 'onProgress'
  | 'attachToChat'
  | 'chatFiles'
>

type Props = {
  api: AskApi
  project: Project
  /** A question written elsewhere about something of the project: put in the field, not asked. */
  seed?: string | null
  onSeedUsed?: () => void
  /** Starts a deliverable from an answer, with its question and its sources. */
  onDraft?: (handoff: Handoff) => void
  /** True when Claude can run calculations inside its fence on this computer. */
  canCompute?: boolean
}

/** A question being answered, and the conversation it was asked in (null: one just started). */
type Pending = { question: string; chat: string | null }

/** With fewer conversations than this all are in sight: a filter would only take room. */
const FILTER_FROM_CHATS = 6
const chats = messages.askChats
/** The field grows with the words up to here, then scrolls. */
const MAX_FIELD_PX = 200

const chatTitle = (chat: Conversation): string =>
  chat.id === LEGACY_CONVERSATION ? chats.legacy : chat.title

/**
 * The conversations with one project. The page opens on a new one, empty; those already had are
 * listed beside it and are taken up again where they were left, each question knowing the ones
 * before it in the same conversation.
 */
export function AskView({
  api,
  project,
  seed = null,
  onSeedUsed,
  onDraft,
  canCompute = false,
}: Props) {
  /** Whether the next question may be answered with calculations: said each time, never kept. */
  const [compute, setCompute] = useState(false)

  /** Copies into the project what a calculation wrote; the question then says where. */
  async function keepWork(questionId: string) {
    setError(null)
    const result = await api.keepWork(project.id, questionId)
    if (!result.ok) return setError(result.code)
    setRecords((known) => known.map((record) => (record.id === questionId ? result.value : record)))
  }

  const [records, setRecords] = useState<QuestionRecord[]>([])
  const [question, setQuestion] = useState('')
  const [pending, setPending] = useState<Pending | null>(null)
  /** The conversation in view; null: a new one, with nothing asked yet. */
  const [chatId, setChatId] = useState<string | null>(null)
  const [sought, setSought] = useState('')
  /** The conversation in view when an answer comes back: the PM may have moved meanwhile. */
  const viewing = useRef<string | null>(null)
  viewing.current = chatId
  const [progress, setProgress] = useState<AgentProgress | null>(null)
  const [error, setError] = useState<ErrorCode | null>(null)
  /** What is attached to the conversation in view. */
  const [attached, setAttached] = useState<ChatAttachment[]>([])
  const end = useRef<HTMLDivElement>(null)
  const field = useRef<HTMLTextAreaElement>(null)
  /** The project on the page now: an answer that comes back for another one is not shown here. */
  const live = useRef<string | null>(project.id)
  live.current = project.id
  // When the page goes away nothing that comes back is shown; when it is put back, it is again.
  useEffect(() => {
    live.current = project.id
    return () => {
      live.current = null
    }
  }, [project.id])

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
    setChatId(null)
    setSought('')
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

  // The files of a conversation are those attached to it: another conversation has its own.
  useEffect(() => {
    setAttached([])
    if (chatId === null) return
    let current = true
    void api.chatFiles(project.id, chatId).then((result) => {
      if (current && result.ok) setAttached(result.value)
    })
    return () => {
      current = false
    }
  }, [api, project.id, chatId])

  /** Attaches a file the PM chooses; a conversation not yet started gets its id now. */
  async function attach() {
    setError(null)
    const chat = chatId ?? crypto.randomUUID()
    const projectId = project.id
    const result = await api.attachToChat(projectId, chat)
    if (live.current !== projectId) return
    if (!result.ok) return setError(result.code)
    const file = result.value
    if (file === null) return
    if (viewing.current === chatId) setChatId(chat)
    setAttached((known) => [...known.filter((other) => other.name !== file.name), file])
  }

  // The field is as tall as what is written in it, up to a few lines.
  // biome-ignore lint/correctness/useExhaustiveDependencies: measured again when the words change.
  useEffect(() => {
    const area = field.current
    if (!area) return
    area.style.height = 'auto'
    area.style.height = `${Math.min(area.scrollHeight, MAX_FIELD_PX)}px`
  }, [question])

  // The page follows the conversation when it grows, not when a source is looked at.
  // biome-ignore lint/correctness/useExhaustiveDependencies: what is watched is how much there is to read.
  useEffect(() => {
    end.current?.scrollIntoView?.({ block: 'end' })
  }, [records.length, pending, chatId])

  const conversations = useMemo(() => conversationsOf(records), [records])
  const words = sought.trim().toLocaleLowerCase('it')
  const listed = conversations.filter((chat) =>
    chatTitle(chat).toLocaleLowerCase('it').includes(words),
  )
  const shown = chatId === null ? [] : records.filter((record) => conversationOf(record) === chatId)
  const pendingHere = pending !== null && pending.chat === chatId

  function openChat(next: string | null) {
    setChatId(next)
    setError(null)
    if (next === null) field.current?.focus()
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    const asked = question.trim()
    if (asked.length === 0 || pending !== null) return
    const chat = chatId
    setPending({ question: asked, chat })
    setQuestion('')
    setError(null)
    const projectId = project.id
    const result = await api.ask(projectId, asked, chat, compute && canCompute)
    if (live.current !== projectId) return
    setPending(null)
    setProgress(null)
    if (!result.ok) return setError(result.code)
    setRecords((previous) => [...previous, result.value])
    // The conversation just started is now one of the list: the page stays on it.
    if (viewing.current === chat) setChatId(conversationOf(result.value))
  }

  const fresh = shown.length === 0 && !pendingHere
  const groups = chatGroups(listed, Date.now())

  return (
    <section className={fresh ? 'ask ask-fresh' : 'ask'} aria-label={messages.ask}>
      <nav className="ask-chats" aria-label={chats.title}>
        <button
          type="button"
          className="primary"
          aria-current={chatId === null ? 'page' : undefined}
          onClick={() => openChat(null)}
        >
          {chats.fresh}
        </button>
        {conversations.length >= FILTER_FROM_CHATS && (
          <input
            type="search"
            aria-label={chats.filter}
            placeholder={chats.filter}
            value={sought}
            onChange={(event) => setSought(event.target.value)}
          />
        )}
        {conversations.length === 0 ? (
          <p className="hint">{chats.none}</p>
        ) : (
          <ul>
            {groups.map((group) => (
              <li key={group.age}>
                <span className="ask-chats-age">{chats.ages[group.age]}</span>
                <ul>
                  {group.chats.map((chat) => (
                    <li key={chat.id}>
                      <button
                        type="button"
                        className={chat.id === chatId ? 'ask-chat ask-chat-selected' : 'ask-chat'}
                        aria-current={chat.id === chatId ? 'page' : undefined}
                        title={`${chatTitle(chat)} · ${chats.about(dateTimeText(chat.lastAt), chat.records.length)}`}
                        onClick={() => openChat(chat.id)}
                      >
                        <span className="ask-chat-title">{chatTitle(chat)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
            {listed.length === 0 && <li className="hint">{chats.nothingFound}</li>}
          </ul>
        )}
      </nav>
      <div className="ask-main">
        <div className="conversation">
          {fresh && (
            <div className="ask-welcome">
              <Logo size={44} />
              <p className="ask-welcome-title">{chats.welcome(project.name)}</p>
              <p className="hint">{chatId === null ? chats.freshHint : messages.askEmpty}</p>
            </div>
          )}
          {shown.map((record) => (
            <article key={record.id} className="exchange">
              <p className="question">{record.question}</p>
              {record.answer && (
                <AnswerView
                  answer={record.answer}
                  onOpenSource={(path, quote) => api.openEvidence(project.id, path, quote)}
                  actions={
                    <>
                      {onDraft && (
                        <button
                          type="button"
                          className="quiet"
                          onClick={() =>
                            record.answer &&
                            onDraft({ question: record.question, answer: record.answer })
                          }
                        >
                          {messages.askDraft}
                        </button>
                      )}
                      {record.work && record.work.files.length > 0 && (
                        <WorkFiles work={record.work} onKeep={() => void keepWork(record.id)} />
                      )}
                    </>
                  }
                />
              )}
              {record.error && <p className="warning">{errorText(record.error)}</p>}
              <p className="asked-at">
                {dateTimeText(record.askedAt)}
                {record.model && ` · ${messages.models.used(record.model)}`}
              </p>
            </article>
          ))}
          {pending !== null && pendingHere && (
            <article className="exchange">
              <p className="question">{pending.question}</p>
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
        <form className="composer" onSubmit={(event) => void submit(event)}>
          {attached.length > 0 && (
            <ul className="chat-files" aria-label={messages.attach.list}>
              {attached.map((file) => (
                <li key={file.name} className="chip">
                  {file.name}
                </li>
              ))}
            </ul>
          )}
          <textarea
            ref={field}
            className="composer-field"
            aria-label={messages.askPlaceholder}
            placeholder={messages.askPlaceholder}
            value={question}
            rows={1}
            onChange={(event) => setQuestion(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) void submit(event)
            }}
          />
          <div className="composer-bar">
            <button
              type="button"
              className="composer-round"
              aria-label={messages.attach.button}
              title={messages.attach.hint}
              disabled={pending !== null}
              onClick={() => void attach()}
            >
              <Glyph path="M8 3v10M3 8h10" />
            </button>
            {canCompute && (
              <span className="composer-option">
                <label
                  className={compute ? 'composer-toggle composer-toggle-on' : 'composer-toggle'}
                >
                  <input
                    type="checkbox"
                    checked={compute}
                    onChange={(event) => setCompute(event.target.checked)}
                  />
                  {messages.computed.option}
                </label>
                <InfoTip
                  title={messages.computed.help}
                  steps={messages.computed.steps}
                  note={messages.computed.note}
                />
              </span>
            )}
            <span className="composer-space" />
            {pending !== null && <span className="hint">{messages.wait.asking}</span>}
            {pending === null ? (
              <button
                type="submit"
                className="composer-round primary"
                aria-label={messages.askSubmit}
                title={messages.askSubmit}
                disabled={question.trim().length === 0}
              >
                <Glyph path="M8 13V3M3.5 7.5 8 3l4.5 4.5" />
              </button>
            ) : (
              <button
                type="button"
                className="composer-round"
                aria-label={messages.askCancel}
                title={messages.askCancel}
                onClick={() => void api.cancelAsk(project.id)}
              >
                <Glyph path="M4.5 4.5h7v7h-7z" />
              </button>
            )}
          </div>
        </form>
        {fresh && (
          // biome-ignore lint/a11y/useSemanticElements: a group of buttons, not a set of form fields.
          <div className="ask-ready" role="group" aria-label={messages.askReadyTitle}>
            {messages.askReady.map((ready) => (
              <button
                key={ready.label}
                type="button"
                className="quiet"
                title={ready.question}
                onClick={() => {
                  setQuestion(ready.question)
                  field.current?.focus()
                }}
              >
                {ready.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

/** A small sign drawn in a round button: its name is the label of the button. */
function Glyph({ path }: { path: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d={path} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

const DAY_MS = 24 * 60 * 60 * 1000
const AGES = ['today', 'yesterday', 'week', 'before'] as const
type Age = (typeof AGES)[number]

/** The conversations by how long ago they were last taken up, the newest group first. */
function chatGroups(list: readonly Conversation[], now: number) {
  const midnight = new Date(now).setHours(0, 0, 0, 0)
  const ageOf = (chat: Conversation): Age => {
    const days = Math.ceil((midnight - Date.parse(chat.lastAt)) / DAY_MS)
    return days <= 0 ? 'today' : days === 1 ? 'yesterday' : days <= 7 ? 'week' : 'before'
  }
  return AGES.map((age) => ({ age, chats: list.filter((chat) => ageOf(chat) === age) })).filter(
    (group) => group.chats.length > 0,
  )
}

/** What a calculation wrote in its work folder: kept in the project only when the PM says so. */
function WorkFiles({ work, onKeep }: { work: QuestionWork; onKeep: () => void }) {
  const text = messages.computed
  return work.keptIn === null ? (
    <>
      <span className="hint">{text.files(work.files.join(', '))}</span>
      <button type="button" onClick={onKeep}>
        {text.keep}
      </button>
    </>
  ) : (
    <span className="badge badge-ok" role="status">
      {text.kept(work.keptIn)}
    </span>
  )
}
