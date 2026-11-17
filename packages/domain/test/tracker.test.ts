import { describe, expect, it } from 'vitest'
import {
  bucketStart,
  bucketsOf,
  bugDashboard,
  cleanDashboardSettings,
  type DashboardSettings,
  DEFAULT_DASHBOARD_SETTINGS,
  exportAge,
  type ItemHistory,
  inScope,
  isTrackerItemId,
  jiraBrowseHost,
  jiraSite,
  parseTrackerExport,
  parseTrackerHistory,
  phaseOf,
  stateName,
  TRACKER_PATHS,
  TRACKER_SNAPSHOT_PATH,
  type TrackerItem,
  trackerOfExport,
  unclearRequirements,
} from '../src/index.ts'

const settings: DashboardSettings = { ...DEFAULT_DASHBOARD_SETTINGS, tags: ['Team'] }
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

const range = (from: string, to: string, granularity: 'week' | 'month' = 'week') => ({
  from: new Date(from),
  to: new Date(to),
  granularity,
})

describe('the trackers Octo reads by itself', () => {
  it('keeps the reading of each in files of its own, and knows whose a file is', () => {
    expect(TRACKER_PATHS.ado.snapshot).toBe(TRACKER_SNAPSHOT_PATH)
    expect(TRACKER_PATHS.jira.snapshot).not.toBe(TRACKER_PATHS.ado.snapshot)
    expect(TRACKER_PATHS.jira.history).not.toBe(TRACKER_PATHS.ado.history)
    expect(trackerOfExport(TRACKER_PATHS.ado.snapshot)).toBe('ado')
    expect(trackerOfExport(TRACKER_PATHS.jira.snapshot)).toBe('jira')
    expect(trackerOfExport('raw/export.json')).toBeNull()
    expect(trackerOfExport('')).toBeNull()
  })

  it('tells the id of an item by the tracker that wrote it', () => {
    expect(isTrackerItemId('ado', '42')).toBe(true)
    expect(isTrackerItemId('ado', 'AUR-42')).toBe(false)
    expect(isTrackerItemId('jira', 'AUR-42')).toBe(true)
    expect(isTrackerItemId('jira', 'A1_B-7')).toBe(true)
    expect(isTrackerItemId('jira', '42')).toBe(false)
    expect(isTrackerItemId('jira', 'AUR-42/../x')).toBe(false)
  })

  it('reaches a Jira site in a browser by its name only', () => {
    expect(jiraSite(' https://Contoso.atlassian.net/jira/x ')).toBe('Contoso')
    expect(jiraBrowseHost(' https://Contoso.atlassian.net/jira/x ')).toBe('contoso.atlassian.net')
    expect(jiraBrowseHost('contoso')).toBe('contoso.atlassian.net')
    expect(jiraBrowseHost('evil.example')).toBeNull()
    expect(jiraBrowseHost('')).toBeNull()
  })
})

describe('phases of a state', () => {
  it('reads the phase from the name, whatever number stands before it', () => {
    expect(stateName('07.a - Blocked')).toBe('Blocked')
    expect(phaseOf('04 - In Progress', settings)).toBe('work')
    expect(phaseOf('06 - Ready for Test', settings)).toBe('verify')
    expect(phaseOf('Resolved', settings)).toBe('verify')
    expect(phaseOf('10 - Validated', settings)).toBe('validated')
    expect(phaseOf('11 - Ready for PROD', settings)).toBe('validated')
    expect(phaseOf('12a - Released to PROD', settings)).toBe('closed')
    expect(phaseOf('Chiuso', settings)).toBe('closed')
  })

  it('reads the states of a Jira kept in Italian', () => {
    expect(phaseOf('Da completare', settings)).toBe('work')
    expect(phaseOf('In corso', settings)).toBe('work')
    expect(phaseOf('IN TEST', settings)).toBe('verify')
    expect(phaseOf('Completata', settings)).toBe('closed')
    expect(phaseOf('Completato', settings)).toBe('closed')
  })

  it('keeps an unknown state as work, and obeys what the PM mapped by hand', () => {
    expect(phaseOf('Whatever', settings)).toBe('work')
    expect(phaseOf('Whatever', { phases: { Whatever: 'closed' } })).toBe('closed')
  })

  it('takes everything in scope when no tag is asked, and ignores case otherwise', () => {
    expect(inScope([], { tags: [] })).toBe(true)
    expect(inScope(['team'], settings)).toBe(true)
    expect(inScope(['Other'], settings)).toBe(false)
  })
})

