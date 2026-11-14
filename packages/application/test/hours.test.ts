import {
  DEFAULT_HOURS_SETTINGS,
  DomainError,
  type HoursPeriod,
  type HoursSettings,
  type JiraFeedConfig,
  NO_SOURCES,
  type Project,
  type TrackerHours,
} from '@octo/domain'
import { describe, expect, it } from 'vitest'
import {
  createHours,
  type HoursSettingsStore,
  type ProjectFiles,
  TRACKER_HOURS_FOLDER,
  type TrackerHoursReader,
} from '../src/index.ts'
import { memorySourceSettings, memoryVault, memoryWriter } from './fakes.ts'

const project: Project = { id: 'p-1', name: 'Aurora', folder: '/progetti/Aurora', addedAt: '' }
const JUNE = { from: '2026-06-01', to: '2026-06-30' }
const row = (id: number, employee: string, day: string, duration: number) => ({
  internalid: id,
  employee,
  timesheetdate: day,
  projectid: 'P1',
  duration,
  approvalstatus: 'Approved',
})
const FILES: Record<string, string> = {
  'ore/Timesheets/2026-06/netsuite_2026-06_A.json': JSON.stringify({
    rows: [row(1, 'Rossi Mario', '2026-06-03', 8), row(2, 'Rossi Mario', '2026-06-04', 8)],
  }),
  'ore/Timesheets/2026-06/netsuite_2026-06_all.json': JSON.stringify({
    rows: [row(1, 'Rossi Mario', '2026-06-03', 8), row(3, 'Bianchi Anna', '2026-06-10', 4)],
  }),
  'ore/Timesheets/2026-06/summary.md': 'not an export',
  'ore/Timesheets/broken.json': '{',
  'ore/jira/worklog-giugno.csv': 'Full name;Work date;Hours\nMario Rossi;2026-06-03;15\n',
  'ore/jira/altro.csv': 'a;b\n1;2\n',
  'note/elenco.json': '[]',
}

const jira: JiraFeedConfig = {
  since: '2026-01-01',
  targetFolder: '_octo/fonti/Jira',
  site: 'contoso',
  email: 'pm@example.test',
  projects: ['AUR'],
}

type TrackerSetup = {
  configured?: boolean
  secret?: string | null
  hours?: TrackerHours[]
  fails?: Error
}

function setup(initial: Partial<HoursSettings> = {}, tracker: TrackerSetup = {}) {
  let saved: HoursSettings = { ...DEFAULT_HOURS_SETTINGS, ...initial }
  const settings: HoursSettingsStore = {
    load: async () => saved,
    save: async (_folder, next) => {
      saved = next
    },
  }
  const unused = async (): Promise<never> => {
    throw new Error('not used')
  }
  const files: ProjectFiles = {
    withExtensions: async (_folder, extensions) =>
      Object.keys(FILES)
        .filter((path) => extensions.includes(path.split('.').pop() ?? ''))
        .map((path) => ({ path, size: 1, modifiedAt: '' })),
    read: unused,
    readText: async (_folder, path) => FILES[path] ?? null,
    under: async (_folder, folder) =>
      Object.keys(FILES).filter((path) => path.startsWith(`${folder}/`)),
    remove: unused,
  }
  const writer = memoryWriter()
  const secrets = memoryVault()
  if (tracker.secret !== null) void secrets.set('p-1/jira', tracker.secret ?? 'token')
  const asked: HoursPeriod[] = []
  const reader: TrackerHoursReader = {
    read: async (_config, _secret, period) => {
      asked.push(period)
      if (tracker.fails) throw tracker.fails
      return tracker.hours ?? []
    },
  }
  const hours = createHours({
    settings,
    files,
    sources: memorySourceSettings(
      tracker.configured === false ? NO_SOURCES : { ...NO_SOURCES, jira },
    ),
    secrets,
    tracker: reader,
    writer,
    clock: { now: () => new Date('2026-07-10T10:00:00.000Z') },
  })
  return Object.assign(hours, { written: writer.files, asked, saved: () => saved })
}

