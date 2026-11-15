import { cleanModelSettings, type ModelSettings, type Project } from '@octo/domain'
import type { ModelSettingsStore } from './ports.ts'

export type Models = {
  get(project: Project): Promise<ModelSettings>
  save(project: Project, settings: ModelSettings): Promise<ModelSettings>
}

/** Which model answers, writes and reads again in a project. */
export function createModels(deps: { store: ModelSettingsStore }): Models {
  return {
    get: (project) => deps.store.load(project.folder),
    async save(project, settings) {
      const clean = cleanModelSettings(settings)
      await deps.store.save(project.folder, clean)
      return clean
    },
  }
}
