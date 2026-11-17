import { type Project, type ProjectShape, projectShapeOf } from '@octo/domain'
import type {
  AlignmentSettingsStore,
  DashboardSettingsStore,
  ForecastSettingsStore,
  SourceSettings,
} from './ports.ts'

export type ProjectShapeDeps = {
  sources: Pick<SourceSettings, 'load'>
  dashboard: Pick<DashboardSettingsStore, 'load'>
  alignment: Pick<AlignmentSettingsStore, 'load'>
  forecast: Pick<ForecastSettingsStore, 'load'>
}

export type ProjectShapes = {
  /** What the project is like: which of its sections have something to work on. */
  of(project: Project): Promise<ProjectShape>
}

/** Tells the shape of a project from its settings, so the navigation shows what it has a use for. */
export function createProjectShapes(deps: ProjectShapeDeps): ProjectShapes {
  return {
    async of(project) {
      const [sources, dashboard, alignment, forecast] = await Promise.all([
        deps.sources.load(project.folder),
        deps.dashboard.load(project.folder),
        deps.alignment.load(project.folder),
        deps.forecast.load(project.folder),
      ])
      return projectShapeOf(sources, dashboard, alignment, forecast)
    },
  }
}
