import { describe, expect, it } from 'vitest'
import {
  currentSprint,
  type DashboardSettings,
  DEFAULT_DASHBOARD_SETTINGS,
  type ItemHistory,
  NO_TEAM,
  nextSprint,
  type ProjectTeam,
  sameSprint,
  sprintComparison,
  sprintNames,
  sprintPeriod,
  sprintProgress,
  type TrackerData,
  type TrackerItem,
  unclearRequirements,
} from '../src/index.ts'

const settings: DashboardSettings = { ...DEFAULT_DASHBOARD_SETTINGS, tags: ['Team'] }
const AS_OF = new Date('2026-06-30T12:00:00Z')

function story(overrides: Partial<TrackerItem>): TrackerItem {
  return {
    id: '1',
    type: 'User Story',
    title: 'Una storia',
    state: 'Active',
    tags: ['Team'],
    assignee: null,
    createdAt: '2026-06-01T08:00:00Z',
    stateChangedAt: '2026-06-20T08:00:00Z',
    severity: null,
    period: null,
    sprint: 'Sprint 12',
    parentId: null,
    environment: null,
    description:
      'Una descrizione abbastanza lunga da non essere un segnale di requisito poco chiaro, davvero.',
    acceptanceCriteria: 'Criteri scritti per intero e verificabili.',
    comments: [],
    ...overrides,
  }
}

const team: ProjectTeam = {
  people: [],
  periods: [
    { name: 'PI 3', from: '2026-05-01', to: '2026-07-31' },
    { name: 'Sprint 11', from: '2026-06-01', to: '2026-06-14' },
    { name: 'sprint 12', from: '2026-06-15', to: '2026-07-01' },
    { name: 'Sprint 13', from: '2026-07-02', to: '2026-07-15' },
  ],
}

const data = (items: TrackerItem[], history: TrackerData['history'] = null): TrackerData => ({
  exportedAt: null,
  items,
  history,
})

describe('which sprint is which', () => {
  const names = ['PI 3', 'Sprint 11', 'Sprint 12', 'Sprint 13']

  it('reads a sprint written as a path as its last part', () => {
    expect(sameSprint('Aurora\\PI 3\\Sprint 12', 'sprint 12')).toBe(true)
    expect(sameSprint('Sprint 12', 'Sprint 13')).toBe(false)
    expect(sprintPeriod('Aurora\\Sprint 12', team)?.to).toBe('2026-07-01')
    expect(sprintPeriod('Sprint 99', team)).toBeNull()
  })

  it('names the sprints of the stories and bugs in scope', () => {
    const items = [
      story({ id: '1', sprint: 'Sprint 12' }),
      story({ id: '2', type: 'Bug', sprint: 'Sprint 2' }),
      story({ id: '3', sprint: null }),
      story({ id: '4', type: 'Task', sprint: 'Sprint 7' }),
      story({ id: '5', tags: ['Other'], sprint: 'Sprint 8' }),
    ]
    expect(sprintNames(data(items), settings)).toEqual(['Sprint 2', 'Sprint 12'])
  })

  it('tells the running one as the shortest stretch that holds the day, and the one after', () => {
    expect(currentSprint(names, team, '2026-06-30')).toBe('Sprint 12')
    expect(nextSprint(names, team, '2026-06-30')).toBe('Sprint 13')
    expect(currentSprint(names, team, '2026-08-20')).toBeNull()
    expect(nextSprint(names, team, '2026-08-20')).toBeNull()
    // Nothing later in the calendar: the one named after the running one.
    expect(nextSprint(['Sprint 12', 'Sprint 14'], team, '2026-06-30')).toBe('Sprint 14')
    expect(currentSprint(names, NO_TEAM, '2026-06-30')).toBeNull()
  })
})

