import {
  type AdoFeedConfig,
  type Backup,
  DEFAULT_DASHBOARD_SETTINGS,
  DomainError,
  type FeedStep,
  feedScope,
  type JiraFeedConfig,
  NEVER_SHARED,
  NO_SOURCES,
  type Project,
  type QuestionRecord,
  type Reader,
  type SourceRun,
  TRACKER_SNAPSHOT_PATH,
} from '@octo/domain'
import { describe, expect, it } from 'vitest'
import {
  createBackups,
  createFeeding,
  createFeeds,
  createFolderMigration,
  createProjects,
  createReadings,
  createTrackerSnapshots,
  type LegacyFeedIndexes,
} from '../src/index.ts'
import {
  countingIds,
  folderProbe,
  memoryFeedIndexes,
  memoryRegistry,
  memorySharedReadings,
  memorySourceSettings,
  memorySourceStates,
  memoryVault,
  memoryWriter,
  removerOf,
  scriptedFeed,
} from './fakes.ts'

const FOLDER = '/OneDrive/DEEM'
const giovanni: Reader = { name: 'Giovanni', computer: 'mac-di-giovanni' }
const giovanna: Reader = { name: 'Giovanna', computer: 'pc-di-giovanna' }
const MINUTE = 60 * 1000
const START = Date.parse('2026-11-17T09:00:00.000Z')
const config: AdoFeedConfig = {
  organization: 'contoso',
  project: 'DEEM',
  areas: [],
  since: '2026-11-01',
  targetFolder: '_octo/fonti/ADO',
}
const file = (id: string, version: string) => ({
  externalId: id,
  version,
  relativePath: `${id}.md`,
  content: `# ${id} v${version}\n`,
})
const step = (overrides: Partial<FeedStep>): FeedStep => ({
  files: [],
  removed: [],
  cursor: null,
  dataAsOf: null,
  ...overrides,
})

/** One folder two computers open: the same files, the same settings, the same state of readings. */
function sharedFolder() {
  let now = START
  const folder = {
    writer: memoryWriter(),
    settings: memorySourceSettings({ ...NO_SOURCES, ado: config }),
    indexes: memoryFeedIndexes(),
    shared: memorySharedReadings(),
    clock: { now: () => new Date(now) },
    later: (minutes: number) => {
      now += minutes * MINUTE
    },
  }
  return folder
}

/** A computer that opens the folder: its own project id, credentials, and last attempts. */
function computer(
  folder: ReturnType<typeof sharedFolder>,
  me: Reader,
  script: { steps?: FeedStep[]; fails?: Error } = {},
) {
  const project: Project = { id: `p-${me.computer}`, name: 'DEEM', folder: FOLDER, addedAt: '' }
  const states = memorySourceStates()
  const secrets = memoryVault()
  const reader = scriptedFeed(script)
  const readings = createReadings({
    shared: folder.shared,
    states,
    clock: folder.clock,
    me: () => me,
  })
  const feeds = createFeeds({
    settings: folder.settings,
    readings,
    indexes: folder.indexes,
    secrets,
    reader,
    writer: folder.writer,
    files: removerOf(folder.writer.files),
    clock: folder.clock,
  })
  const withCredential = () => secrets.all.set(`${project.id}/ado`, `pat-di-${me.name}`)
  return { project, states, secrets, reader, readings, feeds, script, withCredential }
}

