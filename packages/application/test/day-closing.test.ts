import {
  type DayMeeting,
  NO_OPEN_POINTS,
  type OpenPointRegister,
  type Project,
  type StoredMeeting,
} from '@octo/domain'
import { describe, expect, it } from 'vitest'
import {
  CLOSING_WINDOW_DAYS,
  createDayClosing,
  createOpenPoints,
  type MeetingReader,
  type ProposedClosing,
} from '../src/index.ts'
import { evidenceFrom, memoryWriter } from './fakes.ts'

const project = { id: 'p-1', name: 'Aurora', folder: '/aurora' } as Project
const NOW = new Date('2026-11-16T16:00:00.000Z')
const SAL = '_octo/riunioni/2026-11-16_sal'
const REPORT = `${SAL}/report.md`
const FILES: Record<string, string> = {
  [REPORT]: 'Ambiente di prova: consegnato questa mattina.\nAzione: mandare il piano di rilascio.',
  [`${SAL}/transcript.md`]: 'Luca: l’ambiente è pronto da stamattina.',
}
const recorded = (id: string, started: string, folder = SAL): StoredMeeting => ({
  id,
  title: 'SAL settimanale',
  started,
  minutes: 55,
  participants: [],
  folder,
})
const held = (uid: string, start: string, attendees: string[] = []): DayMeeting => ({
  uid,
  subject: uid,
  start,
  end: new Date(Date.parse(start) + 60 * 60 * 1000).toISOString(),
  location: '',
  attendees,
  repeats: true,
  path: `Posta/${uid}.md`,
  sentAt: '2026-11-01T09:00:00.000Z',
})
const SAL_TODAY = held('sal', '2026-11-16T09:00:00.000Z')

function setup(script: (asked: Parameters<MeetingReader['closing']>[0]) => ProposedClosing) {
  let register: OpenPointRegister = NO_OPEN_POINTS
  let meetings: StoredMeeting[] = [recorded('m-1', '2026-11-16T09:02:00.000Z')]
  const asked: Array<Parameters<MeetingReader['closing']>[0]> = []
  const writer = memoryWriter()
  const clock = { now: () => NOW }
  const points = createOpenPoints({
    store: {
      load: async () => register,
      save: async (_folder, next) => {
        register = next
      },
    },
    writer,
    clock: { now: () => new Date('2026-11-12T09:00:00.000Z') },
  })
  const closing = createDayClosing({
    points,
    meetings: { imported: async () => meetings },
    files: { readText: async (_folder, path) => FILES[path] ?? null },
    reader: {
      closing: async (request) => {
        asked.push(request)
        request.onModel?.('claude-fake')
        return script(request)
      },
    },
    evidence: evidenceFrom(
      Object.fromEntries(
        Object.entries(FILES).map(([path, text]) => [
          path,
          { kind: 'found', text, modifiedAt: '' },
        ]),
      ),
    ),
    clock,
  })
  return {
    points,
    closing,
    asked,
    register: () => register,
    record: (next: StoredMeeting[]) => {
      meetings = next
    },
  }
}

const nothing = (): ProposedClosing => ({ verdicts: [], points: [] })

