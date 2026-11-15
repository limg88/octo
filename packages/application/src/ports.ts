import type {
  AdoFeedConfig,
  AlignmentSettings,
  ArchivedMail,
  Backup,
  DashboardSettings,
  DeckDraft,
  DeckOutline,
  DeliverableDraft,
  DeliverableKind,
  DraftAnswer,
  Evidence,
  Extraction,
  FeedChoices,
  FeedConfig,
  FeedIndex,
  FeedName,
  FeedStep,
  ForecastCell,
  ForecastSettings,
  HoursPeriod,
  HoursSettings,
  Identity,
  JiraFeedConfig,
  LiveSource,
  MailJudgement,
  MailMessage,
  MeetingReading,
  ModelSettings,
  Preferences,
  ProgressSettings,
  Project,
  ProjectTeam,
  QuestionRecord,
  RedTeamReport,
  RiskRegister,
  SheetGrid,
  SignInConfig,
  SourceFileStamp,
  SourceState,
  SourcesConfig,
  StarterFile,
  TodaySettings,
  TrackerHours,
  WarehouseFeedConfig,
} from '@octo/domain'

/** What the agent is doing right now, in terms a PM can read. */
export type AgentProgress = {
  kind: 'reading' | 'searching' | 'listing' | 'writing'
  target: string
}

export type AgentStatus =
  | { available: true; version: string }
  | { available: false; reason: 'not_installed' }

export type AskRequest = {
  projectFolder: string
  question: string
  /** The model to use; absent or null: the default of Claude Code on this seat. */
  model?: string | null
  /** What Octo reads directly for the project: the freshest data of each system. */
  liveSources?: readonly LiveSource[]
  /** Told which model answers, as soon as the run says it. */
  onModel?: (model: string) => void
  onProgress?: (progress: AgentProgress) => void
  signal?: AbortSignal
}

/** The model on the PM's own seat. It reads the project folder and proposes an answer. */
export interface AgentRunner {
  status(): Promise<AgentStatus>
  /** Throws a DomainError with an `agent_*` code when no answer can be had. */
  ask(request: AskRequest): Promise<DraftAnswer>
}

/** Opens a cited file so the code can check the quote. Never reads outside the project. */
export interface EvidenceReader {
  read(projectFolder: string, relativePath: string): Promise<Evidence>
}

export interface ProjectRegistry {
  list(): Promise<Project[]>
  save(projects: Project[]): Promise<void>
}

/** The questions of a project, kept in the project folder so they travel with it. */
export interface QuestionLog {
  list(projectFolder: string): Promise<QuestionRecord[]>
  append(projectFolder: string, record: QuestionRecord): Promise<void>
}

export interface FolderProbe {
  isReadableFolder(folder: string): Promise<boolean>
}

/** Makes the folder of a new project. */
export interface ProjectScaffold {
  /**
   * Creates `name` inside `parent` with the files given and returns its path. Throws a
   * DomainError `project_folder_exists` when something with that name is already there, and
   * `folder_not_readable` when the parent cannot be written.
   */
  create(parent: string, name: string, files: readonly StarterFile[]): Promise<string>
}

export interface Clock {
  now(): Date
}

export interface IdGenerator {
  next(): string
}

/**
 * The mail the PM's mail program keeps on this computer. Nothing is written and the program is
 * not asked. Throws a DomainError `mail_archive_unreadable` when it cannot be opened.
 */
export interface MailArchive {
  /** The mail received from `from` (included) to `to` (excluded), oldest first. */
  between(from: Date, to: Date): Promise<ArchivedMail[]>
  /** The message, or null when it is not downloaded or cannot be read as a mail. */
  read(mail: ArchivedMail): Promise<MailMessage | null>
}

/**
 * The meetings Verbale exported on this computer, one folder each under a root the PM chose.
 * Only read: nothing is ever written there.
 */
