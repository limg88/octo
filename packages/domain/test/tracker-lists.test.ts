import { describe, expect, it } from 'vitest'
import {
  activeFacets,
  awaitingAnswer,
  type BugRow,
  bugBreakdowns,
  bugDashboard,
  checkedComment,
  countsAt,
  type DashboardSettings,
  DEFAULT_DASHBOARD_SETTINGS,
  decisionRows,
  filterBugs,
  type ItemHistory,
  isFiltered,
  isStuck,
  isTelling,
  NO_BUG_QUERY,
  NO_TEAM,
  NOT_STATED,
  numbersIn,
  type ProjectTeam,
  questionIn,
  type TeamPerson,
  type TrackerItem,
  tellsSides,
  withoutTrackerDecision,
} from '../src/index.ts'

const settings: DashboardSettings = { ...DEFAULT_DASHBOARD_SETTINGS, tags: ['Team'], stuckDays: 10 }
const NOW = new Date('2026-06-30T12:00:00Z')

function item(overrides: Partial<TrackerItem>): TrackerItem {
  return {
    id: '1',
    type: 'Bug',
    title: 'A bug',
    state: '04 - In Progress',
    tags: ['Team'],
    assignee: null,
    createdAt: '2026-06-01T08:00:00Z',
    stateChangedAt: '2026-06-20T08:00:00Z',
    severity: null,
    period: null,
    sprint: null,
    parentId: null,
    environment: null,
    description: '',
    acceptanceCriteria: '',
    comments: [],
    ...overrides,
  }
}

function row(overrides: Partial<BugRow>): BugRow {
  return {
    id: '1',
    title: 'Totale sbagliato',
    state: 'Active',
    phase: 'work',
    assignee: null,
    severity: null,
    environment: null,
    createdAt: '2026-06-01T08:00:00Z',
    daysInState: 5,
    stuck: false,
    lastComment: null,
    note: null,
    ...overrides,
  }
}

const person = (name: string, side: TeamPerson['side']): TeamPerson => ({
  name,
  role: '',
  side,
  from: '',
  to: '',
  allocation: null,
  note: '',
})
const team: ProjectTeam = {
  people: [person('Mario Rossi', 'supplier'), person('Carla Neri', 'client')],
  periods: [],
}

describe('a bug that is stuck', () => {
  it('is one that stayed longer than the threshold, never exactly as long', () => {
    expect(isStuck(11, 10)).toBe(true)
    expect(isStuck(10, 10)).toBe(false)
    expect(isStuck(null, 10)).toBe(false)
  })
})

describe('the list of bugs, filtered and split', () => {
  const rows = [
    row({ id: '10', severity: '2 - High', environment: 'Test', assignee: 'Luca', daysInState: 3 }),
    row({ id: '11', severity: '1 - Critical', assignee: 'Luca', daysInState: 40, stuck: true }),
    row({ id: '12', title: 'Etichetta', environment: 'Prod', createdAt: '2026-05-01T08:00:00Z' }),
  ]

  it('keeps the bugs that pass every filter set, in the order asked', () => {
    expect(filterBugs(rows, NO_BUG_QUERY).map((bug) => bug.id)).toEqual(['11', '12', '10'])
    expect(filterBugs(rows, { ...NO_BUG_QUERY, assignee: 'Luca' }).map((bug) => bug.id)).toEqual([
      '11',
      '10',
    ])
    expect(
      filterBugs(rows, { ...NO_BUG_QUERY, environment: NOT_STATED }).map((bug) => bug.id),
    ).toEqual(['11'])
    expect(filterBugs(rows, { ...NO_BUG_QUERY, text: 'etich' }).map((bug) => bug.id)).toEqual([
      '12',
    ])
    expect(filterBugs(rows, { ...NO_BUG_QUERY, text: '11' }).map((bug) => bug.id)).toEqual(['11'])
    expect(filterBugs(rows, { ...NO_BUG_QUERY, order: 'severity' }).map((bug) => bug.id)).toEqual([
      '11',
      '10',
      '12',
    ])
    expect(filterBugs(rows, { ...NO_BUG_QUERY, order: 'created' })[0]?.id).toBe('12')
  })

  it('says which filters are set', () => {
    expect(isFiltered(NO_BUG_QUERY)).toBe(false)
    expect(isFiltered({ ...NO_BUG_QUERY, text: ' x ' })).toBe(true)
    expect(activeFacets({ ...NO_BUG_QUERY, severity: NOT_STATED, assignee: 'Luca' })).toEqual([
      'severity',
      'assignee',
    ])
  })

  it('splits by severity, environment and person, with the stuck ones of each', () => {
    const split = bugBreakdowns(rows)
    expect(split.severity).toEqual([
      { value: '1 - Critical', count: 1, stuck: 1 },
      { value: '2 - High', count: 1, stuck: 0 },
      { value: NOT_STATED, count: 1, stuck: 0 },
    ])
    expect(split.assignee[0]).toEqual({ value: 'Luca', count: 2, stuck: 1 })
    expect(split.environment.map((entry) => entry.value)).toEqual(['Prod', 'Test', NOT_STATED])
    // A field no bug states splits nothing.
    expect(isTelling(split.environment)).toBe(true)
    expect(isTelling(bugBreakdowns([row({})]).severity)).toBe(false)
  })
})

