import {
  DomainError,
  type Identity,
  type Project,
  projectFolderName,
  projectNameFromFolder,
  sameFolder,
  starterFiles,
} from '@octo/domain'
import type { Clock, FolderProbe, IdGenerator, ProjectRegistry, ProjectScaffold } from './ports.ts'

export type ProjectsDeps = {
  registry: ProjectRegistry
  /** The projects taken off the list, kept so that the same folder comes back as it was. */
  setAside: ProjectRegistry
  folders: FolderProbe
  scaffold: ProjectScaffold
  clock: Clock
  ids: IdGenerator
  /**
   * Who uses Octo. With it a project is of the person who added it: another person on the same
   * computer does not see it. Without it every project is everybody's, as before the sign-in.
   */
  identity?: () => Identity | null
}

export type Projects = {
  list(): Promise<Project[]>
  get(id: string): Promise<Project>
  add(folder: string): Promise<Project>
  /** Makes a new folder with the starter files inside `parent`, and adds it as a project. */
  create(parent: string, name: string): Promise<Project>
  /** Takes the project off the list. Nothing of it is deleted: it can be put back. */
  remove(id: string): Promise<void>
  /** Puts back a project taken off the list, as it was. */
  restore(id: string): Promise<Project>
  /** Points a project at the folder it was moved to. */
  relocate(id: string, folder: string): Promise<Project>
}

export function createProjects(deps: ProjectsDeps): Projects {
  const owner = (): string | undefined => deps.identity?.()?.id

  /**
   * The projects of who is signed in. A project added before Octo had a sign-in has no owner: it
   * becomes of the first person who signs in.
   */
  async function list(): Promise<Project[]> {
    const all = await deps.registry.list()
    const me = owner()
    if (me === undefined) return all
    if (all.some((project) => project.owner === undefined)) {
      const claimed = all.map((project) =>
        project.owner === undefined ? { ...project, owner: me } : project,
      )
      await deps.registry.save(claimed)
      return claimed.filter((project) => project.owner === me)
    }
    return all.filter((project) => project.owner === me)
  }

  async function get(id: string): Promise<Project> {
    const project = (await list()).find((candidate) => candidate.id === id)
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
    const setAside = await deps.setAside.list()
    // The same folder is the same project: its readings and credentials are found again.
    const known = setAside.find(
      (candidate) =>
        sameFolder(candidate.folder, folder) && !projects.some(({ id }) => id === candidate.id),
    )
    const me = owner()
    const project: Project = {
      ...(known ?? {
        id: deps.ids.next(),
        name: projectNameFromFolder(folder),
        folder,
        addedAt: deps.clock.now().toISOString(),
      }),
      ...(me === undefined ? {} : { owner: me }),
    }
    await deps.registry.save([...projects, project])
    if (known) await deps.setAside.save(setAside.filter(({ id }) => id !== known.id))
    return project
  }

  /**
   * Takes the project off the list and sets it aside. Its folder, its readings and its
   * credentials are not touched: they are there when the project is put back.
   */
  async function remove(id: string): Promise<void> {
    const project = await get(id)
    const projects = await deps.registry.list()
    const setAside = await deps.setAside.list()
    await deps.setAside.save([
      ...setAside.filter((candidate) => !sameFolder(candidate.folder, project.folder)),
      project,
    ])
    await deps.registry.save(projects.filter((candidate) => candidate.id !== project.id))
  }

  async function restore(id: string): Promise<Project> {
    const project = (await deps.setAside.list()).find((candidate) => candidate.id === id)
    if (!project) throw new DomainError('project_not_found', id)
    return add(project.folder)
  }

  async function create(parent: string, name: string): Promise<Project> {
    const folderName = projectFolderName(name)
    if (folderName === null) throw new DomainError('project_name_invalid', name)
    return add(await deps.scaffold.create(parent, folderName, starterFiles(folderName)))
  }

  /**
   * Says where the folder of a project is now, after it was moved: the project stays the same,
   * with its credentials and everything this computer keeps of it.
   */
  async function relocate(id: string, folder: string): Promise<Project> {
    const project = await get(id)
    if (!(await deps.folders.isReadableFolder(folder))) {
      throw new DomainError('folder_not_readable', folder)
    }
    const projects = await deps.registry.list()
    const taken = projects.some(
      (other) => other.id !== project.id && sameFolder(other.folder, folder),
    )
    if (taken) throw new DomainError('project_already_added', folder)
    const moved: Project = { ...project, folder }
    await deps.registry.save(projects.map((other) => (other.id === project.id ? moved : other)))
    return moved
  }

  return { list, get, add, create, remove, restore, relocate }
}
