import {
  DomainError,
  type Identity,
  type MailMessage,
  type MailSourceConfig,
  NO_SOURCES,
  type Project,
  WAREHOUSE_TLS_MODES,
  type WarehouseFeedConfig,
} from '@octo/domain'
import { describe, expect, it } from 'vitest'
import { createFeeds, createProjects, createSources, type FeedReader } from '../src/index.ts'
import {
  archiveOf,
  countingIds,
  type FakeArchivedMail,
  folderProbe,
  memoryFeedIndexes,
  memoryRegistry,
  memorySourceSettings,
  memorySourceStates,
  memoryVault,
  memoryWriter,
  removerOf,
  steppingClock,
} from './fakes.ts'

const NOW = new Date('2026-11-14T10:00:00.000Z')
const project: Project = { id: 'p-1', name: 'Aurora', folder: '/progetti/Aurora', addedAt: '' }
const person = (id: string, email: string): Identity => ({
  id,
  username: email,
  email,
  name: email,
  tenant: 't-1',
})
const paola = person('u-1', 'pm@example.test')

describe('the projects of who is signed in', () => {
  function setup(initial: Project[] = []) {
    let who: Identity | null = paola
    const registry = memoryRegistry(initial)
    const projects = createProjects({
      registry,
      setAside: memoryRegistry(),
      folders: folderProbe(['/progetti/Aurora', '/progetti/Boreale']),
      scaffold: { create: async (parent, name) => `${parent}/${name}` },
      clock: steppingClock(),
      ids: countingIds('p'),
      identity: () => who,
    })
    return { projects, registry, as: (next: Identity | null) => (who = next) }
  }

  it('shows a project only to the person who added it', async () => {
    const { projects, registry, as } = setup()
    const added = await projects.add('/progetti/Aurora')
    expect(added.owner).toBe('u-1')
    expect((await projects.list()).map((entry) => entry.name)).toEqual(['Aurora'])

    as(person('u-2', 'altra@example.test'))
    expect(await projects.list()).toEqual([])
    await expect(projects.get(added.id)).rejects.toMatchObject({ code: 'project_not_found' })
    const other = await projects.add('/progetti/Boreale')
    expect(other.owner).toBe('u-2')
    // Nothing of the first person was lost by the second one working.
    expect((await registry.list()).map((entry) => entry.owner)).toEqual(['u-1', 'u-2'])
  })

  it('gives the projects added before the sign-in to the first person who signs in', async () => {
    const { projects, registry, as } = setup([project])
    expect((await projects.list())[0]).toMatchObject({ id: 'p-1', owner: 'u-1' })
    expect((await registry.list())[0]?.owner).toBe('u-1')
    as(person('u-2', 'altra@example.test'))
    expect(await projects.list()).toEqual([])
    // Without a sign-in at all (a tool, a test) every project is everybody's.
    as(null)
    expect(await projects.list()).toHaveLength(1)
  })
})

describe('the company system read as who is signed in', () => {
  const dwsi: WarehouseFeedConfig = {
    since: '2026-01-01',
    targetFolder: 'Fonti/NetSuite',
    host: 'dw.example.test',
    port: 5432,
    database: 'dw',
    user: 'lettore',
    ownerEmail: 'scritto@a.mano',
    projectCodes: ['PRJ000101'],
    tls: WAREHOUSE_TLS_MODES[0],
  }

  function setup(options: { assigned?: string[]; fails?: Error; identity?: Identity | null } = {}) {
    const seen: string[] = []
    const reader: FeedReader = {
      check: async (_feed, config) => {
        seen.push((config as WarehouseFeedConfig).ownerEmail)
      },
      choices: async (_feed, config) => {
        seen.push((config as WarehouseFeedConfig).ownerEmail)
        if (options.fails) throw options.fails
        return {
          projects: (options.assigned ?? []).map((code) => ({ value: code, label: code })),
          areas: [],
        }
      },
      // biome-ignore lint/correctness/useYield: a reading with nothing to give.
      async *read(_feed, config) {
        seen.push((config as WarehouseFeedConfig).ownerEmail)
      },
    }
    const writer = memoryWriter()
    const secrets = memoryVault()
    const settings = memorySourceSettings({ ...NO_SOURCES, dwsi })
    const feeds = createFeeds({
      settings,
      states: memorySourceStates(),
      indexes: memoryFeedIndexes(),
      secrets,
      reader,
      writer,
      files: removerOf(writer.files),
      clock: { now: () => NOW },
      identity: () => (options.identity === undefined ? paola : options.identity),
    })
    return { feeds, secrets, settings, seen }
  }

  it('binds every reading to the person, whatever address the form or the file carries', async () => {
    const { feeds, secrets, settings, seen } = setup()
    const view = await feeds.view(project, 'dwsi')
    expect(view.config?.ownerEmail).toBe('pm@example.test')
    expect(view.suggestedOwner).toBe('pm@example.test')
    await feeds.save(project, 'dwsi', { ...dwsi, ownerEmail: 'un.altro@example.test' }, 'password')
    expect((await settings.load(project.folder)).dwsi?.ownerEmail).toBe('pm@example.test')
    await feeds.choices(project, 'dwsi', dwsi, null)
    await feeds.sync(project, 'dwsi')
    expect(seen).toEqual(['pm@example.test', 'pm@example.test', 'pm@example.test'])
    expect(secrets.all.get('p-1/dwsi')).toBe('password')
  })

  it('leaves the address of the configuration when nobody is signed in', async () => {
    const { feeds, seen } = setup({ identity: null })
    expect((await feeds.view(project, 'dwsi')).suggestedOwner).toBe('')
    await feeds.save(project, 'dwsi', dwsi, 'password')
    expect(seen).toEqual(['scritto@a.mano'])
  })

  it('says whether the project is the person’s, or that it cannot tell', async () => {
    const mine = setup({ assigned: ['PRJ000101', 'PRJ000303'] })
    mine.secrets.all.set('p-1/dwsi', 'password')
    expect(await mine.feeds.assignment(project)).toBe('assigned')

    const notMine = setup({ assigned: ['PRJ000303'] })
    notMine.secrets.all.set('p-1/dwsi', 'password')
    expect(await notMine.feeds.assignment(project)).toBe('not_assigned')

    // No credential on this computer, or a system that cannot be reached: nothing is said.
    expect(await setup({ assigned: ['PRJ000101'] }).feeds.assignment(project)).toBe('unknown')
    const down = setup({ fails: new DomainError('feed_unreachable') })
    down.secrets.all.set('p-1/dwsi', 'password')
    expect(await down.feeds.assignment(project)).toBe('unknown')
    const broken = setup({ fails: new Error('unexpected') })
    broken.secrets.all.set('p-1/dwsi', 'password')
    await expect(broken.feeds.assignment(project)).rejects.toThrow('unexpected')
  })
})

