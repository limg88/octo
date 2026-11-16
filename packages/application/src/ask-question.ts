import {
  type CheckedAnswer,
  type ConversationTurn,
  checkAnswer,
  cleanQuestion,
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
  QuestionLog,
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
}

export type AskQuestionInput = {
  project: Project
  question: string
  /** The conversation the question continues; absent or null: it starts a new one. */
  conversationId?: string | null
  onProgress?: (progress: AgentProgress) => void
  signal?: AbortSignal
}

export type AskQuestion = (input: AskQuestionInput) => Promise<QuestionRecord>

/**
 * Asks the agent, then checks every citation against the files of the project.
 * A failure of the agent is an outcome of the question, kept in the history with its code.
 */
export function createAskQuestion(deps: AskQuestionDeps): AskQuestion {
  async function check(project: Project, draft: DraftAnswer): Promise<CheckedAnswer> {
    const paths = [...new Set(draft.citations.map((citation) => citation.path))]
    const entries = await Promise.all(
      paths.map(
        async (path): Promise<[string, Evidence]> => [
          path,
          await deps.evidence.read(project.folder, path),
        ],
      ),
    )
    return checkAnswer(draft, new Map(entries))
  }

  async function outcome(
    input: AskQuestionInput,
    question: string,
    history: ConversationTurn[],
  ): Promise<Pick<QuestionRecord, 'answer' | 'error' | 'model'>> {
    let model: string | null = null
    try {
      const chosen = (await deps.models?.(input.project))?.ask ?? null
      const draft = await deps.agent.ask({
        projectFolder: input.project.folder,
        question,
        history,
        model: chosen,
        liveSources: (await deps.liveSources?.(input.project)) ?? [],
        onModel: (used) => {
          model = used
        },
        ...(input.onProgress ? { onProgress: input.onProgress } : {}),
        ...(input.signal ? { signal: input.signal } : {}),
      })
      return { answer: await check(input.project, draft), error: null, model }
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
    const result = await outcome(input, question, history)
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
