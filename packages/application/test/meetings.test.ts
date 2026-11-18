import {
  DomainError,
  MEETINGS_FOLDER,
  type MeetingReading,
  NEVER_READ,
  NO_OPEN_POINTS,
  NO_SOURCES,
  NO_TODAY_SETTINGS,
  type OpenPoint,
  type OpenPointRegister,
  type Project,
  type RecordedMeeting,
  type SourcesConfig,
} from '@octo/domain'
import { describe, expect, it } from 'vitest'
import {
  createMeetings,
  createOpenPoints,
  createToday,
  MEETINGS_SOURCE,
  NO_EVALUATION,
  type TodayDeps,
} from '../src/index.ts'
import {
  memorySourceStates,
  memoryWriter,
  PAOLA_AT_HER_MAC,
  READ_HERE,
  readingsOf,
} from './fakes.ts'

const NOW = new Date('2026-11-16T09:00:00.000Z')
const ROOT = '~/Verbale'
const aurora: Project = { id: 'p-a', name: 'Aurora', folder: '/progetti/Aurora', addedAt: '' }
const borea: Project = { id: 'p-b', name: 'Borea', folder: '/progetti/Borea', addedAt: '' }
const lost: Project = { id: 'p-x', name: 'Persa', folder: '/progetti/Persa', addedAt: '' }

const meeting = (n: number, title: string): RecordedMeeting => ({
  id: `0000000${n}-0000-4000-8000-000000000000`,
  title,
  started: `2026-11-1${n}T09:00:00.000Z`,
  timezone: 'Europe/Rome',
  durationSeconds: 1800,
  participants: [],
  calendarEventUID: null,
  onlineMeetingURL: null,
  exportRevision: 1,
  exportedAt: null,
})
const complete = (n: number, title: string): MeetingReading => ({
  folder: `export-${n}`,
  status: 'complete',
  meeting: meeting(n, title),
})

function setup(
  options: {
    readings?: MeetingReading[] | Error
    configs?: Record<string, SourcesConfig>
    /** What a folder turns out to be when it is read again after its files. */
    after?: Record<string, MeetingReading | null>
    /** The people of each project, by its id. */
    teams?: Record<string, string[]>
  } = {},
) {
  // The open points of each project, by its folder: what came from a meeting goes away with it.
  const registers = new Map<string, OpenPointRegister>()
  const points = createOpenPoints({
    store: {
      load: async (folder) => registers.get(folder) ?? NO_OPEN_POINTS,
      save: async (folder, register) => void registers.set(folder, register),
    },
    writer: memoryWriter(),
    clock: { now: () => NOW },
  })
  const linked: SourcesConfig = { ...NO_SOURCES, meetings: { root: ROOT, since: null } }
  const configs = new Map<string, SourcesConfig>(
    Object.entries(options.configs ?? { [aurora.folder]: linked, [borea.folder]: linked }),
  )
  const disk = new Map<string, string>()
  const at = (folder: string, path: string) => `${folder}:${path}`
  const states = memorySourceStates()
  let gate: Promise<void> | null = null
  const meetings = createMeetings({
    settings: {
      load: async (folder) => {
        if (folder === lost.folder) throw new Error('folder gone')
        return configs.get(folder) ?? NO_SOURCES
      },
      save: async (folder, config) => void configs.set(folder, config),
      suggestMailFolder: async () => '',
      suggestFeedFolder: async () => '',
    },
    readings: readingsOf(states, { now: () => NOW }),
    exports: {
      defaultRoot: async () => ROOT,
      readable: async () => true,
      portable: (root) => root.replace('/Users/paola', '~'),
      list: async () => {
        await gate
        if (options.readings instanceof Error) throw options.readings
        return options.readings ?? []
      },
      reading: async (_root, folder) => {
        if (options.after && folder in options.after) return options.after[folder] ?? null
        const all = options.readings instanceof Error ? [] : (options.readings ?? [])
        return all.find((reading) => reading.folder === folder) ?? null
      },
      read: async (_root, folder, file) => (file === 'transcript.md' ? `# ${folder}` : null),
    },
    projects: async () => [aurora, borea, lost],
    files: {
      under: async (folder, under) =>
        [...disk.keys()]
          .filter((key) => key.startsWith(at(folder, `${under}/`)))
          .map((key) => key.slice(folder.length + 1)),
      readText: async (folder, path) => disk.get(at(folder, path)) ?? null,
      remove: async (folder, path) => void disk.delete(at(folder, path)),
    },
    writer: {
      write: async (folder, path, content) => {
        if (disk.get(at(folder, path)) === content) return 'unchanged'
        disk.set(at(folder, path), content)
        return 'written'
      },
    },
    clock: { now: () => NOW },
    ...(options.teams
      ? {
          team: async (project: Project) => ({
            people: (options.teams?.[project.id] ?? []).map((name) => ({
              name,
              role: '',
              side: 'supplier' as const,
              from: '',
              to: '',
              allocation: null,
              note: '',
            })),
            periods: [],
          }),
        }
      : {}),
    forget: (project, held) => points.forget(project, held),
  })
  return {
    meetings,
    states,
    disk,
    points,
    configs,
    hold: () => {
      let release = () => {}
      gate = new Promise((resolve) => {
        release = resolve
      })
      return release
    },
  }
}