describe('two computers reading the feeds of one folder', () => {
  it('goes on from where the other stopped, and writes nothing again', async () => {
    const folder = sharedFolder()
    const mac = computer(folder, giovanni, {
      steps: [step({ files: [file('1', 'a'), file('2', 'a')], cursor: { at: 2 } })],
    })
    mac.withCredential()
    expect(await mac.feeds.sync(mac.project, 'ado')).toMatchObject({ written: 2, by: giovanni })

    // The other computer has never read: it knows all the same what is there and who read it.
    const pc = computer(folder, giovanna, {
      steps: [step({ files: [file('2', 'a'), file('3', 'a')], cursor: { at: 3 } })],
    })
    const before = await pc.feeds.view(pc.project, 'ado')
    expect(before).toMatchObject({ hasSecret: false, readBy: giovanni, readingBy: null })
    expect(before.state.lastRun).toMatchObject({ written: 2, error: null })

    pc.withCredential()
    folder.later(20)
    const hers = await pc.feeds.sync(pc.project, 'ado')
    expect(hers).toMatchObject({ written: 1, unchanged: 1, error: null, by: giovanna })
    expect(pc.reader.cursors).toEqual([{ at: 2 }])
    expect(folder.shared.all.get(`${FOLDER}/ado`)).toMatchObject({
      cursor: '{"at":3}',
      lease: null,
      lastRun: { by: giovanna },
    })
    // Back on the first one: it sees her reading, and its own next one starts after hers.
    expect((await mac.feeds.view(mac.project, 'ado')).readBy).toEqual(giovanna)
    mac.script.steps = []
    folder.later(20)
    await mac.feeds.sync(mac.project, 'ado')
    expect(mac.reader.cursors).toEqual([null, { at: 3 }])
    expect((await mac.feeds.view(mac.project, 'ado')).readBy).toBeNull()
  })

  it('leaves alone what the other read within the interval, unless somebody asks', async () => {
    const folder = sharedFolder()
    const mac = computer(folder, giovanni, { steps: [step({ files: [file('1', 'a')] })] })
    const pc = computer(folder, giovanna)
    mac.withCredential()
    pc.withCredential()
    const his = await mac.feeds.sync(mac.project, 'ado')

    folder.later(5)
    expect(await pc.feeds.sync(pc.project, 'ado', { maxAgeMs: 15 * MINUTE })).toEqual(his)
    expect(pc.reader.cursors).toEqual([])
    // Asked for by the PM, it is read whatever its age.
    expect(await pc.feeds.sync(pc.project, 'ado')).toMatchObject({ by: giovanna })
    expect(pc.reader.cursors).toHaveLength(1)

    // Its own reading is never too fresh for itself, and an old one of the other is read again.
    folder.later(20)
    await mac.feeds.sync(mac.project, 'ado', { maxAgeMs: 15 * MINUTE })
    expect(mac.reader.cursors).toHaveLength(2)
  })

  it('waits while the other reads, and takes over a reading that stopped without a word', async () => {
    const folder = sharedFolder()
    const pc = computer(folder, giovanna)
    pc.withCredential()
    const until = new Date(START + 10 * MINUTE).toISOString()
    await folder.shared.set(FOLDER, 'ado', { ...NEVER_SHARED, lease: { by: giovanni, until } })

    await expect(pc.feeds.sync(pc.project, 'ado')).rejects.toMatchObject({
      code: 'source_busy_elsewhere',
    })
    expect(await pc.feeds.view(pc.project, 'ado')).toMatchObject({ readingBy: giovanni })
    expect(pc.reader.cursors).toEqual([])

    folder.later(11)
    expect(await pc.feeds.sync(pc.project, 'ado')).toMatchObject({ error: null })
    expect((await pc.feeds.view(pc.project, 'ado')).readingBy).toBeNull()
  })

  it('keeps a failure on the computer it happened on, and frees the source', async () => {
    const folder = sharedFolder()
    const mac = computer(folder, giovanni, { steps: [step({ files: [file('1', 'a')] })] })
    mac.withCredential()
    const good = await mac.feeds.sync(mac.project, 'ado')

    // No credential on this computer: asked by hand, it says so here and only here.
    const pc = computer(folder, giovanna)
    expect(await pc.feeds.readableHere(pc.project)).toEqual([])
    expect(await pc.feeds.configured(pc.project)).toEqual(['ado'])
    folder.later(1)
    expect(await pc.feeds.sync(pc.project, 'ado')).toMatchObject({ error: 'secret_missing' })
    expect(folder.shared.all.get(`${FOLDER}/ado`)).toMatchObject({ lastRun: good, lease: null })
    expect((await pc.feeds.view(pc.project, 'ado')).state.lastRun?.error).toBe('secret_missing')
    expect((await mac.feeds.view(mac.project, 'ado')).state.lastRun).toEqual(good)

    // A failure that is not expected goes through, and the source is free all the same.
    const broken = computer(folder, giovanna, { fails: new Error('disk on fire') })
    broken.withCredential()
    await expect(broken.feeds.sync(broken.project, 'ado')).rejects.toThrow('disk on fire')
    expect(folder.shared.all.get(`${FOLDER}/ado`)?.lease).toBeNull()
  })

  it('removes the copies a sync client left when both wrote at once', async () => {
    const folder = sharedFolder()
    const mac = computer(folder, giovanni, { steps: [step({ files: [file('1', 'a')] })] })
    mac.withCredential()
    folder.writer.files.set('_octo/fonti/ADO/1-PC-DI-GIOVANNA.md', '# 1 va\n')
    folder.writer.files.set('_octo/fonti/ADO/_lettura-PC-DI-GIOVANNA.md', 'vecchia')
    folder.writer.files.set('_octo/fonti/ADO/appunti.md', 'non è una copia')

    await mac.feeds.sync(mac.project, 'ado')

    expect([...folder.writer.files.keys()].sort()).toEqual([
      '_octo/fonti/ADO/1.md',
      '_octo/fonti/ADO/_lettura.md',
      '_octo/fonti/ADO/appunti.md',
    ])
  })

  it('removes no copy from a folder that is not Octo’s own', async () => {
    const folder = sharedFolder()
    await folder.settings.save(FOLDER, {
      ...NO_SOURCES,
      ado: { ...config, targetFolder: 'raw/ADO' },
    })
    const mac = computer(folder, giovanni, { steps: [step({ files: [file('1', 'a')] })] })
    mac.withCredential()
    folder.writer.files.set('raw/ADO/1-appunti miei.md', 'del PM')
    await mac.feeds.sync(mac.project, 'ado')
    expect(folder.writer.files.has('raw/ADO/1-appunti miei.md')).toBe(true)
  })
})

