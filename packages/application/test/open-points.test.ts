import {
  DomainError,
  NO_OPEN_POINTS,
  OPEN_POINTS_FILE,
  type OpenPointRegister,
  type Project,
  type TodayItem,
} from '@octo/domain'
import { describe, expect, it } from 'vitest'
import { createOpenPoints } from '../src/index.ts'
import { memoryWriter } from './fakes.ts'

const project = { id: 'p-1', name: 'Aurora', folder: '/aurora' } as Project

function setup() {
  let register: OpenPointRegister = NO_OPEN_POINTS
  let saves = 0
  const writer = memoryWriter()
  const points = createOpenPoints({
    store: {
      load: async () => register,
      save: async (_folder, next) => {
        saves += 1
        register = next
      },
    },
    writer,
    clock: { now: () => new Date('2026-11-16T09:00:00.000Z') },
  })
  return { points, writer, saves: () => saves }
}

const codeOf = (promise: Promise<unknown>): Promise<string> =>
  promise.then(
    () => 'no failure',
    (error: unknown) => (error instanceof DomainError ? error.code : String(error)),
  )

describe('the register of the open points of a project', () => {
  it('opens, changes and closes points, and writes them as a text of the project', async () => {
    const { points, writer } = setup()
    expect(await points.register(project)).toEqual(NO_OPEN_POINTS)
    const first = await points.add(project, { title: 'Verbale del collaudo', owner: 'Rossi' })
    const id = first.points[0]?.id ?? ''
    expect(first.points[0]).toMatchObject({ origin: 'pm', openedOn: '2026-11-16', owner: 'Rossi' })
    expect(writer.files.get(OPEN_POINTS_FILE)).toContain('**Verbale del collaudo** — di Rossi')

    const fromSignal = await points.add(project, {
      title: 'Rispondi a Carla',
      signal: { key: 'mail:1', kind: 'mail_reply' },
    })
    expect(fromSignal.points[1]).toMatchObject({ origin: 'signal', signalKey: 'mail:1' })

    const due = await points.update(project, id, { due: '2026-11-20' })
    expect(due.points[0]?.due).toBe('2026-11-20')
    const closed = await points.update(project, id, { state: 'resolved' })
    expect(closed.points[0]).toMatchObject({ state: 'resolved', closedBy: 'pm' })
    expect(writer.files.get(OPEN_POINTS_FILE)).toContain('## Chiusi')
    // A point that waits for nothing takes the answer and stays as it is.
    expect((await points.confirm(project, id, true)).points[0]?.state).toBe('resolved')
  })

  it('refuses a point without a title, a point opened twice, and one it does not know', async () => {
    const { points } = setup()
    expect(await codeOf(points.add(project, { title: '  ' }))).toBe('open_point_invalid')
    const signal = { key: 'mail:1', kind: 'mail_reply' as const }
    await points.add(project, { title: 'Rispondi', signal })
    expect(await codeOf(points.add(project, { title: 'Rispondi', signal }))).toBe(
      'open_point_invalid',
    )
    expect(await codeOf(points.update(project, 'altro', { state: 'resolved' }))).toBe(
      'open_point_invalid',
    )
    expect(await codeOf(points.confirm(project, 'altro', true))).toBe('open_point_invalid')
  })

  it('closes a point when its signal goes away, and writes only then', async () => {
    const { points, saves } = setup()
    await points.add(project, { title: 'Rispondi', signal: { key: 'mail:1', kind: 'mail_reply' } })
    const there = [{ key: 'mail:1', facts: { kind: 'mail_reply' } } as TodayItem]
    const before = saves()
    expect((await points.settle(project, there, new Set())).points[0]?.state).toBe('open')
    expect(saves()).toBe(before)
    const settled = await points.settle(project, [], new Set())
    expect(settled.points[0]).toMatchObject({ state: 'resolved', closedBy: 'signal' })
    expect(saves()).toBe(before + 1)
    // What another use case worked out is kept and written the same way.
    const kept = await points.keep(project, { ...settled, closedDay: '2026-11-16' })
    expect((await points.register(project)).closedDay).toBe(kept.closedDay)
  })
})
