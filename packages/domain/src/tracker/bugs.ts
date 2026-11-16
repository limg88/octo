import {
  type DashboardSettings,
  type ItemHistory,
  inScope,
  isOfType,
  isOpenPhase,
  type Phase,
  phaseOf,
  type TrackerData,
  type TrackerItem,
} from './model.ts'

const DAY_MS = 24 * 60 * 60 * 1000

/** An open bug as the dashboard lists it. */
export type BugRow = {
  id: string
  title: string
  state: string
  phase: Phase
  assignee: string | null
  severity: string | null
  environment: string | null
  createdAt: string
  /** Days since it entered its present state; null when the tracker does not say when. */
  daysInState: number | null
  stuck: boolean
  lastComment: { by: string; at: string; text: string } | null
  /** The PM's own note on this bug, when there is one. */
  note: { at: string; text: string } | null
}

export type TrendGranularity = 'week' | 'month'

/** One step of the trend: what entered, what was closed, and what was open at its end. */
export type TrendBucket = {
  /** First day of the step, `YYYY-MM-DD`. */
  from: string
  entered: number
  closed: number
  openAtEnd: number
}

/** How long bugs wait between the steps of their way out, in days. */
export type FlowStep = { median: number | null; sample: number }

/** The bugs in numbers at one instant: what the counts of the page say. */
export type BugCounts = {
  open: number
  work: number
  verify: number
  stuck: number
  validated: number
}

export type BugFlow = { toVerify: FlowStep; toValidated: FlowStep; toClosed: FlowStep }

export type BugDashboard = {
  open: BugRow[]
  /** Validated and not yet released: no longer open, still to follow until they leave. */
  validated: BugRow[]
  byPhase: Record<Phase, number>
  stuck: number
  /** Bugs in scope, whatever their state. */
  total: number
  trend: TrendBucket[]
  /** `history`: from recorded changes. `approximate`: from the present state only. */
  trendSource: 'history' | 'approximate'
  flow: BugFlow | null
  /**
   * The same numbers at the start of the range, from the recorded changes; null without a
   * history: nothing is estimated.
   */
  before: BugCounts | null
  /** The flow of the stretch of the same length that ends where the range starts. */
  flowBefore: BugFlow | null
}

export type TrendRange = { from: Date; to: Date; granularity: TrendGranularity }

const daysBetween = (from: number, to: number): number => Math.floor((to - from) / DAY_MS)

/**
 * Whether an item has stayed in its state longer than the project allows: more days than the
 * threshold, never the same number. One rule for the dashboard and for the page of the day.
 */
export const isStuck = (daysInState: number | null, stuckDays: number): boolean =>
  daysInState !== null && daysInState > stuckDays
const dayOf = (date: Date): string => date.toISOString().slice(0, 10)

/** The first instant of the week (Monday) or of the month a date falls in, in UTC. */
export function bucketStart(date: Date, granularity: TrendGranularity): Date {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  if (granularity === 'month') {
    start.setUTCDate(1)
    return start
  }
  const sinceMonday = (start.getUTCDay() + 6) % 7
  start.setUTCDate(start.getUTCDate() - sinceMonday)
  return start
}

function nextBucket(start: Date, granularity: TrendGranularity): Date {
  const next = new Date(start)
  if (granularity === 'month') next.setUTCMonth(next.getUTCMonth() + 1)
  else next.setUTCDate(next.getUTCDate() + 7)
  return next
}

/** The steps that cover a range, oldest first. */
export function bucketsOf(range: TrendRange): Array<{ from: Date; to: Date }> {
  const buckets: Array<{ from: Date; to: Date }> = []
  let from = bucketStart(range.from, range.granularity)
  while (from.getTime() <= range.to.getTime()) {
    const to = nextBucket(from, range.granularity)
    buckets.push({ from, to })
    from = to
  }
  return buckets
}

/** The last value of a dated series at or before an instant; null when none is that old. */
function valueAt<T>(series: ReadonlyArray<{ at: string } & T>, instant: number): T | null {
  let found: T | null = null
  for (const entry of series) {
    if (Date.parse(entry.at) > instant) break
    found = entry
  }
  return found
}

type Moment = { at: number; open: boolean }