describe('the meetings of a project', () => {
  it('proposes the folder of Verbale only while none is set', async () => {
    const { meetings } = setup({ configs: {} })
    expect(await meetings.view(aurora)).toEqual({
      config: null,
      suggestedRoot: ROOT,
      targetFolder: MEETINGS_FOLDER,
      state: NEVER_READ,
      ...READ_HERE,
      readableHere: true,
    })
    // However it is typed, it is kept in the one form two projects are compared by.
    const saved = await meetings.save(aurora, { root: '/Users/paola/Verbale', since: null })
    expect(saved).toMatchObject({ config: { root: ROOT, since: null }, suggestedRoot: null })
    expect(await meetings.configured(aurora)).toBe(true)
  })

  it('asks to be set up before it reads or assigns, and waits on nothing when it is not', async () => {
    const { meetings } = setup({ configs: {} })
    await expect(meetings.sync(aurora)).rejects.toThrow('source_not_configured')
    await expect(meetings.assign(aurora, 'x')).rejects.toThrow('source_not_configured')
    expect(await meetings.unassigned(aurora)).toEqual([])
  })

  it('reads once at a time for a project', async () => {
    const { meetings, hold } = setup()
    const release = hold()
    const first = meetings.sync(aurora)
    await expect(meetings.sync(aurora)).rejects.toThrow('source_busy')
    release()
    expect((await first).error).toBeNull()
    expect((await meetings.sync(aurora)).error).toBeNull()
  })

  it('keeps an expected failure in the run, and lets any other through', async () => {
    const unreadable = setup({ readings: new DomainError('meetings_root_unreadable') })
    expect(await unreadable.meetings.sync(aurora)).toEqual({
      at: NOW.toISOString(),
      written: 0,
      unchanged: 0,
      error: 'meetings_root_unreadable',
      by: PAOLA_AT_HER_MAC,
    })
    expect(await unreadable.meetings.unassigned(aurora)).toEqual([])

    const broken = setup({ readings: new Error('disk on fire') })
    await expect(broken.meetings.sync(aurora)).rejects.toThrow('disk on fire')
    await expect(broken.meetings.unassigned(aurora)).rejects.toThrow('disk on fire')
    // The reading is free again after a failure.
    await expect(broken.meetings.sync(aurora)).rejects.toThrow('disk on fire')
  })

  it('gives each meeting to the project it names, among those that read the same folder', async () => {
    const readings = [
      complete(1, 'Kickoff Aurora'),
      complete(2, 'Punto Borea'),
      complete(3, 'Varie'),
    ]
    const { meetings, disk } = setup({ readings })

    expect(await meetings.sync(aurora)).toMatchObject({ written: 1, unchanged: 0 })
    expect(await meetings.sync(borea)).toMatchObject({ written: 1, unchanged: 0 })

    expect((await meetings.imported(aurora)).map((stored) => stored.title)).toEqual([
      'Kickoff Aurora',
    ])
    expect((await meetings.imported(borea)).map((stored) => stored.title)).toEqual(['Punto Borea'])
    expect((await meetings.unassigned(aurora)).map((waiting) => waiting.title)).toEqual(['Varie'])
    expect(disk.get(`${aurora.folder}:${MEETINGS_FOLDER}/_lettura.md`)).toContain('«Varie»')
  })

  it('writes nothing of a meeting exported again while its files were being read', async () => {
    const first = complete(1, 'Kickoff Aurora')
    const next = { ...first, meeting: { ...meeting(1, 'Kickoff Aurora'), exportRevision: 2 } }
    const moved = setup({
      readings: [first, complete(3, 'Varie'), complete(4, 'Altro')],
      after: { 'export-1': next, 'export-3': null },
    })

    expect(await moved.meetings.sync(aurora)).toMatchObject({
      written: 0,
      unchanged: 0,
      error: null,
    })
    expect(await moved.meetings.imported(aurora)).toEqual([])
    expect(moved.disk.get(`${aurora.folder}:${MEETINGS_FOLDER}/_lettura.md`)).toContain(
      '- `export-1`: esportata di nuovo durante la lettura',
    )
    // Given by hand at that very moment: nothing is written, the PM tries again.
    await expect(moved.meetings.assign(aurora, meeting(3, '').id)).rejects.toThrow('source_busy')
    await moved.meetings.assign(aurora, meeting(4, '').id)
    expect(await moved.meetings.imported(aurora)).toHaveLength(1)
  })

  it('leaves alone what was recorded before the first day, but for what the project holds', async () => {
    const readings: MeetingReading[] = [
      complete(1, 'Kickoff Aurora'),
      complete(2, 'Varie di prima'),
      complete(5, 'Punto Aurora'),
      complete(6, 'Varie di dopo'),
      {
        folder: '2026-11-03_100000_Vecchia_AAAA0000',
        status: 'skipped',
        reason: 'corrupt',
        detail: '',
      },
      {
        folder: '2026-11-15_100000_Nuova_BBBB0000',
        status: 'skipped',
        reason: 'corrupt',
        detail: '',
      },
    ]
    const { meetings, disk } = setup({ readings })
    // Taken while every meeting was: the old one stays, and is kept up to date.
    expect(await meetings.sync(aurora)).toMatchObject({ written: 2 })
    expect(await meetings.unassigned(aurora)).toHaveLength(2)
    await meetings.save(aurora, { root: ROOT, since: '2026-11-14' })

    expect(await meetings.sync(aurora)).toMatchObject({ written: 0, unchanged: 2 })
    expect((await meetings.imported(aurora)).map((stored) => stored.title)).toEqual([
      'Punto Aurora',
      'Kickoff Aurora',
    ])
    expect((await meetings.unassigned(aurora)).map((waiting) => waiting.title)).toEqual([
      'Varie di dopo',
    ])
    const note = disk.get(`${aurora.folder}:${MEETINGS_FOLDER}/_lettura.md`) ?? ''
    expect(note).toContain('Nuova_BBBB0000')
    expect(note).not.toContain('Vecchia_AAAA0000')
    expect(note).not.toContain('Varie di prima')
  })

  it('does not count as a rival a project that reads another folder', async () => {
    const elsewhere: SourcesConfig = { ...NO_SOURCES, meetings: { root: '/altrove', since: null } }
    const { meetings } = setup({
      readings: [complete(2, 'Punto Borea e Aurora')],
      configs: {
        [aurora.folder]: { ...NO_SOURCES, meetings: { root: ROOT, since: null } },
        [borea.folder]: elsewhere,
      },
    })
    expect(await meetings.sync(aurora)).toMatchObject({ written: 1 })
  })
})

