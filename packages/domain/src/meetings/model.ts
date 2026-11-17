import { DomainError } from '../errors.ts'
import { OCTO_FOLDER } from '../extracted-document.ts'
import { documentHeader, slugOf } from '../mail/document.ts'
import { PRODUCT_TIME_ZONE, romeDateString } from '../rome-time.ts'
import { startOfDay } from '../sources.ts'

/** How the meetings recorded by Verbale reach a project: the folder Verbale exports to. */
export type MeetingsSourceConfig = {
  /** The export folder of Verbale on this computer; `~` stands for the home of who uses it. */
  root: string
  /**
   * The first day taken, `YYYY-MM-DD`; null takes every meeting the folder holds. What Verbale
   * recorded before the project was linked is seldom of the project.
   */
  since: string | null
  /**
   * The meetings the PM took away from the project, by their id: the project never takes them
   * again, whatever its invitations and its words say.
   */
  released?: string[] | undefined
}

/** Where Octo keeps the meetings of a project, one folder each. */
export const MEETINGS_FOLDER = `${OCTO_FOLDER}/riunioni`
/** What the last reading left out and why, for the PM to read. */
export const MEETINGS_READING_PATH = `${MEETINGS_FOLDER}/_lettura.md`
export const MEETING_META_FILE = '_meta.md'
/** The file Verbale writes last: an export without it is not finished. */
export const MEETING_MANIFEST_FILE = 'meeting.json'
/** The files of an export that are text: the only ones taken. No audio, no screenshots. */
export const MEETING_TEXT_FILES = [
  'transcript.md',
  'notes.md',
  'report.md',
  'markers.json',
] as const
export const MEETING_TRANSCRIPT_FILE = 'transcript.md'
/** The versions of Verbale's manifest Octo knows how to read. */
export const SUPPORTED_MEETING_SCHEMAS: readonly number[] = [1]
const COMPLETE_STATE = 'complete'

/** A meeting Verbale finished exporting, as far as Octo needs to know. */
export type RecordedMeeting = {
  id: string
  title: string
  /** When it started, as an instant. */
  started: string
  timezone: string
  durationSeconds: number
  /** The people Verbale names, with the address when it knows it; empty when it names nobody. */
  participants: string[]
  /** The event of the calendar the recording started from; null when Verbale does not know it. */
  calendarEventUID: string | null
  onlineMeetingURL: string | null
  /** Which export of the meeting this is; null in an export made before Verbale counted them. */
  exportRevision: number | null
  exportedAt: string | null
}

export const MEETING_SKIP_REASONS = [
  'no_manifest',
  'corrupt',
  'invalid',
  'schema',
  'not_complete',
  'changing',
] as const
export type MeetingSkipReason = (typeof MEETING_SKIP_REASONS)[number]

/** What a folder of the export root is: a finished meeting, or one left out with its reason. */
export type MeetingReading = { folder: string } & (
  | { status: 'complete'; meeting: RecordedMeeting }
  | { status: 'skipped'; reason: MeetingSkipReason; detail: string }
)

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ABSOLUTE_ROOT = /^(?:\/|~(?:\/|$)|[A-Za-z]:[\\/])/
const ID_PREFIX_LENGTH = 8
const SECONDS_PER_MINUTE = 60
const FALLBACK_SLUG = 'riunione'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const textOf = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : null

/** A participant as Verbale lists it: the name, with the address when there is one. */
function listedPerson(entry: unknown): string | null {
  if (!isRecord(entry)) return null
  const name = textOf(entry.name)
  const email = textOf(entry.email)
  return name !== null && email !== null ? `${name} <${email}>` : name
}

/**
 * The people of a meeting, each once, in alphabetical order: those Verbale lists as participants
 * or, in an export that has no such list, the names it gave to the voices.
 */
function participantsOf(participants: unknown, speakers: unknown): string[] {
  const names = Array.isArray(participants)
    ? participants.map(listedPerson)
    : isRecord(speakers)
      ? Object.values(speakers).map(textOf)
      : []
  const known = names.filter((name): name is string => name !== null)
  return [...new Set(known)].sort((a, b) => a.localeCompare(b, 'it'))
}

const instantOf = (value: unknown): string | null =>
  typeof value === 'string' && !Number.isNaN(Date.parse(value))
    ? new Date(value).toISOString()
    : null

/**
 * What the manifest of an export folder says, or its summary: the two have the same fields. The
 * text is null when the folder has no manifest yet. The version is looked at first: a manifest of a version Octo does not know is not judged
 * by the fields of the one it knows.
 */
