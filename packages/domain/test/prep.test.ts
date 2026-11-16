import { describe, expect, it } from 'vitest'
import {
  type BriefPoint,
  type DayMeeting,
  lastRecordingOf,
  MAX_PREP_MAILS,
  MAX_PREP_NOTES,
  meetingNotices,
  meetingPrep,
  type OpenPoint,
  type PrepNote,
  prepCount,
  type StoredMeeting,
  type TodayItem,
} from '../src/index.ts'

const meeting = (uid: string, start: string, more: Partial<DayMeeting> = {}): DayMeeting => ({
  uid,
  subject: 'Aurora: SAL settimanale',
  start,
  end: new Date(Date.parse(start) + 60 * 60 * 1000).toISOString(),
  location: '',
  attendees: ['Carla Bianchi <carla@cliente.example>', 'Paola Verdi <pm@example.test>'],
  repeats: true,
  path: 'Posta/sal.md',
  sentAt: '2026-10-01T09:00:00.000Z',
  ...more,
})
const SAL = meeting('sal', '2026-11-16T10:00:00.000Z')
const KEY = 'meeting:sal:2026-11-16T10:00:00.000Z'
const recorded = (id: string, started: string, title = 'Registrazione'): StoredMeeting => ({
  id,
  title,
  started,
  minutes: 50,
  participants: [],
  folder: `_octo/riunioni/${id}`,
})
const day = (instant: Date): string => instant.toISOString().slice(0, 10)
const point = (id: string, more: Partial<OpenPoint> = {}): OpenPoint =>
  ({
    id,
    title: id,
    owner: '',
    due: null,
    state: 'open',
    meeting: null,
    source: null,
    closing: null,
    ...more,
  }) as OpenPoint
const queued = (of: OpenPoint): BriefPoint => ({
  point: of,
  fresh: false,
  overdueDays: 0,
  openWorkdays: 2,
  raiseAt: null,
})
const signal = (key: string, facts: object): TodayItem =>
  ({ key, band: 'waiting', facts, weight: 0, target: 'mail', asOf: null }) as TodayItem
const note = (key: string, text: string, verified = true): PrepNote => ({
  key,
  text,
  path: 'wiki/stato.md',
  quote: 'parole del file',
  verified,
})

describe('the last time a meeting was recorded', () => {
  const heldOn = (date: string): DayMeeting[] =>
    date === '2026-11-09' ? [meeting('sal', '2026-11-09T10:00:00.000Z')] : []

  it('is the last recording made while a time of the series was held', () => {
    const recordings = [
      recorded('altro', '2026-11-12T14:00:00.000Z'),
      recorded('sal-9', '2026-11-09T10:03:00.000Z'),
      // At another hour of the day of the series: not this meeting.
      recorded('pomeriggio', '2026-11-09T15:00:00.000Z'),
      // After the meeting being prepared, and too long ago.
      recorded('dopo', '2026-11-16T10:02:00.000Z'),
      recorded('vecchia', '2026-08-01T10:00:00.000Z', 'Aurora: SAL settimanale'),
    ]
    expect(lastRecordingOf(SAL, recordings, heldOn, day)?.id).toBe('sal-9')
    expect(lastRecordingOf(SAL, [], heldOn, day)).toBeNull()
  })

  it('is, when the calendar does not tell, the last recording called the same', () => {
    const recordings = [
      recorded('a', '2026-11-02T10:00:00.000Z', 'aurora — SAL  settimanale'),
      recorded('b', '2026-11-05T10:00:00.000Z', 'Altro'),
    ]
    expect(lastRecordingOf(SAL, recordings, () => [], day)?.id).toBe('a')
    // A meeting without a name is like no other.
    const unnamed = { ...SAL, subject: '' }
    expect(
      lastRecordingOf(unnamed, [recorded('c', '2026-11-05T10:00:00.000Z', '')], () => [], day),
    ).toBeNull()
  })
})

