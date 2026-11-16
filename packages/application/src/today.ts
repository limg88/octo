import {
  alignmentItems,
  applyDecisions,
  bugItems,
  calendarItems,
  checkCitation,
  cleanTodaySettings,
  DECISION_STATES,
  type DecisionState,
  DomainError,
  draftItems,
  FEED_NAMES,
  feedLabel,
  forecastItems,
  hoursItems,
  type Identity,
  identityAddresses,
  isDomainError,
  type LiveSource,
  type MailJudgement,
  type MailThreads,
  type MailTurn,
  type ModelSettings,
  mailItems,
  mailThreads,
  mailTurnsOf,
  meetingItems,
  meetingsOn,
  monthDueItems,
  monthOf,
  monthPeriod,
  ownPeopleKeys,
  type Project,
  parseMailDocument,
  previousMonth,
  RISK_PROPOSAL_DAYS,
  requirementItems,
  riskItems,
  romeDateString,
  type SourceReading,
  type StoredMail,
  sourceItems,
  TODAY_BANDS,
  type TodayBand,
  type TodayFreshness,
  type TodayItem,
  type TodayKind,
  trackerAgeItems,
  unassignedMeetingItems,
  withDecision,
  withMailTurn,
  withoutDecision,
} from '@octo/domain'
import type { Alignments } from './alignment.ts'
import type { Dashboard } from './dashboard.ts'
import type { Deliverables } from './deliverables.ts'
import type { Feeds } from './feeds.ts'
import { FORECAST_FOLDER, type Forecasts } from './forecast.ts'
import type { Hours } from './hours.ts'
import type { Meetings } from './meetings.ts'
import type {
  AgentProgress,
  Clock,
  EvidenceReader,
  ProjectFiles,
  TodayEvaluation,
  TodayJudge,
  TodayStore,
} from './ports.ts'
import type { Risks } from './risks.ts'
import type { Sources } from './sources.ts'
import type { Team } from './team.ts'

export type TodayDeps = {
  hours: Pick<Hours, 'view'>
  forecasts: Pick<Forecasts, 'view'>
  dashboard: Pick<Dashboard, 'view' | 'settings'>
  alignments: Pick<Alignments, 'view' | 'settings'>
  deliverables: Pick<Deliverables, 'list'>
  sources: Pick<Sources, 'mail'>
  feeds: Pick<Feeds, 'view'>
  /** With the meetings, those recorded that no project could be told for wait on the page. */
  meetings?: Pick<Meetings, 'view' | 'unassigned'>
  team: Pick<Team, 'get'>
  risks: Pick<Risks, 'register' | 'propose'>
  files: Pick<ProjectFiles, 'under' | 'readText'>
  store: TodayStore
  judge: TodayJudge
  evidence: EvidenceReader
  clock: Clock
  /** Who uses Octo: the mail written to them is the mail that waits for them. */
  identity: () => Identity | null
  models?: (project: Project) => Promise<ModelSettings>
  liveSources?: (project: Project) => Promise<LiveSource[]>
}

/** What the page of the day shows for a project. */
export type TodayView = {
  /** The day the page is about, `YYYY-MM-DD`, in Italy. */
  day: string
  /** The signals after the PM's decisions, in the order of the page. */
  items: TodayItem[]
  /** Signals the PM put away and that stay away today. */
  hidden: number
  muteOffers: TodayKind[]
  mutedKinds: TodayKind[]
  freshness: TodayFreshness[]
  /** When Claude last judged and with which model; the judgements sit on the mail signals. */
  evaluation: { at: string | null; model: string | null }
  /** True when a mail waits that Claude has not judged and no judgement was given today. */
  evaluationDue: boolean
  /** The addresses Octo takes as the PM's: those of the sign-in and those added by hand. */
  ownAddresses: string[]
  /** The addresses added by hand, as they are kept. */
  addedAddresses: string[]
}

export type DecideInput = {
  key: string
  /** `open` forgets what was decided: the signal is shown again. */
  state: DecisionState | 'open'
  until?: string | null
}

export type EvaluateInput = {
  /** Judges again also the mail already judged. */
  all?: boolean
  onProgress?: (progress: AgentProgress) => void
  signal?: AbortSignal
}

/** A project in the page of all the projects: how much waits, and what comes first. */
export type ProjectOverview = {
  project: Project
  counts: Record<TodayBand, number>
  first: TodayItem[]
  evaluatedAt: string | null
  /** True when the page of the project could not be computed at all. */
  failed: boolean
}

