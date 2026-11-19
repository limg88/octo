import {
  DomainError,
  jiraSite,
  MAX_TICKETS_PER_REQUEST,
  MISSING_TICKETS_FILE,
  type MissingTicket,
  missingTickets,
  PROJECT_KEY,
  type Project,
  parseTicketsWritten,
  SCRIPTED_OUTPUT,
  TICKETS_WRITTEN_FILE,
  type TicketWritten,
} from '@octo/domain'
import { secretKey } from './feeds.ts'
import type {
  Clock,
  MemoryWriter,
  ProjectFiles,
  SecretVault,
  SourceSettings,
  TicketWriter,
  WorkFolders,
} from './ports.ts'

export type AlignmentTicketsDeps = {
  work: Pick<WorkFolders, 'files' | 'read'>
  files: Pick<ProjectFiles, 'readText'>
  writer: Pick<MemoryWriter, 'write' | 'claim'>
  sources: Pick<SourceSettings, 'load'>
  secrets: SecretVault
  tickets: TicketWriter
  clock: Clock
  /** Who uses Octo, for the record of what was written. */
  who: () => string
}

/** A missing ticket as the PM sees it before creating it: with its key when Octo already did. */
export type TicketToCreate = MissingTicket & { key: string | null }
/** What the PM is shown before anything is written: where it would go, and what. */
export type TicketsToCreate = { site: string; projectKey: string; tickets: TicketToCreate[] }
/** What became of one ticket asked for: its key, or the code of what refused it. */
export type TicketOutcome = { summary: string; key: string | null; error: string | null }

export type AlignmentTickets = {
  /** The tickets a run of the alignment found missing. Writes nothing. */
  missing(project: Project, runId: string): Promise<TicketsToCreate>
  /**
   * Creates in the internal tracker the tickets the PM chose among the missing ones, and only
   * those; one already created by Octo is not created again. What was written is kept.
   */
  create(
    project: Project,
    runId: string,
    summaries: readonly string[],
    projectKey: string,
  ): Promise<TicketOutcome[]>
}

const decoder = new TextDecoder()

/**
 * The one thing Octo writes outside the project: the tickets an alignment found missing, in the
 * internal Jira, one by one, when the PM asks and for the ones the PM chose.
 */
export function createAlignmentTickets(deps: AlignmentTicketsDeps): AlignmentTickets {
  async function found(project: Project, runId: string): Promise<MissingTicket[]> {
    const name = (await deps.work.files(project.id, runId)).find(
      (file) =>
        file.startsWith(`${SCRIPTED_OUTPUT}/`) &&
        MISSING_TICKETS_FILE.test(file.slice(SCRIPTED_OUTPUT.length + 1)),
    )
    if (name === undefined) throw new DomainError('scripted_result_invalid')
    return missingTickets(decoder.decode(await deps.work.read(project.id, runId, name)))
  }
  const written = async (project: Project): Promise<TicketWritten[]> =>
    parseTicketsWritten(await deps.files.readText(project.folder, TICKETS_WRITTEN_FILE))
  async function jira(project: Project) {
    const config = (await deps.sources.load(project.folder)).jira
    if (config === null) throw new DomainError('source_not_configured')
    return config
  }

  return {
    async missing(project, runId) {
      const config = await jira(project)
      const keys = new Map((await written(project)).map((entry) => [entry.summary, entry.key]))
      return {
        site: jiraSite(config.site),
        projectKey: config.projects.find((name) => PROJECT_KEY.test(name)) ?? '',
        tickets: (await found(project, runId)).map((ticket) => ({
          ...ticket,
          key: keys.get(ticket.summary) ?? null,
        })),
      }
    },

    async create(project, runId, summaries, projectKey) {
      if (!PROJECT_KEY.test(projectKey)) throw new DomainError('source_config_invalid', projectKey)
      const config = await jira(project)
      const secret = await deps.secrets.get(secretKey(project, 'jira'))
      if (secret === null) throw new DomainError('secret_missing')
      const before = await written(project)
      const done = new Set(before.map((entry) => entry.summary))
      const asked = new Set(summaries)
      // Only what the run found missing, the PM chose, and Octo did not create already.
      const chosen = (await found(project, runId))
        .filter((ticket) => asked.has(ticket.summary) && !done.has(ticket.summary))
        .slice(0, MAX_TICKETS_PER_REQUEST)
      if (chosen.length === 0) return []
      const created = await deps.tickets.create(config, secret, projectKey, chosen)
      const at = deps.clock.now().toISOString()
      const outcomes = chosen.map((ticket, index): TicketOutcome => {
        const outcome = created[index]
        return outcome && 'key' in outcome
          ? { summary: ticket.summary, key: outcome.key, error: null }
          : { summary: ticket.summary, key: null, error: outcome?.error ?? 'feed_failed' }
      })
      const fresh = outcomes.flatMap((outcome): TicketWritten[] =>
        outcome.key === null
          ? []
          : [{ summary: outcome.summary, key: outcome.key, at, by: deps.who() }],
      )
      if (fresh.length > 0) {
        await deps.writer.claim(project.folder)
        const record = JSON.stringify([...before, ...fresh], null, 1)
        await deps.writer.write(project.folder, TICKETS_WRITTEN_FILE, record)
      }
      return outcomes
    },
  }
}
