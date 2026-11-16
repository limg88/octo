import type { ProjectTeam, TeamPeriod } from '../team/model.ts'
import { SPRINT_ENDING_WORKDAYS, workdaysBetween } from '../workdays.ts'
import {
  type DashboardSettings,
  inScope,
  isOfType,
  isOpenPhase,
  type Phase,
  phaseOf,
  stateName,
  type TrackerData,
  type TrackerItem,
} from './model.ts'

const DAY_MS = 24 * 60 * 60 * 1000

/** Where a story of a sprint stands: the phases of the tracker, with what nobody started apart. */
export const SPRINT_STAGES = ['todo', 'work', 'verify', 'validated', 'closed'] as const
export type SprintStage = (typeof SPRINT_STAGES)[number]

/** A story or a bug of a sprint, as its list shows it. */
export type SprintRow = {
  id: string
  title: string
  state: string
  stage: SprintStage
  assignee: string | null
  daysInState: number | null
}

export type SprintProgress = {
  name: string
  /** Its days in the calendar of the project; null when no period has its name. */
  from: string | null
  to: string | null
  stories: SprintRow[]
  byStage: Record<SprintStage, number>
  bugs: SprintRow[]
  bugsOpen: number
  bugsClosed: number
  /** Whether the sprint is in its last working days. */
  ending: boolean
  /** While it ends: the stories not yet handed to who verifies them. */
  atRisk: SprintRow[]
}

/** A sprint that is over or running, in numbers, to read beside the others. */
export type SprintComparisonRow = {
  name: string
  from: string | null
  to: string | null
  stories: number
  /** Validated or closed, whenever that happened. */
  done: number
  /** Of them, those done by the last day of the sprint; null without history or without dates. */
  doneInTime: number | null
  /** Still to be finished. */
  open: number
  /** Bugs opened in the days of the sprint; null without dates. */
  bugsEntered: number | null
}

/** How many sprints are read side by side. */
export const SPRINTS_COMPARED = 6

const NOT_STARTED =
  /^(new|to ?do|proposed|ready|ready for (dev|development|planning|sprint)|refining|committed|approved|da fare|nuov[oa]|da raffinare|pianificat[oa])$/i
const lower = (text: string): string => text.trim().toLowerCase()
/** A tracker may write a sprint as a path: `Aurora\\PI 3\\Sprint 12` is `Sprint 12`. */
const lastSegment = (name: string): string => lower(name.split(/[\\/]/).at(-1) ?? name)
const byName = (a: string, b: string): number => a.localeCompare(b, 'en', { numeric: true })

export const sameSprint = (a: string, b: string): boolean =>
  lower(a) === lower(b) || lastSegment(a) === lastSegment(b)

/** The stretch of the calendar that has the name of a sprint; null when none has. */
export const sprintPeriod = (sprint: string, team: ProjectTeam): TeamPeriod | null =>
  team.periods.find((period) => sameSprint(period.name, sprint)) ?? null

const isStory = (item: TrackerItem, settings: DashboardSettings) =>
  isOfType(item, settings.storyTypes) && inScope(item.tags, settings)
const isBug = (item: TrackerItem, settings: DashboardSettings) =>
  isOfType(item, settings.bugTypes) && inScope(item.tags, settings)

/** The sprints the stories and the bugs in scope belong to, in the order of their names. */
export function sprintNames(data: TrackerData, settings: DashboardSettings): string[] {
  const names = new Set<string>()
  for (const item of data.items) {
    if (item.sprint !== null && (isStory(item, settings) || isBug(item, settings))) {
      names.add(item.sprint)
    }
  }
  return [...names].sort(byName)
}

const daysOf = (period: TeamPeriod): number => Date.parse(period.to) - Date.parse(period.from)

/** The sprint a day falls in, by the calendar: the shortest stretch that holds it. */
export function currentSprint(
  names: readonly string[],
  team: ProjectTeam,
  today: string,
): string | null {
  const running = names
    .flatMap((name) => {
      const period = sprintPeriod(name, team)
      return period && period.from <= today && today <= period.to ? [{ name, period }] : []
    })
    .sort((a, b) => daysOf(a.period) - daysOf(b.period))
  return running[0]?.name ?? null
}

/**
 * The sprint that comes after a day: the first that starts later by the calendar, or the one
 * named after the running one. Null when nothing tells.
 */
export function nextSprint(
  names: readonly string[],
  team: ProjectTeam,
  today: string,
): string | null {
  const later = names
    .flatMap((name) => {
      const period = sprintPeriod(name, team)
      return period && period.from > today ? [{ name, from: period.from }] : []
    })
    .sort((a, b) => a.from.localeCompare(b.from) || byName(a.name, b.name))
  if (later[0]) return later[0].name
  const current = currentSprint(names, team, today)
  if (current === null) return null
  return names[names.indexOf(current) + 1] ?? null
}

