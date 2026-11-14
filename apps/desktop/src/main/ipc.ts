import { resolve } from 'node:path'
import type {
  AgentRunner,
  AskQuestion,
  Documents,
  EvidenceReader,
  Projects,
  QuestionLog,
  Sources,
} from '@octo/application'
import { isDomainError } from '@octo/domain'
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
const mailSaveInput = byProject.extend({
  config: z
    .object({
      since: z.string().max(MAX_RULE_LENGTH),
      keywords: ruleList,
      folders: ruleList,
      excludeSenders: ruleList,
      keepQuoted: z.boolean(),
      targetFolder: z.string().max(MAX_RULE_LENGTH),
    })
    .nullable(),
})

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

  handle(CHANNELS.mailSave, mailSaveInput, async ({ projectId, config }) =>
    deps.sources.saveMail(await deps.projects.get(projectId), config),
  )

  handle(CHANNELS.mailSync, byProject, async ({ projectId }) =>
    deps.sources.syncMail(await deps.projects.get(projectId)),
  )

  handle(CHANNELS.documentsGet, byProject, async ({ projectId }) =>
    deps.documents.state(await deps.projects.get(projectId)),
  )

  handle(CHANNELS.documentsConvert, byProject, async ({ projectId }) =>
    deps.documents.convert(await deps.projects.get(projectId)),
  )

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
