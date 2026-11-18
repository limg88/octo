import {
  type DeckDraft,
  type DeckOutline,
  type Deliverable,
  DomainError,
  type DraftAnswer,
  kindTemplatePath,
  LETTERHEAD_PATH,
  MAX_REVIEW_PAUSE_MS,
  MEETINGS_FOLDER,
  meetingMeta,
  type Project,
  type RedTeamReport,
} from '@octo/domain'
import { describe, expect, it } from 'vitest'
import { DELIVERABLE_CATALOG } from '../../domain/test/support/catalog.ts'
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

/** The headings a Word template gives, as the renderer reads them. */
const SECTIONS = ['# Premessa', '## Costi']

function setup(options: { fails?: Error; redTeamFails?: Error; deck?: DeckDraft } = {}) {
  const filled: DeckDraft[] = []
  const reads: string[] = []
  const memory = memoryWriter()
  const requests: DraftRequest[] = []
  let now = START
  const base = removerOf(memory.files)
  const service = createDeliverables({
    shipped: { kinds: async () => [...DELIVERABLE_CATALOG] },
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
      correctKind: async ({ kind, words }) => ({
        instructions: words.includes('#vuoto') ? '  ' : `${kind.instructions}\nRegola: ${words}`,
        summary: ' Aggiunta la regola. ',
      }),
    },
    renderer: {
      word: async (_title, _markdown, letterhead) =>
        new Uint8Array(letterhead ? [1, 2, 3, 4, 5] : [1, 2, 3]),
      checkLetterhead: async (bytes) => {
        if (bytes.length === 0) throw new DomainError('letterhead_invalid')
      },
      wordOutline: async () => SECTIONS,
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
      read: async (_folder, path) => {
        reads.push(path)
        return new Uint8Array([9, 9])
      },
      under: async (_folder, folder) =>
        [...memory.files.keys()].filter((path) => path.startsWith(`${folder}/`)),
    },
    memory,
    clock: { now: () => new Date(now) },
    ids: countingIds('d'),
  })
  return { service, memory, requests, filled, reads, wait: (ms: number) => (now += ms), options }
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
    const told: string[] = []
    const drafts: Deliverable[] = []

    const made = await service.start(project, {
      kindId: 'email-cliente',
      inputs,
      onProgress: (step) => told.push(step.kind),
      onDraft: (drafted) => drafts.push(drafted),
    })

    expect(made).toMatchObject({ id: 'd-1', status: 'review', title: 'Collaudo', redTeam: clean })
    expect(made.draft?.citations[0]?.status).toBe('verified')
    // Where the time went is kept with the round: here the writer took it all.
    expect(made.rounds).toEqual([
      {
        at: new Date(START).toISOString(),
        request: null,
        durationMs: 2 * MINUTE,
        error: null,
        phases: { writeMs: 2 * MINUTE, checkMs: 0, reviewMs: 0 },
      },
    ])
    // The draft is told before its critical reading, still being worked on, and the phases are said.
    expect(told).toEqual(['checking', 'reviewing'])
    expect(drafts).toHaveLength(1)
    expect(drafts[0]).toMatchObject({ status: 'writing', redTeam: null })
    expect(drafts[0]?.draft).toEqual(made.draft)
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

  it('keeps a page of the memory only once the PM approved it, with the files it comes from', async () => {
    const { service, memory } = setup()
    const page = '_octo/progetto/memoria/fatti-correnti.md'
    const made = await service.start(project, {
      kindId: 'memoria-fatti-correnti',
      inputs: { periodo: '17 novembre 2026' },
    })
    // Under review it is a draft like any other: the memory does not have it yet.
    expect(made.status).toBe('review')
    expect(memory.files.has(page)).toBe(false)
    const approved = await service.approve(project, made.id)
    expect(approved.files).toContain(page)
    const kept = memory.files.get(page) ?? ''
    expect(kept.split('\n')[0]).toBe('# Memoria: fatti correnti')
    expect(kept).toContain('approvata dal PM il')
    expect(kept).toContain('## Fonti')
    // The markers of the sources are for the review: the page names the files instead.
    expect(kept).not.toMatch(/\[\d+\]/)
    for (const citation of made.draft?.citations ?? []) expect(kept).toContain(citation.path)
    // A kind that is no page of the memory writes none.
    const email = await service.start(project, { kindId: 'email-cliente', inputs })
    await service.approve(project, email.id)
    expect([...memory.files.keys()].filter((path) => path.includes('/memoria/'))).toEqual([page])
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

  it('names the minutes after the imported meeting the PM chose, and hands its folder to the writer', async () => {
    const { service, memory, requests } = setup()
    const folder = `${MEETINGS_FOLDER}/2026-11-10_kickoff-aurora_ab12cd34`
    const meeting = {
      id: 'ab12cd34-0000-4000-8000-000000000001',
      title: 'Kickoff Aurora',
      started: '2026-11-10T09:00:00.000Z',
      timezone: 'Europe/Rome',
      durationSeconds: 2700,
      participants: [],
      calendarEventUID: null,
      onlineMeetingURL: null,
      exportRevision: null,
      exportedAt: null,
    }
    await memory.write(project.folder, `${folder}/_meta.md`, meetingMeta(meeting, 'export', []))

    const chosen = await service.start(project, { kindId: 'verbale', inputs: { riunione: folder } })
    // A folder of the meetings that holds no meeting is taken as the words it is.
    const gone = `${MEETINGS_FOLDER}/sparita`
    const other = await service.start(project, { kindId: 'verbale', inputs: { riunione: gone } })

    expect(chosen.title).toBe('Kickoff Aurora · 2026-11-10')
    expect(requests[0]?.inputs).toEqual({ riunione: folder })
    expect(requests[0]?.kind.instructions).toContain('_octo/riunioni/')
    expect(other.title).toBe(gone)
  })
})

