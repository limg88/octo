import type { DraftAnswer, Evidence, Project, QuestionRecord } from '@octo/domain'

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
