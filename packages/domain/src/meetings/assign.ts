import { personKey } from '../hours/model.ts'
import { phraseIn } from '../mail/match.ts'
import { occurrenceOn } from '../mail/recurrence.ts'
import { romeDateString } from '../rome-time.ts'
import type { RecordedMeeting } from './model.ts'

/** When a meeting of the calendar is: an invitation the mail of a project holds. */
export type MeetingInvite = {
  uid: string
  start: string
  end: string | null
  /** How it repeats, when it does: it is then at that hour on every day of its rule. */
  recurrence?: string | null
  excluded?: readonly string[]
}

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
  const day = romeDateString(new Date(meeting.started))
  const overlaps = (invite: MeetingInvite): boolean => {
    // A meeting that repeats is looked for on the day of the recording.
    const time = occurrenceOn(invite, day) ?? invite
    const start = Date.parse(time.start)
    const end = time.end === null ? start + DEFAULT_INVITE_MS : Date.parse(time.end)
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

/** The people who work on a project, as its team names them. */
export type MeetingTeam = { projectId: string; people: readonly string[] }

const ADDRESS = /<[^>]*>/g

const keysOf = (team: MeetingTeam): Set<string> =>
  new Set(team.people.map(personKey).filter((key) => key !== ''))
const presentIn = (participants: readonly string[]): Set<string> =>
  new Set(participants.map((name) => personKey(name.replace(ADDRESS, ''))))

/** How many of the people of a meeting are on the team of a project. */
function peopleShared(participants: readonly string[], team: MeetingTeam): number {
  const known = keysOf(team)
  return [...presentIn(participants)].filter((key) => known.has(key)).length
}

/**
 * The project a meeting is certainly of, by who took part: the only one whose team has every
 * participant known to a team. Somebody on two teams tells nothing alone, and somebody no team
 * knows (a guest) is not counted. Null when nobody is known, when the known people are spread
 * over teams none of which has them all, or when two teams have them all: then the PM is asked.
 */
export function certainProject(
  participants: readonly string[],
  teams: readonly MeetingTeam[],
): string | null {
  const keys = teams.map((team) => ({ projectId: team.projectId, known: keysOf(team) }))
  const known = [...presentIn(participants)].filter((key) =>
    keys.some((team) => team.known.has(key)),
  )
  if (known.length === 0) return null
  const whole = keys.filter((team) => known.every((key) => team.known.has(key)))
  return whole.length === 1 ? (whole[0]?.projectId ?? null) : null
}

/**
 * The project a meeting is of because one of its people took part: the only one of which that
 * can be said. `people` are those a project is told by, the PM left out. Null when no project
 * or more than one has somebody there.
 */
export function projectByPeople(
  participants: readonly string[],
  teams: readonly MeetingTeam[],
): string | null {
  const present = teams.filter((team) => peopleShared(participants, team) > 0)
  return present.length === 1 ? (present[0]?.projectId ?? null) : null
}

/**
 * The other project a meeting looks to be of, by who took part: the only one whose team has more
 * of its participants than the team of this project. Null when this project has as many, or two
 * others have the most. It is a warning for the PM, never a way to give a meeting away.
 */
export function likelierProject(
  participants: readonly string[],
  projectId: string,
  teams: readonly MeetingTeam[],
): string | null {
  const own = teams.find((team) => team.projectId === projectId)
  const mine = own ? peopleShared(participants, own) : 0
  const others = teams
    .filter((team) => team.projectId !== projectId)
    .map((team) => ({ projectId: team.projectId, shared: peopleShared(participants, team) }))
    .filter((other) => other.shared > mine)
    .sort((a, b) => b.shared - a.shared)
  const [best, next] = others
  if (best === undefined || (next !== undefined && next.shared === best.shared)) return null
  return best.projectId
}
