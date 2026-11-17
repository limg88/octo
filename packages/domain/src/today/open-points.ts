import { OCTO_FOLDER } from '../extracted-document.ts'
import { shortHash } from '../mail/document.ts'
import type { DayMeeting } from '../mail/thread.ts'
import { workdaysBetween } from '../workdays.ts'
import { TIMED_KINDS } from './decisions.ts'
import type { TodayItem, TodayKind } from './model.ts'
import type { RiskSource } from './risks.ts'

export const OPEN_POINT_STATES = ['open', 'resolved', 'dropped'] as const
export type OpenPointState = (typeof OPEN_POINT_STATES)[number]

/** Who opened a point: the PM by hand, the PM from a signal of the page, Claude from a meeting. */
export const OPEN_POINT_ORIGINS = ['pm', 'signal', 'claude'] as const
export type OpenPointOrigin = (typeof OPEN_POINT_ORIGINS)[number]

/** Who closed a point: the PM, Claude with words of a meeting, the signal it stood on going away. */
export const OPEN_POINT_CLOSERS = ['pm', 'claude', 'signal'] as const
export type OpenPointCloser = (typeof OPEN_POINT_CLOSERS)[number]

/** Why a point waits for a word of the PM. */
export const POINT_CHECK_REASONS = ['unverified', 'not_recorded'] as const
export type PointCheckReason = (typeof POINT_CHECK_REASONS)[number]

/** What was said of a point on a day, with the words it was said in when there are some. */
export type OpenPointNote = { day: string; text: string; source: RiskSource | null }

/**
 * A question to the PM about a point: Claude read it closed in words the code did not find, or
 * the meeting it is talked about in was held and not recorded.
 */
export type PointCheck = {
  day: string
  why: PointCheckReason
  text: string
  /** The meeting it is about, as its invitation calls it. */
  meeting: string | null
}

/**
 * A thing the PM has to close or have closed. Unlike a signal it stays until somebody closes
 * it, whatever the source it came from says.
 */
export type OpenPoint = {
  id: string
  title: string
  /** Whose it is; empty: the PM's. */
  owner: string
  /** The day it was opened, `YYYY-MM-DD`. */
  openedOn: string
  /** The day it is due by; null when it has none. */
  due: string | null
  state: OpenPointState
  origin: OpenPointOrigin
  /** Where it comes from: a file of the project and the words in it; null when written by hand. */
  source: RiskSource | null
  /** The signal of the page it was opened from: when that goes away, the point is closed. */
  signalKey: string | null
  signalKind: TodayKind | null
  /** The meeting it is talked about in, by the id of its invitation; null when not known. */
  meeting: string | null
  closedOn: string | null
  closedBy: OpenPointCloser | null
  /** The words that closed it, when a meeting did. */
  closing: RiskSource | null
  /** What was said of it, the oldest first. */
  history: OpenPointNote[]
  check: PointCheck | null
}

export type OpenPointRegister = {
  points: OpenPoint[]
  /** The recorded meetings Claude already read to close points, by their id. */
  readMeetings: string[]
  /** The day whose meetings Claude last read to close points; null when never. */
  closedDay: string | null
  /** When it did, and with which model. */
  closedAt: string | null
  closedBy: string | null
}

export const NO_OPEN_POINTS: OpenPointRegister = {
  points: [],
  readMeetings: [],
  closedDay: null,
  closedAt: null,
  closedBy: null,
}

/** Where the register is written for whoever answers on the project. */
export const OPEN_POINTS_FILE = `${OCTO_FOLDER}/progetto/open-point.md`
export const MAX_POINT_TITLE = 200
export const MAX_POINT_OWNER = 80
export const MAX_POINT_NOTE = 500
/** Notes kept on a point at most: the oldest go first. */
export const MAX_POINT_HISTORY = 30
/** Points kept at most: the closed and the dropped longest ago go first. */
export const MAX_OPEN_POINTS = 1000
/** Working days after which a point without a day it is due by is said old. */
export const POINT_OLD_WORKDAYS = 5
const DAY = /^\d{4}-\d{2}-\d{2}$/

const clean = (text: string, max: number): string => text.replace(/\s+/g, ' ').trim().slice(0, max)
const dayOrNull = (day: string | null | undefined): string | null =>
  day != null && DAY.test(day) ? day : null

export type NewOpenPoint = {
  title: string
  owner?: string
  due?: string | null
  origin: OpenPointOrigin
  source?: RiskSource | null
  signal?: Pick<TodayItem, 'key'> & { kind: TodayKind }
  meeting?: string | null
}

