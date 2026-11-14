import type { AgentProgress, AgentStatus, FeedView, MailSourceView } from '@octo/application'
import type {
  DomainErrorCode,
  FeedConfig,
  FeedName,
  MailSourceConfig,
  Project,
  QuestionRecord,
  SourceRun,
  SourceState,
} from '@octo/domain'

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
  mailGet: 'sources:mail:get',
  mailSave: 'sources:mail:save',
  mailSync: 'sources:mail:sync',
  feedGet: 'sources:feed:get',
  feedSave: 'sources:feed:save',
  feedSync: 'sources:feed:sync',
  documentsGet: 'sources:documents:get',
  documentsConvert: 'sources:documents:convert',
  sourcesChanged: 'sources:changed',
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
  mailSource(projectId: string): Promise<Result<MailSourceView>>
  /** Null switches the mail of the project off. */
  saveMailSource(
    projectId: string,
    config: MailSourceConfig | null,
  ): Promise<Result<MailSourceView>>
  /** Reads the new mail now. A failure of the reading is in the run, not in the result. */
  syncMail(projectId: string): Promise<Result<SourceRun>>
  feed(projectId: string, feed: FeedName): Promise<Result<FeedView>>
  /**
   * Checks the configuration against the system and saves it. A null secret keeps the one
   * already stored; a null configuration switches the feed off.
   */
  saveFeed(
    projectId: string,
    feed: FeedName,
    config: FeedConfig | null,
    secret: string | null,
  ): Promise<Result<FeedView>>
  syncFeed(projectId: string, feed: FeedName): Promise<Result<SourceRun>>
  documentsState(projectId: string): Promise<Result<SourceState>>
  /** Writes the text of the Office and PDF files of the project beside them, now. */
  convertDocuments(projectId: string): Promise<Result<SourceRun>>
  /** Returns the function that stops listening. */
  onProgress(listener: (projectId: string, progress: AgentProgress) => void): () => void
  /** Tells when a periodic reading has ended for a project. */
  onSourcesChanged(listener: (projectId: string) => void): () => void
}
