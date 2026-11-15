import {
  htmlToText,
  type MailMeeting,
  type MailMessage,
  type MailPerson,
  parseInvite,
  tidyText,
} from '@octo/domain'
import PostalMime, { type Address } from 'postal-mime'

/** A file that is not what Mail writes: no length line, or a length past its end. */
export class MailFormatError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MailFormatError'
  }
}

const LINE_FEED = 0x0a
const CALENDAR_TYPE = 'text/calendar'

/** The bytes of the message inside an `.emlx` file: what follows the first line, for its length. */
export function messageBytes(file: Uint8Array): Uint8Array {
  const lineEnd = file.indexOf(LINE_FEED)
  const length = lineEnd > 0 ? Number(new TextDecoder().decode(file.subarray(0, lineEnd))) : NaN
  if (!Number.isInteger(length) || length <= 0 || lineEnd + 1 + length > file.length) {
    throw new MailFormatError('not an emlx file')
  }
  return file.subarray(lineEnd + 1, lineEnd + 1 + length)
}

function people(addresses: readonly Address[] | undefined): MailPerson[] {
  return (addresses ?? [])
    .flatMap((entry) => ('group' in entry && entry.group ? entry.group : [entry]))
    .filter((entry) => typeof entry.address === 'string' && entry.address !== '')
    .map((entry) => ({ name: entry.name?.trim() ?? '', email: entry.address as string }))
}

const unbracketed = (id: string): string => id.trim().replace(/^<|>$/g, '')

/** The ids a `References` header lists, oldest first, without their angle brackets. */
const idsOf = (header: string | undefined): string[] =>
  (header ?? '')
    .split(/\s+/)
    .map(unbracketed)
    .filter((id) => id !== '')

/** The meeting of a calendar part, whatever way the part was decoded. */
function meetingOf(content: unknown): MailMeeting | null {
  if (typeof content === 'string') return parseInvite(content)
  if (content instanceof ArrayBuffer || ArrayBuffer.isView(content)) {
    return parseInvite(new TextDecoder().decode(content as ArrayBuffer))
  }
  return null
}

/** Reads an `.emlx` file as Mail writes it (also a partial one, whose attachments are elsewhere). */
export async function parseEmlx(file: Uint8Array): Promise<MailMessage> {
  const mail = await PostalMime.parse(messageBytes(file))
  const sent = mail.date ? new Date(mail.date) : null
  const calendar = mail.attachments.find((part) => part.mimeType === CALENDAR_TYPE)
  return {
    messageId: mail.messageId ? unbracketed(mail.messageId) : null,
    subject: (mail.subject ?? '').replace(/\s+/g, ' ').trim(),
    from: people(mail.from ? [mail.from] : [])[0] ?? null,
    to: people(mail.to),
    cc: people(mail.cc),
    sentAt: sent && !Number.isNaN(sent.getTime()) ? sent : null,
    text: mail.text ? tidyText(mail.text) : htmlToText(mail.html ?? ''),
    attachments: mail.attachments.map((part) => part.filename ?? '').filter((name) => name !== ''),
    calendarMethod: calendar?.method?.toUpperCase() ?? null,
    inReplyTo: mail.inReplyTo ? unbracketed(mail.inReplyTo) : null,
    references: idsOf(mail.references),
    meeting: calendar ? meetingOf(calendar.content) : null,
  }
}
