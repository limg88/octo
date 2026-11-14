import type {
  ArchivedMail,
  DraftAnswer,
  Evidence,
  MailMessage,
  Project,
  QuestionRecord,
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
}

/** The sources of a project, kept in the project folder so they travel with it. */
export interface SourceSettings {
  load(projectFolder: string): Promise<SourcesConfig>
  save(projectFolder: string, config: SourcesConfig): Promise<void>
  /** A sensible place for the mail in this folder, following how it is already organised. */
  suggestMailFolder(projectFolder: string): Promise<string>
}

export type SourceName = 'mail'

/** What each source did last on this computer, and where its next reading starts. */
export interface SourceStates {
  get(projectId: string, source: SourceName): Promise<SourceState>
  set(projectId: string, source: SourceName, state: SourceState): Promise<void>
  removeProject(projectId: string): Promise<void>
}
