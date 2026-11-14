import {
  DomainError,
  type MailMessage,
  type MailSourceConfig,
  NO_SOURCES,
  type Project,
} from '@octo/domain'
import { describe, expect, it } from 'vitest'
import { createSources, MAIL_OVERLAP_MS } from '../src/index.ts'
import {
  archiveOf,
  type FakeArchivedMail,
  memorySourceSettings,
  memorySourceStates,
  memoryWriter,
} from './fakes.ts'

const project: Project = { id: 'p-1', name: 'Aurora', folder: '/progetti/Aurora', addedAt: '' }
const NOW = new Date('2026-11-14T10:00:00.000Z')
const config: MailSourceConfig = {
  since: '2026-11-01',
  keywords: ['Aurora'],
  folders: [],
  excludeSenders: [],
  keepQuoted: false,
  targetFolder: 'Posta',
}

function message(id: string, subject: string): MailMessage {
  return {
    messageId: id,
    subject,
    from: { name: 'Carla', email: 'carla@cliente.example' },
    to: [],
    cc: [],
    sentAt: null,
    text: 'Testo della mail.',
    attachments: [],
    calendarMethod: null,
  }
}

function mail(
  id: string,
  at: string,
  subject: string,
  folder = 'Posta in arrivo',
): FakeArchivedMail {
  return { id, folder, receivedAt: new Date(at), message: message(`${id}@x`, subject) }
}

function setup(mails: FakeArchivedMail[] | Error, initial: MailSourceConfig | null = config) {
  const archive = archiveOf(mails)
  const writer = memoryWriter()
  const states = memorySourceStates()
  let now = NOW
  const sources = createSources({
    settings: memorySourceSettings({ ...NO_SOURCES, mail: initial }),
    states,
    archive,
    writer,
    clock: { now: () => now },
  })
  return { sources, archive, writer, states, setNow: (next: Date) => (now = next) }
}

describe('reading the mail of a project', () => {
  it('writes the mail of the project once, from the first day configured', async () => {
    const copy = {
      ...mail('3', '2026-11-11T08:00:00Z', 'Aurora: collaudo'),
      id: '4',
      folder: 'Posta inviata',
    }
    const { sources, archive, writer } = setup([
      mail('1', '2026-10-20T08:00:00Z', 'Aurora: vecchia'),
      mail('2', '2026-11-10T08:00:00Z', 'Zefiro: preventivo'),
      mail('3', '2026-11-11T08:00:00Z', 'Aurora: collaudo'),
      { ...copy, message: message('3@x', 'Aurora: collaudo') },
      mail('5', '2026-11-12T08:00:00Z', 'Aurora: cestinata', 'Posta eliminata'),
      { ...mail('6', '2026-11-12T09:00:00Z', 'Aurora: non scaricata'), message: null },
    ])

    const run = await sources.syncMail(project)

    expect(run).toEqual({ at: NOW.toISOString(), written: 1, unchanged: 0, error: null })
    expect(archive.windows[0]).toEqual({ from: new Date('2026-11-01T00:00:00Z'), to: NOW })
    expect([...writer.files.keys()]).toEqual([
      expect.stringMatching(/^Posta\/2026-11\/2026-11-11_/),
    ])
  })

  it('resumes a little before the last reading and finds what it wrote unchanged', async () => {
    const mails = [mail('3', '2026-11-13T08:00:00Z', 'Aurora: collaudo')]
    const { sources, archive, setNow } = setup(mails)
    await sources.syncMail(project)

    const later = new Date('2026-11-15T10:00:00.000Z')
    setNow(later)
    mails.push(mail('7', '2026-11-15T09:00:00Z', 'Aurora: verbale'))
    const run = await sources.syncMail(project)

    expect(run).toMatchObject({ written: 1, unchanged: 1 })
    expect(archive.windows[1]?.from).toEqual(new Date(NOW.getTime() - MAIL_OVERLAP_MS))
    expect((await sources.mail(project)).state.cursor).toBe(later.toISOString())
  })

  it('keeps the failure as the outcome of the reading and tries the same days again', async () => {
    const { sources, states } = setup(new DomainError('mail_archive_unreadable'))

    const run = await sources.syncMail(project)

    expect(run).toMatchObject({ written: 0, error: 'mail_archive_unreadable' })
    expect(states.all().get('p-1/mail')?.cursor).toBeNull()
  })

  it('lets unexpected errors through and frees the project for the next reading', async () => {
    const { sources } = setup(new Error('disk full'))

    await expect(sources.syncMail(project)).rejects.toThrow('disk full')
    await expect(sources.syncMail(project)).rejects.toThrow('disk full')
  })

  it('refuses a second reading while one is running, and a project with no mail set', async () => {
    const { sources } = setup([])
    const first = sources.syncMail(project)
    await expect(sources.syncMail(project)).rejects.toMatchObject({ code: 'source_busy' })
    await first

    const none = setup([], null)
    await expect(none.sources.syncMail(project)).rejects.toMatchObject({
      code: 'source_not_configured',
    })
    expect(await none.sources.hasMail(project)).toBe(false)
  })
})

describe('configuring the mail of a project', () => {
  it('proposes a folder, saves the rules cleaned and starts the reading over', async () => {
    const { sources, states } = setup([], null)
    expect(await sources.mail(project)).toMatchObject({ config: null, suggestedFolder: 'Posta' })

    await states.set(project.id, 'mail', { cursor: NOW.toISOString(), lastRun: null })
    const view = await sources.saveMail(project, { ...config, keywords: [' Aurora ', ''] })

    expect(view.config?.keywords).toEqual(['Aurora'])
    expect(view.state.cursor).toBeNull()
    expect(await sources.hasMail(project)).toBe(true)
  })

  it('refuses rules that are not valid and can switch the mail off', async () => {
    const { sources } = setup([])
    await expect(sources.saveMail(project, { ...config, since: 'ieri' })).rejects.toMatchObject({
      code: 'source_config_invalid',
    })
    expect((await sources.saveMail(project, null)).config).toBeNull()
  })
})
