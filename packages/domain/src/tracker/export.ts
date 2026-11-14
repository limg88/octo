import {
  type DashboardDecisions,
  type DashboardSettings,
  DEFAULT_DASHBOARD_SETTINGS,
  type ItemHistory,
  PHASES,
  type Phase,
  type TrackerComment,
  type TrackerItem,
} from './model.ts'

type Json = Record<string, unknown>

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const text = (value: unknown): string =>
  typeof value === 'string' ? value : typeof value === 'number' ? String(value) : ''

const textOrNull = (value: unknown): string | null => text(value).trim() || null

const isDate = (value: unknown): value is string =>
  typeof value === 'string' && !Number.isNaN(Date.parse(value))

/** Tags as a list, whether the tracker gives a list or one text with separators. */
function tagsOf(value: unknown): string[] {
  const parts = Array.isArray(value) ? value.map(text) : text(value).split(/[;,]/)
  return parts.map((tag) => tag.trim()).filter((tag) => tag !== '')
}

function commentsOf(value: unknown): TrackerComment[] {
  if (!Array.isArray(value)) return []
  return value.filter(isObject).map((comment) => ({
    by: text(comment.by),
    at: text(comment.date),
    text: text(comment.text),
  }))
}

function itemOf(value: unknown): TrackerItem | null {
  if (!isObject(value)) return null
  const id = text(value.id)
  if (id === '' || !isDate(value.created_date)) return null
  return {
    id,
    type: text(value.type),
    title: text(value.title),
    state: text(value.state),
    tags: tagsOf(value.tags),
    assignee: textOrNull(value.assigned_to),
    createdAt: value.created_date,
    stateChangedAt: isDate(value.state_change_date) ? value.state_change_date : null,
    severity: textOrNull(value.severity),
    period: textOrNull(value.pi),
    sprint: textOrNull(value.sprint),
    parentId: textOrNull(value.parent),
    environment: textOrNull(value.environment_bug),
    description: text(value.description),
    acceptanceCriteria: text(value.acceptance_criteria),
    comments: commentsOf(value.discussion),
  }
}

export type TrackerExport = { exportedAt: string | null; items: TrackerItem[] }

/**
 * A tracker export as a script writes it: `{ exported_at, items: [...] }`. An item without an id
 * or a creation date is left out; null when the file is not an export at all.
 */
export function parseTrackerExport(value: unknown): TrackerExport | null {
  if (!isObject(value) || !Array.isArray(value.items)) return null
  const items = value.items.flatMap((entry) => {
    const item = itemOf(entry)
    return item ? [item] : []
  })
  return { exportedAt: isDate(value.exported_at) ? value.exported_at : null, items }
}

const byDate = <T extends { at: string }>(entries: T[]): T[] =>
  entries.sort((a, b) => Date.parse(a.at) - Date.parse(b.at))

/** `[date, value]` pairs with a readable date. */
function pairsOf(value: unknown): Array<[string, string]> {
  if (!Array.isArray(value)) return []
  return value.flatMap((pair) =>
    Array.isArray(pair) && isDate(pair[0]) ? [[pair[0], text(pair[1])] as [string, string]] : [],
  )
}

/**
 * The history of states and tags a script keeps beside the export:
 * `{ bugs: { id: { created, states: [[date, state]], tags: [[date, "a; b"]] } } }`.
 */
export function parseTrackerHistory(value: unknown): Map<string, ItemHistory> | null {
  if (!isObject(value) || !isObject(value.bugs)) return null
  const histories = new Map<string, ItemHistory>()
  for (const [id, entry] of Object.entries(value.bugs)) {
    if (!isObject(entry) || !isDate(entry.created)) continue
    histories.set(id, {
      createdAt: entry.created,
      states: byDate(pairsOf(entry.states).map(([at, state]) => ({ at, state }))),
      tags: byDate(pairsOf(entry.tags).map(([at, tags]) => ({ at, tags: tagsOf(tags) }))),
    })
  }
  return histories
}

const MIN_STUCK_DAYS = 1
const MAX_STUCK_DAYS = 3650

const cleanList = (values: readonly string[]): string[] => [
  ...new Set(values.map((value) => value.trim()).filter((value) => value !== '')),
]

const MAX_NOTE_CHARS = 2000

function cleanDecisions(decisions: DashboardDecisions): DashboardDecisions {
  const dated = <T extends { id: string; at: string }>(entries: readonly T[]): T[] =>
    entries.filter((entry) => entry.id.trim() !== '' && isDate(entry.at))
  return {
    excludedRequirements: dated(decisions.excludedRequirements),
    removedSignals: dated(decisions.removedSignals),
    notes: dated<DashboardDecisions['notes'][number]>(decisions.notes)
      .map((note) => ({ ...note, text: note.text.trim().slice(0, MAX_NOTE_CHARS) }))
      .filter((note) => note.text !== ''),
  }
}

/** Settings as the PM typed them, made tidy: no blanks, no doubles, a threshold that makes sense. */
export function cleanDashboardSettings(settings: DashboardSettings): DashboardSettings {
  const phases: Record<string, Phase> = {}
  for (const [state, phase] of Object.entries(settings.phases)) {
    if (state.trim() !== '' && PHASES.includes(phase)) phases[state.trim()] = phase
  }
  const stuckDays = Number.isFinite(settings.stuckDays)
    ? Math.min(MAX_STUCK_DAYS, Math.max(MIN_STUCK_DAYS, Math.round(settings.stuckDays)))
    : DEFAULT_DASHBOARD_SETTINGS.stuckDays
  const orDefault = (values: string[], fallback: string[]) =>
    values.length > 0 ? values : fallback
  return {
    exportPath: settings.exportPath.trim(),
    historyPath: settings.historyPath.trim(),
    tags: cleanList(settings.tags),
    bugTypes: orDefault(cleanList(settings.bugTypes), DEFAULT_DASHBOARD_SETTINGS.bugTypes),
    storyTypes: orDefault(cleanList(settings.storyTypes), DEFAULT_DASHBOARD_SETTINGS.storyTypes),
    stuckDays,
    requirementPeriods: cleanList(settings.requirementPeriods),
    phases,
    handoverStates: cleanList(settings.handoverStates),
    decisions: cleanDecisions(settings.decisions),
  }
}

/** How old a reading of the tracker may be before the PM is warned, and before it is called old. */
export const EXPORT_WARNING_HOURS = 24
export const EXPORT_STALE_HOURS = 72
export type ExportAge = 'fresh' | 'warning' | 'stale' | 'unknown'

export function exportAge(exportedAt: string | null, now: Date): ExportAge {
  if (exportedAt === null) return 'unknown'
  const hours = (now.getTime() - Date.parse(exportedAt)) / (60 * 60 * 1000)
  if (hours > EXPORT_STALE_HOURS) return 'stale'
  return hours > EXPORT_WARNING_HOURS ? 'warning' : 'fresh'
}