describe('the mail of a conversation of the project', () => {
  const config: MailSourceConfig = {
    since: '2026-11-01',
    keywords: ['Aurora'],
    folders: [],
    excludeSenders: ['escluso@example.test'],
    keepQuoted: false,
    targetFolder: 'Posta',
  }
  const message = (id: string, subject: string, more: Partial<MailMessage> = {}): MailMessage => ({
    messageId: id,
    subject,
    from: { name: 'Carla', email: 'carla@cliente.example' },
    to: [{ name: 'Paola', email: 'pm@example.test' }],
    cc: [],
    sentAt: null,
    text: 'Testo.',
    attachments: [],
    calendarMethod: null,
    ...more,
  })
  const mail = (id: string, at: string, sent: MailMessage): FakeArchivedMail => ({
    id,
    folder: 'Posta in arrivo',
    receivedAt: new Date(at),
    message: sent,
  })

  it('takes an answer to a mail of the project even when it does not name the project', async () => {
    const writer = memoryWriter()
    const files = {
      under: async (_folder: string, folder: string) =>
        [...writer.files.keys()].filter((path) => path.startsWith(`${folder}/`)),
      readText: async (_folder: string, path: string) => writer.files.get(path) ?? null,
    }
    const archive = (mails: FakeArchivedMail[]) =>
      createSources({
        settings: memorySourceSettings({ ...NO_SOURCES, mail: config }),
        states: memorySourceStates(),
        archive: archiveOf(mails),
        writer,
        clock: { now: () => NOW },
        files,
      })
    const first = mail('1', '2026-11-10T08:00:00Z', message('primo@x', 'Aurora: collaudo'))
    const answer = mail(
      '2',
      '2026-11-10T09:00:00Z',
      message('risposta@x', 'R: collaudo', { inReplyTo: 'primo@x', references: ['primo@x'] }),
    )
    const answerToAnswer = mail(
      '3',
      '2026-11-10T10:00:00Z',
      message('seconda@x', 'R: R: collaudo', { references: ['primo@x', 'risposta@x'] }),
    )
    const stranger = mail('4', '2026-11-10T11:00:00Z', message('altro@x', 'Zefiro: preventivo'))
    const excluded = mail(
      '5',
      '2026-11-10T12:00:00Z',
      message('escluso@x', 'R: collaudo', {
        inReplyTo: 'primo@x',
        from: { name: '', email: 'escluso@example.test' },
      }),
    )
    const run = await archive([first, answer, answerToAnswer, stranger, excluded]).syncMail(project)
    expect(run).toMatchObject({ written: 3, error: null })
    const written = [...writer.files.values()].join('\n')
    expect(written).toContain('risponde-a: "primo@x"')
    expect(written).toContain('riferimenti: "primo@x risposta@x"')
    expect(written).not.toContain('Zefiro')

    // A later reading knows the mail already in the project from its files.
    const late = mail(
      '6',
      '2026-11-12T08:00:00Z',
      message('tardi@x', 'R: collaudo', { inReplyTo: 'seconda@x' }),
    )
    expect(await archive([late]).syncMail(project)).toMatchObject({ written: 1 })
  })
})