export interface MeetingExports {
  /** The folder Verbale exports to, when this computer tells it; null when it has to be chosen. */
  defaultRoot(): Promise<string | null>
  /**
   * A root in the one form it is kept and compared in: `~` for the home of who uses Octo. Two
   * projects that read the same folder have the same root, however each was typed.
   */
  portable(root: string): string
  /**
   * Every export folder under the root, in the order of their names: a finished meeting, or one
   * left out with its reason. Throws a DomainError `meetings_root_unreadable` when the root
   * cannot be opened.
   */
  list(root: string): Promise<MeetingReading[]>
  /** The text of a file of an export folder; null when the export has no such file. */
  read(root: string, folder: string, file: string): Promise<string | null>
}

export type WriteOutcome = 'written' | 'unchanged'

/** Writes a file of the memory inside the project folder, and nowhere else. */
export interface MemoryWriter {
  write(projectFolder: string, relativePath: string, content: string): Promise<WriteOutcome>
  /** A file that is not text (a Word document), written whole. */
  writeBytes(projectFolder: string, relativePath: string, bytes: Uint8Array): Promise<void>
  /**
   * Marks Octo's own folder of the project so that a versioned project leaves it out and the
   * agent's search still looks inside it. Safe to call at every start.
   */
  claim(projectFolder: string): Promise<void>
}

/** The sources of a project, kept in the project folder so they travel with it. */
export interface SourceSettings {
  load(projectFolder: string): Promise<SourcesConfig>
  save(projectFolder: string, config: SourcesConfig): Promise<void>
  /** A sensible place for the mail in this folder, following how it is already organised. */
  suggestMailFolder(projectFolder: string): Promise<string>
  /** A sensible place for the items of a feed in this folder. */
  suggestFeedFolder(projectFolder: string, feed: FeedName): Promise<string>
}

export type SourceName = 'mail' | 'meetings' | 'documents' | FeedName

/** What each source did last on this computer, and where its next reading starts. */
export interface SourceStates {
  get(projectId: string, source: SourceName): Promise<SourceState>
  set(projectId: string, source: SourceName, state: SourceState): Promise<void>
  /** Every state of the project, by the name of its source. */
  ofProject(projectId: string): Promise<Record<string, SourceState>>
  removeProject(projectId: string): Promise<void>
}

/** Text from the bytes of an Office or PDF file. Never throws: what fails is a warning. */
export interface TextExtractor {
  /** The extensions it reads, lower case and without the dot. */
  readonly extensions: readonly string[]
  /** The name and version written in every text, so a new version converts again. */
  readonly version: string
  extract(bytes: Uint8Array, fileName: string): Promise<Extraction>
}

/** The files of a project folder as the conversion needs them. Never leaves the folder. */
export interface ProjectFiles {
  /** Files with one of the extensions, outside Octo's own folders and hidden ones. */
  withExtensions(projectFolder: string, extensions: readonly string[]): Promise<SourceFileStamp[]>
  read(projectFolder: string, relativePath: string): Promise<Uint8Array>
  /** The text of a file, or null when it does not exist. */
  readText(projectFolder: string, relativePath: string): Promise<string | null>
  /** Every file under a folder of the project, as paths from the project root. */
  under(projectFolder: string, folder: string): Promise<string[]>
  remove(projectFolder: string, relativePath: string): Promise<void>
}

/**
 * Reads a system of record with the PM's own read-only credential and hands over files of the
 * memory. Never writes to the system. Failures are DomainErrors with a `feed_*` code.
 */
export interface FeedReader {
  /** Checks that the credential opens what the configuration names. */
  check(feed: FeedName, config: FeedConfig, secret: string): Promise<void>
  /**
   * What the credential can see, to choose from: the projects of the system and, once the
   * configuration names one, its areas. Empty for a system that lists nothing.
   */
  choices(feed: FeedName, config: FeedConfig, secret: string): Promise<FeedChoices>
  /**
   * What changed after `cursor` (null: from the first day of the configuration), step by step.
   * A system without a cursor of its own gives everything at each reading.
   */
  read(
    feed: FeedName,
    config: FeedConfig,
    secret: string,
    cursor: unknown,
    signal: AbortSignal,
  ): AsyncIterable<FeedStep>
}

