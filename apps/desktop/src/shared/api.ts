import type { AgentProgress, AgentStatus } from '@octo/application'
import type { DomainErrorCode, Project, QuestionRecord } from '@octo/domain'

/** A failure that is not one of the expected ones: the detail is in the app's log. */
export const UNEXPECTED_ERROR = 'unexpected'
export type ErrorCode = DomainErrorCode | typeof UNEXPECTED_ERROR

export type Result<T> = { ok: true; value: T } | { ok: false; code: ErrorCode }

export const CHANNELS = {
  agentStatus: 'agent:status',
  projectsList: 'projects:list',
  projectsAdd: 'projects:add',
  projectsRemove: 'projects:remove',
  questionsList: 'questions:list',
  questionsAsk: 'questions:ask',
  questionsCancel: 'questions:cancel',
  questionsProgress: 'questions:progress',
  evidenceOpen: 'evidence:open',
} as const

/** What the interface can ask the app. It is the only door between the two. */
export type OctoApi = {
  agentStatus(): Promise<Result<AgentStatus>>
  listProjects(): Promise<Result<Project[]>>
  /** Lets the PM choose a folder; null when the PM closes the dialog. */
  addProject(): Promise<Result<Project | null>>
  removeProject(projectId: string): Promise<Result<null>>
  listQuestions(projectId: string): Promise<Result<QuestionRecord[]>>
  ask(projectId: string, question: string): Promise<Result<QuestionRecord>>
  cancelAsk(projectId: string): Promise<Result<null>>
  openEvidence(projectId: string, path: string): Promise<Result<null>>
  /** Returns the function that stops listening. */
  onProgress(listener: (projectId: string, progress: AgentProgress) => void): () => void
}