describe('the turn of a reading', () => {
  const project: Project = { id: 'p-1', name: 'DEEM', folder: FOLDER, addedAt: '' }
  const counts = { written: 1, unchanged: 0 }

  function readingsFor(me: Reader, shared = memorySharedReadings(), at = START) {
    const states = memorySourceStates()
    const clock = { now: () => new Date(at) }
    return { shared, states, readings: createReadings({ shared, states, clock, me: () => me }) }
  }

  it('reads one at a time on a computer, and tells the folder what went well', async () => {
    const { readings, shared, states } = readingsFor(giovanni)
    let again: Promise<SourceRun> | null = null
    const run = await readings.run(project, { source: 'documents' }, {}, async (from) => {
      again = readings.run(project, { source: 'documents' }, {}, async () => ({
        ...counts,
        cursor: null,
      }))
      await from.checkpoint('a metà')
      expect(shared.all.get(`${FOLDER}/documents`)).toMatchObject({
        cursor: 'a metà',
        lease: { by: giovanni },
      })
      return { ...counts, cursor: 'fine' }
    })
    await expect(again).rejects.toMatchObject({ code: 'source_busy' })
    expect(shared.all.get(`${FOLDER}/documents`)).toEqual({
      cursor: 'fine',
      lastRun: run,
      lease: null,
    })
    expect(await states.get('p-1', 'documents')).toEqual({ cursor: null, lastRun: run })
  })

  it('keeps on this computer where the next reading of what only it holds starts', async () => {
    const folder = memorySharedReadings()
    const mac = readingsFor(giovanni, folder)
    const pc = readingsFor(giovanna, folder, START + MINUTE)
    const mail = { source: 'mail', ownToComputer: true } as const
    const his = await mac.readings.run(project, mail, {}, async (from) => {
      await from.checkpoint('a metà')
      return { ...counts, cursor: 'posta-di-giovanni' }
    })

    expect(folder.all.get(`${FOLDER}/mail`)).toEqual({ cursor: null, lastRun: his, lease: null })
    expect((await mac.states.get('p-1', 'mail')).cursor).toBe('posta-di-giovanni')
    // Her mail is another mail: his reading never stands for hers, and she starts from her own.
    const seen: Array<string | null> = []
    const hers = await pc.readings.run(project, mail, { maxAgeMs: 15 * MINUTE }, async (from) => {
      seen.push(from.cursor)
      return { ...counts, cursor: 'posta-di-giovanna' }
    })
    expect(hers.by).toEqual(giovanna)
    expect(seen).toEqual([null])
    expect((await mac.readings.view(project, 'mail')).readBy).toEqual(giovanna)
  })

  it('does a piece of work alone on the source, and lets its failures through', async () => {
    const folder = memorySharedReadings()
    const mac = readingsFor(giovanni, folder)
    const pc = readingsFor(giovanna, folder)

    await mac.readings.exclusive(project, 'tracker', async () => {
      expect(await pc.readings.busyElsewhere(project, 'tracker')).toBe(true)
      expect(await mac.readings.busyElsewhere(project, 'tracker')).toBe(false)
      await expect(pc.readings.exclusive(project, 'tracker', async () => 1)).rejects.toMatchObject({
        code: 'source_busy_elsewhere',
      })
      await expect(mac.readings.exclusive(project, 'tracker', async () => 1)).rejects.toMatchObject(
        { code: 'source_busy' },
      )
    })
    expect(await pc.readings.busyElsewhere(project, 'tracker')).toBe(false)

    const refused = new DomainError('feed_credential_refused')
    await expect(
      pc.readings.exclusive(project, 'tracker', async () => {
        throw refused
      }),
    ).rejects.toBe(refused)
    expect(folder.all.get(`${FOLDER}/tracker`)?.lease).toBeNull()
    expect(await pc.readings.exclusive(project, 'tracker', async () => 'fatto')).toBe('fatto')
  })
})