function stageOf(item: TrackerItem, settings: DashboardSettings): SprintStage {
  const phase = phaseOf(item.state, settings)
  return phase === 'work' && NOT_STARTED.test(stateName(item.state)) ? 'todo' : phase
}

function rowOf(item: TrackerItem, settings: DashboardSettings, asOf: number): SprintRow {
  return {
    id: item.id,
    title: item.title,
    state: item.state,
    stage: stageOf(item, settings),
    assignee: item.assignee,
    daysInState:
      item.stateChangedAt === null
        ? null
        : Math.floor((asOf - Date.parse(item.stateChangedAt)) / DAY_MS),
  }
}

const longestFirst = (a: SprintRow, b: SprintRow) => (b.daysInState ?? -1) - (a.daysInState ?? -1)
const inSprint = (item: TrackerItem, sprint: string) =>
  item.sprint !== null && sameSprint(item.sprint, sprint)

/** The stories and the bugs of a sprint: where each stands and, while it ends, what will not make it. */
export function sprintProgress(
  data: TrackerData,
  settings: DashboardSettings,
  sprint: string,
  team: ProjectTeam,
  today: string,
  asOf: Date,
): SprintProgress {
  const period = sprintPeriod(sprint, team)
  const rows = (wanted: typeof isStory) =>
    data.items
      .filter((item) => inSprint(item, sprint) && wanted(item, settings))
      .map((item) => rowOf(item, settings, asOf.getTime()))
      .sort(longestFirst)
  const stories = rows(isStory)
  const bugs = rows(isBug)
  const byStage: Record<SprintStage, number> = {
    todo: 0,
    work: 0,
    verify: 0,
    validated: 0,
    closed: 0,
  }
  for (const story of stories) byStage[story.stage] += 1
  const ending =
    period !== null &&
    today <= period.to &&
    workdaysBetween(today, period.to) <= SPRINT_ENDING_WORKDAYS
  const notStarted = (row: SprintRow) => row.stage === 'todo' || row.stage === 'work'
  const bugsOpen = bugs.filter((bug) => bug.stage !== 'validated' && bug.stage !== 'closed').length
  return {
    name: sprint,
    from: period?.from ?? null,
    to: period?.to ?? null,
    stories,
    byStage,
    bugs,
    bugsOpen,
    bugsClosed: bugs.length - bugsOpen,
    ending,
    atRisk: ending ? stories.filter(notStarted) : [],
  }
}

const isDone = (phase: Phase): boolean => !isOpenPhase(phase)

/** How many of the stories were done by an instant, from their recorded changes; null when none has any. */
function doneBy(
  stories: readonly TrackerItem[],
  data: TrackerData,
  settings: DashboardSettings,
  instant: number,
): number | null {
  const histories = data.history
  if (histories === null) return null
  let known = 0
  let done = 0
  for (const story of stories) {
    const history = histories.get(story.id)
    if (!history) continue
    known += 1
    const reached = history.states.some(
      (entry) => Date.parse(entry.at) <= instant && isDone(phaseOf(entry.state, settings)),
    )
    if (reached && isDone(phaseOf(story.state, settings))) done += 1
  }
  return known === 0 ? null : done
}

/**
 * The sprints already started, the latest last, each in numbers. With the calendar they are the
 * ones that began by a day; without it, the last ones by name.
 */
export function sprintComparison(
  data: TrackerData,
  settings: DashboardSettings,
  team: ProjectTeam,
  today: string,
): SprintComparisonRow[] {
  const names = sprintNames(data, settings)
  const dated = names
    .flatMap((name) => {
      const period = sprintPeriod(name, team)
      return period && period.from <= today ? [{ name, period }] : []
    })
    .sort((a, b) => a.period.from.localeCompare(b.period.from))
  const chosen: Array<{ name: string; period: TeamPeriod | null }> =
    dated.length > 0 ? dated : names.map((name) => ({ name, period: null }))
  return chosen.slice(-SPRINTS_COMPARED).map(({ name, period }) => {
    const stories = data.items.filter((item) => inSprint(item, name) && isStory(item, settings))
    const done = stories.filter((story) => isDone(phaseOf(story.state, settings))).length
    const end = period ? Date.parse(`${period.to}T23:59:59.999Z`) : null
    const start = period ? Date.parse(`${period.from}T00:00:00.000Z`) : null
    return {
      name,
      from: period?.from ?? null,
      to: period?.to ?? null,
      stories: stories.length,
      done,
      doneInTime: end === null ? null : doneBy(stories, data, settings, end),
      open: stories.length - done,
      bugsEntered:
        start === null || end === null
          ? null
          : data.items.filter((item) => {
              const created = Date.parse(item.createdAt)
              return isBug(item, settings) && created >= start && created <= end
            }).length,
    }
  })
}
