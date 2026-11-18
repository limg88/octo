import { mkdir, readdir, readFile, rm } from 'node:fs/promises'
import { join, relative, resolve, sep } from 'node:path'
import type { WorkFolders } from '@octo/application'
import { DomainError } from '@octo/domain'
import { isMissing } from './json-file.ts'

const WORK_AREA = 'lavoro'
/** A run that wrote more files than this did something else than a calculation. */
const MAX_FILES = 200
const SAFE_NAME = /^[A-Za-z0-9._-]+$/

/**
 * The folders the agent writes in when it computes, among the state of the app on this
 * computer: `<data>/lavoro/<project>/<run>/`. Never inside a project folder: the sandbox lets
 * a run write there and nowhere else.
 */
export function createFsWorkFolders(dataFolder: string): WorkFolders {
  const folderOf = (projectId: string, runId: string): string => {
    if (!SAFE_NAME.test(projectId) || !SAFE_NAME.test(runId))
      throw new DomainError('work_not_found')
    return join(dataFolder, WORK_AREA, projectId, runId)
  }

  async function filesIn(root: string, folder = root): Promise<string[]> {
    const entries = await readdir(folder, { withFileTypes: true })
    const found: string[] = []
    for (const entry of entries) {
      const path = join(folder, entry.name)
      // A link could lead anywhere: what a run left is only its own files.
      if (entry.isDirectory()) found.push(...(await filesIn(root, path)))
      else if (entry.isFile()) found.push(relative(root, path).split(sep).join('/'))
    }
    return found
  }

  return {
    async create(projectId, runId) {
      const folder = folderOf(projectId, runId)
      await rm(folder, { recursive: true, force: true })
      await mkdir(folder, { recursive: true })
      return folder
    },
    async files(projectId, runId) {
      try {
        return (await filesIn(folderOf(projectId, runId))).sort().slice(0, MAX_FILES)
      } catch (error) {
        if (isMissing(error)) return []
        throw error
      }
    },
    async read(projectId, runId, name) {
      const root = folderOf(projectId, runId)
      const file = resolve(root, name)
      if (!file.startsWith(`${root}${sep}`)) throw new DomainError('work_not_found')
      try {
        return await readFile(file)
      } catch (error) {
        if (isMissing(error)) throw new DomainError('work_not_found')
        throw error
      }
    },
  }
}
