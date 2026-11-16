import { describe, expect, it } from 'vitest'
import {
  addOpenPoint,
  answerPointCheck,
  applyClosing,
  attends,
  checkUnrecorded,
  type DayClosingResult,
  type DayMeeting,
  MAX_OPEN_POINTS,
  MAX_POINT_HISTORY,
  meetingEnd,
  NO_OPEN_POINTS,
  type OpenPointRegister,
  openPointsMarkdown,
  pointBrief,
  pointsCount,
  pointsFor,
  previousWorkday,
  proposedPointId,
  recordedDuring,
  settleBySignals,
  type TodayItem,
  type TodayKind,
  updateOpenPoint,
} from '../src/index.ts'

const TODAY = '2026-11-16'
const source = { path: 'riunioni/sal/report.md', quote: 'Ambiente  entro venerdì', verified: true }
const byHand = (register: OpenPointRegister, title: string, day = TODAY, more = {}) =>
  addOpenPoint(register, { title, origin: 'pm', ...more }, day)
const idOf = (register: OpenPointRegister, title: string): string =>
  register.points.find((point) => point.title === title)?.id ?? ''
const signal = (key: string, kind: TodayKind = 'mail_reply', formerKeys?: string[]): TodayItem =>
  ({ key, facts: { kind }, ...(formerKeys ? { formerKeys } : {}) }) as TodayItem