/** Credentials of the feeds, kept by the operating system's own store on this computer. */
export interface SecretVault {
  get(key: string): Promise<string | null>
  /** Throws a DomainError `secret_store_unavailable` when the system offers no safe store. */
  set(key: string, value: string): Promise<void>
  remove(key: string): Promise<void>
}

/** What each feed wrote in a project from this computer. */
export interface FeedIndexes {
  load(projectId: string, feed: FeedName): Promise<{ scope: string | null; items: FeedIndex }>
  save(projectId: string, feed: FeedName, scope: string, items: FeedIndex): Promise<void>
  removeProject(projectId: string): Promise<void>
}

/** What the writer of a deliverable is given. */
export type DraftRequest = {
  projectFolder: string
  kind: DeliverableKind
  /** The instructions the PM added for this kind in this project, or null. */
  projectInstructions: string | null
  inputs: Readonly<Record<string, string>>
  /** A change asked in words on the draft shown; null for the first draft. */
  revision: { draft: DeliverableDraft; request: string } | null
  /** With the outline of a model deck, the draft is its slides for the period asked. */
  deckOutline?: DeckOutline
  liveSources?: readonly LiveSource[]
  model?: string | null
  onModel?: (model: string) => void
  onProgress?: (progress: AgentProgress) => void
  signal?: AbortSignal
}

export type RedTeamRequest = {
  projectFolder: string
  kind: DeliverableKind
  /** The text as the reader would get it. The red team never sees how it was written. */
  text: string
  model?: string | null
  onModel?: (model: string) => void
  signal?: AbortSignal
}

/**
 * Writes the draft of a deliverable from the project folder, read-only, and reads a draft again
 * as the one who will receive it. Failures are DomainErrors with an `agent_*` code.
 */
export interface DeliverableWriter {
  draft(request: DraftRequest): Promise<DeliverableDraft>
  redTeam(request: RedTeamRequest): Promise<RedTeamReport>
}

/** Turns an approved text into the files a person sends or files away. */
export interface DocumentRenderer {
  /**
   * The bytes of a Word document with this Markdown body: plain, or inside the letterhead given
   * (a Word document whose header, footer, margins and fonts are kept).
   */
  word(title: string, markdown: string, letterhead?: Uint8Array): Promise<Uint8Array>
  /** Throws a DomainError `letterhead_invalid` when the bytes are not a usable Word document. */
  checkLetterhead(bytes: Uint8Array): Promise<void>
  /**
   * The bytes of a presentation with this Markdown as slides, one per section, on the deck given:
   * its cover, its closing slide, its layouts and the look of its tables are kept.
   */
  deck(title: string, markdown: string, model: Uint8Array): Promise<Uint8Array>
  /** The lines of text and the tables of every slide of a model deck: what a new deck keeps. */
  deckOutline(model: Uint8Array): Promise<DeckOutline>
  /**
   * The model deck with the content written for another period: the same slides, each text and
   * table in its place and with its look.
   */
  fillDeck(model: Uint8Array, deck: DeckDraft): Promise<Uint8Array>
  /** Throws a DomainError `deck_model_invalid` when slides cannot be written on these bytes. */
  checkDeckModel(bytes: Uint8Array): Promise<void>
}

/** How a project reads its tracker for the dashboard, kept with Octo's settings of the project. */
export interface DashboardSettingsStore {
  load(projectFolder: string): Promise<DashboardSettings>
  save(projectFolder: string, settings: DashboardSettings): Promise<void>
}

/** The tracker exports found in a project folder, by what they hold. */
export type ExportCandidates = { exports: string[]; histories: string[] }

