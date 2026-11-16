import { describe, expect, it } from 'vitest'
import {
  type Alignment,
  acceptCandidate,
  addRisk,
  alignmentItems,
  applyDecisions,
  assignmentOf,
  type BugRow,
  bugItems,
  calendarItems,
  candidateId,
  cleanTodaySettings,
  conversationKey,
  conversationOfMail,
  type Deliverable,
  daysBetweenDays,
  dismissCandidate,
  draftItems,
  type Forecast,
  firstEntered,
  forecastItems,
  hoursItems,
  identityAddresses,
  identityOf,
  isMonthClosing,
  isSprintEnding,
  isToDo,
  MAX_MAIL_TURNS,
  type MailJudgement,
  mailItems,
  mailThreads,
  mailTurnsOf,
  marksOf,
  meetingItems,
  meetingsOn,
  monthDueItems,
  monthPeriod,
  NO_RISKS,
  NO_TEAM,
  NO_TODAY_SETTINGS,
  nextWorkday,
  nowItems,
  occurrenceOn,
  opensAsDocument,
  orderToday,
  parseInvite,
  parseMailDocument,
  personKey,
  previousMonth,
  type Reconciliation,
  reconcileSignals,
  requirementItems,
  riskItems,
  risksMarkdown,
  romeDateString,
  type StoredMail,
  senderName,
  sourceItems,
  sprintEnd,
  type TodayItem,
  threadSubject,
  todayCount,
  trackerAgeItems,
  updateRisk,
  type WaitingMail,
  withCandidates,
  withDecision,
  withMailTurn,
  withoutDecision,
  withVisit,
  workdaysBetween,
} from '../src/index.ts'

const NOW = new Date('2026-11-16T09:00:00Z')
/** A Monday in the middle of a month: the numbers of the month are not being closed. */
const MID_MONTH = '2026-11-16'
/** The second working day of a month: last month's numbers are due. */
const MONTH_START = '2026-11-03'

const item = (overrides: Partial<TodayItem> & Pick<TodayItem, 'key'>): TodayItem => ({
  band: 'numbers',
  facts: { kind: 'bugs_stuck', count: 1, stuckDays: 30, oldestDays: 40 },
  weight: 1,
  target: 'dashboard',
  asOf: null,
  ...overrides,
})

function reconciliation(overrides: Partial<Reconciliation> = {}): Reconciliation {
  return {
    rows: [
      {
        person: 'Bianchi Anna',
        timesheetHours: 160,
        worklogHours: 80,
        deltaPct: -50,
        status: 'outlier',
      },
      {
        person: 'Neri Sara',
        timesheetHours: 80,
        worklogHours: 0,
        deltaPct: -100,
        status: 'no_worklog',
      },
      {
        person: 'Ugo Gialli',
        timesheetHours: 0,
        worklogHours: 120,
        deltaPct: null,
        status: 'no_timesheet',
      },
      { person: 'Rossi Mario', timesheetHours: 160, worklogHours: 160, deltaPct: 0, status: 'ok' },
      {
        person: 'Costa Elena',
        timesheetHours: 0,
        worklogHours: 0,
        deltaPct: null,
        status: 'expected',
      },
    ],
    totals: { timesheetHours: 400, worklogHours: 360, deltaPct: -10 },
    excluded: {} as Reconciliation['excluded'],
    possibleDuplicates: [],
    tieOut: { approvedHours: 400, accountedHours: 400, ok: true },
    ...overrides,
  } as Reconciliation
}

describe('the days of the page', () => {
  it('counts working days, months and where a month is being closed', () => {
    // From a Friday to the Tuesday after: Monday and Tuesday.
    expect(workdaysBetween('2026-11-13', '2026-11-17')).toBe(2)
    expect(workdaysBetween('2026-11-17', '2026-11-13')).toBe(0)
    expect(daysBetweenDays('2026-11-16', '2026-11-19')).toBe(3)
    expect(previousMonth('2026-01-15')).toBe('2025-12')
    expect(monthPeriod('2026-02')).toEqual({ from: '2026-02-01', to: '2026-02-28' })
    expect(isMonthClosing(MONTH_START)).toBe(true)
    expect(isMonthClosing(MID_MONTH)).toBe(false)
    // The last working days of a month close it too.
    expect(isMonthClosing('2026-11-27')).toBe(true)
  })
})

describe('the signals computed from the sections', () => {
  it('says a source that failed, was never read, lacks its credential or is old', () => {
    const run = (at: string, error: 'feed_unreachable' | null = null) => ({
      cursor: null,
      lastRun: { at, written: 0, unchanged: 0, error },
    })
    const items = sourceItems(
      [
        { source: 'Posta', state: run('2026-11-16T08:45:00Z'), hasSecret: true },
        { source: 'Jira', state: run('2026-11-13T08:00:00Z'), hasSecret: true },
        {
          source: 'Azure DevOps',
          state: run('2026-11-16T08:00:00Z', 'feed_unreachable'),
          hasSecret: true,
        },
        { source: 'Confluence', state: { cursor: null, lastRun: null }, hasSecret: true },
        { source: 'NetSuite', state: run('2026-11-16T08:00:00Z'), hasSecret: false },
      ],
      NOW,
    )
    expect(
      items.map((entry) => [entry.key, entry.facts.kind === 'source' && entry.facts.reason]),
    ).toEqual([
      ['source:Jira', 'stale'],
      ['source:Azure DevOps', 'error'],
      ['source:Confluence', 'never'],
      ['source:NetSuite', 'no_secret'],
    ])
    expect(items.every((entry) => entry.band === 'alert')).toBe(true)
    expect(items[0]?.facts).toMatchObject({ days: 3 })
  })

  it('says the export of the tracker only when it is old enough to doubt its numbers', () => {
    expect(trackerAgeItems('2026-11-11T09:00:00Z', 'stale', NOW)[0]?.facts).toEqual({
      kind: 'tracker_old',
      days: 5,
    })
    expect(trackerAgeItems('2026-11-15T09:00:00Z', 'warning', NOW)).toEqual([])
    expect(trackerAgeItems(null, 'unknown', NOW)).toEqual([])
  })

  it('gathers the hours that do not add up in one signal for the month', () => {
    const [signal] = hoursItems('2026-10', reconciliation(), MID_MONTH)
    expect(signal?.key).toBe('hours:2026-10')
    expect(signal?.band).toBe('numbers')
    expect(signal?.facts).toMatchObject({
      kind: 'hours',
      people: [{ person: 'Bianchi Anna' }, { person: 'Neri Sara' }, { person: 'Ugo Gialli' }],
      tieOutOk: true,
    })
    // While the month is being closed the same signal is due.
    const due = hoursItems('2026-10', reconciliation(), MONTH_START)[0]
    expect(due).toMatchObject({ band: 'due', dueBecause: 'month_end' })
    // Nothing wrong, nothing said; a failed tie-out alone is said.
    const clean = reconciliation({ rows: [] })
    expect(hoursItems('2026-10', clean, MID_MONTH)).toEqual([])
    const untied = { ...clean, tieOut: { approvedHours: 10, accountedHours: 8, ok: false } }
    expect(hoursItems('2026-10', untied, MID_MONTH)).toHaveLength(1)
  })

  it('says what the forecast lacks and, while the month closes, that it is not written yet', () => {
    const forecast = {
      month: '2026-10',
      gaps: [{ kind: 'no_rate', code: 'PRJ000101', person: 'Costa Elena', hours: 120 }],
    } as Forecast
    expect(forecastItems(forecast, MID_MONTH)[0]).toMatchObject({
      key: 'forecast:2026-10',
      weight: 1,
    })
    expect(forecastItems(forecast, MONTH_START)[0]?.band).toBe('due')
    expect(forecastItems({ ...forecast, gaps: [] }, MID_MONTH)).toEqual([])
    expect(monthDueItems('2026-10', false, MONTH_START)[0]?.key).toBe('due:forecast:2026-10')
    expect(monthDueItems('2026-10', true, MONTH_START)).toEqual([])
    expect(monthDueItems('2026-10', false, MID_MONTH)).toEqual([])
  })

  it('counts the bugs that stay too long and the unclear requirements, one signal each', () => {
    const bug = (days: number | null): BugRow => ({ daysInState: days }) as BugRow
    const [stuck] = bugItems([bug(45), bug(31), bug(3), bug(null)], 30, '2026-11-16T08:00:00Z')
    expect(stuck?.facts).toEqual({ kind: 'bugs_stuck', count: 2, stuckDays: 30, oldestDays: 45 })
    expect(stuck?.band).toBe('watch')
    expect(bugItems([bug(3)], 30, null)).toEqual([])
    const rows = ['2002', '2004'].map((id) => ({ id })) as unknown as Parameters<
      typeof requirementItems
    >[0]
    expect(requirementItems(rows, null, true)[0]?.facts).toEqual({
      kind: 'requirements',
      count: 2,
      ids: ['2002', '2004'],
    })
    expect(requirementItems([], null, true)).toEqual([])
    // Before the sprint ends the requirements are read in the dashboard, not told every day.
    expect(requirementItems(rows, null, false)).toEqual([])
  })

  it('says what the two trackers do not agree on only while the sprint is ending', () => {
    const alignment = {
      missing: [{}],
      needsUpdate: [],
      duplicates: [{}],
      orphans: [{}],
    } as unknown as Alignment
    // No period of the calendar has the name of the sprint: when it ends is not known.
    expect(alignmentItems('Sprint 28', alignment, null, NO_TEAM, MID_MONTH)).toEqual([])
    const team = {
      people: [],
      periods: [{ name: 'sprint 28', from: '2026-11-03', to: '2026-11-17' }],
    }
    expect(alignmentItems('Sprint 28', alignment, null, team, MID_MONTH)[0]).toMatchObject({
      key: 'alignment:sprint 28',
      band: 'due',
      weight: 3,
      dueBecause: 'sprint_end',
    })
    expect(alignmentItems('Sprint 28', alignment, null, team, '2026-11-10')).toEqual([])
    const aligned = {
      missing: [],
      needsUpdate: [],
      duplicates: [],
      orphans: [],
    } as unknown as Alignment
    expect(alignmentItems('Sprint 28', aligned, null, team, MID_MONTH)).toEqual([])
  })

  it('tells the last working days of the sprint, and nothing when no sprint is set', () => {
    const team = {
      people: [],
      periods: [{ name: 'Sprint 28', from: '2026-11-03', to: '2026-11-17' }],
    }
    expect(sprintEnd(' sprint 28 ', team)).toBe('2026-11-17')
    expect(sprintEnd('', team)).toBeNull()
    expect(sprintEnd('Sprint 29', team)).toBeNull()
    expect(isSprintEnding('Sprint 28', team, '2026-11-12')).toBe(false)
    expect(isSprintEnding('Sprint 28', team, '2026-11-13')).toBe(true)
    expect(isSprintEnding('Sprint 28', team, '2026-11-17')).toBe(true)
    expect(isSprintEnding('Sprint 28', team, '2026-11-18')).toBe(false)
    expect(isSprintEnding('', team, '2026-11-17')).toBe(false)
  })

  it('says the drafts that wait for the PM and the dates of the calendar that are near', () => {
    const deliverable = (overrides: Partial<Deliverable>): Deliverable =>
      ({
        id: 'd-1',
        title: 'Stato di avanzamento',
        status: 'review',
        createdAt: '2026-11-13T09:00:00Z',
        readyAt: '2026-11-14T09:00:00Z',
        redTeam: { verdict: 'fix_first', findings: [], holds: '' },
        ...overrides,
      }) as Deliverable
    const drafts = draftItems(
      [
        deliverable({}),
        deliverable({ id: 'd-2', status: 'approved' }),
        deliverable({ id: 'd-3', status: 'failed', readyAt: null, redTeam: null }),
      ],
      NOW,
    )
    expect(drafts.map((entry) => entry.facts)).toEqual([
      {
        kind: 'draft',
        id: 'd-1',
        title: 'Stato di avanzamento',
        status: 'review',
        days: 2,
        fixFirst: true,
      },
      {
        kind: 'draft',
        id: 'd-3',
        title: 'Stato di avanzamento',
        status: 'failed',
        days: 3,
        fixFirst: false,
      },
    ])
    const person = { role: '', side: 'supplier' as const, from: '', allocation: null, note: '' }
    const calendar = calendarItems(
      {
        people: [
          { ...person, name: 'Neri Sara', to: '2026-11-20' },
          { ...person, name: 'Rossi Mario', to: '' },
          { ...person, name: 'Verdi Luca', to: '2026-12-31' },
        ],
        periods: [
          { name: 'Sprint 28', from: '2026-11-03', to: '2026-11-16' },
          { name: 'Sprint 29', from: '2026-11-17', to: '2026-11-30' },
        ],
      },
      MID_MONTH,
    )
    expect(
      calendar.map((entry) => [entry.band, entry.facts.kind === 'calendar' && entry.facts.name]),
    ).toEqual([
      ['due', 'Sprint 28'],
      ['watch', 'Neri Sara'],
    ])
  })
})

