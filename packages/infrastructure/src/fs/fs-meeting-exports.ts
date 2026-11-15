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
  /** Where Verbale keeps its own data; by default its folder in the user's library. */
  verbaleFolder?: string
}

/** The file Verbale leaves in every folder it exports, from the first moment. */
const OWNER_FILE = '.verbale-id'
const HIDDEN_PREFIX = '.'
const HOME_MARK = '~'
/** Sessions looked at to tell where Verbale exports: the newest ones say where it does now. */
const SESSIONS_PROBED = 5
const VERBALE_FOLDER = ['Library', 'Application Support', 'Verbale']
const SESSIONS_FOLDER = 'Sessions'
/** Where Verbale says which folder it exports to; absent in a Verbale that does not say it. */
const DESTINATION_FILE = 'export.json'
const DESTINATION_SCHEMA = 1
/** The light copy of the manifest a newer Verbale writes beside it. */
const SUMMARY_FILE = 'summary.json'
/** What a summary that cannot be used reads as: then the manifest itself is read. */
const UNUSABLE: readonly string[] = ['corrupt', 'invalid']

const isPlainName = (name: string): boolean =>
  name !== '' && name !== '.' && name !== '..' && !/[\\/]/.test(name)

/**
 * Reads the folder Verbale exports to, and nothing else of Verbale but the place it names for
 * its exports. A manifest is read again only when its file changed.
 */
export function createFsMeetingExports(options: MeetingExportsOptions): MeetingExports {
  const verbale = options.verbaleFolder ?? join(options.home, ...VERBALE_FOLDER)
  const sessions = join(verbale, SESSIONS_FOLDER)
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

  const textOrNull = (file: string): Promise<string | null> =>
    readFile(file, 'utf8').catch((error: unknown) => {
      if (isMissing(error)) return null
      throw error
    })

  /**
   * What an export folder is. The summary is read in place of the manifest when it is there and
   * says something: the manifest holds every word of the meeting, the summary a few lines. The
   * manifest must be there all the same: it is what says that the export is finished.
   */
  async function readingOf(root: string, folder: string): Promise<MeetingReading | null> {
    const manifest = join(root, folder, MEETING_MANIFEST_FILE)
    const summary = join(root, folder, SUMMARY_FILE)
    const info = await stat(manifest).catch(() => null)
    if (info === null) {
      // A folder Verbale has not marked is somebody else's: it is not even mentioned.
      const marked = await stat(join(root, folder, OWNER_FILE)).catch(() => null)
      return marked ? readMeetingManifest(folder, null) : null
    }
    const light = await stat(summary).catch(() => null)
    const stamp = `${info.mtimeMs}:${info.size}:${light?.mtimeMs ?? ''}:${light?.size ?? ''}`
    const known = readings.get(manifest)
    if (known?.stamp === stamp) return known.reading
    const brief = light ? await textOrNull(summary) : null
    const fromSummary = brief === null ? null : readMeetingManifest(folder, brief)
    const usable =
      fromSummary !== null &&
      !(fromSummary.status === 'skipped' && UNUSABLE.includes(fromSummary.reason))
    // Taken away between the look and the reading: Verbale is exporting the meeting again.
    const reading = usable ? fromSummary : readMeetingManifest(folder, await textOrNull(manifest))
    if (!(reading.status === 'skipped' && reading.reason === 'no_manifest')) {
      readings.set(manifest, { stamp, reading })
    }
    return reading
  }

  /** The folder Verbale says it exports to, when it says it and the folder is there. */
  async function publishedRoot(): Promise<string | null> {
    const published = await readFile(join(verbale, DESTINATION_FILE), 'utf8')
      .then((text) => JSON.parse(text) as { schemaVersion?: unknown; destination?: unknown })
      .catch(() => null)
    const destination = published?.destination
    if (published?.schemaVersion !== DESTINATION_SCHEMA || typeof destination !== 'string') {
      return null
    }
    return (await isFolder(destination)) ? shortened(destination) : null
  }

  const isFolder = (path: string): Promise<boolean> =>
    stat(path).then(
      (info) => info.isDirectory(),
      () => false,
    )

  return {
    async defaultRoot() {
      const published = await publishedRoot()
      if (published !== null) return published
      // A Verbale that does not say it yet: its own sessions name the folder they went to.
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
        if (await isFolder(destination)) return shortened(destination)
      }
      return null
    },

    async reading(root, folder) {
      if (!isPlainName(folder)) throw new DomainError('source_config_invalid', folder)
      return readingOf(expanded(root), folder)
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
