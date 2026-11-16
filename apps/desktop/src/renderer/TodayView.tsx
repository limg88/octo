import type { AgentProgress, TodayView as View } from '@octo/application'
import {
  isToDo,
  type MailTurn,
  type Project,
  TODAY_LIMIT,
  type TodayItem,
  type TodayKind,
  type TodayTarget,
} from '@octo/domain'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ErrorCode, OctoApi, TodayDecisionChoice } from '../shared/api.ts'
import {
  type BugFilter,
  GROUP_OF,
  NO_TODAY_FOCUS,
  TODAY_GROUPS,
  type TodayFocus,
} from './context.ts'
import { type DataColumn, DataTable } from './DataTable.tsx'
import { Failure } from './Failure.tsx'
import { dateTimeText, messages, progressText } from './messages.ts'
import { RiskRegister } from './RiskRegister.tsx'
import { BusyButton, Waiting } from './Spinner.tsx'
import type { Section } from './sections.ts'
import { ageText, asOfText, dayText, personOf, signalText } from './today-text.ts'
import { useSelection } from './use-selection.ts'

type TodayApi = Pick<
  OctoApi,
  | 'todayView'
  | 'decideToday'
  | 'muteTodayKind'
  | 'setMailTurn'
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
  | 'assignMeeting'
>

