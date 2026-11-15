import type {
  AgentProgress,
  AgentStatus,
  AlignmentFile,
  AlignmentView,
  DashboardRange,
  DashboardView,
  ExportCandidates,
  FeedingStatus,
  FeedingStep,
  FeedView,
  ForecastFile,
  ForecastView,
  HoursCandidates,
  HoursView,
  MailSourceView,
  ProgressFile,
  ProgressView,
  TrackerHoursRun,
  TrackerSnapshotRun,
} from '@octo/application'
import type {
  AlignmentSettings,
  DashboardSettings,
  Deliverable,
  DeliverableKind,
  DomainErrorCode,
  FeedChoices,
  FeedConfig,
  FeedName,
  ForecastSettings,
  HoursPeriod,
  HoursSettings,
  MailPreview,
  MailSourceConfig,
  OwnKindInput,
  ProgressSettings,
  Project,
  ProjectTeam,
  QuestionRecord,
  RestoreOutcome,
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
  kindSave: 'deliverables:kind:save',
  kindRemove: 'deliverables:kind:remove',
  deliverablesList: 'deliverables:list',
  deliverablesStart: 'deliverables:start',
  deliverablesRevise: 'deliverables:revise',
  deliverablesApprove: 'deliverables:approve',
  deliverablesProgress: 'deliverables:progress',
  instructionsGet: 'deliverables:instructions:get',
  instructionsSave: 'deliverables:instructions:save',
  letterheadGet: 'deliverables:letterhead:get',
  letterheadChoose: 'deliverables:letterhead:choose',
  letterheadRemove: 'deliverables:letterhead:remove',
  deckModelGet: 'deliverables:deck:get',
  deckModelChoose: 'deliverables:deck:choose',
  deckModelRemove: 'deliverables:deck:remove',
  feedGet: 'sources:feed:get',
  feedSave: 'sources:feed:save',
  feedSync: 'sources:feed:sync',
  documentsGet: 'sources:documents:get',
  documentsConvert: 'sources:documents:convert',
  dashboardSettingsGet: 'dashboard:settings:get',
  dashboardSettingsSave: 'dashboard:settings:save',
  dashboardCandidates: 'dashboard:candidates',
  dashboardView: 'dashboard:view',
  hoursSettingsGet: 'hours:settings:get',
  hoursSettingsSave: 'hours:settings:save',
  hoursCandidates: 'hours:candidates',
  hoursView: 'hours:view',
  hoursReadTracker: 'hours:tracker:read',
  forecastSettingsGet: 'forecast:settings:get',
  forecastSettingsSave: 'forecast:settings:save',
  forecastCandidates: 'forecast:candidates',
  forecastView: 'forecast:view',
  forecastCompile: 'forecast:compile',
  progressSettingsGet: 'progress:settings:get',
  progressSettingsSave: 'progress:settings:save',
  progressCandidates: 'progress:candidates',
  progressView: 'progress:view',
  progressCompile: 'progress:compile',
  alignmentSettingsGet: 'alignment:settings:get',
  alignmentSettingsSave: 'alignment:settings:save',
  alignmentView: 'alignment:view',
  alignmentExport: 'alignment:export',
  teamGet: 'team:get',
  teamSave: 'team:save',
  projectsCreate: 'projects:create',
  dashboardReadTracker: 'dashboard:tracker:read',
  backupSave: 'backup:save',
  backupRestore: 'backup:restore',
  sourcesChanged: 'sources:changed',
} as const

