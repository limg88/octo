import type {
  AdoFeedConfig,
  ArchivedMail,
  Backup,
  ConversationTurn,
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
  ForecastKind,
  ForecastSettings,
  Glossary,
  GlossaryEntry,
  HoursPeriod,
  HoursSettings,
  Identity,
  JiraFeedConfig,
  LiveSource,
  MailJudgement,
  MailMessage,
  MeetingPlace,
  MeetingReading,
  MissingTicket,
  ModelSettings,
  NowRule,
  OpenPointRegister,
  Preferences,
  PrepNote,
  Project,
  ProjectEconomics,
  ProjectTeam,
  QuestionRecord,
  Reader,
  RedTeamReport,
  Release,
  ReleaseAsset,
  RiskRegister,
  SharedReading,
  SheetGrid,
  SheetPlans,
  SignInConfig,
  SignInSetup,
  SourceFileStamp,
  SourceState,
  SourcesConfig,
  StarterFile,
  TodayFacts,
  TodaySettings,
  TrackerHours,
  UpdateProgress,
  WarehouseFeedConfig,
} from '@octo/domain'

/** What the agent is doing right now, in terms a PM can read. */
export type AgentProgress = {
  /** `checking` and `reviewing` are what Octo does after the agent wrote: the phases of a draft. */
  kind: 'reading' | 'searching' | 'listing' | 'writing' | 'computing' | 'checking' | 'reviewing'
  target: string
}

export type AgentStatus =
  /** `computes`: it can run calculations inside its fence on this computer. */
  | { available: true; version: string; computes?: boolean }
  | { available: false; reason: 'not_installed' }

export type AskRequest = {
  projectFolder: string
  question: string
  /** The earlier questions of the same conversation with their answers: context, not sources. */
  history?: readonly ConversationTurn[]
  /** What the PM attached to the conversation, as paths of the project to read: they are sources. */
  attachments?: readonly string[]
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
  /**
   * The same, with calculations: the agent reads the project, runs the interpreter Octo ships
   * and writes only in the work folder, inside the sandbox of the system. Throws
   * `fence_unavailable` when the sandbox cannot start: it never runs without.
   */
  compute(request: AskRequest & { workFolder: string }): Promise<DraftAnswer>
}

/**
 * The folders the agent may write in when it computes: one per run, among the state of the app
 * and never inside a project. What the PM keeps is copied from there into the project by Octo.
 */
export interface WorkFolders {
  /** A new, empty folder for a run; its absolute path. */
  create(projectId: string, runId: string): Promise<string>
  /** The files a run left, by name, the folders inside it included as `folder/name`. */
  files(projectId: string, runId: string): Promise<string[]>
  read(projectId: string, runId: string, name: string): Promise<Uint8Array>
  /** Lays a file in the folder of a run: what Octo prepares for it, or makes of its result. */
  write(projectId: string, runId: string, name: string, content: Uint8Array): Promise<void>
}

/** The kinds of deliverable that travel with the app, read from its files. */
export interface ShippedCatalog {
  /** The kinds in the order of the catalog. Throws `catalog_invalid` naming what is broken. */
  kinds(): Promise<DeliverableKind[]>
}

/** The deliverables with a script that travel with the app, to start one in a project from. */
export interface ScriptedTemplates {
  slugs(): Promise<string[]>
  /** The files of one, by name; none for a name the app does not ship. */
  files(slug: string): Promise<Array<{ name: string; content: Uint8Array }>>
}

export type ScriptRequest = {
  projectFolder: string
  workFolder: string
  model?: string | null
  onProgress?: (progress: AgentProgress) => void
  signal?: AbortSignal
}

/**
 * Runs and corrects the script of a deliverable inside the fence: the agent reads the project,
 * runs the interpreter Octo ships on the script laid in the work folder, and writes only there.
 * Throws `fence_unavailable` where there is no sandbox.
 */
export interface ScriptRunner {
  /** Runs the script as it is; what it printed. */
  run(request: ScriptRequest): Promise<{ said: string }>
  /** Changes the files of the work folder as the PM asks in words, and runs the script to check. */
  correct(request: ScriptRequest & { words: string }): Promise<{ summary: string }>
}

/** A file of Octo's settings of a project as it is written, for what no longer has a store. */
export interface KeptSettings {
  /** The JSON of a file of the settings folder; null when it is not there or is not JSON. */
  read(projectFolder: string, name: string): Promise<unknown | null>
}