export type Today = {
  view(project: Project): Promise<TodayView>
  decide(project: Project, input: DecideInput): Promise<TodayView>
  muteKind(project: Project, kind: TodayKind, muted: boolean): Promise<TodayView>
  /**
   * Keeps the PM's word on whose turn the conversation of a mail signal is: theirs to answer, or
   * not theirs. Null takes the word back: the code and Claude decide again.
   */
  mailTurn(project: Project, key: string, turn: MailTurn | null): Promise<TodayView>
  saveAddresses(project: Project, addresses: readonly string[]): Promise<TodayView>
  /** Asks Claude to weigh the mail that waits; once a week also for the risks. */
  evaluate(project: Project, input?: EvaluateInput): Promise<TodayView>
  /** Every project in brief, from what the code computes: Claude is never asked. */
  overview(projects: readonly Project[]): Promise<ProjectOverview[]>
}

const DAY_MS = 24 * 60 * 60 * 1000
const WEEK_MS = 7 * DAY_MS
/** How far back the bugs' trend is asked: the page only needs the bugs open now. */
const TREND_WEEKS = 8
/** The signals of a project shown in the page of all the projects. */
export const OVERVIEW_ITEMS = 3
/** The meetings as the page of the day names their source. */
export const MEETINGS_SOURCE = 'Riunioni (Verbale)'
const DAY = /^\d{4}-\d{2}-\d{2}$/
const dayOf = (instant: Date): string => instant.toISOString().slice(0, 10)

/** What a section computes, or nothing when the section is not set up or cannot be read now. */
async function attempt<T>(compute: () => Promise<T[]>): Promise<T[]> {
  try {
    return await compute()
  } catch (error) {
    if (!isDomainError(error)) throw error
    return []
  }
}