describe('the closing of the day', () => {
  it('closes on words found in the meeting, queues what was talked about, opens what was taken', async () => {
    const { points, closing, asked, register } = setup(({ points: open }) => ({
      verdicts: [
        {
          id: open[0]?.id ?? '',
          outcome: 'resolved',
          said: 'Consegnato questa mattina.',
          path: REPORT,
          quote: 'consegnato questa mattina',
        },
        {
          id: open[1]?.id ?? '',
          outcome: 'open',
          said: 'Mario la rivede giovedì.',
          path: REPORT,
          quote: 'parole che non ci sono',
        },
        // Read closed on words that are not there: the PM is asked.
        {
          id: open[2]?.id ?? '',
          outcome: 'resolved',
          said: 'Sembra fatto.',
          path: REPORT,
          quote: 'parole che non ci sono',
        },
        // Words of a file Claude was not given count for nothing.
        {
          id: open[3]?.id ?? '',
          outcome: 'resolved',
          said: 'Chiuso altrove.',
          path: 'wiki/altro.md',
          quote: 'consegnato questa mattina',
        },
      ],
      points: [
        {
          title: 'Mandare il piano di rilascio',
          owner: 'Anna',
          due: 'giovedì',
          path: REPORT,
          quote: 'mandare il piano di rilascio',
        },
        { title: 'Inventato', owner: '', due: null, path: REPORT, quote: 'non detto da nessuno' },
      ],
    }))
    for (const title of ['Ambiente di prova', 'Stima', 'Verbale', 'Licenze']) {
      await points.add(project, { title })
    }
    const state = await closing.look(project, [SAL_TODAY])
    expect(state.unread).toEqual(['m-1'])

    const closed = await closing.close(project, { held: [SAL_TODAY] })
    // Claude was told the open points and the files of the meeting that exist, the short first.
    expect(asked[0]?.points.map((point) => point.title)).toEqual([
      'Ambiente di prova',
      'Stima',
      'Verbale',
      'Licenze',
    ])
    expect(asked[0]?.meetings).toEqual([
      {
        title: 'SAL settimanale',
        started: '2026-11-16T09:02:00.000Z',
        files: [REPORT, `${SAL}/transcript.md`],
      },
    ])
    expect(
      closed.points.map((point) => [point.title, point.state, point.closedBy, point.check?.why]),
    ).toEqual([
      ['Ambiente di prova', 'resolved', 'claude', undefined],
      ['Stima', 'open', null, undefined],
      ['Verbale', 'open', null, 'unverified'],
      ['Licenze', 'open', null, 'unverified'],
      ['Mandare il piano di rilascio', 'open', null, undefined],
    ])
    expect(closed.points[0]?.closing).toEqual({
      path: REPORT,
      quote: 'consegnato questa mattina',
      verified: true,
    })
    // What was said stays with the point, without a source the code did not find.
    expect(closed.points[1]?.history).toEqual([
      { day: '2026-11-16', text: 'Mario la rivede giovedì.', source: null },
    ])
    expect(closed.points[2]?.check).toMatchObject({
      text: 'Sembra fatto.',
      meeting: 'SAL settimanale',
    })
    // The new point is of the series the recording was made in; a day not named is no day.
    expect(closed.points[4]).toMatchObject({
      origin: 'claude',
      owner: 'Anna',
      due: null,
      meeting: 'sal',
      openedOn: '2026-11-16',
    })
    expect(closed).toMatchObject({
      readMeetings: ['m-1'],
      closedDay: '2026-11-16',
      closedAt: NOW.toISOString(),
      closedBy: 'claude-fake',
    })
    expect(register()).toEqual(closed)
    // Read once: nothing waits, and Claude is not asked again.
    expect((await closing.look(project, [SAL_TODAY])).unread).toEqual([])
    await closing.close(project, { held: [SAL_TODAY] })
    expect(asked).toHaveLength(1)
  })

  it('asks the PM about a point whose meeting was held and not recorded', async () => {
    const { points, closing, asked, record } = setup(nothing)
    record([])
    await points.add(project, { title: 'Di Rossi', owner: 'Rossi' })
    await points.add(project, { title: 'Di nessuna riunione' })
    const standup = held('standup', '2026-11-16T08:30:00.000Z', ['Mario Rossi <m@x.example>'])
    const later = held('comitato', '2026-11-16T17:00:00.000Z', ['Mario Rossi <m@x.example>'])
    const state = await closing.look(project, [standup, later])
    // Only the meeting already over is asked about.
    expect(state.register.points.map((point) => point.check)).toEqual([
      { day: '2026-11-16', why: 'not_recorded', text: '', meeting: 'standup' },
      null,
    ])
    // Without recordings Claude is not asked; the question stays.
    const closed = await closing.close(project, { held: [standup] })
    expect(asked).toEqual([])
    expect(closed.points[0]?.check?.why).toBe('not_recorded')
    // «It stays»: the same meeting is not asked about again.
    await points.confirm(project, closed.points[0]?.id ?? '', false)
    const again = await closing.look(project, [standup])
    expect(again.register.points[0]).toMatchObject({ check: null, state: 'open' })
    expect(again.register.points[0]?.history[0]?.text).toContain('non registrata')
  })

  it('asks nothing when the meeting was recorded, and leaves old recordings alone', async () => {
    const { points, closing, record } = setup(nothing)
    await points.add(project, { title: 'Di Rossi', owner: 'Rossi' })
    const standup = held('standup', '2026-11-16T09:00:00.000Z', ['Mario Rossi <m@x.example>'])
    const old = new Date(NOW.getTime() - (CLOSING_WINDOW_DAYS + 1) * 24 * 60 * 60 * 1000)
    record([recorded('m-1', '2026-11-16T09:02:00.000Z'), recorded('m-0', old.toISOString())])
    const state = await closing.look(project, [standup])
    expect(state.register.points[0]?.check).toBeNull()
    expect(state.unread).toEqual(['m-1'])
    // A reading that finds nothing still marks the meeting as read.
    const closed = await closing.close(project, { held: [standup] })
    expect(closed.readMeetings).toEqual(['m-1'])
    expect(closed.points[0]).toMatchObject({ state: 'open', history: [] })
  })
})