type Props = {
  api: TodayApi
  project: Project
  /** False when Claude Code is not on this computer: nothing is judged, the page still works. */
  canJudge: boolean
  onOpenSection: (section: Section) => void
  /** Opens the dashboard on a part of the bugs; without it the dashboard opens as it was. */
  onOpenBugs?: (filter: BugFilter) => void
  /** Takes a question about a signal to «Chiedi», written and not yet asked. */
  onAsk?: (question: string) => void
  /** The filter and the row in view, kept by who shows the page while the PM is elsewhere. */
  focus?: TodayFocus
  onFocus?: (focus: TodayFocus) => void
  /** Opens the settings of the page, kept with those of the project. */
  onOpenSettings?: () => void
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

/** What the PM just decided of a signal, while it can still be taken back. */
type Decided = { key: string; title: string; state: Exclude<TodayDecisionChoice, 'open'> }

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
export function TodayView({
  api,
  project,
  canJudge,
  onOpenSection,
  onOpenBugs,
  onAsk,
  focus: givenFocus,
  onFocus,
  onOpenSettings,
}: Props) {
  const [view, setView] = useState<View | null>(null)
  const [error, setError] = useState<ErrorCode | null>(null)
  const [all, setAll] = useState(false)
  const [later, setLater] = useState<string | null>(null)
  const [reading, setReading] = useState(false)
  const [judging, setJudging] = useState(false)
  const [step, setStep] = useState<AgentProgress | null>(null)
  const [showRisks, setShowRisks] = useState(false)
  const [ownFocus, setOwnFocus] = useState<TodayFocus>(NO_TODAY_FOCUS)
  const [decided, setDecided] = useState<Decided | null>(null)
  const [opening, setOpening] = useState<string | null>(null)
  /** The day and project Claude was already asked for by this page: never twice by itself. */
  const asked = useRef<string | null>(null)
  /** The project on the page now: an answer that comes back for another one is dropped. */
  const live = useRef<string | null>(project.id)
  live.current = project.id
  // When the page goes away nothing that comes back is shown; when it is put back, it is again.
  useEffect(() => {
    live.current = project.id
    return () => {
      live.current = null
    }
  }, [project.id])

  const focus = givenFocus ?? ownFocus
  const setFocus = (next: TodayFocus) => {
    setOwnFocus(next)
    onFocus?.(next)
  }

  const show = useCallback((next: View) => setView(next), [])

  const evaluate = useCallback(
    async (everything: boolean) => {
      const projectId = project.id
      setJudging(true)
      setStep(null)
      setError(null)
      const result = await api.evaluateToday(projectId, everything)
      if (live.current !== projectId) return
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
    const projectId = project.id
    const result = await api.todayView(projectId)
    if (live.current !== projectId) return
    if (!result.ok) return setError(result.code)
    show(result.value)
    const mark = `${projectId}:${result.value.day}`
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
    setReading(false)
    setJudging(false)
    setStep(null)
    setDecided(null)
    setOpening(null)
    setOwnFocus(NO_TODAY_FOCUS)
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

  async function decide(
    item: Pick<Decided, 'key' | 'title'>,
    state: TodayDecisionChoice,
    until: string | null = null,
  ) {
    const projectId = project.id
    setError(null)
    setLater(null)
    const result = await api.decideToday(projectId, item.key, state, until)
    if (live.current !== projectId) return
    if (!result.ok) return setError(result.code)
    show(result.value)
    // What was put away can be taken back with one click, until something else is decided.
    setDecided(state === 'open' ? null : { ...item, state })
    if (state === 'open') setFocus({ ...focus, key: item.key })
  }

  /** The PM's word on whose turn a conversation of the mail is. */
  async function mailTurn(key: string, turn: MailTurn) {
    const projectId = project.id
    setError(null)
    const result = await api.setMailTurn(projectId, key, turn)
    if (live.current !== projectId) return
    if (result.ok) show(result.value)
    else setError(result.code)
  }

  async function mute(kind: TodayKind, muted: boolean) {
    const projectId = project.id
    setError(null)
    const result = await api.muteTodayKind(projectId, kind, muted)
    if (live.current !== projectId) return
    if (result.ok) show(result.value)
    else setError(result.code)
  }

  async function readNow() {
    const projectId = project.id
    setReading(true)
    setError(null)
    const result = await api.fill(projectId)
    if (live.current !== projectId) return
    setReading(false)
    if (!result.ok) setError(result.code)
    await load()
  }

  /** Hands a file of the project to the system; the row says so while the system takes it. */
  async function openFile(key: string, path: string) {
    const projectId = project.id
    setOpening(key)
    const result = await api.openEvidence(projectId, path)
    if (live.current !== projectId) return
    setOpening((current) => (current === key ? null : current))
    if (!result.ok) setError(result.code)
  }

  /** Takes into the project a recorded meeting that had none: the PM says whose it is. */
  async function assign(key: string, meetingId: string) {
    const projectId = project.id
    setOpening(key)
    setError(null)
    const result = await api.assignMeeting(projectId, meetingId)
    if (live.current !== projectId) return
    setOpening((current) => (current === key ? null : current))
    if (result.ok) show(result.value)
    else setError(result.code)
  }

  function open(item: TodayItem) {
    if (item.facts.kind === 'meeting_unassigned') return void assign(item.key, item.facts.id)
    const section = SECTION_OF[item.target]
    const path = pathOf(item)
    if (item.facts.kind === 'bugs_stuck' && onOpenBugs) onOpenBugs('stuck')
    else if (section) onOpenSection(section)
    else if (item.target === 'risks') setShowRisks(true)
    else if (path) void openFile(item.key, path)
  }

  const allItems = view?.items ?? []
  const toDo = allItems.filter(isToDo)
  const inGroup =
    focus.group === 'all' ? toDo : toDo.filter((item) => GROUP_OF[item.facts.kind] === focus.group)
  const shown = all ? inGroup : inGroup.slice(0, TODAY_LIMIT)
  const selectedKey = useSelection(
    shown.map((item) => item.key),
    focus.key,
  )

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
    return error ? (
      <Failure code={error} />
    ) : (
      <div className="page-wait">
        <Waiting>{text.loading}</Waiting>
      </div>
    )
  }

  const watchColumns: DataColumn<TodayItem>[] = [
    {
      key: 'what',
      label: text.watchWhat,
      cell: (item) => <strong>{signalText(item).title}</strong>,
      sort: (item) => signalText(item).title,
      text: (item) => signalText(item).title,
    },
    {
      key: 'detail',
      label: text.watchDetail,
      width: '34%',
      cell: (item) => <span className="hint">{signalText(item).detail}</span>,
      text: (item) => signalText(item).detail,
    },
    {
      key: 'actions',
      label: '',
      name: text.watchActions,
      kind: 'actions',
      width: '290px',
      cell: (item) => {
        const title = signalText(item).title
        return (
          <>
            {item.facts.kind === 'mail_follow' && (
              <button
                type="button"
                className="quiet"
                title={text.mineHint}
                aria-label={`${text.mine}: ${title}`}
                onClick={() => void mailTurn(item.key, 'mine')}
              >
                {text.mine}
              </button>
            )}
            <button type="button" className="quiet" onClick={() => open(item)}>
              {text.open[item.target]}
            </button>
            <button
              type="button"
              className="quiet"
              aria-label={`${text.mute}: ${title}`}
              onClick={() => void decide({ key: item.key, title }, 'muted')}
            >
              ×
            </button>
          </>
        )
      },
    },
  ]

  const alerts = view.items.filter((item) => item.band === 'alert')
  const watch = view.items.filter((item) => item.band === 'watch')
  const groups = TODAY_GROUPS.map((group) => ({
    group,
    count: toDo.filter((item) => GROUP_OF[item.facts.kind] === group).length,
  })).filter((entry) => entry.count > 0)
  const selected = shown.find((item) => item.key === selectedKey) ?? null

  return (
    <section className="today" aria-label={messages.todayTab} aria-busy={reading || undefined}>
      <header className="today-head">
        <div className="today-day">
          <h3>{text.title(dayText(view.day))}</h3>
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
        </div>
        <div className="actions">
          <button type="button" onClick={() => setShowRisks(true)}>
            {messages.risks.title}
          </button>
          <BusyButton
            busy={reading}
            busyLabel={messages.wait.reading}
            onClick={() => void readNow()}
          >
            {text.readNow}
          </BusyButton>
        </div>
      </header>
      {reading && (
        <p className="hint" role="status">
          {text.refreshing}
        </p>
      )}
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

      {decided && (
        <div className="notice-bar">
          <p role="status">{text.decided[decided.state](decided.title)}</p>
          <button type="button" onClick={() => void decide(decided, 'open')}>
            {text.undo}
          </button>
        </div>
      )}

      <h4 className="today-title">
        {text.toDo}
        {toDo.length > 0 && (
          <span className="today-count">{text.toDoCount(shown.length, inGroup.length)}</span>
        )}
      </h4>
      {view.items.length === 0 ? (
        <p className="today-empty">{text.nothing}</p>
      ) : toDo.length === 0 ? (
        <p className="today-empty">{text.nothingToDo}</p>
      ) : (
        <>
          {groups.length > 1 && (
            <fieldset className="chips" aria-label={text.filters}>
              <FilterChip
                label={text.filterAll}
                count={toDo.length}
                pressed={focus.group === 'all'}
                onPress={() => setFocus({ ...focus, group: 'all' })}
              />
              {groups.map(({ group, count }) => (
                <FilterChip
                  key={group}
                  label={text.groups[group]}
                  count={count}
                  pressed={focus.group === group}
                  onPress={() => setFocus({ ...focus, group })}
                />
              ))}
            </fieldset>
          )}
          <div className="split">
            <div className="split-list">
              {shown.length === 0 ? (
                <p className="today-empty">{text.noneInFilter}</p>
              ) : (
                <ul className="entries" aria-label={text.list}>
                  {shown.map((item) => (
                    <li key={item.key}>
                      <SignalRow
                        item={item}
                        selected={item.key === selectedKey}
                        judging={judging}
                        onSelect={() => {
                          setLater(null)
                          setFocus({ ...focus, key: item.key })
                        }}
                      />
                    </li>
                  ))}
                </ul>
              )}
              {inGroup.length > TODAY_LIMIT && (
                <button type="button" className="quiet" onClick={() => setAll(!all)}>
                  {all ? text.fewer : text.more(inGroup.length - TODAY_LIMIT)}
                </button>
              )}
            </div>
            <section className="panel split-detail" aria-label={text.detailTitle}>
              {selected ? (
                <SignalDetail
                  item={selected}
                  day={view.day}
                  judging={judging}
                  opening={opening === selected.key}
                  choosingLater={later === selected.key}
                  onOpen={() => open(selected)}
                  onAsk={onAsk}
                  onNotMine={() => void mailTurn(selected.key, 'not_mine')}
                  onDecide={(state, until) =>
                    void decide(
                      { key: selected.key, title: signalText(selected).title },
                      state,
                      until,
                    )
                  }
                  onAskLater={() => setLater(later === selected.key ? null : selected.key)}
                />
              ) : (
                <p className="hint panel-body">{messages.detail.none}</p>
              )}
            </section>
          </div>
        </>
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
          <DataTable
            label={text.watch}
            columns={watchColumns}
            rows={watch}
            rowKey={(item) => item.key}
          />
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

      {onOpenSettings && (
        <div className="actions">
          <button type="button" className="quiet" onClick={onOpenSettings}>
            {text.settings}
          </button>
        </div>
      )}
    </section>
  )
}

function FilterChip(props: {
  label: string
  count: number
  pressed: boolean
  onPress: () => void
}) {
  return (
    <button
      type="button"
      className={props.pressed ? 'chip chip-selected' : 'chip'}
      aria-pressed={props.pressed}
      onClick={props.onPress}
    >
      {props.label} <span className="chip-count">{props.count}</span>
    </button>
  )
}

/** One thing to do in the list: what it is, where it comes from, how long it has waited. */
function SignalRow(props: {
  item: TodayItem
  selected: boolean
  judging: boolean
  onSelect: () => void
}) {
  const { item } = props
  const facts = item.facts
  const age = ageText(item)
  const judgement = facts.kind === 'mail_reply' ? facts.judgement : null
  return (
    <button
      type="button"
      className={props.selected ? 'entry entry-selected' : 'entry'}
      aria-pressed={props.selected}
      onClick={props.onSelect}
    >
      <span className="entry-meta">
        {item.dueBecause && (
          <span className="pill pill-warning">{text.dueShort[item.dueBecause]}</span>
        )}
        <span className="pill pill-source">{text.kinds[facts.kind]}</span>
        {age !== '' && <span>{age}</span>}
        {judgement && <span>· Claude: {text.judgement.importance[judgement.importance]}</span>}
        {facts.kind === 'mail_reply' && !judgement && props.judging && (
          <span>· {text.judging}</span>
        )}
      </span>
      <strong className="entry-title">{signalText(item).title}</strong>
    </button>
  )
}

type DetailProps = {
  item: TodayItem
  day: string
  judging: boolean
  opening: boolean
  choosingLater: boolean
  onOpen: () => void
  onAsk: ((question: string) => void) | undefined
  /** Says the conversation of this mail is not the PM's to answer. */
  onNotMine: () => void
  onDecide: (state: TodayDecisionChoice, until?: string | null) => void
  onAskLater: () => void
}

/** The signal in view: why it is here, what it stands on, and what the PM can do about it. */
function SignalDetail(props: DetailProps) {
  const { item, day } = props
  const words = signalText(item)
  const facts = item.facts
  const asOf = asOfText(item)
  const returned = item.returned
  const unassigned = facts.kind === 'meeting_unassigned'
  return (
    <>
      <div className="panel-head">
        <span className="eyebrow">{text.computed}</span>
        <span className="pill pill-source">{text.kinds[facts.kind]}</span>
      </div>
      <div className="panel-body">
        <h4 className="detail-title">{words.title}</h4>
        <p className="today-item-detail">
          {words.detail}
          {asOf !== '' && <span className="hint"> · {asOf}</span>}
        </p>
        {item.dueBecause && (
          <p className="box box-warning">
            <strong>{text.dueShort[item.dueBecause]}.</strong> {text.because[item.dueBecause]}
          </p>
        )}
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
          <div className="box today-judgement">
            {facts.judgement ? (
              <>
                <p>
                  <strong>{text.judgement.title}:</strong>{' '}
                  {text.judgement.importance[facts.judgement.importance]}. {facts.judgement.reason}
                </p>
                <blockquote>«{facts.judgement.quote}»</blockquote>
                <p>
                  <span
                    className={
                      facts.judgement.quoteVerified ? 'badge badge-ok' : 'badge badge-warning'
                    }
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
                </p>
              </>
            ) : props.judging ? (
              <Waiting>{text.judging}</Waiting>
            ) : (
              <span className="hint">
                {text.judgement.title}: {text.judgement.none}
              </span>
            )}
          </div>
        )}
        <div className="actions today-item-actions">
          <BusyButton
            className="primary"
            busy={props.opening}
            busyLabel={unassigned ? messages.wait.assigning : messages.wait.opening}
            onClick={props.onOpen}
          >
            {unassigned ? text.assignMeeting : text.open[item.target]}
          </BusyButton>
          {facts.kind === 'mail_reply' && props.onAsk && (
            <button
              type="button"
              onClick={() => props.onAsk?.(text.mailSeed(personOf(facts.from), facts.subject))}
            >
              {text.askAboutMail}
            </button>
          )}
        </div>
        <div className="actions today-decisions">
          <button type="button" className="quiet" onClick={() => props.onDecide('done')}>
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
          {facts.kind === 'mail_reply' && (
            <button
              type="button"
              className="quiet"
              title={text.notMineHint}
              onClick={props.onNotMine}
            >
              {text.notMine}
            </button>
          )}
          <button type="button" className="quiet" onClick={() => props.onDecide('muted')}>
            {facts.kind === 'mail_reply'
              ? text.noAnswerNeeded
              : unassigned
                ? text.notThisProject
                : text.mute}
          </button>
        </div>
        {props.choosingLater && (
          <fieldset className="actions today-later">
            <legend className="hint">{text.laterTitle}</legend>
            <button type="button" onClick={() => props.onDecide('later', plusDays(day, 1))}>
              {text.laterTomorrow}
            </button>
            <button type="button" onClick={() => props.onDecide('later', nextMonday(day))}>
              {text.laterMonday}
            </button>
            <button type="button" onClick={() => props.onDecide('later', plusDays(day, WEEK_DAYS))}>
              {text.laterWeek}
            </button>
            <button type="button" className="quiet" onClick={props.onAskLater}>
              {text.laterCancel}
            </button>
          </fieldset>
        )}
      </div>
    </>
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
          <Waiting>{step ? progressText(step) : text.judgement.running}</Waiting>
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