describe('the register of the open points', () => {
  it('opens a point by hand, from a signal and from words, each once', () => {
    let register = byHand(NO_OPEN_POINTS, '  Verbale   del collaudo ', TODAY, {
      owner: ' Rossi ',
      due: '2026-11-20',
    })
    expect(register.points[0]).toMatchObject({
      title: 'Verbale del collaudo',
      owner: 'Rossi',
      openedOn: TODAY,
      due: '2026-11-20',
      state: 'open',
      origin: 'pm',
      source: null,
      signalKey: null,
    })
    // Without a title it is not a point; a day that is not one is no day.
    expect(byHand(register, '   ')).toBe(register)
    expect(byHand(register, 'Altro', TODAY, { due: 'venerdì' }).points[1]?.due).toBeNull()
    // The same title twice by hand is two points.
    expect(byHand(register, 'Verbale del collaudo').points).toHaveLength(2)

    const fromSignal = { title: 'Rispondi a Carla', origin: 'signal' as const }
    register = addOpenPoint(
      register,
      { ...fromSignal, signal: { key: 'mail:1', kind: 'mail_reply' } },
      TODAY,
    )
    expect(register.points[1]).toMatchObject({ signalKey: 'mail:1', signalKind: 'mail_reply' })
    expect(
      addOpenPoint(
        register,
        { ...fromSignal, signal: { key: 'mail:1', kind: 'mail_reply' } },
        TODAY,
      ),
    ).toBe(register)

    const proposed = {
      title: 'Ambiente di prova',
      origin: 'claude' as const,
      source,
      meeting: 'sal',
    }
    register = addOpenPoint(register, proposed, TODAY)
    expect(register.points[2]).toMatchObject({
      id: proposedPointId(source),
      origin: 'claude',
      meeting: 'sal',
      source,
    })
    // The same words in other spacing and case are the same point.
    expect(proposedPointId({ ...source, quote: 'ambiente entro VENERDÌ ' })).toBe(
      proposedPointId(source),
    )
    expect(addOpenPoint(register, proposed, TODAY)).toBe(register)
  })

  it('never opens again what the PM dropped or closed, when Claude proposes it again', () => {
    const proposed = { title: 'Ambiente di prova', origin: 'claude' as const, source }
    const open = addOpenPoint(NO_OPEN_POINTS, proposed, TODAY)
    const id = proposedPointId(source)
    for (const state of ['dropped', 'resolved'] as const) {
      const put = updateOpenPoint(open, id, { state }, TODAY)
      expect(addOpenPoint(put, proposed, '2026-11-17')).toBe(put)
    }
    // A signal that comes back after its point was closed opens it again.
    const mail = { title: 'Rispondi', origin: 'signal' as const, signal: signal('mail:1') }
    const answered = settleBySignals(
      addOpenPoint(
        NO_OPEN_POINTS,
        {
          ...mail,
          signal: { key: 'mail:1', kind: 'mail_reply' },
        },
        TODAY,
      ),
      [],
      new Set(),
      TODAY,
    )
    const again = addOpenPoint(
      answered,
      { ...mail, signal: { key: 'mail:1', kind: 'mail_reply' } },
      '2026-11-18',
    )
    expect(again.points).toHaveLength(1)
    expect(again.points[0]).toMatchObject({ state: 'open', openedOn: '2026-11-18', closedOn: null })
  })

  it('takes what the PM changes, closes, reopens and drops', () => {
    const register = byHand(NO_OPEN_POINTS, 'Verbale')
    const id = idOf(register, 'Verbale')
    const edited = updateOpenPoint(
      register,
      id,
      { title: ' Verbale firmato ', owner: 'Bianchi', due: '2026-11-19', meeting: 'sal' },
      TODAY,
    )
    expect(edited.points[0]).toMatchObject({
      title: 'Verbale firmato',
      owner: 'Bianchi',
      due: '2026-11-19',
      meeting: 'sal',
      state: 'open',
    })
    // An empty title keeps the one there was; a day taken away is no day.
    const cleared = updateOpenPoint(edited, id, { title: ' ', due: null, state: 'open' }, TODAY)
    expect(cleared.points[0]).toMatchObject({ title: 'Verbale firmato', due: null })
    const done = updateOpenPoint(cleared, id, { state: 'resolved' }, '2026-11-17')
    expect(done.points[0]).toMatchObject({
      state: 'resolved',
      closedOn: '2026-11-17',
      closedBy: 'pm',
    })
    expect(updateOpenPoint(done, id, { state: 'open' }, '2026-11-18').points[0]).toMatchObject({
      state: 'open',
      closedOn: null,
      closedBy: null,
    })
    expect(updateOpenPoint(done, 'altro', { state: 'dropped' }, TODAY)).toEqual(done)
  })

  it('closes with its signal a point opened from one, and no other', () => {
    const from = (key: string, kind: TodayKind) =>
      ({ title: key, origin: 'signal', signal: { key, kind } }) as const
    let register = byHand(NO_OPEN_POINTS, 'A mano')
    for (const [key, kind] of [
      ['mail:1', 'mail_reply'],
      ['mail:c:2', 'mail_reply'],
      ['hours:2026-10', 'hours'],
      ['meeting:x', 'meeting'],
      ['bugs-stuck', 'bugs_stuck'],
    ] as const) {
      register = addOpenPoint(register, from(key, kind), TODAY)
    }
    // The first mail is gone; the second lives on under another key; the hours cannot be told
    // now; a meeting ends with its day; the bugs are still there.
    const items = [
      signal('mail:c:9', 'mail_reply', ['mail:c:2']),
      signal('bugs-stuck', 'bugs_stuck'),
    ]
    const settled = settleBySignals(register, items, new Set<TodayKind>(['hours']), '2026-11-17')
    expect(settled.points.map((point) => [point.title, point.state, point.closedBy])).toEqual([
      ['A mano', 'open', null],
      ['mail:1', 'resolved', 'signal'],
      ['mail:c:2', 'open', null],
      ['hours:2026-10', 'open', null],
      ['meeting:x', 'open', null],
      ['bugs-stuck', 'open', null],
    ])
    // Nothing to close: the very same register, so that nothing is written.
    expect(settleBySignals(settled, items, new Set<TodayKind>(['hours']), TODAY)).toBe(settled)
  })

  it('takes the answer of the PM to what a point waits for', () => {
    const register = byHand(NO_OPEN_POINTS, 'Verbale')
    const id = idOf(register, 'Verbale')
    const check = { day: TODAY, why: 'not_recorded' as const, text: 'Risolto?', meeting: 'SAL' }
    const waiting = { ...register, points: register.points.map((point) => ({ ...point, check })) }
    expect(answerPointCheck(waiting, id, true, TODAY).points[0]).toMatchObject({
      state: 'resolved',
      closedBy: 'pm',
      check: null,
    })
    expect(answerPointCheck(waiting, id, false, TODAY).points[0]).toMatchObject({
      state: 'open',
      check: null,
      history: [{ day: TODAY, text: 'SAL: riunione non registrata, resta in coda', source: null }],
    })
    const doubt = { ...check, why: 'unverified' as const, text: 'Sembra fatto' }
    const doubted = {
      ...register,
      points: register.points.map((point) => ({ ...point, check: doubt })),
    }
    expect(answerPointCheck(doubted, id, false, TODAY).points[0]?.history[0]?.text).toBe(
      'Sembra fatto: non confermato dal PM, resta in coda',
    )
    // A point that waits for nothing is left as it is.
    expect(answerPointCheck(register, id, true, TODAY)).toEqual(register)
  })

  it('keeps the open points whatever their number, and lets the oldest closed go', () => {
    let register = NO_OPEN_POINTS
    for (let index = 0; index < MAX_OPEN_POINTS; index += 1) {
      register = byHand(register, `Punto ${index}`)
    }
    const first = register.points[0]?.id ?? ''
    const second = register.points[1]?.id ?? ''
    register = updateOpenPoint(register, first, { state: 'resolved' }, '2026-11-01')
    register = updateOpenPoint(register, second, { state: 'dropped' }, '2026-11-02')
    register = byHand(register, 'Uno in più')
    expect(register.points).toHaveLength(MAX_OPEN_POINTS)
    expect(register.points.some((point) => point.id === first)).toBe(false)
    expect(register.points.some((point) => point.id === second)).toBe(true)
  })
})

