import type {
  ArchivedMail,
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
  MailMessage,
  Project,
  QuestionRecord,
  RedTeamReport,
  SourceFileStamp,
  SourceState,
  SourcesConfig,
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

export interface QuestionLog {
  list(projectId: string): Promise<QuestionRecord[]>
  append(record: QuestionRecord): Promise<void>
  removeProject(projectId: string): Promise<void>
}

export interface FolderProbe {
  isReadableFolder(folder: string): Promise<boolean>
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

export type SourceName = 'mail' | 'documents' | FeedName

/** What each source did last on this computer, and where its next reading starts. */
export interface SourceStates {
  get(projectId: string, source: SourceName): Promise<SourceState>
  set(projectId: string, source: SourceName, state: SourceState): Promise<void>
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
  onProgress?: (progress: AgentProgress) => void
  signal?: AbortSignal
}

export type RedTeamRequest = {
  projectFolder: string
  kind: DeliverableKind
  /** The text as the reader would get it. The red team never sees how it was written. */
  text: string
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
}