describe('the tracker of the dashboard in a shared folder', () => {
  it('is left to the computer that is reading it', async () => {
    const project: Project = { id: 'p-1', name: 'DEEM', folder: FOLDER, addedAt: '' }
    const shared = memorySharedReadings()
    const secrets = memoryVault()
    secrets.all.set('p-1/ado', 'pat')
    let reads = 0
    const settings = { ...DEFAULT_DASHBOARD_SETTINGS, exportPath: TRACKER_SNAPSHOT_PATH }
    const snapshots = createTrackerSnapshots({
      settings: { load: async () => settings, save: async () => {} },
      sources: memorySourceSettings({ ...NO_SOURCES, ado: config }),
      secrets,
      tracker: {
        read: async () => {
          reads += 1
          return { exportedAt: '2026-11-17T09:00:00.000Z', items: [], history: {} }
        },
      },
      writer: memoryWriter(),
      exports: { readJson: async () => null },
      clock: { now: () => new Date(START) },
      readings: createReadings({
        shared,
        states: memorySourceStates(),
        clock: { now: () => new Date(START) },
        me: () => giovanna,
      }),
    })
    const until = new Date(START + 5 * MINUTE).toISOString()
    await shared.set(FOLDER, 'tracker', { ...NEVER_SHARED, lease: { by: giovanni, until } })

    expect(await snapshots.refresh(project)).toBeNull()
    await expect(snapshots.read(project)).rejects.toMatchObject({ code: 'source_busy_elsewhere' })
    expect(reads).toBe(0)

    await shared.set(FOLDER, 'tracker', NEVER_SHARED)
    expect(await snapshots.refresh(project)).toMatchObject({ items: 0 })
    expect(reads).toBe(1)
    expect(shared.all.get(`${FOLDER}/tracker`)?.lease).toBeNull()
  })
})