describe('the brief of the morning', () => {
  const meeting = (uid: string, start: string, attendees: string[] = []): DayMeeting => ({
    uid,
    subject: uid,
    start,
    end: null,
    location: '',
    attendees,
    repeats: true,
    path: `Posta/${uid}.md`,
    sentAt: '2026-11-01T09:00:00.000Z',
  })
  const NOW = new Date('2026-11-16T08:00:00.000Z')

  it('tells who is invited to a meeting by the words of the name', () => {
    const invited = ['Mario Rossi <mario.rossi@cliente.example>', 'luca@octo.example']
    expect(attends('Rossi Mario', invited)).toBe(true)
    expect(attends('rossi', invited)).toBe(true)
    expect(attends('Luca', invited)).toBe(true)
    expect(attends('Maria Rossi', invited)).toBe(false)
    expect(attends('', invited)).toBe(false)
    expect(attends('R.', invited)).toBe(false)
  })

  it('orders the queue, says what is new, late and old, and where to close it today', () => {
    expect(previousWorkday('2026-11-16')).toBe('2026-11-13')
    expect(previousWorkday('2026-11-17')).toBe('2026-11-16')
    let register = byHand(NO_OPEN_POINTS, 'Vecchio', '2026-11-02')
    register = byHand(register, 'Scaduto', '2026-11-10', { due: '2026-11-13', owner: 'Rossi' })
    register = byHand(register, 'Di venerdì', '2026-11-13', { due: '2026-11-18', meeting: 'sal' })
    register = byHand(register, 'Più scaduto', '2026-11-12', { due: '2026-11-10' })
    register = byHand(register, 'Chiuso prima', '2026-11-02')
    register = byHand(register, 'Chiuso venerdì', '2026-11-02')
    register = byHand(register, 'Tolto', '2026-11-02')
    register = updateOpenPoint(
      register,
      idOf(register, 'Chiuso prima'),
      { state: 'resolved' },
      '2026-11-12',
    )
    register = updateOpenPoint(
      register,
      idOf(register, 'Chiuso venerdì'),
      { state: 'resolved' },
      '2026-11-13',
    )
    register = updateOpenPoint(
      register,
      idOf(register, 'Tolto'),
      { state: 'dropped' },
      '2026-11-13',
    )
    const meetings = [
      // Already held: no longer a place to close anything.
      meeting('standup', '2026-11-16T07:30:00.000Z', ['Mario Rossi <m@x.example>']),
      meeting('sal', '2026-11-16T09:00:00.000Z'),
      meeting('comitato', '2026-11-16T14:00:00.000Z', ['Mario Rossi <m@x.example>']),
    ]
    const brief = pointBrief(register, TODAY, '2026-11-13', meetings, NOW)
    expect(
      brief.queued.map((entry) => [
        entry.point.title,
        entry.fresh,
        entry.overdueDays,
        entry.openWorkdays,
        entry.raiseAt?.uid ?? null,
      ]),
    ).toEqual([
      ['Più scaduto', false, 6, 2, null],
      ['Scaduto', false, 3, 4, 'comitato'],
      ['Di venerdì', true, 0, 1, 'sal'],
      ['Vecchio', false, 0, 10, null],
    ])
    expect(brief.closed.map((point) => point.title)).toEqual(['Chiuso venerdì'])
    expect(brief.toConfirm).toEqual([])
    expect(pointsCount(brief)).toBe(2)
    expect(
      pointsFor(register.points, meetings[2] as DayMeeting).map((point) => point.title),
    ).toEqual(['Scaduto'])
  })

  it('counts and lists apart what waits for a word of the PM', () => {
    const register = byHand(NO_OPEN_POINTS, 'Verbale', '2026-11-13')
    const check = { day: TODAY, why: 'unverified' as const, text: 'Chiuso?', meeting: null }
    const waiting = { ...register, points: register.points.map((point) => ({ ...point, check })) }
    const brief = pointBrief(waiting, TODAY, '2026-11-13', [], NOW)
    expect(brief.toConfirm.map((point) => point.title)).toEqual(['Verbale'])
    expect(pointsCount(brief)).toBe(1)
  })

  it('writes the register as a text of the project, without what was dropped', () => {
    expect(openPointsMarkdown(NO_OPEN_POINTS)).toContain('Nessun open point.')
    let register = addOpenPoint(
      NO_OPEN_POINTS,
      { title: 'Ambiente di prova', owner: 'Rossi', due: '2026-11-20', origin: 'claude', source },
      '2026-11-13',
    )
    register = byHand(register, 'Stima', '2026-11-10')
    register = byHand(register, 'Tolto', '2026-11-10')
    register = byHand(register, 'Mail', '2026-11-10')
    register = updateOpenPoint(
      register,
      idOf(register, 'Stima'),
      { state: 'resolved' },
      '2026-11-13',
    )
    register = updateOpenPoint(
      register,
      idOf(register, 'Tolto'),
      { state: 'dropped' },
      '2026-11-13',
    )
    register = {
      ...register,
      points: register.points.map((point) =>
        point.title === 'Mail'
          ? {
              ...point,
              state: 'resolved' as const,
              closedOn: '2026-11-14',
              closedBy: 'claude' as const,
              closing: { path: 'riunioni/sal/report.md', quote: 'mail inviata', verified: true },
              history: [{ day: '2026-11-13', text: 'La manda Luca', source: null }],
            }
          : point,
      ),
    }
    const text = openPointsMarkdown(register)
    expect(text).toContain('## Aperti')
    expect(text).toContain(
      '- **Ambiente di prova** — di Rossi, aperto il 13/11/2026, entro il 20/11/2026',
    )
    expect(text).toContain('  - Fonte: `riunioni/sal/report.md`: «Ambiente  entro venerdì»')
    expect(text).toContain(
      '- **Stima** — del PM, aperto il 10/11/2026, chiuso il 13/11/2026 dal PM',
    )
    expect(text).toContain('chiuso il 14/11/2026 da quanto detto in riunione')
    expect(text).toContain('  - Chiusura: `riunioni/sal/report.md`: «mail inviata»')
    expect(text).toContain('  - 13/11/2026: La manda Luca')
    // The last closed comes first; what was dropped is not written.
    expect(text.indexOf('**Mail**')).toBeLessThan(text.indexOf('**Stima**'))
    expect(text).not.toContain('Tolto')
    const closedOnly = updateOpenPoint(
      register,
      proposedPointId(source),
      { state: 'resolved' },
      TODAY,
    )
    expect(openPointsMarkdown(closedOnly)).not.toContain('## Aperti')
  })
})

