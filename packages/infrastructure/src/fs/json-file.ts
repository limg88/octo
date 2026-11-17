import { randomUUID } from 'node:crypto'
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
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

/**
 * What a system answers while another program holds a file: a sync client sending it, an
 * antivirus reading it. On Windows a file held open cannot be renamed over nor removed.
 */
const HELD_BY_ANOTHER = new Set(['EPERM', 'EBUSY', 'EACCES'])
const ATTEMPTS = 6
const FIRST_WAIT_MS = 40

export type RetryOptions = {
  /** How long to wait before trying again; the tests do not wait. */
  wait?: (ms: number) => Promise<void>
}

const pause = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Does a thing to a file and, while another program holds the file, tries again a few times,
 * waiting longer each time: who holds it lets go within moments. Any other failure, and the
 * last of these, is thrown as it is.
 */
export async function whileHeld<T>(work: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const wait = options.wait ?? pause
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await work()
    } catch (error) {
      const code = error instanceof Error && 'code' in error ? String(error.code) : ''
      if (attempt >= ATTEMPTS || !HELD_BY_ANOTHER.has(code)) throw error
      await wait(FIRST_WAIT_MS * 2 ** (attempt - 1))
    }
  }
}

/** Removes a file, waiting for who holds it; a file that is not there is already removed. */
export const removeFile = (file: string, options: RetryOptions = {}): Promise<void> =>
  whileHeld(() => rm(file, { force: true }), options)

/**
 * Written beside the target and renamed over it: a crash never leaves half a file. When the
 * rename cannot be done the file written beside is taken away, so nothing is left behind.
 */
export async function writeAtomic(
  file: string,
  content: string | Uint8Array,
  mode?: number,
  options: RetryOptions = {},
): Promise<void> {
  await mkdir(dirname(file), { recursive: true })
  const temporary = `${file}.${randomUUID()}.tmp`
  await writeFile(temporary, content, mode === undefined ? {} : { mode })
  try {
    await whileHeld(() => rename(temporary, file), options)
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => undefined)
    throw error
  }
}

export const writeJson = (file: string, value: unknown, mode?: number): Promise<void> =>
  writeAtomic(file, `${JSON.stringify(value, null, 2)}\n`, mode)
