import type { DayMeeting } from '../mail/thread.ts'
import type { StoredMeeting } from '../meetings/model.ts'
import { meetingKey } from './mail-signals.ts'
import type { TodayItem, TodayKind } from './model.ts'
import { type BriefPoint, type OpenPoint, pointsFor, recordedDuring } from './open-points.ts'

/** What Claude says to bring to a meeting, with the words it stands on, checked by the code. */
export type PrepNote = {
  /** The key of the meeting. */
  key: string
  text: string
  path: string
  quote: string
  verified: boolean
}

/** The last time a meeting of the series was recorded. */
export type LastRecording = {
  title: string
  started: string
  /** Its folder, inside the project folder. */
  folder: string
  /** The file to read first: the report, or the notes, or the transcript; null when none. */
  file: string | null
  /** The points opened there and still open, and those closed there. */
  opened: OpenPoint[]
  closed: OpenPoint[]
}

/** What the PM takes to a meeting of the day, put together by the code. */
export type MeetingPrep = {
  key: string
  /** The open points to bring: those of the series, and those of who is invited. */
  points: BriefPoint[]
  last: LastRecording | null
  /** The mail of who is invited that waits: for the PM, or for them. */
  mails: TodayItem[]
  /** For a meeting on how the project goes: what the tracker shows. */
  numbers: TodayItem[]
  /** What Claude says to bring, when it was asked today: only what the code found. */
  bring: PrepNote[]
}

/** Notes Claude gives on a meeting at most: a card is read in a minute. */
export const MAX_PREP_NOTES = 5
/** The meetings Claude prepares in one run at most. */
export const MAX_MEETINGS_PER_PREP = 6
/** Mail of who is invited shown in a card at most. */
export const MAX_PREP_MAILS = 5
/** How far back the last recording of a series is looked for. */
export const LAST_RECORDING_DAYS = 60

const DAY_MS = 24 * 60 * 60 * 1000
const ADDRESS = /[^\s<>,;"]+@[^\s<>,;"]+/g
/** A meeting whose name says it is about how the project goes. */
const PROGRESS_MEETING = /\b(sal|stato|avanzamento|status|sprint|review|stand-?up|daily)\b/i
const NUMBER_KINDS: readonly TodayKind[] = ['bugs_stuck', 'requirements', 'tracker_old']

const addressesOf = (text: string): string[] =>
  (text.match(ADDRESS) ?? []).map((address) => address.toLowerCase())

const normalizedTitle = (title: string): string =>
  title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()

/**
 * The last recording of the series a meeting is of, before the meeting: one made while a time of
 * the series was held, or, when the calendar does not tell, one called the same.
 */
export function lastRecordingOf(
  meeting: DayMeeting,
  recorded: readonly StoredMeeting[],
  heldOn: (day: string) => readonly DayMeeting[],
  dayOf: (instant: Date) => string,
): StoredMeeting | null {
  const before = Date.parse(meeting.start)
  const earlier = recorded
    .filter((recording) => {
      const at = Date.parse(recording.started)
      return at < before && before - at <= LAST_RECORDING_DAYS * DAY_MS
    })
    .sort((a, b) => b.started.localeCompare(a.started))
  const title = normalizedTitle(meeting.subject)
  return (
    earlier.find(
      (recording) =>
        heldOn(dayOf(new Date(recording.started))).some(
          (held) => held.uid === meeting.uid && recordedDuring(held, recording),
        ) ||
        (title !== '' && normalizedTitle(recording.title) === title),
    ) ?? null
  )
}

const within = (path: string | undefined, folder: string): boolean =>
  path?.startsWith(`${folder}/`) ?? false

/** The mail a signal is about, by the address of the other side. */
function mailAddresses(item: TodayItem): string[] {
  const { facts } = item
  if (facts.kind === 'mail_reply' || facts.kind === 'mail_follow') return addressesOf(facts.from)
  if (facts.kind === 'mail_waiting') return addressesOf(facts.to)
  return []
}

export type PrepInput = {
  /** The open points, as the brief of the morning tells them. */
  points: readonly BriefPoint[]
  /** Every point of the register: what a recording opened or closed is looked for among them. */
  allPoints: readonly OpenPoint[]
  /** The last recording of the series, with the file to read first; null when there is none. */
  last: (Pick<StoredMeeting, 'title' | 'started' | 'folder'> & { file: string | null }) | null
  /** The signals of the page after the PM's decisions. */
  items: readonly TodayItem[]
  /** The addresses of the PM: their own mail is not the mail of who is invited. */
  own: readonly string[]
  notes: readonly PrepNote[]
}

/**
 * What the PM takes to a meeting: the points to close there, what was left the last time, the
 * mail of who is invited that waits, the numbers for a meeting on how the project goes, and
 * what Claude adds. Everything but the last is told by the code.
 */
export function meetingPrep(meeting: DayMeeting, input: PrepInput): MeetingPrep {
  const key = meetingKey(meeting)
  const mine = new Set(input.own.map((address) => address.toLowerCase()))
  const invited = new Set(
    meeting.attendees.flatMap(addressesOf).filter((address) => !mine.has(address)),
  )
  const open = new Set(
    pointsFor(
      input.points.map((entry) => entry.point),
      meeting,
    ).map((point) => point.id),
  )
  const folder = input.last?.folder ?? null
  return {
    key,
    points: input.points.filter((entry) => open.has(entry.point.id)),
    last:
      input.last === null || folder === null
        ? null
        : {
            ...input.last,
            opened: input.allPoints.filter(
              (point) => point.state === 'open' && within(point.source?.path, folder),
            ),
            closed: input.allPoints.filter(
              (point) => point.state === 'resolved' && within(point.closing?.path, folder),
            ),
          },
    mails: input.items
      .filter((item) => mailAddresses(item).some((address) => invited.has(address)))
      .slice(0, MAX_PREP_MAILS),
    numbers: PROGRESS_MEETING.test(meeting.subject)
      ? input.items.filter((item) => NUMBER_KINDS.includes(item.facts.kind))
      : [],
    bring: input.notes.filter((note) => note.key === key && note.verified).slice(0, MAX_PREP_NOTES),
  }
}

/**
 * How many things a card holds, each once: a point opened the last time that is also among those
 * to bring is one thing. A meeting with none has nothing to bring.
 */
export function prepCount(prep: MeetingPrep): number {
  const brought = new Set(prep.points.map((entry) => entry.point.id))
  const left = (prep.last?.opened ?? []).filter((point) => !brought.has(point.id))
  return prep.points.length + prep.mails.length + prep.bring.length + left.length
}

/** Minutes before a meeting at which the PM is told about it. */
export const MEETING_NOTICE_MINUTES = 15
const MINUTE_MS = 60 * 1000

/**
 * The meetings to tell the PM about before they start, each with how long from now: those that
 * start within the time looked ahead and have not started. One about to start is told at once.
 */
export function meetingNotices(
  meetings: readonly DayMeeting[],
  now: Date,
  aheadMs: number,
): Array<{ meeting: DayMeeting; inMs: number }> {
  return meetings.flatMap((meeting) => {
    const toStart = Date.parse(meeting.start) - now.getTime()
    const inMs = toStart - MEETING_NOTICE_MINUTES * MINUTE_MS
    return toStart > 0 && inMs <= aheadMs ? [{ meeting, inMs: Math.max(0, inMs) }] : []
  })
}
