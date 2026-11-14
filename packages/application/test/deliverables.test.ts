import {
  type Deliverable,
  DomainError,
  type DraftAnswer,
  MAX_REVIEW_PAUSE_MS,
  type Project,
  type RedTeamReport,
} from '@octo/domain'
import { describe, expect, it } from 'vitest'
import { createDeliverables, type DraftRequest } from '../src/index.ts'
import { countingIds, evidenceFrom, memoryWriter, removerOf } from './fakes.ts'

const project: Project = { id: 'p-1', name: 'Aurora', folder: '/progetti/Aurora', addedAt: '' }
const START = Date.parse('2026-11-14T10:00:00.000Z')
const MINUTE = 60_000
const inputs = { destinatario: 'Carla', tema: 'Collaudo', richiesta: 'Conferma la data' }
const draft: DraftAnswer = {
  text: 'Il collaudo è il 17 dicembre [1].',
  citations: [{ n: 1, path: 'posta/a.md', quote: 'spostato al 17 dicembre 2026' }],
  missing: [],
}
const clean: RedTeamReport = { verdict: 'deliverable', findings: [], holds: 'La data regge.' }

function setup(options: { fails?: Error; redTeamFails?: Error } = {}) {
  const memory = memoryWriter()
  const requests: DraftRequest[] = []
  let now = START
  const base = removerOf(memory.files)
  const service = createDeliverables({
    writer: {
      draft: async (request) => {
        requests.push(request)
        now += 2 * MINUTE
        if (options.fails) throw options.fails
        return draft
      },
      redTeam: async () => {
        if (options.redTeamFails) throw options.redTeamFails
        return clean
      },
    },
    renderer: {
      word: async (_title, _markdown, letterhead) =>
        new Uint8Array(letterhead ? [1, 2, 3, 4, 5] : [1, 2, 3]),
      checkLetterhead: async (bytes) => {
        if (bytes.length === 0) throw new DomainError('letterhead_invalid')
      },
    },
    evidence: evidenceFrom({
      'posta/a.md': {
        kind: 'found',
        text: 'Collaudo spostato al 17 dicembre 2026.',
        modifiedAt: '',
      },
    }),
    files: {
      ...base,
      read: async () => new Uint8Array([9, 9]),
      under: async (_folder, folder) =>
        [...memory.files.keys()].filter((path) => path.startsWith(`${folder}/`)),
    },
    memory,
    clock: { now: () => new Date(now) },
    ids: countingIds('d'),
  })
  return { service, memory, requests, wait: (ms: number) => (now += ms), options }
}

describe('writing a deliverable', () => {
  it('offers the catalog and refuses a kind it does not have or an input left empty', async () => {
    const { service } = setup()
    expect(service.catalog().map((kind) => kind.id)).toContain('email-cliente')

    await expect(service.start(project, { kindId: 'nessuno', inputs })).rejects.toMatchObject({
      code: 'deliverable_kind_unknown',
    })
    await expect(
      service.start(project, { kindId: 'email-cliente', inputs: { ...inputs, tema: ' ' } }),
    ).rejects.toMatchObject({ code: 'deliverable_input_missing' })
  })

  it('drafts with the sources checked and the red team done, and measures the writing', async () => {
    const { service, requests } = setup()

    const made = await service.start(project, { kindId: 'email-cliente', inputs })

    expect(made).toMatchObject({ id: 'd-1', status: 'review', title: 'Collaudo', redTeam: clean })
    expect(made.draft?.citations[0]?.status).toBe('verified')
    expect(made.rounds).toEqual([
      { at: new Date(START).toISOString(), request: null, durationMs: 2 * MINUTE, error: null },
    ])
    expect(requests[0]).toMatchObject({ revision: null, projectInstructions: null })
    expect(await service.get(project, 'd-1')).toEqual(made)
  })

  it('keeps a first draft that failed as failed, with the reason', async () => {
    const { service } = setup({ fails: new DomainError('agent_not_signed_in') })

    const made = await service.start(project, { kindId: 'email-cliente', inputs })

    expect(made).toMatchObject({ status: 'failed', draft: null })
    expect(made.rounds[0]?.error).toBe('agent_not_signed_in')
    await expect(service.approve(project, made.id)).rejects.toMatchObject({
      code: 'deliverable_not_ready',
    })
  })

  it('lets unexpected errors through', async () => {
    const { service } = setup({ fails: new Error('disk full') })
    await expect(service.start(project, { kindId: 'email-cliente', inputs })).rejects.toThrow(
      'disk full',
    )
  })
})