describe('the progress of a sprint', () => {
  const items = [
    story({ id: '1', state: 'New', stateChangedAt: null }),
    story({ id: '2', state: 'Active', assignee: 'Luca' }),
    story({ id: '3', state: 'Resolved' }),
    story({ id: '4', state: 'Validated' }),
    story({ id: '5', state: 'Closed' }),
    story({ id: '6', sprint: 'Sprint 11' }),
    story({ id: '7', type: 'Bug', state: 'Active' }),
    story({ id: '8', type: 'Bug', state: 'Closed' }),
  ]

  it('counts the stories by stage and the bugs, and names what will not make it while it ends', () => {
    const progress = sprintProgress(data(items), settings, 'Sprint 12', team, '2026-06-30', AS_OF)
    expect(progress).toMatchObject({
      name: 'Sprint 12',
      from: '2026-06-15',
      to: '2026-07-01',
      byStage: { todo: 1, work: 1, verify: 1, validated: 1, closed: 1 },
      bugsOpen: 1,
      bugsClosed: 1,
      ending: true,
    })
    expect(progress.stories).toHaveLength(5)
    expect(progress.atRisk.map((row) => row.id)).toEqual(['2', '1'])
    expect(progress.stories.find((row) => row.id === '2')).toMatchObject({
      stage: 'work',
      assignee: 'Luca',
      daysInState: 10,
    })
    expect(progress.stories.find((row) => row.id === '1')?.daysInState).toBeNull()
  })

  it('is not ending early in the sprint, after it, or without its dates', () => {
    const at = (today: string, sprint = 'Sprint 12', calendar = team) =>
      sprintProgress(data(items), settings, sprint, calendar, today, AS_OF)
    expect(at('2026-06-16')).toMatchObject({ ending: false, atRisk: [] })
    expect(at('2026-07-05').ending).toBe(false)
    expect(at('2026-06-30', 'Sprint 12', NO_TEAM)).toMatchObject({
      from: null,
      to: null,
      ending: false,
    })
  })
})

describe('the sprints side by side', () => {
  const history = (states: Array<[string, string]>): ItemHistory => ({
    createdAt: '2026-06-01T08:00:00Z',
    states: states.map(([at, state]) => ({ at, state })),
    tags: [],
  })
  const items = [
    story({ id: '1', sprint: 'Sprint 11', state: 'Closed' }),
    story({ id: '2', sprint: 'Sprint 11', state: 'Closed' }),
    story({ id: '3', sprint: 'Sprint 11', state: 'Active' }),
    story({ id: '4', sprint: 'Sprint 12', state: 'Active' }),
    story({ id: '5', sprint: 'Sprint 13', state: 'New' }),
    story({ id: '6', type: 'Bug', sprint: 'Sprint 11', createdAt: '2026-06-03T08:00:00Z' }),
    story({ id: '7', type: 'Bug', sprint: null, createdAt: '2026-06-20T08:00:00Z' }),
  ]

  it('counts what was done, what was done in time and the bugs that came in, for the sprints started', () => {
    const histories = new Map([
      ['1', history([['2026-06-10T08:00:00Z', 'Closed']])],
      ['2', history([['2026-06-20T08:00:00Z', 'Closed']])],
      ['3', history([['2026-06-02T08:00:00Z', 'Active']])],
    ])
    const rows = sprintComparison(data(items, histories), settings, team, '2026-06-30')
    expect(rows.map((row) => row.name)).toEqual(['Sprint 11', 'Sprint 12'])
    expect(rows[0]).toEqual({
      name: 'Sprint 11',
      from: '2026-06-01',
      to: '2026-06-14',
      stories: 3,
      done: 2,
      doneInTime: 1,
      open: 1,
      bugsEntered: 1,
    })
    // No story of the running sprint has a history: when they closed is not known.
    expect(rows[1]).toMatchObject({
      stories: 1,
      done: 0,
      doneInTime: null,
      open: 1,
      bugsEntered: 1,
    })
  })

  it('without the calendar lists the sprints by name, and says nothing of what needs its days', () => {
    const rows = sprintComparison(data(items), settings, NO_TEAM, '2026-06-30')
    expect(rows.map((row) => row.name)).toEqual(['Sprint 11', 'Sprint 12', 'Sprint 13'])
    expect(rows[0]).toMatchObject({ done: 2, doneInTime: null, bugsEntered: null, from: null })
  })

  it('says nothing of what was done in time without any history', () => {
    const rows = sprintComparison(data(items), settings, team, '2026-06-30')
    expect(rows[0]?.doneInTime).toBeNull()
  })
})

describe('the requirements checked', () => {
  const items = [
    story({ id: '1', sprint: 'Sprint 12', state: 'New', period: 'P1' }),
    story({ id: '2', sprint: 'Sprint 13', state: 'New', period: 'P2' }),
    story({ id: '3', sprint: null, state: 'New', period: null }),
  ]
  const ids = (rows: Array<{ id: string }>) => rows.map((row) => row.id)

  it('are those of the sprint that comes next, unless the PM chose the periods by hand', () => {
    expect(ids(unclearRequirements(data(items), settings))).toEqual(['1', '2', '3'])
    expect(ids(unclearRequirements(data(items), settings, 'Sprint 13'))).toEqual(['2'])
    const byHand = { ...settings, requirementPeriods: ['P1'] }
    expect(ids(unclearRequirements(data(items), byHand, 'Sprint 13'))).toEqual(['1'])
  })
})