describe('the order of the page', () => {
  it('goes by band, then what was put off until today, the mail that matters, the heavier', () => {
    const mail = (key: string, importance: 'alta' | 'bassa' | null): TodayItem =>
      item({
        key,
        band: 'waiting',
        facts: {
          kind: 'mail_reply',
          id: key,
          path: '',
          from: '',
          subject: '',
          days: 1,
          judgement: importance
            ? { importance, reason: '', quote: '', quoteVerified: true, deadline: null }
            : null,
        },
      })
    const ordered = orderToday([
      item({ key: 'watch', band: 'watch' }),
      mail('low', 'bassa'),
      item({ key: 'light', weight: 1 }),
      mail('none', null),
      item({ key: 'heavy', weight: 9 }),
      mail('high', 'alta'),
      item({ key: 'alert', band: 'alert' }),
      item({ key: 'back', band: 'due', returned: { why: 'later' } }),
      item({ key: 'due', band: 'due', weight: 50 }),
    ])
    expect(ordered.map((entry) => entry.key)).toEqual([
      'alert',
      'back',
      'due',
      'high',
      'none',
      'low',
      'heavy',
      'light',
      'watch',
    ])
    expect(ordered.filter(isToDo).map((entry) => entry.key)).not.toContain('alert')
  })
})

