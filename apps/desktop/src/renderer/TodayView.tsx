import type { AgentProgress, TodayView as View } from '@octo/application'
import {
  isToDo,
  type Project,
  TODAY_LIMIT,
  type TodayItem,
  type TodayKind,
  type TodayTarget,
} from '@octo/domain'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ErrorCode, OctoApi, TodayDecisionChoice } from '../shared/api.ts'
import { Failure } from './Failure.tsx'
import { dateTimeText, messages, progressText } from './messages.ts'
import { RiskRegister } from './RiskRegister.tsx'
import type { Section } from './sections.ts'
import { asOfText, dayText, signalText } from './today-text.ts'

type TodayApi = Pick<
  OctoApi,
  | 'todayView'
  | 'decideToday'
  | 'muteTodayKind'
  | 'saveOwnAddresses'
  | 'evaluateToday'
  | 'cancelEvaluateToday'
  | 'onTodayProgress'
  | 'onSourcesChanged'
  | 'fill'
  | 'openEvidence'
  | 'risks'
  | 'proposeRisks'
  | 'acceptRisk'
  | 'dismissRisk'
  | 'addRisk'
  | 'updateRisk'
>

type Props = {
  api: TodayApi
  project: Project
  /** False when Claude Code is not on this computer: nothing is judged, the page still works. */
  canJudge: boolean
  onOpenSection: (section: Section) => void
}

const text = messages.today
const DAY_MS = 24 * 60 * 60 * 1000
const MONDAY = 1
const WEEK_DAYS = 7

/** Where a signal is put right, when that is another section of the project. */
const SECTION_OF: Partial<Record<TodayTarget, Section>> = {
  sources: 'sources',
  hours: 'hours',
  forecast: 'forecast',
  dashboard: 'dashboard',
  alignment: 'alignment',
  deliverables: 'deliverables',
}

const plusDays = (day: string, days: number): string =>
  new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10)

/** The Monday after a day: the same day a week later when the day is a Monday. */
function nextMonday(day: string): string {
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay()
  return plusDays(day, (MONDAY - weekday + WEEK_DAYS) % WEEK_DAYS || WEEK_DAYS)
}

const pathOf = (item: TodayItem): string | null =>
  'path' in item.facts && typeof item.facts.path === 'string' ? item.facts.path : null

