import { cleanTeam, type Project, type ProjectTeam, TEAM_FILE, teamMarkdown } from '@octo/domain'
import type { MemoryWriter, TeamStore } from './ports.ts'

export type TeamDeps = { store: TeamStore; writer: MemoryWriter }

export type Team = {
  get(project: Project): Promise<ProjectTeam>
  /**
   * Keeps the people and the calendar, and writes them as a text of the project so that answers
   * and deliverables can read and cite them.
   */
  save(project: Project, team: ProjectTeam): Promise<ProjectTeam>
}

export function createTeam(deps: TeamDeps): Team {
  return {
    get: (project) => deps.store.load(project.folder),
    async save(project, team) {
      const clean = cleanTeam(team)
      await deps.store.save(project.folder, clean)
      await deps.writer.claim(project.folder)
      await deps.writer.write(project.folder, TEAM_FILE, teamMarkdown(clean))
      return clean
    },
  }
}