describe('the numbers at the start of a period', () => {
  const history = (states: Array<[string, string]>, tags = 'Team'): ItemHistory => ({
    createdAt: '2026-05-01T08:00:00Z',
    states: states.map(([at, state]) => ({ at, state })),
    tags: [{ at: '2026-05-01T08:00:00Z', tags: [tags] }],
  })

  it('counts each bug as it was then, and stuck when it had waited too long by then', () => {
    const histories = [
      history([['2026-05-01T08:00:00Z', 'Active']]),
      history([
        ['2026-05-01T08:00:00Z', 'Active'],
        ['2026-05-28T08:00:00Z', 'Resolved'],
      ]),
      history([
        ['2026-05-01T08:00:00Z', 'Active'],
        ['2026-05-10T08:00:00Z', 'Validated'],
      ]),
      history([['2026-05-01T08:00:00Z', 'Active']], 'Other'),
      history([['2026-06-20T08:00:00Z', 'Active']]),
      { ...history([]), createdAt: '2026-07-01T08:00:00Z' },
    ]
    expect(countsAt(histories, settings, Date.parse('2026-06-01T00:00:00Z'))).toEqual({
      open: 3,
      work: 2,
      verify: 1,
      stuck: 2,
      validated: 1,
    })
  })

  it('is given with the dashboard only when there is a history, with the flow of the stretch before', () => {
    const bug = item({ id: '1', state: 'Active' })
    const range = {
      from: new Date('2026-06-01'),
      to: new Date('2026-06-30'),
      granularity: 'week' as const,
    }
    const without = bugDashboard(
      { exportedAt: null, items: [bug], history: null },
      settings,
      range,
      NOW,
    )
    expect(without.before).toBeNull()
    expect(without.flowBefore).toBeNull()
    const histories = new Map([
      [
        '1',
        history([
          ['2026-05-01T08:00:00Z', 'Active'],
          ['2026-05-20T08:00:00Z', 'Resolved'],
          ['2026-06-10T08:00:00Z', 'Active'],
        ]),
      ],
    ])
    const withHistory = bugDashboard(
      { exportedAt: null, items: [bug], history: histories },
      settings,
      range,
      NOW,
    )
    expect(withHistory.before).toEqual({ open: 1, work: 0, verify: 1, stuck: 1, validated: 0 })
    // It reached verification in the stretch before the range, not in the range.
    expect(withHistory.flowBefore?.toVerify.sample).toBe(1)
    expect(withHistory.flow?.toVerify.sample).toBe(0)
  })
})