/** The page the PM opens every morning: what to do today, where it comes from, where it is put right. */
export function TodayView({ api, project, canJudge, onOpenSection }: Props) {
  const [view, setView] = useState<View | null>(null)
  const [error, setError] = useState<ErrorCode | null>(null)
  const [all, setAll] = useState(false)
  const [later, setLater] = useState<string | null>(null)
  const [reading, setReading] = useState(false)
  const [judging, setJudging] = useState(false)
  const [step, setStep] = useState<AgentProgress | null>(null)
  const [showRisks, setShowRisks] = useState(false)
  const [addresses, setAddresses] = useState('')
  /** The day and project Claude was already asked for by this page: never twice by itself. */
  const asked = useRef<string | null>(null)

  const show = useCallback((next: View) => {
    setView(next)
    setAddresses(next.addedAddresses.join('\n'))
  }, [])

  const evaluate = useCallback(
    async (everything: boolean) => {
      setJudging(true)
      setStep(null)
      setError(null)
      const result = await api.evaluateToday(project.id, everything)
      setJudging(false)
      if (result.ok) show(result.value)
      // Stopped by the PM: nothing to explain.
      else if (result.code !== 'agent_cancelled') setError(result.code)
    },
    [api, project.id, show],
  )

  /**
   * Reads the page again. Claude is asked by the page itself once a day for a project, the first
   * time a mail it has not weighed waits there: at the opening, or after a reading brought it.
   */
  const load = useCallback(async () => {
    const result = await api.todayView(project.id)
    if (!result.ok) return setError(result.code)
    show(result.value)
    const mark = `${project.id}:${result.value.day}`
    if (!result.value.evaluationDue || !canJudge || asked.current === mark) return
    asked.current = mark
    void evaluate(false)
  }, [api, project.id, show, canJudge, evaluate])

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new project starts from its own page.
  useEffect(() => {
    setView(null)
    setError(null)
    setAll(false)
    setLater(null)
    setShowRisks(false)
    void load()
  }, [project.id])

  useEffect(
    () =>
      api.onSourcesChanged((projectId) => {
        if (projectId === project.id) void load()
      }),
    [api, project.id, load],
  )

  useEffect(
    () =>
      api.onTodayProgress((projectId, progress) => {
        if (projectId === project.id) setStep(progress)
      }),
    [api, project.id],
  )

  async function decide(key: string, state: TodayDecisionChoice, until: string | null = null) {
    setError(null)
    setLater(null)
    const result = await api.decideToday(project.id, key, state, until)
    if (result.ok) show(result.value)
    else setError(result.code)
  }

  async function mute(kind: TodayKind, muted: boolean) {
    setError(null)
    const result = await api.muteTodayKind(project.id, kind, muted)
    if (result.ok) show(result.value)
    else setError(result.code)
  }

  async function readNow() {
    setReading(true)
    setError(null)
    const result = await api.fill(project.id)
    setReading(false)
    if (!result.ok) setError(result.code)
    await load()
  }

  async function saveAddresses() {
    setError(null)
    const lines = addresses.split('\n').filter((line) => line.trim() !== '')
    const result = await api.saveOwnAddresses(project.id, lines)
    if (result.ok) show(result.value)
    else setError(result.code)
  }

  function open(item: TodayItem) {
    const section = SECTION_OF[item.target]
    const path = pathOf(item)
    if (section) onOpenSection(section)
    else if (item.target === 'risks') setShowRisks(true)
    else if (path) void api.openEvidence(project.id, path)
  }

  if (showRisks) {
    return (
      <RiskRegister
        api={api}
        project={project}
        canJudge={canJudge}
        onBack={() => {
          setShowRisks(false)
          void load()
        }}
      />
    )
  }
  if (view === null) {
    return error ? <Failure code={error} /> : <p className="progress">{text.loading}</p>
  }

  const alerts = view.items.filter((item) => item.band === 'alert')
  const toDo = view.items.filter(isToDo)
  const watch = view.items.filter((item) => item.band === 'watch')
  const shown = all ? toDo : toDo.slice(0, TODAY_LIMIT)

  return (
    <section className="today" aria-label={messages.todayTab}>
      <header className="today-head">
        <h3>{text.title(dayText(view.day))}</h3>
        <div className="actions">
          <button type="button" onClick={() => setShowRisks(true)}>
            {messages.risks.title}
          </button>
          <button type="button" disabled={reading} onClick={() => void readNow()}>
            {text.readNow}
          </button>
        </div>
      </header>
      {view.freshness.length > 0 && (
        <p className="hint today-freshness">
          {view.freshness
            .map(
              (entry) =>
                `${entry.source}: ${entry.readAt ? dateTimeText(entry.readAt) : text.freshnessNever}`,
            )
            .join(' · ')}
        </p>
      )}
      {reading && <p className="progress">{text.reading}</p>}
      {error && <Failure code={error} onOpen={onOpenSection} />}

      {alerts.map((item) => {
        const words = signalText(item)
        return (
          <div key={item.key} className="notice-bar notice-bar-warning">
            <p role="alert">
              <strong>{words.title}.</strong> {words.detail}
            </p>
            <button type="button" onClick={() => open(item)}>
              {text.open[item.target]}
            </button>
          </div>
        )
      })}

      <h4 className="today-title">
        {text.toDo}
        {toDo.length > 0 && (
          <span className="today-count">{text.toDoCount(shown.length, toDo.length)}</span>
        )}
      </h4>
      {view.items.length === 0 ? (
        <p className="today-empty">{text.nothing}</p>
      ) : toDo.length === 0 ? (
        <p className="today-empty">{text.nothingToDo}</p>
      ) : (
        <ul className="today-list">
          {shown.map((item) => (
            <Signal
              key={item.key}
              item={item}
              day={view.day}
              choosingLater={later === item.key}
              onOpen={() => open(item)}
              onDone={() => void decide(item.key, 'done')}
              onMute={() => void decide(item.key, 'muted')}
              onAskLater={() => setLater(later === item.key ? null : item.key)}
              onLater={(until) => void decide(item.key, 'later', until)}
            />
          ))}
        </ul>
      )}
      {toDo.length > TODAY_LIMIT && (
        <button type="button" className="quiet" onClick={() => setAll(!all)}>
          {all ? text.fewer : text.more(toDo.length - TODAY_LIMIT)}
        </button>
      )}

      <Judgement
        view={view}
        canJudge={canJudge}
        judging={judging}
        step={step}
        hasMail={view.items.some((item) => item.facts.kind === 'mail_reply')}
        onUpdate={() => void evaluate(false)}
        onAll={() => void evaluate(true)}
        onStop={() => void api.cancelEvaluateToday(project.id)}
      />

      {watch.length > 0 && (
        <>
          <h4 className="today-title">{text.watch}</h4>
          <ul className="today-watch">
            {watch.map((item) => {
              const words = signalText(item)
              return (
                <li key={item.key}>
                  <span>
                    <strong>{words.title}</strong>
                    <span className="hint"> {words.detail}</span>
                  </span>
                  <span className="actions">
                    <button type="button" className="quiet" onClick={() => open(item)}>
                      {text.open[item.target]}
                    </button>
                    <button
                      type="button"
                      className="quiet"
                      aria-label={`${text.mute}: ${words.title}`}
                      onClick={() => void decide(item.key, 'muted')}
                    >
                      ×
                    </button>
                  </span>
                </li>
              )
            })}
          </ul>
        </>
      )}

      {view.muteOffers.map((kind) => (
        <div key={kind} className="notice-bar">
          <p role="status">{text.muteOffer(text.kinds[kind])}</p>
          <button type="button" onClick={() => void mute(kind, true)}>
            {text.muteKind}
          </button>
        </div>
      ))}
      {view.hidden > 0 && <p className="hint">{text.hidden(view.hidden)}</p>}

      <details className="advanced">
        <summary>{text.settings}</summary>
        <p className="hint">
          {view.ownAddresses.length > 0
            ? text.addressesKnown(view.ownAddresses.join(', '))
            : text.addressesNone}
        </p>
        <div className="field">
          <label htmlFor="today-addresses">{text.addresses}</label>
          <textarea
            id="today-addresses"
            rows={2}
            value={addresses}
            onChange={(event) => setAddresses(event.target.value)}
          />
          <span className="hint">{text.addressesHint}</span>
        </div>
        <div className="actions">
          <button type="button" onClick={() => void saveAddresses()}>
            {text.saveAddresses}
          </button>
        </div>
        {view.mutedKinds.length > 0 && (
          <>
            <h4>{text.mutedTitle}</h4>
            <ul className="today-watch">
              {view.mutedKinds.map((kind) => (
                <li key={kind}>
                  <span>{text.kinds[kind]}</span>
                  <button type="button" className="quiet" onClick={() => void mute(kind, false)}>
                    {text.unmute}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </details>
    </section>
  )
}

type SignalProps = {
  item: TodayItem
  day: string
  choosingLater: boolean
  onOpen: () => void
  onDone: () => void
  onMute: () => void
  onAskLater: () => void
  onLater: (until: string) => void
}

/** One thing to do: what it is, where it comes from, why it is here, and what the PM can do. */
function Signal(props: SignalProps) {
  const { item, day } = props
  const words = signalText(item)
  const facts = item.facts
  const asOf = asOfText(item)
  const returned = item.returned
  return (
    <li className="today-item">
      <p className="today-item-title">{words.title}</p>
      <p className="today-item-detail">
        <span className="badge">{text.kinds[facts.kind]}</span> {words.detail}
        {asOf !== '' && <span className="hint"> · {asOf}</span>}
      </p>
      {item.dueBecause && <p className="hint">{text.because[item.dueBecause]}</p>}
      {returned && (
        <p className="hint" role="note">
          {returned.why === 'later'
            ? text.returned.later
            : returned.why === 'still'
              ? text.returned.still(returned.since.split('-').reverse().join('/'))
              : text.returned.worse(returned.was, returned.now)}
        </p>
      )}
      {facts.kind === 'mail_reply' && (
        <p className="today-judgement">
          {facts.judgement ? (
            <>
              <strong>{text.judgement.title}:</strong>{' '}
              {text.judgement.importance[facts.judgement.importance]}. {facts.judgement.reason} «
              {facts.judgement.quote}»{' '}
              <span
                className={facts.judgement.quoteVerified ? 'badge badge-ok' : 'badge badge-warning'}
              >
                {facts.judgement.quoteVerified
                  ? text.judgement.verified
                  : text.judgement.unverified}
              </span>
              {facts.judgement.deadline && (
                <span className="hint">
                  {' '}
                  {text.judgement.deadline(dayText(facts.judgement.deadline))}
                </span>
              )}
            </>
          ) : (
            <span className="hint">
              {text.judgement.title}: {text.judgement.none}
            </span>
          )}
        </p>
      )}
      <div className="actions today-item-actions">
        <button type="button" onClick={props.onOpen}>
          {text.open[item.target]}
        </button>
        <span className="today-decisions">
          <button type="button" className="quiet" onClick={props.onDone}>
            {text.done}
          </button>
          <button
            type="button"
            className="quiet"
            aria-expanded={props.choosingLater}
            onClick={props.onAskLater}
          >
            {text.later}
          </button>
          <button type="button" className="quiet" onClick={props.onMute}>
            {facts.kind === 'mail_reply' ? text.noAnswerNeeded : text.mute}
          </button>
        </span>
      </div>
      {props.choosingLater && (
        <fieldset className="actions today-later">
          <legend className="hint">{text.laterTitle}</legend>
          <button type="button" onClick={() => props.onLater(plusDays(day, 1))}>
            {text.laterTomorrow}
          </button>
          <button type="button" onClick={() => props.onLater(nextMonday(day))}>
            {text.laterMonday}
          </button>
          <button type="button" onClick={() => props.onLater(plusDays(day, WEEK_DAYS))}>
            {text.laterWeek}
          </button>
          <button type="button" className="quiet" onClick={props.onAskLater}>
            {text.laterCancel}
          </button>
        </fieldset>
      )}
    </li>
  )
}

type JudgementProps = {
  view: View
  canJudge: boolean
  judging: boolean
  step: AgentProgress | null
  hasMail: boolean
  onUpdate: () => void
  onAll: () => void
  onStop: () => void
}

/** What Claude judged, apart from what the code computed: when, with which model, and how to ask again. */
function Judgement({ view, canJudge, judging, step, hasMail, ...actions }: JudgementProps) {
  const { at, model } = view.evaluation
  if (!hasMail && at === null && !judging) return null
  return (
    <aside className="today-evaluation" aria-label={text.judgement.title}>
      <p>
        <strong>{at ? text.judgement.when(dateTimeText(at), model) : text.judgement.never}</strong>
      </p>
      <p className="hint">{text.judgement.explain}</p>
      {judging ? (
        <>
          <p className="progress">{step ? progressText(step) : text.judgement.running}</p>
          <div className="actions">
            <button type="button" onClick={actions.onStop}>
              {text.judgement.stop}
            </button>
          </div>
        </>
      ) : (
        canJudge && (
          <div className="actions">
            <button type="button" onClick={actions.onUpdate}>
              {text.judgement.update}
            </button>
            {hasMail && at !== null && (
              <button type="button" className="quiet" onClick={actions.onAll}>
                {text.judgement.all}
              </button>
            )}
          </div>
        )
      )}
    </aside>
  )
}