/** Tracker exports kept as JSON files in the project folder. Never leaves the folder. */
export interface TrackerExports {
  /**
   * The content of a JSON file of the project; null when it does not exist. A file that is not
   * JSON, or a path leading outside the folder, is a `tracker_export_unreadable`.
   */
  readJson(projectFolder: string, relativePath: string): Promise<unknown | null>
  /** Files that look like an export or like a history, to propose to the PM. */
  candidates(projectFolder: string): Promise<ExportCandidates>
}

/** How a project compares timesheets and tracker hours, kept with Octo's settings of the project. */
export interface HoursSettingsStore {
  load(projectFolder: string): Promise<HoursSettings>
  save(projectFolder: string, settings: HoursSettings): Promise<void>
}

/**
 * Reads the hours logged on the tracker with the PM's own read-only credential, only when the PM
 * asks. Never writes to the tracker. Failures are DomainErrors with a `feed_*` code.
 */
export interface TrackerHoursReader {
  read(
    config: JiraFeedConfig,
    secret: string,
    period: HoursPeriod,
    signal: AbortSignal,
  ): Promise<TrackerHours[]>
}

/**
 * Reads the hours of the timesheets from the company's system with the PM's own read-only
 * credential, only when the PM asks. Each row has the names of a timesheet export (`employee`,
 * `timesheetdate`, `projectid`, `duration`, `approvalstatus`, `internalid`) and the cost of the
 * row (`laborcost_new`), which the use case keeps apart from what answers may read.
 * Failures are DomainErrors with a `feed_*` code.
 */
export interface TimesheetReader {
  read(
    config: WarehouseFeedConfig,
    secret: string,
    period: HoursPeriod,
    signal: AbortSignal,
  ): Promise<Array<Record<string, unknown>>>
}

/** The model chosen for each task in a project, kept with Octo's settings of the project. */
export interface ModelSettingsStore {
  load(projectFolder: string): Promise<ModelSettings>
  save(projectFolder: string, settings: ModelSettings): Promise<void>
}

/** What a person set for the app itself, kept in the app's data folder; unknown when never set. */
export interface PreferencesStore {
  load(): Promise<unknown>
  save(preferences: Preferences): Promise<void>
}

/** The tracker as it is now, in the shape of the export the dashboard reads. */
export type TrackerSnapshot = {
  exportedAt: string
  items: readonly object[]
  /** By item id: what each item of the detailed types went through. */
  history: Readonly<Record<string, object>>
}

/**
 * Reads every work item of an Azure DevOps source with the PM's own read-only credential, only
 * when the PM asks. Never writes to the tracker. Failures are DomainErrors with a `feed_*` code.
 */
export interface TrackerSnapshotReader {
  read(
    config: AdoFeedConfig,
    secret: string,
    /** The types whose history of states and comments are read too. */
    detailTypes: readonly string[],
    signal: AbortSignal,
  ): Promise<TrackerSnapshot>
}

/** How a project fills the monthly forecast, kept with Octo's settings of the project. */
export interface ForecastSettingsStore {
  load(projectFolder: string): Promise<ForecastSettings>
  save(projectFolder: string, settings: ForecastSettings): Promise<void>
}

/** A cell to write in a sheet: where, and what. */
export type SheetWrite = { ref: string; cell: ForecastCell }

/**
 * A spreadsheet somebody else designed, read and filled without redrawing it: only the cells
 * named change, and their look stays the model's. Throws a DomainError `forecast_model_invalid`
 * for a file that is not a spreadsheet it can read.
 */
export interface SpreadsheetModel {
  /** The cells of the first sheet. */
  read(bytes: Uint8Array): SheetGrid
  /** A copy of the file with the cells written in its first sheet. */
  fill(bytes: Uint8Array, writes: readonly SheetWrite[]): Uint8Array
}

/** The order, the requests and the map of the client's form, kept with Octo's settings. */
export interface ProgressSettingsStore {
  load(projectFolder: string): Promise<ProgressSettings>
  save(projectFolder: string, settings: ProgressSettings): Promise<void>
}

/** How a project compares the two trackers, kept with Octo's settings of the project. */
export interface AlignmentSettingsStore {
  load(projectFolder: string): Promise<AlignmentSettings>
  save(projectFolder: string, settings: AlignmentSettings): Promise<void>
}