describe('filling the memory from a computer that cannot read everything', () => {
  const project: Project = { id: 'p-1', name: 'DEEM', folder: FOLDER, addedAt: '' }
  const never = async (): Promise<never> => {
    throw new Error('not used by this test')
  }
  const done: SourceRun = { at: '2026-11-17T09:00:00.000Z', written: 1, unchanged: 0, error: null }

  it('reads only what it can, and passes on how fresh a reading of another may be', async () => {
    const calls: Array<[string, unknown]> = []
    const taken =
      (source: string) =>
      async (_project: Project, ...rest: unknown[]) => {
        calls.push([source, rest.at(-1)])
        return done
      }
    const feeding = createFeeding({
      writer: { claim: async () => {} },
      sources: {
        mail: never,
        saveMail: never,
        previewMail: never,
        hasMail: async () => true,
        // Windows: the mail is configured in the folder, and there is no mail program to read.
        mailReadableHere: async () => false,
        syncMail: taken('mail'),
      },
      meetings: {
        configured: async () => true,
        readableHere: async () => false,
        sync: taken('meetings'),
      },
      feeds: {
        view: never,
        save: never,
        choices: never,
        assignment: never,
        configured: async () => ['ado', 'jira', 'dwsi'],
        readableHere: async () => ['jira'],
        sync: async (_project, feed, options) => {
          calls.push([feed, options])
          return done
        },
      },
      documents: { state: never, convert: taken('documents') },
    })

    const steps = await feeding.fill(project, undefined, { maxAgeMs: 15 * MINUTE })

    expect(steps.map((taken) => taken.source)).toEqual(['jira', 'documents'])
    expect(calls).toEqual([
      ['jira', { maxAgeMs: 15 * MINUTE }],
      ['documents', { maxAgeMs: 15 * MINUTE }],
    ])
    // What is set up is still said whole: the guide shows the mail as linked.
    expect(await feeding.status(project)).toEqual({
      mail: true,
      meetings: true,
      feeds: ['ado', 'jira', 'dwsi'],
    })
  })
})

describe('a project whose folder was moved', () => {
  const aurora: Project = { id: 'p-1', name: 'Aurora', folder: '/Documenti/Aurora', addedAt: 'x' }
  const boreale: Project = {
    id: 'p-2',
    name: 'Boreale',
    folder: '/Documenti/Boreale',
    addedAt: 'x',
  }

  function projects(readable: string[]) {
    const registry = memoryRegistry([aurora, boreale])
    const service = createProjects({
      registry,
      setAside: memoryRegistry(),
      folders: folderProbe(readable),
      scaffold: { create: async () => '' },
      clock: { now: () => new Date(START) },
      ids: countingIds(),
    })
    return { registry, service }
  }

  it('stays the same project at its new place', async () => {
    const { registry, service } = projects(['/OneDrive/Aurora', '/Documenti/Boreale'])
    const moved = await service.relocate('p-1', '/OneDrive/Aurora')
    expect(moved).toEqual({ ...aurora, folder: '/OneDrive/Aurora' })
    expect(await registry.list()).toEqual([moved, boreale])
    // Told again where it already is: nothing changes.
    expect(await service.relocate('p-1', '/OneDrive/Aurora')).toEqual(moved)
  })

  it('is not pointed at a folder that is not there, or is of another project', async () => {
    const { registry, service } = projects(['/Documenti/Boreale'])
    await expect(service.relocate('p-1', '/OneDrive/Aurora')).rejects.toMatchObject({
      code: 'folder_not_readable',
    })
    await expect(service.relocate('p-1', '/Documenti/Boreale')).rejects.toMatchObject({
      code: 'project_already_added',
    })
    await expect(service.relocate('p-9', '/Documenti/Boreale')).rejects.toMatchObject({
      code: 'project_not_found',
    })
    expect(await registry.list()).toEqual([aurora, boreale])
  })
})