describe('what the PM decided on a signal', () => {
  const decision = (overrides: object) => ({
    key: 'a',
    kind: 'bugs_stuck' as const,
    state: 'done' as const,
    at: '2026-11-13',
    until: null,
    weight: 1,
    ...overrides,
  })

  it('keeps away what is done, put off or muted, and brings it back with the reason', () => {
    const items = [item({ key: 'a' }), item({ key: 'b' })]
    const settings = (...decisions: ReturnType<typeof decision>[]) => ({
      ...NO_TODAY_SETTINGS,
      decisions,
    })
    // Done on Friday: away on Monday, back after three working days.
    expect(applyDecisions(items, settings(decision({})), '2026-11-16')).toMatchObject({
      items: [{ key: 'b' }],
      hidden: 1,
    })
    expect(applyDecisions(items, settings(decision({})), '2026-11-18').items[0]).toMatchObject({
      key: 'a',
      returned: { why: 'still', since: '2026-11-13' },
    })
    // Worse than when it was put away: back at once.
    const worse = applyDecisions(
      [item({ key: 'a', weight: 4 })],
      settings(decision({})),
      '2026-11-16',
    )
    expect(worse.items[0]?.returned).toEqual({ why: 'worse', was: 1, now: 4 })
    // Put off: away until its day, then on top among what is due.
    const later = decision({ state: 'later', until: '2026-11-17' })
    expect(applyDecisions(items, settings(later), '2026-11-16').hidden).toBe(1)
    expect(applyDecisions(items, settings(later), '2026-11-17').items[0]).toMatchObject({
      key: 'a',
      band: 'due',
      returned: { why: 'later' },
    })
    // Muted: away for good, however bad it gets.
    const muted = settings(decision({ state: 'muted' }))
    expect(applyDecisions([item({ key: 'a', weight: 99 })], muted, '2027-01-01').items).toEqual([])
  })

  it('lists what stays away with its decision, the last decided first', () => {
    const items = [item({ key: 'a' }), item({ key: 'b' }), item({ key: 'c' })]
    const page = applyDecisions(
      items,
      {
        ...NO_TODAY_SETTINGS,
        decisions: [
          decision({ key: 'a', state: 'muted', at: '2026-11-12' }),
          decision({ key: 'b', state: 'later', until: '2026-11-20', at: '2026-11-16' }),
        ],
      },
      '2026-11-16',
    )
    expect(page.items.map((shown) => shown.key)).toEqual(['c'])
    expect(page.hiddenItems).toEqual([
      { item: items[1], state: 'later', at: '2026-11-16', until: '2026-11-20' },
      { item: items[0], state: 'muted', at: '2026-11-12', until: null },
    ])
  })

  it('keeps away what was marked done for as long as it gets better', () => {
    const settings = { ...NO_TODAY_SETTINGS, decisions: [decision({ weight: 5 })] }
    // Three working days later it is still there, but lighter: it is being done.
    const better = applyDecisions([item({ key: 'a', weight: 3 })], settings, '2026-11-20')
    expect(better.items).toEqual([])
    expect(better.hiddenItems[0]?.state).toBe('done')
    // As heavy as it was: after the days of grace it is told again.
    expect(
      applyDecisions([item({ key: 'a', weight: 5 })], settings, '2026-11-20').items[0]?.returned,
    ).toEqual({ why: 'still', since: '2026-11-13' })
  })

  it('does not take the days a mail has waited for the mail getting worse', () => {
    const waiting = (days: number) =>
      item({
        key: 'mail:1',
        band: 'waiting',
        weight: days,
        target: 'mail',
        facts: {
          kind: 'mail_reply',
          id: '1',
          path: '1.md',
          from: 'Carla',
          subject: 'Budget',
          days,
          judgement: null,
        },
      })
    const settings = {
      ...NO_TODAY_SETTINGS,
      decisions: [decision({ key: 'mail:1', kind: 'mail_reply', at: '2026-11-16', weight: 0 })],
    }
    // The day after it has waited one day more: it is not worse, it stays away.
    expect(applyDecisions([waiting(1)], settings, '2026-11-17').items).toEqual([])
    // Still unanswered after the days of grace: told again, as still open.
    expect(applyDecisions([waiting(3)], settings, '2026-11-19').items[0]?.returned).toEqual({
      why: 'still',
      since: '2026-11-16',
    })
  })

  it('tells what went away by itself, and forgets what was marked done about it', () => {
    const before = {
      ...NO_TODAY_SETTINGS,
      decisions: [
        decision({ key: 'gone' }),
        decision({ key: 'there' }),
        decision({ key: 'muted-gone', state: 'muted' }),
        decision({ key: 'unread', kind: 'hours' }),
      ],
      present: [
        { key: 'gone', kind: 'bugs_stuck' as const, weight: 2 },
        { key: 'there', kind: 'bugs_stuck' as const, weight: 1 },
        { key: 'unread', kind: 'hours' as const, weight: 1 },
        { key: 'meeting', kind: 'meeting' as const, weight: 1 },
        { key: 'mail:1', kind: 'mail_reply' as const, weight: 1 },
      ],
      resolved: [
        { key: 'yesterday', kind: 'draft' as const, day: '2026-11-15' },
        { key: 'earlier', kind: 'draft' as const, day: MID_MONTH },
        { key: 'there', kind: 'bugs_stuck' as const, day: MID_MONTH },
      ],
    }
    const items = [
      item({ key: 'there', weight: 3 }),
      // The mail is told by its conversation now: under the old key it is the same signal.
      item({ key: 'mail:c:x', formerKeys: ['mail:1'] }),
    ]
    const after = reconcileSignals(before, items, new Set(['hours']), MID_MONTH)
    // A meeting that is over resolved nothing; hours that could not be read are not gone.
    expect(after.resolved).toEqual([
      { key: 'earlier', kind: 'draft', day: MID_MONTH },
      { key: 'gone', kind: 'bugs_stuck', day: MID_MONTH },
    ])
    expect(after.decisions.map((kept) => kept.key)).toEqual(['there', 'muted-gone', 'unread'])
    expect(after.present).toEqual([
      { key: 'unread', kind: 'hours', weight: 1 },
      { key: 'there', kind: 'bugs_stuck', weight: 3 },
      { key: 'mail:c:x', kind: 'bugs_stuck', weight: 1 },
    ])
    // Computed again with nothing changed, nothing changes: nothing is written.
    expect(reconcileSignals(after, items, new Set(['hours']), MID_MONTH)).toEqual(after)
  })

  it('offers to stop showing a kind put away three times, and hides the kinds muted', () => {
    const muted = ['a', 'b', 'c'].map((key) => decision({ key, state: 'muted' }))
    const settings = { ...NO_TODAY_SETTINGS, decisions: muted }
    expect(applyDecisions([item({ key: 'd' })], settings, MID_MONTH).muteOffers).toEqual([
      'bugs_stuck',
    ])
    const page = applyDecisions(
      [item({ key: 'd' })],
      { ...settings, mutedKinds: ['bugs_stuck'] },
      MID_MONTH,
    )
    expect(page).toEqual({ items: [], hidden: 1, hiddenItems: [], muteOffers: [] })
  })

  it('keeps the last word on each signal and cleans the addresses', () => {
    const first = withDecision(NO_TODAY_SETTINGS, decision({}))
    const second = withDecision(first, decision({ state: 'muted' }))
    expect(second.decisions).toHaveLength(1)
    expect(second.decisions[0]?.state).toBe('muted')
    expect(withoutDecision(second, 'a').decisions).toEqual([])
    // A decision taken under the key the signal had before goes with the signal.
    expect(withoutDecision(second, 'c', ['b']).decisions).toHaveLength(1)
    expect(withoutDecision(second, 'c', ['a']).decisions).toEqual([])
    expect(
      cleanTodaySettings({
        ...NO_TODAY_SETTINGS,
        mutedKinds: ['hours', 'hours'],
        ownAddresses: [' PM@Example.Test ', 'non un indirizzo', 'pm@example.test'],
      }),
    ).toMatchObject({ mutedKinds: ['hours'], ownAddresses: ['pm@example.test'] })
  })
})

const stored = (overrides: Partial<StoredMail> & Pick<StoredMail, 'id'>): StoredMail => ({
  path: `Posta/2026-11/${overrides.id}.md`,
  subject: 'Aurora: budget',
  from: 'Carla Bianchi <carla@cliente.example>',
  to: 'Paola Verdi <pm@example.test>',
  cc: '',
  date: '2026-11-15T09:00:00Z',
  inReplyTo: null,
  references: [],
  invite: null,
  meeting: null,
  asks: false,
  ...overrides,
})

