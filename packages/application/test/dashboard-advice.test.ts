import type { DashboardSettings, Project } from '@octo/domain'
import { DEFAULT_DASHBOARD_SETTINGS, isDomainError } from '@octo/domain'
import { describe, expect, it } from 'vitest'
import {
  createDashboardAdvice,
  type DashboardView,
  figuresOf,
  type TrackerAdvisor,
} from '../src/index.ts'

const project: Project = { id: 'p-1', name: 'Aurora', folder: '/progetti/Aurora', addedAt: '' }
const NOW = new Date('2026-06-30T12:00:00Z')
const RANGE = { from: '2026-06-01', to: '2026-06-30', granularity: 'week' as const }
const settings: DashboardSettings = { ...DEFAULT_DASHBOARD_SETTINGS, stuckDays: 10 }

const bug = (id: string, daysInState: number, stuck: boolean) => ({
  id,
  title: `Bug ${id}`,
  state: 'Active',
  phase: 'work' as const,
  assignee: null,
  severity: null,
  environment: null,
  createdAt: '2026-05-01T08:00:00Z',
  daysInState,
  stuck,
  lastComment: null,
  note: null,
})

const view: DashboardView = {
  tracker: null,
  exportedAt: '2026-06-30T08:00:00Z',
  age: 'fresh',
  bugs: {
    open: [bug('101', 45, true), bug('102', 3, false)],
    validated: [],
    byPhase: { work: 2, verify: 0, validated: 0, closed: 5 },
    stuck: 1,
    total: 7,
    trend: [{ from: '2026-06-22', entered: 3, closed: 1, openAtEnd: 2 }],
    trendSource: 'history',
    flow: null,
    before: { open: 4, work: 3, verify: 1, stuck: 0, validated: 0 },
    flowBefore: null,
  },
  requirements: [],
  states: [],
  periods: [],
  tags: [],
  linked: true,
  waiting: [
    {
      id: '7',
      type: 'story',
      title: 'Esportazione',
      state: 'Active',
      assignee: 'Carla Bianchi',
      askedBy: 'Mario Rossi',
      askedAt: '2026-06-22T09:00:00Z',
      workdays: 6,
      question: 'Quale formato serve per la data?',
      fromClient: true,
    },
  ],
  tellsSides: true,
  sprints: ['Sprint 12'],
  currentSprint: 'Sprint 12',
  upcomingSprint: null,
  sprint: {
    name: 'Sprint 12',
    from: '2026-06-15',
    to: '2026-07-01',
    stories: [],
    byStage: { todo: 0, work: 1, verify: 0, validated: 0, closed: 1 },
    bugs: [],
    bugsOpen: 1,
    bugsClosed: 0,
    ending: true,
    atRisk: [
      {
        id: '7',
        title: 'Esportazione',
        state: 'Active',
        stage: 'work',
        assignee: null,
        daysInState: 4,
      },
    ],
  },
  comparison: [],
  decisions: [],
}

function setup(advisor: Partial<TrackerAdvisor>, shown: DashboardView = view) {
  const asked: unknown[] = []
  const advice = createDashboardAdvice({
    dashboard: { view: async () => shown, settings: async () => settings },
    advisor: {
      comment: async (request) => {
        asked.push(request)
        return advisor.comment?.(request) ?? []
      },
      reminder: async (request) => {
        asked.push(request)
        return advisor.reminder?.(request) ?? { to: null, text: '' }
      },
    },
    clock: { now: () => NOW },
    author: () => 'Paola Verdi',
    models: async () => ({ ask: 'opus' }) as never,
    liveSources: async () => [],
  })
  return { advice, asked }
}

describe('the numbers Claude is given', () => {
  it('are those of the page, with the worst items by id', () => {
    const figures = figuresOf(view, RANGE, 10)
    expect(figures.bugs.now).toEqual({ open: 2, work: 2, verify: 0, stuck: 1, validated: 0 })
    expect(figures.bugs.atPeriodStart?.open).toBe(4)
    expect(figures.bugs.stuckLongest.map((row) => row.id)).toEqual(['101'])
    expect(figures.sprint).toMatchObject({ name: 'Sprint 12', ending: true })
    expect(figures.waitingForAnAnswer).toMatchObject({ count: 1, fromClient: 1 })
    expect(figuresOf({ ...view, sprint: null }, RANGE, 10).sprint).toBeNull()
  })
})

describe('the comment of Claude on a period', () => {
  it('keeps what the code can stand behind, and counts what it threw away', async () => {
    const { advice, asked } = setup({
      comment: async () => [
        { text: 'I bug aperti sono 2, erano 4.', ids: [] },
        { text: 'Il bug #101 è fermo da 45 giorni.', ids: ['101'] },
        { text: 'La chiusura migliora del 73 per cento.', ids: [] },
        { text: 'Il bug #999 preoccupa.', ids: [] },
        { text: ' ', ids: [] },
      ],
    })
    const comment = await advice.comment(project, RANGE)
    expect(comment).toMatchObject({
      at: NOW.toISOString(),
      exportedAt: view.exportedAt,
      range: RANGE,
      dropped: 2,
    })
    expect(comment.sentences).toEqual([
      { text: 'I bug aperti sono 2, erano 4.', ids: [] },
      { text: 'Il bug #101 è fermo da 45 giorni.', ids: ['101'] },
    ])
    expect(asked[0]).toMatchObject({
      projectFolder: project.folder,
      model: 'opus',
      liveSources: [],
    })
  })

  it('passes on how the run goes and the way to stop it', async () => {
    const { advice, asked } = setup({})
    const signal = new AbortController().signal
    const onProgress = () => {}
    await advice.comment(project, RANGE, { signal, onProgress })
    expect(asked[0]).toMatchObject({ signal, onProgress })
  })
})

describe('the reminder for an item that waits', () => {
  it('is drafted from the item as the tracker shows it, signed by who uses Octo', async () => {
    const { advice, asked } = setup({
      reminder: async () => ({ to: ' Carla Bianchi ', text: ' Buongiorno Carla… ' }),
    })
    expect(await advice.reminder(project, '7')).toEqual({
      id: '7',
      to: 'Carla Bianchi',
      text: 'Buongiorno Carla…',
    })
    expect(asked[0]).toMatchObject({
      from: 'Paola Verdi',
      item: { id: '7', question: 'Quale formato serve per la data?' },
    })
    expect((asked[0] as { item: object }).item).not.toHaveProperty('fromClient')
  })

  it('is refused for an item that does not wait, and when Claude writes nothing', async () => {
    const { advice } = setup({ reminder: async () => ({ to: null, text: '  ' }) })
    await expect(advice.reminder(project, '404')).rejects.toSatisfy(
      (error) => isDomainError(error) && error.code === 'tracker_item_not_waiting',
    )
    await expect(advice.reminder(project, '7')).rejects.toSatisfy(
      (error) => isDomainError(error) && error.code === 'agent_output_invalid',
    )
  })

  it('goes without a signature and without a model when nothing tells them', async () => {
    const asked: unknown[] = []
    const advice = createDashboardAdvice({
      dashboard: { view: async () => view, settings: async () => settings },
      advisor: {
        comment: async () => [],
        reminder: async (request) => {
          asked.push(request)
          return { to: null, text: 'Buongiorno' }
        },
      },
      clock: { now: () => NOW },
    })
    expect(await advice.reminder(project, '7')).toEqual({ id: '7', to: null, text: 'Buongiorno' })
    expect(asked[0]).toMatchObject({ from: null, model: null, liveSources: [] })
  })
})
