import {
  DomainError,
  MEETINGS_FOLDER,
  type MeetingReading,
  NEVER_READ,
  NO_SOURCES,
  NO_TODAY_SETTINGS,
  type Project,
  type RecordedMeeting,
  type SourcesConfig,
} from '@octo/domain'
import { describe, expect, it } from 'vitest'
import { createMeetings, createToday, MEETINGS_SOURCE, type TodayDeps } from '../src/index.ts'
import { memorySourceStates } from './fakes.ts'

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
  } = {},
) {
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
    states,
    exports: {
      defaultRoot: async () => ROOT,
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
  })
  return {
    meetings,
    states,
    disk,
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
      sources: { mail: async () => ({ config: null, suggestedFolder: '', state: NEVER_READ }) },
      feeds: {
        view: async (_project, feed) => ({
          feed,
          config: null,
          suggestedFolder: '',
          hasSecret: false,
          state: NEVER_READ,
        }),
      },
      ...(meetings ? { meetings } : {}),
      team: { get: async () => ({ people: [], periods: [] }) },
      risks: { register: notSet('risk_invalid'), propose: notSet('risk_invalid') },
      files: { under: async () => [], readText: async () => null },
      store: {
        load: async () => NO_TODAY_SETTINGS,
        save: async () => {},
        loadEvaluation: async () => ({ at: null, model: null, mails: {} }),
        saveEvaluation: async () => {},
      },
      judge: { mails: async () => [], risks: async () => [] },
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
