import { personKey } from '../hours/model.ts'
import type { TrackerHours } from '../hours/sources.ts'
import {
  type DashboardSettings,
  inScope,
  type Phase,
  phaseOf,
  type TrackerComment,
  type TrackerData,
} from './model.ts'

/** One item of a tracker kept as a register of activities: what it is, who has it, what it took. */
export type ActivityRow = {
  id: string
  type: string
  title: string
  state: string
  phase: Phase
  assignee: string | null
  /** The hours logged on the item, by anybody. */
  hours: number
  /** Its comments, the newest first: they are the diary of the activity. */
  comments: TrackerComment[]
}

/** The hours a person logged on the items in scope, against the most they are to spend. */
export type ActivityPerson = {
  person: string
  hours: number
  /** The cap of the person in hours; null when the team gives them none. */
  capHours: number | null
}

export type Activities = {
  rows: ActivityRow[]
  people: ActivityPerson[]
  /** The hours logged on the items in scope, all together. */
  hours: number
  /** Hours logged on items that are not in scope, or that the tracker no longer has. */
  otherHours: number
}

const PHASE_ORDER: Readonly<Record<Phase, number>> = { work: 0, verify: 1, validated: 2, closed: 3 }

const newestFirst = (comments: readonly TrackerComment[]): TrackerComment[] =>
  [...comments].sort((a, b) => b.at.localeCompare(a.at))

/**
 * Every item in scope, whatever its type, with the hours logged on it and its last comment: the
 * view of a tracker that holds a few activities and no bugs or sprints. What is still being
 * worked on comes first, then by the hours it took.
 */
export function trackerActivities(
  data: Pick<TrackerData, 'items'>,
  settings: Pick<DashboardSettings, 'tags' | 'phases'>,
  worklog: readonly TrackerHours[],
  /** The cap of each person in hours, by the key of the person. */
  capHours: ReadonlyMap<string, number> = new Map(),
): Activities {
  const items = data.items.filter((item) => inScope(item.tags, settings))
  const known = new Set(items.map((item) => item.id))
  const byItem = new Map<string, number>()
  const byPerson = new Map<string, ActivityPerson>()
  let hours = 0
  let otherHours = 0
  for (const entry of worklog) {
    if (!known.has(entry.issue)) {
      otherHours += entry.hours
      continue
    }
    hours += entry.hours
    byItem.set(entry.issue, (byItem.get(entry.issue) ?? 0) + entry.hours)
    const key = personKey(entry.person)
    const person = byPerson.get(key) ?? {
      person: entry.person,
      hours: 0,
      capHours: capHours.get(key) ?? null,
    }
    person.hours += entry.hours
    byPerson.set(key, person)
  }
  const rows = items
    .map(
      (item): ActivityRow => ({
        id: item.id,
        type: item.type,
        title: item.title,
        state: item.state,
        phase: phaseOf(item.state, settings),
        assignee: item.assignee,
        hours: byItem.get(item.id) ?? 0,
        comments: newestFirst(item.comments),
      }),
    )
    .sort(
      (a, b) =>
        PHASE_ORDER[a.phase] - PHASE_ORDER[b.phase] ||
        b.hours - a.hours ||
        a.id.localeCompare(b.id, 'en', { numeric: true }),
    )
  const people = [...byPerson.values()].sort(
    (a, b) => b.hours - a.hours || a.person.localeCompare(b.person, 'it'),
  )
  return { rows, people, hours, otherHours }
}

/** The types the items of a tracker have, the most frequent first: what the PM chooses among. */
export function trackerTypes(
  data: Pick<TrackerData, 'items'>,
): Array<{ type: string; count: number }> {
  const counts = new Map<string, number>()
  for (const item of data.items) {
    if (item.type !== '') counts.set(item.type, (counts.get(item.type) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([type, count]) => ({ type, count }))
    .sort((a, b) => b.count - a.count || a.type.localeCompare(b.type, 'en'))
}
