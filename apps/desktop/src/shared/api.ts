import type {
  AgentProgress,
  AgentStatus,
  FeedingStatus,
  FeedingStep,
  FeedView,
  MailSourceView,
} from '@octo/application'
import type {
  Deliverable,
  DeliverableKind,
  DomainErrorCode,
  FeedChoices,
  FeedConfig,
  FeedName,
  MailPreview,
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
  mailPreview: 'sources:mail:preview',
  feedChoices: 'sources:feed:choices',
  feedingStatus: 'feeding:status',
  feedingFill: 'feeding:fill',
  feedingStep: 'feeding:step',
  deliverablesCatalog: 'deliverables:catalog',
  deliverablesList: 'deliverables:list',
  deliverablesStart: 'deliverables:start',
  deliverablesRevise: 'deliverables:revise',
  deliverablesApprove: 'deliverables:approve',
  deliverablesProgress: 'deliverables:progress',
  instructionsGet: 'deliverables:instructions:get',
  instructionsSave: 'deliverables:instructions:save',
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
  /** What these rules would bring in from the mail archive, without writing anything. */
  previewMail(projectId: string, config: MailSourceConfig): Promise<Result<MailPreview>>
  /** Which sources of the project are set up. */
  feedingStatus(projectId: string): Promise<Result<FeedingStatus>>
  /** Feeds the project from everything set up, one source after the other. */
  fill(projectId: string): Promise<Result<FeedingStep[]>>
  /** Tells each step of a filling as it ends. Returns the function that stops listening. */
  onFeedingStep(listener: (projectId: string, step: FeedingStep) => void): () => void
  /** What the credential sees in the system, to pick from. A null secret uses the stored one. */
  feedChoices(
    projectId: string,
    feed: FeedName,
    config: FeedConfig,
    secret: string | null,
  ): Promise<Result<FeedChoices>>
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
  /** The kinds of deliverable Octo knows how to write. */
  deliverableCatalog(): Promise<Result<DeliverableKind[]>>
  listDeliverables(projectId: string): Promise<Result<Deliverable[]>>
  /** Writes the first draft. A failure of the writing is in the deliverable, not in the result. */
  startDeliverable(
    projectId: string,
    kindId: string,
    inputs: Record<string, string>,
  ): Promise<Result<Deliverable>>
  /** Writes the draft again with a change asked in words. */
  reviseDeliverable(
    projectId: string,
    deliverableId: string,
    request: string,
  ): Promise<Result<Deliverable>>
  approveDeliverable(projectId: string, deliverableId: string): Promise<Result<Deliverable>>
  /** What the PM added, for this project, to how a kind is written. */
  deliverableInstructions(projectId: string, kindId: string): Promise<Result<string>>
  saveDeliverableInstructions(
    projectId: string,
    kindId: string,
    text: string,
  ): Promise<Result<null>>
  /** Tells what the writer is doing. Returns the function that stops listening. */
  onDeliverableProgress(listener: (projectId: string, progress: AgentProgress) => void): () => void
  /** Returns the function that stops listening. */
  onProgress(listener: (projectId: string, progress: AgentProgress) => void): () => void
  /** Tells when a periodic reading has ended for a project. */
  onSourcesChanged(listener: (projectId: string) => void): () => void
}