/**
 * The instants at which a bug became open-and-in-scope or stopped being so, from its history:
 * a bug counts only while it has one of the tags of the scope and its state is not closed.
 */
function openMoments(history: ItemHistory, settings: DashboardSettings): Moment[] {
  const created = Date.parse(history.createdAt)
  const instants = [
    ...new Set([
      created,
      ...history.states.map((entry) => Date.parse(entry.at)),
      ...history.tags.map((entry) => Date.parse(entry.at)),
    ]),
  ].sort((a, b) => a - b)
  const moments: Moment[] = []
  let open = false
  for (const at of instants) {
    // A bug whose first recorded state comes later was already there: until then it is open.
    const state = valueAt(history.states, at)?.state
    const tags = valueAt(history.tags, at)?.tags ?? []
    const now =
      at >= created &&
      inScope(tags, settings) &&
      (state === undefined || isOpenPhase(phaseOf(state, settings)))
    if (now !== open) moments.push({ at, open: now })
    open = now
  }
  return moments
}

/** Without a history: a bug opens when it is created and closes when it entered its present state. */
function approximateMoments(item: TrackerItem, settings: DashboardSettings): Moment[] {
  const opened = { at: Date.parse(item.createdAt), open: true }
  if (isOpenPhase(phaseOf(item.state, settings)) || item.stateChangedAt === null) return [opened]
  return [opened, { at: Date.parse(item.stateChangedAt), open: false }]
}

function trendOf(moments: readonly Moment[][], range: TrendRange): TrendBucket[] {
  return bucketsOf(range).map(({ from, to }) => {
    const start = from.getTime()
    const end = Math.min(to.getTime(), range.to.getTime() + 1)
    let entered = 0
    let closed = 0
    let openAtEnd = 0
    for (const series of moments) {
      let open = false
      for (const moment of series) {
        if (moment.at >= end) break
        if (moment.at >= start) {
          if (moment.open) entered += 1
          else closed += 1
        }
        open = moment.open
      }
      if (open) openAtEnd += 1
    }
    return { from: dayOf(from), entered, closed, openAtEnd }
  })
}

function median(values: readonly number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  const value =
    sorted.length % 2 === 1
      ? sorted[middle]
      : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
  return Math.round((value ?? 0) * 10) / 10
}

const step = (values: readonly number[]): FlowStep => ({
  median: median(values),
  sample: values.length,
})

/** The first time a history entered a state that passes the test, at or after an instant. */
function firstEntry(
  history: ItemHistory,
  wanted: (state: string) => boolean,
  after: number,
): number | null {
  const entry = history.states.find(
    (candidate) => Date.parse(candidate.at) >= after && wanted(candidate.state),
  )
  return entry ? Date.parse(entry.at) : null
}

/**
 * Where bugs stop on their way out: from opening to the first verification, from there to the
 * validation, from there to the closing. Only bugs that reached verification since `since`, and
 * before `until` when it is given, count.
 */
function flowOf(
  histories: readonly ItemHistory[],
  settings: DashboardSettings,
  since: number,
  until = Number.POSITIVE_INFINITY,
): BugFlow {
  const toVerify: number[] = []
  const toValidated: number[] = []
  const toClosed: number[] = []
  const inPhase = (phase: Phase) => (state: string) => phaseOf(state, settings) === phase
  const handover = new Set(settings.handoverStates)
  const handedOver = handover.size > 0 ? (state: string) => handover.has(state) : inPhase('verify')
  for (const history of histories) {
    const created = Date.parse(history.createdAt)
    const verify = firstEntry(history, handedOver, since)
    if (verify === null || verify >= until) continue
    toVerify.push((verify - created) / DAY_MS)
    const validated = firstEntry(history, inPhase('validated'), verify)
    if (validated === null) continue
    toValidated.push((validated - verify) / DAY_MS)
    const closed = firstEntry(history, inPhase('closed'), validated)
    if (closed !== null) toClosed.push((closed - validated) / DAY_MS)
  }
  return { toVerify: step(toVerify), toValidated: step(toValidated), toClosed: step(toClosed) }
}

/**
 * The numbers of the page as they were at an instant, from the recorded changes: a bug counts
 * while it has a tag of the scope, and is stuck when it had been in its state for too long then.
 */
