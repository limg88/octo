import { DomainError, type Project, projectNameFromFolder, sameFolder } from '@octo/domain'
import type { Clock, FolderProbe, IdGenerator, ProjectRegistry, QuestionLog } from './ports.ts'

export type ProjectsDeps = {
  registry: ProjectRegistry
  questions: QuestionLog
  folders: FolderProbe
  clock: Clock
  ids: IdGenerator
}

export type Projects = {
  list(): Promise<Project[]>
  get(id: string): Promise<Project>
  add(folder: string): Promise<Project>
  remove(id: string): Promise<void>
}

export function createProjects(deps: ProjectsDeps): Projects {
  async function get(id: string): Promise<Project> {
    const project = (await deps.registry.list()).find((candidate) => candidate.id === id)
    if (!project) throw new DomainError('project_not_found', id)
    return project
  }

  async function add(folder: string): Promise<Project> {
    if (!(await deps.folders.isReadableFolder(folder))) {
      throw new DomainError('folder_not_readable', folder)
    }
    const projects = await deps.registry.list()
    if (projects.some((project) => sameFolder(project.folder, folder))) {
      throw new DomainError('project_already_added', folder)
    }
    const project: Project = {
      id: deps.ids.next(),
      name: projectNameFromFolder(folder),
      folder,
      addedAt: deps.clock.now().toISOString(),
    }
    await deps.registry.save([...projects, project])
    return project
  }

  /** Forgets the project and its questions. The folder itself is never touched. */
  async function remove(id: string): Promise<void> {
    const project = await get(id)
    const projects = await deps.registry.list()
    await deps.registry.save(projects.filter((candidate) => candidate.id !== project.id))
    await deps.questions.removeProject(project.id)
  }

  return { list: () => deps.registry.list(), get, add, remove }
}
