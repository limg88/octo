import {
  type DashboardSettings,
  DEFAULT_DASHBOARD_SETTINGS,
  type Project,
  type ProjectTeam,
  TRACKER_PATHS,
  TRACKER_SUMMARY_PATH,
  type TrackerHours,
} from '@octo/domain'
import { describe, expect, it } from 'vitest'
import { createDashboard, type DashboardSettingsStore, type TrackerExports } from '../src/index.ts'
import { memoryWriter } from './fakes.ts'

const project: Project = { id: 'p-1', name: 'Aurora', folder: '/progetti/Aurora', addedAt: '' }
const NOW = new Date('2026-06-30T12:00:00Z')
const RANGE = { from: '2026-06-01', to: '2026-06-30', granularity: 'week' as const }

const EXPORT = {
  exported_at: '2026-06-28T08:00:00Z',
  items: [
    {
      id: 1,
      type: 'Bug',
      title: 'Open',
      state: '04 - In Progress',
      tags: ['Team'],
      created_date: '2026-06-01T08:00:00Z',
      state_change_date: '2026-06-08T08:00:00Z',
    },
    {
      id: 2,
      type: 'Bug',
      title: 'Done',
      state: '12b - Closed',
      tags: ['Team'],
      created_date: '2026-06-02T08:00:00Z',
      state_change_date: '2026-06-12T08:00:00Z',
    },
    {
      id: 3,
      type: 'Bug',
      title: 'Elsewhere',
      state: '02 - To Do',
      tags: ['Other'],
      created_date: '2026-06-02T08:00:00Z',
    },
    {
      id: 4,
      type: 'User Story',
      title: 'Vague',
      state: 'New',
      tags: ['Team'],
      pi: 'P2',
      created_date: '2026-06-02T08:00:00Z',
    },
    {
      id: 5,
      type: 'User Story',
      title: 'Other period',
      state: 'New',
      tags: ['Team'],
      pi: 'P1',
      created_date: '2026-06-02T08:00:00Z',
    },
  ],
}
const HISTORY = {
  bugs: {
    '1': {
      created: '2026-06-01T08:00:00Z',
      states: [['2026-06-01T08:00:00Z', '02 - To Do']],
      tags: [['2026-06-01T08:00:00Z', 'Team']],
    },
  },
}

const person = (name: string, side: 'supplier' | 'client') => ({
  name,
  role: '',
  side,
  from: '',
  to: '',
  allocation: null,
  note: '',
})
/** The people of the project: one of the supplier, one of the client. */
const TEAM: ProjectTeam = {
  people: [person('Mario Rossi', 'supplier'), person('Carla Bianchi', 'client')],
  periods: [],
}

function setup(
  initial: Partial<DashboardSettings> = {},
  files: Record<string, unknown> = {},
  writer?: ReturnType<typeof memoryWriter>,
  team?: ProjectTeam,
  worklog?: TrackerHours[] | Error,
) {
  let saved: DashboardSettings = { ...DEFAULT_DASHBOARD_SETTINGS, ...initial }
  const settings: DashboardSettingsStore = {
    load: async () => saved,
    save: async (_folder, next) => {
      saved = next
    },
  }
  const exports: TrackerExports = {
    readJson: async (_folder, path) => {
      const value = files[path]
      if (value instanceof Error) throw value
      return value ?? null
    },
    candidates: async () => ({ exports: Object.keys(files), histories: [] }),
  }
  return createDashboard({
    settings,
    exports,
    clock: { now: () => NOW },
    ...(writer ? { writer } : {}),
    ...(team ? { team: async () => team } : {}),
    ...(worklog
      ? {
          worklog: async () => {
            if (worklog instanceof Error) throw worklog
            return worklog
          },
        }
      : {}),
  })
}