describe('correcting in words how a kind of Octo is written', () => {
  const shipped = DELIVERABLE_CATALOG.find((kind) => kind.id === 'email-cliente')
  const kindNow = async (service: ReturnType<typeof setup>['service']) =>
    (await service.catalog(project)).find((kind) => kind.id === 'email-cliente')

  it('proposes the instructions written again and keeps nothing until the PM approves', async () => {
    const { service, memory } = setup()

    const proposed = await service.correctKind(project, 'email-cliente', '  chiudi con i saluti ')

    expect(proposed).toMatchObject({ kindId: 'email-cliente', summary: 'Aggiunta la regola.' })
    expect(proposed.instructions).toBe(`${shipped?.instructions}\nRegola: chiudi con i saluti`)
    expect(memory.files.has('_octo/.tipi/corretti/email-cliente.md')).toBe(false)
    expect((await kindNow(service))?.corrected).toBeUndefined()
  })

  it('writes for the project what was approved, and goes back to the kind of Octo', async () => {
    const { service, memory, requests } = setup()
    const proposed = await service.correctKind(project, 'email-cliente', 'chiudi con i saluti')

    await service.approveKindCorrection(project, 'email-cliente', proposed.id)

    expect(memory.files.get('_octo/.tipi/corretti/email-cliente.md')).toBe(
      `${proposed.instructions}\n`,
    )
    expect(await kindNow(service)).toMatchObject({
      corrected: true,
      instructions: proposed.instructions,
    })
    // The writer of the next draft follows the corrected instructions.
    await service.start(project, { kindId: 'email-cliente', inputs })
    expect(requests.at(-1)?.kind.instructions).toBe(proposed.instructions)
    // An approval is spent: the same proposal is not written twice.
    await expect(
      service.approveKindCorrection(project, 'email-cliente', proposed.id),
    ).rejects.toMatchObject({ code: 'work_not_found' })

    await service.restoreKind(project, 'email-cliente')
    expect(await kindNow(service)).toEqual(shipped)
  })

  it('refuses an empty request, an empty answer, another kind’s proposal and a kind of the PM', async () => {
    const { service } = setup()
    await expect(service.correctKind(project, 'email-cliente', '  ')).rejects.toMatchObject({
      code: 'request_empty',
    })
    await expect(service.correctKind(project, 'email-cliente', '#vuoto')).rejects.toMatchObject({
      code: 'agent_output_invalid',
    })
    const proposed = await service.correctKind(project, 'email-cliente', 'più breve')
    await expect(
      service.approveKindCorrection(project, 'verbale', proposed.id),
    ).rejects.toMatchObject({ code: 'work_not_found' })
    const own = await service.saveKind(project, {
      title: 'Nota',
      summary: '',
      audience: 'client',
      questions: [],
      instructions: 'Scrivi.',
      checklist: [],
    })
    await expect(service.correctKind(project, own.id, 'più breve')).rejects.toMatchObject({
      code: 'deliverable_kind_unknown',
    })
  })

  it('remembers only the last proposals', async () => {
    const { service } = setup()
    const first = await service.correctKind(project, 'email-cliente', 'uno')
    for (let n = 0; n < 20; n += 1)
      await service.correctKind(project, 'email-cliente', `altro ${n}`)
    await expect(
      service.approveKindCorrection(project, 'email-cliente', first.id),
    ).rejects.toMatchObject({ code: 'work_not_found' })
  })
})

