import { phraseIn } from '../mail/match.ts'
import type { RecordedMeeting } from './model.ts'

/** When a meeting of the calendar is: an invitation the mail of a project holds. */
export type MeetingInvite = { uid: string; start: string; end: string | null }

/** What a project offers to recognise a meeting as its own. */
export type MeetingCandidate = {
  projectId: string
  invites: readonly MeetingInvite[]
  keywords: readonly string[]
}

/** How long a meeting of the calendar is taken to last when its invitation does not say. */
const DEFAULT_INVITE_MS = 60 * 60 * 1000
const SECOND_MS = 1000

/** The words that name a project: its name, and the words its mail is chosen by. */
export function projectKeywords(name: string, mailKeywords: readonly string[]): string[] {
  const words = [name, ...mailKeywords.filter((keyword) => !keyword.includes('@'))]
  return [...new Set(words.map((word) => word.trim()).filter((word) => word !== ''))]
}

/**
 * The project a recorded meeting belongs to, or null when it cannot be told. First the only
 * project whose mail holds the invitation to the very event Verbale names, whatever its day: a
 * meeting that repeats is invited once. Then the projects whose calendar has a meeting at that
 * time; then, among them or among all when there is none,
 * those named in the title or in the notes. A meeting two projects could claim is of neither:
 * it is never given by chance.
 */
export function meetingOwner(
  meeting: RecordedMeeting,
  notes: string,
  candidates: readonly MeetingCandidate[],
): string | null {
  const from = Date.parse(meeting.started)
  const to = from + Math.max(meeting.durationSeconds, 1) * SECOND_MS
  const overlaps = (invite: MeetingInvite): boolean => {
    const start = Date.parse(invite.start)
    const end = invite.end === null ? start + DEFAULT_INVITE_MS : Date.parse(invite.end)
    return start < to && from < end
  }
  const called = candidates.filter((candidate) =>
    candidate.invites.some((invite) => invite.uid === meeting.calendarEventUID),
  )
  if (called.length === 1) return called[0]?.projectId ?? null
  const invited = candidates.filter((candidate) => candidate.invites.some(overlaps))
  if (invited.length === 1) return invited[0]?.projectId ?? null
  const text = `${meeting.title}\n${notes}`
  const named = (invited.length > 1 ? invited : candidates).filter((candidate) =>
    candidate.keywords.some((keyword) => phraseIn(text, keyword)),
  )
  return named.length === 1 ? (named[0]?.projectId ?? null) : null
}
