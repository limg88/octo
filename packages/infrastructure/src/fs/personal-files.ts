import { createHash } from 'node:crypto'
import { readFile, stat } from 'node:fs/promises'
import { join } from 'node:path'
import type { Project } from '@octo/domain'
import { isMissing, removeFile, writeAtomic } from './json-file.ts'

const PRIVATE_FILE_MODE = 0o600
const UNLISTED_PREFIX = 'folder-'
const HASH_LENGTH = 16

/** Tells which project of this computer a folder is; null for a folder that is of none. */
export type ProjectOfFolder = (projectFolder: string) => Promise<Project | null>

/**
 * Where this computer keeps what one person holds of a project: with the app, never in the
 * folder of the project, which other people open too. Kept by the id of the project, so it
 * follows a folder that is moved.
 */
export type PersonalFiles = {
  /** The folder of a project in this area of the app's data. */
  folderOf(projectFolder: string): Promise<string>
  /**
   * The file of this name for the project. `legacyPath` is where an earlier Octo kept it inside
   * the folder of the project: found there, it is taken out of the folder once, when it is of
   * this computer, which is told by the project being here since before the file was written.
   */
  fileOf(projectFolder: string, name: string, legacyPath: string): Promise<string>
}

const exists = (file: string): Promise<boolean> =>
  stat(file).then(
    () => true,
    (error: unknown) => {
      if (isMissing(error)) return false
      throw error
    },
  )

export function createPersonalFiles(
  dataFolder: string,
  area: string,
  projectOf: ProjectOfFolder,
): PersonalFiles {
  const keyOf = (project: Project | null, projectFolder: string): string =>
    project === null
      ? `${UNLISTED_PREFIX}${createHash('sha256').update(projectFolder).digest('hex').slice(0, HASH_LENGTH)}`
      : encodeURIComponent(project.id)

  /** Takes a file out of the folder of the project, when this computer wrote it there. */
  async function takeOver(project: Project, legacy: string, own: string): Promise<void> {
    const written = await stat(legacy).catch((error: unknown) => {
      if (isMissing(error)) return null
      throw error
    })
    const here = Date.parse(project.addedAt)
    if (written === null || Number.isNaN(here) || here > written.mtimeMs) return
    await writeAtomic(own, await readFile(legacy), PRIVATE_FILE_MODE)
    await removeFile(legacy)
  }

  return {
    folderOf: async (projectFolder) =>
      join(dataFolder, area, keyOf(await projectOf(projectFolder), projectFolder)),

    async fileOf(projectFolder, name, legacyPath) {
      const project = await projectOf(projectFolder)
      const own = join(dataFolder, area, keyOf(project, projectFolder), name)
      if (project !== null && !(await exists(own))) {
        await takeOver(project, join(projectFolder, ...legacyPath.split('/')), own)
      }
      return own
    },
  }
}
