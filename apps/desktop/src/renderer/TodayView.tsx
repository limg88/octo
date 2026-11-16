import type { AgentProgress, TodayView as View } from '@octo/application'
import {
  type HiddenItem,
  isToDo,
  type MailTurn,
  type Project,
  TODAY_LIMIT,
  type TodayItem,
  type TodayKind,
  type TodayMark,
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
import {
  ageText,
  asOfText,
  dayText,
  nowText,
  personOf,
  shortDayText,
  signalText,
} from './today-text.ts'
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
  | 'markTodaySeen'
  | 'nextReading'
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
  /** Tells how many things the page asks of the PM, each time it is computed. */
  onCount?: (count: number) => void
  /** How long the page stays open before the PM is taken to have looked at it. */
  visitAfterMs?: number
}

const text = messages.today
const MINUTE_MS = 60 * 1000
/** A page passed through is not a page looked at: it counts after these seconds. */
const VISIT_AFTER_MS = 5 * 1000
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

/** The tracker of the client as the page names it among its sources. */
const TRACKER_SOURCE = 'Tracker del cliente'

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
  onCount,
  visitAfterMs = VISIT_AFTER_MS,
}: Props) {
  const [view, setView] = useState<View | null>(null)
  const [error, setError] = useState<ErrorCode | null>(null)
  const [all, setAll] = useState(false)
  const [later, setLater] = useState<string | null>(null)
  const [reading, setReading] = useState(false)
  const [judging, setJudging] = useState(false)
  const [step, setStep] = useState<AgentProgress | null>(null)
  const [showRisks, setShowRisks] = useState(false)
  const [showHidden, setShowHidden] = useState(false)
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

  const [nextReadingAt, setNextReadingAt] = useState<string | null>(null)
  /** The minute it is now: what is said in minutes is said again when it changes. */
  const [minute, setMinute] = useState(() => Date.now())
  /** The project whose page the PM was already taken to have looked at, since it was opened. */
  const visited = useRef<string | null>(null)

  const show = useCallback(
    (next: View) => {
      setView(next)
      onCount?.(next.count)
    },
    [onCount],
  )

  const askNextReading = useCallback(async () => {
    const projectId = project.id
    const result = await api.nextReading()
    if (live.current === projectId && result.ok) setNextReadingAt(result.value)
  }, [api, project.id])

  useEffect(() => {
    const timer = setInterval(() => setMinute(Date.now()), MINUTE_MS)
    return () => clearInterval(timer)
  }, [])

  // The PM is taken to have looked at the page when it stayed open for a while: then what is
  // on it is no longer new. Once when the page opens, and again whenever something is marked.
  useEffect(() => {
    if (view === null) return
    const projectId = project.id
    if (visited.current === projectId && Object.keys(view.marks).length === 0) return
    const timer = setTimeout(() => {
      if (document.visibilityState !== 'visible') return
      visited.current = projectId
      void api.markTodaySeen(projectId)
    }, visitAfterMs)
    return () => clearTimeout(timer)
  }, [api, project.id, view, visitAfterMs])

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
    void askNextReading()
    const mark = `${projectId}:${result.value.day}`
    if (!result.value.evaluationDue || !canJudge || asked.current === mark) return
    asked.current = mark
    void evaluate(false)
  }, [api, project.id, show, canJudge, evaluate, askNextReading])

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new project starts from its own page.
  useEffect(() => {
    setView(null)
    setError(null)
    setAll(false)
    setLater(null)
    setShowRisks(false)
    setShowHidden(false)
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
  const first = view?.now ?? []
  // What comes first is told once, above: the lists below go on without it.
  const firstKeys = new Set(first.map((entry) => entry.item.key))
  const toDo = allItems.filter((item) => isToDo(item) && !firstKeys.has(item.key))
  const inGroup =
    focus.group === 'all' ? toDo : toDo.filter((item) => GROUP_OF[item.facts.kind] === focus.group)
  const shown = all ? inGroup : inGroup.slice(0, TODAY_LIMIT)
  const inView = [...first.map((entry) => entry.item), ...shown]
  const selectedKey = useSelection(
    inView.map((item) => item.key),
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
      cell: (item) => {
        const mark = view?.marks[item.key]
        return (
          <>
            {mark && <span className="pill pill-new">{text.marks[mark]}</span>}{' '}
            <strong>{signalText(item).title}</strong>
          </>
        )
      },
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
  // A source that is a warning already says how old it is: it is not said twice.
  const warned = new Set(
    alerts.flatMap((item) =>
      item.facts.kind === 'source'
        ? [item.facts.source]
        : item.facts.kind === 'tracker_old'
          ? [TRACKER_SOURCE]
          : [],
    ),
  )
  const fresh = view.freshness.filter((entry) => !warned.has(entry.source))
  const freshLine = (entry: (typeof fresh)[number]): string =>
    `${entry.source}: ${entry.readAt ? dateTimeText(entry.readAt) : text.freshnessNever}`
  const freshLines = fresh.map(freshLine)
  // With many sources the line is not read: the one read longest ago says how old the page is,
  // and each of them is a pointer away.
  const oldest = [...fresh].sort((a, b) => (a.readAt ?? '').localeCompare(b.readAt ?? ''))[0]
  const freshShort =
    oldest === undefined
      ? []
      : fresh.length === 1
        ? [freshLine(oldest)]
        : [
            text.freshnessOldest(
              fresh.length,
              oldest.source,
              oldest.readAt ? dateTimeText(oldest.readAt) : text.freshnessNever,
            ),
          ]
  const watch = view.items.filter((item) => item.band === 'watch' && !firstKeys.has(item.key))
  const groups = TODAY_GROUPS.map((group) => ({
    group,
    count: toDo.filter((item) => GROUP_OF[item.facts.kind] === group).length,
  })).filter((entry) => entry.count > 0)
  const byClaude = view.hiddenItems.filter((hidden) => hidden.state === 'claude').length
  const selected = inView.find((item) => item.key === selectedKey) ?? null
  const select = (key: string) => {
    setLater(null)
    setFocus({ ...focus, key })
  }

  return (
    <section className="today" aria-label={messages.todayTab} aria-busy={reading || undefined}>
      <header className="today-head">
        <div className="today-day">
          <h3>{text.title(dayText(view.day))}</h3>
          {(nextReadingAt !== null || fresh.length > 0) && (
            <p className="hint today-freshness" title={freshLines.join('\n')}>
              {[
                ...(nextReadingAt === null
                  ? []
                  : [
                      text.nextReading(Math.ceil((Date.parse(nextReadingAt) - minute) / MINUTE_MS)),
                    ]),
                ...freshShort,
              ].join(' · ')}
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

      {first.length > 0 && (
        <section className="panel today-now" aria-label={text.now}>
          <h4 className="today-title" title={text.nowHint}>
            {text.now}
          </h4>
          <ul className="entries" aria-label={text.nowList}>
            {first.map((entry) => (
              <li key={entry.item.key}>
                <SignalRow
                  item={entry.item}
                  mark={view.marks[entry.item.key]}
                  why={nowText(entry)}
                  selected={entry.item.key === selectedKey}
                  judging={judging}
                  onSelect={() => select(entry.item.key)}
                />
              </li>
            ))}
          </ul>
          {view.nowSummary.length > 0 && (
            <section className="today-now-summary" aria-label={text.nowSummary}>
              <span className="eyebrow">{text.nowSummary}</span>
              {view.nowSummary.map((sentence) => (
                <p key={sentence.key}>
                  {sentence.text}{' '}
                  <button
                    type="button"
                    className="quiet"
                    title={`«${sentence.quote}»`}
                    aria-label={`${text.nowSource}: ${sentence.path}`}
                    onClick={() => void openFile(sentence.key, sentence.path)}
                  >
                    {text.nowSource}
                  </button>
                </p>
              ))}
            </section>
          )}
        </section>
      )}

      <h4 className="today-title">
        {text.toDo}
        {toDo.length > 0 && (
          <span className="today-count">{text.toDoCount(shown.length, inGroup.length)}</span>
        )}
      </h4>
      {view.items.length === 0 ? (
        <p className="today-empty">{text.nothing}</p>
      ) : inView.length === 0 ? (
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
                <p className="today-empty">
                  {toDo.length === 0 ? text.nothingElse : text.noneInFilter}
                </p>
              ) : (
                <ul className="entries" aria-label={text.list}>
                  {shown.map((item) => (
                    <li key={item.key}>
                      <SignalRow
                        item={item}
                        mark={view.marks[item.key]}
                        selected={item.key === selectedKey}
                        judging={judging}
                        onSelect={() => select(item.key)}
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
                  sprintEnd={view.sprintEnd}
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
      {view.resolvedToday.length > 0 && (
        <p className="hint" role="status">
          {text.resolvedToday(
            view.resolvedToday.length,
            [...new Set(view.resolvedToday.map((kind) => text.kinds[kind]))].join(', '),
          )}
        </p>
      )}
      {(view.hiddenItems.length > 0 || view.mutedKinds.length > 0) && (
        <>
          <div className="actions">
            <button
              type="button"
              className="quiet"
              aria-expanded={showHidden}
              onClick={() => setShowHidden(!showHidden)}
            >
              {text.hiddenButton(view.hiddenItems.length - byClaude, byClaude)}
            </button>
          </div>
          {showHidden && (
            <HiddenList
              items={view.hiddenItems}
              mutedKinds={view.mutedKinds}
              onRestore={(item) =>
                void decide({ key: item.key, title: signalText(item).title }, 'open')
              }
              onMine={(item) => void mailTurn(item.key, 'mine')}
              onUnmute={(kind) => void mute(kind, false)}
            />
          )}
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
  /** Why the signal comes first now, when it does: said before anything else. */
  why?: string
  /** What changed in it since the PM last looked at the page. */
  mark?: TodayMark | undefined
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
        {props.mark && <span className="pill pill-new">{text.marks[props.mark]}</span>}
        {props.why !== undefined && <span className="pill pill-warning">{props.why}</span>}
        {props.why === undefined && item.dueBecause && (
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

/** What was put away, to be read and taken back: the signals, then the kinds not shown at all. */
function HiddenList(props: {
  items: HiddenItem[]
  mutedKinds: TodayKind[]
  onRestore: (item: TodayItem) => void
  /** Takes back a mail Claude keeps away: the PM says it is theirs. */
  onMine: (item: TodayItem) => void
  onUnmute: (kind: TodayKind) => void
}) {
  /** Why Claude keeps a mail away, in its words and those of the mail. */
  const whyOf = (hidden: HiddenItem): string | null => {
    const facts = hidden.item.facts
    const judged =
      hidden.state === 'claude' && (facts.kind === 'mail_reply' || facts.kind === 'mail_follow')
        ? facts.judgement
        : null
    return judged ? text.hiddenWhy(judged.reason, judged.quote) : null
  }
  const stateText = (hidden: HiddenItem): string =>
    hidden.state === 'later'
      ? text.hiddenStates.later(hidden.until ? shortDayText(hidden.until) : null)
      : text.hiddenStates[hidden.state]
  const columns: DataColumn<HiddenItem>[] = [
    {
      key: 'what',
      label: text.hiddenWhat,
      cell: (hidden) => {
        const why = whyOf(hidden)
        return (
          <>
            <strong>{signalText(hidden.item).title}</strong>
            {why !== null && <span className="hint"> {why}</span>}
          </>
        )
      },
      sort: (hidden) => signalText(hidden.item).title,
      text: (hidden) => signalText(hidden.item).title,
    },
    {
      key: 'state',
      label: text.hiddenState,
      width: '24%',
      cell: stateText,
      sort: stateText,
      text: stateText,
    },
    {
      key: 'since',
      label: text.hiddenSince,
      width: '120px',
      cell: (hidden) => shortDayText(hidden.at),
      sort: (hidden) => hidden.at,
      text: (hidden) => shortDayText(hidden.at),
    },
    {
      key: 'actions',
      label: '',
      name: text.hiddenActions,
      kind: 'actions',
      width: '120px',
      cell: (hidden) => (
        <button
          type="button"
          className="quiet"
          aria-label={`${text.restore}: ${signalText(hidden.item).title}`}
          title={hidden.state === 'claude' ? text.restoreMailHint : undefined}
          onClick={() =>
            hidden.state === 'claude' ? props.onMine(hidden.item) : props.onRestore(hidden.item)
          }
        >
          {text.restore}
        </button>
      ),
    },
  ]
  return (
    <section className="today-hidden" aria-label={text.hiddenTitle}>
      {props.items.length === 0 ? (
        <p className="hint">{text.hiddenNone}</p>
      ) : (
        <DataTable
          label={text.hiddenTitle}
          columns={columns}
          rows={props.items}
          rowKey={(hidden) => hidden.item.key}
        />
      )}
      {props.mutedKinds.length > 0 && (
        <>
          <h5 className="today-title">{text.mutedTitle}</h5>
          <ul className="today-muted" aria-label={text.mutedTitle}>
            {props.mutedKinds.map((kind) => (
              <li key={kind}>
                <span>{text.kinds[kind]}</span>
                <button
                  type="button"
                  className="quiet"
                  aria-label={`${text.unmute}: ${text.kinds[kind]}`}
                  onClick={() => props.onUnmute(kind)}
                >
                  {text.unmute}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

type DetailProps = {
  item: TodayItem
  day: string
  /** The last day of the sprint, when it is still to come: a day to put things off until. */
  sprintEnd: string | null
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
  const [laterDay, setLaterDay] = useState('')
  const tomorrow = plusDays(day, 1)
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
                ? text.returned.still(shortDayText(returned.since))
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
            <button type="button" onClick={() => props.onDecide('later', tomorrow)}>
              {text.laterTomorrow}
            </button>
            <button type="button" onClick={() => props.onDecide('later', nextMonday(day))}>
              {text.laterMonday}
            </button>
            <button type="button" onClick={() => props.onDecide('later', plusDays(day, WEEK_DAYS))}>
              {text.laterWeek}
            </button>
            {props.sprintEnd && (
              <button type="button" onClick={() => props.onDecide('later', props.sprintEnd)}>
                {text.laterSprintEnd(shortDayText(props.sprintEnd))}
              </button>
            )}
            <label className="today-later-date">
              <span className="hint">{text.laterDate}</span>
              <input
                type="date"
                min={tomorrow}
                value={laterDay}
                onChange={(event) => setLaterDay(event.target.value)}
              />
            </label>
            <button
              type="button"
              disabled={laterDay < tomorrow}
              onClick={() => props.onDecide('later', laterDay)}
            >
              {text.laterDateConfirm}
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
      <p className="hint">{text.judgement.filterToo}</p>
      <p className="hint">{text.judgement.risksToo}</p>
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