describe('trend steps', () => {
  it('starts a week on Monday and a month on its first day', () => {
    expect(bucketStart(new Date('2026-06-04T10:00:00Z'), 'week').toISOString()).toBe(
      '2026-06-01T00:00:00.000Z',
    )
    expect(bucketStart(new Date('2026-06-07T23:00:00Z'), 'week').toISOString()).toBe(
      '2026-06-01T00:00:00.000Z',
    )
    expect(bucketStart(new Date('2026-06-17T10:00:00Z'), 'month').toISOString()).toBe(
      '2026-06-01T00:00:00.000Z',
    )
  })

  it('covers a range of any length with the step asked', () => {
    expect(bucketsOf(range('2026-06-03', '2026-06-16'))).toHaveLength(3)
    expect(bucketsOf(range('2025-11-15', '2026-06-16', 'month'))).toHaveLength(8)
  })
})

describe('bug dashboard', () => {
  const items = [
    item({
      id: '1',
      stateChangedAt: '2026-05-01T08:00:00Z',
      comments: [{ by: 'a', at: 'x', text: 'last' }],
    }),
    item({ id: '2', state: '06 - Ready for Test', stateChangedAt: '2026-06-25T08:00:00Z' }),
    item({ id: '3', state: '10 - Validated' }),
    item({ id: '4', state: '12b - Closed', stateChangedAt: '2026-06-10T08:00:00Z' }),
    item({ id: '5', tags: ['Other'] }),
    item({ id: '6', type: 'User Story' }),
    item({ id: '7', stateChangedAt: null }),
  ]

  it('lists the open bugs in scope, the longest waiting first, and marks the stuck ones', () => {
    const dashboard = bugDashboard(
      { exportedAt: null, items, history: null },
      settings,
      range('2026-06-01', '2026-06-30'),
      NOW,
    )
    expect(dashboard.total).toBe(5)
    expect(dashboard.open.map((row) => row.id)).toEqual(['1', '2', '7'])
    expect(dashboard.byPhase).toEqual({ work: 2, verify: 1, validated: 1, closed: 1 })
    // The validated ones are listed apart: they are no longer open, and not yet gone.
    expect(dashboard.validated).toHaveLength(1)
    expect(dashboard.validated.every((row) => row.phase === 'validated')).toBe(true)
    expect(dashboard.open.some((row) => row.phase === 'validated')).toBe(false)
    expect(dashboard.open[0]).toMatchObject({
      daysInState: 60,
      stuck: true,
      lastComment: { text: 'last' },
    })
    expect(dashboard.open[2]).toMatchObject({ daysInState: null, stuck: false })
    expect(dashboard.stuck).toBe(1)
  })

  it('without a history approximates the trend from creation and present state', () => {
    const dashboard = bugDashboard(
      { exportedAt: null, items, history: null },
      settings,
      range('2026-06-01', '2026-06-30'),
      NOW,
    )
    expect(dashboard.trendSource).toBe('approximate')
    expect(dashboard.flow).toBeNull()
    expect(dashboard.trend.map((step) => step.from)).toEqual([
      '2026-06-01',
      '2026-06-08',
      '2026-06-15',
      '2026-06-22',
      '2026-06-29',
    ])
    expect(dashboard.trend[0]).toEqual({ from: '2026-06-01', entered: 5, closed: 0, openAtEnd: 5 })
    // Bug 4 closed on the 10th; bug 3 entered its validated state on the 20th.
    expect(dashboard.trend[1]).toMatchObject({ entered: 0, closed: 1, openAtEnd: 4 })
    expect(dashboard.trend[2]).toMatchObject({ closed: 1, openAtEnd: 3 })
  })

  const history = new Map<string, ItemHistory>([
    [
      '1',
      {
        createdAt: '2026-06-01T08:00:00Z',
        states: [
          { at: '2026-06-01T08:00:00Z', state: '02 - To Do' },
          { at: '2026-06-03T08:00:00Z', state: '05 - Resolved' },
          { at: '2026-06-05T08:00:00Z', state: '06 - Ready for Test' },
          { at: '2026-06-09T08:00:00Z', state: '10 - Validated' },
          { at: '2026-06-19T08:00:00Z', state: '12b - Closed' },
        ],
        tags: [{ at: '2026-06-01T08:00:00Z', tags: ['Team'] }],
      },
    ],
    [
      // Enters the scope when it gets the tag, reopens after a first closing.
      '2',
      {
        createdAt: '2026-05-20T08:00:00Z',
        states: [
          { at: '2026-05-20T08:00:00Z', state: '02 - To Do' },
          { at: '2026-06-16T08:00:00Z', state: '12b - Closed' },
          { at: '2026-06-23T08:00:00Z', state: '03 - ReOpened' },
        ],
        tags: [
          { at: '2026-05-20T08:00:00Z', tags: [] },
          { at: '2026-06-09T08:00:00Z', tags: ['Team'] },
        ],
      },
    ],
    [
      // Its first recorded state comes after its creation: open in the meantime.
      '5',
      {
        createdAt: '2026-06-02T08:00:00Z',
        states: [{ at: '2026-06-10T08:00:00Z', state: '09 - Removed' }],
        tags: [{ at: '2026-06-02T08:00:00Z', tags: ['Team'] }],
      },
    ],
  ])

  it('with a history counts what entered and left the open bugs in every step', () => {
    const dashboard = bugDashboard(
      { exportedAt: null, items, history },
      settings,
      range('2026-06-01', '2026-06-30'),
      NOW,
    )
    expect(dashboard.trendSource).toBe('history')
    expect(dashboard.trend).toEqual([
      { from: '2026-06-01', entered: 2, closed: 0, openAtEnd: 2 },
      { from: '2026-06-08', entered: 1, closed: 2, openAtEnd: 1 },
      { from: '2026-06-15', entered: 0, closed: 1, openAtEnd: 0 },
      { from: '2026-06-22', entered: 1, closed: 0, openAtEnd: 1 },
      { from: '2026-06-29', entered: 0, closed: 0, openAtEnd: 1 },
    ])
  })

  it('gives the same picture by month over a longer period', () => {
    const dashboard = bugDashboard(
      { exportedAt: null, items, history },
      settings,
      range('2026-04-10', '2026-06-30', 'month'),
      NOW,
    )
    expect(dashboard.trend).toEqual([
      { from: '2026-04-01', entered: 0, closed: 0, openAtEnd: 0 },
      { from: '2026-05-01', entered: 0, closed: 0, openAtEnd: 0 },
      { from: '2026-06-01', entered: 4, closed: 3, openAtEnd: 1 },
    ])
  })

  it('measures where bugs stop on their way out', () => {
    const anyVerify = bugDashboard(
      { exportedAt: null, items, history },
      settings,
      range('2026-06-01', '2026-06-30'),
      NOW,
    )
    expect(anyVerify.flow).toEqual({
      toVerify: { median: 2, sample: 1 },
      toValidated: { median: 6, sample: 1 },
      toClosed: { median: 10, sample: 1 },
    })
    const handover = bugDashboard(
      { exportedAt: null, items, history },
      { ...settings, handoverStates: ['06 - Ready for Test'] },
      range('2026-06-01', '2026-06-30'),
      NOW,
    )
    expect(handover.flow?.toVerify).toEqual({ median: 4, sample: 1 })
    expect(handover.flow?.toValidated).toEqual({ median: 4, sample: 1 })
  })

  it('shows the note of the PM on a bug', () => {
    const noted = {
      ...settings,
      decisions: {
        ...settings.decisions,
        notes: [
          { id: '1', at: '2026-06-01T00:00:00Z', text: 'old' },
          { id: '1', at: '2026-06-02T00:00:00Z', text: 'waiting for the client' },
        ],
      },
    }
    const dashboard = bugDashboard(
      { exportedAt: null, items, history: null },
      noted,
      range('2026-06-01', '2026-06-30'),
      NOW,
    )
    expect(dashboard.open[0]?.note?.text).toBe('waiting for the client')
    expect(dashboard.open[1]?.note).toBeNull()
  })
})

