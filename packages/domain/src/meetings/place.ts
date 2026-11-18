import { attends } from '../attends.ts'
import { phraseIn } from '../mail/match.ts'

/** Where a meeting stands for a project: its own, of something else, or nobody can tell. */
export const MEETING_PLACES = ['project', 'other', 'unknown'] as const
export type MeetingPlace = (typeof MEETING_PLACES)[number]

/** A word on whether a meeting is of the project: the PM's, or Claude's with what it stands on. */
export type MeetingChoice = { place: MeetingPlace; by: 'pm' | 'claude'; reason: string }

/** What tells a meeting as of a project: its people, apart from the PM, and the words that name it. */
export type MeetingRule = { people: readonly string[]; keywords: readonly string[] }

/** Where a meeting was put, and by what: the PM's word, a rule of Octo, or Claude. */
export type PlacedMeeting = {
  place: MeetingPlace
  why: 'pm' | 'person' | 'keyword' | 'no_people' | 'claude' | null
  /** The sentence Claude stands on, when it was Claude. */
  reason: string
}

/** Words Claude gives for a meeting at most: a sentence, not a paragraph. */
export const MAX_MEETING_REASON = 200
/** Words on meetings kept at most: the oldest go first. */
export const MAX_MEETING_CHOICES = 500

/**
 * The people of a project a meeting is told by. The PM is in every meeting of every project they
 * run, so the PM tells nothing: `pm` is their name and their addresses.
 */
export function meetingPeople(names: readonly string[], pm: readonly string[]): string[] {
  return names.filter((name) => name.trim() !== '' && !attends(name, pm))
}

/**
 * Where a meeting stands for a project. The PM's word comes first. Then the rule: it is of the
 * project when one of its people takes part, or a word that names the project is in its title.
 * A project that names no person has nothing to tell by, and keeps every meeting as before.
 * What the rule leaves in doubt is as Claude said, when it was asked; else nobody can tell.
 */
export function placeMeeting(
  meeting: { title: string; participants: readonly string[] },
  rule: MeetingRule,
  choice: MeetingChoice | undefined,
): PlacedMeeting {
  if (choice?.by === 'pm') return { place: choice.place, why: 'pm', reason: '' }
  if (rule.people.some((person) => attends(person, meeting.participants))) {
    return { place: 'project', why: 'person', reason: '' }
  }
  if (rule.keywords.some((keyword) => phraseIn(meeting.title, keyword))) {
    return { place: 'project', why: 'keyword', reason: '' }
  }
  if (rule.people.length === 0) return { place: 'project', why: 'no_people', reason: '' }
  if (choice) return { place: choice.place, why: 'claude', reason: choice.reason }
  return { place: 'unknown', why: null, reason: '' }
}

/** The words on meetings with one more; the oldest go when they are too many. */
export function withMeetingChoice(
  choices: Readonly<Record<string, MeetingChoice>>,
  id: string,
  choice: MeetingChoice,
): Record<string, MeetingChoice> {
  const { [id]: _before, ...others } = choices
  const kept = Object.entries({ ...others, [id]: choice }).slice(-MAX_MEETING_CHOICES)
  return Object.fromEntries(
    kept.map(([key, value]) => [
      key,
      { ...value, reason: value.reason.trim().slice(0, MAX_MEETING_REASON) },
    ]),
  )
}