export type SavedBackup = { file: string; projects: number }

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
  /** The kinds Octo ships with, then the ones the PM defined for this project. */
  deliverableCatalog(projectId: string): Promise<Result<DeliverableKind[]>>
  /** Keeps a kind the PM defined in words for this project. */
  saveDeliverableKind(projectId: string, input: OwnKindInput): Promise<Result<DeliverableKind>>
  removeDeliverableKind(projectId: string, kindId: string): Promise<Result<null>>
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
  /** Whether the project has a letterhead its Word files are written on. */
  hasLetterhead(projectId: string): Promise<Result<boolean>>
  /** Lets the PM choose a Word document as letterhead; false when the PM closes the dialog. */
  chooseLetterhead(projectId: string): Promise<Result<boolean>>
  removeLetterhead(projectId: string): Promise<Result<null>>
  /** Whether the project has a deck its slides are written on. */
  hasDeckModel(projectId: string): Promise<Result<boolean>>
  /** Lets the PM choose a presentation as deck; false when the PM closes the dialog. */
  chooseDeckModel(projectId: string): Promise<Result<boolean>>
  removeDeckModel(projectId: string): Promise<Result<null>>
  dashboardSettings(projectId: string): Promise<Result<DashboardSettings>>
  saveDashboardSettings(
    projectId: string,
    settings: DashboardSettings,
  ): Promise<Result<DashboardSettings>>
  /** Tracker exports found in the project folder, to propose to the PM. */
  dashboardCandidates(projectId: string): Promise<Result<ExportCandidates>>
  /** The dashboard over a period; every number is computed by the app from the tracker export. */
  dashboardView(projectId: string, range: DashboardRange): Promise<Result<DashboardView>>
  hoursSettings(projectId: string): Promise<Result<HoursSettings>>
  saveHoursSettings(projectId: string, settings: HoursSettings): Promise<Result<HoursSettings>>
  /** Where the timesheets and the tracker hours seem to be kept in the project folder. */
  hoursCandidates(projectId: string): Promise<Result<HoursCandidates>>
  /** Timesheet hours against tracker hours over a period, person by person. */
  hoursView(projectId: string, period: HoursPeriod): Promise<Result<HoursView>>
  /** Reads the hours of the period from the tracker, with the credential of its feed. */
  readTrackerHours(projectId: string, period: HoursPeriod): Promise<Result<TrackerHoursRun>>
  /** Reads Azure DevOps as it is now, with the credential of its source, for the dashboard. */
  readTrackerSnapshot(projectId: string): Promise<Result<TrackerSnapshotRun>>
  forecastSettings(projectId: string): Promise<Result<ForecastSettings>>
  saveForecastSettings(
    projectId: string,
    settings: ForecastSettings,
  ): Promise<Result<ForecastSettings>>
  /** Spreadsheets of the project that look like the model of the administration. */
  forecastCandidates(projectId: string): Promise<Result<string[]>>
  /** What the model would hold for a month (`YYYY-MM`), computed and not written. */
  forecastView(projectId: string, month: string): Promise<Result<ForecastView>>
  /** Writes a filled copy of the model for the month; the model itself is never touched. */
  compileForecast(projectId: string, month: string): Promise<Result<ForecastFile>>
  progressSettings(projectId: string): Promise<Result<ProgressSettings>>
  saveProgressSettings(
    projectId: string,
    settings: ProgressSettings,
  ): Promise<Result<ProgressSettings>>
  /** Spreadsheets of the project that look like the progress form of the client. */
  progressCandidates(projectId: string): Promise<Result<string[]>>
  /** The share of each order position after each request. */
  progressView(projectId: string): Promise<Result<ProgressView>>
  /** Writes the filled form of request `n`; the empty form is never touched. */
  compileProgress(projectId: string, n: number): Promise<Result<ProgressFile>>
  alignmentSettings(projectId: string): Promise<Result<AlignmentSettings>>
  saveAlignmentSettings(
    projectId: string,
    settings: AlignmentSettings,
  ): Promise<Result<AlignmentSettings>>
  /** The client's items of the sprint against the supplier's tickets. */
  alignmentView(projectId: string): Promise<Result<AlignmentView>>
  /** Writes the missing items as a file the supplier's tracker imports. */
  exportMissingTickets(projectId: string): Promise<Result<AlignmentFile>>
  /** The people and the calendar of the project. */
  team(projectId: string): Promise<Result<ProjectTeam>>
  saveTeam(projectId: string, team: ProjectTeam): Promise<Result<ProjectTeam>>
  /**
   * Makes the folder of a new project where the PM chooses and adds it; null when the PM closes
   * the dialog.
   */
  createProject(name: string): Promise<Result<Project | null>>
  /**
   * Lets the PM choose where to write the backup: the list of the projects and the state of
   * their readings, never the credentials. Null when the PM closes the dialog.
   */
  saveBackup(): Promise<Result<SavedBackup | null>>
  /**
   * Lets the PM choose a backup and, for each project whose folder is not where it was, where
   * it is now. Null when the PM closes the first dialog.
   */
  restoreBackup(): Promise<Result<RestoreOutcome | null>>
  /** Tells what the writer is doing. Returns the function that stops listening. */
  onDeliverableProgress(listener: (projectId: string, progress: AgentProgress) => void): () => void
  /** Returns the function that stops listening. */
  onProgress(listener: (projectId: string, progress: AgentProgress) => void): () => void
  /** Tells when a periodic reading has ended for a project. */
  onSourcesChanged(listener: (projectId: string) => void): () => void
}
