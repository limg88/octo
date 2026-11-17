import { readdir, readFile, realpath, rmdir, stat } from 'node:fs/promises'
import { dirname, join, relative, resolve, sep } from 'node:path'
import type { ProjectFiles } from '@octo/application'
import { DomainError, EXTRACTED_TEXT_FOLDER, type SourceFileStamp } from '@octo/domain'
import { isMissing, removeFile } from './json-file.ts'

/** Folders never walked: hidden ones, Octo's own, and what package managers fill. */
const SKIPPED_FOLDERS = new Set([EXTRACTED_TEXT_FOLDER.split('/')[0] ?? '', 'node_modules'])
const HIDDEN_PREFIX = '.'
/** The file Office keeps beside a document while it is open. */
const OFFICE_LOCK_PREFIX = '~$'

const portable = (path: string): string => path.split(sep).join('/')

/** Error codes of a folder that cannot be taken away because it is not empty, or is in use. */
const KEPT_FOLDER_CODES = new Set(['ENOTEMPTY', 'EEXIST', 'EBUSY', 'EPERM', 'ENOENT'])

/** Takes away the folder a removed file left empty; never the folder of the project itself. */
async function removeIfEmpty(folder: string, projectRoot: string): Promise<void> {
  if (folder === projectRoot) return
  try {
    await rmdir(folder)
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code ?? ''
    if (!KEPT_FOLDER_CODES.has(code)) throw error
  }
}

/** The real path of a place inside the project; a path or a link leading outside is refused. */
export async function realPathInside(projectFolder: string, relativePath: string): Promise<string> {
  const root = await realpath(projectFolder)
  const target = await realpath(resolve(root, relativePath))
  const fromRoot = relative(root, target)
  if (fromRoot === '..' || fromRoot.startsWith(`..${sep}`) || resolve(root, fromRoot) !== target) {
    throw new DomainError('source_config_invalid', relativePath)
  }
  return target
}

/** Every file under a folder, links not followed, as paths from `base`. */
export async function walkFiles(
  base: string,
  folder: string,
  skipFolders: boolean,
): Promise<string[]> {
  const entries = await readdir(join(base, folder), { withFileTypes: true }).catch(
    (error: unknown) => {
      if (isMissing(error)) return []
      throw error
    },
  )
  const found: string[] = []
  for (const entry of entries) {
    const path = folder ? `${folder}/${entry.name}` : entry.name
    if (entry.isFile()) found.push(path)
    if (!entry.isDirectory()) continue
    const skipped = entry.name.startsWith(HIDDEN_PREFIX) || SKIPPED_FOLDERS.has(entry.name)
    if (!skipFolders || !skipped) found.push(...(await walkFiles(base, path, skipFolders)))
  }
  return found
}

export function createFsProjectFiles(): ProjectFiles {
  return {
    async withExtensions(projectFolder, extensions): Promise<SourceFileStamp[]> {
      const wanted = new Set(extensions)
      const root = await realpath(projectFolder)
      const stamps: SourceFileStamp[] = []
      for (const path of await walkFiles(root, '', true)) {
        const name = path.split('/').at(-1) ?? ''
        const extension = name.includes('.') ? (name.split('.').pop() ?? '').toLowerCase() : ''
        if (!wanted.has(extension) || name.startsWith(OFFICE_LOCK_PREFIX)) continue
        const info = await stat(join(root, path))
        stamps.push({ path, size: info.size, modifiedAt: info.mtime.toISOString() })
      }
      return stamps.sort((a, b) => a.path.localeCompare(b.path))
    },
    read: async (projectFolder, relativePath) =>
      readFile(await realPathInside(projectFolder, relativePath)),
    async readText(projectFolder, relativePath) {
      try {
        return await readFile(await realPathInside(projectFolder, relativePath), 'utf8')
      } catch (error) {
        if (isMissing(error)) return null
        throw error
      }
    },
    async under(projectFolder, folder) {
      const root = await realpath(projectFolder)
      const files = await walkFiles(root, portable(folder), false)
      return files.sort()
    },
    async remove(projectFolder, relativePath) {
      try {
        const file = await realPathInside(projectFolder, relativePath)
        await removeFile(file)
        await removeIfEmpty(dirname(file), await realpath(projectFolder))
      } catch (error) {
        // Already gone: another computer that shares the folder removed it first.
        if (!isMissing(error)) throw error
      }
    },
  }
}
