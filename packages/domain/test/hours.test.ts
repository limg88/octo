import { describe, expect, it } from 'vitest'
import {
  amountOf,
  cleanHoursSettings,
  DEFAULT_HOURS_SETTINGS,
  dayOf,
  deltaPct,
  type HoursEntry,
  type HoursSettings,
  parseSeparated,
  parseTimesheetExport,
  parseWorklogExport,
  personKey,
  reconcileHours,
} from '../src/index.ts'

const entry = (
  person: string,
  day: string,
  hours: number,
  more: Partial<HoursEntry> = {},
): HoursEntry => ({
  person,
  day,
  hours,
  project: 'P1',
  approved: true,
  id: null,
  ...more,
})
const JUNE = { from: '2026-06-01', to: '2026-06-30' }
const settings: HoursSettings = { ...DEFAULT_HOURS_SETTINGS, projects: ['P1'] }

describe('people', () => {
  it('recognises a person whatever the order and the spelling of the name', () => {
    expect(personKey('Rossi, Mario')).toBe('mario rossi')
    expect(personKey('MARIO ROSSI')).toBe('mario rossi')
    expect(personKey('mario.rossi')).toBe('mario rossi')
    expect(personKey('0042 Niccolò D’Amico')).toBe('amico d niccolo')
    expect(personKey('  ')).toBe('')
  })
})

describe('reconciliation of hours', () => {
  const timesheet = [
    entry('Rossi Mario', '2026-06-03', 8),
    entry('Rossi Mario', '2026-06-04', 8),
    entry('Bianchi Anna', '2026-06-03', 8),
    entry('Verdi Luca', '2026-06-03', 8),
    entry('Neri Sara', '2026-06-03', 4),
    entry('Rossi Mario', '2026-06-05', 8, { approved: false }),
    entry('Rossi Mario', '2026-06-05', 6, { project: 'P9' }),
    entry('Rossi Mario', '2026-05-29', 8),
  ]
  const worklog = [
    entry('Mario Rossi', '2026-06-03', 7.5, { project: null }),
    entry('Mario Rossi', '2026-06-04', 8, { project: null }),
    entry('anna.b', '2026-06-03', 2, { project: null }),
    entry('Gialli Ugo', '2026-06-03', 5, { project: null }),
    entry('Mario Rossi', '2026-07-01', 8, { project: null }),
  ]

  it('compares person by person and puts first what needs a look', () => {
    const result = reconcileHours(timesheet, worklog, settings, JUNE)
    expect(result.rows).toEqual([
      {
        person: 'Bianchi Anna',
        timesheetHours: 8,
        worklogHours: 0,
        deltaPct: 100,
        status: 'no_worklog',
      },
      {
        person: 'Verdi Luca',
        timesheetHours: 8,
        worklogHours: 0,
        deltaPct: 100,
        status: 'no_worklog',
      },
      {
        person: 'Neri Sara',
        timesheetHours: 4,
        worklogHours: 0,
        deltaPct: 100,
        status: 'no_worklog',
      },
      {
        person: 'Gialli Ugo',
        timesheetHours: 0,
        worklogHours: 5,
        deltaPct: null,
        status: 'no_timesheet',
      },
      {
        person: 'anna.b',
        timesheetHours: 0,
        worklogHours: 2,
        deltaPct: null,
        status: 'no_timesheet',
      },
      {
        person: 'Rossi Mario',
        timesheetHours: 16,
        worklogHours: 15.5,
        deltaPct: 3.1,
        status: 'ok',
      },
    ])
    expect(result.totals).toEqual({ timesheetHours: 36, worklogHours: 22.5, deltaPct: 37.5 })
    expect(result.excluded).toEqual({
      notApprovedHours: 8,
      partialTimesheetHours: 0,
      partialWorklogHours: 0,
      otherProjects: [{ project: 'P9', hours: 6 }],
    })
    expect(result.tieOut).toEqual({ approvedHours: 36, accountedHours: 36, ok: true })
  })

  it('follows aliases, expected absences, the threshold and the cutoff', () => {
    const result = reconcileHours(
      timesheet,
      worklog,
      {
        ...settings,
        thresholdPct: 2,
        cutoff: '2026-06-03',
        aliases: [{ worklog: 'anna.b', timesheet: 'Bianchi Anna' }],
        noWorklogExpected: ['Luca Verdi'],
        noTimesheetExpected: ['Ugo Gialli'],
      },
      JUNE,
    )
    expect(
      result.rows.map((row) => [row.person, row.status, row.timesheetHours, row.worklogHours]),
    ).toEqual([
      ['Rossi Mario', 'outlier', 8, 7.5],
      ['Bianchi Anna', 'outlier', 8, 2],
      ['Neri Sara', 'no_worklog', 4, 0],
      ['Verdi Luca', 'expected', 8, 0],
      ['Gialli Ugo', 'expected', 0, 5],
    ])
    expect(result.excluded.partialTimesheetHours).toBe(8)
    expect(result.excluded.partialWorklogHours).toBe(8)
    expect(result.tieOut).toEqual({ approvedHours: 36, accountedHours: 36, ok: true })
  })

  it('says when the same hours of a person appear on two project codes', () => {
    const moved = [
      entry('Rossi Mario', '2026-06-03', 8, { project: 'P1' }),
      entry('Rossi Mario', '2026-06-03', 8, { project: 'P2' }),
      entry('Rossi Mario', '2026-06-04', 8, { project: 'P2' }),
      entry('Mario Rossi', '2026-06-04', 8, { project: 'P1' }),
      entry('Rossi Mario', '2026-06-05', 4, { project: 'P1' }),
      entry('Rossi Mario', '2026-06-05', 4, { project: 'P1' }),
    ]
    const result = reconcileHours(moved, [], { ...settings, projects: ['P1', 'P2'] }, JUNE)
    expect(result.possibleDuplicates).toEqual([{ projects: ['P1', 'P2'], hours: 16 }])
    expect(reconcileHours(timesheet, worklog, settings, JUNE).possibleDuplicates).toEqual([])
  })

  it('takes every project when none is chosen', () => {
    const result = reconcileHours(timesheet, [], { ...settings, projects: [] }, JUNE)
    expect(result.excluded.otherProjects).toEqual([])
    expect(result.totals.timesheetHours).toBe(42)
    expect(deltaPct(0, 5)).toBeNull()
  })
})