describe('unclear requirements', () => {
  const long = 'x'.repeat(100)
  const story = (overrides: Partial<TrackerItem>) =>
    item({
      type: 'User Story',
      state: 'To Do',
      description: long,
      acceptanceCriteria: long,
      ...overrides,
    })
  const data = {
    exportedAt: null,
    history: null,
    items: [
      story({ id: '10', state: 'New', period: 'P1' }),
      story({
        id: '11',
        acceptanceCriteria: '<p>ok</p>',
        description: '<div>short</div>',
        period: 'P1',
      }),
      story({ id: '12', state: 'On Hold', period: 'P2' }),
      story({
        id: '13',
        period: 'P1',
        comments: [
          { by: 'a', at: 'x', text: `${long} the perimeter is still TBD with the client` },
        ],
      }),
      story({ id: '14', period: 'P1', description: `${long} point clarified yesterday` }),
      story({ id: '15', state: 'Developed', acceptanceCriteria: '' }),
      story({ id: '16', tags: ['Other'], state: 'New' }),
      item({ id: '17', state: 'New' }),
    ],
  }

  it('lists the stories still to do with their signals, the most doubtful first', () => {
    const rows = unclearRequirements(data, settings)
    expect(rows.map((row) => [row.id, row.signals])).toEqual([
      ['11', ['S2', 'S3']],
      ['10', ['S1']],
      ['12', ['S4']],
      ['13', ['S5']],
    ])
    expect(rows[3]?.unclear?.word).toBe('TBD')
    expect(rows[3]?.unclear?.context).toContain('still TBD with the client')
  })

  it('keeps to the planning periods asked and to what the PM decided', () => {
    const decided: DashboardSettings = {
      ...settings,
      requirementPeriods: ['P1'],
      decisions: {
        excludedRequirements: [{ id: '10', at: '2026-06-01T00:00:00Z' }],
        removedSignals: [{ id: '11', signal: 'S2', at: '2026-06-01T00:00:00Z' }],
        notes: [{ id: '13', at: '2026-06-01T00:00:00Z', text: 'asked on Monday' }],
      },
    }
    const rows = unclearRequirements(data, decided)
    expect(rows.map((row) => [row.id, row.signals])).toEqual([
      ['11', ['S3']],
      ['13', ['S5']],
    ])
    expect(rows[1]?.note?.text).toBe('asked on Monday')
  })
})

