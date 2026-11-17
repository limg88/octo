import { existsSync, readdirSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import type { MailArchive } from '@octo/application'
import { type ArchivedMail, DomainError } from '@octo/domain'
import { parseEmlx } from './emlx.ts'

/** Messages Mail files in one directory: the thousands of the number are its subdirectories. */
const MESSAGES_PER_DIRECTORY = 1000
const MS_PER_SECOND = 1000
const VERSION_DIRECTORY = /^V(\d+)$/
const MAILBOX_SUFFIX = '.mbox'
const FILE_SUFFIXES = ['.emlx', '.partial.emlx'] as const

/** Where Mail keeps its mail. */
export const defaultAppleMailRoot = (): string => join(homedir(), 'Library', 'Mail')

/** The subdirectories a message number is filed under: 73587 is under `3/7`. */
export function shardOf(id: number): string[] {
  const thousands = Math.floor(id / MESSAGES_PER_DIRECTORY)
  return thousands === 0 ? [] : [...String(thousands)].reverse()
}

interface IndexRow {
  id: number
  received: number
  url: string
}

const unreadable = (): DomainError => new DomainError('mail_archive_unreadable')

/** The newest `V<n>` directory of Mail: the one the running version writes. */
function versionDirectory(root: string): string {
  const versions = readdirSync(root)
    .map((name) => VERSION_DIRECTORY.exec(name))
    .filter((match): match is RegExpExecArray => match !== null)
    .sort((a, b) => Number(b[1]) - Number(a[1]))
  const newest = versions[0]
  if (!newest) throw unreadable()
  return join(root, newest[0])
}

/**
 * The mail of Mail.app, read from its folder: the index says which messages arrived when and
 * where they are filed, and each message is a file. Nothing is written and Mail is not asked.
 * The index is opened at every reading, so a later run sees what arrived meanwhile.
 */
export function createAppleMailArchive(root: string = defaultAppleMailRoot()): MailArchive {
  const accounts = new Map<string, string>()
  const dataDirectories = new Map<string, string | null>()

  function base(): string {
    try {
      return versionDirectory(root)
    } catch {
      throw unreadable()
    }
  }

  function rowsBetween(from: Date, to: Date): IndexRow[] {
    let index: DatabaseSync | null = null
    try {
      index = new DatabaseSync(join(base(), 'MailData', 'Envelope Index'), { readOnly: true })
      return index
        .prepare(
          `SELECT m.ROWID AS id, m.date_received AS received, b.url AS url
           FROM messages m JOIN mailboxes b ON b.ROWID = m.mailbox
           WHERE m.deleted = 0 AND m.date_received >= ? AND m.date_received < ?
           ORDER BY m.date_received, m.ROWID`,
        )
        .all(
          Math.floor(from.getTime() / MS_PER_SECOND),
          Math.floor(to.getTime() / MS_PER_SECOND),
        ) as unknown as IndexRow[]
    } catch {
      throw unreadable()
    } finally {
      index?.close()
    }
  }

  /** The `Data` directory of a mailbox: under the one directory Mail makes inside it. */
  function dataDirectory(account: string, folder: string): string | null {
    const key = `${account}/${folder}`
    const known = dataDirectories.get(key)
    if (known !== undefined) return known
    const mailbox = join(base(), account, ...folder.split('/').map((part) => part + MAILBOX_SUFFIX))
    const inner = existsSync(mailbox)
      ? readdirSync(mailbox, { withFileTypes: true }).find(
          (entry) => entry.isDirectory() && !entry.name.endsWith(MAILBOX_SUFFIX),
        )
      : undefined
    const found = inner ? join(mailbox, inner.name, 'Data') : null
    dataDirectories.set(key, found)
    return found
  }

  return {
    available: true,

    async between(from, to) {
      return rowsBetween(from, to).map((row): ArchivedMail => {
        const url = new URL(row.url)
        accounts.set(String(row.id), url.host)
        return {
          id: String(row.id),
          folder: decodeURIComponent(url.pathname.replace(/^\//, '')),
          receivedAt: new Date(row.received * MS_PER_SECOND),
        }
      })
    },
    async read(mail) {
      const account = accounts.get(mail.id)
      const data = account ? dataDirectory(account, mail.folder) : null
      if (!data) return null
      const directory = join(data, ...shardOf(Number(mail.id)), 'Messages')
      for (const suffix of FILE_SUFFIXES) {
        const file = join(directory, `${mail.id}${suffix}`)
        if (!existsSync(file)) continue
        return parseEmlx(await readFile(file)).catch(() => null)
      }
      return null
    },
  }
}