describe('the template of a kind of deliverable', () => {
  const KIND = 'email-cliente'

  it('gives a kind the sections and the paper of its Word template, before the letterhead', async () => {
    const { service, memory, requests, reads } = setup()
    expect(await service.templates(project)).toEqual({})
    await expect(
      service.setKindTemplate(project, KIND, 'docx', new Uint8Array()),
    ).rejects.toMatchObject({ code: 'letterhead_invalid' })
    await expect(
      service.setKindTemplate(project, 'nessuno', 'docx', new Uint8Array([1])),
    ).rejects.toMatchObject({ code: 'deliverable_kind_unknown' })

    await service.setLetterhead(project, new Uint8Array([9, 9]))
    await service.setKindTemplate(project, KIND, 'docx', new Uint8Array([4, 4]))
    expect(await service.templates(project)).toEqual({ [KIND]: ['docx'] })

    const made = await service.start(project, { kindId: KIND, inputs })
    expect(requests[0]?.sectionOutline).toEqual(SECTIONS)
    expect(requests[0]?.deckOutline).toBeUndefined()
    const approved = await service.approve(project, made.id)
    expect(memory.files.get(approved.files[1] ?? '')).toBe('<5 bytes>')
    // The paper is the one of the kind: the letterhead of the project is not even read.
    expect(reads).toContain(kindTemplatePath(KIND, 'docx'))
    expect(reads).not.toContain(LETTERHEAD_PATH)

    // Another kind has no template: it is written as before, on the letterhead of the project.
    await service.start(project, { kindId: 'voce-di-backlog', inputs: { tema: 'Esportare' } })
    expect(requests[1]?.sectionOutline).toBeUndefined()

    await service.setKindTemplate(project, KIND, 'docx', null)
    expect(await service.templates(project)).toEqual({})
  })

  it('writes a kind as slides on its own presentation, whatever the kind', async () => {
    const { service, requests, reads } = setup()
    await expect(
      service.setKindTemplate(project, KIND, 'pptx', new Uint8Array()),
    ).rejects.toMatchObject({ code: 'deck_model_invalid' })
    await service.setKindTemplate(project, KIND, 'pptx', new Uint8Array([7, 7, 7]))
    await service.setKindTemplate(project, KIND, 'docx', new Uint8Array([4, 4]))
    expect(await service.templates(project)).toEqual({ [KIND]: ['docx', 'pptx'] })

    const made = await service.start(project, { kindId: KIND, inputs })
    // Written as slides: the outline is the one of the presentation, not the sections of Word.
    expect(requests[0]?.deckOutline).toEqual(OUTLINE)
    expect(requests[0]?.sectionOutline).toBeUndefined()
    const approved = await service.approve(project, made.id)
    expect(approved.files).toHaveLength(3)
    expect(reads).toContain(kindTemplatePath(KIND, 'pptx'))
  })

  it('takes the templates of a kind away with the kind', async () => {
    const { service } = setup()
    const own = await service.saveKind(project, {
      title: 'Nota di rilascio',
      summary: '',
      audience: 'client',
      questions: [],
      instructions: 'Breve.',
      checklist: [],
    })
    await service.setKindTemplate(project, own.id, 'docx', new Uint8Array([4]))
    expect(await service.templates(project)).toEqual({ [own.id]: ['docx'] })
    await service.removeKind(project, own.id)
    expect(await service.templates(project)).toEqual({})
  })
})
