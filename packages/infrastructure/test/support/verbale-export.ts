import { mkdir, rm, writeFile } from 'node:fs/promises'
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
  /**
   * Which export of the meeting this is. With it the export is one of a Verbale that counts
   * them: it has `exportedAt`, the list of the participants and a `summary.json`.
   */
  revision?: number
  participants?: Array<{ name: string; email?: string }>
  calendarEventUID?: string
  /** Written in place of the summary; `null` leaves the export without one. */
  summary?: string | null
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

const EXPORT_MINUTE_MS = 60_000

/** What a Verbale that counts its exports adds to the manifest and repeats in the summary. */
function addedFields(meeting: FakeExport): Record<string, unknown> {
  if (meeting.revision === undefined) return {}
  const named = Object.values(meeting.speakers ?? {}).map((name) => ({ name }))
  const participants = meeting.participants ?? named
  const exportedAt = Date.parse(meeting.started) + meeting.revision * EXPORT_MINUTE_MS
  return {
    exportRevision: meeting.revision,
    exportedAt: new Date(exportedAt).toISOString().replace('.000Z', 'Z'),
    ...(participants.length > 0 ? { participants } : {}),
    ...(meeting.calendarEventUID ? { calendarEventUID: meeting.calendarEventUID } : {}),
  }
}

/**
 * Writes an export under the root, in the order Verbale writes it: the manifest of the export
 * before is taken away, then the owner mark, the documents, the attachments, the summary, and
 * the manifest last. Returns the name of its folder.
 */
export async function writeExport(root: string, meeting: FakeExport): Promise<string> {
  const name = exportFolderName(meeting)
  const folder = join(root, name)
  await mkdir(join(folder, 'audio'), { recursive: true })
  await rm(join(folder, 'meeting.json'), { force: true })
  await writeFile(join(folder, '.verbale-id'), meeting.id)
  await writeFile(join(folder, 'transcript.md'), transcriptOf(meeting))
  await writeFile(join(folder, 'transcript.json'), '[]')
  await writeFile(join(folder, 'notes.md'), meeting.notes ?? '')
  await writeFile(join(folder, 'markers.json'), '[]')
  if (meeting.report !== undefined) await writeFile(join(folder, 'report.md'), meeting.report)
  await writeFile(join(folder, 'audio', 'system-0001.wav'), AUDIO_BYTES)
  await writeFile(join(folder, 'screenshot-0001.png'), AUDIO_BYTES)
  const brief = {
    schemaVersion: meeting.schemaVersion ?? 1,
    id: meeting.id,
    title: meeting.title,
    started: meeting.started,
    timezone: 'Europe/Rome',
    duration: meeting.duration,
    state: meeting.state ?? 'complete',
    ...addedFields(meeting),
  }
  const summary =
    meeting.summary === undefined
      ? meeting.revision === undefined
        ? null
        : JSON.stringify(brief)
      : meeting.summary
  if (summary !== null) await writeFile(join(folder, 'summary.json'), summary)
  if (meeting.manifest === null) return name
  const manifest =
    meeting.manifest ??
    JSON.stringify({
      ...brief,
      destination: '',
      exported: true,
      speakers: meeting.speakers ?? {},
      segments: [],
    })
  await writeFile(join(folder, 'meeting.json'), manifest)
  return name
}

/** Writes the file a newer Verbale says its export folder in, inside its own data folder. */
export async function publishDestination(verbaleFolder: string, destination: string) {
  await mkdir(verbaleFolder, { recursive: true })
  const published = { schemaVersion: 1, destination }
  await writeFile(join(verbaleFolder, 'export.json'), JSON.stringify(published))
}
