import {
  ANALYSIS_FOLDER,
  type ChatAttachment,
  type CheckedAnswer,
  type ConversationTurn,
  checkAnswer,
  cleanQuestion,
  DomainError,
  type DomainErrorCode,
  type DraftAnswer,
  type Evidence,
  earlierTurns,
  isDomainError,
  type LiveSource,
  type ModelSettings,
  type Project,
  type QuestionRecord,
} from '@octo/domain'
import type {
  AgentProgress,
  AgentRunner,
  Clock,
  EvidenceReader,
  IdGenerator,
  MemoryWriter,
  QuestionLog,
  WorkFolders,
} from './ports.ts'

export type AskQuestionDeps = {
  agent: AgentRunner
  evidence: EvidenceReader
  questions: QuestionLog
  clock: Clock
  ids: IdGenerator
  /** The models the PM chose for the project; without, the default of Claude Code. */
  models?: (project: Project) => Promise<ModelSettings>
  /** What Octo reads directly for the project, told to the agent with every question. */
  liveSources?: (project: Project) => Promise<LiveSource[]>
  /** Where the agent writes when it computes; without, no question is answered with calculations. */
  work?: WorkFolders
  /** Writes in the project what the PM keeps of a calculation. */
  writer?: MemoryWriter
  /** What the PM attached to a conversation: read by who answers, with the rest of the project. */
  attachments?: (project: Project, conversationId: string) => Promise<ChatAttachment[]>
}

export type AskQuestionInput = {
  project: Project
  question: string
  /** The conversation the question continues; absent or null: it starts a new one. */
  conversationId?: string | null
  /** True to let the agent run calculations inside its fence, writing in a work folder. */
  compute?: boolean
  onProgress?: (progress: AgentProgress) => void
  signal?: AbortSignal
}

export type AskQuestion = (input: AskQuestionInput) => Promise<QuestionRecord>
/**
 * Copies into the project the files a question with calculations left in its work folder, and
 * returns the question with the folder they are in. The agent never writes in the project:
 * Octo does, when the PM says so.
 */
export type KeepWork = (project: Project, questionId: string) => Promise<QuestionRecord>

/**
 * Asks the agent, then checks every citation against the files of the project.
 * A failure of the agent is an outcome of the question, kept in the history with its code.
 */
export function createAskQuestion(deps: AskQuestionDeps): AskQuestion {
  async function check(
    project: Project,
    draft: DraftAnswer,
    workFiles: readonly string[] = [],
  ): Promise<CheckedAnswer> {
    const cited = draft.citations.map((citation) => citation.path)
    const computedFrom = (draft.tables ?? []).flatMap((table) => table.sources)
    const paths = [...new Set([...cited, ...computedFrom])]
    const entries = await Promise.all(
      paths.map(
        async (path): Promise<[string, Evidence]> => [
          path,
          await deps.evidence.read(project.folder, path),
        ],
      ),
    )
    return checkAnswer(draft, new Map(entries), workFiles)
  }

  async function outcome(
    input: AskQuestionInput,
    question: string,
    history: ConversationTurn[],
    id: string,
    conversationId: string,
  ): Promise<Pick<QuestionRecord, 'answer' | 'error' | 'model' | 'work'>> {
    let model: string | null = null
    try {
      const chosen = (await deps.models?.(input.project))?.ask ?? null
      const attached = (await deps.attachments?.(input.project, conversationId)) ?? []
      const request = {
        projectFolder: input.project.folder,
        question,
        history,
        attachments: attached.map((file) => file.path),
        model: chosen,
        liveSources: (await deps.liveSources?.(input.project)) ?? [],
        onModel: (used: string) => {
          model = used
        },
        ...(input.onProgress ? { onProgress: input.onProgress } : {}),
        ...(input.signal ? { signal: input.signal } : {}),
      }
      if (!input.compute) {
        return {
          answer: await check(input.project, await deps.agent.ask(request)),
          error: null,
          model,
        }
      }
      if (!deps.work) throw new DomainError('fence_unavailable')
      const workFolder = await deps.work.create(input.project.id, id)
      const draft = await deps.agent.compute({ ...request, workFolder })
      const files = await deps.work.files(input.project.id, id)
      return {
        answer: await check(input.project, draft, files),
        error: null,
        model,
        work: { files, keptIn: null },
      }
    } catch (error) {
      if (!isDomainError(error)) throw error
      return { answer: null, error: error.code satisfies DomainErrorCode, model }
    }
  }

  return async function askQuestion(input) {
    const question = cleanQuestion(input.question)
    const startedAt = deps.clock.now()
    const id = deps.ids.next()
    const conversationId = input.conversationId ?? deps.ids.next()
    // A conversation just started has nothing before it: the history is not even read.
    const history = input.conversationId
      ? earlierTurns(await deps.questions.list(input.project.folder), conversationId)
      : []
    const result = await outcome(input, question, history, id, conversationId)
    const record: QuestionRecord = {
      id,
      projectId: input.project.id,
      question,
      askedAt: startedAt.toISOString(),
      durationMs: deps.clock.now().getTime() - startedAt.getTime(),
      conversationId,
      ...result,
    }
    await deps.questions.append(input.project.folder, record)
    return record
  }
}

const DAY_LENGTH = 10
const ID_LENGTH = 8

export function createKeepWork(
  deps: Required<Pick<AskQuestionDeps, 'work' | 'writer'>> & Pick<AskQuestionDeps, 'questions'>,
): KeepWork {
  return async function keepWork(project, questionId) {
    const record = (await deps.questions.list(project.folder)).find(
      (candidate) => candidate.id === questionId,
    )
    if (!record?.work || record.work.files.length === 0) throw new DomainError('work_not_found')
    if (record.work.keptIn !== null) return record
    const folder = `${ANALYSIS_FOLDER}/${record.askedAt.slice(0, DAY_LENGTH)}-${record.id.slice(0, ID_LENGTH)}`
    await deps.writer.claim(project.folder)
    for (const name of record.work.files) {
      const bytes = await deps.work.read(project.id, record.id, name)
      await deps.writer.writeBytes(project.folder, `${folder}/${name}`, bytes)
    }
    const kept = { ...record, work: { ...record.work, keptIn: folder } }
    await deps.questions.append(project.folder, kept)
    return kept
  }
}