describe('the items that wait for an answer', () => {
  const asked = (text: string, by = 'Mario Rossi', date = '2026-06-22T09:00:00Z') => [
    { by, at: date, text },
  ]

  it('finds the sentence that asks, with or without a question mark', () => {
    expect(questionIn('<p>Fatto il primo giro. Quale formato serve per la data?</p>')).toBe(
      'Quale formato serve per la data?',
    )
    expect(questionIn('Fateci sapere se va bene così.')).toBe('Fateci sapere se va bene così.')
    expect(questionIn('Corretto e rilasciato in test.')).toBeNull()
  })

  it('lists bugs and stories still open whose last comment asks, the longest wait first', () => {
    const data = {
      exportedAt: null,
      history: null,
      items: [
        item({ id: '1', assignee: 'Carla Neri', comments: asked('Carla, quale formato serve?') }),
        item({
          id: '2',
          type: 'User Story',
          comments: asked('Potete confermare il perimetro?', 'Mario Rossi', '2026-06-15T09:00:00Z'),
        }),
        item({ id: '3', comments: asked('Quale formato?', 'Carla Neri') }),
        item({ id: '4', state: 'Closed', comments: asked('Serve ancora?') }),
        item({ id: '5', comments: asked('Rilasciato.') }),
        item({ id: '6', type: 'Task', comments: asked('Serve ancora?') }),
        item({ id: '7', tags: ['Other'], comments: asked('Serve ancora?') }),
        item({ id: '8', comments: asked('Serve ancora?', 'Mario Rossi', '2026-06-30T09:00:00Z') }),
        item({ id: '9', comments: asked('Serve ancora?', 'Mario Rossi', 'ieri') }),
        item({ id: '10', comments: asked('Sentiamo Neri Carla: va bene?') }),
      ],
    }
    const rows = awaitingAnswer(data, settings, team, NOW)
    expect(rows.map((entry) => entry.id)).toEqual(['2', '1', '3', '10'])
    expect(rows[0]).toMatchObject({ type: 'story', workdays: 11, fromClient: false })
    expect(rows[1]).toMatchObject({
      type: 'bug',
      askedBy: 'Mario Rossi',
      question: 'Carla, quale formato serve?',
      fromClient: true,
    })
    // Asked by the client: the answer is the supplier's to give.
    expect(rows[2]?.fromClient).toBe(false)
    // The comment names a person of the client, the surname first.
    expect(rows[3]?.fromClient).toBe(true)
  })

  it('tells nothing of the client while the team does not list both sides', () => {
    expect(tellsSides(team)).toBe(true)
    expect(tellsSides(NO_TEAM)).toBe(false)
    const data = {
      exportedAt: null,
      history: null,
      items: [item({ assignee: 'Carla Neri', comments: asked('Quale formato serve?') })],
    }
    expect(awaitingAnswer(data, settings, NO_TEAM, NOW)[0]?.fromClient).toBe(false)
  })
})

describe('the decisions of the PM as rows', () => {
  const decisions = {
    excludedRequirements: [{ id: '1', at: '2026-06-01T08:00:00Z' }],
    removedSignals: [
      { id: '2', signal: 'S1', at: '2026-06-03T08:00:00Z' },
      { id: '2', signal: 'S5', at: '2026-06-02T08:00:00Z' },
    ],
    notes: [
      { id: '9', at: '2026-06-04T08:00:00Z', text: 'prima' },
      { id: '9', at: '2026-06-05T08:00:00Z', text: 'dopo' },
    ],
  }

  it('lists them the latest first, one note for an item, with the title when the tracker has it', () => {
    const rows = decisionRows(decisions, [item({ id: '1', title: 'Esportazione' })])
    expect(rows.map((entry) => `${entry.kind} ${entry.id}`)).toEqual([
      'note 9',
      'signal 2',
      'signal 2',
      'clear 1',
    ])
    expect(rows[0]).toMatchObject({ text: 'dopo', title: null })
    expect(rows[3]?.title).toBe('Esportazione')
  })

  it('takes one back and leaves the others', () => {
    expect(
      withoutTrackerDecision(decisions, { kind: 'clear', id: '1', signal: null })
        .excludedRequirements,
    ).toEqual([])
    expect(
      withoutTrackerDecision(decisions, { kind: 'signal', id: '2', signal: 'S1' }).removedSignals,
    ).toEqual([{ id: '2', signal: 'S5', at: '2026-06-02T08:00:00Z' }])
    expect(
      withoutTrackerDecision(decisions, { kind: 'note', id: '9', signal: null }).notes,
    ).toEqual([])
  })
})

describe('a comment of Claude, checked', () => {
  const figures = {
    open: 12,
    before: { open: 9 },
    median: 4.5,
    period: '2026-06-01',
    worst: [{ id: '101' }],
  }
  const given = numbersIn(figures)
  const known = new Set(['101'])

  it('collects every number given, also inside dates and names', () => {
    expect([...numbersIn({ a: -3, b: ['Sprint 12'], c: null })].sort()).toEqual([-3, 12, 3])
    expect(given.has(2026)).toBe(true)
  })

  it('keeps the sentences made of given numbers and known items, and drops the others', () => {
    const kept = checkedComment(
      [
        { text: 'I bug aperti sono 12, erano 9.', ids: [] },
        { text: 'La mediana è 4,5 giorni.', ids: [] },
        { text: 'Il bug #101 è il primo da guardare.', ids: [] },
        { text: 'Sono cresciuti del 33 per cento.', ids: [] },
        { text: 'Il bug #999 preoccupa.', ids: [] },
        { text: 'Guardare questa voce.', ids: ['#404'] },
        { text: '   ', ids: [] },
      ],
      given,
      known,
    )
    expect(kept).toEqual([
      { text: 'I bug aperti sono 12, erano 9.', ids: [] },
      { text: 'La mediana è 4,5 giorni.', ids: [] },
      { text: 'Il bug #101 è il primo da guardare.', ids: ['101'] },
    ])
  })
})
