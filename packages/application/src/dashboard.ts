import {
  type Activities,
  assignedToOwnPeople,
  awaitingAnswer,
  type BugDashboard,
  bucketsOf,
  bugDashboard,
  cleanDashboardSettings,
  currentSprint,
  type DashboardSettings,
  DEFAULT_HOURS_PER_DAY,
  type DecisionRow,
  DomainError,
  decisionRows,
  type ExportAge,
  exportAge,
  inScope,
  isOfType,
  isTrackerItemId,
  jiraBrowseHost,
  NO_TEAM,
  nextSprint,
  type Phase,
  type Project,
  type ProjectTeam,
  parseTrackerExport,
  parseTrackerHistory,
  personKey,
  phaseOf,
  type RequirementRow,
  romeDateString,
  type SprintComparisonRow,
  type SprintProgress,
  sameSprint,
  sprintComparison,
  sprintNames,
  sprintProgress,
  TRACKER_SUMMARY_PATH,
  type TrackerData,
  type TrackerHours,
  type TrackerKind,
  type TrendGranularity,
  teamCaps,
  tellsSides,
  trackerActivities,
  trackerOfExport,
  trackerSummary,
  trackerTypes,
  unclearRequirements,
  type WaitingRow,
} from '@octo/domain'
import type {
  Clock,
  DashboardSettingsStore,
  ExportCandidates,
  MemoryWriter,
  SourceSettings,
  TrackerExports,
} from './ports.ts'

export type DashboardDeps = {
  settings: DashboardSettingsStore
  exports: TrackerExports
  clock: Clock
  /** The people of the project: who the supplier's own are, when only their items count. */
  team?: (project: Project) => Promise<ProjectTeam>
  /** With a writer, the tracker in numbers is kept as a text of the project. */
  writer?: MemoryWriter
  /** With the sources, an item read from the tracker has an address there. */
  sources?: Pick<SourceSettings, 'load'>
  /** The hours logged on the tracker, item by item: what each activity took. */
  worklog?: (project: Project) => Promise<TrackerHours[]>
}

/** The parts of the dashboard that have something to show for the tracker as it was read. */
export type DashboardParts = {
  sprint: boolean
  bugs: boolean
  trend: boolean
  /** A tracker with no bugs and no sprints is a register of activities, and is shown as one. */
  activities: boolean
}

/** The period of the trend as the interface asks for it: two days and the size of a step. */
export type DashboardRange = { from: string; to: string; granularity: TrendGranularity }

/** A state of the bugs in scope, with the phase it is read as: what the PM corrects by hand. */
export type StateMapping = { state: string; phase: Phase; mappedByHand: boolean; count: number }

export type DashboardView = {
  exportedAt: string | null
  age: ExportAge
  bugs: BugDashboard
  requirements: RequirementRow[]
  states: StateMapping[]
  /** The planning periods the stories in scope have, for choosing which to check. */
  periods: string[]
  /** Every tag the export holds, in scope or not, for choosing which make the scope. */
  tags: string[]
  /** Whether an item can be opened where the tracker keeps it. */
  linked: boolean
  /** The tracker the export is Octo's own reading of; null for a file kept by hand. */
  tracker: TrackerKind | null
  /** The bugs and the stories whose last comment asks something nobody answered. */
  waiting: WaitingRow[]
  /** Whether the team tells the supplier's people from the client's. */
  tellsSides: boolean
  /** The sprints of the items in scope, by name. */
  sprints: string[]
  /** The sprint the day falls in and the one after, by the calendar; null when nothing tells. */
  currentSprint: string | null
  upcomingSprint: string | null
  /** The sprint asked, or the running one; null when there is none to show. */
  sprint: SprintProgress | null
  comparison: SprintComparisonRow[]
  /** What the PM decided on single items, the latest first. */
  decisions: DecisionRow[]
  /** Every type the items of the tracker have, with how many: what bugs and stories are chosen among. */
  types: Array<{ type: string; count: number }>
  parts: DashboardParts
  /** Every item in scope with its hours and its last comment. */
  activities: Activities
}

