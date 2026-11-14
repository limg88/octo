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
