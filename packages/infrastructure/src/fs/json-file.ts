import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

export function isMissing(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === 'ENOENT'
}

/** The JSON of a file, or the fallback when the file does not exist. A damaged file throws. */
export async function readJsonOr(file: string, fallback: unknown): Promise<unknown> {
  try {
    return JSON.parse(await readFile(file, 'utf8'))
  } catch (error) {
    if (isMissing(error)) return fallback
    throw error
  }
}

/** Written beside the target and renamed over it: a crash never leaves half a file. */
export async function writeAtomic(
  file: string,
  content: string | Uint8Array,
  mode?: number,
): Promise<void> {
  await mkdir(dirname(file), { recursive: true })
  const temporary = `${file}.${randomUUID()}.tmp`
  await writeFile(temporary, content, mode === undefined ? {} : { mode })
  await rename(temporary, file)
}

export const writeJson = (file: string, value: unknown, mode?: number): Promise<void> =>
  writeAtomic(file, `${JSON.stringify(value, null, 2)}\n`, mode)