/** What tells a point Claude proposes from another: the words it stands on. */
export const proposedPointId = (source: Pick<RiskSource, 'path' | 'quote'>): string =>
  shortHash(`${source.path}\n${source.quote.replace(/\s+/g, ' ').trim().toLowerCase()}`)

function idOf(register: OpenPointRegister, point: NewOpenPoint, today: string): string {
  if (point.origin === 'claude' && point.source) return proposedPointId(point.source)
  if (point.signal) return shortHash(`signal\n${point.signal.key}`)
  return shortHash(`${today}\n${clean(point.title, MAX_POINT_TITLE)}\n${register.points.length}`)
}

const keepRecent = (points: OpenPoint[]): OpenPoint[] => {
  if (points.length <= MAX_OPEN_POINTS) return points
  const open = points.filter((point) => point.state === 'open')
  const closed = points
    .filter((point) => point.state !== 'open')
    .sort((a, b) => (a.closedOn ?? '').localeCompare(b.closedOn ?? ''))
  return [...closed.slice(-Math.max(0, MAX_OPEN_POINTS - open.length)), ...open]
}

/**
 * The register with one more point. A point without a title is not one; a point already there
 * (the same signal, the same words) is not opened twice, and one the PM dropped stays dropped.
 */
export function addOpenPoint(
  register: OpenPointRegister,
  input: NewOpenPoint,
  today: string,
): OpenPointRegister {
  const title = clean(input.title, MAX_POINT_TITLE)
  const id = idOf(register, input, today)
  const known = register.points.find((point) => point.id === id)
  if (title === '' || (known && (known.state !== 'resolved' || input.origin === 'claude'))) {
    return register
  }
  const point: OpenPoint = {
    id,
    title,
    owner: clean(input.owner ?? '', MAX_POINT_OWNER),
    openedOn: today,
    due: dayOrNull(input.due),
    state: 'open',
    origin: input.origin,
    source: input.source ?? null,
    signalKey: input.signal?.key ?? null,
    signalKind: input.signal?.kind ?? null,
    meeting: input.meeting ?? null,
    closedOn: null,
    closedBy: null,
    closing: null,
    history: [],
    check: null,
  }
  return {
    ...register,
    points: keepRecent([...register.points.filter((kept) => kept.id !== id), point]),
  }
}

export type OpenPointChange = {
  title?: string
  owner?: string
  due?: string | null
  state?: OpenPointState
  meeting?: string | null
}

const closed = (
  point: OpenPoint,
  state: OpenPointState,
  by: OpenPointCloser,
  today: string,
  closing: RiskSource | null = null,
): OpenPoint =>
  state === 'open'
    ? { ...point, state, closedOn: null, closedBy: null, closing: null, check: null }
    : { ...point, state, closedOn: today, closedBy: by, closing, check: null }

/** The register with what the PM changed of a point: its word comes before any other. */
export function updateOpenPoint(
  register: OpenPointRegister,
  id: string,
  change: OpenPointChange,
  today: string,
): OpenPointRegister {
  return {
    ...register,
    points: register.points.map((point) => {
      if (point.id !== id) return point
      const title = change.title === undefined ? '' : clean(change.title, MAX_POINT_TITLE)
      const edited: OpenPoint = {
        ...point,
        ...(title === '' ? {} : { title }),
        ...(change.owner === undefined ? {} : { owner: clean(change.owner, MAX_POINT_OWNER) }),
        ...(change.due === undefined ? {} : { due: dayOrNull(change.due) }),
        ...(change.meeting === undefined ? {} : { meeting: change.meeting }),
      }
      return change.state === undefined || change.state === point.state
        ? edited
        : closed(edited, change.state, 'pm', today)
    }),
  }
}

const STAYS_WORDS: Readonly<Record<PointCheckReason, string>> = {
  unverified: 'non confermato dal PM, resta in coda',
  not_recorded: 'riunione non registrata, resta in coda',
}

const withNote = (point: OpenPoint, note: OpenPointNote): OpenPoint => ({
  ...point,
  history: [...point.history, note].slice(-MAX_POINT_HISTORY),
})

/** The answer of the PM to what a point waits for: it is closed, or it stays in the queue. */
export function answerPointCheck(
  register: OpenPointRegister,
  id: string,
  resolved: boolean,
  today: string,
): OpenPointRegister {
  return {
    ...register,
    points: register.points.map((point) => {
      if (point.id !== id || point.check === null) return point
      if (resolved) return closed(point, 'resolved', 'pm', today)
      // The answer is kept: the same meeting is not asked about a second time.
      const { check } = point
      const about = check.why === 'not_recorded' ? (check.meeting ?? '') : check.text
      const text = `${about}: ${STAYS_WORDS[check.why]}`.slice(0, MAX_POINT_NOTE)
      return withNote({ ...point, check: null }, { day: check.day, text, source: null })
    }),
  }
}

