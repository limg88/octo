import { htmlToText } from '../shared/html.ts'
import { cutToCharacters } from '../shared/text.ts'
import { bad, isRecord, num, text } from '../shared/values.ts'
import { MAX_DESCRIPTION } from './items.ts'

export { inPool } from '../shared/pool.ts'

/** The fields read of every work item for a snapshot of the tracker: nothing else is asked. */
export const TRACKER_FIELDS = [
  'System.Id',
  'System.WorkItemType',
  'System.Title',
  'System.State',
  'System.AssignedTo',
  'System.AreaPath',
  'System.IterationPath',
  'System.Tags',
  'System.CreatedDate',
  'System.Parent',
  'System.CommentCount',
  'System.Description',
  'Microsoft.VSTS.Common.StateChangeDate',
  'Microsoft.VSTS.Common.Severity',
  'Microsoft.VSTS.Common.AcceptanceCriteria',
] as const

/** Updates and comments asked per page. */
export const TRACKER_PAGE_SIZE = 200
/** Pages of the updates of one work item read at most. */
export const MAX_UPDATE_PAGES = 50

export interface AdoTrackerComment {
  by: string
  date: string
  text: string
}

/**
 * A work item as a snapshot of the tracker holds it. The names are those of the export the
 * dashboard already reads, so a snapshot read here and one written by a script are the same file.
 */
export interface AdoTrackerItem {
  id: number
  type: string
  title: string
  state: string
  tags: string[]
  assigned_to: string | null
  created_date: string | null
  state_change_date: string | null
  severity: string | null
  /** The planning period and the sprint, from the iteration path. */
  pi: string | null
  sprint: string | null
  parent: number | null
  description: string
  acceptance_criteria: string
  discussion: AdoTrackerComment[]
}

/** What a work item went through: `[date, value]` pairs, in the order they happened. */
export interface AdoTrackerHistory {
  created: string | null
  states: Array<[string, string]>
  tags: Array<[string, string]>
}

export interface AdoTrackerSnapshot {
  /** The instant the answer of the tracker holds. */
  exportedAt: string
  items: AdoTrackerItem[]
  /** By work item id, for the types the history was asked of. */
  history: Record<string, AdoTrackerHistory>
}

/** A work item of a snapshot with what the reading needs and the file does not keep. */
export interface ReadTrackerItem {
  item: AdoTrackerItem
  areaPath: string
  iterationPath: string
  commentCount: number
}

const dateText = (value: unknown): string | null =>
  typeof value === 'string' && !Number.isNaN(Date.parse(value)) ? value : null

const plain = (value: unknown): string =>
  typeof value === 'string' ? cutToCharacters(htmlToText(value), MAX_DESCRIPTION) : ''

const nameOf = (value: unknown): string | null =>
  isRecord(value) ? text(value.displayName)?.trim() || null : null

/**
 * The planning period and the sprint of an iteration path: the first and the second level under
 * the project (`Project\PI7\Sprint 28\…` gives `PI7` and `Sprint 28`).
 */
export function planningOf(iterationPath: string): { pi: string | null; sprint: string | null } {
  const [, pi, sprint] = iterationPath.split('\\').map((part) => part.trim())
  return { pi: pi || null, sprint: sprint || null }
}

/** A work item of a `workitemsbatch` answer; a value that is not one is a bad response. */
export function trackerItemOf(raw: unknown): ReadTrackerItem {
  if (!isRecord(raw) || !isRecord(raw.fields)) return bad()
  const fields = raw.fields
  const id = num(raw.id)
  if (id === null || !Number.isInteger(id) || id <= 0) return bad()
  const iterationPath = text(fields['System.IterationPath']) ?? ''
  const parent = num(fields['System.Parent'])
  return {
    areaPath: text(fields['System.AreaPath']) ?? '',
    iterationPath,
    commentCount: num(fields['System.CommentCount']) ?? 0,
    item: {
      id,
      type: text(fields['System.WorkItemType']) ?? '',
      title: (text(fields['System.Title']) ?? '').trim(),
      state: text(fields['System.State']) ?? '',
      tags: (text(fields['System.Tags']) ?? '')
        .split(';')
        .map((tag) => tag.trim())
        .filter((tag) => tag !== ''),
      assigned_to: nameOf(fields['System.AssignedTo']),
      created_date: dateText(fields['System.CreatedDate']),
      state_change_date: dateText(fields['Microsoft.VSTS.Common.StateChangeDate']),
      severity: text(fields['Microsoft.VSTS.Common.Severity']) ?? null,
      ...planningOf(iterationPath),
      parent: parent !== null && Number.isInteger(parent) ? parent : null,
      description: plain(fields['System.Description']),
      acceptance_criteria: plain(fields['Microsoft.VSTS.Common.AcceptanceCriteria']),
      discussion: [],
    },
  }
}

const newValue = (fields: Record<string, unknown>, name: string): unknown =>
  isRecord(fields[name]) ? (fields[name] as Record<string, unknown>).newValue : undefined

/**
 * The changes of state and of tags in one page of the updates of a work item, added to its
 * history. Returns how many updates the page held: fewer than asked means it was the last.
 */
export function addUpdates(history: AdoTrackerHistory, json: unknown): number {
  if (!isRecord(json) || !Array.isArray(json.value)) return bad()
  for (const update of json.value) {
    if (!isRecord(update)) return bad()
    if (!isRecord(update.fields)) continue
    const fields = update.fields
    // The last revision carries a date far in the future: the change date of the update is right.
    const at = dateText(newValue(fields, 'System.ChangedDate')) ?? dateText(update.revisedDate)
    history.created ??= dateText(newValue(fields, 'System.CreatedDate'))
    if (at === null) continue
    const state = newValue(fields, 'System.State')
    if (typeof state === 'string') history.states.push([at, state])
    if ('System.Tags' in fields)
      history.tags.push([at, text(newValue(fields, 'System.Tags')) ?? ''])
  }
  return json.value.length
}

/** The comments of a page, as given (newest first), each in plain text. */
export function commentsOf(json: unknown): AdoTrackerComment[] {
  if (!isRecord(json) || !Array.isArray(json.comments)) return bad()
  return json.comments.flatMap((comment) => {
    if (!isRecord(comment)) return bad()
    const date = dateText(comment.createdDate)
    return date === null
      ? []
      : [{ by: nameOf(comment.createdBy) ?? '', date, text: plain(comment.text) }]
  })
}
