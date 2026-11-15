import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

/** A synthetic export of Verbale: the files its `SessionStore.export` leaves in a folder. */
export type FakeExport = {
  id: string
  title: string
  /** When it started, as Verbale writes it: ISO 8601 without fractions. */
  started: string
  /** Seconds. */
  duration: number
  state?: string
  schemaVersion?: number
  speakers?: Record<string, string>
  notes?: string
  /** What was said, one line per passage. */
  passages?: string[]
  /** The automatic report; absent when Verbale was not asked for one. */
  report?: string
  /** Written in place of the manifest; `null` leaves the export without one. */
  manifest?: string | null
}

const ID_PREFIX_LENGTH = 8
const AUDIO_BYTES = new Uint8Array([82, 73, 70, 70])

/** The name Verbale gives to the folder of a meeting: day and time, title, start of the id. */
export function exportFolderName(meeting: Pick<FakeExport, 'id' | 'title' | 'started'>): string {
  const stamp = meeting.started.replace(/[-:]/g, '').replace('T', '_').slice(0, 15)
  const day = `${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}`
  const safe = meeting.title.replace(/[^\p{L}\p{N}_-]/gu, '_')
  return `${day}_${stamp.slice(9)}_${safe}_${meeting.id.slice(0, ID_PREFIX_LENGTH)}`
}

const transcriptOf = (meeting: FakeExport): string =>
  `# ${meeting.title}\n\n${(meeting.passages ?? ['Buongiorno a tutti.'])
    .map(
      (text, at) =>
        `<a id="segment-${at + 1}"></a>\n\n[00:00:${String(at * 10).padStart(2, '0')}] **Voce ${at + 1}**: ${text}`,
    )
    .join('\n\n')}\n`

/**
 * Writes an export under the root, in the order Verbale writes it: the owner mark, the
 * documents, the attachments, and the manifest last. Returns the name of its folder.
 */
export async function writeExport(root: string, meeting: FakeExport): Promise<string> {
  const name = exportFolderName(meeting)
  const folder = join(root, name)
  await mkdir(join(folder, 'audio'), { recursive: true })
  await writeFile(join(folder, '.verbale-id'), meeting.id)
  await writeFile(join(folder, 'transcript.md'), transcriptOf(meeting))
  await writeFile(join(folder, 'transcript.json'), '[]')
  await writeFile(join(folder, 'notes.md'), meeting.notes ?? '')
  await writeFile(join(folder, 'markers.json'), '[]')
  if (meeting.report !== undefined) await writeFile(join(folder, 'report.md'), meeting.report)
  await writeFile(join(folder, 'audio', 'system-0001.wav'), AUDIO_BYTES)
  await writeFile(join(folder, 'screenshot-0001.png'), AUDIO_BYTES)
  if (meeting.manifest === null) return name
  const manifest =
    meeting.manifest ??
    JSON.stringify({
      schemaVersion: meeting.schemaVersion ?? 1,
      id: meeting.id,
      title: meeting.title,
      started: meeting.started,
      timezone: 'Europe/Rome',
      duration: meeting.duration,
      state: meeting.state ?? 'complete',
      destination: '',
      speakers: meeting.speakers ?? {},
      segments: [],
    })
  await writeFile(join(folder, 'meeting.json'), manifest)
  return name
}