/**
 * The register with the points closed whose signal went away: the mail was answered, the hours
 * add up. A signal of a kind that could not be told now, or that ends with its day, closes
 * nothing.
 */
export function settleBySignals(
  register: OpenPointRegister,
  items: readonly TodayItem[],
  unsettled: ReadonlySet<TodayKind>,
  today: string,
): OpenPointRegister {
  const there = new Set(items.flatMap((item) => [item.key, ...(item.formerKeys ?? [])]))
  const gone = (point: OpenPoint): boolean =>
    point.state === 'open' &&
    point.signalKey !== null &&
    point.signalKind !== null &&
    !there.has(point.signalKey) &&
    !unsettled.has(point.signalKind) &&
    !TIMED_KINDS.includes(point.signalKind)
  if (!register.points.some(gone)) return register
  return {
    ...register,
    points: register.points.map((point) =>
      gone(point) ? closed(point, 'resolved', 'signal', today) : point,
    ),
  }
}

/** What Claude read of a point in the meetings of a day; the code has looked for the words. */
export type ClosingVerdict = {
  id: string
  outcome: 'resolved' | 'open'
  /** What was said of it, in a line. */
  said: string
  source: RiskSource
  /** The meeting the words are of, as it is called; null when not known. */
  meeting: string | null
}

/** A point Claude read being opened in a meeting, with the words that open it. */
export type ProposedPoint = {
  title: string
  owner: string
  due: string | null
  source: RiskSource
  /** The series of the meeting, by the id of its invitation; null when not known. */
  meeting: string | null
}

export type DayClosingResult = {
  /** The day the closing is of, `YYYY-MM-DD`. */
  day: string
  at: string
  model: string | null
  /** The recorded meetings read, by their id. */
  read: readonly string[]
  verdicts: readonly ClosingVerdict[]
  points: readonly ProposedPoint[]
}

/**
 * The register as if a recorded meeting had never been of the project: the points opened from
 * its files go, those its words closed are open again, what it said of the others is taken off,
 * and it is no longer among the meetings read. The same register when it holds nothing of it.
 */
export function forgetMeeting(
  register: OpenPointRegister,
  meetingId: string,
  folder: string,
): OpenPointRegister {
  const inside = (source: RiskSource | null): boolean =>
    source?.path.startsWith(`${folder}/`) ?? false
  let changed = register.readMeetings.includes(meetingId)
  const points = register.points.flatMap((point): OpenPoint[] => {
    if (inside(point.source)) {
      changed = true
      return []
    }
    const history = point.history.filter((note) => !inside(note.source))
    const reopened = inside(point.closing)
    if (!reopened && history.length === point.history.length) return [point]
    changed = true
    return [
      reopened
        ? { ...point, history, state: 'open', closedOn: null, closedBy: null, closing: null }
        : { ...point, history },
    ]
  })
  if (!changed) return register
  return {
    ...register,
    points,
    readMeetings: register.readMeetings.filter((id) => id !== meetingId),
  }
}

/** Recorded meetings remembered as read at most: the oldest go first. */
export const MAX_READ_MEETINGS = 500

/**
 * The register after the meetings of a day were read. A point is closed only on words the code
 * found in the file; read closed on words it did not find, it waits for the PM. A point talked
 * about and not closed stays in the queue, with what was said. A new point enters only with
 * words found. Claude never drops a point, and never touches one the PM closed.
 */
export function applyClosing(
  register: OpenPointRegister,
  result: DayClosingResult,
): OpenPointRegister {
  const verdicts = new Map<string, ClosingVerdict>()
  for (const verdict of result.verdicts) {
    if (!verdicts.has(verdict.id)) verdicts.set(verdict.id, verdict)
  }
  const points = register.points.map((point): OpenPoint => {
    const verdict = verdicts.get(point.id)
    if (!verdict || point.state !== 'open') return point
    const said = clean(verdict.said, MAX_POINT_NOTE)
    if (verdict.outcome === 'resolved') {
      return verdict.source.verified
        ? closed(point, 'resolved', 'claude', result.day, verdict.source)
        : {
            ...point,
            check: { day: result.day, why: 'unverified', text: said, meeting: verdict.meeting },
          }
    }
    if (said === '') return point
    const source = verdict.source.verified ? verdict.source : null
    return withNote(point, { day: result.day, text: said, source })
  })
  let next: OpenPointRegister = {
    ...register,
    points,
    readMeetings: [...new Set([...register.readMeetings, ...result.read])].slice(
      -MAX_READ_MEETINGS,
    ),
    closedDay: result.day,
    closedAt: result.at,
    closedBy: result.model,
  }
  for (const proposed of result.points) {
    if (!proposed.source.verified) continue
    next = addOpenPoint(next, { ...proposed, origin: 'claude' }, result.day)
  }
  return next
}

