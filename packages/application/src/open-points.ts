import {
  addOpenPoint,
  answerPointCheck,
  DomainError,
  type NewOpenPoint,
  OPEN_POINTS_FILE,
  type OpenPointChange,
  type OpenPointRegister,
  openPointsMarkdown,
  type Project,
  romeDateString,
  settleBySignals,
  type TodayItem,
  type TodayKind,
  updateOpenPoint,
} from '@octo/domain'
import type { Clock, MemoryWriter, OpenPointStore } from './ports.ts'

export type OpenPointsDeps = {
  store: OpenPointStore
  writer: Pick<MemoryWriter, 'claim' | 'write'>
  clock: Clock
}

/** What the PM writes to open a point by hand, or from a signal of the page. */
export type OpenPointInput = Pick<NewOpenPoint, 'title' | 'owner' | 'due' | 'signal' | 'meeting'>

export type OpenPoints = {
  register(project: Project): Promise<OpenPointRegister>
  add(project: Project, input: OpenPointInput): Promise<OpenPointRegister>
  update(project: Project, pointId: string, change: OpenPointChange): Promise<OpenPointRegister>
  /** The PM's answer to what a point waits for: closed, or still in the queue. */
  confirm(project: Project, pointId: string, resolved: boolean): Promise<OpenPointRegister>
  /** Closes the points whose signal went away; the register is written only when one did. */
  settle(
    project: Project,
    items: readonly TodayItem[],
    unsettled: ReadonlySet<TodayKind>,
  ): Promise<OpenPointRegister>
  /** Keeps a register another use case worked out, and writes it as a text of the project. */
  keep(project: Project, register: OpenPointRegister): Promise<OpenPointRegister>
}

/**
 * The register of the open points of a project: what the PM has to close or have closed, kept
 * from a day to the next and written as a text of the project that answers and deliverables cite.
 */
export function createOpenPoints(deps: OpenPointsDeps): OpenPoints {
  async function keep(project: Project, register: OpenPointRegister): Promise<OpenPointRegister> {
    await deps.store.save(project.folder, register)
    await deps.writer.claim(project.folder)
    await deps.writer.write(project.folder, OPEN_POINTS_FILE, openPointsMarkdown(register))
    return register
  }

  const today = (): string => romeDateString(deps.clock.now())

  async function known(project: Project, pointId: string): Promise<OpenPointRegister> {
    const register = await deps.store.load(project.folder)
    if (!register.points.some((point) => point.id === pointId)) {
      throw new DomainError('open_point_invalid', pointId)
    }
    return register
  }

  return {
    register: (project) => deps.store.load(project.folder),
    keep,

    async add(project, input) {
      const register = await deps.store.load(project.folder)
      const origin = input.signal ? 'signal' : 'pm'
      const next = addOpenPoint(register, { ...input, origin }, today())
      if (next === register) throw new DomainError('open_point_invalid', 'title')
      return keep(project, next)
    },

    async update(project, pointId, change) {
      return keep(project, updateOpenPoint(await known(project, pointId), pointId, change, today()))
    },

    async confirm(project, pointId, resolved) {
      const register = await known(project, pointId)
      return keep(project, answerPointCheck(register, pointId, resolved, today()))
    },

    async settle(project, items, unsettled) {
      const register = await deps.store.load(project.folder)
      const next = settleBySignals(register, items, unsettled, today())
      return next === register ? register : keep(project, next)
    },
  }
}