export function createToday(deps: TodayDeps): Today {
  const evaluating = new Set<string>()

  async function readings(project: Project): Promise<SourceReading[]> {
    const found: SourceReading[] = []
    const mail = await deps.sources.mail(project)
    if (mail.config) found.push({ source: 'Posta', state: mail.state, hasSecret: true })
    const meetings = await deps.meetings?.view(project)
    if (meetings?.config) {
      found.push({ source: MEETINGS_SOURCE, state: meetings.state, hasSecret: true })
    }
    for (const feed of FEED_NAMES) {
      const view = await deps.feeds.view(project, feed)
      if (view.config) {
        found.push({ source: feedLabel(feed), state: view.state, hasSecret: view.hasSecret })
      }
    }
    return found
  }

  /** The mail of the project of this month and of the one before: older mail waits for nobody. */
  async function recentMail(project: Project, today: string): Promise<StoredMail[]> {
    const folder = (await deps.sources.mail(project)).config?.targetFolder
    if (!folder) return []
    const months = [previousMonth(today), monthOf(today)]
    const mails: StoredMail[] = []
    for (const month of months) {
      for (const path of await deps.files.under(project.folder, `${folder}/${month}`)) {
        const content = await deps.files.readText(project.folder, path)
        const mail = content === null ? null : parseMailDocument(path, content)
        if (mail) mails.push(mail)
      }
    }
    return mails
  }

  async function tracker(project: Project, now: Date) {
    const settings = await deps.dashboard.settings(project)
    const view = await deps.dashboard.view(project, {
      from: dayOf(new Date(now.getTime() - TREND_WEEKS * WEEK_MS)),
      to: dayOf(now),
      granularity: 'week',
    })
    return { settings, view }
  }

  async function compute(project: Project) {
    const now = deps.clock.now()
    const today = romeDateString(now)
    const tomorrow = dayOf(new Date(Date.parse(`${today}T00:00:00.000Z`) + DAY_MS))
    const lastMonth = previousMonth(today)
    const settings = await deps.store.load(project.folder)
    const evaluation = await deps.store.loadEvaluation(project.folder)
    const own = [...new Set([...identityAddresses(deps.identity()), ...settings.ownAddresses])]
    const freshness: TodayFreshness[] = []

    const sources = await readings(project)
    for (const { source, state } of sources) {
      const ok = state.lastRun && state.lastRun.error === null
      freshness.push({ source, readAt: ok ? (state.lastRun?.at ?? null) : null })
    }
    const team = await deps.team.get(project).catch(() => ({ people: [], periods: [] }))
    const mails = await attempt(() => recentMail(project, today))
    const threads = mailThreads(mails, own, now, ownPeopleKeys(team))

    const groups = await Promise.all([
      Promise.resolve(sourceItems(sources, now)),
      attempt(async () => {
        const { settings: dashboard, view } = await tracker(project, now)
        freshness.push({ source: 'Tracker del cliente', readAt: view.exportedAt })
        return [
          ...trackerAgeItems(view.exportedAt, view.age, now),
          ...bugItems(view.bugs.open, dashboard.stuckDays, view.exportedAt),
          ...requirementItems(view.requirements, view.exportedAt),
        ]
      }),
      attempt(async () => {
        const view = await deps.hours.view(project, monthPeriod(lastMonth))
        return hoursItems(lastMonth, view.reconciliation, today)
      }),
      attempt(async () => {
        const { forecast } = await deps.forecasts.view(project, lastMonth)
        const written = await deps.files.under(project.folder, `${FORECAST_FOLDER}/${lastMonth}`)
        return [
          ...forecastItems(forecast, today),
          ...monthDueItems(lastMonth, written.length > 0, today),
        ]
      }),
      attempt(async () => {
        const { sprint } = await deps.alignments.settings(project)
        const view = await deps.alignments.view(project)
        return alignmentItems(sprint, view.alignment, view.exportedAt, team, today)
      }),
      attempt(async () => draftItems(await deps.deliverables.list(project), now)),
      Promise.resolve(calendarItems(team, today)),
      Promise.resolve(mailItems(threads, evaluation.mails, now, tomorrow, mailTurnsOf(settings))),
      Promise.resolve(meetingItems(meetingsOn(mails, today, romeDateString))),
      attempt(async () => riskItems(await deps.risks.register(project))),
      attempt(async () =>
        unassignedMeetingItems((await deps.meetings?.unassigned(project)) ?? [], now),
      ),
    ])
    const page = applyDecisions(groups.flat(), settings, today)
    // A judgement given before Claude was asked whom a mail is for says only how much it matters.
    const unjudged = threads.awaitingMe.filter(
      (mail) => evaluation.mails[mail.id]?.addressee === undefined,
    )
    const judgedToday = evaluation.at !== null && romeDateString(new Date(evaluation.at)) === today
    return { today, settings, evaluation, threads, unjudged, judgedToday, page, freshness, own }
  }

  async function view(project: Project): Promise<TodayView> {
    const computed = await compute(project)
    const visible = new Set(
      computed.page.items.flatMap((item) =>
        item.facts.kind === 'mail_reply' || item.facts.kind === 'mail_follow'
          ? [item.facts.id]
          : [],
      ),
    )
    return {
      day: computed.today,
      items: computed.page.items,
      hidden: computed.page.hidden,
      muteOffers: computed.page.muteOffers,
      mutedKinds: computed.settings.mutedKinds,
      freshness: computed.freshness,
      evaluation: { at: computed.evaluation.at, model: computed.evaluation.model },
      // A mail the PM put away is not worth a run of Claude.
      evaluationDue:
        !computed.judgedToday && computed.unjudged.some((mail) => visible.has(mail.id)),
      ownAddresses: computed.own,
      addedAddresses: computed.settings.ownAddresses,
    }
  }

  async function risksDue(project: Project, now: Date): Promise<boolean> {
    const register = await deps.risks.register(project)
    if (register.proposedAt === null) return true
    return now.getTime() - Date.parse(register.proposedAt) >= RISK_PROPOSAL_DAYS * DAY_MS
  }

  async function judgeMails(
    project: Project,
    mails: readonly StoredMail[],
    evaluation: TodayEvaluation,
    input: EvaluateInput,
    asked: { threads: MailThreads; own: readonly string[] },
  ): Promise<TodayEvaluation> {
    let model: string | null = evaluation.model
    const proposed = await deps.judge.mails({
      projectFolder: project.folder,
      mails: mails.map((mail) => ({
        id: mail.id,
        path: mail.path,
        subject: mail.subject,
        to: mail.to,
        mails: asked.threads.waiting[mail.id]?.mails ?? 1,
      })),
      // Whom a mail asks something of is told for this person: their name and their addresses.
      pm: { name: deps.identity()?.name ?? null, addresses: asked.own },
      model: (await deps.models?.(project))?.ask ?? null,
      liveSources: (await deps.liveSources?.(project)) ?? [],
      onModel: (used) => {
        model = used
      },
      ...(input.onProgress ? { onProgress: input.onProgress } : {}),
      ...(input.signal ? { signal: input.signal } : {}),
    })
    const byId = new Map(mails.map((mail) => [mail.id, mail]))
    const judged: Record<string, MailJudgement> = { ...evaluation.mails }
    for (const judgement of proposed) {
      const mail = byId.get(judgement.id)
      if (!mail) continue
      // The model proposes, the code checks: the quote is looked for in the mail itself.
      const citation = { n: 1, path: mail.path, quote: judgement.quote }
      const found = checkCitation(citation, await deps.evidence.read(project.folder, mail.path))
      judged[mail.id] = {
        importance: judgement.importance,
        reason: judgement.reason.trim(),
        quote: judgement.quote,
        quoteVerified: found.status === 'verified',
        deadline:
          judgement.deadline !== null && DAY.test(judgement.deadline) ? judgement.deadline : null,
        ...(judgement.addressee
          ? {
              addressee: judgement.addressee,
              addresseeName: judgement.addresseeName?.trim() || null,
            }
          : {}),
      }
    }
    return { at: deps.clock.now().toISOString(), model, mails: judged }
  }

  return {
    view,

    async decide(project, input) {
      const { page, settings, today } = await compute(project)
      if (input.state === 'open') {
        await deps.store.save(project.folder, withoutDecision(settings, input.key))
        return view(project)
      }
      if (!DECISION_STATES.includes(input.state)) throw new DomainError('today_decision_invalid')
      const until = input.until ?? null
      if (input.state === 'later' && (until === null || !DAY.test(until) || until <= today)) {
        throw new DomainError('today_decision_invalid', 'until')
      }
      const item = page.items.find((candidate) => candidate.key === input.key)
      if (!item) throw new DomainError('today_decision_invalid', input.key)
      const decision = {
        key: item.key,
        kind: item.facts.kind,
        state: input.state,
        at: today,
        until: input.state === 'later' ? until : null,
        weight: item.weight,
      }
      await deps.store.save(project.folder, withDecision(settings, decision))
      return view(project)
    },

    async mailTurn(project, key, turn) {
      const { page, settings, today } = await compute(project)
      const item = page.items.find((candidate) => candidate.key === key)
      const conversation =
        item && (item.facts.kind === 'mail_reply' || item.facts.kind === 'mail_follow')
          ? item.facts.conversation
          : undefined
      if (conversation === undefined) throw new DomainError('today_decision_invalid', key)
      await deps.store.save(project.folder, withMailTurn(settings, conversation, turn, today))
      return view(project)
    },

    async muteKind(project, kind, muted) {
      const settings = await deps.store.load(project.folder)
      const others = settings.mutedKinds.filter((kept) => kept !== kind)
      await deps.store.save(project.folder, {
        ...settings,
        mutedKinds: muted ? [...others, kind] : others,
      })
      return view(project)
    },

    async saveAddresses(project, addresses) {
      const settings = await deps.store.load(project.folder)
      await deps.store.save(
        project.folder,
        cleanTodaySettings({ ...settings, ownAddresses: [...addresses] }),
      )
      return view(project)
    },

    async evaluate(project, input = {}) {
      if (evaluating.has(project.id)) throw new DomainError('source_busy', 'today')
      evaluating.add(project.id)
      try {
        const { threads, unjudged, evaluation, own } = await compute(project)
        const mails = input.all ? threads.awaitingMe : unjudged
        // With nothing to weigh the run is skipped, but the day is marked as judged.
        const next =
          mails.length > 0
            ? await judgeMails(project, mails, evaluation, input, { threads, own })
            : { ...evaluation, at: deps.clock.now().toISOString() }
        // Judgements of mail that no longer waits are dropped: the file does not grow for ever.
        const waiting = new Set(threads.awaitingMe.map((mail) => mail.id))
        const kept = Object.fromEntries(
          Object.entries(next.mails).filter(([id]) => waiting.has(id)),
        )
        await deps.store.saveEvaluation(project.folder, { ...next, mails: kept })
        if (await risksDue(project, deps.clock.now())) {
          // The risks are a second question: when it fails, the mail judged stays judged.
          await deps.risks.propose(project, input).catch((error: unknown) => {
            if (!isDomainError(error)) throw error
          })
        }
        return await view(project)
      } finally {
        evaluating.delete(project.id)
      }
    },

    async overview(projects) {
      const rows: ProjectOverview[] = []
      for (const project of projects) {
        const counts = Object.fromEntries(TODAY_BANDS.map((band) => [band, 0])) as Record<
          TodayBand,
          number
        >
        try {
          const page = await view(project)
          for (const item of page.items) counts[item.band] += 1
          rows.push({
            project,
            counts,
            first: page.items.slice(0, OVERVIEW_ITEMS),
            evaluatedAt: page.evaluation.at,
            failed: false,
          })
        } catch (error) {
          if (!isDomainError(error)) throw error
          rows.push({ project, counts, first: [], evaluatedAt: null, failed: true })
        }
      }
      return rows
    },
  }
}