export type Dashboard = {
  settings(project: Project): Promise<DashboardSettings>
  saveSettings(project: Project, settings: DashboardSettings): Promise<DashboardSettings>
  /** Exports found in the project folder, to propose when nothing is set yet. */
  candidates(project: Project): Promise<ExportCandidates>
  /** `sprint`: the one to show in place of the running one. */
  view(project: Project, range: DashboardRange, sprint?: string | null): Promise<DashboardView>
  /** Where the tracker keeps an item, when Octo read it from the tracker itself; null otherwise. */
  itemUrl(project: Project, id: string): Promise<string | null>
}

/** More steps than this is not a chart a person reads: the range or the step is wrong. */
export const MAX_TREND_STEPS = 520
const GRANULARITIES: readonly TrendGranularity[] = ['week', 'month']

function trendRange(range: DashboardRange) {
  const from = new Date(range.from)
  const to = new Date(range.to)
  const valid =
    !Number.isNaN(from.getTime()) &&
    !Number.isNaN(to.getTime()) &&
    from.getTime() <= to.getTime() &&
    GRANULARITIES.includes(range.granularity)
  if (!valid) throw new DomainError('dashboard_range_invalid')
  const parsed = { from, to, granularity: range.granularity }
  const weeks = (to.getTime() - from.getTime()) / (7 * 24 * 60 * 60 * 1000)
  if (weeks > MAX_TREND_STEPS * 5 || bucketsOf(parsed).length > MAX_TREND_STEPS) {
    throw new DomainError('dashboard_range_invalid')
  }
  return parsed
}

