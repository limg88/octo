import type {
  AgentProgress,
  AgentStatus,
  DashboardComment,
  DashboardRange,
  DashboardView,
  ExportCandidates,
  FeedingStatus,
  FeedingStep,
  FeedView,
  ForecastFile,
  ForecastOrdersRun,
  ForecastView,
  HoursCandidates,
  HoursView,
  KindCorrection,
  MailSourceView,
  MeetingsSourceView,
  ProjectOverview,
  ReadingView,
  Reminder,
  ScriptedCorrection,
  ScriptedKept,
  ScriptedRun,
  ScriptedSummary,
  SessionView,
  SheetStep,
  TodayView,
  TrackerHoursRun,
  TrackerSnapshotRun,
} from '@octo/application'
import type {
  Assignment,
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
  Lifetime,
  MailPreview,
  MailSourceConfig,
  MailTurn,
  MeetingsSourceConfig,
  ModelSettings,
  OpenPointChange,
  OwnKindInput,
  Preferences,
  Project,
  ProjectTeam,
  QuestionRecord,
  RestoreOutcome,
  RiskChange,
  RiskRegister,
  SourceRun,
  StoredMeeting,
  TemplateFormat,
  TodayItem,
  TodayKind,
  UpdateOffer,
  UpdateProgress,
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
  projectsRestore: 'projects:restore',
  projectsRelocate: 'projects:relocate',
  projectsChoosePath: 'projects:choose-path',
  questionsList: 'questions:list',
  questionsAsk: 'questions:ask',
  questionsKeepWork: 'questions:keep-work',
  questionsCancel: 'questions:cancel',
  questionsProgress: 'questions:progress',
  evidenceOpen: 'evidence:open',
  mailGet: 'sources:mail:get',
  mailSave: 'sources:mail:save',
  mailSync: 'sources:mail:sync',
  mailPreview: 'sources:mail:preview',
  meetingsGet: 'sources:meetings:get',
  meetingsSave: 'sources:meetings:save',
  meetingsSync: 'sources:meetings:sync',
  meetingsChooseRoot: 'sources:meetings:choose-root',
  meetingsImported: 'sources:meetings:imported',
  meetingsPlace: 'sources:meetings:place',
  meetingsDestinations: 'sources:meetings:destinations',
  meetingsMove: 'sources:meetings:move',
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
  deliverablesDraft: 'deliverables:draft',
  scriptedList: 'scripted:list',
  scriptedInstall: 'scripted:install',
  scriptedRun: 'scripted:run',
  scriptedKeep: 'scripted:keep',
  scriptedCorrect: 'scripted:correct',
  scriptedApprove: 'scripted:approve',
  instructionsGet: 'deliverables:instructions:get',
  instructionsSave: 'deliverables:instructions:save',
  kindCorrect: 'deliverables:kind:correct',
  kindCorrectionApprove: 'deliverables:kind:correction:approve',
  kindRestore: 'deliverables:kind:restore',
  kindTemplates: 'deliverables:templates:list',
  kindTemplateChoose: 'deliverables:templates:choose',
  kindTemplateRemove: 'deliverables:templates:remove',
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
  dashboardOpenItem: 'dashboard:item:open',
  dashboardComment: 'dashboard:comment',
  dashboardReminder: 'dashboard:reminder',
  dashboardRefresh: 'dashboard:tracker:refresh',
  hoursSettingsGet: 'hours:settings:get',
  hoursSettingsSave: 'hours:settings:save',
  hoursCandidates: 'hours:candidates',
  hoursView: 'hours:view',
  hoursReadTracker: 'hours:tracker:read',
  hoursReadTimesheets: 'hours:timesheets:read',
  forecastSettingsGet: 'forecast:settings:get',
  forecastSettingsSave: 'forecast:settings:save',
  forecastCandidates: 'forecast:candidates',
  forecastView: 'forecast:view',
  forecastCompile: 'forecast:compile',
  forecastOrdersRead: 'forecast:orders-read',
  projectSheets: 'sheet:list',
  sheetStep: 'sheet:step',
  updateCheck: 'update:check',
  updateInstall: 'update:install',
  updateProgress: 'update:progress',
  updateJustDone: 'update:just-done',
  diskAccessOpen: 'system:disk-access:open',
  teamGet: 'team:get',
  teamSave: 'team:save',
  modelsGet: 'models:get',
  modelsSave: 'models:save',
  projectsCreate: 'projects:create',
  dashboardReadTracker: 'dashboard:tracker:read',
  backupSave: 'backup:save',
  backupRestore: 'backup:restore',
  sourcesChanged: 'sources:changed',
  sessionGet: 'session:get',
  sessionSignIn: 'session:sign-in',
  sessionConfigure: 'session:configure',
  sessionCancel: 'session:cancel',
  sessionSignOut: 'session:sign-out',
  todayView: 'today:view',
  todayDecide: 'today:decide',
  todayMute: 'today:mute',
  todayMailTurn: 'today:mail-turn',
  todayAddresses: 'today:addresses',
  todayEvaluate: 'today:evaluate',
  todayClose: 'today:close',
  todayCancel: 'today:cancel',
  todayProgress: 'today:progress',
  todayOverview: 'today:overview',
  todayVisited: 'today:visited',
  todayNotify: 'today:notify',
  todayEntered: 'today:entered',
  nextReading: 'sources:next-reading',
  windowFocus: 'window:focus',
  pointsAdd: 'points:add',
  pointsUpdate: 'points:update',
  pointsConfirm: 'points:confirm',
  risksGet: 'risks:get',
  risksPropose: 'risks:propose',
  risksAccept: 'risks:accept',
  risksDismiss: 'risks:dismiss',
  risksAdd: 'risks:add',
  risksUpdate: 'risks:update',
  assignmentGet: 'assignment:get',
  preferencesGet: 'preferences:get',
  preferencesSave: 'preferences:save',
} as const