describe('dashboard', () => {
  it('keeps the tracker in numbers as a text, following the perimeter just saved', async () => {
    const writer = memoryWriter()
    const dashboard = setup({ exportPath: 'export.json' }, { 'export.json': EXPORT }, writer)
    const saved = await dashboard.settings(project)

    await dashboard.saveSettings(project, { ...saved, tags: ['Team'] })
    expect(writer.files.get(TRACKER_SUMMARY_PATH)).toContain('- Bug nel perimetro: 2')
    await dashboard.saveSettings(project, { ...saved, tags: [] })
    expect(writer.files.get(TRACKER_SUMMARY_PATH)).toContain('- Bug nel perimetro: 3')

    // No export, or one that cannot be read: the settings are saved and no number is written.
    const none = memoryWriter()
    await setup({}, {}, none).saveSettings(project, { ...saved, exportPath: '' })
    await setup({}, {}, none).saveSettings(project, { ...saved, exportPath: 'manca.json' })
    expect(none.files.size).toBe(0)
  })

  it('computes the view from the export, counting days up to its date', async () => {
    const dashboard = setup(
      { exportPath: 'export.json', tags: ['Team'] },
      { 'export.json': EXPORT },
    )
    const view = await dashboard.view(project, RANGE)
    expect(view).toMatchObject({
      exportedAt: '2026-06-28T08:00:00Z',
      age: 'warning',
      periods: ['P1', 'P2'],
    })
    expect(view.tags.length).toBeGreaterThan(0)
    expect(view.tags).toEqual([...new Set(view.tags)].sort())
    expect(view.bugs.total).toBe(2)
    expect(view.bugs.open).toHaveLength(1)
    expect(view.bugs.open[0]?.daysInState).toBe(20)
    expect(view.bugs.trendSource).toBe('approximate')
    expect(view.requirements.map((row) => row.id)).toEqual(['4', '5'])
    expect(view.states).toEqual([
      { state: '04 - In Progress', phase: 'work', mappedByHand: false, count: 1 },
      { state: '12b - Closed', phase: 'closed', mappedByHand: false, count: 1 },
    ])
  })

  it('counts only the items of the supplier’s own people, when the PM asks so', async () => {
    const assigned = {
      ...EXPORT,
      items: EXPORT.items.map((item, at) => ({
        ...item,
        // Bug 1 and story 4 are ours; bug 2 is the client's, the others nobody's.
        assigned_to:
          ['Rossi Mario', 'Bianchi Carla', null, 'MARIO ROSSI', 'Verdi Luca'][at] ?? null,
      })),
    }
    const files = { 'export.json': assigned }
    const writer = memoryWriter()
    const own = setup(
      { exportPath: 'export.json', tags: ['Team'], ownPeopleOnly: true },
      files,
      writer,
      TEAM,
    )
    const view = await own.view(project, RANGE)
    expect(view.bugs.total).toBe(1)
    expect(view.bugs.open.map((bug) => bug.id)).toEqual(['1'])
    expect(view.requirements.map((row) => row.id)).toEqual(['4'])
    // The text of the numbers says what it counted.
    await own.saveSettings(project, await own.settings(project))
    expect(writer.files.get(TRACKER_SUMMARY_PATH)).toContain(
      '- Perimetro: elementi con tag Team, assegnati alle persone del fornitore',
    )

    // Not asked: everybody's items count, as before.
    const all = setup({ exportPath: 'export.json', tags: ['Team'] }, files, undefined, TEAM)
    expect((await all.view(project, RANGE)).bugs.total).toBe(2)
  })

  it('uses the history when the project has one and goes on without when it is not readable', async () => {
    const files = { 'export.json': EXPORT, 'history.json': HISTORY }
    const withHistory = setup({ exportPath: 'export.json', historyPath: 'history.json' }, files)
    expect((await withHistory.view(project, RANGE)).bugs.trendSource).toBe('history')
    const broken = setup(
      { exportPath: 'export.json', historyPath: 'history.json' },
      { 'export.json': EXPORT, 'history.json': new Error('damaged') },
    )
    expect((await broken.view(project, RANGE)).bugs.trendSource).toBe('approximate')
    const missing = setup({ exportPath: 'export.json', historyPath: 'gone.json' }, files)
    expect((await missing.view(project, RANGE)).bugs.flow).toBeNull()
  })

  it('says what is wrong with the export by a code', async () => {
    await expect(setup().view(project, RANGE)).rejects.toMatchObject({
      code: 'tracker_export_not_set',
    })
    await expect(setup({ exportPath: 'gone.json' }).view(project, RANGE)).rejects.toMatchObject({
      code: 'tracker_export_missing',
    })
    await expect(
      setup({ exportPath: 'odd.json' }, { 'odd.json': { rows: [] } }).view(project, RANGE),
    ).rejects.toMatchObject({ code: 'tracker_export_unreadable' })
  })

  it('refuses a period that is not one', async () => {
    const dashboard = setup({ exportPath: 'export.json' }, { 'export.json': EXPORT })
    for (const range of [
      { ...RANGE, from: 'never' },
      { ...RANGE, from: '2026-07-01' },
      { ...RANGE, granularity: 'day' as never },
      { ...RANGE, from: '1900-01-01' },
      { from: '1900-01-01', to: '2026-06-30', granularity: 'month' as const },
    ]) {
      await expect(dashboard.view(project, range)).rejects.toMatchObject({
        code: 'dashboard_range_invalid',
      })
    }
  })

  it('saves tidy settings and proposes the exports of the folder', async () => {
    const dashboard = setup({}, { 'export.json': EXPORT })
    const saved = await dashboard.saveSettings(project, {
      ...DEFAULT_DASHBOARD_SETTINGS,
      exportPath: ' export.json ',
      tags: ['Team', 'Team'],
    })
    expect(saved).toMatchObject({ exportPath: 'export.json', tags: ['Team'] })
    expect(await dashboard.settings(project)).toEqual(saved)
    expect(await dashboard.candidates(project)).toEqual({ exports: ['export.json'], histories: [] })
  })

  it('shows a Jira kept as a register of activities as one, with hours and diary, and no false signal', async () => {
    const issue = (
      id: string,
      type: string,
      state: string,
      more: Record<string, unknown> = {},
    ) => ({
      id,
      type,
      title: `Attività ${id}`,
      state,
      tags: [],
      created_date: '2026-09-01T08:00:00Z',
      // As Octo wrote a reading of Jira before it knew the field does not exist there.
      acceptance_criteria: '',
      description:
        'Una descrizione abbastanza lunga da dire che cosa va fatto, per chi e perché serve.',
      ...more,
    })
    const reading = {
      exported_at: '2026-06-28T08:00:00Z',
      items: [
        issue('AUR-1', 'Story', 'In corso', { assigned_to: 'Anna Rossi' }),
        issue('AUR-2', 'Story', 'Completata'),
        issue('AUR-3', 'Task', 'In corso', {
          assigned_to: 'Luca Bianchi',
          discussion: [
            { by: 'Luca Bianchi', date: '2026-06-10T08:00:00Z', text: 'Prima bozza' },
            { by: 'Luca Bianchi', date: '2026-06-20T08:00:00Z', text: 'Inviata bozza al cliente' },
          ],
        }),
        issue('AUR-4', 'Task', 'Da completare'),
        issue('AUR-5', 'Epic', 'Da completare'),
      ],
    }
    const worklog: TrackerHours[] = [
      { issue: 'AUR-3', person: 'Luca Bianchi', day: '2026-06-10', hours: 21.5 },
      { issue: 'AUR-3', person: 'bianchi luca', day: '2026-06-11', hours: 4 },
      { issue: 'AUR-1', person: 'Anna Rossi', day: '2026-06-12', hours: 8 },
      { issue: 'AUR-99', person: 'Anna Rossi', day: '2026-06-12', hours: 2 },
    ]
    const jira = TRACKER_PATHS.jira.snapshot
    const dashboard = setup(
      { exportPath: jira },
      { [jira]: reading },
      undefined,
      undefined,
      worklog,
    )
    const view = await dashboard.view(project, RANGE)

    expect(view.tracker).toBe('jira')
    // No bug and no sprint: the bugs, their trend and the sprint have nothing to show.
    expect(view.parts).toEqual({ sprint: false, bugs: false, trend: false, activities: true })
    expect(view.types).toEqual([
      { type: 'Story', count: 2 },
      { type: 'Task', count: 2 },
      { type: 'Epic', count: 1 },
    ])
    // Jira has no acceptance criteria: a story is not unclear for lacking them.
    expect(view.requirements).toEqual([])
    // Every item whatever its type: what is being worked on first, then by the hours it took.
    expect(view.activities.rows.map((row) => [row.id, row.hours])).toEqual([
      ['AUR-3', 25.5],
      ['AUR-1', 8],
      ['AUR-4', 0],
      ['AUR-5', 0],
      ['AUR-2', 0],
    ])
    expect(view.activities.rows[0]?.comments.map((comment) => comment.text)).toEqual([
      'Inviata bozza al cliente',
      'Prima bozza',
    ])
    expect(view.activities.people).toEqual([
      { person: 'Luca Bianchi', hours: 25.5, capHours: null },
      { person: 'Anna Rossi', hours: 8, capHours: null },
    ])
    // With the caps of the team, the hours of each are beside the most they are to spend.
    const capped: ProjectTeam = {
      people: [
        { ...person('Bianchi Luca', 'supplier'), capDays: 8 },
        { ...person('Anna Rossi', 'supplier'), role: 'PM (2 gg)' },
      ],
      periods: [],
    }
    const withCaps = setup({ exportPath: jira }, { [jira]: reading }, undefined, capped, worklog)
    expect((await withCaps.view(project, RANGE)).activities.people).toEqual([
      { person: 'Luca Bianchi', hours: 25.5, capHours: 64 },
      { person: 'Anna Rossi', hours: 8, capHours: 16 },
    ])
    expect(view.activities).toMatchObject({ hours: 33.5, otherHours: 2 })

    // A story with nothing written in it is a line of work here, not a requirement to refine:
    // the sprint part stays hidden even though the signal on its description is there.
    const bare = {
      ...reading,
      items: [...reading.items, issue('AUR-6', 'Story', 'Da completare', { description: '' })],
    }
    const withBare = await setup({ exportPath: jira }, { [jira]: bare }).view(project, RANGE)
    expect(withBare.requirements.map((row) => [row.id, row.signals])).toEqual([['AUR-6', ['S3']]])
    expect(withBare.parts).toEqual({ sprint: false, bugs: false, trend: false, activities: true })

    // The same file kept by hand is of a tracker Octo knows nothing of: the signal stays.
    const byHand = setup({ exportPath: 'dati/export.json' }, { 'dati/export.json': reading })
    const told = await byHand.view(project, RANGE)
    expect(told.tracker).toBeNull()
    // (On the story still to do: the one completed is past the question.)
    expect(told.requirements.map((row) => [row.id, row.signals])).toEqual([['AUR-1', ['S2']]])
    // Without the hours, or when they cannot be read, the activities are there with no hours.
    expect(told.activities.hours).toBe(0)
    const broken = setup(
      { exportPath: jira },
      { [jira]: reading },
      undefined,
      undefined,
      new Error('x'),
    )
    expect((await broken.view(project, RANGE)).activities.people).toEqual([])
  })

  it('shows the bugs, their trend and the sprint when the tracker has them, and no activities', async () => {
    const view = await setup(
      { exportPath: 'dati/export.json' },
      { 'dati/export.json': EXPORT },
    ).view(project, RANGE)
    expect(view.parts).toEqual({ sprint: true, bugs: true, trend: true, activities: false })
    expect(view.types.map((entry) => entry.type)).toEqual(['Bug', 'User Story'])
    // Nothing in scope: no part has anything to show, and the page hides none.
    const empty = await setup(
      { exportPath: 'dati/export.json', tags: ['Nessuno'] },
      { 'dati/export.json': EXPORT },
    ).view(project, RANGE)
    expect(empty.parts).toEqual({ sprint: false, bugs: false, trend: false, activities: false })
  })

  it('calls the tracker by its name in the numbers of a Jira', async () => {
    const jira = TRACKER_PATHS.jira.snapshot
    const writer = memoryWriter()
    const dashboard = setup({}, { [jira]: EXPORT }, writer)
    await dashboard.saveSettings(project, { ...DEFAULT_DASHBOARD_SETTINGS, exportPath: jira })
    expect(writer.files.get(TRACKER_SUMMARY_PATH)).toContain(
      '# Tracker (Jira): riepilogo in numeri',
    )
    await dashboard.saveSettings(project, { ...DEFAULT_DASHBOARD_SETTINGS, exportPath: 'x.json' })
  })
})
