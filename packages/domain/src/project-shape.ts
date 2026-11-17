import type { AlignmentSettings } from './alignment/model.ts'
import type { ForecastSettings } from './forecast/model.ts'
import type { SourcesConfig } from './sources-config.ts'
import { type DashboardSettings, trackerOfExport } from './tracker/model.ts'

/** What a project is like, as far as it changes which sections it has a use for. */
export type ProjectShape = {
  /**
   * Whether there are two trackers to keep aligned: the supplier's Jira, and a tracker of the
   * client that is not that same Jira.
   */
  twoTrackers: boolean
  /** Whether every project code of the project is sold at a fixed price. */
  fixedPriceOnly: boolean
}

/**
 * The shape of a project, from what the PM set. The alignment compares the items of the client's
 * tracker with the tickets of the supplier's Jira: with Jira alone, or with no Jira, there is
 * nothing to compare. A project that already uses the alignment keeps it whatever its sources.
 */
export function projectShapeOf(
  sources: Pick<SourcesConfig, 'ado' | 'jira'>,
  dashboard: Pick<DashboardSettings, 'exportPath'>,
  alignment: Pick<AlignmentSettings, 'sprint'>,
  forecast: Pick<ForecastSettings, 'projects'>,
): ProjectShape {
  const clientExport =
    dashboard.exportPath !== '' && trackerOfExport(dashboard.exportPath) !== 'jira'
  const kinds = Object.values(forecast.projects).map((project) => project.kind)
  return {
    twoTrackers:
      alignment.sprint.trim() !== '' ||
      (sources.jira !== null && (sources.ado !== null || clientExport)),
    fixedPriceOnly: kinds.length > 0 && kinds.every((kind) => kind === 'fixed_price'),
  }
}