/** Opens a cited file so the code can check the quote. Never reads outside the project. */
export interface EvidenceReader {
  read(projectFolder: string, relativePath: string): Promise<Evidence>
}

export interface ProjectRegistry {
  list(): Promise<Project[]>
  save(projects: Project[]): Promise<void>
}

/** The questions one person asked of a project: theirs, not of who else opens its folder. */
export interface QuestionLog {
  list(projectFolder: string): Promise<QuestionRecord[]>
  /** Adds a question; one with the id of a question already kept takes its place. */
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
  /** Whether this computer has a mail program Octo reads: where it has none, mail is not read. */
  readonly available: boolean
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
  /** Whether the root is a folder this computer can open: Verbale exports on one computer. */
  readable(root: string): Promise<boolean>
  /**
   * Every export folder under the root, in the order of their names: a finished meeting, or one
   * left out with its reason. Throws a DomainError `meetings_root_unreadable` when the root
   * cannot be opened.
   */
  list(root: string): Promise<MeetingReading[]>
  /**
   * What one export folder is at this moment, read again; null when it is no longer one of
   * Verbale's. Asked after the files of a meeting were read, to know they are of one export.
   */
  reading(root: string, folder: string): Promise<MeetingReading | null>
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

/**
 * The sources of a project as who uses this computer reads them. What is of the project is kept
 * in its folder and travels with it; the account each system is entered with is of the person.
 */
export interface SourceSettings {
  load(projectFolder: string): Promise<SourcesConfig>
  save(projectFolder: string, config: SourcesConfig): Promise<void>
  /** A sensible place for the mail in this folder, following how it is already organised. */
  suggestMailFolder(projectFolder: string): Promise<string>
  /** A sensible place for the items of a feed in this folder. */
  suggestFeedFolder(projectFolder: string, feed: FeedName): Promise<string>
}

export type SourceName = 'mail' | 'meetings' | 'documents' | FeedName

/** What takes turns between computers: a source, or the tracker read for the dashboard. */
export type ReadingName = SourceName | 'tracker'

/**
 * What this computer did last with each source, gone well or not, and where the next reading
 * starts for what only this computer holds (its mail, its meetings). Kept with the app.
 */
export interface SourceStates {
  get(projectId: string, source: ReadingName): Promise<SourceState>
  set(projectId: string, source: ReadingName, state: SourceState): Promise<void>
  /** Every state of the project, by the name of its source. */
  ofProject(projectId: string): Promise<Record<string, SourceState>>
  removeProject(projectId: string): Promise<void>
}

/**
 * What the folder of a project knows of the readings of each source, kept in the folder itself:
 * every computer that opens the folder finds the same. A state that cannot be read is the state
 * of a source never read: the next reading puts it right.
 */
export interface SharedReadings {
  get(projectFolder: string, source: ReadingName): Promise<SharedReading>
  set(projectFolder: string, source: ReadingName, reading: SharedReading): Promise<void>
}

/** Who reads from this computer: the person signed in, or who uses the computer, and its name. */
export type ThisReader = () => Reader

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

/**
 * What each feed wrote in a project, kept in the folder of the project: whoever reads next,
 * from any computer, goes on from what is there.
 */
export interface FeedIndexes {
  load(projectFolder: string, feed: FeedName): Promise<{ scope: string | null; items: FeedIndex }>
  save(projectFolder: string, feed: FeedName, scope: string, items: FeedIndex): Promise<void>
}

/** The index a feed kept on this computer before a folder could be shared. */
export interface LegacyFeedIndexes {
  load(projectId: string, feed: FeedName): Promise<{ scope: string | null; items: FeedIndex }>
  remove(projectId: string, feed: FeedName): Promise<void>
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
  /** The headings of the Word template of the kind: the sections the draft must have. */
  sectionOutline?: readonly string[]
  /** The words the transcripts hear badly, with their right form: always written in that form. */
  glossary?: readonly GlossaryEntry[]
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
export type KindCorrectionRequest = {
  projectFolder: string
  kind: DeliverableKind
  /** What the PM wants changed in how the kind is written, in their words. */
  words: string
  model?: string | null
  signal?: AbortSignal
}

/** The instructions of a kind written again, whole, and what changed in a few words. */
export type KindCorrectionDraft = { instructions: string; summary: string }

export interface DeliverableWriter {
  draft(request: DraftRequest): Promise<DeliverableDraft>
  redTeam(request: RedTeamRequest): Promise<RedTeamReport>
  /** Writes again how a kind is written, as the PM asked. Nothing is saved by this. */
  correctKind(request: KindCorrectionRequest): Promise<KindCorrectionDraft>
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
  /** The headings of a Word document in order, each as a Markdown heading of its level. */
  wordOutline(template: Uint8Array): Promise<string[]>
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
 * Creates tickets in the internal Jira with the PM's credential, only when the PM asks and only
 * the ones given. It changes and deletes nothing. Each ticket gives its key, or the code of what
 * refused it; a failure before any ticket is a DomainError with a `feed_*` code.
 */
export interface TicketWriter {
  create(
    config: JiraFeedConfig,
    secret: string,
    projectKey: string,
    tickets: readonly MissingTicket[],
  ): Promise<Array<{ key: string } | { error: string }>>
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

/** What the company's system knows of a project code: its name and what the client ordered. */
export type ProjectOrder = {
  code: string
  description: string
  /** The sum of the lines of its sales orders; null when it has none. */
  ordered: number | null
  /** How it is sold, as its sales orders tell it; null when they do not tell. */
  kind: ForecastKind | null
  /** The month of its first sales order, `YYYY-MM`; null when no order tells it. */
  startMonth: string | null
  /** What was invoiced and what was recognised as revenue so far; null when not told. */
  invoiced: number | null
  recognized: number | null
  /** The money of the code as the company's system books it; absent when it was not read. */
  economics?: ProjectEconomics
}

/**
 * The orders of the project codes of a NetSuite source, read through its read-only connector.
 * Failures are DomainErrors with a `feed_*` code.
 */
export interface ProjectOrdersReader {
  read(config: WarehouseFeedConfig, secret: string, signal: AbortSignal): Promise<ProjectOrder[]>
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

/** A tracker the dashboard can be read from, with how its source is set. */
export type TrackerSource =
  | { kind: 'ado'; config: AdoFeedConfig }
  | { kind: 'jira'; config: JiraFeedConfig }

/**
 * Reads every work item of an Azure DevOps or Jira source with the PM's own read-only
 * credential, only when the PM asks. Never writes to the tracker. Failures are DomainErrors with
 * a `feed_*` code.
 */
export interface TrackerSnapshotReader {
  read(
    source: TrackerSource,
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

/**
 * The plans of the project codes Octo kept until they left it. They are read once, to hand them
 * back to the PM as a text; the file they were kept in is never changed nor removed.
 */
export interface RetiredSheetPlans {
  /** The plans still to hand back; null when there are none or they were handed back already. */
  pending(projectFolder: string): Promise<SheetPlans | null>
  /** Writes them in the project as a text the PM reads: from then nothing is pending. */
  handBack(projectFolder: string, text: string): Promise<void>
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

/** An item a feed wrote in the project: its title and its fields as the system gives them. */
export type FeedRecord = { title: string; record: Record<string, unknown> }

/** Reads back the items the feeds wrote in a folder of the project, one file each. */
export interface FeedRecords {
  /** Every item under the folder; files that are not items of a feed are skipped. */
  under(projectFolder: string, folder: string): Promise<FeedRecord[]>
}

/** Reads back the rows a feed wrote for the views of a system of record. */
export interface FeedRows {
  /** The rows of one view, from every file under the folder that holds them. */
  rows(projectFolder: string, folder: string, view: string): Promise<Array<Record<string, unknown>>>
}

/** The people and the calendar of a project, kept with Octo's settings of the project. */
/** The glossary of a project, kept with its settings. */
export interface GlossaryStore {
  load(projectFolder: string): Promise<Glossary>
  save(projectFolder: string, glossary: Glossary): Promise<void>
}

/**
 * Claude as the one who finds the words a transcript heard badly: it reads the transcripts and
 * the written documents of the project, and gives the pairs. Failures are `agent_*` errors.
 */
export interface GlossaryAdvisor {
  propose(request: {
    projectFolder: string
    known: readonly GlossaryEntry[]
    model?: string | null
    signal?: AbortSignal
  }): Promise<GlossaryEntry[]>
}

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
  /** Why what came first mattered when Claude was last asked, a sentence for a signal. */
  summary: NowSentence[]
  /** What Claude said to bring to the meetings of the day it was last asked on. */
  prep: PrepNote[]
}

/** A sentence of Claude on a signal that comes first, with the words of a file that back it. */
export type NowSentence = {
  /** The key of the signal it is about. */
  key: string
  text: string
  path: string
  quote: string
  /** Whether the code found the quote in the file. */
  verified: boolean
}

export const NO_EVALUATION: TodayEvaluation = {
  at: null,
  model: null,
  mails: {},
  summary: [],
  prep: [],
}

/**
 * What one PM decided on the page of the day and what Claude judged for that PM: theirs, not of
 * who else opens the folder of the project.
 */
export interface TodayStore {
  load(projectFolder: string): Promise<TodaySettings>
  save(projectFolder: string, settings: TodaySettings): Promise<void>
  loadEvaluation(projectFolder: string): Promise<TodayEvaluation>
  saveEvaluation(projectFolder: string, evaluation: TodayEvaluation): Promise<void>
}

/** The register of the open points of a project, kept with Octo's settings of the project. */
export interface OpenPointStore {
  load(projectFolder: string): Promise<OpenPointRegister>
  save(projectFolder: string, register: OpenPointRegister): Promise<void>
}

/** The register of the risks of a project, kept with Octo's settings of the project. */
export interface RiskRegisterStore {
  load(projectFolder: string): Promise<RiskRegister>
  save(projectFolder: string, register: RiskRegister): Promise<void>
}

/** A mail Claude is asked to weigh: where it is in the project, and what it is about. */
export type MailToJudge = {
  id: string
  path: string
  subject: string
  /** Whom the mail is written to, as its header says. */
  to: string
  /** How many mails of the same conversation wait: this is the last of them. */
  mails: number
}

/** Who the mail is judged for: Claude tells whether a mail asks something of this person. */
export type JudgedFor = { name: string | null; addresses: readonly string[] }

/** What Claude gives back for a mail: the quote is checked by the code afterwards. */
export type ProposedJudgement = {
  id: string
  importance: MailJudgement['importance']
  reason: string
  quote: string
  deadline: string | null
  /** Whom the mail asks something of; absent when the judge does not say. */
  addressee?: MailJudgement['addressee']
  addresseeName?: string | null
  /** Whether the PM has something to do about the mail; absent when the judge does not say. */
  asksAction?: boolean
}

/** A signal that comes first, as Claude is told it: the rule that chose it and its facts. */
export type NowToExplain = {
  key: string
  rule: NowRule
  facts: TodayFacts
}

/** What Claude gives back on a signal that comes first: the quote is checked by the code. */
export type ProposedSentence = { key: string; text: string; path: string; quote: string }

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
  mails(
    request: JudgeRequest & { mails: readonly MailToJudge[]; pm?: JudgedFor },
  ): Promise<ProposedJudgement[]>
  risks(request: JudgeRequest & { known: readonly string[] }): Promise<ProposedRisk[]>
  /**
   * Why the signals the code put first matter today, a sentence for each at most. Claude never
   * chooses them, and never changes their order.
   */
  summary(
    request: JudgeRequest & { day: string; items: readonly NowToExplain[] },
  ): Promise<ProposedSentence[]>
  /**
   * Whether each meeting the rule of Octo leaves in doubt is of the project, with the sentence
   * that says why. Without it nothing is asked and the meetings wait for the PM.
   */
  meetings?(
    request: JudgeRequest & {
      project: { name: string; people: readonly string[]; keywords: readonly string[] }
      meetings: readonly MeetingToPlace[]
    },
  ): Promise<ProposedPlace[]>
}

/** A meeting as Claude is told it, to say whose it is. */
export type MeetingToPlace = {
  id: string
  title: string
  start: string
  participants: readonly string[]
}
/** What Claude said of it: of the project, of something else, or it cannot tell. */
export type ProposedPlace = { id: string; place: MeetingPlace; reason: string }

/** An open point as Claude is told it, to look for it in the meetings of a day. */
export type PointToCheck = { id: string; title: string; owner: string; due: string | null }

/** A recorded meeting as Claude is told it: what it is called, when, and its files. */
export type MeetingToRead = { title: string; started: string; files: readonly string[] }

/** What Claude read of an open point in a meeting; the quote is checked by the code. */
export type ProposedVerdict = {
  id: string
  outcome: 'resolved' | 'open'
  said: string
  path: string
  quote: string
}

/** A point Claude read being opened in a meeting; the quote is checked by the code. */
export type ProposedOpenPoint = {
  title: string
  owner: string
  due: string | null
  path: string
  quote: string
}

export type ProposedClosing = { verdicts: ProposedVerdict[]; points: ProposedOpenPoint[] }

/** A meeting of the day as Claude is told it, with what the code already put in its card. */
export type MeetingToPrepare = {
  key: string
  subject: string
  start: string
  attendees: readonly string[]
  /** The open points the code says to bring. */
  points: readonly PointToCheck[]
  /** The files of the last recording of the series, the report first. */
  lastFiles: readonly string[]
  /** The mail of who is invited that waits, by its file. */
  mails: readonly string[]
}

/** What Claude says to bring to a meeting; the quote is checked by the code. */
export type ProposedBring = { key: string; text: string; path: string; quote: string }

/**
 * Claude as the one who reads the meetings of a day, read-only on the project folder: which open
 * points were closed there, which were talked about, which were opened. It never drops a point.
 * Failures are DomainErrors with an `agent_*` code.
 */
export interface MeetingReader {
  closing(
    request: JudgeRequest & {
      day: string
      points: readonly PointToCheck[]
      meetings: readonly MeetingToRead[]
      /** The name of the PM, when known: a point nobody took is not theirs. */
      pm?: string | null
    },
  ): Promise<ProposedClosing>
  /**
   * What to bring to each meeting of the day: what to ask, what will be asked, what to decide.
   * Claude adds to the card the code made; it never takes anything off it.
   */
  prep(
    request: JudgeRequest & { day: string; meetings: readonly MeetingToPrepare[] },
  ): Promise<ProposedBring[]>
}

/** A sentence Claude proposes on the numbers of the tracker; the code checks ids and numbers. */
export type ProposedComment = { text: string; ids: string[] }

/** An item that waits for an answer, as Claude is told it to write the reminder. */
export type ItemToChase = {
  id: string
  type: 'bug' | 'story'
  title: string
  state: string
  assignee: string | null
  askedBy: string
  askedAt: string
  workdays: number
  question: string
}

/** A reminder as Claude drafts it: whom it is for, and the words. Nobody sends it but the PM. */
export type ProposedReminder = { to: string | null; text: string }

/**
 * Claude beside the dashboard, read-only on the project folder: it comments the numbers the code
 * computed and drafts a reminder for an item that waits. It never counts, and never sends.
 * Failures are DomainErrors with an `agent_*` code.
 */
export interface TrackerAdvisor {
  comment(request: JudgeRequest & { figures: unknown }): Promise<ProposedComment[]>
  reminder(
    request: JudgeRequest & { item: ItemToChase; from: string | null },
  ): Promise<ProposedReminder>
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

/**
 * Where this computer keeps what its organization gave to let its people sign in: beside the
 * app's own state. Whoever installs Octo for a colleague writes it once.
 */
export interface SignInSetupStore {
  save(setup: SignInSetup): Promise<void>
}

/** Where the releases of Octo are published. */
export interface ReleaseFeed {
  /** The latest release; null when none was published yet. */
  latest(): Promise<Release | null>
}

/** Brings down the files of a release. */
export interface ReleaseDownloads {
  /** A small file of text, as the list of checksums. */
  text(asset: ReleaseAsset): Promise<string>
  /** A file kept on this computer, with the SHA-256 of what was written. */
  file(
    asset: ReleaseAsset,
    onProgress?: (progress: UpdateProgress) => void,
  ): Promise<{ path: string; sha256: string }>
}

/** Tells whether a text was signed by who publishes Octo. */
export interface ReleaseVerifier {
  /** False when no key is known: without a key nothing can be told to be the publisher's. */
  readonly canVerify: boolean
  /** True when the signature is of one of the publisher's keys over exactly this text. */
  verify(text: string, signature: string): boolean
}

/** Puts a downloaded Octo in place of the running one and starts it. */
export interface UpdateApplier {
  /**
   * Throws a DomainError `update_not_installable` when this Octo cannot be replaced where it
   * is. When it returns, the running Octo is closing.
   */
  apply(filePath: string): Promise<void>
}