describe('a meeting given to the wrong project', () => {
  const daily = (n: number, title: string): MeetingReading => ({
    folder: `export-${n}`,
    status: 'complete',
    meeting: {
      ...meeting(n, title),
      participants: ['Mario Rossi <mario@example.test>', 'Bianchi Anna', 'Ospite Esterno'],
    },
  })
  const dailies = [daily(7, 'Daily Standup Cliente'), daily(8, 'Daily Standup Interna')]
  const teams = { [aurora.id]: ['Rossi Mario', 'Anna Bianchi'], [borea.id]: ['Carla Neri'] }
  const POINTS_PER_MEETING = 12
  const pointOf = (folder: string, index: number): OpenPoint => ({
    id: `${folder}-${index}`,
    title: `Punto ${index}`,
    owner: '',
    openedOn: '2026-11-17',
    due: null,
    state: 'open',
    origin: 'claude',
    source: { path: `${folder}/notes.md`, quote: `frase ${index}`, verified: true },
    signalKey: null,
    signalKind: null,
    meeting: null,
    closedOn: null,
    closedBy: null,
    closing: null,
    history: [],
    check: null,
  })

  it('enters by itself the only project all its known people are of', async () => {
    const { meetings } = setup({ readings: dailies, teams })
    // Nothing ties the two dailies to a project but their people: all those known are of Aurora.
    expect(await meetings.unassigned(borea)).toEqual([])
    expect(await meetings.unassigned(aurora)).toEqual([])
    expect(await meetings.sync(borea)).toMatchObject({ written: 0 })
    expect(await meetings.sync(aurora)).toMatchObject({ written: 2, error: null })
    expect(await meetings.imported(aurora)).toHaveLength(2)
    // It cannot be given by hand to a project it is not waiting in.
    const id = dailies[0]?.status === 'complete' ? dailies[0].meeting.id : ''
    await expect(meetings.assign(borea, id)).rejects.toMatchObject({ code: 'meeting_not_found' })
  })

  it('waits for the PM when its people are of more projects, and says whose most of them are', async () => {
    // Carla Neri is of Borea: no team has all three, so nothing is certain.
    const mixed = dailies.map((reading) =>
      reading.status === 'complete'
        ? {
            ...reading,
            meeting: {
              ...reading.meeting,
              participants: [...reading.meeting.participants, 'Carla Neri'],
            },
          }
        : reading,
    )
    const { meetings } = setup({ readings: mixed, teams })
    expect((await meetings.unassigned(borea)).map((held) => held.elsewhere)).toEqual([
      'Aurora',
      'Aurora',
    ])
    expect((await meetings.unassigned(aurora)).map((held) => held.elsewhere)).toEqual([null, null])
    // Everybody on both teams: two projects could claim it, so neither gets it.
    const both = { [aurora.id]: teams[aurora.id] ?? [], [borea.id]: teams[aurora.id] ?? [] }
    expect(
      await setup({ readings: dailies, teams: both }).meetings.unassigned(aurora),
    ).toHaveLength(2)
    // Without the teams nothing is said, and nothing is given.
    const bare = setup({ readings: dailies })
    expect((await bare.meetings.unassigned(borea)).map((held) => held.elsewhere)).toEqual([
      null,
      null,
    ])
  })

  it('stays out of a project that gave it away, whoever took part', async () => {
    const { meetings } = setup({ readings: dailies, teams })
    await meetings.sync(aurora)
    const [first] = await meetings.imported(aurora)
    await meetings.move(aurora, first?.id ?? '', null)
    // Its people are still of Aurora, but Aurora gave it away: it waits, and is not taken back.
    expect(await meetings.sync(aurora)).toMatchObject({ written: 0 })
    expect(await meetings.imported(aurora)).toHaveLength(1)
    expect((await meetings.unassigned(aurora)).map((held) => held.id)).toEqual([first?.id])
  })

  it('moves to its project with the open points that came from it, and is not taken back', async () => {
    // Before the teams were written nothing told whose the dailies were: assigned by hand.
    const { meetings, points, disk, configs } = setup({ readings: dailies })
    const ids = dailies.flatMap((reading) =>
      reading.status === 'complete' ? [reading.meeting.id] : [],
    )
    // The mistake: both dailies of Aurora are assigned to Borea, and Claude reads 24 points there.
    for (const id of ids) await meetings.assign(borea, id)
    const held = await meetings.imported(borea)
    expect(held).toHaveLength(2)
    await points.keep(borea, {
      ...NO_OPEN_POINTS,
      points: held.flatMap(({ folder }) =>
        Array.from({ length: POINTS_PER_MEETING }, (_, index) => pointOf(folder, index)),
      ),
      readMeetings: ids,
    })
    expect((await points.register(borea)).points).toHaveLength(24)
    expect(await meetings.imported(aurora)).toEqual([])

    for (const id of ids) await meetings.move(borea, id, aurora.id)

    // Borea holds neither the meetings nor a point of theirs; Aurora holds the meetings whole.
    expect(await meetings.imported(borea)).toEqual([])
    expect(await points.register(borea)).toMatchObject({ points: [], readMeetings: [] })
    const moved = await meetings.imported(aurora)
    expect(moved.map((stored) => stored.id).sort()).toEqual([...ids].sort())
    expect(moved.map((stored) => stored.folder).sort()).toEqual(
      held.map((stored) => stored.folder).sort(),
    )
    const folder = moved[0]?.folder ?? ''
    expect(disk.get(`${aurora.folder}:${folder}/transcript.md`)).toContain('# export-')
    const stillInBorea = [...disk.keys()].filter((key) =>
      key.startsWith(`${borea.folder}:${MEETINGS_FOLDER}/2026-`),
    )
    expect(stillInBorea).toEqual([])
    // The next readings change nothing: Aurora keeps them, Borea does not take them back.
    expect(configs.get(borea.folder)?.meetings?.released).toEqual(ids)
    expect(await meetings.sync(borea)).toMatchObject({ written: 0, error: null })
    expect(await meetings.imported(borea)).toEqual([])
    expect(await meetings.unassigned(borea)).toEqual([])
    expect(await meetings.imported(aurora)).toHaveLength(2)
    // Saving the folder of Verbale again does not forget what was taken away.
    await meetings.save(borea, { root: ROOT, since: '2026-11-01' })
    expect(configs.get(borea.folder)?.meetings).toEqual({
      root: ROOT,
      since: '2026-11-01',
      released: ids,
    })
  })

  it('takes a meeting away to no project, and takes it back when the PM assigns it again', async () => {
    const named = complete(3, 'Kick-off Aurora')
    const { meetings, configs } = setup({ readings: [named], teams })
    const id = named.status === 'complete' ? named.meeting.id : ''
    // The title names Aurora: the reading gives it to Aurora by itself.
    await meetings.sync(aurora)
    expect(await meetings.imported(aurora)).toHaveLength(1)

    await meetings.move(aurora, id, null)
    expect(await meetings.imported(aurora)).toEqual([])
    // The words still name Aurora, but Aurora gave it away: no reading takes it back.
    expect(await meetings.sync(aurora)).toMatchObject({ written: 0 })
    expect(await meetings.imported(aurora)).toEqual([])
    // It waits among the meetings to assign, here and in the projects that read the same folder.
    expect((await meetings.unassigned(borea)).map((held) => held.id)).toEqual([id])
    expect((await meetings.unassigned(aurora)).map((held) => held.id)).toEqual([id])

    await meetings.assign(aurora, id)
    expect(await meetings.imported(aurora)).toHaveLength(1)
    expect(configs.get(aurora.folder)?.meetings).toEqual({ root: ROOT, since: null })
  })

  it('refuses a meeting the project does not hold and a project that is not another one', async () => {
    const { meetings } = setup({ readings: dailies })
    const [first] = dailies
    const id = first?.status === 'complete' ? first.meeting.id : ''
    await expect(meetings.move(borea, id, aurora.id)).rejects.toMatchObject({
      code: 'meeting_not_found',
    })
    await meetings.assign(borea, id)
    for (const target of [borea.id, 'p-nessuno']) {
      await expect(meetings.move(borea, id, target)).rejects.toMatchObject({
        code: 'meeting_not_found',
      })
    }
    expect(await meetings.imported(borea)).toHaveLength(1)
    expect(await meetings.destinations(borea)).toEqual([
      { id: aurora.id, name: 'Aurora' },
      { id: lost.id, name: 'Persa' },
    ])
  })
})

