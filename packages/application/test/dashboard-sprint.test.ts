import {
  type DashboardSettings,
  DEFAULT_DASHBOARD_SETTINGS,
  NO_SOURCES,
  type Project,
  type ProjectTeam,
  TRACKER_SNAPSHOT_PATH,
} from '@octo/domain'
import { describe, expect, it } from 'vitest'
import { createDashboard, type DashboardSettingsStore, type TrackerExports } from '../src/index.ts'
import { memorySourceSettings } from './fakes.ts'

const project: Project = { id: 'p-1', name: 'Aurora', folder: '/progetti/Aurora', addedAt: '' }
const NOW = new Date('2026-06-30T12:00:00Z')
const RANGE = { from: '2026-06-01', to: '2026-06-30', granularity: 'week' as const }

const story = (id: number, sprint: string, state: string, extra: Record<string, unknown> = {}) => ({
  id,
  type: 'User Story',
  title: `Storia ${id}`,
  state,
  tags: ['Team'],
  sprint,
  created_date: '2026-06-02T08:00:00Z',
  ...extra,
})

const EXPORT = {
  exported_at: '2026-06-30T08:00:00Z',
  items: [
    story(1, 'Sprint 12', 'Active', {
      assigned_to: 'Carla Bianchi',
      discussion: [
        {
          by: 'Mario Rossi',
          date: '2026-06-22T09:00:00Z',
          text: 'Quale formato serve per la data?',
        },
      ],
    }),
    story(2, 'Sprint 12', 'Closed'),
    story(3, 'Sprint 13', 'New'),
    story(4, 'Sprint 11', 'New'),
    {
      id: 9,
      type: 'Bug',
      title: 'Totale sbagliato',
      state: 'Active',
      tags: ['Team'],
      sprint: 'Sprint 12',
      created_date: '2026-06-16T08:00:00Z',
    },
  ],
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
const TEAM: ProjectTeam = {
  people: [person('Mario Rossi', 'supplier'), person('Carla Bianchi', 'client')],
  periods: [
    { name: 'Sprint 11', from: '2026-06-01', to: '2026-06-14' },
    { name: 'Sprint 12', from: '2026-06-15', to: '2026-07-01' },
    { name: 'Sprint 13', from: '2026-07-02', to: '2026-07-15' },
  ],
}

function setup(
  initial: Partial<DashboardSettings> = {},
  options: { team?: ProjectTeam | 'fails'; linked?: boolean } = {},
) {
  const saved: DashboardSettings = {
    ...DEFAULT_DASHBOARD_SETTINGS,
    exportPath: TRACKER_SNAPSHOT_PATH,
    tags: ['Team'],
    ...initial,
  }
  const settings: DashboardSettingsStore = { load: async () => saved, save: async () => {} }
  const exports: TrackerExports = {
    readJson: async (_folder, path) => (path === saved.exportPath ? EXPORT : null),
    candidates: async () => ({ exports: [], histories: [] }),
  }
  const { team = TEAM, linked = true } = options
  return createDashboard({
    settings,
    exports,
    clock: { now: () => NOW },
    team: async () => {
      if (team === 'fails') throw new Error('no team')
      return team
    },
    sources: memorySourceSettings({
      ...NO_SOURCES,
      ado: linked
        ? {
            organization: 'contoso',
            project: 'Aurora Web',
            areas: [],
            since: '2026-01-01',
            targetFolder: 'Fonti/ADO',
          }
        : null,
    }),
  })
}

describe('the dashboard by sprint', () => {
  it('shows the running sprint, the one after, and the stories that wait for the client', async () => {
    const view = await setup().view(project, RANGE)
    expect(view.sprints).toEqual(['Sprint 11', 'Sprint 12', 'Sprint 13'])
    expect(view).toMatchObject({ currentSprint: 'Sprint 12', upcomingSprint: 'Sprint 13' })
    expect(view.sprint).toMatchObject({
      name: 'Sprint 12',
      ending: true,
      bugsOpen: 1,
      byStage: { todo: 0, work: 1, verify: 0, validated: 0, closed: 1 },
    })
    expect(view.sprint?.atRisk.map((row) => row.id)).toEqual(['1'])
    expect(view.comparison.map((row) => row.name)).toEqual(['Sprint 11', 'Sprint 12'])
    // Only the stories of the sprint that comes next are asked whether they are clear.
    expect(view.requirements.map((row) => row.id)).toEqual(['3'])
    expect(view.tellsSides).toBe(true)
    expect(view.waiting).toHaveLength(1)
    expect(view.waiting[0]).toMatchObject({ id: '1', type: 'story', fromClient: true, workdays: 6 })
  })

  it('shows the sprint asked in place of the running one, and none when nothing tells', async () => {
    expect((await setup().view(project, RANGE, 'sprint 11')).sprint?.name).toBe('Sprint 11')
    expect((await setup().view(project, RANGE, 'Sprint 99')).sprint?.name).toBe('Sprint 12')
    const lost = await setup({}, { team: 'fails' }).view(project, RANGE)
    expect(lost).toMatchObject({ sprint: null, currentSprint: null, upcomingSprint: null })
    // Without the next sprint every story to work on is checked, as before.
    expect(lost.requirements.map((row) => row.id)).toEqual(['3', '4', '1'])
    expect(lost.tellsSides).toBe(false)
  })

  it('looks for who waits for an answer also among the items of the client’s people', async () => {
    const view = await setup({ ownPeopleOnly: true }).view(project, RANGE)
    // No item is of the supplier's people: the numbers see none, and no sprint.
    expect(view.sprint).toBeNull()
    expect(view.waiting.map((row) => row.id)).toEqual(['1'])
  })

  it('lists the decisions taken, with the title of the item', async () => {
    const view = await setup({
      decisions: {
        excludedRequirements: [{ id: '3', at: '2026-06-20T08:00:00Z' }],
        removedSignals: [],
        notes: [{ id: '9', at: '2026-06-21T08:00:00Z', text: 'atteso' }],
      },
    }).view(project, RANGE)
    expect(view.decisions.map((row) => [row.kind, row.id, row.title])).toEqual([
      ['note', '9', 'Totale sbagliato'],
      ['clear', '3', 'Storia 3'],
    ])
    expect(view.requirements).toEqual([])
  })
})

describe('where the tracker keeps an item', () => {
  it('is an address on Azure DevOps, when Octo read the tracker from there', async () => {
    const dashboard = setup()
    expect((await dashboard.view(project, RANGE)).linked).toBe(true)
    expect(await dashboard.itemUrl(project, '9')).toBe(
      'https://dev.azure.com/contoso/Aurora%20Web/_workitems/edit/9',
    )
    // Only an id of the tracker makes an address: nothing else is put in one.
    expect(await dashboard.itemUrl(project, '9/../../x')).toBeNull()
  })

  it('is not known for an export kept by hand, or while Azure DevOps is not linked', async () => {
    const byHand = setup({ exportPath: 'data/export.json' })
    expect((await byHand.view(project, RANGE)).linked).toBe(false)
    expect(await byHand.itemUrl(project, '9')).toBeNull()
    const unlinked = setup({}, { linked: false })
    expect((await unlinked.view(project, RANGE)).linked).toBe(false)
    expect(await unlinked.itemUrl(project, '9')).toBeNull()
  })
})
