import {
  type ArchivedMail,
  DomainError,
  type DraftAnswer,
  type Evidence,
  type FeedIndex,
  type FeedName,
  type FeedStep,
  type MailMessage,
  NEVER_READ,
  NEVER_SHARED,
  NO_SOURCES,
  type Project,
  type QuestionRecord,
  type Reader,
  type SharedReading,
  type SourceState,
  type SourcesConfig,
} from '@octo/domain'
import type {
  AgentRunner,
  AskRequest,
  Clock,
  EvidenceReader,
  FeedIndexes,
  FeedReader,
  FolderProbe,
  IdGenerator,
  MailArchive,
  MemoryWriter,
  ProjectFiles,
  ProjectRegistry,
  QuestionLog,
  Readings,
  SecretVault,
  SharedReadings,
  SourceSettings,
  SourceStates,
  WorkFolders,
} from '../src/index.ts'
import { createReadings } from '../src/index.ts'

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
    list: async () => records,
    append: async (_projectFolder, record) => {
      records = [...records.filter((known) => known.id !== record.id), record]
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
): AgentRunner & { requests: AskRequest[]; computed: string[] } {
  const requests: AskRequest[] = []
  const computed: string[] = []
  const ask = async (request: AskRequest) => {
    requests.push(request)
    request.onProgress?.({ kind: 'reading', target: 'wiki/stato.md' })
    if (reply instanceof Error) throw reply
    return reply
  }
  return {
    requests,
    computed,
    status: async () => ({ available: true, version: 'fake' }),
    ask,
    compute: async (request) => {
      computed.push(request.workFolder)
      return ask(request)
    },
  }
}

/** Work folders kept in memory: what a run left is whatever the test puts there. */
export function memoryWorkFolders(
  left: Record<string, string> = {},
): WorkFolders & { created: string[] } {
  const created: string[] = []
  return {
    created,
    create: async (projectId, runId) => {
      created.push(`${projectId}/${runId}`)
      return `/lavoro/${projectId}/${runId}`
    },
    files: async () => Object.keys(left).sort(),
    read: async (_projectId, _runId, name) => {
      const text = left[name]
      if (text === undefined) throw new DomainError('work_not_found')
      return new TextEncoder().encode(text)
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
    ofProject: async (projectId) =>
      Object.fromEntries(
        [...states]
          .filter(([key]) => key.startsWith(`${projectId}/`))
          .map(([key, state]) => [key.slice(projectId.length + 1), state]),
      ),
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
    suggestFeedFolder: async (_folder, feed) => `Fonti/${feed}`,
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
    claim: async () => {},
    writeBytes: async (_folder, path, bytes) => {
      files.set(path, `<${bytes.length} bytes>`)
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
    available: true,
  }
}

export function memoryVault(): SecretVault & { all: Map<string, string> } {
  const all = new Map<string, string>()
  return {
    all,
    get: async (key) => all.get(key) ?? null,
    set: async (key, value) => {
      all.set(key, value)
    },
    remove: async (key) => {
      all.delete(key)
    },
  }
}

export function memoryFeedIndexes(): FeedIndexes {
  const all = new Map<string, { scope: string | null; items: FeedIndex }>()
  return {
    load: async (folder, feed) => all.get(`${folder}/${feed}`) ?? { scope: null, items: {} },
    save: async (folder, feed, scope, items) => {
      all.set(`${folder}/${feed}`, { scope, items: { ...items } })
    },
  }
}

/** Who reads in the tests, unless a test is about two computers. */
export const PAOLA_AT_HER_MAC: Reader = { name: 'Paola Verdi', computer: 'mac-di-paola' }

/** What a view says of a source nobody else reads. */
export const READ_HERE = { readBy: null, readingBy: null } as const

/** What the folders of the projects know of their readings, as a folder shared would hold it. */
export function memorySharedReadings(): SharedReadings & { all: Map<string, SharedReading> } {
  const all = new Map<string, SharedReading>()
  return {
    all,
    get: async (folder, source) => all.get(`${folder}/${source}`) ?? NEVER_SHARED,
    set: async (folder, source, reading) => {
      all.set(`${folder}/${source}`, reading)
    },
  }
}

/** The turns of the readings of one computer; give two of them one `shared` for two computers. */
export function readingsOf(
  states: SourceStates,
  clock: Clock,
  options: { shared?: SharedReadings; me?: Reader } = {},
): Readings {
  const me = options.me ?? PAOLA_AT_HER_MAC
  return createReadings({
    shared: options.shared ?? memorySharedReadings(),
    states,
    clock,
    me: () => me,
  })
}

/** The removals of a project, applied to the files a memory writer holds. */
export function removerOf(files: Map<string, string>): ProjectFiles {
  const unused = async (): Promise<never> => {
    throw new Error('not used by this test')
  }
  return {
    withExtensions: unused,
    read: unused,
    readText: async (_folder, path) => files.get(path) ?? null,
    under: async (_folder, folder) =>
      [...files.keys()].filter((path) => path.startsWith(`${folder}/`)).sort(),
    remove: async (_folder, path) => {
      files.delete(path)
    },
  }
}

export type ScriptedFeed = FeedReader & {
  checks: Array<{ feed: FeedName; secret: string }>
  cursors: unknown[]
}

/** A feed reader that gives the steps of a script, or fails as told. */
export function scriptedFeed(script: { steps?: FeedStep[]; fails?: Error }): ScriptedFeed {
  const checks: ScriptedFeed['checks'] = []
  const cursors: unknown[] = []
  return {
    checks,
    cursors,
    check: async (feed, _config, secret) => {
      checks.push({ feed, secret })
      if (script.fails) throw script.fails
    },
    choices: async (feed, _config, secret) => {
      checks.push({ feed, secret })
      if (script.fails) throw script.fails
      return { projects: [{ value: 'Aurora', label: 'Aurora' }], areas: [] }
    },
    async *read(_feed, _config, _secret, cursor) {
      cursors.push(cursor)
      for (const step of script.steps ?? []) yield step
      if (script.fails) throw script.fails
    },
  }
}
