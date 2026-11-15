import {
  type CheckedAnswer,
  checkAnswer,
  cleanQuestion,
  type DomainErrorCode,
  type DraftAnswer,
  type Evidence,
  isDomainError,
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
}

export type AskQuestionInput = {
  project: Project
  question: string
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
  ): Promise<Pick<QuestionRecord, 'answer' | 'error' | 'model'>> {
    let model: string | null = null
    try {
      const chosen = (await deps.models?.(input.project))?.ask ?? null
      const draft = await deps.agent.ask({
        projectFolder: input.project.folder,
        question,
        model: chosen,
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
    const result = await outcome(input, question)
    const record: QuestionRecord = {
      id: deps.ids.next(),
      projectId: input.project.id,
      question,
      askedAt: startedAt.toISOString(),
      durationMs: deps.clock.now().getTime() - startedAt.getTime(),
      ...result,
    }
    await deps.questions.append(input.project.folder, record)
    return record
  }
}
