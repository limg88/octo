import {
  type JiraFeedConfig,
  type MissingTicket,
  NO_SOURCES,
  type Project,
  TICKETS_WRITTEN_FILE,
} from '@octo/domain'
import { describe, expect, it } from 'vitest'
import { createAlignmentTickets } from '../src/index.ts'

const NOW = new Date('2026-11-19T10:00:00.000Z')
const aurora: Project = { id: 'p-a', name: 'Aurora', folder: '/progetti/Aurora', addedAt: '' }
const jira = { site: 'contoso', email: 'pm@example.test', projects: ['Aurora', 'AUR'] }
const CSV = [
  'Summary,Issue Type,Priority,Assignee,Description,Sprint',
  '[AZDO 12] Esportazione,Story,,,Come da riunione,Sprint 28',
  '[AZDO 13] Filtro,Bug,,,,Sprint 28',
  '[AZDO 14] Stampa,Story,,,,Sprint 28',
].join('\r\n')

function setup(options: { linked?: boolean; secret?: string | null; refuse?: string } = {}) {
  const disk = new Map<string, string>()
  const calls: Array<{ projectKey: string; tickets: readonly MissingTicket[] }> = []
  const tickets = createAlignmentTickets({
    work: {
      files: async () => ['esito.json', 'uscita/allineamento.md', 'uscita/mancanti_sprint-28.csv'],
      read: async (_project, runId) => {
        if (runId !== 'run-1') throw new Error('no such run')
        return new TextEncoder().encode(CSV)
      },
    },
    files: { readText: async (_folder, path) => disk.get(path) ?? null },
    writer: {
      claim: async () => {},
      write: async (_folder, path, content) => {
        disk.set(path, content)
        return 'written'
      },
    },
    sources: {
      load: async () => ({
        ...NO_SOURCES,
        jira: options.linked === false ? null : (jira as JiraFeedConfig),
      }),
    },
    secrets: {
      get: async () => (options.secret === undefined ? 'token' : options.secret),
    } as never,
    tickets: {
      create: async (_config, _secret, projectKey, asked) => {
        calls.push({ projectKey, tickets: asked })
        return asked.map((ticket, index) =>
          ticket.summary.includes(options.refuse ?? '§')
            ? { error: 'feed_failed' }
            : { key: `${projectKey}-${900 + calls.length * 10 + index}` },
        )
      },
    },
    clock: { now: () => NOW },
    who: () => 'Paola Verdi',
  })
  return { tickets, disk, calls }
}

describe('the missing tickets of an alignment, created in the internal Jira', () => {
  it('shows what is missing and where it would go, and writes nothing', async () => {
    const { tickets, calls, disk } = setup()
    const found = await tickets.missing(aurora, 'run-1')
    // The key of the project is the first of the settings that reads as one.
    expect(found).toMatchObject({ site: 'contoso', projectKey: 'AUR' })
    expect(found.tickets.map((ticket) => [ticket.summary, ticket.key])).toEqual([
      ['[AZDO 12] Esportazione', null],
      ['[AZDO 13] Filtro', null],
      ['[AZDO 14] Stampa', null],
    ])
    expect(calls).toEqual([])
    expect(disk.size).toBe(0)
  })

  it('creates only what the PM chose among the missing, once, and keeps what it wrote', async () => {
    const { tickets, calls, disk } = setup({ refuse: 'Filtro' })
    const chosen = ['[AZDO 12] Esportazione', '[AZDO 13] Filtro', 'Mai trovato dall’allineamento']
    expect(await tickets.create(aurora, 'run-1', chosen, 'AUR')).toEqual([
      { summary: '[AZDO 12] Esportazione', key: 'AUR-910', error: null },
      { summary: '[AZDO 13] Filtro', key: null, error: 'feed_failed' },
    ])
    expect(calls[0]?.tickets.map((ticket) => ticket.summary)).toEqual(chosen.slice(0, 2))
    expect(JSON.parse(disk.get(TICKETS_WRITTEN_FILE) ?? '[]')).toEqual([
      {
        summary: '[AZDO 12] Esportazione',
        key: 'AUR-910',
        at: NOW.toISOString(),
        by: 'Paola Verdi',
      },
    ])
    // Asked again: the one created is not created twice, the one refused is tried again.
    const found = await tickets.missing(aurora, 'run-1')
    expect(found.tickets.map((ticket) => ticket.key)).toEqual(['AUR-910', null, null])
    await tickets.create(aurora, 'run-1', chosen, 'AUR')
    expect(calls[1]?.tickets.map((ticket) => ticket.summary)).toEqual(['[AZDO 13] Filtro'])
    expect(await tickets.create(aurora, 'run-1', ['[AZDO 12] Esportazione'], 'AUR')).toEqual([])
    expect(calls).toHaveLength(2)
  })

  it('refuses before the network a key that is not one, a project without Jira or credential', async () => {
    const one = ['[AZDO 12] Esportazione']
    const { tickets, calls } = setup()
    await expect(tickets.create(aurora, 'run-1', one, 'aur; DROP')).rejects.toMatchObject({
      code: 'source_config_invalid',
    })
    await expect(setup({ linked: false }).tickets.missing(aurora, 'run-1')).rejects.toMatchObject({
      code: 'source_not_configured',
    })
    await expect(
      setup({ secret: null }).tickets.create(aurora, 'run-1', one, 'AUR'),
    ).rejects.toMatchObject({ code: 'secret_missing' })
    expect(calls).toEqual([])
  })
})