export function readMeetingManifest(folder: string, text: string | null): MeetingReading {
  const skipped = (reason: MeetingSkipReason, detail = ''): MeetingReading => ({
    folder,
    status: 'skipped',
    reason,
    detail,
  })
  if (text === null) return skipped('no_manifest')
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return skipped('corrupt')
  }
  if (!isRecord(raw)) return skipped('invalid')
  const version = raw.schemaVersion
  if (typeof version !== 'number') return skipped('invalid', 'schemaVersion')
  if (!SUPPORTED_MEETING_SCHEMAS.includes(version)) return skipped('schema', String(version))
  const { id, title, started, timezone, duration, state } = raw
  const valid =
    typeof id === 'string' &&
    UUID.test(id) &&
    typeof title === 'string' &&
    typeof started === 'string' &&
    !Number.isNaN(Date.parse(started)) &&
    typeof duration === 'number' &&
    Number.isFinite(duration) &&
    duration >= 0 &&
    typeof state === 'string'
  if (!valid) return skipped('invalid')
  if (state !== COMPLETE_STATE) return skipped('not_complete', state as string)
  return {
    folder,
    status: 'complete',
    meeting: {
      id: (id as string).toLowerCase(),
      title: (title as string).trim(),
      started: new Date(started as string).toISOString(),
      timezone: typeof timezone === 'string' ? timezone : '',
      durationSeconds: duration as number,
      participants: participantsOf(raw.participants, raw.speakers),
      calendarEventUID: textOf(raw.calendarEventUID),
      onlineMeetingURL: textOf(raw.onlineMeetingURL),
      exportRevision: typeof raw.exportRevision === 'number' ? raw.exportRevision : null,
      exportedAt: instantOf(raw.exportedAt),
    },
  }
}

/**
 * Whether two readings of a folder are of the same export: the same meeting, published once.
 * An export made before Verbale counted them is the same as long as its manifest is there.
 */
export function sameExport(before: RecordedMeeting, after: MeetingReading): boolean {
  return (
    after.status === 'complete' &&
    after.meeting.id === before.id &&
    after.meeting.exportRevision === before.exportRevision &&
    after.meeting.exportedAt === before.exportedAt
  )
}

/** The configuration as it is saved: trimmed, and a folder named from the root of the disk. */
export function cleanMeetingsSource(config: MeetingsSourceConfig): MeetingsSourceConfig {
  const root = config.root.trim().replace(/(?<=.)[\\/]+$/, '')
  if (!ABSOLUTE_ROOT.test(root)) throw new DomainError('source_config_invalid', `root: ${root}`)
  const since = config.since?.trim() || null
  if (since !== null) startOfDay(since)
  const released = [...new Set((config.released ?? []).map((id) => id.trim()))].filter(
    (id) => id !== '',
  )
  return released.length > 0 ? { root, since, released } : { root, since }
}

const FOLDER_DAY = /^(\d{4}-\d{2}-\d{2})_/

/**
 * Whether a folder of the export root is from before the first day taken. A finished meeting is
 * judged by when it started; one left out has no date Octo can trust, so the day Verbale put
 * in the name of its folder is used, and a folder without one is kept.
 */
export function beforeFirstDay(reading: MeetingReading, since: string | null): boolean {
  if (since === null) return false
  const first = startOfDay(since).getTime()
  if (reading.status === 'complete') return Date.parse(reading.meeting.started) < first
  const day = FOLDER_DAY.exec(reading.folder)?.[1]
  return day !== undefined && Date.parse(`${day}T00:00:00.000Z`) < first
}

export const meetingMinutes = (meeting: Pick<RecordedMeeting, 'durationSeconds'>): number =>
  Math.round(meeting.durationSeconds / SECONDS_PER_MINUTE)

/** The folder of a meeting in the project: its day, its title, the start of its id. */
export function meetingFolderName(meeting: RecordedMeeting): string {
  const slug = /[\p{L}\p{N}]/u.test(meeting.title) ? slugOf(meeting.title) : FALLBACK_SLUG
  const day = romeDateString(new Date(meeting.started))
  return `${day}_${slug}_${meeting.id.slice(0, ID_PREFIX_LENGTH)}`
}

const WHEN = new Intl.DateTimeFormat('it-IT', {
  timeZone: PRODUCT_TIME_ZONE,
  dateStyle: 'short',
  timeStyle: 'short',
})
const headerValue = (value: string): string => JSON.stringify(value)
const TEXT_FILE_ROLES: Readonly<Record<(typeof MEETING_TEXT_FILES)[number], string>> = {
  'transcript.md': 'la trascrizione, con un’ancora per ogni intervento',
  'notes.md': 'gli appunti presi durante la riunione',
  'report.md': 'il riepilogo automatico di Verbale: non è una fonte',
  'markers.json': 'i momenti segnati durante la riunione',
}