export function countsAt(
  histories: readonly ItemHistory[],
  settings: DashboardSettings,
  instant: number,
): BugCounts {
  const counts: BugCounts = { open: 0, work: 0, verify: 0, stuck: 0, validated: 0 }
  for (const history of histories) {
    const created = Date.parse(history.createdAt)
    if (created > instant) continue
    if (!inScope(valueAt(history.tags, instant)?.tags ?? [], settings)) continue
    const entry = valueAt(history.states, instant)
    // A bug whose first recorded state comes later was already there, and being worked on.
    const phase = entry ? phaseOf(entry.state, settings) : 'work'
    if (phase === 'validated') counts.validated += 1
    if (!isOpenPhase(phase)) continue
    counts.open += 1
    counts[phase === 'verify' ? 'verify' : 'work'] += 1
    const since = entry ? Date.parse(entry.at) : created
    if (isStuck(daysBetween(since, instant), settings.stuckDays)) counts.stuck += 1
  }
  return counts
}

/** The PM's latest note on an item. */
export function noteOf(
  id: string,
  settings: Pick<DashboardSettings, 'decisions'>,
): { at: string; text: string } | null {
  const note = settings.decisions.notes.findLast((candidate) => candidate.id === id)
  return note ? { at: note.at, text: note.text } : null
}

function rowOf(item: TrackerItem, settings: DashboardSettings, now: number): BugRow {
  const daysInState =
    item.stateChangedAt === null ? null : daysBetween(Date.parse(item.stateChangedAt), now)
  return {
    id: item.id,
    title: item.title,
    state: item.state,
    phase: phaseOf(item.state, settings),
    assignee: item.assignee,
    severity: item.severity,
    environment: item.environment,
    createdAt: item.createdAt,
    daysInState,
    stuck: isStuck(daysInState, settings.stuckDays),
    lastComment: item.comments.at(-1) ?? null,
    note: noteOf(item.id, settings),
  }
}

/**
 * The bugs of a project as the dashboard shows them: the open ones by phase, the stuck ones, the
 * trend over the range asked and where they stop. Every number is computed here, from the
 * tracker's own data.
 */
export function bugDashboard(
  data: TrackerData,
  settings: DashboardSettings,
  range: TrendRange,
  now: Date,
): BugDashboard {
  const bugs = data.items.filter((item) => isOfType(item, settings.bugTypes))
  const scoped = bugs.filter((item) => inScope(item.tags, settings))
  const rows = scoped.map((item) => rowOf(item, settings, now.getTime()))
  const longestFirst = (a: BugRow, b: BugRow) => (b.daysInState ?? -1) - (a.daysInState ?? -1)
  const open = rows.filter((row) => isOpenPhase(row.phase)).sort(longestFirst)
  const validated = rows.filter((row) => row.phase === 'validated').sort(longestFirst)
  const byPhase: Record<Phase, number> = { work: 0, verify: 0, validated: 0, closed: 0 }
  for (const row of rows) byPhase[row.phase] += 1

  const histories = data.history
  // With a history every bug is followed, also those that left the scope: they counted while in it.
  const moments = histories
    ? bugs.flatMap((item) => {
        const history = histories.get(item.id)
        return history ? [openMoments(history, settings)] : []
      })
    : scoped.map((item) => approximateMoments(item, settings))
  // What was in scope at a past instant is told by the history, also for bugs that left it since.
  const allHistories = histories
    ? bugs.flatMap((item) => {
        const history = histories.get(item.id)
        return history ? [history] : []
      })
    : []
  const scopedHistories = histories
    ? scoped.flatMap((item) => {
        const history = histories.get(item.id)
        return history ? [history] : []
      })
    : []

  return {
    open,
    validated,
    byPhase,
    stuck: open.filter((row) => row.stuck).length,
    total: scoped.length,
    trend: trendOf(moments, range),
    trendSource: histories ? 'history' : 'approximate',
    flow: histories ? flowOf(scopedHistories, settings, range.from.getTime()) : null,
    before: histories ? countsAt(allHistories, settings, range.from.getTime()) : null,
    flowBefore: histories
      ? flowOf(
          scopedHistories,
          settings,
          2 * range.from.getTime() - range.to.getTime(),
          range.from.getTime(),
        )
      : null,
  }
}
