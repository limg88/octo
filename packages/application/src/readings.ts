import {
  DomainError,
  isDomainError,
  type Project,
  READING_LEASE_MS,
  type Reader,
  readingElsewhere,
  readingTurn,
  type SharedReading,
  type SourceRun,
  type SourceState,
  sameComputer,
  shownState,
} from '@octo/domain'
import type { Clock, ReadingName, SharedReadings, SourceStates, ThisReader } from './ports.ts'

export type ReadingsDeps = {
  /** What the folder of the project knows of its readings. */
  shared: SharedReadings
  /** What this computer did last. */
  states: SourceStates
  clock: Clock
  me: ThisReader
}

export type ReadingOptions = {
  /**
   * A reading another computer made less than this long ago stands for this one: nothing is
   * read. Absent, the source is read whatever its age: somebody asked.
   */
  maxAgeMs?: number
}

/** What a reading is given: where to go on from, and how to say how far it got. */
export type ReadingFrom = {
  cursor: string | null
  /** Saved at once: a reading that stops half way goes on from here, on any computer. */
  checkpoint(cursor: string | null): Promise<void>
}

export type ReadingCounts = Pick<SourceRun, 'written' | 'unchanged'>

/** What a reading gives back: what it wrote, and where the next one starts. */
export type ReadingResult = ReadingCounts & { cursor: string | null }

/** How a source takes its turn. */
export type ReadingKind = {
  source: ReadingName
  /**
   * True for what only this computer holds, as its mail and its meetings: where the next reading
   * starts is kept here, and a reading of another computer never stands for this one.
   */
  ownToComputer?: boolean
}

/** What the page of the sources shows of a source. */
export type ReadingView = {
  state: SourceState
  /** Who made the reading shown, when it was made from another computer. */
  readBy: Reader | null
  /** Who is reading the source from another computer right now. */
  readingBy: Reader | null
}

export type Readings = {
  /**
   * Reads a source in its turn and says how it went. One reading at a time for a source of a
   * project: on this computer (`source_busy`) and between the computers that share the folder
   * (`source_busy_elsewhere`). What went well is told to the folder; what failed stays here.
   * When a reading of another computer is fresh enough, that reading is given back as it is.
   */
  run(
    project: Project,
    kind: ReadingKind,
    options: ReadingOptions,
    read: (from: ReadingFrom) => Promise<ReadingResult>,
  ): Promise<SourceRun>
  /**
   * Does a piece of work that writes what a source brings while nobody else reads that source,
   * and lets its failures through.
   */
  exclusive<T>(project: Project, source: ReadingName, work: () => Promise<T>): Promise<T>
  /** Whether another computer is reading the source right now. */
  busyElsewhere(project: Project, source: ReadingName): Promise<boolean>
  view(project: Project, source: ReadingName): Promise<ReadingView>
}

export function createReadings(deps: ReadingsDeps): Readings {
  const running = new Set<string>()

  const leaseFrom = (now: Date) => ({
    by: deps.me(),
    until: new Date(now.getTime() + READING_LEASE_MS).toISOString(),
  })

  /** Frees the source for the other computers, keeping whatever the reading saved meanwhile. */
  async function release(project: Project, source: ReadingName): Promise<SharedReading> {
    const current = await deps.shared.get(project.folder, source)
    const freed = { ...current, lease: null }
    await deps.shared.set(project.folder, source, freed)
    return freed
  }

  async function begin(
    project: Project,
    source: ReadingName,
    now: Date,
    maxAgeMs: number | null,
  ): Promise<{ shared: SharedReading; turn: ReturnType<typeof readingTurn> }> {
    const shared = await deps.shared.get(project.folder, source)
    const turn = readingTurn(shared, deps.me(), now, maxAgeMs)
    if (turn !== 'read') return { shared, turn }
    const taken = { ...shared, lease: leaseFrom(now) }
    await deps.shared.set(project.folder, source, taken)
    return { shared: taken, turn }
  }

  async function run(
    project: Project,
    kind: ReadingKind,
    options: ReadingOptions,
    read: (from: ReadingFrom) => Promise<ReadingResult>,
  ): Promise<SourceRun> {
    const { source } = kind
    const own = kind.ownToComputer === true
    const key = `${project.id}/${source}`
    if (running.has(key)) throw new DomainError('source_busy', source)
    running.add(key)
    try {
      const now = deps.clock.now()
      const at = now.toISOString()
      const local = await deps.states.get(project.id, source)
      // What only this computer holds is never made fresh by the reading of another one.
      const maxAgeMs = own ? null : (options.maxAgeMs ?? null)
      const { shared, turn } = await begin(project, source, now, maxAgeMs)
      if (turn === 'busy_elsewhere') {
        throw new DomainError('source_busy_elsewhere', shared.lease?.by.name)
      }
      if (turn === 'fresh' && shared.lastRun) return shared.lastRun
      const from: ReadingFrom = {
        cursor: own ? local.cursor : shared.cursor,
        checkpoint: async (cursor) => {
          if (own) return deps.states.set(project.id, source, { ...local, cursor })
          const current = await deps.shared.get(project.folder, source)
          const lease = leaseFrom(deps.clock.now())
          await deps.shared.set(project.folder, source, { ...current, cursor, lease })
        },
      }
      try {
        const { cursor, ...counts } = await read(from)
        const done: SourceRun = { at, ...counts, error: null, by: deps.me() }
        await deps.shared.set(project.folder, source, {
          cursor: own ? null : cursor,
          lastRun: done,
          lease: null,
        })
        await deps.states.set(project.id, source, { cursor: own ? cursor : null, lastRun: done })
        return done
      } catch (error) {
        await release(project, source)
        if (!isDomainError(error)) throw error
        // What failed is of this computer: the folder keeps the last reading that went well.
        const failed: SourceRun = { at, written: 0, unchanged: 0, error: error.code, by: deps.me() }
        const before = await deps.states.get(project.id, source)
        await deps.states.set(project.id, source, { ...before, lastRun: failed })
        return failed
      }
    } finally {
      running.delete(key)
    }
  }

  async function exclusive<T>(
    project: Project,
    source: ReadingName,
    work: () => Promise<T>,
  ): Promise<T> {
    const key = `${project.id}/${source}`
    if (running.has(key)) throw new DomainError('source_busy', source)
    running.add(key)
    try {
      const { shared, turn } = await begin(project, source, deps.clock.now(), null)
      if (turn === 'busy_elsewhere') {
        throw new DomainError('source_busy_elsewhere', shared.lease?.by.name)
      }
      try {
        return await work()
      } finally {
        await release(project, source)
      }
    } finally {
      running.delete(key)
    }
  }

  return {
    run,
    exclusive,

    async busyElsewhere(project, source) {
      const shared = await deps.shared.get(project.folder, source)
      return readingElsewhere(shared, deps.me(), deps.clock.now()) !== null
    },

    async view(project, source) {
      const shared = await deps.shared.get(project.folder, source)
      const local = await deps.states.get(project.id, source)
      const state = shownState(local, shared)
      const by = state.lastRun?.by
      return {
        state,
        readBy: by !== undefined && !sameComputer(by, deps.me()) ? by : null,
        readingBy: readingElsewhere(shared, deps.me(), deps.clock.now()),
      }
    },
  }
}