describe('reviewing a deliverable', () => {
  it('applies a change asked in words, counting the round and the time spent reviewing', async () => {
    const { service, requests, wait } = setup()
    const made = await service.start(project, { kindId: 'email-cliente', inputs })
    await service.saveInstructions(project, 'email-cliente', 'Dai del lei.')

    wait(5 * MINUTE)
    const revised = await service.revise(project, {
      deliverableId: made.id,
      request: ' Più breve ',
    })

    expect(revised.rounds.map((round) => round.request)).toEqual([null, 'Più breve'])
    expect(revised.reviewMs).toBe(5 * MINUTE)
    expect(requests[1]?.revision).toMatchObject({ request: 'Più breve' })
    expect(requests[1]?.projectInstructions).toBe('Dai del lei.\n')
  })

  it('does not count a long pause as review', async () => {
    const { service, wait } = setup()
    const made = await service.start(project, { kindId: 'email-cliente', inputs })

    wait(8 * 60 * MINUTE)
    const approved = await service.approve(project, made.id)

    expect(approved.reviewMs).toBe(MAX_REVIEW_PAUSE_MS)
  })

  it('keeps the draft under review when a change fails', async () => {
    const context = setup()
    const made = await context.service.start(project, { kindId: 'email-cliente', inputs })
    context.options.redTeamFails = new DomainError('agent_failed')

    const revised = await context.service.revise(project, {
      deliverableId: made.id,
      request: 'Più breve',
    })

    expect(revised).toMatchObject({ status: 'review', draft: made.draft })
    expect(revised.rounds[1]?.error).toBe('agent_failed')
  })

  it('refuses an empty change and a deliverable that is not there', async () => {
    const { service } = setup()
    const made = await service.start(project, { kindId: 'email-cliente', inputs })

    await expect(
      service.revise(project, { deliverableId: made.id, request: ' ' }),
    ).rejects.toMatchObject({ code: 'request_empty' })
    await expect(service.get(project, 'assente')).rejects.toMatchObject({
      code: 'deliverable_not_found',
    })
  })
})

describe('approving a deliverable', () => {
  it('writes the text without the markers and a Word file, and closes it', async () => {
    const { service, memory } = setup()
    const made = await service.start(project, { kindId: 'email-cliente', inputs })

    const approved = await service.approve(project, made.id)

    const [markdown, word] = approved.files
    expect(markdown).toBe('_octo/deliverable/approvati/2026-11-14_email-cliente_collaudo.md')
    expect(memory.files.get(markdown ?? '')).toBe('Il collaudo è il 17 dicembre.\n')
    expect(memory.files.get(word ?? '')).toBe('<3 bytes>')
    await expect(service.approve(project, made.id)).rejects.toMatchObject({
      code: 'deliverable_not_ready',
    })
    await expect(
      service.revise(project, { deliverableId: made.id, request: 'Ancora' }),
    ).rejects.toMatchObject({ code: 'deliverable_not_ready' })
  })

  it('writes the Word file on the letterhead of the project, once the PM chose one', async () => {
    const { service, memory } = setup()
    expect(await service.hasLetterhead(project)).toBe(false)
    await expect(service.setLetterhead(project, new Uint8Array())).rejects.toMatchObject({
      code: 'letterhead_invalid',
    })

    await service.setLetterhead(project, new Uint8Array([9, 9]))
    expect(await service.hasLetterhead(project)).toBe(true)
    const made = await service.start(project, { kindId: 'email-cliente', inputs })
    const approved = await service.approve(project, made.id)
    expect(memory.files.get(approved.files[1] ?? '')).toBe('<5 bytes>')

    await service.setLetterhead(project, null)
    expect(await service.hasLetterhead(project)).toBe(false)
  })

  it('keeps the register of the project up to date at every approval', async () => {
    const { service, memory } = setup()
    const made = await service.start(project, { kindId: 'email-cliente', inputs })
    await service.approve(project, made.id)

    expect(memory.files.get('_octo/deliverable/registro.md')).toContain(
      '| Email al cliente | Collaudo | approvato |',
    )
  })

  it('lists the deliverables of a project, newest first', async () => {
    const { service, wait } = setup()
    await service.start(project, { kindId: 'email-cliente', inputs })
    wait(60 * MINUTE)
    await service.start(project, { kindId: 'verbale', inputs: { riunione: 'Standup del 13/11' } })

    const all: Deliverable[] = await service.list(project)

    expect(all.map((deliverable) => deliverable.title)).toEqual(['Standup del 13/11', 'Collaudo'])
  })
})