/** What of a recorded meeting tells when it was held. */
export type RecordedTime = { started: string; minutes: number }

const MINUTE_MS = 60 * 1000
/** How long a meeting of the calendar is taken to last when its invitation does not say. */
const DEFAULT_MEETING_MS = 60 * MINUTE_MS

/** The end of a meeting of the calendar, as an instant in milliseconds. */
export const meetingEnd = (meeting: Pick<DayMeeting, 'start' | 'end'>): number =>
  meeting.end === null ? Date.parse(meeting.start) + DEFAULT_MEETING_MS : Date.parse(meeting.end)

/** Whether a recording was made while a meeting of the calendar was held. */
export function recordedDuring(
  meeting: Pick<DayMeeting, 'start' | 'end'>,
  recorded: RecordedTime,
): boolean {
  const from = Date.parse(recorded.started)
  const to = from + Math.max(recorded.minutes, 1) * MINUTE_MS
  return Date.parse(meeting.start) < to && from < meetingEnd(meeting)
}

/**
 * The register with a question on every open point whose meeting was held and not recorded:
 * there is nothing to read, so the PM is asked whether it was closed there. `held` are the
 * meetings already over. A point opened that very day, one already asked about, and one a word
 * was kept on since are left alone. Of several meetings a point is asked about the last one:
 * the answer holds for those before it.
 */
export function checkUnrecorded(
  register: OpenPointRegister,
  held: readonly DayMeeting[],
  recorded: readonly RecordedTime[],
  dayOf: (instant: Date) => string,
): OpenPointRegister {
  const asked = new Map<string, PointCheck>()
  const latestFirst = [...held].sort((a, b) => Date.parse(b.start) - Date.parse(a.start))
  for (const meeting of latestFirst) {
    if (recorded.some((recording) => recordedDuring(meeting, recording))) continue
    const day = dayOf(new Date(meeting.start))
    for (const point of pointsFor(register.points, meeting)) {
      const known =
        point.check !== null ||
        point.openedOn >= day ||
        point.history.some((note) => note.day >= day)
      if (!known && !asked.has(point.id)) {
        asked.set(point.id, { day, why: 'not_recorded', text: '', meeting: meeting.subject })
      }
    }
  }
  if (asked.size === 0) return register
  return {
    ...register,
    points: register.points.map((point) => {
      const check = asked.get(point.id)
      return check ? { ...point, check } : point
    }),
  }
}

/** A point in the brief of the morning: what the register says of it, and what today adds. */
export type BriefPoint = {
  point: OpenPoint
  /** Opened since the working day before: not yet in yesterday's queue. */
  fresh: boolean
  /** Days past the day it is due by; 0 when not past, or without a day. */
  overdueDays: number
  /** Working days it has been open. */
  openWorkdays: number
  /** The meeting of today it can be closed in: of its series, or with whose it is. */
  raiseAt: Pick<DayMeeting, 'uid' | 'subject' | 'start'> | null
}

/** What the PM reads at the opening of the day about the points left open. */
export type PointBrief = {
  /** The working day before today: «yesterday», Friday on a Monday. */
  since: string
  /** The open points, those past their day first, then those due, then the oldest. */
  queued: BriefPoint[]
  /** Those closed since that day, the last closed first. */
  closed: OpenPoint[]
  /** Those that wait for a word of the PM. */
  toConfirm: OpenPoint[]
}

const DAY_MS = 24 * 60 * 60 * 1000
const daysFrom = (from: string, to: string): number =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS)

const normalizedName = (name: string): string[] =>
  name
    .replace(/<[^<>]*>/g, ' ')
    .toLowerCase()
    .split(/[^\p{L}]+/u)
    .filter((word) => word.length > 1)

/** Whether a person is among those a meeting invites: every word of the name is in one of them. */
export function attends(owner: string, attendees: readonly string[]): boolean {
  const words = normalizedName(owner)
  if (words.length === 0) return false
  return attendees.some((attendee) => {
    const invited = new Set(normalizedName(attendee))
    return words.every((word) => invited.has(word))
  })
}

