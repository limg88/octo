import {
  type BugDashboard,
  bucketsOf,
  bugDashboard,
  cleanDashboardSettings,
  type DashboardSettings,
  DomainError,
  type ExportAge,
  exportAge,
  inScope,
  isOfType,
  type Phase,
  type Project,
  parseTrackerExport,
  parseTrackerHistory,
  phaseOf,
  type RequirementRow,
  TRACKER_SUMMARY_PATH,
  type TrackerData,
  type TrendGranularity,
  trackerSummary,
  unclearRequirements,
} from '@octo/domain'
import type {
  Clock,
  DashboardSettingsStore,
  ExportCandidates,
  MemoryWriter,
  TrackerExports,
} from './ports.ts'

export type DashboardDeps = {
  settings: DashboardSettingsStore
  exports: TrackerExports
  clock: Clock
  /** With a writer, the tracker in numbers is kept as a text of the project. */
  writer?: MemoryWriter
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
}

export type Dashboard = {
  settings(project: Project): Promise<DashboardSettings>
  saveSettings(project: Project, settings: DashboardSettings): Promise<DashboardSettings>
  /** Exports found in the project folder, to propose when nothing is set yet. */
  candidates(project: Project): Promise<ExportCandidates>
  view(project: Project, range: DashboardRange): Promise<DashboardView>
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

export function createDashboard(deps: DashboardDeps): Dashboard {
  async function read(project: Project, settings: DashboardSettings): Promise<TrackerData> {
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
    return { ...parsed, history: rawHistory === null ? null : parseTrackerHistory(rawHistory) }
  }

  return {
    settings: (project) => deps.settings.load(project.folder),

    async saveSettings(project, settings) {
      const clean = cleanDashboardSettings(settings)
      await deps.settings.save(project.folder, clean)
      // The numbers follow the perimeter and the phases just saved; no export yet, no numbers.
      if (deps.writer && clean.exportPath !== '') {
        const data = await read(project, clean).catch(() => null)
        if (data)
          await deps.writer.write(project.folder, TRACKER_SUMMARY_PATH, trackerSummary(data, clean))
      }
      return clean
    },

    candidates: (project) => deps.exports.candidates(project.folder),

    async view(project, range) {
      const parsedRange = trendRange(range)
      const settings = await deps.settings.load(project.folder)
      const data = await read(project, settings)
      const now = deps.clock.now()
      // Days in a state are counted up to the reading of the tracker: later nothing is known.
      const asOf = data.exportedAt === null ? now : new Date(data.exportedAt)
      return {
        exportedAt: data.exportedAt,
        age: exportAge(data.exportedAt, now),
        bugs: bugDashboard(data, settings, parsedRange, asOf),
        requirements: unclearRequirements(data, settings),
        states: statesOf(data, settings),
        periods: periodsOf(data, settings),
      }
    },
  }
}
