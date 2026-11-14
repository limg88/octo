// Builds a folder as Mail.app keeps its mail: an index and one `.emlx` file per message.
// Synthetic messages only; used by the tests and by the demos.
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { shardOf } from '../../src/mail/apple-mail-archive.ts'

export const FAKE_ACCOUNT = '11111111-2222-3333-4444-555555555555'
const PLIST = '<?xml version="1.0" encoding="UTF-8"?><plist version="1.0"><dict/></plist>'
const MS_PER_SECOND = 1000

export interface FakeMail {
  id: number
  folder: string
  receivedAt: Date
  /** Left out: the index lists the mail but Mail has not downloaded it. */
  message?: {
    messageId?: string
    from: string
    to?: string
    cc?: string
    subject: string
    html?: string
    text?: string
    /** A calendar part with this method (`REPLY` for the answer to an invitation). */
    calendarMethod?: string
  }
  deleted?: boolean
  partial?: boolean
}

/** A file as Mail writes it: the length of the message, the message, then a property list. */
export function emlx(message: string): Uint8Array {
  const body = message.replace(/\r?\n/g, '\r\n')
  return new TextEncoder().encode(`${Buffer.byteLength(body)}\n${body}${PLIST}`)
}

function rfc822(mail: FakeMail): string {
  const message = mail.message
  if (!message) return ''
  const type = message.calendarMethod
    ? `text/calendar; method=${message.calendarMethod}; charset=utf-8`
    : `text/${message.html === undefined ? 'plain' : 'html'}; charset=utf-8`
  return [
    ...(message.messageId ? [`Message-ID: <${message.messageId}>`] : []),
    `From: ${message.from}`,
    `To: ${message.to ?? 'Paola Verdi <pm@example.test>'}`,
    ...(message.cc ? [`Cc: ${message.cc}`] : []),
    `Subject: ${message.subject}`,
    `Date: ${mail.receivedAt.toUTCString()}`,
    `Content-Type: ${type}`,
    '',
    message.calendarMethod
      ? 'BEGIN:VCALENDAR\nEND:VCALENDAR'
      : (message.html ?? message.text ?? ''),
    '',
  ].join('\n')
}

/** Adds mail to a fake Mail folder, creating it when it does not exist. */
export function addFakeMail(root: string, mails: readonly FakeMail[]): void {
  const data = join(root, 'V10')
  mkdirSync(join(root, 'V9'), { recursive: true })
  mkdirSync(join(data, 'MailData'), { recursive: true })
  const index = new DatabaseSync(join(data, 'MailData', 'Envelope Index'))
  index.exec(
    'CREATE TABLE IF NOT EXISTS mailboxes (ROWID INTEGER PRIMARY KEY, url TEXT UNIQUE);' +
      'CREATE TABLE IF NOT EXISTS messages (ROWID INTEGER PRIMARY KEY, date_received INTEGER, mailbox INTEGER, deleted INTEGER DEFAULT 0);',
  )
  for (const mail of mails) {
    const segments = mail.folder.split('/')
    const url = `ews://${FAKE_ACCOUNT}/${segments.map(encodeURIComponent).join('/')}`
    index.prepare('INSERT OR IGNORE INTO mailboxes (url) VALUES (?)').run(url)
    const mailbox = index.prepare('SELECT ROWID AS id FROM mailboxes WHERE url = ?').get(url) as {
      id: number
    }
    index
      .prepare(
        'INSERT OR REPLACE INTO messages (ROWID, date_received, mailbox, deleted) VALUES (?, ?, ?, ?)',
      )
      .run(
        mail.id,
        Math.floor(mail.receivedAt.getTime() / MS_PER_SECOND),
        mailbox.id,
        mail.deleted ? 1 : 0,
      )
    if (!mail.message) continue
    const mailboxFolder = join(data, FAKE_ACCOUNT, ...segments.map((part) => `${part}.mbox`))
    const directory = join(mailboxFolder, 'AAAAAAAA-BBBB', 'Data', ...shardOf(mail.id), 'Messages')
    mkdirSync(directory, { recursive: true })
    mkdirSync(join(mailboxFolder, 'Sotto.mbox'), { recursive: true })
    const name = `${mail.id}${mail.partial ? '.partial' : ''}.emlx`
    writeFileSync(join(directory, name), emlx(rfc822(mail)))
  }
  index.close()
}