describe('what the meetings of a day do to the register', () => {
  const found = {
    path: 'riunioni/sal/report.md',
    quote: 'consegnato questa mattina',
    verified: true,
  }
  const lost = { ...found, quote: 'parole non trovate', verified: false }
  const result = (more: Partial<DayClosingResult>): DayClosingResult => ({
    day: '2026-11-17',
    at: '2026-11-17T17:00:00.000Z',
    model: 'claude-fake',
    read: ['m-1'],
    verdicts: [],
    points: [],
    ...more,
  })
  const verdict = (id: string, outcome: 'resolved' | 'open', source = found, said = 'Detto') => ({
    id,
    outcome,
    said,
    source,
    meeting: 'SAL',
  })

  it('closes on words found, asks on words not found, and keeps what was said', () => {
    let register = NO_OPEN_POINTS
    for (const title of ['A', 'B', 'C', 'D', 'E']) register = byHand(register, title)
    const ids = register.points.map((point) => point.id) as [string, string, string, string, string]
    register = updateOpenPoint(register, ids[4], { state: 'resolved' }, TODAY)
    const closed = applyClosing(
      register,
      result({
        verdicts: [
          verdict(ids[0], 'resolved'),
          // Only the first word on a point counts.
          verdict(ids[0], 'open'),
          verdict(ids[1], 'resolved', lost, 'Sembra fatto'),
          verdict(ids[2], 'open', found, ' Luca  lo consegna lunedì '),
          verdict(ids[3], 'open', lost, '  '),
          // A point the PM closed is not touched, nor one that is not there.
          verdict(ids[4], 'open'),
          verdict('altro', 'resolved'),
        ],
      }),
    )
    expect(closed.points[0]).toMatchObject({
      state: 'resolved',
      closedOn: '2026-11-17',
      closedBy: 'claude',
      closing: found,
    })
    expect(closed.points[1]).toMatchObject({
      state: 'open',
      check: { day: '2026-11-17', why: 'unverified', text: 'Sembra fatto', meeting: 'SAL' },
    })
    expect(closed.points[2]?.history).toEqual([
      { day: '2026-11-17', text: 'Luca lo consegna lunedì', source: found },
    ])
    expect(closed.points[3]?.history).toEqual([])
    expect(closed.points[4]).toMatchObject({ state: 'resolved', closedBy: 'pm', history: [] })
    expect(closed).toMatchObject({
      readMeetings: ['m-1'],
      closedDay: '2026-11-17',
      closedAt: '2026-11-17T17:00:00.000Z',
      closedBy: 'claude-fake',
    })
    // The same meeting read again is remembered once.
    expect(applyClosing(closed, result({})).readMeetings).toEqual(['m-1'])
  })

  it('opens only the points whose words were found, and keeps the last notes of a point', () => {
    const proposed = {
      title: 'Piano di rilascio',
      owner: 'Anna',
      due: '2026-11-19',
      meeting: 'sal',
    }
    const opened = applyClosing(
      NO_OPEN_POINTS,
      result({
        points: [
          { ...proposed, source: found },
          { ...proposed, title: 'Inventato', source: lost },
        ],
      }),
    )
    expect(opened.points).toHaveLength(1)
    expect(opened.points[0]).toMatchObject({
      title: 'Piano di rilascio',
      origin: 'claude',
      openedOn: '2026-11-17',
      meeting: 'sal',
      source: found,
    })
    let noted = opened
    const id = opened.points[0]?.id ?? ''
    for (let day = 0; day < MAX_POINT_HISTORY + 2; day += 1) {
      noted = applyClosing(noted, result({ verdicts: [verdict(id, 'open', found, `Nota ${day}`)] }))
    }
    expect(noted.points[0]?.history).toHaveLength(MAX_POINT_HISTORY)
    expect(noted.points[0]?.history[0]?.text).toBe('Nota 2')
  })

  it('tells a recording made while a meeting was held, and asks about a meeting not recorded', () => {
    const meeting = (uid: string, start: string, end: string | null, attendees: string[] = []) =>
      ({ uid, subject: uid, start, end, attendees }) as DayMeeting
    const sal = meeting('sal', '2026-11-16T09:00:00.000Z', '2026-11-16T10:00:00.000Z')
    expect(recordedDuring(sal, { started: '2026-11-16T09:05:00.000Z', minutes: 40 })).toBe(true)
    expect(recordedDuring(sal, { started: '2026-11-16T08:00:00.000Z', minutes: 30 })).toBe(false)
    expect(recordedDuring(sal, { started: '2026-11-16T10:00:00.000Z', minutes: 0 })).toBe(false)
    // Without an end a meeting is taken to last an hour.
    const open = meeting('x', '2026-11-16T09:00:00.000Z', null)
    expect(meetingEnd(open)).toBe(Date.parse('2026-11-16T10:00:00.000Z'))
    expect(recordedDuring(open, { started: '2026-11-16T09:59:00.000Z', minutes: 5 })).toBe(true)

    let register = byHand(NO_OPEN_POINTS, 'Del SAL', '2026-11-12', { meeting: 'sal' })
    register = byHand(register, 'Di Rossi', '2026-11-12', { owner: 'Rossi' })
    register = byHand(register, 'Di oggi', TODAY, { meeting: 'sal' })
    register = byHand(register, 'Di nessuno', '2026-11-12')
    const standup = meeting('standup', '2026-11-16T08:00:00.000Z', null, ['Mario Rossi <m@x.it>'])
    const day = (instant: Date) => instant.toISOString().slice(0, 10)
    const asked = checkUnrecorded(register, [sal, standup, sal], [], day)
    expect(asked.points.map((point) => point.check?.meeting ?? null)).toEqual([
      'sal',
      'standup',
      null,
      null,
    ])
    // Asked once: the question is not put again, nor after the PM's answer.
    expect(checkUnrecorded(asked, [sal, standup], [], day)).toBe(asked)
    const answered = answerPointCheck(asked, asked.points[0]?.id ?? '', false, TODAY)
    expect(checkUnrecorded(answered, [sal], [], day)).toBe(answered)
    // Of two meetings not recorded the point is asked about the last one.
    const yesterday = meeting('standup', '2026-11-13T08:00:00.000Z', null, ['Mario Rossi <m@x.it>'])
    const both = checkUnrecorded(register, [yesterday, standup], [], day)
    expect(both.points[1]?.check).toMatchObject({ day: '2026-11-16', meeting: 'standup' })
    // Recorded: there is something to read, nobody is asked.
    const recording = [{ started: '2026-11-16T09:01:00.000Z', minutes: 50 }]
    expect(checkUnrecorded(register, [sal], recording, day)).toBe(register)
  })
})
