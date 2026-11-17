import {
  alignmentItems,
  applyDecisions,
  bugItems,
  calendarItems,
  checkCitation,
  cleanTodaySettings,
  type DayMeeting,
  DECISION_STATES,
  type DecisionState,
  DomainError,
  draftItems,
  FEED_NAMES,
  feedLabel,
  forecastItems,
  type HiddenItem,
  hoursItems,
  type Identity,
  identityAddresses,
  isDomainError,
  isMonthClosing,
  isSprintEnding,
  type LiveSource,
  lastRecordingOf,
  MAX_MEETINGS_PER_PREP,
  MAX_PREP_NOTES,
  type MailJudgement,
  type MailThreads,
  type MailTurn,
  type MeetingPrep,
  type ModelSettings,
  mailItems,
  mailThreads,
  mailTurnsOf,
  marksOf,
  meetingItems,
  meetingKey,
  meetingPrep,
  meetingsOn,
  monthDueItems,
  monthOf,
  monthPeriod,
  NO_OPEN_POINTS,
  type NowItem,
  nextWorkday,
  nowItems,
  ownPeopleKeys,
  type PointBrief,
  type PrepNote,
  type Project,
  parseMailDocument,
  pointBrief,
  pointsCount,
  previousMonth,
  previousWorkday,
  RISK_PROPOSAL_DAYS,
  type Risk,
  reconcileSignals,
  requirementItems,
  riskItems,
  romeDateString,
  type SourceReading,
  type StoredMail,
  type StoredMeeting,
  sourceItems,
  sprintEnd,
  TODAY_BANDS,
  type TodayBand,
  type TodayFreshness,
  type TodayItem,
  type TodayKind,
  type TodayMark,
  type TodaySettings,
  todayCount,
  trackerAgeItems,
  trackerSourceName,
  unassignedMeetingItems,
  type WeekView,
  weekItems,
  withDecision,
  withMailTurn,
  withoutDecision,
  withVisit,
} from '@octo/domain'
import type { Alignments } from './alignment.ts'
import type { Dashboard } from './dashboard.ts'
import { type DayClosing, MEETING_FILES_TO_READ } from './day-closing.ts'
import type { Deliverables } from './deliverables.ts'
import type { Feeds } from './feeds.ts'
import { FORECAST_FOLDER, type Forecasts } from './forecast.ts'
import type { Hours } from './hours.ts'
import type { Meetings } from './meetings.ts'
import type { OpenPoints } from './open-points.ts'
import type {
  AgentProgress,
  Clock,
  EvidenceReader,
  MeetingReader,
  NowSentence,
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
  meetings?: Pick<Meetings, 'view' | 'unassigned' | 'imported'>
  /** With who reads the meetings, Claude adds to each card of the day what to bring. */
  reader?: Pick<MeetingReader, 'prep'>
  team: Pick<Team, 'get'>
  risks: Pick<Risks, 'register' | 'propose'>
  /** With the open points, the page opens on what was left open the day before. */
  points?: Pick<OpenPoints, 'settle'>
  /** With the closing of the day, the recorded meetings close points and open new ones. */
  closing?: DayClosing
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
  /** The meetings of the day and of the next working day, as the invitations tell them. */
  agenda: TodayAgenda
  /** The open points: what is in the queue, what was closed since the working day before. */
  points: PointBrief
  /** What to take to each meeting of today, in the order of the agenda. */
  prep: MeetingPrep[]
  /** The closing of the day: whether recorded meetings wait to be read, and when Claude last did. */
  closing: TodayClosing
  /** The critical things of the week: what is to put right, and what is coming. */
  week: WeekView
  /** Those of them that come first now, each with the rule that says why. */
  now: NowItem[]
  /**
   * Why they matter today, as Claude wrote it when it was asked today: only the sentences whose
   * quote the code found, and only on signals that still come first.
   */
  nowSummary: NowSentence[]
  /** Signals the PM put away and that stay away today. */
  hidden: number
  /** Those of them a decision keeps away, each with its decision: read, and taken back. */
  hiddenItems: HiddenItem[]
  /** The signals that are new or got worse since the PM last looked at the page, by key. */
  marks: Record<string, TodayMark>
  /** How many things the page asks of the PM today: beside its name in the sidebar. */
  count: number
  /** Whether the system tells the PM when a signal comes first. */
  notify: boolean
  /** The kinds of the signals that went away by themselves today, one for each signal. */
  resolvedToday: TodayKind[]
  /** The last day of the sprint the project is set on, when it is still to come. */
  sprintEnd: string | null
  muteOffers: TodayKind[]
  mutedKinds: TodayKind[]
  freshness: TodayFreshness[]
  /** When Claude last judged and with which model; the judgements sit on the mail signals. */
  evaluation: { at: string | null; model: string | null }
  /**
   * True when nothing was judged today and there is something to ask Claude: a mail that waits
   * and it has not read, or signals that come first and it has not said why.
   */
  evaluationDue: boolean
  /** The addresses Octo takes as the PM's: those of the sign-in and those added by hand. */
  ownAddresses: string[]
  /** The addresses added by hand, as they are kept. */
  addedAddresses: string[]
}