describe('the mail of the project read back', () => {
  it('reads what the page needs from the file of a mail, and refuses any other file', () => {
    const content = [
      '---',
      'tipo: "email"',
      'oggetto: "R: Aurora: \\"budget\\""',
      'da: "Paola Verdi <pm@example.test>"',
      'a: "Carla Bianchi <carla@cliente.example>"',
      'cc: ""',
      'data: "2026-11-15T10:00:00.000Z"',
      'id: "risposta@example.test"',
      'risponde-a: "budget@cliente.example"',
      'riferimenti: "primo@cliente.example budget@cliente.example"',
      'invito: "REQUEST"',
      'riunione: "Collaudo"',
      'riunione-id: "uid-1"',
      'riunione-inizio: "2026-11-16T14:00:00.000Z"',
      'riunione-fine: ""',
      'riunione-luogo: "Sala grande"',
      'riunione-ripete: "FREQ=WEEKLY"',
      'riunione-escluse: "2026-11-23T14:00:00.000Z 2026-11-30T14:00:00.000Z"',
      'riunione-occorrenza: "2026-11-16T09:00:00.000Z"',
      'riunione-partecipanti: "Carla Bianchi <carla@cliente.example>; luca@octo.example"',
      '---',
      '',
      '# R: Aurora: "budget"',
      '',
      'Va bene per voi giovedì?',
    ].join('\n')
    expect(parseMailDocument('Posta/a.md', content)).toEqual({
      id: 'risposta@example.test',
      path: 'Posta/a.md',
      subject: 'R: Aurora: "budget"',
      from: 'Paola Verdi <pm@example.test>',
      to: 'Carla Bianchi <carla@cliente.example>',
      cc: '',
      date: '2026-11-15T10:00:00.000Z',
      inReplyTo: 'budget@cliente.example',
      references: ['primo@cliente.example', 'budget@cliente.example'],
      invite: 'REQUEST',
      meeting: {
        uid: 'uid-1',
        summary: 'Collaudo',
        start: '2026-11-16T14:00:00.000Z',
        end: null,
        location: 'Sala grande',
        recurrence: 'FREQ=WEEKLY',
        excluded: ['2026-11-23T14:00:00.000Z', '2026-11-30T14:00:00.000Z'],
        occurrence: '2026-11-16T09:00:00.000Z',
        attendees: ['Carla Bianchi <carla@cliente.example>', 'luca@octo.example'],
      },
      asks: true,
    })
    expect(parseMailDocument('a.md', '# Un documento')).toBeNull()
    expect(parseMailDocument('a.md', '---\ntipo: "email"\n')).toBeNull()
    expect(
      parseMailDocument('a.md', '---\ntipo: "lettura-fonte"\nid: "x"\ndata: "2026-11-15"\n---\n'),
    ).toBeNull()
    expect(parseMailDocument('a.md', '---\ntipo: "email"\nid: "x"\ndata: "ieri"\n---\n')).toBeNull()
    expect(parseMailDocument('a.md', '---\ntipo: "email"\nid: "x\ndata: "2026"\n---\n')).toBeNull()
  })

  it('tells who waits for whom from addresses, dates and references only', () => {
    const own = ['PM@example.test']
    const waiting = stored({ id: 'budget' })
    const answered = stored({
      id: 'collaudo',
      subject: 'Aurora: collaudo',
      date: '2026-11-14T09:00:00Z',
    })
    const reply = stored({
      id: 'risposta',
      subject: 'R: Aurora: collaudo',
      from: 'Paola Verdi <pm@example.test>',
      to: 'Carla Bianchi <carla@cliente.example>',
      date: '2026-11-14T10:00:00Z',
      inReplyTo: 'collaudo',
    })
    const alert = stored({ id: 'allarme', from: 'Monitor <avvisi@monitor.example>' })
    const inCopy = stored({ id: 'copia', to: 'Altri <altri@example.test>', cc: 'pm@example.test' })
    const old = stored({ id: 'vecchia', date: '2026-10-20T09:00:00Z' })
    const invite = stored({ id: 'invito', invite: 'REQUEST' })
    const asked = stored({
      id: 'domanda',
      subject: 'Aurora: ambiente di prova',
      from: 'pm@example.test',
      to: 'luca@cliente.example',
      date: '2026-11-10T09:00:00Z',
      asks: true,
    })
    const stated = stored({ ...asked, id: 'comunicazione', subject: 'Aurora: nota', asks: false })
    const threads = mailThreads(
      [waiting, answered, reply, alert, inCopy, old, invite, asked, stated],
      own,
      NOW,
    )
    expect(threads.awaitingMe.map((mail) => mail.id)).toEqual(['budget'])
    expect(threads.awaitingThem.map((mail) => mail.id)).toEqual(['domanda'])
    // An answer that lost its reference is still found by its subject.
    const bySubject = mailThreads([answered, { ...reply, inReplyTo: null }], own, NOW)
    expect(bySubject.awaitingMe).toEqual([])
    // Somebody answered the question, or nobody knows who the PM is: nothing waits.
    const answer = stored({
      id: 'r',
      subject: 'RE: Aurora: ambiente di prova',
      date: '2026-11-11T09:00:00Z',
      references: ['domanda'],
    })
    expect(mailThreads([asked, answer], own, NOW).awaitingThem).toEqual([])
    expect(mailThreads([waiting], [], NOW)).toEqual({
      awaitingMe: [],
      waiting: {},
      awaitingThem: [],
    })
    expect(threadSubject(' R: RE: Fw:  Aurora:  Collaudo ')).toBe('aurora: collaudo')
  })

  it('turns the mail that waits into signals, with the judgement when there is one', () => {
    const threads = mailThreads(
      [stored({ id: 'budget' }), stored({ id: 'urgente', subject: 'Aurora: firma' })],
      ['pm@example.test'],
      NOW,
    )
    const judgement = {
      importance: 'alta' as const,
      reason: 'Serve una firma.',
      quote: 'entro lunedì',
      quoteVerified: true,
      deadline: '2026-11-17',
    }
    const items = mailItems(threads, { urgente: judgement }, NOW, '2026-11-17')
    expect(items.map((entry) => [entry.key, entry.band, entry.dueBecause])).toEqual([
      ['mail:budget', 'waiting', undefined],
      ['mail:urgente', 'due', 'deadline'],
    ])
    expect(items[1]?.facts).toMatchObject({ kind: 'mail_reply', days: 1, judgement })
    const waiting = {
      awaitingMe: [],
      waiting: {},
      awaitingThem: [stored({ id: 'q', date: '2026-11-10T09:00:00Z' })],
    }
    expect(mailItems(waiting, {}, NOW, '2026-11-17')[0]).toMatchObject({
      key: 'waiting:q',
      band: 'watch',
      facts: { kind: 'mail_waiting', days: 6 },
    })
  })
})

const ONCE = { recurrence: null, excluded: [], occurrence: null, attendees: [] }