describe('the recorded meetings on the page of the day', () => {
  const notSet = (code: DomainError['code']) => async (): Promise<never> => {
    throw new DomainError(code)
  }
  const pageWith = (meetings: TodayDeps['meetings']) =>
    createToday({
      hours: { view: notSet('hours_sources_not_set') },
      forecasts: { view: notSet('forecast_model_not_set') },
      dashboard: {
        view: notSet('tracker_export_not_set'),
        settings: notSet('tracker_export_not_set'),
      },
      alignments: {
        view: notSet('alignment_sprint_not_set'),
        settings: notSet('alignment_sprint_not_set'),
      },
      deliverables: { list: async () => [] },
      sources: {
        mail: async () => ({
          config: null,
          suggestedFolder: '',
          state: NEVER_READ,
          ...READ_HERE,
          readableHere: true,
        }),
      },
      feeds: {
        view: async (_project, feed) => ({
          feed,
          config: null,
          suggestedFolder: '',
          hasSecret: false,
          state: NEVER_READ,
          ...READ_HERE,
        }),
      },
      ...(meetings ? { meetings } : {}),
      team: { get: async () => ({ people: [], periods: [] }) },
      risks: { register: notSet('risk_invalid'), propose: notSet('risk_invalid') },
      files: { under: async () => [], readText: async () => null },
      store: {
        load: async () => NO_TODAY_SETTINGS,
        save: async () => {},
        loadEvaluation: async () => NO_EVALUATION,
        saveEvaluation: async () => {},
      },
      judge: { mails: async () => [], risks: async () => [], summary: async () => [] },
      evidence: { read: async () => ({ kind: 'missing' }) },
      clock: { now: () => NOW },
      identity: () => null,
    })

  it('shows the meeting without a project, and the source when it was never read', async () => {
    const { meetings } = setup({ readings: [complete(3, 'Varie')] })

    const view = await pageWith(meetings).view(aurora)

    expect(view.items.map((item) => [item.band, item.key])).toEqual([
      ['alert', `source:${MEETINGS_SOURCE}`],
      ['waiting', 'meeting-unassigned:00000003-0000-4000-8000-000000000000'],
    ])
    await meetings.assign(aurora, meeting(3, '').id)
    await meetings.sync(aurora)
    const after = await pageWith(meetings).view(aurora)
    expect(after.items).toEqual([])
    expect(after.freshness).toEqual([{ source: MEETINGS_SOURCE, readAt: NOW.toISOString() }])
  })

  it('says nothing of the meetings when they are not linked or not wired', async () => {
    expect((await pageWith(setup({ configs: {} }).meetings).view(aurora)).items).toEqual([])
    expect((await pageWith(undefined).view(aurora)).items).toEqual([])
  })
})