/** The meetings the PM prepares: those of today, and those of the next working day. */
export type TodayAgenda = {
  today: DayMeeting[]
  next: { day: string; meetings: DayMeeting[] }
}

/** What the page says of the closing of the day. */
export type TodayClosing = {
  /** How many recorded meetings Claude has not read yet. */
  unread: number
  /** What tells this wait from another: the page asks Claude once for each. */
  key: string
  /** When Claude last read the meetings, and with which model; null when never. */
  at: string | null
  model: string | null
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
  /** The PM looked at the page: what is on it now is no longer new the next time. */
  visited(project: Project): Promise<void>
  /** Whether the system tells the PM when a signal comes first. */
  setNotify(project: Project, notify: boolean): Promise<TodayView>
  /** Asks Claude to weigh the mail that waits; once a week also for the risks. */
  evaluate(project: Project, input?: EvaluateInput): Promise<TodayView>
  /** Asks Claude what the recorded meetings not yet read did to the open points. */
  closeDay(project: Project, input?: Omit<EvaluateInput, 'all'>): Promise<TodayView>
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
/** The last recording of the series of a meeting, with its files that are there. */
type LastFiles = (StoredMeeting & { files: string[] }) | null
const NOTHING = (): void => {}

/** How far back an invitation is looked for: a series called longer ago is called again. */
export const INVITE_MONTHS = 12
const DAY = /^\d{4}-\d{2}-\d{2}$/
const dayOf = (instant: Date): string => instant.toISOString().slice(0, 10)

/** The kinds of signal each section of the page tells: unread, none of them is told gone. */
const MAIL_KINDS: readonly TodayKind[] = ['mail_reply', 'mail_follow', 'mail_waiting', 'meeting']
const MEETING_KINDS: readonly TodayKind[] = ['meeting']
const TRACKER_KINDS: readonly TodayKind[] = ['tracker_old', 'bugs_stuck', 'requirements']
const HOURS_KINDS: readonly TodayKind[] = ['hours']
const FORECAST_KINDS: readonly TodayKind[] = ['forecast', 'month_due']
const ALIGNMENT_KINDS: readonly TodayKind[] = ['alignment']
const DRAFT_KINDS: readonly TodayKind[] = ['draft']
const RISK_KINDS: readonly TodayKind[] = ['risk', 'risk_candidates']
const UNASSIGNED_KINDS: readonly TodayKind[] = ['meeting_unassigned']
/** The kinds told only while the sprint ends, and only while the month is being closed. */
const SPRINT_END_KINDS: readonly TodayKind[] = ['requirements', 'alignment']
const MONTH_CLOSING_KINDS: readonly TodayKind[] = ['month_due']

/**
 * What a section computes, or nothing when the section is not set up or cannot be read now:
 * then `onUnread` is told, so that nobody takes its signals for gone.
 */
async function attempt<T>(compute: () => Promise<T[]>, onUnread: () => void): Promise<T[]> {
  try {
    return await compute()
  } catch (error) {
    if (!isDomainError(error)) throw error
    onUnread()
    return []
  }
}

/** What a project shows in brief: what comes first now, then the page in its order. */
function firstOf(page: TodayView): TodayItem[] {
  const first = page.now.map((entry) => entry.item)
  const keys = new Set(first.map((item) => item.key))
  return [...first, ...page.items.filter((item) => !keys.has(item.key))].slice(0, OVERVIEW_ITEMS)
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

  /**
   * The invitations older than the mail that can still wait for somebody: a meeting that repeats
   * is invited once, months before the day it is held.
   */
  async function olderInvites(project: Project, today: string): Promise<StoredMail[]> {
    const folder = (await deps.sources.mail(project)).config?.targetFolder
    if (!folder) return []
    const invites: StoredMail[] = []
    let month = previousMonth(today)
    for (let back = 2; back <= INVITE_MONTHS; back += 1) {
      month = previousMonth(`${month}-01`)
      for (const path of await deps.files.under(project.folder, `${folder}/${month}`)) {
        const content = await deps.files.readText(project.folder, path)
        const mail = content === null ? null : parseMailDocument(path, content)
        if (mail?.meeting) invites.push(mail)
      }
    }
    return invites
  }

  /** The files of a recorded meeting that are there, the shortest first. */
  async function textsOf(project: Project, folder: string): Promise<string[]> {
    const files: string[] = []
    for (const name of MEETING_FILES_TO_READ) {
      const path = `${folder}/${name}`
      if ((await deps.files.readText(project.folder, path)) !== null) files.push(path)
    }
    return files
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
    const saved = await deps.store.load(project.folder)
    const evaluation = await deps.store.loadEvaluation(project.folder)
    const own = [...new Set([...identityAddresses(deps.identity()), ...saved.ownAddresses])]
    const freshness: TodayFreshness[] = []

    const sources = await readings(project)
    for (const { source, state } of sources) {
      const ok = state.lastRun && state.lastRun.error === null
      freshness.push({ source, readAt: ok ? (state.lastRun?.at ?? null) : null })
    }
    const team = await deps.team.get(project).catch(() => ({ people: [], periods: [] }))
    /** The kinds that cannot be told now: what is missing of them did not go away. */
    const unsettled = new Set<TodayKind>()
    const unread = (kinds: readonly TodayKind[]) => () => {
      for (const kind of kinds) unsettled.add(kind)
    }
    const mails = await attempt(() => recentMail(project, today), unread(MAIL_KINDS))
    const threads = mailThreads(mails, own, now, ownPeopleKeys(team))
    const invites = [
      ...(await attempt(() => olderInvites(project, today), unread(MEETING_KINDS))),
      ...mails,
    ]
    const nextDay = nextWorkday(today)
    const agenda: TodayAgenda = {
      today: meetingsOn(invites, today),
      next: { day: nextDay, meetings: meetingsOn(invites, nextDay) },
    }
    const sprint = await deps.alignments
      .settings(project)
      .then((alignment) => alignment.sprint)
      .catch((error: unknown) => {
        if (!isDomainError(error)) throw error
        return ''
      })
    const sprintEnding = isSprintEnding(sprint, team, today)
    if (!sprintEnding) unread(SPRINT_END_KINDS)()
    if (!isMonthClosing(today)) unread(MONTH_CLOSING_KINDS)()
    const lastDay = sprintEnd(sprint, team)

    const openRisks: Risk[] = []
    const groups = await Promise.all([
      Promise.resolve(sourceItems(sources, now)),
      attempt(async () => {
        const { settings: dashboard, view } = await tracker(project, now)
        freshness.push({ source: trackerSourceName(view.tracker), readAt: view.exportedAt })
        return [
          ...trackerAgeItems(view.exportedAt, view.age, now),
          ...bugItems(view.bugs.open, dashboard.stuckDays, view.exportedAt),
          ...requirementItems(view.requirements, view.exportedAt, sprintEnding),
        ]
      }, unread(TRACKER_KINDS)),
      attempt(async () => {
        const view = await deps.hours.view(project, monthPeriod(lastMonth))
        return hoursItems(lastMonth, view.reconciliation, today)
      }, unread(HOURS_KINDS)),
      attempt(async () => {
        const { forecast } = await deps.forecasts.view(project, lastMonth)
        const written = await deps.files.under(project.folder, `${FORECAST_FOLDER}/${lastMonth}`)
        return [
          ...forecastItems(forecast, today),
          ...monthDueItems(lastMonth, written.length > 0, today),
        ]
      }, unread(FORECAST_KINDS)),
      attempt(async () => {
        const view = await deps.alignments.view(project)
        return alignmentItems(sprint, view.alignment, view.exportedAt, team, today)
      }, unread(ALIGNMENT_KINDS)),
      attempt(
        async () => draftItems(await deps.deliverables.list(project), now),
        unread(DRAFT_KINDS),
      ),
      Promise.resolve(calendarItems(team, today)),
      Promise.resolve(meetingItems(agenda.today)),
      attempt(async () => {
        const risks = await deps.risks.register(project)
        openRisks.push(...risks.risks)
        return riskItems(risks)
      }, unread(RISK_KINDS)),
      attempt(
        async () => unassignedMeetingItems((await deps.meetings?.unassigned(project)) ?? [], now),
        unread(UNASSIGNED_KINDS),
      ),
    ])
    const computed = groups.flat()
    /** The signals of the day under some settings: only the mail depends on the PM's word. */
    const signalsFor = (kept: TodaySettings): TodayItem[] => [
      ...computed,
      ...mailItems(threads, evaluation.mails, now, tomorrow, mailTurnsOf(kept)),
    ]
    const pageFor = (kept: TodaySettings) => applyDecisions(signalsFor(kept), kept, today)
    // What went away since the last time is told, and what was marked done about it forgotten.
    const settings = reconcileSignals(saved, signalsFor(saved), unsettled, today)
    if (JSON.stringify(settings) !== JSON.stringify(saved)) {
      await deps.store.save(project.folder, settings)
    }
    // A point opened from a signal that went away is closed with it.
    const settled =
      (await deps.points?.settle(project, signalsFor(saved), unsettled)) ?? NO_OPEN_POINTS
    // The meetings of the days being closed: those of the working day before, and today's.
    const since = previousWorkday(today)
    const held = [...meetingsOn(invites, since), ...agenda.today]
    const closing = await deps.closing?.look(project, held)
    const register = closing?.register ?? settled
    const points = pointBrief(register, today, since, agenda.today, now)
    // The last time each meeting of today was recorded: what was left open there is brought.
    const recorded = await attempt(
      async () => (await deps.meetings?.imported(project)) ?? [],
      NOTHING,
    )
    const heldByDay = new Map<string, DayMeeting[]>()
    const heldOn = (day: string): DayMeeting[] => {
      const known = heldByDay.get(day) ?? meetingsOn(invites, day)
      heldByDay.set(day, known)
      return known
    }
    const lasts: LastFiles[] = []
    for (const meeting of agenda.today) {
      const recording = lastRecordingOf(meeting, recorded, heldOn, romeDateString)
      lasts.push(
        recording ? { ...recording, files: await textsOf(project, recording.folder) } : null,
      )
    }
    // A judgement given before Claude was asked whom a mail is for, or whether it asks
    // something at all, does not say it: the mail is read again.
    const unjudged = threads.awaitingMe.filter((mail) => {
      const judgement = evaluation.mails[mail.id]
      return judgement?.addressee === undefined || judgement.asksAction === undefined
    })
    const judgedToday = evaluation.at !== null && romeDateString(new Date(evaluation.at)) === today
    return {
      now,
      today,
      settings,
      evaluation,
      threads,
      unjudged,
      judgedToday,
      page: pageFor(settings),
      pageFor,
      agenda,
      points,
      register,
      lasts,
      held,
      closing: {
        unread: closing?.unread.length ?? 0,
        key: (closing?.unread ?? []).join(' '),
        at: register.closedAt,
        model: register.closedBy,
      },
      openRisks,
      sprintEnd: lastDay !== null && lastDay > today ? lastDay : null,
      freshness,
      own,
    }
  }

  type Computed = Awaited<ReturnType<typeof compute>>

  /** What was computed with other settings of the PM: nothing is read again. */
  const withSettings = (computed: Computed, settings: TodaySettings): Computed => ({
    ...computed,
    settings,
    page: computed.pageFor(settings),
  })

  /** The card of each meeting of today, from what was computed and what Claude said today. */
  function prepOf(computed: Computed): MeetingPrep[] {
    return computed.agenda.today.map((meeting, index) => {
      const last = computed.lasts[index] ?? null
      return meetingPrep(meeting, {
        points: computed.points.queued,
        allPoints: computed.register.points,
        last: last && { ...last, file: last.files[0] ?? null },
        items: computed.page.items,
        own: computed.own,
        // What Claude wrote on another day is about other meetings.
        notes: computed.judgedToday ? computed.evaluation.prep : [],
      })
    })
  }

  /** The meetings of today that have not started: those worth preparing. */
  const upcoming = (computed: Computed): DayMeeting[] =>
    computed.agenda.today.filter((meeting) => Date.parse(meeting.start) > computed.now.getTime())

  function viewOf(computed: Computed): TodayView {
    const visible = new Set(
      computed.page.items.flatMap((item) =>
        item.facts.kind === 'mail_reply' || item.facts.kind === 'mail_follow'
          ? [item.facts.id]
          : [],
      ),
    )
    const first = nowItems(computed.page.items, computed.now)
    const firstKeys = new Set(first.map((entry) => entry.item.key))
    return {
      day: computed.today,
      items: computed.page.items,
      agenda: computed.agenda,
      points: computed.points,
      prep: prepOf(computed),
      closing: computed.closing,
      week: weekItems({
        items: computed.page.items,
        points: computed.points.queued,
        risks: computed.openRisks,
        today: computed.today,
        sprintEnd: computed.sprintEnd,
      }),
      now: first,
      // What Claude wrote on another day is about another day.
      nowSummary: computed.judgedToday
        ? computed.evaluation.summary.filter(
            (sentence) => sentence.verified && firstKeys.has(sentence.key),
          )
        : [],
      marks: marksOf(computed.page.items, computed.settings),
      count: todayCount(computed.page.items, first) + pointsCount(computed.points),
      notify: computed.settings.notify,
      hidden: computed.page.hidden,
      hiddenItems: computed.page.hiddenItems,
      resolvedToday: computed.settings.resolved
        .filter((signal) => signal.day === computed.today)
        .map((signal) => signal.kind),
      sprintEnd: computed.sprintEnd,
      muteOffers: computed.page.muteOffers,
      mutedKinds: computed.settings.mutedKinds,
      freshness: computed.freshness,
      evaluation: { at: computed.evaluation.at, model: computed.evaluation.model },
      // A mail the PM put away is not worth a run of Claude.
      evaluationDue:
        !computed.judgedToday &&
        (first.length > 0 ||
          computed.closing.unread > 0 ||
          (deps.reader !== undefined && upcoming(computed).length > 0) ||
          computed.unjudged.some((mail) => visible.has(mail.id))),
      ownAddresses: computed.own,
      addedAddresses: computed.settings.ownAddresses,
    }
  }

  const view = async (project: Project): Promise<TodayView> => viewOf(await compute(project))

  /** Keeps other settings and shows the page under them, computed once. */
  async function keep(
    project: Project,
    computed: Computed,
    settings: TodaySettings,
  ): Promise<TodayView> {
    await deps.store.save(project.folder, settings)
    return viewOf(withSettings(computed, settings))
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
        ...(judgement.asksAction === undefined ? {} : { asksAction: judgement.asksAction }),
        judgedAt: deps.clock.now().toISOString(),
      }
    }
    return { ...evaluation, at: deps.clock.now().toISOString(), model, mails: judged }
  }

  /**
   * Asks Claude why what the code put first matters today. The code keeps a sentence only on a
   * signal it chose, one for a signal, and looks for the quote in the file it names.
   */
  async function explainNow(
    project: Project,
    computed: Computed,
    input: EvaluateInput,
  ): Promise<NowSentence[]> {
    const first = nowItems(computed.page.items, computed.now)
    if (first.length === 0) return []
    const proposed = await deps.judge.summary({
      projectFolder: project.folder,
      day: computed.today,
      items: first.map((entry) => ({
        key: entry.item.key,
        rule: entry.rule,
        facts: entry.item.facts,
      })),
      model: (await deps.models?.(project))?.ask ?? null,
      liveSources: (await deps.liveSources?.(project)) ?? [],
      ...(input.onProgress ? { onProgress: input.onProgress } : {}),
      ...(input.signal ? { signal: input.signal } : {}),
    })
    const sentences: NowSentence[] = []
    for (const entry of first) {
      const sentence = proposed.find((candidate) => candidate.key === entry.item.key)
      if (!sentence || sentence.text.trim() === '') continue
      const citation = { n: 1, path: sentence.path, quote: sentence.quote }
      const found = checkCitation(citation, await deps.evidence.read(project.folder, sentence.path))
      sentences.push({
        key: sentence.key,
        text: sentence.text.trim(),
        path: sentence.path,
        quote: sentence.quote,
        verified: found.status === 'verified',
      })
    }
    return sentences
  }

  /**
   * Asks Claude what to bring to the meetings of today still to come. It is told the card the
   * code made for each; the code keeps a note only on a meeting it asked about, and looks for
   * the quote in the file it names.
   */
  async function prepare(
    project: Project,
    computed: Computed,
    input: EvaluateInput,
  ): Promise<PrepNote[]> {
    const ahead = new Set(upcoming(computed).map(meetingKey))
    const cards = prepOf(computed)
    const meetings = computed.agenda.today.flatMap((meeting, index) => {
      const card = cards[index]
      if (!card || !ahead.has(card.key)) return []
      return [
        {
          key: card.key,
          subject: meeting.subject,
          start: meeting.start,
          attendees: meeting.attendees,
          points: card.points.map(({ point }) => ({
            id: point.id,
            title: point.title,
            owner: point.owner,
            due: point.due,
          })),
          lastFiles: computed.lasts[index]?.files ?? [],
          mails: card.mails.flatMap((item) => ('path' in item.facts ? [item.facts.path] : [])),
        },
      ]
    })
    if (!deps.reader || meetings.length === 0) return []
    const proposed = await deps.reader.prep({
      projectFolder: project.folder,
      day: computed.today,
      meetings: meetings.slice(0, MAX_MEETINGS_PER_PREP),
      model: (await deps.models?.(project))?.ask ?? null,
      liveSources: (await deps.liveSources?.(project)) ?? [],
      ...(input.onProgress ? { onProgress: input.onProgress } : {}),
      ...(input.signal ? { signal: input.signal } : {}),
    })
    const notes: PrepNote[] = []
    for (const note of proposed) {
      const said = notes.filter((kept) => kept.key === note.key).length
      if (!ahead.has(note.key) || note.text.trim() === '' || said >= MAX_PREP_NOTES) continue
      const citation = { n: 1, path: note.path, quote: note.quote }
      const found = checkCitation(citation, await deps.evidence.read(project.folder, note.path))
      notes.push({
        key: note.key,
        text: note.text.trim(),
        path: note.path,
        quote: note.quote,
        verified: found.status === 'verified',
      })
    }
    return notes
  }

  return {
    view,

    async decide(project, input) {
      const computed = await compute(project)
      const { page, settings, today } = computed
      if (input.state === 'open') {
        const hidden = page.hiddenItems.find((kept) => kept.item.key === input.key)
        return keep(
          project,
          computed,
          withoutDecision(settings, input.key, hidden?.item.formerKeys ?? []),
        )
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
      return keep(project, computed, withDecision(settings, decision))
    },

    async mailTurn(project, key, turn) {
      const computed = await compute(project)
      const { page, settings, today } = computed
      // A mail Claude keeps away is taken back by saying it is the PM's.
      const item =
        page.items.find((candidate) => candidate.key === key) ??
        page.hiddenItems.find((hidden) => hidden.item.key === key)?.item
      const conversation =
        item && (item.facts.kind === 'mail_reply' || item.facts.kind === 'mail_follow')
          ? item.facts.conversation
          : undefined
      if (conversation === undefined) throw new DomainError('today_decision_invalid', key)
      return keep(project, computed, withMailTurn(settings, conversation, turn, today))
    },

    async muteKind(project, kind, muted) {
      const computed = await compute(project)
      const others = computed.settings.mutedKinds.filter((kept) => kept !== kind)
      return keep(project, computed, {
        ...computed.settings,
        mutedKinds: muted ? [...others, kind] : others,
      })
    },

    async saveAddresses(project, addresses) {
      const settings = await deps.store.load(project.folder)
      await deps.store.save(
        project.folder,
        cleanTodaySettings({ ...settings, ownAddresses: [...addresses] }),
      )
      return view(project)
    },

    async visited(project) {
      const computed = await compute(project)
      await deps.store.save(
        project.folder,
        withVisit(computed.settings, computed.page.items, computed.now.toISOString()),
      )
    },

    async setNotify(project, notify) {
      const computed = await compute(project)
      return keep(project, computed, { ...computed.settings, notify })
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
        const judged = { ...next, mails: kept, summary: [], prep: [] }
        await deps.store.saveEvaluation(project.folder, judged)
        // Why what comes first matters is a second question, asked on the mail just judged:
        // when it fails, the mail judged stays judged and the page says nothing more.
        const summary = await explainNow(project, await compute(project), input).catch(
          (error: unknown) => {
            if (!isDomainError(error)) throw error
            return []
          },
        )
        if (summary.length > 0) {
          await deps.store.saveEvaluation(project.folder, { ...judged, summary })
        }
        // The meetings recorded since are a third question, with the same care.
        const { closing, held } = await compute(project)
        if (closing.unread > 0) {
          await deps.closing?.close(project, { held, ...input }).catch((error: unknown) => {
            if (!isDomainError(error)) throw error
          })
        }
        // What to bring to the meetings still to come is the last question, on all the rest.
        const prep = await prepare(project, await compute(project), input).catch(
          (error: unknown) => {
            if (!isDomainError(error)) throw error
            return []
          },
        )
        if (prep.length > 0) {
          const current = await deps.store.loadEvaluation(project.folder)
          await deps.store.saveEvaluation(project.folder, { ...current, prep })
        }
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

    async closeDay(project, input = {}) {
      if (!deps.closing) return view(project)
      if (evaluating.has(project.id)) throw new DomainError('source_busy', 'today')
      evaluating.add(project.id)
      try {
        const { held } = await compute(project)
        await deps.closing.close(project, { held, ...input })
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
            first: firstOf(page),
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