describe('handing over to the folder what an earlier Octo kept on the computer', () => {
  const project: Project = { id: 'p-1', name: 'DEEM', folder: FOLDER, addedAt: '' }
  const jira: JiraFeedConfig = {
    since: '2026-03-01',
    targetFolder: '_octo/fonti/Jira',
    site: 'contoso',
    email: 'giovanni@example.test',
    projects: ['DEEM'],
  }
  const ITEMS = { 'DEEM-1': { version: '3', path: '_octo/fonti/Jira/deem-1-ab12.md' } }
  const good: SourceRun = { at: '2026-11-16T18:00:00.000Z', written: 4, unchanged: 9, error: null }

  function legacyOf(kept: Record<string, { scope: string; items: typeof ITEMS }>) {
    const removed: string[] = []
    const legacy: LegacyFeedIndexes = {
      load: async (_id, feed) => kept[feed] ?? { scope: null, items: {} },
      remove: async (_id, feed) => {
        removed.push(feed)
        delete kept[feed]
      },
    }
    return { legacy, removed }
  }

  /** The perimeter as Octo wrote it when the account was part of it. */
  function scopeWithAccount(): string {
    const { targetFolder: _folder, ...settings } = jira
    const what = { ...settings, fields: 2 }
    return JSON.stringify(what, Object.keys(what).sort())
  }

  function setup(readable = [FOLDER]) {
    const { legacy, removed } = legacyOf({ jira: { scope: scopeWithAccount(), items: ITEMS } })
    const indexes = memoryFeedIndexes()
    const states = memorySourceStates()
    const shared = memorySharedReadings()
    const migration = createFolderMigration({
      legacy,
      indexes,
      states,
      shared,
      folders: folderProbe(readable),
      me: () => giovanni,
    })
    return { migration, indexes, states, shared, removed }
  }

  it('goes on in the folder from where the computer was: nothing is read from the start', async () => {
    const { migration, indexes, states, shared, removed } = setup()
    await states.set('p-1', 'jira', { cursor: '{"updated":"x"}', lastRun: good })
    await states.set('p-1', 'mail', { cursor: '2026-11-16T18:00:00.000Z', lastRun: good })
    await states.set('p-1', 'ado', {
      cursor: '{"id":1}',
      lastRun: { ...good, error: 'feed_unreachable' },
    })

    await migration.run(project)

    // The same perimeter as a reading of today computes it: the reading is not started over.
    expect(await indexes.load(FOLDER, 'jira')).toEqual({
      scope: feedScope('jira', jira),
      items: ITEMS,
    })
    expect(removed).toEqual(['jira'])
    expect(shared.all.get(`${FOLDER}/jira`)).toEqual({
      cursor: '{"updated":"x"}',
      lastRun: { ...good, by: giovanni },
      lease: null,
    })
    // Where the mail goes on from is of the archive of this computer: only its date is told.
    expect(shared.all.get(`${FOLDER}/mail`)).toMatchObject({
      cursor: null,
      lastRun: { at: good.at },
    })
    // A reading that failed is told to nobody.
    expect(shared.all.has(`${FOLDER}/ado`)).toBe(false)

    await migration.run(project)
    expect(removed).toEqual(['jira'])
  })

  it('never writes over what the folder already says', async () => {
    const { migration, indexes, states, shared, removed } = setup()
    const theirs = { ...good, at: '2026-11-17T08:00:00.000Z', by: giovanna }
    await indexes.save(FOLDER, 'jira', 'già nella cartella', {})
    await shared.set(FOLDER, 'jira', { cursor: '{"updated":"y"}', lastRun: theirs, lease: null })
    await states.set('p-1', 'jira', { cursor: '{"updated":"x"}', lastRun: good })

    await migration.run(project)

    expect(await indexes.load(FOLDER, 'jira')).toEqual({ scope: 'già nella cartella', items: {} })
    expect(shared.all.get(`${FOLDER}/jira`)?.lastRun).toEqual(theirs)
    expect(removed).toEqual(['jira'])
  })

  it('waits for a folder that is not there', async () => {
    const { migration, indexes, removed } = setup([])
    await migration.run(project)
    expect(await indexes.load(FOLDER, 'jira')).toEqual({ scope: null, items: {} })
    expect(removed).toEqual([])
  })
})