describe('the card of a meeting', () => {
  const folder = '_octo/riunioni/sal-9'
  const last = {
    title: 'SAL',
    started: '2026-11-09T10:03:00.000Z',
    folder,
    file: `${folder}/report.md`,
  }
  const ofSeries = point('Della serie', { meeting: 'sal' })
  const ofCarla = point('Di Carla', { owner: 'Carla Bianchi' })
  const ofAnother = point('Di un altro', { owner: 'Luca Neri' })
  const born = point('Nato lì', {
    source: { path: `${folder}/report.md`, quote: 'q', verified: true },
  })
  const done = point('Chiuso lì', {
    state: 'resolved',
    closing: { path: `${folder}/report.md`, quote: 'q', verified: true },
  })
  const elsewhere = point('Chiuso altrove', {
    state: 'resolved',
    closing: { path: '_octo/riunioni/altra/report.md', quote: 'q', verified: true },
  })

  it('gathers the points to bring, what the last time left, the mail and the numbers', () => {
    const items = [
      signal('mail:1', { kind: 'mail_reply', from: 'Carla Bianchi <Carla@cliente.example>' }),
      signal('mail:2', { kind: 'mail_follow', from: 'Altro <altro@x.example>' }),
      signal('waiting:3', { kind: 'mail_waiting', to: 'carla@cliente.example, x@y.example' }),
      // The PM is invited too: their own address tells nothing.
      signal('waiting:4', { kind: 'mail_waiting', to: 'pm@example.test' }),
      signal('bugs-stuck', { kind: 'bugs_stuck' }),
      signal('hours', { kind: 'hours' }),
    ]
    const prep = meetingPrep(SAL, {
      points: [ofSeries, ofCarla, ofAnother, born].map(queued),
      allPoints: [ofSeries, ofCarla, ofAnother, born, done, elsewhere],
      last,
      items,
      own: ['PM@example.test'],
      notes: [
        note(KEY, 'Chiedi la data'),
        note(KEY, 'Non trovata', false),
        note('meeting:altra', 'Di un’altra riunione'),
      ],
    })
    expect(prep.key).toBe(KEY)
    expect(prep.points.map((entry) => entry.point.title)).toEqual(['Della serie', 'Di Carla'])
    expect(prep.last).toMatchObject({ title: 'SAL', file: `${folder}/report.md` })
    expect(prep.last?.opened.map((kept) => kept.title)).toEqual(['Nato lì'])
    expect(prep.last?.closed.map((kept) => kept.title)).toEqual(['Chiuso lì'])
    expect(prep.mails.map((item) => item.key)).toEqual(['mail:1', 'waiting:3'])
    // A meeting on how the project goes: what the tracker shows.
    expect(prep.numbers.map((item) => item.key)).toEqual(['bugs-stuck'])
    expect(prep.bring.map((kept) => kept.text)).toEqual(['Chiedi la data'])
    // Two points, two mails, a note, a point born the last time.
    expect(prepCount(prep)).toBe(6)
    // A point born the last time that is also to bring is one thing, not two.
    const twice = { ...prep, points: [...prep.points, queued(born)] }
    expect(prepCount(twice)).toBe(6)
  })

  it('holds nothing for a meeting nothing is known about, and only so much', () => {
    const plain = meeting('x', '2026-11-16T15:00:00.000Z', { subject: 'Pranzo', attendees: [] })
    const empty = meetingPrep(plain, {
      points: [queued(ofCarla)],
      allPoints: [ofCarla],
      last: null,
      items: [signal('bugs-stuck', { kind: 'bugs_stuck' }), signal('draft', { kind: 'draft' })],
      own: [],
      notes: [],
    })
    expect(empty).toMatchObject({ points: [], last: null, mails: [], numbers: [], bring: [] })
    expect(prepCount(empty)).toBe(0)
    const key = 'meeting:sal:2026-11-16T10:00:00.000Z'
    const many = meetingPrep(SAL, {
      points: [],
      allPoints: [],
      last: null,
      items: Array.from({ length: MAX_PREP_MAILS + 2 }, (_, index) =>
        signal(`mail:${index}`, { kind: 'mail_reply', from: 'carla@cliente.example' }),
      ),
      own: [],
      notes: Array.from({ length: MAX_PREP_NOTES + 2 }, (_, index) => note(key, `Nota ${index}`)),
    })
    expect(many.mails).toHaveLength(MAX_PREP_MAILS)
    expect(many.bring).toHaveLength(MAX_PREP_NOTES)
  })
})

describe('the notice before a meeting', () => {
  it('is due a quarter of an hour before, for the meetings that start before the next look', () => {
    const now = new Date('2026-11-16T09:00:00.000Z')
    const at = (start: string) => meeting(start, start)
    const notices = meetingNotices(
      [
        at('2026-11-16T08:30:00.000Z'),
        at('2026-11-16T09:05:00.000Z'),
        at('2026-11-16T09:25:00.000Z'),
        at('2026-11-16T09:30:00.000Z'),
        at('2026-11-16T09:31:00.000Z'),
      ],
      now,
      15 * 60 * 1000,
    )
    // Already begun: not told. About to start: at once. Within the next look: when it is due.
    expect(
      notices.map((notice) => [notice.meeting.uid.slice(11, 16), notice.inMs / 60000]),
    ).toEqual([
      ['09:05', 0],
      ['09:25', 10],
      ['09:30', 15],
    ])
  })
})