/**
 * What Octo writes beside the files of a meeting: when it was, how long, who spoke and where it
 * comes from. Its header is how the meeting is found again.
 */
export function meetingMeta(
  meeting: RecordedMeeting,
  exportFolder: string,
  files: readonly (typeof MEETING_TEXT_FILES)[number][],
): string {
  const people = meeting.participants.join(', ')
  const minutes = meetingMinutes(meeting)
  const header = [
    '---',
    'tipo: "riunione"',
    `id: ${headerValue(meeting.id)}`,
    `titolo: ${headerValue(meeting.title)}`,
    `data: ${headerValue(meeting.started)}`,
    `durata-minuti: ${headerValue(String(minutes))}`,
    `partecipanti: ${headerValue(people)}`,
    `origine: ${headerValue(`Verbale · ${exportFolder}`)}`,
    '---',
  ]
  const body = [
    `# ${meeting.title}`,
    '',
    `- Data: ${WHEN.format(new Date(meeting.started))} (ora italiana)`,
    `- Durata: ${minutes} minuti`,
    ...(people === '' ? [] : [`- Partecipanti: ${people}`]),
    ...(meeting.onlineMeetingURL === null
      ? []
      : [`- Riunione online: ${meeting.onlineMeetingURL}`]),
    `- Origine: registrata con Verbale, cartella \`${exportFolder}\``,
    '',
    '## File',
    '',
    ...files.map((file) => `- \`${file}\`: ${TEXT_FILE_ROLES[file]}`),
  ]
  return `${[...header, '', ...body].join('\n')}\n`
}

/** A meeting of the memory read back from its `_meta.md`. */
export type StoredMeeting = {
  id: string
  title: string
  started: string
  minutes: number
  participants: string[]
  /** Its folder, inside the project folder. */
  folder: string
}

/** The meeting a `_meta.md` describes, or null when the file is not one Octo wrote. */
export function parseMeetingMeta(path: string, content: string): StoredMeeting | null {
  const header = documentHeader(content)?.fields
  const id = header?.get('id')
  const started = header?.get('data')
  if (header?.get('tipo') !== 'riunione' || !id || !started || Number.isNaN(Date.parse(started))) {
    return null
  }
  return {
    id,
    title: header.get('titolo') ?? '',
    started,
    minutes: Number(header.get('durata-minuti') ?? 0) || 0,
    participants: (header.get('partecipanti') ?? '').split(', ').filter((name) => name !== ''),
    folder: path.split('/').slice(0, -1).join('/'),
  }
}

const SKIP_WORDS: Readonly<Record<MeetingSkipReason, string>> = {
  no_manifest: 'esportazione non conclusa (manca `meeting.json`)',
  corrupt: '`meeting.json` non si legge: non è JSON valido',
  invalid: '`meeting.json` non ha i campi attesi',
  schema: 'versione del formato non supportata',
  not_complete: 'riunione non completa',
  changing: 'esportata di nuovo durante la lettura: la riprendo alla prossima',
}

/**
 * What the last reading of Verbale's folder left out, in words: the folders skipped with their
 * reason, and the finished meetings no project could be told for. No date in it: the file
 * changes only when what it says changes.
 */
export function meetingsReadingNote(
  root: string,
  skipped: readonly Extract<MeetingReading, { status: 'skipped' }>[],
  unassigned: readonly Extract<MeetingReading, { status: 'complete' }>[],
): string {
  const skippedLines = skipped.map(
    ({ folder, reason, detail }) =>
      `- \`${folder}\`: ${SKIP_WORDS[reason]}${detail === '' ? '' : ` (${detail})`}`,
  )
  const unassignedLines = unassigned.map(
    ({ folder, meeting }) =>
      `- \`${folder}\`: «${meeting.title}» del ${romeDateString(new Date(meeting.started))}`,
  )
  return `${[
    '# Riunioni di Verbale: che cosa non è entrato',
    '',
    `Cartella letta: \`${root}\``,
    '',
    '## Cartelle saltate',
    '',
    ...(skippedLines.length > 0 ? skippedLines : ['Nessuna.']),
    '',
    '## Riunioni senza progetto',
    '',
    'Nessun invito in memoria e nessuna parola chiave le lega a un solo progetto: si assegnano a mano dalla pagina «Oggi».',
    '',
    ...(unassignedLines.length > 0 ? unassignedLines : ['Nessuna.']),
  ].join('\n')}\n`
}