describe('restoring a backup beside a folder that knows its readings', () => {
  it('keeps what the folder says of its feeds', async () => {
    const project: Project = { id: 'p-1', name: 'DEEM', folder: FOLDER, addedAt: '' }
    const indexes = memoryFeedIndexes()
    await indexes.save(FOLDER, 'jira', 'di oggi', { 'DEEM-2': { version: '1', path: 'b.md' } })
    const backups = createBackups({
      registry: memoryRegistry(),
      sourceStates: memorySourceStates(),
      indexes,
      folders: folderProbe([FOLDER]),
      files: { read: never, write: never },
      clock: { now: () => new Date(START) },
    })
    const outcome = await backups.restore(
      {
        format: 'octo-backup',
        version: 1,
        createdAt: '2026-11-10T08:00:00.000Z',
        projects: [
          {
            project,
            sources: {},
            feeds: {
              jira: { scope: 'di ieri', items: {} },
              ado: { scope: 'solo nella copia', items: {} },
            },
          },
        ],
      },
      {},
    )
    expect(outcome.restored).toEqual(['DEEM'])
    expect((await indexes.load(FOLDER, 'jira')).scope).toBe('di oggi')
    expect((await indexes.load(FOLDER, 'ado')).scope).toBe('solo nella copia')
  })
})

describe('a backup, now that the questions are with the app', () => {
  const project: Project = { id: 'p-1', name: 'DEEM', folder: FOLDER, addedAt: '' }
  const question = (id: string): QuestionRecord => ({
    id,
    projectId: 'p-1',
    question: 'Quando?',
    askedAt: '2026-11-16T09:00:00.000Z',
    durationMs: 10,
    answer: null,
    error: 'agent_failed',
  })

  function computerWith(projects: Project[], files: Map<string, Backup>) {
    const registry = memoryRegistry(projects)
    // Kept by project, as the real one: a question for a folder not in the list is lost.
    const kept = new Map<string, QuestionRecord[]>()
    const idOf = async (folder: string) =>
      (await registry.list()).find((listed) => listed.folder === folder)?.id ?? 'nessuno'
    const questions = {
      list: async (folder: string) => kept.get(await idOf(folder)) ?? [],
      append: async (folder: string, record: QuestionRecord) => {
        const id = await idOf(folder)
        kept.set(id, [...(kept.get(id) ?? []), record])
      },
    }
    const backups = createBackups({
      registry,
      sourceStates: memorySourceStates(),
      indexes: memoryFeedIndexes(),
      folders: folderProbe([FOLDER]),
      files: {
        read: async (file) => files.get(file) as Backup,
        write: async (file, backup) => void files.set(file, backup),
      },
      clock: { now: () => new Date(START) },
      questions,
    })
    return { backups, questions, kept }
  }

  it('takes the questions of the person to the new computer', async () => {
    const files = new Map<string, Backup>()
    const old = computerWith([project], files)
    await old.questions.append(FOLDER, question('q-1'))
    await old.questions.append(FOLDER, question('q-2'))
    await old.backups.save('/chiavetta/copia.json')
    expect(files.get('/chiavetta/copia.json')?.projects[0]?.questions).toHaveLength(2)

    const fresh = computerWith([], files)
    const { backup } = await fresh.backups.open('/chiavetta/copia.json')
    await fresh.backups.restore(backup, {})
    expect(fresh.kept.get('p-1')?.map((record) => record.id)).toEqual(['q-1', 'q-2'])
    expect(fresh.kept.has('nessuno')).toBe(false)
  })

  it('names no questions for a project nobody asked anything of', async () => {
    const files = new Map<string, Backup>()
    await computerWith([project], files).backups.save('/chiavetta/copia.json')
    expect(files.get('/chiavetta/copia.json')?.projects[0]).not.toHaveProperty('questions')
  })
})

async function never(): Promise<never> {
  throw new Error('not used by this test')
}
