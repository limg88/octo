import {
  type DeckDraft,
  type DeckOutline,
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

const OUTLINE: DeckOutline = {
  slides: [
    { slide: 1, texts: [{ id: 'S1.T1', text: 'Aurora — PI6', title: false }], tables: [] },
    {
      slide: 2,
      texts: [
        { id: 'S2.T1', text: 'Avanzamento — PI6', title: true },
        { id: 'S2.T2', text: 'Dati al 23/10', title: false },
      ],
      tables: [
        { id: 'S2.TAB1', columns: ['Voce', 'Stato'], rows: 1, sample: [['Ordini', 'Done']] },
      ],
    },
    { slide: 3, texts: [{ id: 'S3.T1', text: 'Capacity', title: true }], tables: [] },
  ],
}

function setup(options: { fails?: Error; redTeamFails?: Error; deck?: DeckDraft } = {}) {
  const filled: DeckDraft[] = []
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
        // A writer given the outline of a model deck gives its slides, and no text.
        if (request.deckOutline && options.deck) return { ...draft, text: '', deck: options.deck }
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
      deck: async (title, _markdown, model) => new Uint8Array(title.length + model.length),
      checkDeckModel: async (bytes) => {
        if (bytes.length === 0) throw new DomainError('deck_model_invalid')
      },
      deckOutline: async () => OUTLINE,
      fillDeck: async (model, deck) => {
        filled.push(deck)
        return new Uint8Array(model.length + deck.slides.length)
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
  return { service, memory, requests, filled, wait: (ms: number) => (now += ms), options }
}

describe('writing a deliverable', () => {
  it('offers the catalog and refuses a kind it does not have or an input left empty', async () => {
    const { service } = setup()
    expect((await service.catalog(project)).map((kind) => kind.id)).toContain('email-cliente')

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

describe('kinds the PM defines for a project', () => {
  const own = {
    title: 'Nota di rilascio',
    summary: 'Che cosa cambia per chi usa il prodotto.',
    audience: 'client' as const,
    questions: ['Quale versione *', 'Che cosa mettere in evidenza'],
    instructions: 'Scrivi le novità come le leggerebbe chi usa il prodotto.',
    checklist: ['Nessun nome interno'],
  }

  it('enter the catalog after the built-in ones and are written like them', async () => {
    const { service, requests } = setup()

    const kind = await service.saveKind(project, own)

    expect(kind.id).toBe('proprio-nota-di-rilascio')
    expect((await service.catalog(project)).at(-1)).toEqual(kind)
    const made = await service.start(project, {
      kindId: kind.id,
      inputs: { 'domanda-1': '3.4.0' },
    })
    expect(made).toMatchObject({ status: 'review', title: 'Nota di rilascio' })
    expect(requests[0]?.kind.instructions).toBe(own.instructions)
    await expect(service.start(project, { kindId: kind.id, inputs: {} })).rejects.toMatchObject({
      code: 'deliverable_input_missing',
    })
  })

  it('are replaced when saved again with the same title, and can be removed', async () => {
    const { service } = setup()
    await service.saveKind(project, own)
    await service.saveKind(project, { ...own, summary: 'Nuova descrizione.' })
    const mine = (await service.catalog(project)).filter((kind) => kind.id.startsWith('proprio-'))
    expect(mine.map((kind) => kind.summary)).toEqual(['Nuova descrizione.'])

    await service.removeKind(project, 'proprio-nota-di-rilascio')
    expect((await service.catalog(project)).some((kind) => kind.id.startsWith('proprio-'))).toBe(
      false,
    )
    await expect(service.removeKind(project, 'email-cliente')).rejects.toMatchObject({
      code: 'deliverable_kind_unknown',
    })
  })

  it('must have a title and say how they are written', async () => {
    const { service } = setup()
    const invalid = { code: 'deliverable_kind_invalid' }
    await expect(service.saveKind(project, { ...own, title: ' ' })).rejects.toMatchObject(invalid)
    await expect(service.saveKind(project, { ...own, instructions: '' })).rejects.toMatchObject(
      invalid,
    )
    await expect(
      service.saveKind(project, {
        ...own,
        questions: Array.from({ length: 9 }, (_, n) => `Q${n}`),
      }),
    ).rejects.toMatchObject(invalid)
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

  it('also writes slides for a kind that is shown, once the PM chose a deck', async () => {
    const { service, memory } = setup()
    const report = { periodo: 'Sprint 28' }
    expect(await service.hasDeckModel(project)).toBe(false)
    const plain = await service.start(project, { kindId: 'stato-avanzamento', inputs: report })
    expect((await service.approve(project, plain.id)).files).toHaveLength(2)
    await expect(service.setDeckModel(project, new Uint8Array())).rejects.toMatchObject({
      code: 'deck_model_invalid',
    })

    await service.setDeckModel(project, new Uint8Array([7, 7, 7]))
    expect(await service.hasDeckModel(project)).toBe(true)
    const shown = await service.start(project, { kindId: 'stato-avanzamento', inputs: report })
    const approved = await service.approve(project, shown.id)
    expect(approved.files[2]).toMatch(/^_octo\/deliverable\/approvati\/.*sprint-28.*\.pptx$/)
    expect(memory.files.get(approved.files[2] ?? '')).toMatch(/^<\d+ bytes>$/)
    // An email is not shown to an audience: no slides, deck or not.
    const email = await service.start(project, { kindId: 'email-cliente', inputs })
    expect((await service.approve(project, email.id)).files).toHaveLength(2)

    await service.setDeckModel(project, null)
    expect(await service.hasDeckModel(project)).toBe(false)
  })

  it('writes a deck on the outline of the model: its slides, checked as a text, filled at approval', async () => {
    const deck: DeckDraft = {
      slides: [
        { slide: 1, skip: false, texts: [{ id: 'S1.T1', text: 'Aurora — PI7' }], tables: [] },
        {
          slide: 2,
          skip: false,
          // The line that dated the data is not written, and a text nobody asked for is.
          texts: [
            { id: 'S2.T1', text: 'Avanzamento — PI7' },
            { id: 'S9.T9', text: 'Fuori scaletta' },
          ],
          tables: [
            {
              id: 'S2.TAB1',
              columns: ['Voce', 'Stato'],
              rows: [['Collaudo', 'spostato al 17 dicembre [1]'], ['Solo una cella']],
            },
          ],
        },
        // Slide 3 is not given at all.
      ],
    }
    const { service, requests, filled } = setup({ deck })
    await service.setDeckModel(project, new Uint8Array([7, 7, 7]))

    const made = await service.start(project, {
      kindId: 'stato-avanzamento',
      inputs: { periodo: 'Sprint 28' },
    })

    expect(requests[0]?.deckOutline).toEqual(OUTLINE)
    // The text a person reviews is the slides: a section each, the lines, the tables.
    expect(made.draft?.text).toBe(
      [
        '# Sprint 28',
        '',
        '## Slide 1',
        '',
        '- Aurora — PI7',
        '',
        '## Slide 2 — Avanzamento — PI7',
        '',
        '| Voce | Stato |',
        '|---|---|',
        '| Collaudo | spostato al 17 dicembre [1] |',
        '| Solo una cella |  |',
        '',
      ].join('\n'),
    )
    expect(made.draft?.citations[0]?.status).toBe('verified')
    // What the code had to mend is told, in the words of the PM; nothing of the model is kept.
    expect(made.draft?.missing).toEqual([
      'Slide 2: il testo che nel modello dice «Dati al 23/10» non è stato scritto ed è rimasto vuoto.',
      'Slide 2: 1 righe di una tabella avevano più o meno valori delle colonne e sono state adattate.',
      'Slide 3 del modello: non è stata scritta, quindi è stata tolta dalla presentazione.',
    ])
    expect(made.written?.deck?.slides.map((slide) => [slide.slide, slide.skip])).toEqual([
      [1, false],
      [2, false],
      [3, true],
    ])

    const approved = await service.approve(project, made.id)
    expect(approved.files[2]).toMatch(/\.pptx$/)
    // The model is filled with the slides, the source markers taken off.
    expect(filled).toHaveLength(1)
    expect(filled[0]?.slides[1]?.tables[0]?.rows[0]).toEqual([
      'Collaudo',
      'spostato al 17 dicembre',
    ])
    expect(filled[0]?.slides[1]?.texts).toEqual([
      { id: 'S2.T1', text: 'Avanzamento — PI7' },
      { id: 'S2.T2', text: '' },
    ])
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