describe('the meetings of an invitation', () => {
  const calendar = (lines: string[]) =>
    [
      'BEGIN:VCALENDAR',
      'METHOD:REQUEST',
      'BEGIN:VEVENT',
      ...lines,
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n')

  it('reads the first event: id, title, place and when, in the time of Italy', () => {
    const meeting = parseInvite(
      calendar([
        'UID:uid-1',
        'SUMMARY:Collaudo di Aurora\\, con il',
        '  cliente',
        'DTSTART;TZID=Europe/Rome:20261116T150000',
        'DTEND;TZID=Europe/Rome:20261116T160000',
        'LOCATION:Sala grande\\nPiano 2',
      ]),
    )
    expect(meeting).toEqual({
      uid: 'uid-1',
      summary: 'Collaudo di Aurora, con il cliente',
      start: '2026-11-16T14:00:00.000Z',
      end: '2026-11-16T15:00:00.000Z',
      location: 'Sala grande Piano 2',
      recurrence: null,
      excluded: [],
      occurrence: null,
      attendees: [],
    })
    // Universal time, and a whole day.
    expect(parseInvite(calendar(['UID:u', 'DTSTART:20260716T130000Z']))?.start).toBe(
      '2026-07-16T13:00:00.000Z',
    )
    expect(parseInvite(calendar(['UID:u', 'DTSTART;VALUE=DATE:20260716']))?.start).toBe(
      '2026-07-15T22:00:00.000Z',
    )
  })

  it('gives nothing for a calendar without an event, an id or a start it can read', () => {
    expect(parseInvite('BEGIN:VCALENDAR\nEND:VCALENDAR')).toBeNull()
    expect(parseInvite(calendar(['DTSTART:20261116T150000Z']))).toBeNull()
    expect(parseInvite(calendar(['UID:u', 'DTSTART:domani']))).toBeNull()
    expect(
      parseInvite(calendar(['UID:u', 'DTSTART:20261340T150000Z', 'riga senza due punti'])),
    ).toBeNull()
  })

  it('lists the meetings of a day once each, without those called off', () => {
    const meeting = (uid: string, start: string) => ({
      uid,
      summary: uid,
      start,
      end: null,
      location: '',
      ...ONCE,
    })
    const mails = [
      stored({
        id: '1',
        invite: 'REQUEST',
        meeting: meeting('collaudo', '2026-11-16T14:00:00Z'),
        date: '2026-11-10T09:00:00Z',
      }),
      // Moved to the morning by a later invitation with the same id.
      stored({
        id: '2',
        invite: 'REQUEST',
        meeting: meeting('collaudo', '2026-11-16T09:00:00Z'),
        date: '2026-11-12T09:00:00Z',
      }),
      stored({
        id: '3',
        invite: 'REQUEST',
        meeting: meeting('riesame', '2026-11-16T08:00:00Z'),
        date: '2026-11-10T09:00:00Z',
      }),
      stored({
        id: '4',
        invite: 'CANCEL',
        meeting: meeting('riesame', '2026-11-16T08:00:00Z'),
        date: '2026-11-13T09:00:00Z',
      }),
      stored({ id: '5', invite: 'REQUEST', meeting: meeting('domani', '2026-11-17T08:00:00Z') }),
      stored({ id: '6' }),
    ]
    const today = meetingsOn(mails, '2026-11-16')
    expect(today.map((held) => held.path)).toEqual([mails[1]?.path])
    expect(meetingItems(today)[0]).toMatchObject({
      key: 'meeting:collaudo:2026-11-16T09:00:00Z',
      band: 'due',
      facts: { kind: 'meeting', subject: 'collaudo' },
    })
    expect(meetingsOn([stored({ id: '6' })], '2026-11-16')).toEqual([])
  })

  it('reads how a meeting repeats, the times left out and who is invited', () => {
    const meeting = parseInvite(
      calendar([
        'UID:sal',
        'DTSTART;TZID=Europe/Rome:20261102T100000',
        'RRULE:FREQ=WEEKLY;BYDAY=MO',
        'EXDATE;TZID=Europe/Rome:20261109T100000,20261123T100000',
        'RECURRENCE-ID;TZID=Europe/Rome:20261116T100000',
        'ORGANIZER;CN="Rossi; Mario":mailto:Mario.Rossi@cliente.example',
        'ATTENDEE;ROLE=REQ-PARTICIPANT;CN=Anna Bianchi:mailto:anna@octo.example',
        'ATTENDEE;CN=anna@octo.example:mailto:anna@octo.example',
        'ATTENDEE:mailto:luca@octo.example',
        'ATTENDEE;CN=Sala riunioni:invalid',
      ]),
    )
    expect(meeting).toMatchObject({
      recurrence: 'FREQ=WEEKLY;BYDAY=MO',
      excluded: ['2026-11-09T09:00:00.000Z', '2026-11-23T09:00:00.000Z'],
      occurrence: '2026-11-16T09:00:00.000Z',
      attendees: [
        'Rossi, Mario <mario.rossi@cliente.example>',
        'Anna Bianchi <anna@octo.example>',
        'luca@octo.example',
        'Sala riunioni',
      ],
    })
  })

  const series = (recurrence: string | null, start = '2026-11-02T09:00:00.000Z') => ({
    start,
    end: new Date(Date.parse(start) + 30 * 60 * 1000).toISOString(),
    recurrence,
    excluded: ['2026-11-23T09:00:00.000Z'],
  })
  const fallsOn = (recurrence: string | null, day: string, start?: string): boolean =>
    occurrenceOn(series(recurrence, start), day) !== null

  it('tells the days a meeting that repeats falls on, at the same hour of Italy', () => {
    const weekly = series('FREQ=WEEKLY;BYDAY=MO,WE')
    expect(occurrenceOn(weekly, '2026-11-16')).toEqual({
      start: '2026-11-16T09:00:00.000Z',
      end: '2026-11-16T09:30:00.000Z',
    })
    // In summer the same hour of Italy is another instant.
    expect(occurrenceOn(weekly, '2027-06-07')?.start).toBe('2027-06-07T08:00:00.000Z')
    expect(fallsOn('FREQ=WEEKLY;BYDAY=MO,WE', '2026-11-18')).toBe(true)
    expect(fallsOn('FREQ=WEEKLY;BYDAY=MO,WE', '2026-11-17')).toBe(false)
    // The time left out, a day before the first, the first itself.
    expect(fallsOn('FREQ=WEEKLY;BYDAY=MO', '2026-11-23')).toBe(false)
    expect(fallsOn('FREQ=WEEKLY;BYDAY=MO', '2026-10-26')).toBe(false)
    expect(occurrenceOn(series(null), '2026-11-02')?.start).toBe('2026-11-02T09:00:00.000Z')
    expect(fallsOn(null, '2026-11-09')).toBe(false)
    // Without a weekday the rule keeps the one of the first time; every second week.
    expect(fallsOn('FREQ=WEEKLY', '2026-11-09')).toBe(true)
    expect(fallsOn('FREQ=WEEKLY;INTERVAL=2', '2026-11-09')).toBe(false)
    expect(fallsOn('FREQ=WEEKLY;INTERVAL=2', '2026-11-16')).toBe(true)
  })

  it('follows daily, monthly and yearly rules, and where a series ends', () => {
    expect(fallsOn('FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR', '2026-11-06')).toBe(true)
    expect(fallsOn('FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR', '2026-11-07')).toBe(false)
    expect(fallsOn('FREQ=DAILY;INTERVAL=3', '2026-11-05')).toBe(true)
    expect(fallsOn('FREQ=DAILY;INTERVAL=3', '2026-11-04')).toBe(false)
    // The count: the first and two more.
    expect(fallsOn('FREQ=DAILY;COUNT=3', '2026-11-04')).toBe(true)
    expect(fallsOn('FREQ=DAILY;COUNT=3', '2026-11-05')).toBe(false)
    expect(fallsOn('FREQ=DAILY;COUNT=9999', '2040-01-01')).toBe(false)
    // The last day, as a day and as an instant of universal time.
    expect(fallsOn('FREQ=DAILY;UNTIL=20261110', '2026-11-10')).toBe(true)
    expect(fallsOn('FREQ=DAILY;UNTIL=20261110', '2026-11-11')).toBe(false)
    expect(fallsOn('FREQ=DAILY;UNTIL=20261110T225959Z', '2026-11-11')).toBe(false)
    // The same day of the month, a day named, the last day, a weekday by its place.
    expect(fallsOn('FREQ=MONTHLY', '2026-12-02')).toBe(true)
    expect(fallsOn('FREQ=MONTHLY', '2026-12-03')).toBe(false)
    expect(fallsOn('FREQ=MONTHLY;BYMONTHDAY=15', '2026-11-15')).toBe(true)
    expect(fallsOn('FREQ=MONTHLY;BYMONTHDAY=-1', '2026-11-30')).toBe(true)
    expect(fallsOn('FREQ=MONTHLY;BYDAY=1MO', '2026-12-07')).toBe(true)
    expect(fallsOn('FREQ=MONTHLY;BYDAY=1MO', '2026-12-14')).toBe(false)
    expect(fallsOn('FREQ=MONTHLY;BYDAY=-1FR', '2026-11-27')).toBe(true)
    expect(fallsOn('FREQ=MONTHLY;BYDAY=MO;BYSETPOS=2', '2026-11-09')).toBe(true)
    expect(fallsOn('FREQ=MONTHLY;INTERVAL=2;BYDAY=1MO', '2026-12-07')).toBe(false)
    expect(fallsOn('FREQ=YEARLY', '2027-11-02')).toBe(true)
    expect(fallsOn('FREQ=YEARLY', '2027-11-03')).toBe(false)
    expect(fallsOn('FREQ=YEARLY;BYMONTH=3;BYMONTHDAY=2', '2027-03-02')).toBe(true)
    expect(fallsOn('FREQ=YEARLY;INTERVAL=2', '2027-11-02')).toBe(false)
  })

  it('holds a rule it cannot follow for its first time only', () => {
    for (const rule of [
      'FREQ=HOURLY',
      'FREQ=WEEKLY;BYDAY=XX',
      'FREQ=WEEKLY;INTERVAL=0',
      'FREQ=WEEKLY;COUNT=0',
      'FREQ=MONTHLY;BYDAY=MO,TU;BYSETPOS=1',
      'FREQ=DAILY;UNTIL=ieri;;X',
    ]) {
      expect(fallsOn(rule, '2026-11-02')).toBe(true)
    }
    expect(fallsOn('FREQ=HOURLY', '2026-11-03')).toBe(false)
    expect(fallsOn('FREQ=WEEKLY;BYDAY=XX', '2026-11-09')).toBe(false)
    // An end that cannot be read is no end.
    expect(fallsOn('FREQ=DAILY;UNTIL=ieri', '2026-11-03')).toBe(true)
    expect(occurrenceOn({ start: '2026-11-02T09:00:00.000Z', end: null }, '2026-11-02')).toEqual({
      start: '2026-11-02T09:00:00.000Z',
      end: null,
    })
    expect(
      occurrenceOn(
        { start: '2026-11-02T09:00:00.000Z', end: null, recurrence: 'FREQ=DAILY' },
        '2026-11-03',
      ),
    ).toEqual({ start: '2026-11-03T09:00:00.000Z', end: null })
  })

  it('holds a series on each of its days, and one time moved or called off alone', () => {
    const weekly = {
      uid: 'sal',
      summary: 'SAL',
      start: '2026-11-02T09:00:00.000Z',
      end: '2026-11-02T10:00:00.000Z',
      location: 'Teams',
      ...ONCE,
      recurrence: 'FREQ=WEEKLY;BYDAY=MO',
      attendees: ['Mario Rossi <mario@cliente.example>'],
    }
    const moved = {
      ...weekly,
      recurrence: null,
      start: '2026-11-17T14:00:00.000Z',
      end: '2026-11-17T15:00:00.000Z',
      occurrence: '2026-11-16T09:00:00.000Z',
    }
    const mails = [
      stored({ id: 's', invite: 'REQUEST', meeting: weekly, date: '2026-10-20T09:00:00Z' }),
      stored({ id: 'r', invite: 'REPLY', meeting: weekly, date: '2026-10-21T09:00:00Z' }),
      stored({ id: 'm', invite: 'REQUEST', meeting: moved, date: '2026-11-10T09:00:00Z' }),
      stored({
        id: 'c',
        invite: 'CANCEL',
        meeting: { ...moved, start: weekly.start, occurrence: '2026-11-30T09:00:00.000Z' },
        date: '2026-11-11T09:00:00Z',
      }),
    ]
    expect(meetingsOn(mails, '2026-11-09')).toEqual([
      {
        uid: 'sal',
        subject: 'SAL',
        start: '2026-11-09T09:00:00.000Z',
        end: '2026-11-09T10:00:00.000Z',
        location: 'Teams',
        attendees: ['Mario Rossi <mario@cliente.example>'],
        repeats: true,
        path: mails[0]?.path,
        sentAt: '2026-10-20T09:00:00Z',
      },
    ])
    // Moved from Monday to Tuesday afternoon; called off on the 30th.
    expect(meetingsOn(mails, '2026-11-16')).toEqual([])
    expect(meetingsOn(mails, '2026-11-17').map((held) => held.start)).toEqual([
      '2026-11-17T14:00:00.000Z',
    ])
    expect(meetingsOn(mails, '2026-11-30')).toEqual([])
    expect(nextWorkday('2026-11-13')).toBe('2026-11-16')
    expect(nextWorkday('2026-11-16')).toBe('2026-11-17')
  })
})

describe('the register of the risks', () => {
  const source = { path: 'wiki/stato.md', quote: 'fissata al 12 dicembre 2026', verified: true }
  const proposal = { title: ' Consegna a ridosso del collaudo ', why: 'Pochi giorni.', source }

  it('takes in what the PM accepts and never proposes again what was turned down', () => {
    const proposed = withCandidates(
      NO_RISKS,
      [proposal, proposal, { ...proposal, title: ' ' }],
      '2026-11-16T09:00:00Z',
      'claude',
    )
    expect(proposed.candidates).toHaveLength(1)
    const id = candidateId(source)
    expect(proposed.candidates[0]).toMatchObject({ id, title: 'Consegna a ridosso del collaudo' })
    expect(proposed).toMatchObject({ proposedAt: '2026-11-16T09:00:00Z', proposedBy: 'claude' })

    const accepted = acceptCandidate(proposed, id, '', '2026-11-16')
    expect(accepted.candidates).toEqual([])
    expect(accepted.risks[0]).toMatchObject({
      id,
      title: 'Consegna a ridosso del collaudo',
      state: 'open',
      since: '2026-11-16',
    })
    // The same words in other spaces and letters are the same source.
    const again = withCandidates(
      accepted,
      [{ ...proposal, source: { ...source, quote: 'Fissata  al 12 dicembre 2026' } }],
      'x',
      null,
    )
    expect(again.candidates).toEqual([])

    const dismissed = dismissCandidate(proposed, id)
    expect(dismissed.dismissed).toEqual([id])
    expect(withCandidates(dismissed, [proposal], 'x', null).candidates).toEqual([])
    // An id that is not among the candidates changes nothing.
    expect(acceptCandidate(proposed, 'altro', 'x', '2026-11-16')).toBe(proposed)
    expect(dismissCandidate(proposed, 'altro')).toBe(proposed)
  })

  it('keeps the risks the PM writes, their notes and their state, and writes them as a text', () => {
    const empty = addRisk(NO_RISKS, '  ', '2026-11-16')
    expect(empty).toBe(NO_RISKS)
    const one = addRisk(NO_RISKS, 'Ambiente di prova non disponibile', '2026-11-16')
    const id = one.risks[0]?.id ?? ''
    const noted = updateRisk(one, id, { note: ' Lo segue il cliente ' })
    expect(noted.risks[0]).toMatchObject({
      note: 'Lo segue il cliente',
      state: 'open',
      source: null,
    })
    const withSource = acceptCandidate(
      withCandidates(noted, [proposal], 'x', null),
      candidateId(source),
      'Consegna stretta',
      '2026-11-16',
    )
    const closed = updateRisk(withSource, id, { state: 'closed' })
    const text = risksMarkdown(closed)
    expect(text).toContain('## Rischi aperti')
    expect(text).toContain('- **Consegna stretta** — nel registro dal 16/11/2026')
    expect(text).toContain('Fonte: `wiki/stato.md`: «fissata al 12 dicembre 2026»')
    expect(text).toContain('## Rischi chiusi')
    expect(text).toContain('Nota del PM: Lo segue il cliente')
    expect(risksMarkdown(NO_RISKS)).toContain('Nessun rischio nel registro.')
    // On the page: the open risks, and one signal for the candidates that wait.
    const waiting = withCandidates(
      closed,
      [{ ...proposal, source: { ...source, quote: 'un’altra frase del file' } }],
      'x',
      null,
    )
    expect(riskItems(waiting).map((entry) => entry.facts.kind)).toEqual(['risk', 'risk_candidates'])
    expect(riskItems(closed).map((entry) => entry.facts.kind)).toEqual(['risk'])
  })
})

describe('a source opened from a click', () => {
  it('opens documents only: a script or a program of the folder is never run', () => {
    for (const path of [
      'wiki/stato.md',
      'Documenti/Offerta Aurora.DOCX',
      '_octo/posta/2026-11/a.md',
      'dati\\export.json',
    ]) {
      expect(opensAsDocument(path), path).toBe(true)
    }
    for (const path of [
      'avvia.command',
      'Strumenti/setup.exe',
      'Octo.app',
      'pagina.html',
      'script.sh',
      'senza-estensione',
      '.md',
      'nota.md/programma',
    ]) {
      expect(opensAsDocument(path), path).toBe(false)
    }
  })
})

describe('who uses Octo', () => {
  const claims = {
    oid: 'u-1',
    tid: 'T-1',
    preferred_username: 'Paola.Verdi@example.test',
    name: 'Paola Verdi',
  }

  it('reads the person from the claims of the sign-in, only of the organization expected', () => {
    expect(identityOf(claims, 't-1')).toEqual({
      id: 'u-1',
      username: 'Paola.Verdi@example.test',
      email: 'Paola.Verdi@example.test',
      name: 'Paola Verdi',
      tenant: 'T-1',
    })
    expect(identityOf({ ...claims, email: 'pm@example.test' }, 't-1')?.email).toBe(
      'pm@example.test',
    )
    expect(identityOf({ sub: 's-1', tid: 't-1', upn: 'paola' }, 't-1')).toMatchObject({
      id: 's-1',
      email: '',
      name: 'paola',
    })
    expect(identityOf(claims, 'altra')).toBeNull()
    expect(identityOf({ tid: 't-1' }, 't-1')).toBeNull()
    expect(identityOf({ oid: 'u-1' }, 't-1')).toBeNull()
  })

  it('knows the addresses of the person and whether a project is theirs', () => {
    const identity = identityOf({ ...claims, email: 'pm@example.test' }, 't-1')
    expect(identityAddresses(identity)).toEqual(['pm@example.test', 'paola.verdi@example.test'])
    expect(identityAddresses(null)).toEqual([])
    expect(assignmentOf(['PRJ000101', 'PRJ000202'], ['prj000202'])).toBe('assigned')
    expect(assignmentOf(['PRJ000101'], ['PRJ000202'])).toBe('not_assigned')
    expect(assignmentOf(['PRJ000101'], [])).toBe('not_assigned')
    expect(assignmentOf([], ['PRJ000202'])).toBe('unknown')
    expect(assignmentOf(['PRJ000101'], null)).toBe('unknown')
  })
})

describe('whose turn a mail is', () => {
  const OWN = ['pm@example.test']
  const MANY =
    'Paola Verdi <pm@example.test>, Luca Neri <luca@cliente.example>, altri@cliente.example'
  const toMany = (overrides: Partial<StoredMail> & Pick<StoredMail, 'id'>) =>
    stored({ to: MANY, subject: 'Aurora: recap UAT', ...overrides })
  const judged = (
    addressee: 'me' | 'someone_else' | 'everyone' | 'nobody' | undefined,
    part: Partial<MailJudgement> = {},
  ): MailJudgement => ({
    importance: 'media',
    reason: 'Motivo.',
    quote: 'Ciao a tutti, di seguito il recap',
    quoteVerified: true,
    deadline: null,
    ...(addressee ? { addressee, addresseeName: null } : {}),
    ...part,
  })

  it('shows one mail for each conversation, the last, and says how many wait', () => {
    const threads = mailThreads(
      [
        toMany({ id: 'primo', date: '2026-11-12T09:00:00Z' }),
        toMany({ id: 'secondo', subject: 'R: Aurora: recap UAT', date: '2026-11-13T09:00:00Z' }),
        toMany({ id: 'terzo', subject: 'RE: R: Aurora: recap UAT', date: '2026-11-14T09:00:00Z' }),
        stored({ id: 'diretta', subject: '', date: '2026-11-15T09:00:00Z' }),
        stored({ id: 'altra', subject: '', date: '2026-11-15T10:00:00Z' }),
      ],
      OWN,
      NOW,
    )
    // Mail without a subject are each a conversation of their own.
    expect(threads.awaitingMe.map((mail) => mail.id)).toEqual(['altra', 'diretta', 'terzo'])
    expect(threads.waiting.terzo).toEqual({
      addressing: 'among_many',
      conversation: 'aurora: recap uat',
      mails: 3,
      recipients: 3,
      answeredBy: null,
    })
    expect(threads.waiting.diretta).toMatchObject({
      addressing: 'only_me',
      conversation: 'diretta',
    })
    expect(conversationOfMail(stored({ id: 'x', subject: 'I: Aurora: Budget ' }))).toBe(
      'aurora: budget',
    )
  })

  it('knows a conversation the PM or one of their own people has taken up', () => {
    const first = toMany({ id: 'primo', date: '2026-11-12T09:00:00Z' })
    const ownPeople = new Set([personKey('Mario Rossi')])
    const taken = mailThreads(
      [
        first,
        // One of the supplier's own answers, written as a tracker or a mail program writes it.
        toMany({
          id: 'nostra',
          from: '"Rossi, Mario" <m.rossi@fornitore.example>',
          date: '2026-11-13T09:00:00Z',
        }),
      ],
      OWN,
      NOW,
      ownPeople,
    )
    // The answer of the colleague is itself a mail the PM is written to: the last of the two.
    expect(taken.awaitingMe.map((mail) => mail.id)).toEqual(['nostra'])
    expect(taken.waiting.nostra).toMatchObject({ addressing: 'among_many', mails: 2 })
    const followed = mailThreads(
      [
        first,
        stored({
          id: 'nostra',
          subject: 'R: Aurora: recap UAT',
          from: 'Mario Rossi <m.rossi@fornitore.example>',
          to: 'Luca Neri <luca@cliente.example>',
          date: '2026-11-13T09:00:00Z',
        }),
      ],
      OWN,
      NOW,
      ownPeople,
    )
    expect(followed.waiting.primo).toMatchObject({
      addressing: 'answered_by_own',
      answeredBy: 'Mario Rossi',
    })
    expect(senderName('"Rossi, Mario" <m.rossi@fornitore.example>')).toBe('Rossi, Mario')

    // The PM wrote later in the conversation, without citing the mail: nothing waits there.
    const mine = stored({
      id: 'mia',
      subject: 'R: Aurora: recap UAT',
      from: 'pm@example.test',
      to: 'luca@cliente.example',
      date: '2026-11-13T09:00:00Z',
      references: ['un-altra'],
    })
    expect(mailThreads([first, mine], OWN, NOW).awaitingMe).toEqual([])
  })

  it('takes a system that writes under its own name for what it is', () => {
    const notice = stored({ id: 'ado', from: 'Azure DevOps <azuredevops@microsoft.com>' })
    const jira = stored({
      id: 'jira',
      subject: 'AUR-1',
      from: '"Jira" <jira@cliente.atlassian.net>',
    })
    const signed = stored({
      id: 'firmata',
      subject: '[JIRA] (AUR-2)',
      from: 'Mario Rossi (Jira) <jira@cliente.atlassian.net>',
    })
    expect(mailThreads([notice, jira, signed], OWN, NOW).awaitingMe).toEqual([])
  })

  it('asks an answer only of a mail that is the PM’s: alone, or as Claude read it', () => {
    const mails = [
      stored({ id: 'sola', subject: 'Aurora: firma' }),
      toMany({ id: 'a-me', subject: 'Aurora: piano' }),
      toMany({ id: 'a-tutti' }),
      toMany({ id: 'a-luca', subject: 'Aurora: data' }),
      toMany({ id: 'nessuno', subject: 'Aurora: verbale' }),
      toMany({ id: 'non-letta', subject: 'Aurora: ambiente' }),
      toMany({ id: 'vecchio-giudizio', subject: 'Aurora: listino' }),
    ]
    const judgements = {
      'a-me': judged('me', { deadline: '2026-11-17' }),
      'a-tutti': judged('everyone', { importance: 'alta' }),
      'a-luca': judged('someone_else', { addresseeName: ' Luca Neri ', deadline: '2026-11-17' }),
      nessuno: judged('nobody'),
      // Judged before Claude was asked whom a mail is for: how much it matters, and no more.
      'vecchio-giudizio': judged(undefined),
    }
    const items = mailItems(mailThreads(mails, OWN, NOW), judgements, NOW, '2026-11-17')
    const of = (id: string) => items.find((item) => 'id' in item.facts && item.facts.id === id)
    expect(of('sola')).toMatchObject({
      key: 'mail:sola',
      band: 'waiting',
      facts: { kind: 'mail_reply', why: 'only_me' },
    })
    expect(of('sola')?.formerKeys).toBeUndefined()
    expect(of('a-me')).toMatchObject({
      key: 'mail:c:aurora: piano',
      formerKeys: ['mail:a-me'],
      band: 'due',
      dueBecause: 'deadline',
      facts: { kind: 'mail_reply', why: 'judged' },
    })
    expect(of('a-tutti')).toMatchObject({
      band: 'watch',
      facts: { kind: 'mail_follow', why: 'everyone', who: null, recipients: 3, mails: 1 },
    })
    // A day asked of somebody else is not a day of the PM.
    expect(of('a-luca')).toMatchObject({
      band: 'watch',
      facts: { kind: 'mail_follow', why: 'someone_else', who: 'Luca Neri' },
    })
    expect(of('a-luca')?.dueBecause).toBeUndefined()
    expect(of('nessuno')?.facts).toMatchObject({ kind: 'mail_follow', why: 'nobody' })
    expect(of('non-letta')?.facts).toMatchObject({ kind: 'mail_follow', why: 'unjudged' })
    expect(of('vecchio-giudizio')?.facts).toMatchObject({ kind: 'mail_follow', why: 'unjudged' })
    expect(conversationKey('aurora: piano')).toBe('mail:c:aurora: piano')

    // What only is followed and matters much comes first among what is watched.
    const watched = orderToday(items).filter((item) => item.band === 'watch')
    expect(watched[0]?.facts).toMatchObject({ id: 'a-tutti' })
  })

  it('puts the PM’s own word before the headers and before Claude', () => {
    const mails = [stored({ id: 'sola', subject: 'Aurora: firma' }), toMany({ id: 'a-tutti' })]
    const threads = mailThreads(mails, OWN, NOW)
    const judgements = { 'a-tutti': judged('everyone') }
    const items = mailItems(threads, judgements, NOW, '2026-11-17', {
      'aurora: firma': 'not_mine',
      'aurora: recap uat': 'mine',
    })
    expect(items.map((item) => item.facts)).toMatchObject([
      { id: 'sola', kind: 'mail_follow', why: 'chosen' },
      { id: 'a-tutti', kind: 'mail_reply', why: 'chosen' },
    ])
    // A conversation one of the own people took up is followed whatever Claude read in it.
    const taken = {
      ...threads,
      waiting: {
        ...threads.waiting,
        'a-tutti': {
          ...(threads.waiting['a-tutti'] as WaitingMail),
          addressing: 'answered_by_own' as const,
          answeredBy: 'Mario Rossi',
        },
      },
    }
    expect(
      mailItems(taken, { 'a-tutti': judged('me') }, NOW, '2026-11-17')[1]?.facts,
    ).toMatchObject({ kind: 'mail_follow', why: 'answered_by_own', who: 'Mario Rossi' })
    // A mail the code knows nothing of is taken as one among many.
    expect(mailItems({ ...threads, waiting: {} }, {}, NOW, '2026-11-17')[0]?.facts).toMatchObject({
      kind: 'mail_follow',
      why: 'unjudged',
      recipients: 1,
      mails: 1,
    })
  })

  it('keeps the PM’s word on a conversation, and a decision taken under the key of before', () => {
    const settings = withMailTurn(NO_TODAY_SETTINGS, 'aurora: piano', 'not_mine', '2026-11-16')
    expect(mailTurnsOf(settings)).toEqual({ 'aurora: piano': 'not_mine' })
    const changed = withMailTurn(settings, 'aurora: piano', 'mine', '2026-11-17')
    expect(changed.mailTurns).toEqual([
      { conversation: 'aurora: piano', turn: 'mine', at: '2026-11-17' },
    ])
    expect(withMailTurn(changed, 'aurora: piano', null, '2026-11-18').mailTurns).toEqual([])
    const many = Array.from({ length: MAX_MAIL_TURNS + 5 }, (_unused, at) => ({
      conversation: `c-${at}`,
      turn: 'mine' as const,
      at: '2026-11-16',
    }))
    expect(cleanTodaySettings({ ...NO_TODAY_SETTINGS, mailTurns: many }).mailTurns).toHaveLength(
      MAX_MAIL_TURNS,
    )

    // «Non serve risposta» said of a mail before conversations had a key still hides it.
    const [item] = mailItems(mailThreads([toMany({ id: 'a-me' })], OWN, NOW), {}, NOW, '2026-11-17')
    const before = {
      ...NO_TODAY_SETTINGS,
      decisions: [
        {
          key: 'mail:a-me',
          kind: 'mail_reply' as const,
          state: 'muted' as const,
          at: '2026-11-15',
          until: null,
          weight: 1,
        },
      ],
    }
    expect(applyDecisions(item ? [item] : [], before, '2026-11-16')).toMatchObject({
      items: [],
      hidden: 1,
    })
  })
})

describe('the mail Claude reads as asking nothing', () => {
  const threads = (addressing: WaitingMail['addressing']) => ({
    awaitingMe: [stored({ id: 'm' })],
    awaitingThem: [],
    waiting: {
      m: { addressing, conversation: 'c', mails: 1, recipients: 2, answeredBy: null },
    },
  })
  const judgement = (overrides: Partial<MailJudgement>): MailJudgement => ({
    importance: 'bassa',
    reason: 'Ringrazia soltanto.',
    quote: 'grazie a tutti',
    quoteVerified: true,
    deadline: null,
    addressee: 'me',
    asksAction: false,
    judgedAt: '2026-11-14T09:00:00.000Z',
    ...overrides,
  })
  const tomorrow = '2026-11-17'
  const signal = (
    addressing: WaitingMail['addressing'],
    overrides: Partial<MailJudgement> = {},
    turns: Parameters<typeof mailItems>[4] = {},
  ) => mailItems(threads(addressing), { m: judgement(overrides) }, NOW, tomorrow, turns)[0]

  it('is kept away, to answer or to follow, only on words the code found', () => {
    expect(signal('only_me')).toMatchObject({ facts: { kind: 'mail_reply' }, setAsideBy: 'claude' })
    expect(signal('among_many', { addressee: 'everyone' })).toMatchObject({
      facts: { kind: 'mail_follow' },
      setAsideBy: 'claude',
    })
    expect(signal('only_me', { quoteVerified: false })?.setAsideBy).toBeUndefined()
    expect(signal('only_me', { asksAction: true })?.setAsideBy).toBeUndefined()
    // Judged before this was asked: the mail is taken as one that asks.
    expect(signal('only_me', { asksAction: undefined })?.setAsideBy).toBeUndefined()
  })

  it('comes back when the PM says it is theirs, and not when they say it is not', () => {
    expect(signal('only_me', {}, { c: 'mine' })?.setAsideBy).toBeUndefined()
    expect(signal('only_me', {}, { c: 'not_mine' })?.setAsideBy).toBe('claude')
  })

  it('is listed among what stays away, with the day Claude said so', () => {
    const aside = signal('only_me') as TodayItem
    const page = applyDecisions([aside], NO_TODAY_SETTINGS, MID_MONTH)
    expect(page.items).toEqual([])
    expect(page.hiddenItems).toEqual([
      { item: aside, state: 'claude', at: '2026-11-14', until: null },
    ])
    // What was judged before the day was kept is said of today.
    const undated = signal('only_me', { judgedAt: undefined }) as TodayItem
    expect(applyDecisions([undated], NO_TODAY_SETTINGS, MID_MONTH).hiddenItems[0]?.at).toBe(
      MID_MONTH,
    )
    // A kind the PM does not want at all is not listed, whoever keeps it away.
    const muted = { ...NO_TODAY_SETTINGS, mutedKinds: ['mail_reply' as const] }
    expect(applyDecisions([aside], muted, MID_MONTH)).toMatchObject({ hidden: 1, hiddenItems: [] })
    expect(
      applyDecisions([item({ key: 'x', setAsideBy: 'claude' })], NO_TODAY_SETTINGS, MID_MONTH)
        .hiddenItems[0]?.at,
    ).toBe(MID_MONTH)
  })
})

describe('what comes first now', () => {
  const meeting = (start: string): TodayItem =>
    item({
      key: `meeting:${start}`,
      band: 'due',
      facts: { kind: 'meeting', subject: 'Stato lavori', start, location: '', path: 'm.md' },
      weight: 1_000_000,
      target: 'mail',
    })
  const mail = (key: string, importance: 'alta' | 'media', extra: Partial<TodayItem> = {}) =>
    item({
      key,
      band: 'waiting',
      facts: {
        kind: 'mail_reply',
        id: key,
        path: `${key}.md`,
        from: 'Anna',
        subject: key,
        days: 1,
        judgement: { importance, reason: '', quote: '', quoteVerified: true, deadline: null },
      },
      target: 'mail',
      ...extra,
    })

  it('puts a meeting about to start before a date, what was put off, a mail that matters', () => {
    const chosen = nowItems(
      [
        mail('important', 'alta'),
        item({ key: 'later', band: 'due', returned: { why: 'later' } }),
        item({ key: 'hours', band: 'due', dueBecause: 'month_end' }),
        meeting('2026-11-16T09:40:00Z'),
      ],
      NOW,
    )
    expect(chosen.map((entry) => [entry.item.key, entry.rule])).toEqual([
      ['meeting:2026-11-16T09:40:00Z', 'meeting_soon'],
      ['hours', 'due'],
      ['later', 'later'],
    ])
    expect(chosen[0]?.minutes).toBe(40)
  })

  it('leaves out what falls under no rule, even when there is room', () => {
    const chosen = nowItems(
      [
        mail('plain', 'media'),
        item({ key: 'bugs', band: 'watch' }),
        item({ key: 'still', returned: { why: 'still', since: '2026-11-10' } }),
        item({ key: 'worse', band: 'watch', returned: { why: 'worse', was: 1, now: 4 } }),
        mail('important', 'alta'),
      ],
      NOW,
    )
    expect(chosen.map((entry) => [entry.item.key, entry.rule])).toEqual([
      ['important', 'important_mail'],
      ['worse', 'worse'],
    ])
  })

  it('takes a meeting only when it starts within two hours and has not begun', () => {
    const keys = (start: string) => nowItems([meeting(start)], NOW).map((entry) => entry.rule)
    expect(keys('2026-11-16T11:00:00Z')).toEqual(['meeting_soon'])
    expect(keys('2026-11-16T11:01:00Z')).toEqual([])
    expect(keys('2026-11-16T09:00:00Z')).toEqual([])
    expect(keys('2026-11-16T08:30:00Z')).toEqual([])
  })

  it('never takes a warning on a source, and keeps the order of the page within a rule', () => {
    const chosen = nowItems(
      [
        item({ key: 'source', band: 'alert', dueBecause: 'month_end' }),
        item({ key: 'light', band: 'due', dueBecause: 'month_end', weight: 1 }),
        item({ key: 'heavy', band: 'due', dueBecause: 'month_end', weight: 9 }),
        item({ key: 'b', band: 'due', dueBecause: 'deadline', weight: 5 }),
        item({ key: 'a', band: 'due', dueBecause: 'deadline', weight: 5 }),
      ],
      NOW,
    )
    expect(chosen.map((entry) => entry.item.key)).toEqual(['heavy', 'a', 'b'])
  })
})

describe('what changed since the PM last looked at the page', () => {
  const bugs = (weight: number) => item({ key: 'bugs', weight })
  const draft = (weight: number) =>
    item({
      key: 'draft:1',
      weight,
      facts: {
        kind: 'draft',
        id: '1',
        title: 'Stato',
        status: 'review',
        days: weight,
        fixFirst: false,
      },
    })

  it('marks nothing before the first look: everything would be new', () => {
    expect(marksOf([bugs(1)], NO_TODAY_SETTINGS)).toEqual({})
  })

  it('marks what was not there, and what counts more of what is wrong', () => {
    const seen = withVisit(NO_TODAY_SETTINGS, [bugs(2), draft(1)], '2026-11-16T09:00:00.000Z')
    expect(seen.lastSeenAt).toBe('2026-11-16T09:00:00.000Z')
    expect(seen.seen).toEqual([
      { key: 'bugs', kind: 'bugs_stuck', weight: 2 },
      { key: 'draft:1', kind: 'draft', weight: 1 },
    ])
    expect(marksOf([bugs(2), draft(1)], seen)).toEqual({})
    // One more bug is worse; one more day of a draft that waits is only one more day.
    expect(marksOf([bugs(3), draft(2), item({ key: 'other' })], seen)).toEqual({
      bugs: 'worse',
      other: 'new',
    })
    expect(marksOf([bugs(1)], seen)).toEqual({})
    // The same signal under a new key is not new.
    expect(marksOf([item({ key: 'mail:c:x', formerKeys: ['bugs'] })], seen)).toEqual({})
  })

  it('counts what comes first and what is to do, once each, and nothing that is only watched', () => {
    const due = item({ key: 'due', band: 'due', dueBecause: 'month_end' })
    const worse = item({ key: 'worse', band: 'watch', returned: { why: 'worse', was: 1, now: 2 } })
    const items = [
      due,
      worse,
      item({ key: 'waiting', band: 'waiting' }),
      item({ key: 'watch', band: 'watch' }),
      item({ key: 'alert', band: 'alert' }),
    ]
    expect(todayCount(items, nowItems(items, NOW))).toBe(3)
    expect(todayCount([], [])).toBe(0)
  })

  it('tells the first signal that comes first now and did not at the reading before', () => {
    const now = nowItems(
      [
        item({ key: 'a', band: 'due', dueBecause: 'month_end', weight: 2 }),
        item({ key: 'b', band: 'due', dueBecause: 'month_end', weight: 1 }),
      ],
      NOW,
    )
    // At the first reading there is nothing to compare with.
    expect(firstEntered(undefined, now)).toBeNull()
    expect(firstEntered([], now)?.item.key).toBe('a')
    expect(firstEntered(['a'], now)?.item.key).toBe('b')
    expect(firstEntered(['a', 'b', 'gone'], now)).toBeNull()
  })
})