/** How long a value typed for a deliverable, or a change asked of one, can be. */
export const DELIVERABLE_INPUT_LIMIT = 4000

/** What the PM is asked to choose inside a project. */
export type PathKind = 'file' | 'folder'

export type SavedBackup = { file: string; projects: number }

/** What the interface can ask the app. It is the only door between the two. */
export type OctoApi = {
  agentStatus(): Promise<Result<AgentStatus>>
  listProjects(): Promise<Result<Project[]>>
  /** Lets the PM choose a folder; null when the PM closes the dialog. */
  addProject(): Promise<Result<Project | null>>
  /** Takes the project off the list; nothing of it is deleted. */
  removeProject(projectId: string): Promise<Result<null>>
  /**
   * Lets the PM choose a file (with one of the extensions) or a folder inside the project, and
   * gives it as a path from the project folder; null when the PM closes the dialog.
   */
  chooseProjectPath(
    projectId: string,
    what: PathKind,
    extensions: string[],
  ): Promise<Result<string | null>>
  /** Puts back, as it was, a project taken off the list. */
  restoreProject(projectId: string): Promise<Result<Project>>
  /**
   * Lets the PM say where the folder of a project is now, after it was moved: the project stays
   * the same. Null when the PM closes the dialog.
   */
  relocateProject(projectId: string): Promise<Result<Project | null>>
  listQuestions(projectId: string): Promise<Result<QuestionRecord[]>>
  /** The newer Octo there is for this computer; null when this one is the latest. */
  checkForUpdate(): Promise<Result<UpdateOffer | null>>
  /** Replaces this Octo with the newer one and starts it: when it answers, Octo is closing. */
  installUpdate(): Promise<Result<null>>
  onUpdateProgress(listener: (progress: UpdateProgress) => void): () => void
  /**
   * The version Octo was just updated to, when this is its first start after an update on a
   * system that then takes its permissions away; null otherwise. Told once.
   */
  updateJustDone(): Promise<Result<string | null>>
  /** Opens the settings of the system where Octo is given access to the whole disk. */
  openDiskAccessSettings(): Promise<Result<null>>
  /**
   * Asks in a conversation, or starts one when `conversationId` is null. With `compute` Claude
   * may run calculations inside its fence, writing in a work folder outside the project.
   */
  ask(
    projectId: string,
    question: string,
    conversationId: string | null,
    compute?: boolean,
  ): Promise<Result<QuestionRecord>>
  /** Copies into the project the files a question with calculations left in its work folder. */
  keepWork(projectId: string, questionId: string): Promise<Result<QuestionRecord>>
  /** The deliverables with a script: those of the project, then those the app ships. */
  scriptedDeliverables(projectId: string): Promise<Result<ScriptedSummary[]>>
  /** Starts in the project a deliverable with a script the app ships. */
  installScripted(projectId: string, slug: string): Promise<Result<ScriptedSummary[]>>
  /** Runs the script inside the fence; its files stay in a work folder until they are kept. */
  runScripted(
    projectId: string,
    slug: string,
    parameters: Record<string, string>,
  ): Promise<Result<ScriptedRun>>
  keepScripted(projectId: string, slug: string, runId: string): Promise<Result<ScriptedKept>>
  /** Has Claude change script, data or instructions as asked in words, in a work folder. */
  correctScripted(
    projectId: string,
    slug: string,
    words: string,
  ): Promise<Result<ScriptedCorrection>>
  /** Writes in the project what a correction changed. */
  approveScripted(projectId: string, slug: string, runId: string): Promise<Result<null>>
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
  meetingsSource(projectId: string): Promise<Result<MeetingsSourceView>>
  /** Null switches the meetings of the project off. */
  saveMeetingsSource(
    projectId: string,
    config: MeetingsSourceConfig | null,
  ): Promise<Result<MeetingsSourceView>>
  /** Reads Verbale's folder now. A failure of the reading is in the run, not in the result. */
  syncMeetings(projectId: string): Promise<Result<SourceRun>>
  /** Opens the dialog of the system on the whole computer; null when the PM closes it. */
  chooseMeetingsRoot(): Promise<Result<string | null>>
  /** The meetings the project holds, the newest first. */
  importedMeetings(projectId: string): Promise<Result<StoredMeeting[]>>
  /** Takes into the project a recorded meeting that had none; gives the page of the day back. */
  placeMeeting(
    projectId: string,
    meetingId: string,
    place: 'project' | 'other',
  ): Promise<Result<TodayView>>
  /** The other projects a meeting held here can be moved to. */
  meetingDestinations(projectId: string): Promise<Result<Array<{ id: string; name: string }>>>
  /**
   * Takes a meeting away from the project with the open points that came from it: to another
   * project, or to none (`null`). Gives back the meetings the project still holds.
   */
  moveMeeting(
    projectId: string,
    meetingId: string,
    targetProjectId: string | null,
  ): Promise<Result<StoredMeeting[]>>
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
  documentsState(projectId: string): Promise<Result<ReadingView>>
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
  /** Has Claude write again how a kind of Octo is written; nothing is kept until approved. */
  correctKind(projectId: string, kindId: string, words: string): Promise<Result<KindCorrection>>
  approveKindCorrection(
    projectId: string,
    kindId: string,
    correctionId: string,
  ): Promise<Result<null>>
  /** Goes back to how Octo writes the kind. */
  restoreKind(projectId: string, kindId: string): Promise<Result<null>>
  /** The formats each kind of deliverable has a template in. */
  kindTemplates(projectId: string): Promise<Result<Record<string, TemplateFormat[]>>>
  /**
   * Lets the PM choose a Word document or a presentation as the template of a kind; gives the
   * format taken, or null when the PM closes the dialog.
   */
  chooseKindTemplate(projectId: string, kindId: string): Promise<Result<TemplateFormat | null>>
  removeKindTemplate(
    projectId: string,
    kindId: string,
    format: TemplateFormat,
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
  dashboardView(
    projectId: string,
    range: DashboardRange,
    /** The sprint to show in place of the running one. */
    sprint?: string | null,
  ): Promise<Result<DashboardView>>
  /** Opens an item where the tracker keeps it, in the browser; false when it has no address. */
  openTrackerItem(projectId: string, id: string): Promise<Result<boolean>>
  /** Asks Claude to comment the numbers of a period; the code checks what it says. */
  commentDashboard(projectId: string, range: DashboardRange): Promise<Result<DashboardComment>>
  /** Asks Claude a reminder for an item that waits for an answer: to copy, never sent. */
  draftReminder(projectId: string, id: string): Promise<Result<Reminder>>
  /**
   * Reads Azure DevOps again when the reading the dashboard uses is old; null when there was
   * nothing to read.
   */
  refreshTrackerSnapshot(projectId: string): Promise<Result<TrackerSnapshotRun | null>>
  hoursSettings(projectId: string): Promise<Result<HoursSettings>>
  saveHoursSettings(projectId: string, settings: HoursSettings): Promise<Result<HoursSettings>>
  /** Where the timesheets and the tracker hours seem to be kept in the project folder. */
  hoursCandidates(projectId: string): Promise<Result<HoursCandidates>>
  /** Timesheet hours against tracker hours over a period, person by person. */
  hoursView(projectId: string, period: HoursPeriod): Promise<Result<HoursView>>
  /** Reads the hours of the period from the tracker, with the credential of its feed. */
  readTrackerHours(projectId: string, period: HoursPeriod): Promise<Result<TrackerHoursRun>>
  /** Reads the timesheets of the period from NetSuite, with the credential of its source. */
  readTimesheets(projectId: string, period: HoursPeriod): Promise<Result<TrackerHoursRun>>
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
  /** Reads name and ordered amount of the project codes from the company's system. */
  readForecastOrders(projectId: string): Promise<Result<ForecastOrdersRun>>
  /** Every project code of the project over its whole life, up to the month that runs. */
  projectSheets(projectId: string): Promise<Result<Lifetime[]>>
  /** What the reading of the sheets is doing, step by step: it may ask a year of months. */
  onSheetStep(listener: (projectId: string, step: SheetStep) => void): () => void
  /** The people and the calendar of the project. */
  team(projectId: string): Promise<Result<ProjectTeam>>
  saveTeam(projectId: string, team: ProjectTeam): Promise<Result<ProjectTeam>>
  /** Which model answers, writes and reads again in the project. */
  modelSettings(projectId: string): Promise<Result<ModelSettings>>
  saveModelSettings(projectId: string, settings: ModelSettings): Promise<Result<ModelSettings>>
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
  /** The draft of a deliverable, shown as soon as it is written: its critical reading follows. */
  onDeliverableDraft(listener: (projectId: string, deliverable: Deliverable) => void): () => void
  onDeliverableProgress(listener: (projectId: string, progress: AgentProgress) => void): () => void
  /** Returns the function that stops listening. */
  onProgress(listener: (projectId: string, progress: AgentProgress) => void): () => void
  /** Tells when a periodic reading has ended for a project. */
  onSourcesChanged(listener: (projectId: string) => void): () => void
  /** Who is signed in. Every other request is refused while nobody is. */
  session(): Promise<Result<SessionView>>
  /** Opens the organization's sign-in in the system's browser and waits for it to come back. */
  signIn(): Promise<Result<SessionView>>
  /** Tells an Octo just installed where the organization signs in, with the two ids it gives. */
  configureSignIn(tenantId: string, clientId: string): Promise<Result<SessionView>>
  cancelSignIn(): Promise<Result<null>>
  signOut(): Promise<Result<SessionView>>
  /** The page of the day of a project: what the code computed, with what Claude last judged. */
  todayView(projectId: string): Promise<Result<TodayView>>
  /** What the PM says of a signal; `open` shows it again. `until` is the day it comes back. */
  decideToday(
    projectId: string,
    key: string,
    state: TodayDecisionChoice,
    until: string | null,
  ): Promise<Result<TodayView>>
  muteTodayKind(projectId: string, kind: TodayKind, muted: boolean): Promise<Result<TodayView>>
  /**
   * The PM's word on the conversation of a mail signal: theirs to answer, or not. Null takes it
   * back, and the code and Claude decide again.
   */
  setMailTurn(projectId: string, key: string, turn: MailTurn | null): Promise<Result<TodayView>>
  saveOwnAddresses(projectId: string, addresses: string[]): Promise<Result<TodayView>>
  /** Asks Claude to weigh the mail that waits; `all` weighs again what was already weighed. */
  evaluateToday(projectId: string, all: boolean): Promise<Result<TodayView>>
  /** Asks Claude what the recorded meetings not yet read did to the open points. */
  closeToday(projectId: string): Promise<Result<TodayView>>
  cancelEvaluateToday(projectId: string): Promise<Result<null>>
  onTodayProgress(listener: (projectId: string, progress: AgentProgress) => void): () => void
  /** Every project in brief; Claude is never asked. */
  todayOverview(): Promise<Result<ProjectOverview[]>>
  /** The PM looked at the page of a project: what is on it is no longer new the next time. */
  markTodaySeen(projectId: string): Promise<Result<null>>
  /** Whether the system tells the PM when a signal of the project comes first. */
  setTodayNotify(projectId: string, notify: boolean): Promise<Result<TodayView>>
  /**
   * Tells when, after a periodic reading, a signal comes first that did not before. Returns the
   * function that stops listening.
   */
  onTodayEntered(listener: (entered: TodayEntered) => void): () => void
  /** When the sources of every project are read next by themselves; null when not known. */
  nextReading(): Promise<Result<string | null>>
  /** Brings the window of Octo in front of the others. */
  focusWindow(): Promise<Result<null>>
  /** Opens a point, by hand or from a signal of the page; the page comes back with it. */
  addOpenPoint(projectId: string, point: OpenPointDraft): Promise<Result<TodayView>>
  updateOpenPoint(
    projectId: string,
    pointId: string,
    change: OpenPointChange,
  ): Promise<Result<TodayView>>
  /** The PM's answer to what a point waits for: closed, or still in the queue. */
  confirmOpenPoint(
    projectId: string,
    pointId: string,
    resolved: boolean,
  ): Promise<Result<TodayView>>
  risks(projectId: string): Promise<Result<RiskRegister>>
  proposeRisks(projectId: string): Promise<Result<RiskRegister>>
  acceptRisk(projectId: string, candidateId: string, title: string): Promise<Result<RiskRegister>>
  dismissRisk(projectId: string, candidateId: string): Promise<Result<RiskRegister>>
  addRisk(projectId: string, title: string): Promise<Result<RiskRegister>>
  updateRisk(projectId: string, riskId: string, change: RiskChange): Promise<Result<RiskRegister>>
  /** Whether the project is of who is signed in, by its project codes in the company system. */
  assignment(projectId: string): Promise<Result<Assignment>>
  /** What the person set for the app on this computer; answered also before the sign-in. */
  preferences(): Promise<Result<Preferences>>
  savePreferences(preferences: Preferences): Promise<Result<Preferences>>
}

/** What the PM can say of a signal of the day. */
export type TodayDecisionChoice = 'done' | 'later' | 'muted' | 'open'

/** A signal that comes first now and did not at the reading before, with its project. */
export type TodayEntered = {
  projectId: string
  projectName: string
  item: TodayItem
  /** For a meeting about to start: the minutes before it, and how much there is to bring. */
  meeting?: { minutes: number; toBring: number }
}

/** What the interface sends to open a point. */
export type OpenPointDraft = {
  title: string
  owner?: string
  due?: string | null
  /** The signal of the page the point is opened from. */
  signal?: { key: string; kind: TodayKind }
}