/** An item a feed wrote in the project: its title and its fields as the system gives them. */
export type FeedRecord = { title: string; record: Record<string, unknown> }

/** Reads back the items the feeds wrote in a folder of the project, one file each. */
export interface FeedRecords {
  /** Every item under the folder; files that are not items of a feed are skipped. */
  under(projectFolder: string, folder: string): Promise<FeedRecord[]>
}

/** The people and the calendar of a project, kept with Octo's settings of the project. */
export interface TeamStore {
  load(projectFolder: string): Promise<ProjectTeam>
  save(projectFolder: string, team: ProjectTeam): Promise<void>
}

/** The file of a backup, wherever the PM keeps it. */
export interface BackupFiles {
  /** Throws a DomainError `backup_invalid` when the file is not a backup Octo can read. */
  read(file: string): Promise<Backup>
  /** Throws a DomainError `backup_not_written` when the file cannot be written there. */
  write(file: string, backup: Backup): Promise<void>
}

/** What Claude said of the mail that waits for the PM, kept with its date and its model. */
export type TodayEvaluation = {
  /** When Claude last judged; null when never. */
  at: string | null
  model: string | null
  /** By the id of the mail. A mail judged once is not judged again. */
  mails: Record<string, MailJudgement>
}

export const NO_EVALUATION: TodayEvaluation = { at: null, model: null, mails: {} }

/** What the PM decided on the page of the day and what Claude judged, kept in the project. */
export interface TodayStore {
  load(projectFolder: string): Promise<TodaySettings>
  save(projectFolder: string, settings: TodaySettings): Promise<void>
  loadEvaluation(projectFolder: string): Promise<TodayEvaluation>
  saveEvaluation(projectFolder: string, evaluation: TodayEvaluation): Promise<void>
}

/** The register of the risks of a project, kept with Octo's settings of the project. */
export interface RiskRegisterStore {
  load(projectFolder: string): Promise<RiskRegister>
  save(projectFolder: string, register: RiskRegister): Promise<void>
}

/** A mail Claude is asked to weigh: where it is in the project, and what it is about. */
export type MailToJudge = { id: string; path: string; subject: string }

/** What Claude gives back for a mail: the quote is checked by the code afterwards. */
export type ProposedJudgement = {
  id: string
  importance: MailJudgement['importance']
  reason: string
  quote: string
  deadline: string | null
}

export type ProposedRisk = { title: string; why: string; path: string; quote: string }

export type JudgeRequest = {
  projectFolder: string
  liveSources?: readonly LiveSource[]
  model?: string | null
  onModel?: (model: string) => void
  onProgress?: (progress: AgentProgress) => void
  signal?: AbortSignal
}

/**
 * Claude as the one who judges, read-only on the project folder like whoever answers a question:
 * how much a mail matters, which risks the memory shows. It never decides that a signal exists.
 * Failures are DomainErrors with an `agent_*` code.
 */
export interface TodayJudge {
  mails(request: JudgeRequest & { mails: readonly MailToJudge[] }): Promise<ProposedJudgement[]>
  risks(request: JudgeRequest & { known: readonly string[] }): Promise<ProposedRisk[]>
}

/** What a sign-in gives: who the person is and what renews the sign-in without asking again. */
export type SignedIn = { identity: Identity; refreshToken: string | null }

/**
 * The organization's own sign-in. Failures are DomainErrors with a `sign_in_*` code; a person of
 * another organization is `sign_in_refused`.
 */
export interface IdentityProvider {
  /** Whether Octo was told where the organization signs in. */
  configured(): Promise<SignInConfig | null>
  /** Asks the person to sign in, in the system's browser. */
  signIn(signal: AbortSignal): Promise<SignedIn>
  /** Renews a sign-in without asking; throws `sign_in_failed` when it cannot. */
  renew(refreshToken: string): Promise<SignedIn>
}