describe('tracker export', () => {
  it('reads the items a script exported and leaves out what is not an item', () => {
    const parsed = parseTrackerExport({
      exported_at: '2026-06-30T10:00:00+00:00',
      items: [
        {
          id: 42,
          type: 'Bug',
          title: 'Broken',
          state: '02 - To Do',
          tags: ['Team', ' Urgent '],
          assigned_to: 'Someone',
          created_date: '2026-06-01T08:00:00Z',
          state_change_date: 'not a date',
          severity: '2 - High',
          pi: 'P1',
          parent: 7,
          environment_bug: '',
          description: null,
          acceptance_criteria: 'ac',
          discussion: [{ by: 'a', date: '2026-06-02', text: 'hello' }, 'noise'],
        },
        { id: 43, type: 'Bug', tags: 'Team; Other', created_date: '2026-06-01T08:00:00Z' },
        { id: 44 },
        'noise',
      ],
    })
    expect(parsed?.exportedAt).toBe('2026-06-30T10:00:00+00:00')
    expect(parsed?.items).toHaveLength(2)
    expect(parsed?.items[0]).toMatchObject({
      id: '42',
      tags: ['Team', 'Urgent'],
      assignee: 'Someone',
      stateChangedAt: null,
      period: 'P1',
      parentId: '7',
      environment: null,
      description: '',
      comments: [{ by: 'a', at: '2026-06-02', text: 'hello' }],
    })
    expect(parsed?.items[1]?.tags).toEqual(['Team', 'Other'])
  })

  it('refuses what is not an export', () => {
    expect(parseTrackerExport([])).toBeNull()
    expect(parseTrackerExport({ items: 'no' })).toBeNull()
    expect(parseTrackerExport({ items: [] })).toEqual({ exportedAt: null, items: [] })
  })

  it('reads the history of states and tags, in order of time', () => {
    const history = parseTrackerHistory({
      bugs: {
        '1': {
          created: '2026-06-01T08:00:00Z',
          states: [
            ['2026-06-03T08:00:00Z', 'B'],
            ['2026-06-01T08:00:00Z', 'A'],
            ['never', 'C'],
          ],
          tags: [['2026-06-01T08:00:00Z', 'Team; Other']],
        },
        '2': { created: 'never' },
        '3': 'noise',
      },
    })
    expect([...(history?.keys() ?? [])]).toEqual(['1'])
    expect(history?.get('1')?.states.map((entry) => entry.state)).toEqual(['A', 'B'])
    expect(history?.get('1')?.tags[0]?.tags).toEqual(['Team', 'Other'])
    expect(parseTrackerHistory({ items: [] })).toBeNull()
  })

  it('tidies the settings the PM typed', () => {
    const clean = cleanDashboardSettings({
      ...DEFAULT_DASHBOARD_SETTINGS,
      exportPath: ' data/export.json ',
      tags: [' Team', 'Team', ''],
      bugTypes: [],
      stuckDays: 0,
      phases: { ' Odd ': 'closed', '': 'work' },
      handoverStates: ['A', 'A'],
      decisions: {
        excludedRequirements: [{ id: '1', at: 'never' }],
        removedSignals: [{ id: '2', signal: 'S1', at: '2026-06-01' }],
        notes: [
          { id: '3', at: '2026-06-01', text: '  a note ' },
          { id: '4', at: '2026-06-01', text: ' ' },
        ],
      },
    })
    expect(clean).toMatchObject({
      exportPath: 'data/export.json',
      tags: ['Team'],
      bugTypes: ['Bug'],
      stuckDays: 1,
      phases: { Odd: 'closed' },
      handoverStates: ['A'],
      decisions: {
        excludedRequirements: [],
        removedSignals: [{ id: '2', signal: 'S1' }],
        notes: [{ id: '3', text: 'a note' }],
      },
    })
    expect(
      cleanDashboardSettings({ ...DEFAULT_DASHBOARD_SETTINGS, stuckDays: Number.NaN }).stuckDays,
    ).toBe(30)
  })

  it('says how old a reading of the tracker is', () => {
    expect(exportAge(null, NOW)).toBe('unknown')
    expect(exportAge('2026-06-30T00:00:00Z', NOW)).toBe('fresh')
    expect(exportAge('2026-06-29T00:00:00Z', NOW)).toBe('warning')
    expect(exportAge('2026-06-26T00:00:00Z', NOW)).toBe('stale')
  })
})
