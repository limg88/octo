import type { ArchivedMail, MailMessage, MailPerson } from './message.ts'
import { ownText } from './quoted.ts'

/** A mail as a file of the project's memory: where it goes and what it says. */
export type MailDocument = {
  /** What tells this mail from any other: its Message-ID, or the archive's own id. */
  externalId: string
  /** Path inside the mail folder of the project, with `/` on every system. */
  relativePath: string
  content: string
  receivedAt: Date
}

export type MailDocumentOptions = {
  /** Whether the text keeps the messages quoted under what the author wrote. */
  keepQuoted: boolean
}

const NO_SUBJECT = '(senza oggetto)'
const MAX_SLUG_LENGTH = 60
const HASH_LENGTH = 8
const FNV_OFFSET = 0x811c9dc5
const FNV_PRIME = 0x01000193

const named = (person: MailPerson): string =>
  person.name ? `${person.name} <${person.email}>` : person.email

/** A short stable mark of a text (FNV-1a): tells two mails with the same subject and minute. */
export function shortHash(text: string): string {
  let hash = FNV_OFFSET
  for (const char of text) {
    hash ^= char.codePointAt(0) ?? 0
    hash = Math.imul(hash, FNV_PRIME) >>> 0
  }
  return hash.toString(16).padStart(HASH_LENGTH, '0')
}

/** A subject as part of a file name on any system: letters, digits and dashes. */
export function slugOf(text: string): string {
  const slug = text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/, '')
  return slug || 'mail'
}

const headerValue = (value: string): string => JSON.stringify(value)

/** What the mail answers, written only when it answers something: an old file stays as it was. */
function threadLines(message: MailMessage): string[] {
  const references = message.references ?? []
  return [
    ...(message.inReplyTo ? [`risponde-a: ${headerValue(message.inReplyTo)}`] : []),
    ...(references.length > 0 ? [`riferimenti: ${headerValue(references.join(' '))}`] : []),
  ]
}

/** The meeting of an invitation, and whether the invitation calls it or calls it off. */
function meetingLines(message: MailMessage): string[] {
  const meeting = message.meeting
  if (!meeting) return []
  return [
    `invito: ${headerValue(message.calendarMethod ?? '')}`,
    `riunione: ${headerValue(meeting.summary)}`,
    `riunione-id: ${headerValue(meeting.uid)}`,
    `riunione-inizio: ${headerValue(meeting.start)}`,
    `riunione-fine: ${headerValue(meeting.end ?? '')}`,
    `riunione-luogo: ${headerValue(meeting.location)}`,
  ]
}

/** A mail of the memory read back from its file: what the page of the day needs of it. */
export type StoredMail = {
  id: string
  /** Path inside the project folder. */
  path: string
  subject: string
  from: string
  to: string
  cc: string
  /** When it was sent, as an instant. */
  date: string
  inReplyTo: string | null
  references: string[]
  invite: string | null
  meeting: {
    uid: string
    summary: string
    start: string
    end: string | null
    location: string
  } | null
  /** Whether what its author wrote holds a question. */
  asks: boolean
}

const HEADER_LINE = /^([a-z-]+): (".*")$/

/** The mail a file of the memory holds, or null when the file is not one of Octo's mails. */
export function parseMailDocument(path: string, content: string): StoredMail | null {
  const lines = content.split('\n')
  if (lines[0] !== '---') return null
  const end = lines.indexOf('---', 1)
  if (end < 0) return null
  const header = new Map<string, string>()
  for (const line of lines.slice(1, end)) {
    const found = HEADER_LINE.exec(line)
    if (!found) continue
    try {
      header.set(found[1] as string, String(JSON.parse(found[2] as string)))
    } catch {
      return null
    }
  }
  const id = header.get('id')
  const date = header.get('data')
  if (header.get('tipo') !== 'email' || !id || !date || Number.isNaN(Date.parse(date))) return null
  const start = header.get('riunione-inizio') ?? ''
  const uid = header.get('riunione-id') ?? ''
  return {
    id,
    path,
    subject: header.get('oggetto') ?? '',
    from: header.get('da') ?? '',
    to: header.get('a') ?? '',
    cc: header.get('cc') ?? '',
    date,
    inReplyTo: header.get('risponde-a') || null,
    references: (header.get('riferimenti') ?? '').split(' ').filter((entry) => entry !== ''),
    invite: header.get('invito') || null,
    meeting:
      uid !== '' && !Number.isNaN(Date.parse(start))
        ? {
            uid,
            summary: header.get('riunione') ?? '',
            start,
            end: header.get('riunione-fine') || null,
            location: header.get('riunione-luogo') ?? '',
          }
        : null,
    asks: lines
      .slice(end + 1)
      .filter((line) => !line.startsWith('#'))
      .join('\n')
      .includes('?'),
  }
}

/**
 * The mail as a Markdown file: a header of `key: "value"` lines a search can match, then what
 * its author wrote. One month per folder; the name starts with the day, so a listing is a
 * timeline.
 */
export function mailDocument(
  archived: ArchivedMail,
  message: MailMessage,
  options: MailDocumentOptions,
): MailDocument {
  const externalId = message.messageId ?? `archive:${archived.id}`
  const at = (message.sentAt ?? archived.receivedAt).toISOString()
  const subject = message.subject || NO_SUBJECT
  const day = at.slice(0, 10)
  const minute = at.slice(11, 16).replace(':', '')
  const header = [
    '---',
    'tipo: "email"',
    `oggetto: ${headerValue(subject)}`,
    `da: ${headerValue(message.from ? named(message.from) : '')}`,
    `a: ${headerValue(message.to.map(named).join(', '))}`,
    `cc: ${headerValue(message.cc.map(named).join(', '))}`,
    `data: ${headerValue(at)}`,
    `cartella: ${headerValue(archived.folder)}`,
    `allegati: ${headerValue(message.attachments.join(', '))}`,
    `id: ${headerValue(externalId)}`,
    ...threadLines(message),
    ...meetingLines(message),
    '---',
  ]
  const body = options.keepQuoted ? message.text : ownText(message.text)
  return {
    externalId,
    relativePath: `${day.slice(0, 7)}/${day}_${minute}_${slugOf(subject)}_${shortHash(externalId)}.md`,
    content: `${[...header, '', `# ${subject}`, '', body].join('\n')}\n`,
    receivedAt: archived.receivedAt,
  }
}
