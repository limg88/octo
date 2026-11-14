import { readFile, realpath, stat } from 'node:fs/promises'
import { relative, resolve, sep } from 'node:path'
import type { EvidenceReader } from '@octo/application'
import type { Evidence } from '@octo/domain'

/** A cited file larger than this is not opened: it is not a text a PM wrote or received. */
export const MAX_EVIDENCE_BYTES = 20 * 1024 * 1024

/**
 * Opens a cited file by its real path, so a link cannot lead outside the project folder.
 * An absolute path is accepted only when it lands inside the project.
 */
export function createFsEvidenceReader(): EvidenceReader {
  return {
    async read(projectFolder, citedPath): Promise<Evidence> {
      const root = await realpath(projectFolder)
      const target = await realpathOrNull(resolve(root, citedPath))
      if (target === null) {
        return isInside(root, resolve(root, citedPath)) ? { kind: 'missing' } : { kind: 'outside' }
      }
      if (!isInside(root, target)) return { kind: 'outside' }
      const info = await stat(target)
      if (!info.isFile() || info.size > MAX_EVIDENCE_BYTES) return { kind: 'missing' }
      return {
        kind: 'found',
        text: await readFile(target, 'utf8'),
        modifiedAt: info.mtime.toISOString(),
      }
    },
  }
}

async function realpathOrNull(path: string): Promise<string | null> {
  try {
    return await realpath(path)
  } catch {
    return null
  }
}

function isInside(root: string, target: string): boolean {
  const fromRoot = relative(root, target)
  return fromRoot.length > 0 && !fromRoot.startsWith(`..${sep}`) && fromRoot !== '..'
}
