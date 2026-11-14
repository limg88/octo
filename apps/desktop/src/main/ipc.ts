import { resolve } from 'node:path'
import type {
  AgentRunner,
  AskQuestion,
  Deliverables,
  Documents,
  EvidenceReader,
  Feeding,
  Feeds,
  Projects,
  QuestionLog,
  Sources,
} from '@octo/application'
import { FEED_NAMES, isDomainError, WAREHOUSE_TLS_MODES } from '@octo/domain'
import { type BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { z } from 'zod'
import { CHANNELS, type Result, UNEXPECTED_ERROR } from '../shared/api.ts'

export type IpcDeps = {
  window: BrowserWindow
  agent: AgentRunner
  projects: Projects
  questions: QuestionLog
  evidence: EvidenceReader
  askQuestion: AskQuestion
  sources: Sources
  documents: Documents
  feeds: Feeds
  feeding: Feeding
  deliverables: Deliverables
  folderDialogTitle: string
}

const MAX_QUESTION_LENGTH = 4000
const MAX_RULE_LENGTH = 300
const none = z.undefined()
const byProject = z.object({ projectId: z.string().min(1) })
const askInput = byProject.extend({ question: z.string().max(MAX_QUESTION_LENGTH) })
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

const MAX_SECRET_LENGTH = 4000
const rule = z.string().max(MAX_RULE_LENGTH)
const byFeed = byProject.extend({ feed: z.enum(FEED_NAMES) })
const feedBase = { since: rule, targetFolder: rule }
const secret = z.string().max(MAX_SECRET_LENGTH).nullable()
/** The configuration is checked against the feed it is for: no field of another feed passes. */
const feedConfigs = {
  ado: z.object({ ...feedBase, organization: rule, project: rule, areas: ruleList }),
  jira: z.object({ ...feedBase, site: rule, email: rule, projects: ruleList }),
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
  byProject.extend({ feed: z.literal('dwsi'), secret, config: feedConfigs.dwsi }),
])
const feedSaveInput = z.discriminatedUnion('feed', [
  byProject.extend({ feed: z.literal('ado'), secret, config: feedConfigs.ado.nullable() }),
  byProject.extend({ feed: z.literal('jira'), secret, config: feedConfigs.jira.nullable() }),
  byProject.extend({ feed: z.literal('dwsi'), secret, config: feedConfigs.dwsi.nullable() }),
])

const MAX_INPUT_LENGTH = 4000
const MAX_INSTRUCTIONS_LENGTH = 20_000
/** An id Octo made, used in a file name: letters, digits and dashes only. */
const id = z.string().regex(/^[A-Za-z0-9-]{1,80}$/)
const byKind = byProject.extend({ kindId: id })
const byDeliverable = byProject.extend({ deliverableId: id })
const deliverableStartInput = byKind.extend({
  inputs: z.record(z.string().max(MAX_RULE_LENGTH), z.string().max(MAX_INPUT_LENGTH)),
})
const deliverableReviseInput = byDeliverable.extend({ request: z.string().max(MAX_INPUT_LENGTH) })
const instructionsSaveInput = byKind.extend({ text: z.string().max(MAX_INSTRUCTIONS_LENGTH) })

/** Every request from the interface is validated here, and every failure leaves as a code. */
export function registerIpc(deps: IpcDeps): void {
  const running = new Map<string, AbortController>()

  handle(CHANNELS.agentStatus, none, () => deps.agent.status())
  handle(CHANNELS.projectsList, none, () => deps.projects.list())

  handle(CHANNELS.projectsAdd, none, async () => {
    const choice = await dialog.showOpenDialog(deps.window, {
      title: deps.folderDialogTitle,
      properties: ['openDirectory'],
    })
    const folder = choice.filePaths[0]
    return choice.canceled || !folder ? null : deps.projects.add(folder)
  })

  handle(CHANNELS.projectsRemove, byProject, async ({ projectId }) => {
    running.get(projectId)?.abort()
    await deps.projects.remove(projectId)
    return null
  })

  handle(CHANNELS.questionsList, byProject, async ({ projectId }) => {
    const project = await deps.projects.get(projectId)
    return deps.questions.list(project.id)
  })

  handle(CHANNELS.questionsAsk, askInput, async ({ projectId, question }) => {
    const project = await deps.projects.get(projectId)
    running.get(projectId)?.abort()
    const controller = new AbortController()
    running.set(projectId, controller)
    try {
      return await deps.askQuestion({
        project,
        question,
        signal: controller.signal,
        onProgress: (progress) =>
          deps.window.webContents.send(CHANNELS.questionsProgress, projectId, progress),
      })
    } finally {
      if (running.get(projectId) === controller) running.delete(projectId)
    }
  })

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

  handle(CHANNELS.deliverablesCatalog, none, async () => [...deps.deliverables.catalog()])

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

  handle(CHANNELS.evidenceOpen, evidenceInput, async ({ projectId, path }) => {
    const project = await deps.projects.get(projectId)
    // Only a file the reader accepts as part of the project is handed to the system.
    const found = await deps.evidence.read(project.folder, path)
    if (found.kind === 'found') await shell.openPath(resolve(project.folder, path))
    return null
  })
}

function handle<Input, Output>(
  channel: string,
  schema: z.ZodType<Input>,
  run: (input: Input) => Promise<Output>,
): void {
  ipcMain.handle(channel, async (_event, raw: unknown): Promise<Result<Output>> => {
    try {
      return { ok: true, value: await run(schema.parse(raw)) }
    } catch (error) {
      if (isDomainError(error)) return { ok: false, code: error.code }
      console.error(`[octo] ${channel} failed`, error)
      return { ok: false, code: UNEXPECTED_ERROR }
    }
  })
}
