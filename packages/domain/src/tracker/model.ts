import { OCTO_FOLDER } from '../extracted-document.ts'

/** Where Octo keeps the tracker it read by itself, and the history of its bugs. */
export const TRACKER_SNAPSHOT_PATH = `${OCTO_FOLDER}/cruscotto/azure-devops.json`
export const TRACKER_HISTORY_PATH = `${OCTO_FOLDER}/cruscotto/azure-devops-cronologia.json`

/** One comment of a work item, as the tracker keeps it. */
export type TrackerComment = { by: string; at: string; text: string }

/** A work item of a tracker, whatever the tracker: what the dashboard needs of it. */
export type TrackerItem = {
  id: string
  /** The type as the tracker calls it: `Bug`, `User Story`… */
  type: string
  title: string
  state: string
  tags: string[]
  assignee: string | null
  createdAt: string
  /** When it entered its present state; null when the tracker does not say. */
  stateChangedAt: string | null
  severity: string | null
  /** The planning period it belongs to (a Program Increment, a release), when it has one. */
  period: string | null
  sprint: string | null
  parentId: string | null
  environment: string | null
  description: string
  acceptanceCriteria: string
  comments: TrackerComment[]
}

/** What happened to an item over time: every state it entered and every change of its tags. */
export type ItemHistory = {
  createdAt: string
  states: Array<{ at: string; state: string }>
  tags: Array<{ at: string; tags: string[] }>
}

/** A reading of a tracker: its items now and, when known, their history. */
export type TrackerData = {
  /** When the tracker was read; null when the export does not say. */
  exportedAt: string | null
  items: TrackerItem[]
  /** By item id. Null when no history is available: trends are then approximate. */
  history: ReadonlyMap<string, ItemHistory> | null
}

/**
 * Where an item stands, whatever its tracker calls the state:
 * being worked on, waiting to be verified, verified and waiting for its release, or closed.
 */
export const PHASES = ['work', 'verify', 'validated', 'closed'] as const
export type Phase = (typeof PHASES)[number]

/** What the PM decided about single items: kept as data with its date, never changed in the tracker. */
export type DashboardDecisions = {
  /** Stories the PM judged clear: no longer listed among the unclear requirements. */
  excludedRequirements: Array<{ id: string; at: string }>
  /** A signal the PM judged wrong for a story, as `S1`…`S5`. */
  removedSignals: Array<{ id: string; signal: string; at: string }>
  /** The PM's own note on an item: shown before the tracker's last comment. */
  notes: Array<{ id: string; at: string; text: string }>
}

export const NO_DECISIONS: DashboardDecisions = {
  excludedRequirements: [],
  removedSignals: [],
  notes: [],
}

/** How a project reads its tracker: what is in scope and what counts as what. */
export type DashboardSettings = {
  /** The tracker export inside the project folder; empty until the PM sets it. */
  exportPath: string
  /** The history of states and tags, when the project has one. */
  historyPath: string
  /** Items with at least one of these tags are in scope; none: all of them. */
  tags: string[]
  bugTypes: string[]
  storyTypes: string[]
  /** Days in the same state after which an open bug is shown as stuck. */
  stuckDays: number
  /** Planning periods whose stories are checked for unclear requirements; none: all. */
  requirementPeriods: string[]
  /** States the PM mapped by hand; every other state is mapped by its name. */
  phases: Record<string, Phase>
  /**
   * The states in which a fix is handed to who verifies it: where the way out is measured from.
   * None: any state of the verification phase.
   */
  handoverStates: string[]
  decisions: DashboardDecisions
}

export const DEFAULT_DASHBOARD_SETTINGS: DashboardSettings = {
  exportPath: '',
  historyPath: '',
  tags: [],
  bugTypes: ['Bug'],
  storyTypes: ['User Story', 'Story'],
  stuckDays: 30,
  requirementPeriods: [],
  phases: {},
  handoverStates: [],
  decisions: NO_DECISIONS,
}

/** A leading order number some trackers put before the state: `04 - In Progress`. */
const STATE_PREFIX = /^\s*[0-9]+[a-z.]*\s*-\s*/i
const CLOSED = /\b(closed|done|removed|released|cancell?ed|chius[oa]|rimoss[oa]|annullat[oa])\b/i
const VALIDATED = /\b(validated|ready for prod|approved|validat[oa]|approvat[oa])\b/i
const VERIFY =
  /\b(resolved|ready for test|in test(ing)?|test (passed|failed|blocked)|qao test passed|review|demo|developed|verifica|risolt[oa])\b/i

export const stateName = (state: string): string => state.replace(STATE_PREFIX, '').trim()

/**
 * The phase a state belongs to: as the PM mapped it, or read from its name. A state nothing
 * recognises is work in progress: an item never disappears because its state is unknown.
 */
export function phaseOf(state: string, settings: Pick<DashboardSettings, 'phases'>): Phase {
  const mapped = settings.phases[state]
  if (mapped) return mapped
  const name = stateName(state)
  if (CLOSED.test(name)) return 'closed'
  if (VALIDATED.test(name)) return 'validated'
  return VERIFY.test(name) ? 'verify' : 'work'
}

/** Open means someone still has to do something before the fix can be released. */
export const isOpenPhase = (phase: Phase): boolean => phase === 'work' || phase === 'verify'

const lower = (text: string): string => text.toLocaleLowerCase('en')

export function inScope(
  tags: readonly string[],
  settings: Pick<DashboardSettings, 'tags'>,
): boolean {
  if (settings.tags.length === 0) return true
  const wanted = new Set(settings.tags.map(lower))
  return tags.some((tag) => wanted.has(lower(tag)))
}

export const isOfType = (item: TrackerItem, types: readonly string[]): boolean =>
  types.some((type) => lower(type) === lower(item.type))