describe('hours', () => {
  it('reads every export under the folders set, each row once, and compares', async () => {
    const hours = setup({ timesheetPath: 'ore/Timesheets', worklogPath: 'ore/jira/' })
    const view = await hours.view(project, JUNE)
    expect(
      view.reconciliation.rows.map((r) => [r.person, r.timesheetHours, r.worklogHours, r.status]),
    ).toEqual([
      ['Bianchi Anna', 4, 0, 'no_worklog'],
      ['Rossi Mario', 16, 15, 'ok'],
    ])
    expect(view.sources).toEqual({
      timesheetFiles: 3,
      worklogFiles: 2,
      unreadable: ['ore/Timesheets/broken.json', 'ore/jira/altro.csv'],
      lastTimesheetDay: '2026-06-10',
      lastWorklogDay: '2026-06-03',
    })
    expect(view.projectCodes).toEqual(['P1'])
    expect(view.reconciliation.tieOut.ok).toBe(true)
  })

  it('reads a single file as well', async () => {
    const hours = setup({
      timesheetPath: 'ore/Timesheets/2026-06/netsuite_2026-06_A.json',
      worklogPath: 'ore/jira/worklog-giugno.csv',
    })
    const view = await hours.view(project, JUNE)
    expect(view.sources).toMatchObject({ timesheetFiles: 1, worklogFiles: 1, unreadable: [] })
    expect(view.reconciliation.totals).toEqual({
      timesheetHours: 16,
      worklogHours: 15,
      deltaPct: 6.3,
    })
  })

  it('says what is missing by a code', async () => {
    await expect(setup().view(project, JUNE)).rejects.toMatchObject({
      code: 'hours_sources_not_set',
    })
    await expect(
      setup({ timesheetPath: 'vuota', worklogPath: 'ore/jira' }).view(project, JUNE),
    ).rejects.toMatchObject({ code: 'hours_timesheet_missing' })
    await expect(
      setup({ timesheetPath: 'ore/Timesheets', worklogPath: 'vuota' }).view(project, JUNE),
    ).rejects.toMatchObject({ code: 'hours_worklog_missing' })
    const ready = setup({ timesheetPath: 'ore/Timesheets', worklogPath: 'ore/jira' })
    for (const period of [
      { from: 'June', to: '2026-06-30' },
      { from: '2026-06-01', to: '30/06/2026' },
      { from: '2026-07-01', to: '2026-06-30' },
    ]) {
      await expect(ready.view(project, period)).rejects.toMatchObject({
        code: 'hours_period_invalid',
      })
    }
  })

  it('never looks outside the project folder', async () => {
    const hours = setup()
    for (const path of ['../altrove', '/etc', 'C:\\dati', 'ore/../../x']) {
      await expect(
        hours.saveSettings(project, { ...DEFAULT_HOURS_SETTINGS, timesheetPath: path }),
      ).rejects.toMatchObject({ code: 'hours_settings_invalid' })
    }
    await expect(
      setup({ timesheetPath: '../x', worklogPath: 'ore/jira' }).view(project, JUNE),
    ).rejects.toMatchObject({ code: 'hours_settings_invalid' })
  })

  it('saves tidy settings and proposes where the hours seem to be', async () => {
    const hours = setup()
    const saved = await hours.saveSettings(project, {
      ...DEFAULT_HOURS_SETTINGS,
      timesheetPath: ' ore/Timesheets ',
      worklogPath: './ore/jira',
    })
    expect(saved.timesheetPath).toBe('ore/Timesheets')
    expect(await hours.settings(project)).toEqual(saved)
    expect(await hours.candidates(project)).toEqual({
      timesheets: ['ore/Timesheets'],
      worklogs: ['ore/jira/altro.csv', 'ore/jira/worklog-giugno.csv'],
    })
  })

  it('reads the hours from the tracker by whole months and keeps them as exports of the project', async () => {
    const hours = setup(
      { timesheetPath: 'ore/Timesheets', worklogPath: 'ore/jira' },
      {
        hours: [
          { person: 'Mario "il Rosso" Rossi', day: '2026-06-03', hours: 1.5, issue: 'AUR-2' },
          { person: 'Anna Bianchi', day: '2026-06-03', hours: 2, issue: 'AUR-1' },
          { person: 'Anna Bianchi', day: '2026-05-29', hours: 8, issue: 'AUR-1' },
        ],
      },
    )
    const run = await hours.readFromTracker(project, { from: '2026-05-20', to: '2026-06-10' })
    expect(hours.asked).toEqual([{ from: '2026-05-01', to: '2026-06-30' }])
    expect(run).toEqual({
      at: '2026-07-10T10:00:00.000Z',
      entries: 3,
      months: ['2026-05', '2026-06'],
      folder: TRACKER_HOURS_FOLDER,
    })
    expect(hours.written.get(`${TRACKER_HOURS_FOLDER}/worklog_2026-06.csv`)).toBe(
      'Issue Key;Work date;Hours;Full name\n"AUR-1";2026-06-03;2;"Anna Bianchi"\n"AUR-2";2026-06-03;1.5;"Mario ""il Rosso"" Rossi"\n',
    )
    expect(hours.written.get(`${TRACKER_HOURS_FOLDER}/worklog_2026-05.csv`)).toContain(
      '2026-05-29;8',
    )
    expect(hours.saved().worklogPath).toBe(TRACKER_HOURS_FOLDER)
  })

  it('writes an empty month too, so an old file never stays in its place', async () => {
    const hours = setup({ worklogPath: TRACKER_HOURS_FOLDER })
    await hours.readFromTracker(project, JUNE)
    expect(hours.written.get(`${TRACKER_HOURS_FOLDER}/worklog_2026-06.csv`)).toBe(
      'Issue Key;Work date;Hours;Full name\n',
    )
  })

  it('says why the tracker cannot be read, and lets a failed reading be tried again', async () => {
    await expect(
      setup({}, { configured: false }).readFromTracker(project, JUNE),
    ).rejects.toMatchObject({
      code: 'source_not_configured',
    })
    await expect(setup({}, { secret: null }).readFromTracker(project, JUNE)).rejects.toMatchObject({
      code: 'secret_missing',
    })
    const ready = setup()
    await expect(
      ready.readFromTracker(project, { from: '2026-07-01', to: '2026-06-01' }),
    ).rejects.toMatchObject({
      code: 'hours_period_invalid',
    })
    await expect(
      ready.readFromTracker(project, { from: '2025-01-01', to: '2026-06-01' }),
    ).rejects.toMatchObject({
      code: 'hours_period_invalid',
    })
    const failing = setup({}, { fails: new DomainError('feed_unreachable') })
    await expect(failing.readFromTracker(project, JUNE)).rejects.toMatchObject({
      code: 'feed_unreachable',
    })
    await expect(failing.readFromTracker(project, JUNE)).rejects.toMatchObject({
      code: 'feed_unreachable',
    })
    expect(failing.written.size).toBe(0)
  })

  it('makes one reading per project at a time', async () => {
    let release: () => void = () => {}
    const hours = setup()
    const slow = setup({}, {})
    void slow
    const blocked = new Promise<void>((resolve) => {
      release = resolve
    })
    const waiting = createHoursWaiting(blocked)
    const first = waiting.readFromTracker(project, JUNE)
    await expect(waiting.readFromTracker(project, JUNE)).rejects.toMatchObject({
      code: 'source_busy',
    })
    release()
    await first
    expect(hours.asked).toEqual([])
  })

  it('hands the timesheet rows to what else is computed from them, each once', async () => {
    const rows = await setup({ timesheetPath: 'ore/Timesheets' }).timesheet(project)
    expect(rows?.map((row) => row.id).sort()).toEqual(['1', '2', '3'])
    expect(await setup().timesheet(project)).toBeNull()
  })
})

/** Hours whose tracker answers only when told. */
function createHoursWaiting(until: Promise<void>) {
  const secrets = memoryVault()
  void secrets.set('p-1/jira', 'token')
  let saved = DEFAULT_HOURS_SETTINGS
  return createHours({
    settings: {
      load: async () => saved,
      save: async (_folder, next) => {
        saved = next
      },
    },
    files: {} as ProjectFiles,
    sources: memorySourceSettings({ ...NO_SOURCES, jira }),
    secrets,
    tracker: {
      read: async () => {
        await until
        return []
      },
    },
    writer: memoryWriter(),
    clock: { now: () => new Date('2026-07-10T10:00:00.000Z') },
  })
}
