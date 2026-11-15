import { readFile, realpath, stat } from 'node:fs/promises'
import { relative, resolve, sep } from 'node:path'
import type { EvidenceReader } from '@octo/application'
import { type Evidence, UNCITABLE_FOLDERS } from '@octo/domain'

/** Tracker exports reach tens of megabytes; beyond this a file is reported as too large. */
export const MAX_EVIDENCE_BYTES = 200 * 1024 * 1024

/**
 * Opens a cited file by its real path, so a link cannot lead outside the project folder.
 * An absolute path is accepted only when it lands inside the project.
 */
export function createFsEvidenceReader(maxBytes = MAX_EVIDENCE_BYTES): EvidenceReader {
  return {
    async read(projectFolder, citedPath): Promise<Evidence> {
      const root = await realpath(projectFolder)
      const target = await realpathOrNull(resolve(root, citedPath))
      if (target === null) {
        return isInside(root, resolve(root, citedPath)) ? { kind: 'missing' } : { kind: 'outside' }
      }
      if (!isInside(root, target)) return { kind: 'outside' }
      // Earlier answers, settings and costs are not sources: a citation of them is never verified.
      if (UNCITABLE_FOLDERS.some((folder) => isInside(resolve(root, folder), target))) {
        return { kind: 'missing' }
      }
      const info = await stat(target)
      if (!info.isFile()) return { kind: 'missing' }
      if (info.size > maxBytes) return { kind: 'too_large' }
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
