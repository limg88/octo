import { lstat, readdir, readFile, stat } from 'node:fs/promises'
import { join, resolve, sep } from 'node:path'
import type { MeetingExports } from '@octo/application'
import {
  DomainError,
  MEETING_MANIFEST_FILE,
  type MeetingReading,
  readMeetingManifest,
} from '@octo/domain'
import { isMissing } from './json-file.ts'

export type MeetingExportsOptions = {
  /** The home of who uses Octo: what `~` stands for in a root. */
  home: string
  /** Where Verbale keeps its own sessions; by default its folder in the user's library. */
  sessionsFolder?: string
}

/** The file Verbale leaves in every folder it exports, from the first moment. */
const OWNER_FILE = '.verbale-id'
const HIDDEN_PREFIX = '.'
const HOME_MARK = '~'
/** Sessions looked at to tell where Verbale exports: the newest ones say where it does now. */
const SESSIONS_PROBED = 5
const VERBALE_SESSIONS = ['Library', 'Application Support', 'Verbale', 'Sessions']

const isPlainName = (name: string): boolean =>
  name !== '' && name !== '.' && name !== '..' && !/[\\/]/.test(name)

/**
 * Reads the folder Verbale exports to, and nothing else of Verbale but the place it names for
 * its exports. A manifest is read again only when its file changed.
 */
export function createFsMeetingExports(options: MeetingExportsOptions): MeetingExports {
  const sessions = options.sessionsFolder ?? join(options.home, ...VERBALE_SESSIONS)
  const readings = new Map<string, { stamp: string; reading: MeetingReading }>()

  const expanded = (root: string): string =>
    root === HOME_MARK || root.startsWith(`${HOME_MARK}/`)
      ? join(options.home, root.slice(HOME_MARK.length))
      : root

  const shortened = (folder: string): string => {
    if (folder === options.home) return HOME_MARK
    if (!folder.startsWith(`${options.home}${sep}`)) return folder
    const inside = folder
      .slice(options.home.length + 1)
      .split(sep)
      .join('/')
    return `${HOME_MARK}/${inside}`
  }

  async function readingOf(root: string, folder: string): Promise<MeetingReading | null> {
    const manifest = join(root, folder, MEETING_MANIFEST_FILE)
    const info = await stat(manifest).catch(() => null)
    if (info === null) {
      // A folder Verbale has not marked is somebody else's: it is not even mentioned.
      const marked = await stat(join(root, folder, OWNER_FILE)).catch(() => null)
      return marked ? readMeetingManifest(folder, null) : null
    }
    const stamp = `${info.mtimeMs}:${info.size}`
    const known = readings.get(manifest)
    if (known?.stamp === stamp) return known.reading
    const reading = readMeetingManifest(folder, await readFile(manifest, 'utf8'))
    readings.set(manifest, { stamp, reading })
    return reading
  }

  return {
    async defaultRoot() {
      const folders = await readdir(sessions).catch(() => [])
      const manifests: Array<{ file: string; at: number }> = []
      for (const folder of folders) {
        const file = join(sessions, folder, MEETING_MANIFEST_FILE)
        const info = await stat(file).catch(() => null)
        if (info) manifests.push({ file, at: info.mtimeMs })
      }
      manifests.sort((a, b) => b.at - a.at)
      for (const { file } of manifests.slice(0, SESSIONS_PROBED)) {
        const destination = await readFile(file, 'utf8')
          .then((text) => (JSON.parse(text) as { destination?: unknown }).destination)
          .catch(() => null)
        if (typeof destination !== 'string' || destination === '') continue
        const isFolder = await stat(destination).then(
          (info) => info.isDirectory(),
          () => false,
        )
        if (isFolder) return shortened(destination)
      }
      return null
    },

    portable: (root) => shortened(resolve(expanded(root))),

    async list(root) {
      const folder = expanded(root)
      const entries = await readdir(folder, { withFileTypes: true }).catch(() => {
        throw new DomainError('meetings_root_unreadable', root)
      })
      const names = entries
        .filter((entry) => entry.isDirectory() && !entry.name.startsWith(HIDDEN_PREFIX))
        .map((entry) => entry.name)
        .sort()
      const found: MeetingReading[] = []
      for (const name of names) {
        const reading = await readingOf(folder, name)
        if (reading) found.push(reading)
      }
      return found
    },

    async read(root, folder, file) {
      if (!isPlainName(folder) || !isPlainName(file)) {
        throw new DomainError('source_config_invalid', `${folder}/${file}`)
      }
      const path = join(expanded(root), folder, file)
      try {
        // A link is not followed: what it points to is not part of the export.
        if (!(await lstat(path)).isFile()) return null
        return await readFile(path, 'utf8')
      } catch (error) {
        if (isMissing(error)) return null
        throw error
      }
    },
  }
}