function statesOf(data: TrackerData, settings: DashboardSettings): StateMapping[] {
  const counts = new Map<string, number>()
  for (const item of data.items) {
    if (!isOfType(item, settings.bugTypes) || !inScope(item.tags, settings)) continue
    counts.set(item.state, (counts.get(item.state) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([state, count]) => ({
      state,
      phase: phaseOf(state, settings),
      mappedByHand: settings.phases[state] !== undefined,
      count,
    }))
    .sort((a, b) => a.state.localeCompare(b.state, 'en', { numeric: true }))
}

function periodsOf(data: TrackerData, settings: DashboardSettings): string[] {
  const periods = new Set<string>()
  for (const item of data.items) {
    if (
      item.period !== null &&
      isOfType(item, settings.storyTypes) &&
      inScope(item.tags, settings)
    ) {
      periods.add(item.period)
    }
  }
  return [...periods].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
}

const ADO_ORIGIN = 'https://dev.azure.com'

export function createDashboard(deps: DashboardDeps): Dashboard {
  /** The address of the items of the project on its tracker, when the export is its reading. */
  async function itemsAddress(
    project: Project,
    settings: DashboardSettings,
  ): Promise<{ tracker: TrackerKind; address: string } | null> {
    const tracker = trackerOfExport(settings.exportPath)
    if (tracker === null || !deps.sources) return null
    const sources = await deps.sources.load(project.folder).catch(() => null)
    if (tracker === 'jira') {
      const site = sources?.jira ? jiraBrowseHost(sources.jira.site) : null
      return site === null ? null : { tracker, address: `https://${site}/browse/` }
    }
    const ado = sources?.ado
    if (!ado || ado.organization.trim() === '' || ado.project.trim() === '') return null
    const path = [ado.organization, ado.project].map((part) => encodeURIComponent(part.trim()))
    return { tracker, address: `${ADO_ORIGIN}/${path.join('/')}/_workitems/edit/` }
  }

  /** The reading of the tracker: every item of it, and those the numbers count. */
  async function read(
    project: Project,
    settings: DashboardSettings,
    team: ProjectTeam,
  ): Promise<{ data: TrackerData; everyone: TrackerData }> {
    if (settings.exportPath === '') throw new DomainError('tracker_export_not_set')
    const raw = await deps.exports.readJson(project.folder, settings.exportPath)
    if (raw === null) throw new DomainError('tracker_export_missing', settings.exportPath)
    const parsed = parseTrackerExport(raw)
    if (parsed === null) throw new DomainError('tracker_export_unreadable', settings.exportPath)
    // A history that is missing or unreadable does not stop the dashboard: the trend says so.
    const rawHistory =
      settings.historyPath === ''
        ? null
        : await deps.exports.readJson(project.folder, settings.historyPath).catch(() => null)
    const history = rawHistory === null ? null : parseTrackerHistory(rawHistory)
    // Jira has no field for the acceptance criteria: a reading of it that left the field empty
    // says nothing is known, not that the criteria are missing.
    if (trackerOfExport(settings.exportPath) === 'jira') {
      parsed.items = parsed.items.map((item) =>
        item.acceptanceCriteria === '' ? { ...item, acceptanceCriteria: null } : item,
      )
    }
    // The items of other people are left out before anything is counted: no number sees them.
    const items = settings.ownPeopleOnly ? assignedToOwnPeople(parsed.items, team) : parsed.items
    return { data: { ...parsed, items, history }, everyone: { ...parsed, history } }
  }

  const teamOf = (project: Project): Promise<ProjectTeam> =>
    deps.team ? deps.team(project).catch(() => NO_TEAM) : Promise.resolve(NO_TEAM)

  return {
    settings: (project) => deps.settings.load(project.folder),

    async saveSettings(project, settings) {
      const clean = cleanDashboardSettings(settings)
      await deps.settings.save(project.folder, clean)
      // The numbers follow the perimeter and the phases just saved; no export yet, no numbers.
      if (deps.writer && clean.exportPath !== '') {
        const reading = await read(project, clean, await teamOf(project)).catch(() => null)
        if (reading) {
          await deps.writer.write(
            project.folder,
            TRACKER_SUMMARY_PATH,
            trackerSummary(reading.data, clean, trackerOfExport(clean.exportPath)),
          )
        }
      }
      return clean
    },

    candidates: (project) => deps.exports.candidates(project.folder),

    async itemUrl(project, id) {
      const found = await itemsAddress(project, await deps.settings.load(project.folder))
      if (found === null || !isTrackerItemId(found.tracker, id)) return null
      return `${found.address}${id}`
    },

    async view(project, range, sprint = null) {
      const parsedRange = trendRange(range)
      const settings = await deps.settings.load(project.folder)
      const team = await teamOf(project)
      const { data, everyone } = await read(project, settings, team)
      const now = deps.clock.now()
      const today = romeDateString(now)
      const sprints = sprintNames(data, settings)
      const running = currentSprint(sprints, team, today)
      const upcoming = nextSprint(sprints, team, today)
      const shown = sprints.find((name) => sprint !== null && sameSprint(name, sprint)) ?? running
      // Days in a state are counted up to the reading of the tracker: later nothing is known.
      const asOf = data.exportedAt === null ? now : new Date(data.exportedAt)
      const scoped = data.items.filter((item) => inScope(item.tags, settings))
      const hasBugs = scoped.some((item) => isOfType(item, settings.bugTypes))
      const requirements = unclearRequirements(data, settings, upcoming)
      const hasSprints = sprints.length > 0
      const register = scoped.length > 0 && !hasBugs && !hasSprints
      const worklog = deps.worklog ? await deps.worklog(project).catch(() => []) : []
      return {
        exportedAt: data.exportedAt,
        age: exportAge(data.exportedAt, now),
        bugs: bugDashboard(data, settings, parsedRange, asOf),
        requirements,
        types: trackerTypes(everyone),
        parts: {
          // In a register of activities a story is a line of work, not a requirement to refine.
          sprint: hasSprints || (requirements.length > 0 && !register),
          bugs: hasBugs,
          trend: hasBugs,
          activities: register,
        },
        activities: trackerActivities(
          data,
          settings,
          worklog,
          new Map(
            teamCaps(team).map((cap) => [personKey(cap.person), cap.days * DEFAULT_HOURS_PER_DAY]),
          ),
        ),
        states: statesOf(data, settings),
        periods: periodsOf(data, settings),
        tags: [...new Set(data.items.flatMap((item) => item.tags))].sort((a, b) =>
          a.localeCompare(b, 'en', { numeric: true }),
        ),
        linked: (await itemsAddress(project, settings)) !== null,
        tracker: trackerOfExport(settings.exportPath),
        // Who has to answer may be anybody: the questions are looked for in every item in scope.
        waiting: awaitingAnswer(everyone, settings, team, asOf),
        tellsSides: tellsSides(team),
        sprints,
        currentSprint: running,
        upcomingSprint: upcoming,
        sprint: shown ? sprintProgress(data, settings, shown, team, today, asOf) : null,
        comparison: sprintComparison(data, settings, team, today),
        decisions: decisionRows(settings.decisions, everyone.items),
      }
    },
  }
}
