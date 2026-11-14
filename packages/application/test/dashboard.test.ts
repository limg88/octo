import { type DashboardSettings, DEFAULT_DASHBOARD_SETTINGS, type Project } from '@octo/domain'
import { describe, expect, it } from 'vitest'
import { createDashboard, type DashboardSettingsStore, type TrackerExports } from '../src/index.ts'

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

function setup(initial: Partial<DashboardSettings> = {}, files: Record<string, unknown> = {}) {
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
  return createDashboard({ settings, exports, clock: { now: () => NOW } })
}

describe('dashboard', () => {
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
})
