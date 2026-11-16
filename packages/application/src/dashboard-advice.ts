import {
  type CommentSentence,
  checkedComment,
  DomainError,
  type LiveSource,
  type ModelSettings,
  numbersIn,
  type Project,
} from '@octo/domain'
import type { Dashboard, DashboardRange, DashboardView } from './dashboard.ts'
import type { AgentProgress, Clock, TrackerAdvisor } from './ports.ts'

export type DashboardAdviceDeps = {
  dashboard: Pick<Dashboard, 'view' | 'settings'>
  advisor: TrackerAdvisor
  clock: Clock
  /** Who uses Octo, by name: who a reminder is written from. */
  author?: () => string | null
  models?: (project: Project) => Promise<ModelSettings>
  liveSources?: (project: Project) => Promise<LiveSource[]>
}

/** What Claude said of a period, with the reading and the period it is about. */
export type DashboardComment = {
  at: string
  /** The reading of the tracker the numbers came from. */
  exportedAt: string | null
  range: DashboardRange
  sentences: CommentSentence[]
  /** Sentences left out because they named an unknown item or a number of their own. */
  dropped: number
}

/** A reminder to copy: for an item, to a person. */
export type Reminder = { id: string; to: string | null; text: string }

export type AdviceInput = { onProgress?: (progress: AgentProgress) => void; signal?: AbortSignal }

export type DashboardAdvice = {
  /** Asks Claude what changed in the period and what worries; the numbers stay the code's. */
  comment(project: Project, range: DashboardRange, input?: AdviceInput): Promise<DashboardComment>
  /** Asks Claude a short reminder for an item whose last comment waits for an answer. */
  reminder(project: Project, id: string, input?: AdviceInput): Promise<Reminder>
}

/** How many single items Claude is told of for each list: enough to name the worst. */
export const ITEMS_TOLD = 10

/** The numbers of the page as Claude is given them: nothing it could not read on the page. */
export function figuresOf(view: DashboardView, range: DashboardRange, stuckDays: number) {
  const { bugs } = view
  const stuck = bugs.open.filter((row) => row.stuck)
  return {
    period: { from: range.from, to: range.to },
    trackerReadAt: view.exportedAt,
    stuckAfterDays: stuckDays,
    bugs: {
      inScope: bugs.total,
      now: {
        open: bugs.open.length,
        work: bugs.byPhase.work,
        verify: bugs.byPhase.verify,
        stuck: stuck.length,
        validated: bugs.validated.length,
      },
      atPeriodStart: bugs.before,
      trend: bugs.trend,
      trendIsEstimate: bugs.trendSource === 'approximate',
      medianDays: bugs.flow,
      medianDaysPeriodBefore: bugs.flowBefore,
      stuckLongest: stuck.slice(0, ITEMS_TOLD).map((row) => ({
        id: row.id,
        title: row.title,
        state: row.state,
        daysInState: row.daysInState,
        severity: row.severity,
        assignee: row.assignee,
      })),
    },
    sprint: view.sprint && {
      name: view.sprint.name,
      from: view.sprint.from,
      to: view.sprint.to,
      storiesByStage: view.sprint.byStage,
      bugsOpen: view.sprint.bugsOpen,
      bugsClosed: view.sprint.bugsClosed,
      ending: view.sprint.ending,
      atRisk: view.sprint.atRisk.slice(0, ITEMS_TOLD).map((row) => ({
        id: row.id,
        title: row.title,
        state: row.state,
      })),
    },
    waitingForAnAnswer: {
      count: view.waiting.length,
      fromClient: view.waiting.filter((row) => row.fromClient).length,
      longest: view.waiting.slice(0, ITEMS_TOLD).map((row) => ({
        id: row.id,
        title: row.title,
        workdays: row.workdays,
      })),
    },
    unclearRequirements: view.requirements.length,
  }
}

function knownIds(view: DashboardView): Set<string> {
  return new Set([
    ...view.bugs.open.map((row) => row.id),
    ...view.bugs.validated.map((row) => row.id),
    ...(view.sprint?.stories ?? []).map((row) => row.id),
    ...(view.sprint?.bugs ?? []).map((row) => row.id),
    ...view.waiting.map((row) => row.id),
    ...view.requirements.map((row) => row.id),
  ])
}

export function createDashboardAdvice(deps: DashboardAdviceDeps): DashboardAdvice {
  const context = async (project: Project, input: AdviceInput) => ({
    projectFolder: project.folder,
    model: (await deps.models?.(project))?.ask ?? null,
    liveSources: (await deps.liveSources?.(project)) ?? [],
    ...(input.onProgress ? { onProgress: input.onProgress } : {}),
    ...(input.signal ? { signal: input.signal } : {}),
  })

  return {
    async comment(project, range, input = {}) {
      const settings = await deps.dashboard.settings(project)
      const view = await deps.dashboard.view(project, range)
      const figures = figuresOf(view, range, settings.stuckDays)
      const proposed = await deps.advisor.comment({ ...(await context(project, input)), figures })
      const sentences = checkedComment(proposed, numbersIn(figures), knownIds(view))
      return {
        at: deps.clock.now().toISOString(),
        exportedAt: view.exportedAt,
        range,
        sentences,
        dropped:
          proposed.filter((sentence) => sentence.text.trim() !== '').length - sentences.length,
      }
    },

    async reminder(project, id, input = {}) {
      const now = deps.clock.now()
      // The period does not matter here: the items that wait are those of the reading.
      const day = now.toISOString().slice(0, 10)
      const view = await deps.dashboard.view(project, { from: day, to: day, granularity: 'week' })
      const row = view.waiting.find((candidate) => candidate.id === id)
      if (!row) throw new DomainError('tracker_item_not_waiting', id)
      const { fromClient: _fromClient, ...item } = row
      const proposed = await deps.advisor.reminder({
        ...(await context(project, input)),
        item,
        from: deps.author?.() ?? null,
      })
      const text = proposed.text.trim()
      if (text === '') throw new DomainError('agent_output_invalid', 'reminder')
      return { id, to: proposed.to?.trim() || null, text }
    },
  }
}