describe('sources of hours', () => {
  it('reads days and amounts as people write them', () => {
    expect(dayOf('2026-06-03T10:00:00Z')).toBe('2026-06-03')
    expect(dayOf('3/6/2026 09:30')).toBe('2026-06-03')
    expect(dayOf('June')).toBeNull()
    expect(amountOf('7,5')).toBe(7.5)
    expect(amountOf('1.250,5')).toBe(1250.5)
    expect(amountOf('7.5')).toBe(7.5)
    expect(amountOf(8)).toBe(8)
    expect(amountOf('')).toBeNull()
    expect(amountOf('many')).toBeNull()
    expect(amountOf(Number.NaN)).toBeNull()
  })

  it('reads the timesheet rows of the company system', () => {
    const rows = [
      {
        employee: 'Rossi Mario',
        timesheetdate: '2026-06-03',
        projectid: 'P1',
        duration: 8,
        approvalstatus: 'Approved',
        internalid: 7,
      },
      {
        employee: 'Rossi Mario',
        timesheetdate: '2026-06-04',
        duration: '4,5',
        approvalstatus: 'Open',
      },
      { employee: 'Rossi Mario', timesheetdate: '2026-06-05', duration: 8 },
      { employee: '', timesheetdate: '2026-06-03', duration: 8 },
      'noise',
    ]
    const parsed = parseTimesheetExport({ rows })
    expect(parsed).toEqual([
      {
        person: 'Rossi Mario',
        day: '2026-06-03',
        hours: 8,
        project: 'P1',
        approved: true,
        id: '7',
      },
      {
        person: 'Rossi Mario',
        day: '2026-06-04',
        hours: 4.5,
        project: null,
        approved: false,
        id: null,
      },
      {
        person: 'Rossi Mario',
        day: '2026-06-05',
        hours: 8,
        project: null,
        approved: true,
        id: null,
      },
    ])
    expect(parseTimesheetExport(rows)).toHaveLength(3)
    expect(parseTimesheetExport({ items: [] })).toBeNull()
    expect(parseTimesheetExport('text')).toBeNull()
  })

  it('splits a text with separators, quotes included', () => {
    expect(parseSeparated('\ufeffa;b\r\n"x;1";"say ""hi"""\n\n1;2')).toEqual([
      ['a', 'b'],
      ['x;1', 'say "hi"'],
      ['1', '2'],
    ])
    expect(parseSeparated('a\tb\n1\t2\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })

  it('reads the hours of a tracker export by the names of its columns', () => {
    const tempo =
      'Issue Key,Hours,Work date,Username,Full name\nA-1,"1,5",2026-06-03 09:00,u1,Mario Rossi\nA-2,2,03/06/2026,u2,\nA-3,x,2026-06-03,u3,Anna Bianchi'
    expect(parseWorklogExport(tempo)).toEqual([
      {
        person: 'Mario Rossi',
        day: '2026-06-03',
        hours: 1.5,
        project: null,
        approved: true,
        id: null,
      },
    ])
    const seconds = 'Utente;Data;Secondi\nMario Rossi;03/06/2026;5400'
    expect(parseWorklogExport(seconds)?.[0]).toMatchObject({ person: 'Mario Rossi', hours: 1.5 })
    expect(parseWorklogExport('Utente;Data;Secondi\nMario Rossi;03/06/2026;')).toEqual([])
    expect(parseWorklogExport('a,b\n1,2')).toBeNull()
    expect(parseWorklogExport('')).toBeNull()
  })

  it('tidies the settings the PM typed', () => {
    expect(
      cleanHoursSettings({
        ...DEFAULT_HOURS_SETTINGS,
        timesheetPath: ' ore ',
        projects: ['P1', ' P1 ', ''],
        thresholdPct: -5,
        cutoff: 'soon',
        aliases: [
          { worklog: ' u1 ', timesheet: 'Rossi Mario' },
          { worklog: '', timesheet: 'x' },
        ],
      }),
    ).toMatchObject({
      timesheetPath: 'ore',
      projects: ['P1'],
      thresholdPct: 0,
      cutoff: '',
      aliases: [{ worklog: 'u1', timesheet: 'Rossi Mario' }],
    })
    expect(
      cleanHoursSettings({
        ...DEFAULT_HOURS_SETTINGS,
        thresholdPct: Number.NaN,
        cutoff: '2026-06-03',
      }),
    ).toMatchObject({
      thresholdPct: 20,
      cutoff: '2026-06-03',
    })
  })
})
