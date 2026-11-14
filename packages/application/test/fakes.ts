import type { DraftAnswer, Evidence, Project, QuestionRecord } from '@octo/domain'
import type {
  AgentRunner,
  AskRequest,
  Clock,
  EvidenceReader,
  FolderProbe,
  IdGenerator,
  ProjectRegistry,
  QuestionLog,
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
