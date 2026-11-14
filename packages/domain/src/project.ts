/** A project is a folder on the PM's computer: the folder is the memory. */
export type Project = {
  id: string
  name: string
  folder: string
  addedAt: string
}

const PATH_SEPARATORS = /[\\/]+/
const FALLBACK_PROJECT_NAME = 'Progetto'

/** The last segment of a folder path, on Windows and on POSIX. */
export function projectNameFromFolder(folder: string): string {
  const segments = folder.split(PATH_SEPARATORS).filter((segment) => segment.length > 0)
  return segments.at(-1) ?? FALLBACK_PROJECT_NAME
}

export function sameFolder(a: string, b: string): boolean {
  return normalizeFolder(a) === normalizeFolder(b)
}

function normalizeFolder(folder: string): string {
  return folder.replace(/[\\/]+$/, '').normalize('NFC')
}
