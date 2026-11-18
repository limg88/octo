import { cleanGlossary, type Glossary, type GlossaryEntry, type Project } from '@octo/domain'
import type { GlossaryAdvisor, GlossaryStore } from './ports.ts'

export type GlossaryDeps = {
  store: GlossaryStore
  /** With who reads the project, pairs are proposed; the PM approves them one by one. */
  advisor?: GlossaryAdvisor
  model?: (project: Project) => Promise<string | null>
}

export type ProjectGlossary = {
  get(project: Project): Promise<Glossary>
  /** Keeps the pairs the PM approved and those still proposed, made tidy. */
  save(project: Project, glossary: Glossary): Promise<Glossary>
  /** The approved pairs: applied to the transcripts that enter, and told to who writes. */
  entries(project: Project): Promise<GlossaryEntry[]>
  /** Asks Claude which words the transcripts heard badly; nothing is applied until approved. */
  propose(project: Project, signal?: AbortSignal): Promise<Glossary>
}

export function createGlossary(deps: GlossaryDeps): ProjectGlossary {
  const get = async (project: Project): Promise<Glossary> =>
    cleanGlossary(await deps.store.load(project.folder))

  async function save(project: Project, glossary: Glossary): Promise<Glossary> {
    const clean = cleanGlossary(glossary)
    await deps.store.save(project.folder, clean)
    return clean
  }

  return {
    get,
    save,
    entries: async (project) => (await get(project)).entries,
    async propose(project, signal) {
      const current = await get(project)
      if (!deps.advisor) return current
      const proposed = await deps.advisor.propose({
        projectFolder: project.folder,
        known: current.entries,
        model: (await deps.model?.(project)) ?? null,
        ...(signal ? { signal } : {}),
      })
      return save(project, { ...current, proposed })
    },
  }
}
