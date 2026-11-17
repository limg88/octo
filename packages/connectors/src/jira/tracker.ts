import type { AdoTrackerComment, AdoTrackerHistory } from '../ado/tracker.ts'
import { bad, isRecord, text } from '../shared/values.ts'
import type { Issue } from './issues.ts'

/** The field of the instant an issue last moved to another category of states. */
export const STATE_CHANGE_FIELD = 'statuscategorychangedate'

/** Changes of an issue asked per page. */
export const CHANGELOG_PAGE_SIZE = 100
/** Pages of the changes of one issue read at most. */
export const MAX_CHANGELOG_PAGES = 50

/** The fields of a change that the history of an issue keeps. */
const STATUS_FIELD = 'status'
const LABELS_FIELD = 'labels'
/** How the labels of an issue are written in one text: as the dashboard reads tags. */
const TAG_SEPARATOR = '; '

/**
 * An issue as a snapshot of the tracker holds it. The names are those of the export the dashboard
 * already reads, so a snapshot of Jira and one of Azure DevOps are the same file: only the id is
 * the key of the issue, and Jira has no planning period.
 */
export interface JiraTrackerItem {
  id: string
  type: string
  title: string
  state: string
  tags: string[]
  assigned_to: string | null
  created_date: string | null
  state_change_date: string | null
  severity: string | null
  pi: null
  sprint: string | null
  parent: string | null
  description: string
  /** Jira has no field for them: null says so, where an empty text would say they are missing. */
  acceptance_criteria: null
  discussion: AdoTrackerComment[]
}

export interface JiraTrackerSnapshot {
  /** The instant the answer of the tracker holds. */
  exportedAt: string
  items: JiraTrackerItem[]
  /** By issue key, for the types the history was asked of. */
  history: Record<string, AdoTrackerHistory>
}

const dateText = (value: unknown): string | null =>
  typeof value === 'string' && !Number.isNaN(Date.parse(value))
    ? new Date(value).toISOString()
    : null

/** The instant an issue of a search answer last changed category of states; null when not said. */
export function stateChangeOf(raw: unknown): string | null {
  return isRecord(raw) && isRecord(raw.fields) ? dateText(raw.fields[STATE_CHANGE_FIELD]) : null
}

/** An issue as an item of the snapshot; `stateChangedAt` is what the search said of its state. */
export function trackerItemOf(issue: Issue, stateChangedAt: string | null): JiraTrackerItem {
  return {
    id: issue.key,
    type: issue.type,
    title: issue.summary,
    state: issue.status,
    tags: [...issue.labels],
    assigned_to: issue.assignee?.displayName ?? null,
    created_date: issue.createdAt?.toISOString() ?? null,
    state_change_date: stateChangedAt,
    severity: issue.priority,
    pi: null,
    sprint: issue.sprint,
    parent: issue.parentKey,
    description: issue.description ?? '',
    acceptance_criteria: null,
    discussion: issue.comments.flatMap((comment) =>
      comment.createdAt === null
        ? []
        : [
            {
              by: comment.author?.displayName ?? '',
              date: comment.createdAt.toISOString(),
              text: comment.text,
            },
          ],
    ),
  }
}

/**
 * A change of one field: what it was and what it became, as texts; for a state, also the ids
 * Jira gives the two states, which do not change with the language the names are written in.
 */
type FieldChange = { at: string; from: string; to: string; fromId?: string; toId?: string }

/** The id Jira gives the state an issue of a search answer is in; null when not said. */
export function statusIdOf(raw: unknown): string | null {
  const status = isRecord(raw) && isRecord(raw.fields) ? raw.fields.status : null
  return isRecord(status) ? text(status.id) : null
}

/** The labels of a change, which Jira writes with spaces between, as the tags of the dashboard. */
const tagsText = (labels: string): string =>
  labels
    .split(/\s+/)
    .filter((label) => label !== '')
    .join(TAG_SEPARATOR)

export interface ChangelogPage {
  states: FieldChange[]
  tags: FieldChange[]
  /** How many changes the page held, and how many the issue has. */
  read: number
  total: number
}

/** The changes of state and of labels in one page of the changelog of an issue. */
export function changelogPageOf(json: unknown): ChangelogPage {
  if (!isRecord(json) || !Array.isArray(json.values)) return bad()
  const page: ChangelogPage = {
    states: [],
    tags: [],
    read: json.values.length,
    total: typeof json.total === 'number' ? json.total : json.values.length,
  }
  for (const change of json.values) {
    if (!isRecord(change)) return bad()
    const at = dateText(change.created)
    if (at === null || !Array.isArray(change.items)) continue
    for (const item of change.items) {
      if (!isRecord(item)) continue
      const values = { at, from: text(item.fromString) ?? '', to: text(item.toString) ?? '' }
      if (item.field === STATUS_FIELD) {
        const fromId = text(item.from)
        const toId = text(item.to)
        page.states.push({ ...values, ...(fromId ? { fromId } : {}), ...(toId ? { toId } : {}) })
      }
      if (item.field === LABELS_FIELD) page.tags.push(values)
    }
  }
  return page
}

const byInstant = (a: FieldChange, b: FieldChange): number => Date.parse(a.at) - Date.parse(b.at)

/**
 * What an issue went through, from the changes of its changelog. The changelog tells the changes
 * only: the state the issue was born in is what its first change left, or the state it has now
 * when it never changed. The same holds for its labels. The changelog names a state in the
 * language of the site and an issue in the language of who reads: with `stateNames`, the names
 * the issues carry by the id of the state, every state of the history is called as the issues
 * call it, and a state never appears under two names.
 */
export function historyOf(
  item: JiraTrackerItem,
  changes: Pick<ChangelogPage, 'states' | 'tags'>,
  stateNames: ReadonlyMap<string, string> = new Map(),
): AdoTrackerHistory {
  const named = (id: string | undefined, name: string): string =>
    (id === undefined ? undefined : stateNames.get(id)) ?? name
  const states = [...changes.states].sort(byInstant).map((change) => ({
    ...change,
    from: named(change.fromId, change.from),
    to: named(change.toId, change.to),
  }))
  const tags = [...changes.tags].sort(byInstant)
  const history: AdoTrackerHistory = { created: item.created_date, states: [], tags: [] }
  if (item.created_date !== null) {
    history.states.push([item.created_date, states[0]?.from ?? item.state])
    const born = tags[0] === undefined ? item.tags.join(TAG_SEPARATOR) : tagsText(tags[0].from)
    if (born !== '') history.tags.push([item.created_date, born])
  }
  for (const change of states) history.states.push([change.at, change.to])
  for (const change of tags) history.tags.push([change.at, tagsText(change.to)])
  return history
}
