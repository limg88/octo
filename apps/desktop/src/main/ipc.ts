import { readFile, realpath, stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import type {
  AgentRunner,
  Alignments,
  AppPreferences,
  AskQuestion,
  Backups,
  Dashboard,
  DashboardAdvice,
  Deliverables,
  Documents,
  EvidenceReader,
  Feeding,
  Feeds,
  Forecasts,
  Hours,
  KeepWork,
  Meetings,
  Models,
  OpenPoints,
  Progress,
  ProjectShapes,
  ProjectSheets,
  Projects,
  QuestionLog,
  Risks,
  Session,
  Sources,
  Team,
  Today,
  TrackerSnapshots,
  Updates,
} from '@octo/application'
import {
  DEFAULT_DASHBOARD_SETTINGS,
  DomainError,
  EXPORT_WARNING_HOURS,
  FEED_NAMES,
  FORECAST_KINDS,
  FULL_ALLOCATION,
  IMPORTANCES,
  isDomainError,
  MAIL_TURNS,
  MODEL_CHOICES,
  OPEN_POINT_STATES,
  opensAsDocument,
  PHASES,
  pathInProject,
  RISK_STATES,
  TEAM_SIDES,
  TEMPLATE_FORMATS,
  THEME_CHOICES,
  TODAY_KINDS,
  type TodayKind,
  templateFormatOf,
  WAREHOUSE_TLS_MODES,
} from '@octo/domain'
import { type BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { z } from 'zod'
import { CHANNELS, DELIVERABLE_INPUT_LIMIT, type Result, UNEXPECTED_ERROR } from '../shared/api.ts'

export type IpcDeps = {
  window: BrowserWindow
  agent: AgentRunner
  projects: Projects
  questions: QuestionLog
  evidence: EvidenceReader
  askQuestion: AskQuestion
  keepWork: KeepWork
  sources: Sources
  meetings: Meetings
  documents: Documents
  feeds: Feeds
  feeding: Feeding
  deliverables: Deliverables
  dashboard: Dashboard
  dashboardAdvice: DashboardAdvice
  hours: Hours
  forecasts: Forecasts
  projectSheets: ProjectSheets
  shapes: ProjectShapes
  progress: Progress
  updates: Updates
  /** The version Octo was updated to since it last ran, where that costs it its permissions. */
  updatedTo: string | null
  alignments: Alignments
  team: Team
  folderDialogTitle: string
  letterheadDialogTitle: string
  kindTemplateDialogTitle: string
  deckModelDialogTitle: string
  newProjectDialogTitle: string
  meetingsDialogTitle: string
  backups: Backups
  models: Models
  preferences: AppPreferences
  trackerSnapshots: TrackerSnapshots
  backupDialogs: BackupDialogs
  session: Session
  today: Today
  risks: Risks
  points: OpenPoints
  /** When the sources of every project are read next by themselves; null when not known. */
  nextReading: () => string | null
}

/** The words of the dialogs of a backup: they are the interface's, not this file's. */
export type BackupDialogs = {
  saveTitle: string
  openTitle: string
  fileKind: string
  /** The title of the dialog that asks where a project is on this computer. */
  locateTitle(projectName: string): string
  defaultFileName(): string
}

const BACKUP_EXTENSIONS = ['json']

const MAX_QUESTION_LENGTH = 4000
const MAX_RULE_LENGTH = 300
const none = z.undefined()
const MAC = 'darwin'
/** The page of the system settings where an app is given access to the whole disk. */
const DISK_ACCESS_SETTINGS =
  'x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles'
const preferencesInput = z.object({ theme: z.enum(THEME_CHOICES) })
const signInSetupInput = z.object({ tenantId: z.string().max(200), clientId: z.string().max(200) })
const byProject = z.object({ projectId: z.string().min(1) })
const askInput = byProject.extend({
  question: z.string().max(MAX_QUESTION_LENGTH),
  conversationId: z.string().max(MAX_RULE_LENGTH).nullable().default(null),
  compute: z.boolean().default(false),
})
const keepWorkInput = byProject.extend({ questionId: z.string().min(1).max(MAX_RULE_LENGTH) })
const evidenceInput = byProject.extend({ path: z.string().min(1) })
const MAX_RULES = 200
const ruleList = z.array(z.string().max(MAX_RULE_LENGTH)).max(MAX_RULES)
const mailConfig = z.object({
  since: z.string().max(MAX_RULE_LENGTH),
  keywords: ruleList,
  folders: ruleList,
  excludeSenders: ruleList,
  keepQuoted: z.boolean(),
  targetFolder: z.string().max(MAX_RULE_LENGTH),
})
const mailSaveInput = byProject.extend({ config: mailConfig.nullable() })
const mailPreviewInput = byProject.extend({ config: mailConfig })
const MAX_PATH_LENGTH = 4000
const meetingsSaveInput = byProject.extend({
  config: z
    .object({
      root: z.string().max(MAX_PATH_LENGTH),
      since: z.string().max(MAX_RULE_LENGTH).nullable(),
    })
    .nullable(),
})
const meetingAssignInput = byProject.extend({ meetingId: z.string().min(1).max(MAX_RULE_LENGTH) })
const meetingMoveInput = meetingAssignInput.extend({
  targetProjectId: z.string().min(1).max(MAX_RULE_LENGTH).nullable(),
})

const MAX_SECRET_LENGTH = 4000
const rule = z.string().max(MAX_RULE_LENGTH)
const byFeed = byProject.extend({ feed: z.enum(FEED_NAMES) })
const feedBase = { since: rule, targetFolder: rule }
const secret = z.string().max(MAX_SECRET_LENGTH).nullable()
/** The configuration is checked against the feed it is for: no field of another feed passes. */
const feedConfigs = {
  ado: z.object({ ...feedBase, organization: rule, project: rule, areas: ruleList }),
  jira: z.object({ ...feedBase, site: rule, email: rule, projects: ruleList }),
  confluence: z.object({ ...feedBase, site: rule, email: rule, spaces: ruleList }),
  dwsi: z.object({
    ...feedBase,
    host: rule,
    port: z.number().int(),
    database: rule,
    user: rule,
    ownerEmail: rule,
    projectCodes: ruleList,
    tls: z.enum(WAREHOUSE_TLS_MODES),
  }),
}
const feedChoicesInput = z.discriminatedUnion('feed', [
  byProject.extend({ feed: z.literal('ado'), secret, config: feedConfigs.ado }),
  byProject.extend({ feed: z.literal('jira'), secret, config: feedConfigs.jira }),
  byProject.extend({ feed: z.literal('confluence'), secret, config: feedConfigs.confluence }),
  byProject.extend({ feed: z.literal('dwsi'), secret, config: feedConfigs.dwsi }),
])
const feedSaveInput = z.discriminatedUnion('feed', [
  byProject.extend({ feed: z.literal('ado'), secret, config: feedConfigs.ado.nullable() }),
  byProject.extend({ feed: z.literal('jira'), secret, config: feedConfigs.jira.nullable() }),
  byProject.extend({
    feed: z.literal('confluence'),
    secret,
    config: feedConfigs.confluence.nullable(),
  }),
  byProject.extend({ feed: z.literal('dwsi'), secret, config: feedConfigs.dwsi.nullable() }),
])

/** A letterhead larger than this is not one: it would travel in every Word file. */
const MAX_LETTERHEAD_BYTES = 20 * 1024 * 1024
/** A deck carries its pictures and layouts; one larger than this is not a model to write on. */
const MAX_DECK_MODEL_BYTES = 80 * 1024 * 1024
const MAX_INPUT_LENGTH = DELIVERABLE_INPUT_LIMIT
const MAX_INSTRUCTIONS_LENGTH = 20_000
/** An id Octo made, used in a file name: letters, digits and dashes only. */
const id = z.string().regex(/^[A-Za-z0-9-]{1,80}$/)
const byKind = byProject.extend({ kindId: id })
const kindTemplateInput = byKind.extend({ format: z.enum(TEMPLATE_FORMATS) })
const byDeliverable = byProject.extend({ deliverableId: id })
const deliverableStartInput = byKind.extend({
  inputs: z.record(z.string().max(MAX_RULE_LENGTH), z.string().max(MAX_INPUT_LENGTH)),
})
const deliverableReviseInput = byDeliverable.extend({ request: z.string().max(MAX_INPUT_LENGTH) })
const kindSaveInput = byProject.extend({
  input: z.object({
    title: z.string().max(MAX_RULE_LENGTH),
    summary: z.string().max(MAX_INPUT_LENGTH),
    audience: z.enum(['client', 'internal']),
    questions: ruleList,
    instructions: z.string().max(MAX_INSTRUCTIONS_LENGTH),
    checklist: ruleList,
  }),
})
const instructionsSaveInput = byKind.extend({ text: z.string().max(MAX_INSTRUCTIONS_LENGTH) })

/** Opening the dashboard reads the tracker again when its reading is older than a day. */
const EXPORT_WARNING_MS = EXPORT_WARNING_HOURS * 60 * 60 * 1000
const MAX_DECISIONS = 5000
const dated = { id: rule, at: rule }
const dashboardSettingsInput = byProject.extend({
  settings: z.object({
    exportPath: rule,
    historyPath: rule,
    tags: ruleList,
    ownPeopleOnly: z.boolean().default(false),
    bugTypes: ruleList,
    storyTypes: ruleList,
    stuckDays: z.number(),
    requirementPeriods: ruleList,
    answerWorkdays: z.number().default(DEFAULT_DASHBOARD_SETTINGS.answerWorkdays),
    phases: z.record(rule, z.enum(PHASES)),
    handoverStates: ruleList,
    decisions: z.object({
      excludedRequirements: z.array(z.object(dated)).max(MAX_DECISIONS),
      removedSignals: z.array(z.object({ ...dated, signal: rule })).max(MAX_DECISIONS),
      notes: z
        .array(z.object({ ...dated, text: z.string().max(MAX_INPUT_LENGTH) }))
        .max(MAX_DECISIONS),
    }),
  }),
})
const dashboardRange = z.object({ from: rule, to: rule, granularity: z.enum(['week', 'month']) })
const dashboardViewInput = byProject.extend({
  range: dashboardRange,
  sprint: rule.nullable().default(null),
})
const dashboardCommentInput = byProject.extend({ range: dashboardRange })
const trackerItemInput = byProject.extend({ id: rule })

const hoursSettingsInput = byProject.extend({
  settings: z.object({
    timesheetPath: rule,
    worklogPath: rule,
    projects: ruleList,
    thresholdPct: z.number(),
    cutoff: rule,
    noWorklogExpected: ruleList,
    noTimesheetExpected: ruleList,
    aliases: z.array(z.object({ worklog: rule, timesheet: rule })).max(MAX_RULES),
  }),
})
const hoursViewInput = byProject.extend({ period: z.object({ from: rule, to: rule }) })

const MAX_FORECAST_MONTHS = 240
const money = z.number().nullable()
const forecastSettingsInput = byProject.extend({
  settings: z.object({
    modelPath: rule,
    projects: z
      .record(
        rule,
        z.object({
          kind: z.enum(FORECAST_KINDS),
          description: z.string().max(MAX_INPUT_LENGTH),
          ordered: money,
          feeMonths: z.number().nullable(),
          startMonth: rule.nullable(),
          invoiced: money,
          recognized: money,
        }),
      )
      .refine((projects) => Object.keys(projects).length <= MAX_RULES),
    hoursPerDay: z.number(),
    rates: z
      .array(z.object({ person: rule, code: rule.nullable(), ratePerDay: z.number() }))
      .max(MAX_RULES),
    externals: z
      .array(z.object({ name: rule, code: rule, costPerDay: z.number(), ratePerDay: z.number() }))
      .max(MAX_RULES),
    hourlyCosts: z.array(z.object({ person: rule, costPerHour: z.number() })).max(MAX_RULES),
    months: z
      .record(
        rule,
        z.record(
          rule,
          z.object({
            externals: z.array(z.object({ name: rule, hours: z.number() })).max(MAX_RULES),
            toInvoice: money,
            revenue: money,
            budgetCosts: money,
            totalCosts: money,
            totalCostsBeforeMonth: z.boolean(),
            note: z.string().max(MAX_INPUT_LENGTH),
          }),
        ),
      )
      .refine((months) => Object.keys(months).length <= MAX_FORECAST_MONTHS),
  }),
})
const forecastMonthInput = byProject.extend({ month: rule })

const progressSettingsInput = byProject.extend({
  settings: z.object({
    modelPath: rule,
    order: rule,
    salesOrders: ruleList.default([]),
    total: money,
    positions: z.array(z.object({ code: rule, amount: z.number() })).max(MAX_RULES),
    requests: z
      .array(
        z.object({
          n: z.number(),
          from: rule,
          to: rule,
          amount: z.number(),
          note: z.string().max(MAX_INPUT_LENGTH),
          positions: ruleList,
        }),
      )
      .max(MAX_RULES),
    form: z.object({
      fields: z
        .array(z.object({ ref: rule, text: z.string().max(MAX_INPUT_LENGTH) }))
        .max(MAX_RULES),
      table: z
        .object({
          firstRow: z.number(),
          rows: z.number(),
          position: rule,
          previous: rule,
          current: rule,
          period: rule,
        })
        .nullable(),
    }),
  }),
})
const progressCompileInput = byProject.extend({ n: z.number().int().min(1) })

const alignmentSettingsInput = byProject.extend({
  settings: z.object({
    sprint: rule,
    period: rule,
    tags: ruleList,
    ownPeopleOnly: z.boolean().default(false),
    exportPath: rule,
    ticketFolder: rule,
    referencePrefixes: ruleList,
    stateGroups: z.array(z.object({ name: rule, item: ruleList, ticket: ruleList })).max(MAX_RULES),
    typeMap: z.array(z.object({ item: rule, ticket: rule })).max(MAX_RULES),
  }),
})

const teamInput = byProject.extend({
  team: z.object({
    people: z
      .array(
        z.object({
          name: rule,
          role: rule,
          side: z.enum(TEAM_SIDES),
          from: rule,
          to: rule,
          allocation: z.number().positive().max(FULL_ALLOCATION).nullable(),
          note: z.string().max(MAX_INPUT_LENGTH),
          capDays: z.number().positive().nullable().optional(),
        }),
      )
      .max(MAX_RULES),
    periods: z.array(z.object({ name: rule, from: rule, to: rule })).max(MAX_RULES),
  }),
})
const modelChoice = z.enum(MODEL_CHOICES).nullable()
const modelsInput = byProject.extend({
  settings: z.object({ ask: modelChoice, write: modelChoice, review: modelChoice }),
})
const newProjectInput = z.object({ name: rule })
const MAX_EXTENSIONS = 8
const choosePathInput = byProject.extend({
  what: z.enum(['file', 'folder']),
  extensions: z.array(z.string().regex(/^[a-z0-9]{1,8}$/)).max(MAX_EXTENSIONS),
})

const MAX_KEY_LENGTH = 600
const MAX_ADDRESSES = 20
const key = z.string().min(1).max(MAX_KEY_LENGTH)
const todayDecideInput = byProject.extend({
  key,
  state: z.enum(['done', 'later', 'muted', 'open']),
  until: rule.nullable(),
})
const todayMuteInput = byProject.extend({ kind: rule, muted: z.boolean() })
const todayNotifyInput = byProject.extend({ notify: z.boolean() })
const todayMailTurnInput = byProject.extend({
  key: z.string().max(MAX_QUESTION_LENGTH),
  turn: z.enum(MAIL_TURNS).nullable(),
})
const todayAddressesInput = byProject.extend({ addresses: z.array(rule).max(MAX_ADDRESSES) })
const todayEvaluateInput = byProject.extend({ all: z.boolean() })
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const pointAddInput = byProject.extend({
  point: z.object({
    title: rule,
    owner: rule.optional(),
    due: day.nullable().optional(),
    signal: z
      .object({ key: z.string().max(MAX_QUESTION_LENGTH), kind: z.enum(TODAY_KINDS) })
      .optional(),
  }),
})
const pointUpdateInput = byProject.extend({
  pointId: id,
  change: z.object({
    title: rule.optional(),
    owner: rule.optional(),
    due: day.nullable().optional(),
    state: z.enum(OPEN_POINT_STATES).optional(),
  }),
})
const pointConfirmInput = byProject.extend({ pointId: id, resolved: z.boolean() })
const riskCandidateInput = byProject.extend({ candidateId: id })
const riskAcceptInput = riskCandidateInput.extend({ title: rule })
const riskAddInput = byProject.extend({ title: rule })
const riskUpdateInput = byProject.extend({
  riskId: id,
  change: z.object({
    state: z.enum(RISK_STATES).optional(),
    note: z.string().max(MAX_INPUT_LENGTH).optional(),
    due: day.nullable().optional(),
    severity: z.enum(IMPORTANCES).nullable().optional(),
  }),
})

/**
 * Every request from the interface is validated here, and every failure leaves as a code. But for
 * the sign-in itself, nothing is done while nobody is signed in.
 */
export function registerIpc(deps: IpcDeps): void {
  const running = new Map<string, AbortController>()
  const handle = handler(() => {
    deps.session.require()
  })
  const open = handler(() => {})

  open(CHANNELS.sessionGet, none, () => deps.session.view())
  // How the interface looks is asked before anybody signs in.
  open(CHANNELS.preferencesGet, none, () => deps.preferences.get())
  open(CHANNELS.preferencesSave, preferencesInput, (input) => deps.preferences.save(input))
  open(CHANNELS.sessionSignIn, none, () => deps.session.signIn())
  // Asked before anybody can sign in: it is what lets somebody do it.
  open(CHANNELS.sessionConfigure, signInSetupInput, ({ tenantId, clientId }) =>
    deps.session.configure(tenantId, clientId),
  )
  open(CHANNELS.sessionCancel, none, async () => {
    deps.session.cancelSignIn()
    return null
  })
  handle(CHANNELS.sessionSignOut, none, () => deps.session.signOut())

  handle(CHANNELS.todayView, byProject, async ({ projectId }) =>
    deps.today.view(await deps.projects.get(projectId)),
  )
  handle(CHANNELS.todayDecide, todayDecideInput, async ({ projectId, ...input }) =>
    deps.today.decide(await deps.projects.get(projectId), input),
  )
  handle(CHANNELS.todayMailTurn, todayMailTurnInput, async ({ projectId, key, turn }) =>
    deps.today.mailTurn(await deps.projects.get(projectId), key, turn),
  )

  handle(CHANNELS.todayMute, todayMuteInput, async ({ projectId, kind, muted }) =>
    deps.today.muteKind(await deps.projects.get(projectId), kind as TodayKind, muted),
  )
  handle(CHANNELS.todayAddresses, todayAddressesInput, async ({ projectId, addresses }) =>
    deps.today.saveAddresses(await deps.projects.get(projectId), addresses),
  )
  /** One run of Claude per project at a time, that the PM can stop. */
  async function judging<T>(projectId: string, run: (signal: AbortSignal) => Promise<T>) {
    const lock = `today:${projectId}`
    running.get(lock)?.abort()
    const abort = new AbortController()
    running.set(lock, abort)
    try {
      return await run(abort.signal)
    } finally {
      if (running.get(lock) === abort) running.delete(lock)
    }
  }
  const tellProgress = (projectId: string) => (progress: unknown) => {
    if (!deps.window.isDestroyed()) {
      deps.window.webContents.send(CHANNELS.todayProgress, projectId, progress)
    }
  }
  handle(CHANNELS.todayEvaluate, todayEvaluateInput, async ({ projectId, all }) => {
    const project = await deps.projects.get(projectId)
    return judging(projectId, (signal) =>
      deps.today.evaluate(project, { all, signal, onProgress: tellProgress(projectId) }),
    )
  })
  handle(CHANNELS.todayClose, byProject, async ({ projectId }) => {
    const project = await deps.projects.get(projectId)
    return judging(projectId, (signal) =>
      deps.today.closeDay(project, { signal, onProgress: tellProgress(projectId) }),
    )
  })
  handle(CHANNELS.todayCancel, byProject, async ({ projectId }) => {
    running.get(`today:${projectId}`)?.abort()
    return null
  })
  handle(CHANNELS.todayOverview, none, async () => deps.today.overview(await deps.projects.list()))
  handle(CHANNELS.todayVisited, byProject, async ({ projectId }) => {
    await deps.today.visited(await deps.projects.get(projectId))
    return null
  })
  handle(CHANNELS.todayNotify, todayNotifyInput, async ({ projectId, notify }) =>
    deps.today.setNotify(await deps.projects.get(projectId), notify),
  )
  handle(CHANNELS.nextReading, none, async () => deps.nextReading())
  handle(CHANNELS.windowFocus, none, async () => {
    if (deps.window.isMinimized()) deps.window.restore()
    deps.window.show()
    deps.window.focus()
    return null
  })

  handle(CHANNELS.pointsAdd, pointAddInput, async ({ projectId, point }) => {
    const project = await deps.projects.get(projectId)
    await deps.points.add(project, {
      title: point.title,
      ...(point.owner === undefined ? {} : { owner: point.owner }),
      ...(point.due === undefined ? {} : { due: point.due }),
      ...(point.signal ? { signal: point.signal } : {}),
    })
    return deps.today.view(project)
  })
  handle(CHANNELS.pointsUpdate, pointUpdateInput, async ({ projectId, pointId, change }) => {
    const project = await deps.projects.get(projectId)
    await deps.points.update(project, pointId, {
      ...(change.title === undefined ? {} : { title: change.title }),
      ...(change.owner === undefined ? {} : { owner: change.owner }),
      ...(change.due === undefined ? {} : { due: change.due }),
      ...(change.state ? { state: change.state } : {}),
    })
    return deps.today.view(project)
  })
  handle(CHANNELS.pointsConfirm, pointConfirmInput, async ({ projectId, pointId, resolved }) => {
    const project = await deps.projects.get(projectId)
    await deps.points.confirm(project, pointId, resolved)
    return deps.today.view(project)
  })
  handle(CHANNELS.risksGet, byProject, async ({ projectId }) =>
    deps.risks.register(await deps.projects.get(projectId)),
  )
  handle(CHANNELS.risksPropose, byProject, async ({ projectId }) => {
    const project = await deps.projects.get(projectId)
    return judging(projectId, (signal) =>
      deps.risks.propose(project, { signal, onProgress: tellProgress(projectId) }),
    )
  })
  handle(CHANNELS.risksAccept, riskAcceptInput, async ({ projectId, candidateId, title }) =>
    deps.risks.accept(await deps.projects.get(projectId), candidateId, title),
  )
  handle(CHANNELS.risksDismiss, riskCandidateInput, async ({ projectId, candidateId }) =>
    deps.risks.dismiss(await deps.projects.get(projectId), candidateId),
  )
  handle(CHANNELS.risksAdd, riskAddInput, async ({ projectId, title }) =>
    deps.risks.add(await deps.projects.get(projectId), title),
  )
  handle(CHANNELS.risksUpdate, riskUpdateInput, async ({ projectId, riskId, change }) =>
    deps.risks.update(await deps.projects.get(projectId), riskId, {
      ...(change.state ? { state: change.state } : {}),
      ...(change.note !== undefined ? { note: change.note } : {}),
      ...(change.due !== undefined ? { due: change.due } : {}),
      ...(change.severity !== undefined ? { severity: change.severity } : {}),
    }),
  )
  handle(CHANNELS.assignmentGet, byProject, async ({ projectId }) =>
    deps.feeds.assignment(await deps.projects.get(projectId)),
  )

  handle(CHANNELS.agentStatus, none, () => deps.agent.status())

  handle(CHANNELS.updateCheck, none, () => deps.updates.check())

  // Told once: the next time the page asks, there is nothing to say.
  let updatedTo = deps.updatedTo
  handle(CHANNELS.updateJustDone, none, async () => {
    const version = updatedTo
    updatedTo = null
    return version
  })

  handle(CHANNELS.diskAccessOpen, none, async () => {
    if (process.platform === MAC) await shell.openExternal(DISK_ACCESS_SETTINGS)
    return null
  })

  handle(CHANNELS.updateInstall, none, async () => {
    await deps.updates.install((progress) =>
      deps.window.webContents.send(CHANNELS.updateProgress, progress),
    )
    return null
  })
  handle(CHANNELS.projectsList, none, () => deps.projects.list())

  handle(CHANNELS.projectsAdd, none, async () => {
    const choice = await dialog.showOpenDialog(deps.window, {
      title: deps.folderDialogTitle,
      properties: ['openDirectory'],
    })
    const folder = choice.filePaths[0]
    return choice.canceled || !folder ? null : deps.projects.add(folder)
  })

  handle(CHANNELS.projectsCreate, newProjectInput, async ({ name }) => {
    const choice = await dialog.showOpenDialog(deps.window, {
      title: deps.newProjectDialogTitle,
      properties: ['openDirectory', 'createDirectory'],
    })
    const parent = choice.filePaths[0]
    return choice.canceled || !parent ? null : deps.projects.create(parent, name)
  })

  handle(CHANNELS.backupSave, none, async () => {
    const choice = await dialog.showSaveDialog(deps.window, {
      title: deps.backupDialogs.saveTitle,
      defaultPath: deps.backupDialogs.defaultFileName(),
      filters: [{ name: deps.backupDialogs.fileKind, extensions: BACKUP_EXTENSIONS }],
    })
    if (choice.canceled || !choice.filePath) return null
    return { file: choice.filePath, projects: await deps.backups.save(choice.filePath) }
  })

  handle(CHANNELS.backupRestore, none, async () => {
    const choice = await dialog.showOpenDialog(deps.window, {
      title: deps.backupDialogs.openTitle,
      properties: ['openFile'],
      filters: [{ name: deps.backupDialogs.fileKind, extensions: BACKUP_EXTENSIONS }],
    })
    const file = choice.filePaths[0]
    if (choice.canceled || !file) return null
    const { backup, toLocate } = await deps.backups.open(file)
    const folders: Record<string, string> = {}
    for (const project of toLocate) {
      const where = await dialog.showOpenDialog(deps.window, {
        title: deps.backupDialogs.locateTitle(project.name),
        message: deps.backupDialogs.locateTitle(project.name),
        properties: ['openDirectory'],
      })
      const folder = where.filePaths[0]
      // A project the PM does not point at is left out, and the outcome says so.
      if (!where.canceled && folder) folders[project.id] = folder
    }
    return deps.backups.restore(backup, folders)
  })

  handle(CHANNELS.teamGet, byProject, async ({ projectId }) =>
    deps.team.get(await deps.projects.get(projectId)),
  )

  handle(CHANNELS.modelsGet, byProject, async ({ projectId }) =>
    deps.models.get(await deps.projects.get(projectId)),
  )

  handle(CHANNELS.modelsSave, modelsInput, async (input) =>
    deps.models.save(await deps.projects.get(input.projectId), input.settings),
  )

  handle(CHANNELS.teamSave, teamInput, async (input) =>
    deps.team.save(await deps.projects.get(input.projectId), input.team),
  )

  handle(CHANNELS.projectsRemove, byProject, async ({ projectId }) => {
    running.get(projectId)?.abort()
    await deps.projects.remove(projectId)
    return null
  })

  handle(CHANNELS.projectsRestore, byProject, ({ projectId }) => deps.projects.restore(projectId))

  handle(CHANNELS.projectsRelocate, byProject, async ({ projectId }) => {
    const project = await deps.projects.get(projectId)
    const title = deps.backupDialogs.locateTitle(project.name)
    const choice = await dialog.showOpenDialog(deps.window, {
      title,
      message: title,
      properties: ['openDirectory'],
    })
    const folder = choice.filePaths[0]
    if (choice.canceled || !folder) return null
    return deps.projects.relocate(projectId, folder)
  })

  handle(CHANNELS.projectsChoosePath, choosePathInput, async ({ projectId, what, extensions }) => {
    const project = await deps.projects.get(projectId)
    const choice = await dialog.showOpenDialog(deps.window, {
      defaultPath: project.folder,
      properties: [what === 'folder' ? 'openDirectory' : 'openFile'],
      ...(what === 'file' && extensions.length > 0
        ? { filters: [{ name: extensions.join(', ').toUpperCase(), extensions }] }
        : {}),
    })
    const chosen = choice.filePaths[0]
    if (choice.canceled || !chosen) return null
    const inside = pathInProject(project.folder, chosen)
    // Octo reads only inside the project: a file elsewhere is refused, not copied in silence.
    if (inside === null) throw new DomainError('path_outside_project', chosen)
    return inside
  })

  handle(CHANNELS.questionsList, byProject, async ({ projectId }) => {
    const project = await deps.projects.get(projectId)
    return deps.questions.list(project.folder)
  })

  handle(CHANNELS.questionsAsk, askInput, async (input) => {
    const { projectId, question, conversationId, compute } = input
    const project = await deps.projects.get(projectId)
    running.get(projectId)?.abort()
    const controller = new AbortController()
    running.set(projectId, controller)
    try {
      return await deps.askQuestion({
        project,
        question,
        conversationId,
        compute,
        signal: controller.signal,
        onProgress: (progress) =>
          deps.window.webContents.send(CHANNELS.questionsProgress, projectId, progress),
      })
    } finally {
      if (running.get(projectId) === controller) running.delete(projectId)
    }
  })

  handle(CHANNELS.questionsKeepWork, keepWorkInput, async ({ projectId, questionId }) =>
    deps.keepWork(await deps.projects.get(projectId), questionId),
  )

  handle(CHANNELS.questionsCancel, byProject, async ({ projectId }) => {
    running.get(projectId)?.abort()
    return null
  })

  handle(CHANNELS.mailGet, byProject, async ({ projectId }) =>
    deps.sources.mail(await deps.projects.get(projectId)),
  )

  /** What is linked changed: every part of the page that shows it reads it again. */
  const sourcesChanged = (projectId: string) =>
    deps.window.webContents.send(CHANNELS.sourcesChanged, projectId)

  handle(CHANNELS.mailSave, mailSaveInput, async ({ projectId, config }) => {
    const view = await deps.sources.saveMail(await deps.projects.get(projectId), config)
    sourcesChanged(projectId)
    return view
  })

  handle(CHANNELS.mailSync, byProject, async ({ projectId }) =>
    deps.sources.syncMail(await deps.projects.get(projectId)),
  )

  handle(CHANNELS.mailPreview, mailPreviewInput, async ({ projectId, config }) =>
    deps.sources.previewMail(await deps.projects.get(projectId), config),
  )

  handle(CHANNELS.meetingsGet, byProject, async ({ projectId }) =>
    deps.meetings.view(await deps.projects.get(projectId)),
  )

  handle(CHANNELS.meetingsSave, meetingsSaveInput, async ({ projectId, config }) => {
    const view = await deps.meetings.save(await deps.projects.get(projectId), config)
    sourcesChanged(projectId)
    return view
  })

  handle(CHANNELS.meetingsSync, byProject, async ({ projectId }) =>
    deps.meetings.sync(await deps.projects.get(projectId)),
  )

  // Verbale exports wherever its user chose: the folder is picked on the whole computer.
  handle(CHANNELS.meetingsChooseRoot, none, async () => {
    const choice = await dialog.showOpenDialog(deps.window, {
      title: deps.meetingsDialogTitle,
      properties: ['openDirectory'],
    })
    return choice.canceled ? null : (choice.filePaths[0] ?? null)
  })

  handle(CHANNELS.meetingsImported, byProject, async ({ projectId }) =>
    deps.meetings.imported(await deps.projects.get(projectId)),
  )

  handle(CHANNELS.meetingsAssign, meetingAssignInput, async ({ projectId, meetingId }) => {
    const project = await deps.projects.get(projectId)
    await deps.meetings.assign(project, meetingId)
    sourcesChanged(projectId)
    return deps.today.view(project)
  })

  handle(CHANNELS.meetingsDestinations, byProject, async ({ projectId }) =>
    deps.meetings.destinations(await deps.projects.get(projectId)),
  )

  handle(CHANNELS.meetingsMove, meetingMoveInput, async (input) => {
    const project = await deps.projects.get(input.projectId)
    await deps.meetings.move(project, input.meetingId, input.targetProjectId)
    sourcesChanged(input.projectId)
    if (input.targetProjectId !== null) sourcesChanged(input.targetProjectId)
    return deps.meetings.imported(project)
  })

  handle(CHANNELS.feedingStatus, byProject, async ({ projectId }) =>
    deps.feeding.status(await deps.projects.get(projectId)),
  )

  handle(CHANNELS.feedingFill, byProject, async ({ projectId }) => {
    const project = await deps.projects.get(projectId)
    const steps = await deps.feeding.fill(project, (step) =>
      deps.window.webContents.send(CHANNELS.feedingStep, projectId, step),
    )
    sourcesChanged(projectId)
    return steps
  })

  handle(CHANNELS.feedChoices, feedChoicesInput, async (input) => {
    const project = await deps.projects.get(input.projectId)
    return deps.feeds.choices(project, input.feed, input.config, input.secret)
  })

  handle(CHANNELS.feedGet, byFeed, async ({ projectId, feed }) =>
    deps.feeds.view(await deps.projects.get(projectId), feed),
  )

  handle(CHANNELS.feedSave, feedSaveInput, async (input) => {
    const project = await deps.projects.get(input.projectId)
    const view = await deps.feeds.save(project, input.feed, input.config, input.secret)
    sourcesChanged(input.projectId)
    return view
  })

  handle(CHANNELS.feedSync, byFeed, async ({ projectId, feed }) =>
    deps.feeds.sync(await deps.projects.get(projectId), feed),
  )

  handle(CHANNELS.documentsGet, byProject, async ({ projectId }) =>
    deps.documents.state(await deps.projects.get(projectId)),
  )

  handle(CHANNELS.documentsConvert, byProject, async ({ projectId }) =>
    deps.documents.convert(await deps.projects.get(projectId)),
  )

  const writingProgress = (projectId: string) => (progress: unknown) =>
    deps.window.webContents.send(CHANNELS.deliverablesProgress, projectId, progress)

  handle(CHANNELS.deliverablesCatalog, byProject, async ({ projectId }) =>
    deps.deliverables.catalog(await deps.projects.get(projectId)),
  )

  handle(CHANNELS.kindSave, kindSaveInput, async ({ projectId, input }) =>
    deps.deliverables.saveKind(await deps.projects.get(projectId), input),
  )

  handle(CHANNELS.kindRemove, byKind, async ({ projectId, kindId }) => {
    await deps.deliverables.removeKind(await deps.projects.get(projectId), kindId)
    return null
  })

  handle(CHANNELS.deliverablesList, byProject, async ({ projectId }) =>
    deps.deliverables.list(await deps.projects.get(projectId)),
  )

  handle(CHANNELS.deliverablesStart, deliverableStartInput, async (input) =>
    deps.deliverables.start(await deps.projects.get(input.projectId), {
      kindId: input.kindId,
      inputs: input.inputs,
      onProgress: writingProgress(input.projectId),
    }),
  )

  handle(CHANNELS.deliverablesRevise, deliverableReviseInput, async (input) =>
    deps.deliverables.revise(await deps.projects.get(input.projectId), {
      deliverableId: input.deliverableId,
      request: input.request,
      onProgress: writingProgress(input.projectId),
    }),
  )

  handle(CHANNELS.deliverablesApprove, byDeliverable, async ({ projectId, deliverableId }) =>
    deps.deliverables.approve(await deps.projects.get(projectId), deliverableId),
  )

  handle(CHANNELS.instructionsGet, byKind, async ({ projectId, kindId }) =>
    deps.deliverables.instructions(await deps.projects.get(projectId), kindId),
  )

  handle(CHANNELS.instructionsSave, instructionsSaveInput, async (input) => {
    const project = await deps.projects.get(input.projectId)
    await deps.deliverables.saveInstructions(project, input.kindId, input.text)
    return null
  })

  handle(CHANNELS.kindTemplates, byProject, async ({ projectId }) =>
    deps.deliverables.templates(await deps.projects.get(projectId)),
  )

  handle(CHANNELS.kindTemplateChoose, byKind, async ({ projectId, kindId }) => {
    const project = await deps.projects.get(projectId)
    const choice = await dialog.showOpenDialog(deps.window, {
      title: deps.kindTemplateDialogTitle,
      properties: ['openFile'],
      filters: [{ name: 'Word, PowerPoint', extensions: [...TEMPLATE_FORMATS] }],
    })
    const file = choice.filePaths[0]
    if (choice.canceled || !file) return null
    const format = templateFormatOf(file)
    if (format === null) throw new DomainError('letterhead_invalid')
    const info = await stat(file)
    if (format === 'docx' && info.size > MAX_LETTERHEAD_BYTES) {
      throw new DomainError('letterhead_invalid')
    }
    if (format === 'pptx' && info.size > MAX_DECK_MODEL_BYTES) {
      throw new DomainError('deck_model_invalid')
    }
    await deps.deliverables.setKindTemplate(
      project,
      kindId,
      format,
      new Uint8Array(await readFile(file)),
    )
    return format
  })

  handle(CHANNELS.kindTemplateRemove, kindTemplateInput, async ({ projectId, kindId, format }) => {
    await deps.deliverables.setKindTemplate(
      await deps.projects.get(projectId),
      kindId,
      format,
      null,
    )
    return null
  })

  handle(CHANNELS.letterheadGet, byProject, async ({ projectId }) =>
    deps.deliverables.hasLetterhead(await deps.projects.get(projectId)),
  )

  handle(CHANNELS.letterheadChoose, byProject, async ({ projectId }) => {
    const project = await deps.projects.get(projectId)
    const choice = await dialog.showOpenDialog(deps.window, {
      title: deps.letterheadDialogTitle,
      properties: ['openFile'],
      filters: [{ name: 'Word', extensions: ['docx'] }],
    })
    const file = choice.filePaths[0]
    if (choice.canceled || !file) return false
    const info = await stat(file)
    if (info.size > MAX_LETTERHEAD_BYTES) throw new DomainError('letterhead_invalid')
    await deps.deliverables.setLetterhead(project, new Uint8Array(await readFile(file)))
    return true
  })

  handle(CHANNELS.letterheadRemove, byProject, async ({ projectId }) => {
    await deps.deliverables.setLetterhead(await deps.projects.get(projectId), null)
    return null
  })

  handle(CHANNELS.deckModelGet, byProject, async ({ projectId }) =>
    deps.deliverables.hasDeckModel(await deps.projects.get(projectId)),
  )

  handle(CHANNELS.deckModelChoose, byProject, async ({ projectId }) => {
    const project = await deps.projects.get(projectId)
    const choice = await dialog.showOpenDialog(deps.window, {
      title: deps.deckModelDialogTitle,
      properties: ['openFile'],
      filters: [{ name: 'PowerPoint', extensions: ['pptx'] }],
    })
    const file = choice.filePaths[0]
    if (choice.canceled || !file) return false
    const info = await stat(file)
    if (info.size > MAX_DECK_MODEL_BYTES) throw new DomainError('deck_model_invalid')
    await deps.deliverables.setDeckModel(project, new Uint8Array(await readFile(file)))
    return true
  })

  handle(CHANNELS.deckModelRemove, byProject, async ({ projectId }) => {
    await deps.deliverables.setDeckModel(await deps.projects.get(projectId), null)
    return null
  })

  handle(CHANNELS.dashboardSettingsGet, byProject, async ({ projectId }) =>
    deps.dashboard.settings(await deps.projects.get(projectId)),
  )

  handle(CHANNELS.dashboardSettingsSave, dashboardSettingsInput, async (input) =>
    deps.dashboard.saveSettings(await deps.projects.get(input.projectId), input.settings),
  )

  handle(CHANNELS.dashboardCandidates, byProject, async ({ projectId }) =>
    deps.dashboard.candidates(await deps.projects.get(projectId)),
  )

  handle(CHANNELS.dashboardView, dashboardViewInput, async (input) =>
    deps.dashboard.view(await deps.projects.get(input.projectId), input.range, input.sprint),
  )

  // The address is built here from the source of the project: the window never gives one.
  handle(CHANNELS.dashboardOpenItem, trackerItemInput, async ({ projectId, id }) => {
    const url = await deps.dashboard.itemUrl(await deps.projects.get(projectId), id)
    if (url === null) return false
    await shell.openExternal(url)
    return true
  })

  handle(CHANNELS.dashboardComment, dashboardCommentInput, async ({ projectId, range }) =>
    deps.dashboardAdvice.comment(await deps.projects.get(projectId), range),
  )

  handle(CHANNELS.dashboardReminder, trackerItemInput, async ({ projectId, id }) =>
    deps.dashboardAdvice.reminder(await deps.projects.get(projectId), id),
  )

  handle(CHANNELS.dashboardRefresh, byProject, async ({ projectId }) =>
    deps.trackerSnapshots.refresh(await deps.projects.get(projectId), EXPORT_WARNING_MS),
  )

  handle(CHANNELS.hoursSettingsGet, byProject, async ({ projectId }) =>
    deps.hours.settings(await deps.projects.get(projectId)),
  )

  handle(CHANNELS.hoursSettingsSave, hoursSettingsInput, async (input) =>
    deps.hours.saveSettings(await deps.projects.get(input.projectId), input.settings),
  )

  handle(CHANNELS.hoursCandidates, byProject, async ({ projectId }) =>
    deps.hours.candidates(await deps.projects.get(projectId)),
  )

  handle(CHANNELS.hoursView, hoursViewInput, async (input) =>
    deps.hours.view(await deps.projects.get(input.projectId), input.period),
  )

  handle(CHANNELS.dashboardReadTracker, byProject, async ({ projectId }) =>
    deps.trackerSnapshots.read(await deps.projects.get(projectId)),
  )

  handle(CHANNELS.hoursReadTimesheets, hoursViewInput, async (input) =>
    deps.hours.readTimesheets(await deps.projects.get(input.projectId), input.period),
  )

  handle(CHANNELS.hoursReadTracker, hoursViewInput, async (input) =>
    deps.hours.readFromTracker(await deps.projects.get(input.projectId), input.period),
  )

  handle(CHANNELS.forecastSettingsGet, byProject, async ({ projectId }) =>
    deps.forecasts.settings(await deps.projects.get(projectId)),
  )

  handle(CHANNELS.forecastSettingsSave, forecastSettingsInput, async (input) =>
    deps.forecasts.saveSettings(await deps.projects.get(input.projectId), input.settings),
  )

  handle(CHANNELS.forecastCandidates, byProject, async ({ projectId }) =>
    deps.forecasts.candidates(await deps.projects.get(projectId)),
  )

  handle(CHANNELS.forecastView, forecastMonthInput, async (input) =>
    deps.forecasts.view(await deps.projects.get(input.projectId), input.month),
  )

  handle(CHANNELS.forecastCompile, forecastMonthInput, async (input) =>
    deps.forecasts.compile(await deps.projects.get(input.projectId), input.month),
  )

  handle(CHANNELS.projectShape, byProject, async ({ projectId }) =>
    deps.shapes.of(await deps.projects.get(projectId)),
  )

  handle(CHANNELS.projectSheets, byProject, async ({ projectId }) =>
    deps.projectSheets.list(await deps.projects.get(projectId)),
  )

  handle(CHANNELS.forecastOrdersRead, byProject, async ({ projectId }) =>
    deps.forecasts.readOrders(await deps.projects.get(projectId)),
  )

  handle(CHANNELS.progressSettingsGet, byProject, async ({ projectId }) =>
    deps.progress.settings(await deps.projects.get(projectId)),
  )

  handle(CHANNELS.progressSettingsSave, progressSettingsInput, async (input) =>
    deps.progress.saveSettings(await deps.projects.get(input.projectId), input.settings),
  )

  handle(CHANNELS.progressCandidates, byProject, async ({ projectId }) =>
    deps.progress.candidates(await deps.projects.get(projectId)),
  )

  handle(CHANNELS.progressView, byProject, async ({ projectId }) =>
    deps.progress.view(await deps.projects.get(projectId)),
  )

  handle(CHANNELS.progressRegisterInvoices, byProject, async ({ projectId }) =>
    deps.progress.registerInvoices(await deps.projects.get(projectId)),
  )

  handle(CHANNELS.progressCompile, progressCompileInput, async (input) =>
    deps.progress.compile(await deps.projects.get(input.projectId), input.n),
  )

  handle(CHANNELS.alignmentSettingsGet, byProject, async ({ projectId }) =>
    deps.alignments.settings(await deps.projects.get(projectId)),
  )

  handle(CHANNELS.alignmentSettingsSave, alignmentSettingsInput, async (input) =>
    deps.alignments.saveSettings(await deps.projects.get(input.projectId), input.settings),
  )

  handle(CHANNELS.alignmentView, byProject, async ({ projectId }) =>
    deps.alignments.view(await deps.projects.get(projectId)),
  )

  handle(CHANNELS.alignmentChoices, byProject, async ({ projectId }) =>
    deps.alignments.choices(await deps.projects.get(projectId)),
  )

  handle(CHANNELS.alignmentExport, byProject, async ({ projectId }) =>
    deps.alignments.exportMissing(await deps.projects.get(projectId)),
  )

  handle(CHANNELS.evidenceOpen, evidenceInput, async ({ projectId, path }) => {
    const project = await deps.projects.get(projectId)
    // Only a file the reader accepts as part of the project is handed to the system.
    const found = await deps.evidence.read(project.folder, path)
    if (found.kind !== 'found') return null
    // The file is judged and opened by where it really is: a link named as a document that leads
    // to a script or a program of a shared folder is never run from a click on a source.
    const file = await realpath(resolve(project.folder, path))
    if (opensAsDocument(file)) await shell.openPath(file)
    else shell.showItemInFolder(file)
    return null
  })
}

/** Makes the function that answers a channel, after `guard` has let the request through. */
function handler(guard: () => void) {
  return function handle<Input, Output>(
    channel: string,
    schema: z.ZodType<Input>,
    run: (input: Input) => Promise<Output>,
  ): void {
    ipcMain.handle(channel, async (_event, raw: unknown): Promise<Result<Output>> => {
      try {
        guard()
        return { ok: true, value: await run(schema.parse(raw)) }
      } catch (error) {
        if (isDomainError(error)) return { ok: false, code: error.code }
        console.error(`[octo] ${channel} failed`, error)
        return { ok: false, code: UNEXPECTED_ERROR }
      }
    })
  }
}
