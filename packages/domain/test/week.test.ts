import { describe, expect, it } from 'vitest'
import {
  addRisk,
  type BriefPoint,
  NO_RISKS,
  type OpenPoint,
  type Risk,
  risksMarkdown,
  type TodayItem,
  updateRisk,
  weekEnd,
  weekItems,
} from '../src/index.ts'

const TODAY = '2026-11-16'

const point = (title: string, more: Partial<BriefPoint> = {}, due: string | null = null) =>
  ({
    point: { id: title, title, owner: '', due } as OpenPoint,
    fresh: false,
    overdueDays: 0,
    openWorkdays: 1,
    raiseAt: null,
    ...more,
  }) satisfies BriefPoint
const risk = (id: string, more: Partial<Risk> = {}): Risk => ({
  id,
  title: id,
  since: '2026-11-01',
  state: 'open',
  source: null,
  note: '',
  due: null,
  severity: null,
  ...more,
})
const signal = (key: string, facts: object, more: Partial<TodayItem> = {}): TodayItem =>
  ({ key, band: 'watch', facts, weight: 0, target: 'mail', asOf: null, ...more }) as TodayItem
const mail = (key: string, deadline: string | null): TodayItem =>
  signal(key, { kind: 'mail_reply', judgement: deadline === null ? null : { deadline } })

describe('the week the PM plans', () => {
  it('ends on Sunday, and from Friday on the Sunday after', () => {
    expect(weekEnd('2026-11-16')).toBe('2026-11-22')
    expect(weekEnd('2026-11-19')).toBe('2026-11-22')
    expect(weekEnd('2026-11-20')).toBe('2026-11-29')
    expect(weekEnd('2026-11-21')).toBe('2026-11-29')
    expect(weekEnd('2026-11-22')).toBe('2026-11-29')
  })

  it('tells what is wrong now: points late or old, risks, what stays wrong', () => {
    const week = weekItems({
      today: TODAY,
      sprintEnd: null,
      points: [
        point('Recente'),
        point('Vecchio', { openWorkdays: 6 }),
        point('Scaduto', { overdueDays: 3 }, '2026-11-13'),
        point('Lontano', {}, '2026-12-10'),
      ],
      risks: [
        risk('basso', { severity: 'bassa' }),
        risk('alto', { severity: 'alta' }),
        risk('chiuso', { state: 'closed' }),
        risk('scaduto', { due: '2026-11-10' }),
        risk('lontano', { due: '2026-12-10' }),
      ],
      items: [
        signal('bugs-stuck', { kind: 'bugs_stuck' }),
        signal('source:Jira', { kind: 'source' }),
        signal('hours:2026-10', { kind: 'hours' }),
        signal('forecast:2026-10', { kind: 'forecast' }, { dueBecause: 'month_end' }),
        signal('mail:late', { kind: 'mail_reply', judgement: { deadline: '2026-11-14' } }),
        signal('draft:1', { kind: 'draft' }),
        mail('mail:none', null),
        mail('mail:far', '2026-12-01'),
        signal('mail:unjudged', { kind: 'mail_reply', judgement: null }),
      ],
    })
    expect(week.until).toBe('2026-11-22')
    // What is past its day first, the longer the earlier; then the risks by how much they matter.
    expect(week.ongoing.map((entry) => [entry.key, entry.overdueDays])).toEqual([
      ['risk:scaduto', 6],
      ['point:Scaduto', 3],
      ['signal:mail:late', 2],
      ['risk:alto', 0],
      ['point:Vecchio', 0],
      ['signal:bugs-stuck', 0],
      ['signal:source:Jira', 0],
      ['signal:forecast:2026-10', 0],
      ['risk:basso', 0],
    ])
    expect(week.coming).toEqual([])
  })

  it('tells what the week brings, by day: what is due, the sprint, the month, the calendar', () => {
    const week = weekItems({
      today: TODAY,
      sprintEnd: '2026-11-19',
      points: [point('Giovedì', {}, '2026-11-19'), point('Oggi', {}, TODAY)],
      risks: [risk('mercoledì', { due: '2026-11-18' })],
      items: [
        signal('requirements', { kind: 'requirements' }),
        signal('month-due', { kind: 'month_due' }),
        signal('cal:1', { kind: 'calendar', day: '2026-11-20' }),
        signal('cal:2', { kind: 'calendar', day: '2026-11-25' }),
        mail('mail:due', '2026-11-17'),
      ],
    })
    expect(week.coming.map((entry) => [entry.key, entry.day])).toEqual([
      ['point:Oggi', TODAY],
      ['signal:mail:due', '2026-11-17'],
      ['risk:mercoledì', '2026-11-18'],
      ['point:Giovedì', '2026-11-19'],
      ['sprint-end', '2026-11-19'],
      ['signal:requirements', '2026-11-19'],
      ['signal:cal:1', '2026-11-20'],
      ['signal:month-due', null],
    ])
    expect(week.ongoing).toEqual([])
    // A sprint that ends after the week is not of the week.
    const later = weekItems({
      today: TODAY,
      sprintEnd: '2026-11-27',
      points: [],
      risks: [],
      items: [],
    })
    expect(later).toEqual({ until: '2026-11-22', ongoing: [], coming: [] })
  })
})

describe('a risk with a day and a weight', () => {
  it('takes the day and how much it matters from the PM, and writes them', () => {
    const register = addRisk(NO_RISKS, 'Ambiente non pronto', TODAY)
    const id = register.risks[0]?.id ?? ''
    expect(register.risks[0]).toMatchObject({ due: null, severity: null })
    const set = updateRisk(register, id, { due: '2026-11-20', severity: 'alta' })
    expect(set.risks[0]).toMatchObject({ due: '2026-11-20', severity: 'alta' })
    const text = risksMarkdown(set)
    expect(text).toContain('  - Gravità: alta')
    expect(text).toContain('  - Entro il 20/11/2026')
    // What is not a day or not a weight is none; null takes them away.
    const wrong = updateRisk(set, id, { due: 'venerdì', severity: 'enorme' as never })
    expect(wrong.risks[0]).toMatchObject({ due: null, severity: null })
    expect(updateRisk(set, id, { due: null, severity: null }).risks[0]).toMatchObject({
      due: null,
      severity: null,
    })
    expect(updateRisk(set, id, { note: 'x' }).risks[0]).toMatchObject({ due: '2026-11-20' })
  })
})