/** The points a meeting is the place for: those of its series, and those of who is invited. */
export function pointsFor(
  points: readonly OpenPoint[],
  meeting: Pick<DayMeeting, 'uid' | 'attendees'>,
): OpenPoint[] {
  return points.filter(
    (point) =>
      point.state === 'open' &&
      (point.meeting === meeting.uid ||
        (point.meeting === null && attends(point.owner, meeting.attendees))),
  )
}

/**
 * The brief of the morning, composed by the code from the register: what is in the queue, what
 * was closed since the working day before, what waits for a word. `now` leaves out the meetings
 * already held as places to close a point in.
 */
export function pointBrief(
  register: OpenPointRegister,
  today: string,
  since: string,
  meetings: readonly DayMeeting[],
  now: Date,
): PointBrief {
  const ahead = meetings.filter((meeting) => Date.parse(meeting.start) > now.getTime())
  const queued = register.points
    .filter((point) => point.state === 'open')
    .map((point): BriefPoint => {
      const place = ahead.find((meeting) => pointsFor([point], meeting).length > 0)
      return {
        point,
        fresh: point.openedOn >= since,
        overdueDays: point.due !== null && point.due < today ? daysFrom(point.due, today) : 0,
        openWorkdays: workdaysBetween(point.openedOn, today),
        raiseAt: place ? { uid: place.uid, subject: place.subject, start: place.start } : null,
      }
    })
    .sort(
      (a, b) =>
        b.overdueDays - a.overdueDays ||
        (a.point.due ?? '9999').localeCompare(b.point.due ?? '9999') ||
        a.point.openedOn.localeCompare(b.point.openedOn) ||
        a.point.id.localeCompare(b.point.id),
    )
  return {
    since,
    queued,
    closed: register.points
      .filter((point) => point.state === 'resolved' && (point.closedOn ?? '') >= since)
      .sort((a, b) => (b.closedOn ?? '').localeCompare(a.closedOn ?? '')),
    toConfirm: register.points.filter((point) => point.state === 'open' && point.check !== null),
  }
}

/** How many points ask something of the PM today: past their day, or waiting for a word. */
export const pointsCount = (brief: PointBrief): number =>
  brief.queued.filter((entry) => entry.overdueDays > 0 || entry.point.check !== null).length

const italianDay = (value: string): string => value.split('-').reverse().join('/')
const CLOSER_WORDS: Readonly<Record<OpenPointCloser, string>> = {
  pm: 'dal PM',
  claude: 'da quanto detto in riunione',
  signal: 'da solo: il dato da cui era nato è cambiato',
}
/** The closed points written in the text of the project: the last ones, not the whole past. */
const CLOSED_IN_FILE = 30

function pointLines(point: OpenPoint): string[] {
  const facts = [
    point.owner === '' ? 'del PM' : `di ${point.owner}`,
    `aperto il ${italianDay(point.openedOn)}`,
    ...(point.due ? [`entro il ${italianDay(point.due)}`] : []),
    ...(point.closedOn && point.closedBy
      ? [`chiuso il ${italianDay(point.closedOn)} ${CLOSER_WORDS[point.closedBy]}`]
      : []),
  ]
  return [
    `- **${point.title}** — ${facts.join(', ')}`,
    ...(point.source ? [`  - Fonte: \`${point.source.path}\`: «${point.source.quote}»`] : []),
    ...(point.closing ? [`  - Chiusura: \`${point.closing.path}\`: «${point.closing.quote}»`] : []),
    ...point.history.map((note) => `  - ${italianDay(note.day)}: ${note.text}`),
  ]
}

/**
 * The register as a text of the project: whoever answers a question or writes minutes or a
 * progress report finds what is open and what was closed, and can cite it. Dropped points are
 * not in it: the PM said they are not points.
 */
export function openPointsMarkdown(register: OpenPointRegister): string {
  const lines = ['# Open point del progetto', '']
  lines.push('Scritto da Octo: i punti aperti e quelli chiusi. Si cambia da «Oggi».', '')
  const open = register.points.filter((point) => point.state === 'open')
  const resolved = register.points
    .filter((point) => point.state === 'resolved')
    .sort((a, b) => (b.closedOn ?? '').localeCompare(a.closedOn ?? ''))
    .slice(0, CLOSED_IN_FILE)
  for (const [title, points] of [
    ['Aperti', open],
    ['Chiusi', resolved],
  ] as const) {
    if (points.length === 0) continue
    lines.push(`## ${title}`, '', ...points.flatMap(pointLines), '')
  }
  if (open.length + resolved.length === 0) lines.push('Nessun open point.', '')
  return lines.join('\n')
}
