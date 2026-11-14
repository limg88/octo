import {
  type ArchivedMail,
  type DraftAnswer,
  type Evidence,
  type MailMessage,
  NEVER_READ,
  NO_SOURCES,
  type Project,
  type QuestionRecord,
  type SourceState,
  type SourcesConfig,
} from '@octo/domain'
import type {
  AgentRunner,
  AskRequest,
  Clock,
  EvidenceReader,
  FolderProbe,
  IdGenerator,
  MailArchive,
  MemoryWriter,
  ProjectRegistry,
  QuestionLog,
  SourceSettings,
  SourceStates,
} from '../src/index.ts'

export const STEP_MS = 1000

/** A clock that moves one step forward at every reading. */
export function steppingClock(start = '2026-11-14T08:00:00.000Z'): Clock {
  let current = new Date(start).getTime() - STEP_MS
  return {
    now: () => {
      current += STEP_MS
      return new Date(current)
    },
  }
}

export function countingIds(prefix = 'id'): IdGenerator {
  let count = 0
  return {
    next: () => {
      count += 1
      return `${prefix}-${count}`
    },
  }
}

export function memoryRegistry(initial: Project[] = []): ProjectRegistry {
  let projects = initial
  return {
    list: async () => projects,
    save: async (next) => {
      projects = next
    },
  }
}

export function memoryQuestionLog(): QuestionLog & { all(): QuestionRecord[] } {
  let records: QuestionRecord[] = []
  return {
    all: () => records,
    list: async (projectId) => records.filter((record) => record.projectId === projectId),
    append: async (record) => {
      records = [...records, record]
    },
    removeProject: async (projectId) => {
      records = records.filter((record) => record.projectId !== projectId)
    },
  }
}

export function folderProbe(readable: string[]): FolderProbe {
  return { isReadableFolder: async (folder) => readable.includes(folder) }
}

export function evidenceFrom(files: Record<string, Evidence>): EvidenceReader {
  return { read: async (_folder, path) => files[path] ?? { kind: 'missing' } }
}

export function agentAnswering(
  reply: DraftAnswer | Error,
): AgentRunner & { requests: AskRequest[] } {
  const requests: AskRequest[] = []
  return {
    requests,
    status: async () => ({ available: true, version: 'fake' }),
    ask: async (request) => {
      requests.push(request)
      request.onProgress?.({ kind: 'reading', target: 'wiki/stato.md' })
      if (reply instanceof Error) throw reply
      return reply
    },
  }
}

export function memorySourceStates(): SourceStates & { all(): Map<string, SourceState> } {
  const states = new Map<string, SourceState>()
  return {
    all: () => states,
    get: async (projectId, source) => states.get(`${projectId}/${source}`) ?? NEVER_READ,
    set: async (projectId, source, state) => {
      states.set(`${projectId}/${source}`, state)
    },
    removeProject: async (projectId) => {
      for (const key of [...states.keys()]) {
        if (key.startsWith(`${projectId}/`)) states.delete(key)
      }
    },
  }
}

export function memorySourceSettings(initial: SourcesConfig = NO_SOURCES): SourceSettings {
  let config = initial
  return {
    load: async () => config,
    save: async (_folder, next) => {
      config = next
    },
    suggestMailFolder: async () => 'Posta',
  }
}

export function memoryWriter(): MemoryWriter & { files: Map<string, string> } {
  const files = new Map<string, string>()
  return {
    files,
    write: async (_folder, path, content) => {
      if (files.get(path) === content) return 'unchanged'
      files.set(path, content)
      return 'written'
    },
  }
}

export type FakeArchivedMail = ArchivedMail & { message: MailMessage | null }

export function archiveOf(
  mails: FakeArchivedMail[] | Error,
): MailArchive & { windows: Array<{ from: Date; to: Date }> } {
  const windows: Array<{ from: Date; to: Date }> = []
  return {
    windows,
    between: async (from, to) => {
      windows.push({ from, to })
      if (mails instanceof Error) throw mails
      return mails.filter((mail) => mail.receivedAt >= from && mail.receivedAt < to)
    },
    read: async (mail) =>
      mails instanceof Error ? null : (mails.find((m) => m.id === mail.id)?.message ?? null),
  }
}
