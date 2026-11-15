// @vitest-environment jsdom
import type { AgentProgress } from '@octo/application'
import {
  DELIVERABLE_CATALOG,
  type Deliverable,
  type DeliverableKind,
  type Project,
} from '@octo/domain'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Handoff } from '../src/renderer/context.ts'
import { DeliverablesView } from '../src/renderer/DeliverablesView.tsx'
import { handoffField, handoffText } from '../src/renderer/handoff-text.ts'
import { messages } from '../src/renderer/messages.ts'
import { DELIVERABLE_INPUT_LIMIT, type OctoApi, type Result } from '../src/shared/api.ts'

const project: Project = { id: 'p-1', name: 'Aurora', folder: '/progetti/Aurora', addedAt: '' }
const ok = <T,>(value: T): Result<T> => ({ ok: true, value })

const OWN_KIND: DeliverableKind = {
  id: 'proprio-nota-di-rilascio',
  title: 'Nota di rilascio',
  summary: 'Novità per chi usa il prodotto.',
  audience: 'client',
  fields: [{ key: 'domanda-1', label: 'Quale versione', kind: 'long', required: true }],
  instructions: 'Scrivi le novità.',
  checklist: ['Nessun nome interno'],
}

const review: Deliverable = {
  id: 'd-1',
  projectId: 'p-1',
  kindId: 'email-cliente',
  title: 'Collaudo',
  inputs: { tema: 'Collaudo' },
  status: 'review',
  createdAt: '2026-11-14T10:00:00.000Z',
  rounds: [{ at: '2026-11-14T10:00:00.000Z', request: null, durationMs: 120_000, error: null }],
  draft: {
    text: 'Oggetto: Collaudo\n\nIl collaudo è il 17 dicembre [1]. Il budget è di 99.000 euro [2].',
    citations: [
      {
        n: 1,
        path: 'posta/a.md',
        quote: 'spostato al 17 dicembre 2026',
        status: 'verified',
        modifiedAt: null,
      },
      {
        n: 2,
        path: 'posta/a.md',
        quote: 'budget di 99.000',
        status: 'quote_not_found',
        modifiedAt: null,
      },
    ],
    missing: ['Chi firma il verbale'],
    markersWithoutCitation: [],
  },
  written: null,
  redTeam: {
    verdict: 'fix_first',
    findings: [
      {
        severity: 'grave',
        finding: 'Il budget non ha una fonte',
        where: '99.000 euro',
        why: 'Il cliente lo può contestare',
      },
    ],
    holds: 'La data regge.',
  },
  readyAt: '2026-11-14T10:02:00.000Z',
  reviewMs: 0,
  approvedAt: null,
  files: [],
}
const approved: Deliverable = {
  ...review,
  status: 'approved',
  approvedAt: '2026-11-14T10:10:00.000Z',
  reviewMs: 480_000,
  redTeam: { verdict: 'deliverable', findings: [], holds: '' },
  files: [
    '_octo/deliverable/approvati/2026-11-14_email-cliente_collaudo.md',
    '_octo/deliverable/approvati/2026-11-14_email-cliente_collaudo.docx',
  ],
}

type DeliverablesApi = Pick<
  OctoApi,
  | 'deliverableCatalog'
  | 'listDeliverables'
  | 'startDeliverable'
  | 'reviseDeliverable'
  | 'approveDeliverable'
  | 'deliverableInstructions'
  | 'saveDeliverableInstructions'
  | 'onDeliverableProgress'
  | 'saveDeliverableKind'
  | 'removeDeliverableKind'
  | 'hasLetterhead'
  | 'chooseLetterhead'
  | 'removeLetterhead'
  | 'hasDeckModel'
  | 'chooseDeckModel'
  | 'removeDeckModel'
  | 'openEvidence'
>

function fakeApi(overrides: Partial<DeliverablesApi> = {}) {
  let progress: (projectId: string, step: AgentProgress) => void = () => {}
  const api: DeliverablesApi = {
    deliverableCatalog: vi.fn(async () => ok([...DELIVERABLE_CATALOG])),
    listDeliverables: vi.fn(async () => ok<Deliverable[]>([])),
    startDeliverable: vi.fn(async () => ok(review)),
    reviseDeliverable: vi.fn(async () => ok(review)),
    approveDeliverable: vi.fn(async () => ok(approved)),
    deliverableInstructions: vi.fn(async () => ok('Dai del lei.')),
    saveDeliverableInstructions: vi.fn(async () => ok(null)),
    onDeliverableProgress: (listener) => {
      progress = listener
      return () => {}
    },
    saveDeliverableKind: vi.fn(async () => ok(OWN_KIND)),
    removeDeliverableKind: vi.fn(async () => ok(null)),
    hasLetterhead: vi.fn(async () => ok(false)),
    chooseLetterhead: vi.fn(async () => ok(true)),
    removeLetterhead: vi.fn(async () => ok(null)),
    hasDeckModel: vi.fn(async () => ok(false)),
    chooseDeckModel: vi.fn(async () => ok(true)),
    removeDeckModel: vi.fn(async () => ok(null)),
    openEvidence: vi.fn(async () => ok(null)),
    ...overrides,
  }
  return { api: api as OctoApi, progress: (id: string, step: AgentProgress) => progress(id, step) }
}

const type = (label: string | RegExp, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } })

afterEach(cleanup)

describe('DeliverablesView', () => {
  it('goes from the catalog to a draft with its sources, red team and checklist', async () => {
    let finish: (result: Result<Deliverable>) => void = () => {}
    const { api, progress } = fakeApi({
      startDeliverable: vi.fn(
        () => new Promise<Result<Deliverable>>((resolve) => (finish = resolve)),
      ),
    })
    render(<DeliverablesView api={api} project={project} />)

    expect(await screen.findByText(messages.deliverableNone)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Email al cliente/ }))
    const write = screen.getByRole<HTMLButtonElement>('button', { name: messages.deliverableWrite })
    expect(write.disabled).toBe(true)

    type('A chi scrivi', 'Carla Bianchi')
    type(/^Di che cosa/, 'Collaudo')
    type(/^Che cosa chiedi/, 'Conferma la data')
    fireEvent.click(write)

    expect(await screen.findByText(messages.deliverableWriting)).toBeTruthy()
    act(() => progress('altro', { kind: 'reading', target: 'x.md' }))
    act(() => progress('p-1', { kind: 'reading', target: 'posta/a.md' }))
    expect(screen.getByRole('status').textContent).toBe('Leggo posta/a.md')

    await act(async () => finish(ok(review)))
    expect(api.startDeliverable).toHaveBeenCalledWith('p-1', 'email-cliente', {
      destinatario: 'Carla Bianchi',
      tema: 'Collaudo',
      richiesta: 'Conferma la data',
    })
    expect(await screen.findByText(messages.toCheck(1))).toBeTruthy()
    expect(screen.getByText(messages.deliverableRedTeamFix)).toBeTruthy()
    expect(screen.getByText('Il budget non ha una fonte')).toBeTruthy()
    // The code points at the amount in a text that goes to the client.
    const filter = screen.getByRole('region', { name: messages.deliverableClientFilter })
    expect(within(filter).getByText('99.000 euro')).toBeTruthy()
    expect(within(filter).getByText(messages.deliverableClientFilterKind.money)).toBeTruthy()
    expect(screen.getByText(/La data regge\./)).toBeTruthy()
    expect(screen.getByText('Chi firma il verbale')).toBeTruthy()
    expect(screen.getByText(DELIVERABLE_CATALOG[0]?.checklist[0] ?? '')).toBeTruthy()
    expect(screen.getByText(/Scrittura 2 min · Revisione 0 min · 1 giro/)).toBeTruthy()
  })

  it('asks a change in words and approves, then offers the files', async () => {
    const { api } = fakeApi({ listDeliverables: vi.fn(async () => ok([review])) })
    render(<DeliverablesView api={api} project={project} />)
    fireEvent.click(await screen.findByRole('button', { name: /Collaudo/ }))

    const change = screen.getByRole<HTMLButtonElement>('button', {
      name: messages.deliverableChangeSubmit,
    })
    expect(change.disabled).toBe(true)
    type(messages.deliverableChange, 'Togli il budget')
    fireEvent.click(change)
    await waitFor(() =>
      expect(api.reviseDeliverable).toHaveBeenCalledWith('p-1', 'd-1', 'Togli il budget'),
    )

    fireEvent.click(await screen.findByRole('button', { name: messages.deliverableApprove }))
    expect(await screen.findByText(messages.deliverableFiles)).toBeTruthy()
    expect(screen.getByText(messages.deliverableRedTeamOk)).toBeTruthy()
    expect(screen.queryByRole('button', { name: messages.deliverableApprove })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: '2026-11-14_email-cliente_collaudo.docx' }))
    expect(api.openEvidence).toHaveBeenCalledWith('p-1', approved.files[1])
    // A source of the draft is shown beside it; the original is one click further.
    const panel = screen.getByRole('complementary', { name: messages.citation.panel })
    expect(within(panel).getByText('posta/a.md')).toBeTruthy()
    fireEvent.click(within(panel).getByRole('button', { name: messages.citation.open }))
    await waitFor(() => expect(api.openEvidence).toHaveBeenCalledWith('p-1', 'posta/a.md'))
  })

  it('shows the draft formatted: headings, tables and the lines of an email', async () => {
    const formatted: Deliverable = {
      ...review,
      draft: {
        text: '## Stima\n\nTotale **9,0 gg**.\n\n| Fase | gg |\n|---|---|\n| Sviluppo | 7,0 |\n\nGentile Carla,\nLe scrivo per il collaudo [1].',
        citations: [review.draft?.citations[0]].flatMap((citation) => (citation ? [citation] : [])),
        missing: [],
        markersWithoutCitation: [],
      },
    }
    const { api } = fakeApi({ listDeliverables: vi.fn(async () => ok([formatted])) })
    render(<DeliverablesView api={api} project={project} />)
    fireEvent.click(await screen.findByRole('button', { name: /Collaudo/ }))

    expect(await screen.findByRole('heading', { name: 'Stima' })).toBeTruthy()
    expect(screen.getByRole('columnheader', { name: 'Fase' })).toBeTruthy()
    expect(screen.getByRole('cell', { name: '7,0' })).toBeTruthy()
    // In the text and, since the email goes to the client, among the figures to check.
    expect(screen.getAllByText('9,0 gg').map((found) => found.tagName)).toEqual([
      'STRONG',
      'STRONG',
    ])
    const greeting = screen.getByText(/Gentile Carla,/)
    expect(greeting.querySelector('br')).not.toBeNull()
    expect(screen.queryByText(/\|---\|/)).toBeNull()
  })

  it('lets the PM choose a letterhead for the Word files, and take it away', async () => {
    const has = vi
      .fn<OctoApi['hasLetterhead']>()
      .mockResolvedValueOnce(ok(false))
      .mockResolvedValueOnce(ok(true))
      .mockResolvedValue(ok(false))
    const { api } = fakeApi({ hasLetterhead: has })
    render(<DeliverablesView api={api} project={project} />)

    expect(await screen.findByText(messages.letterheadNone)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: messages.letterheadChoose }))
    expect(await screen.findByText(messages.letterheadSet)).toBeTruthy()
    expect(api.chooseLetterhead).toHaveBeenCalledWith('p-1')

    fireEvent.click(screen.getByRole('button', { name: messages.letterheadRemove }))
    expect(await screen.findByText(messages.letterheadNone)).toBeTruthy()
    expect(api.removeLetterhead).toHaveBeenCalledWith('p-1')
  })

  it('lets the PM choose a deck for the slides, and take it away', async () => {
    const has = vi
      .fn<OctoApi['hasDeckModel']>()
      .mockResolvedValueOnce(ok(false))
      .mockResolvedValueOnce(ok(true))
      .mockResolvedValue(ok(false))
    const { api } = fakeApi({ hasDeckModel: has })
    render(<DeliverablesView api={api} project={project} />)

    expect(await screen.findByText(messages.deckModelNone)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: messages.deckModelChoose }))
    expect(await screen.findByText(messages.deckModelSet)).toBeTruthy()
    expect(api.chooseDeckModel).toHaveBeenCalledWith('p-1')
    fireEvent.click(screen.getByRole('button', { name: messages.letterheadRemove }))
    expect(await screen.findByText(messages.deckModelNone)).toBeTruthy()
    expect(api.removeDeckModel).toHaveBeenCalledWith('p-1')
  })

  it('explains a file that is not a deck', async () => {
    const { api } = fakeApi({
      chooseDeckModel: vi.fn(
        async () => ({ ok: false, code: 'deck_model_invalid' }) as Result<boolean>,
      ),
    })
    render(<DeliverablesView api={api} project={project} />)
    fireEvent.click(await screen.findByRole('button', { name: messages.deckModelChoose }))
    expect(await screen.findByText(/non è una presentazione che posso usare/)).toBeTruthy()
  })

  it('explains a file that is not a letterhead', async () => {
    const { api } = fakeApi({
      chooseLetterhead: vi.fn(
        async () => ({ ok: false, code: 'letterhead_invalid' }) as Result<boolean>,
      ),
    })
    render(<DeliverablesView api={api} project={project} />)
    fireEvent.click(await screen.findByRole('button', { name: messages.letterheadChoose }))
    expect(await screen.findByText(/non è un documento Word che posso usare/)).toBeTruthy()
  })

  it('lets the PM describe a kind of their own, change it and remove it', async () => {
    const catalog = vi
      .fn<OctoApi['deliverableCatalog']>()
      .mockResolvedValueOnce(ok([...DELIVERABLE_CATALOG]))
      .mockResolvedValue(ok([...DELIVERABLE_CATALOG, OWN_KIND]))
    const { api } = fakeApi({ deliverableCatalog: catalog })
    render(<DeliverablesView api={api} project={project} />)

    fireEvent.click(await screen.findByRole('button', { name: messages.ownKindNew }))
    const save = screen.getByRole<HTMLButtonElement>('button', { name: messages.ownKindSave })
    expect(save.disabled).toBe(true)
    type(messages.ownKindTitle, 'Nota di rilascio')
    type(messages.ownKindAudience, 'internal')
    type(/^Che cosa chiederti/, 'Quale versione *\nChe cosa evidenziare')
    type(/^Come va scritto/, 'Scrivi le novità.')
    type(/^Che cosa controllare/, 'Nessun nome interno')
    fireEvent.click(save)

    await waitFor(() =>
      expect(api.saveDeliverableKind).toHaveBeenCalledWith('p-1', {
        title: 'Nota di rilascio',
        summary: '',
        audience: 'internal',
        questions: ['Quale versione *', 'Che cosa evidenziare'],
        instructions: 'Scrivi le novità.',
        checklist: ['Nessun nome interno'],
      }),
    )
    expect(await screen.findByText(/Per il cliente · Tuo/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Modifica Nota di rilascio' }))
    expect(screen.getByLabelText<HTMLInputElement>(messages.ownKindTitle).value).toBe(
      'Nota di rilascio',
    )
    expect(screen.getByLabelText<HTMLTextAreaElement>(/^Che cosa chiederti/).value).toBe(
      'Quale versione *',
    )
    fireEvent.click(screen.getByRole('button', { name: messages.deliverableNew }))
    fireEvent.click(await screen.findByRole('button', { name: 'Elimina Nota di rilascio' }))
    await waitFor(() =>
      expect(api.removeDeliverableKind).toHaveBeenCalledWith('p-1', 'proprio-nota-di-rilascio'),
    )
  })

  it('explains a kind it cannot save', async () => {
    const { api } = fakeApi({
      saveDeliverableKind: vi.fn(
        async () => ({ ok: false, code: 'deliverable_kind_invalid' }) as Result<DeliverableKind>,
      ),
    })
    render(<DeliverablesView api={api} project={project} />)
    fireEvent.click(await screen.findByRole('button', { name: messages.ownKindNew }))
    type(messages.ownKindTitle, 'X')
    type(/^Come va scritto/, 'Y')
    fireEvent.click(screen.getByRole('button', { name: messages.ownKindSave }))
    expect(await screen.findByText(/Servono un titolo e le istruzioni/)).toBeTruthy()
  })

  it('shows the register of what each deliverable cost', async () => {
    const empty = fakeApi()
    render(<DeliverablesView api={empty.api} project={project} />)
    fireEvent.click(await screen.findByRole('button', { name: messages.deliverableRegister }))
    expect(await screen.findByText(messages.deliverableRegisterEmpty)).toBeTruthy()
    cleanup()

    const { api } = fakeApi({ listDeliverables: vi.fn(async () => ok([approved])) })
    render(<DeliverablesView api={api} project={project} />)
    await screen.findByRole('button', { name: /Collaudo/ })
    fireEvent.click(screen.getByRole('button', { name: messages.deliverableRegister }))

    const row = (await screen.findByRole('cell', { name: 'Collaudo' })).closest('tr')
    expect(row?.textContent).toContain('Email al clienteCollaudoApprovato281')
    expect(screen.getByText(messages.deliverableRegisterTotals(1, 2, 8, 1))).toBeTruthy()
  })

  it('keeps for the project what the PM adds to how a kind is written', async () => {
    const { api } = fakeApi()
    render(<DeliverablesView api={api} project={project} />)
    fireEvent.click(await screen.findByRole('button', { name: /Verbale di riunione/ }))

    const box = await screen.findByLabelText<HTMLTextAreaElement>(
      messages.deliverableProjectInstructions,
    )
    await waitFor(() => expect(box.value).toBe('Dai del lei.'))
    fireEvent.change(box, { target: { value: 'Dai del tu.' } })
    fireEvent.click(screen.getByRole('button', { name: messages.deliverableInstructionsSave }))

    expect(await screen.findByText(messages.deliverableInstructionsSaved)).toBeTruthy()
    expect(api.saveDeliverableInstructions).toHaveBeenCalledWith('p-1', 'verbale', 'Dai del tu.')
  })

  it('explains a draft that failed, a change that failed and a list it cannot load', async () => {
    const failed: Deliverable = {
      ...review,
      status: 'failed',
      draft: null,
      redTeam: null,
      rounds: [{ at: '', request: null, durationMs: 1000, error: 'agent_not_signed_in' }],
    }
    const stuck: Deliverable = {
      ...review,
      id: 'd-2',
      title: 'Verbale',
      rounds: [
        ...review.rounds,
        { at: '', request: 'Più breve', durationMs: 1000, error: 'agent_failed' },
      ],
    }
    const { api } = fakeApi({
      listDeliverables: vi.fn(async () => ok([failed, stuck])),
      approveDeliverable: vi.fn(
        async () => ({ ok: false, code: 'deliverable_not_ready' }) as Result<Deliverable>,
      ),
    })
    render(<DeliverablesView api={api} project={project} />)

    fireEvent.click(await screen.findByRole('button', { name: /Collaudo/ }))
    expect(await screen.findByText(/La scrittura non è riuscita/)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /Verbale/ }))
    expect(await screen.findByText(/L’ultima modifica non è riuscita/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: messages.deliverableApprove }))
    expect(await screen.findByText('Questo deliverable non è in revisione.')).toBeTruthy()
    cleanup()

    const broken = fakeApi({
      listDeliverables: vi.fn(
        async () => ({ ok: false, code: 'unexpected' }) as Result<Deliverable[]>,
      ),
    })
    render(<DeliverablesView api={broken.api} project={project} />)
    expect(await screen.findByText('Qualcosa non ha funzionato. Riprova.')).toBeTruthy()
  })
})

describe('a deliverable started from an answer', () => {
  const handoff: Handoff = {
    question: 'Quando è il collaudo?',
    answer: review.draft as NonNullable<Deliverable['draft']>,
  }

  it('fills the notes of the kind with the question, the sources and the answer', async () => {
    const { api } = fakeApi()
    const done = vi.fn()
    render(<DeliverablesView api={api} project={project} handoff={handoff} onHandoffDone={done} />)
    const context = await screen.findByRole('region', { name: messages.handoff.title })
    expect(context.textContent).toContain('Quando è il collaudo?')
    // The same file cited twice is one source.
    expect(context.textContent).toContain(messages.handoff.sources(1))

    fireEvent.click(screen.getByRole('button', { name: /Email al cliente/ }))
    expect(screen.getByText(messages.handoff.filled)).toBeTruthy()
    type('A chi scrivi', 'Carla Bianchi')
    type(/^Di che cosa/, 'Collaudo')
    type(/^Che cosa chiedi/, 'Conferma la data')
    fireEvent.click(screen.getByRole('button', { name: messages.deliverableWrite }))

    await waitFor(() => expect(api.startDeliverable).toHaveBeenCalled())
    const inputs = vi.mocked(api.startDeliverable).mock.calls[0]?.[2]
    expect(inputs?.note).toContain('Domanda: Quando è il collaudo?')
    expect(inputs?.note).toContain('- posta/a.md')
    expect(inputs?.note).toContain('- Chi firma il verbale')
    expect(inputs?.note).toContain('Il collaudo è il 17 dicembre')
    // Once written, the context is used: the next deliverable starts empty.
    await waitFor(() => expect(done).toHaveBeenCalled())
  })

  it('lets the PM put the context aside', async () => {
    const { api } = fakeApi()
    const done = vi.fn()
    render(<DeliverablesView api={api} project={project} handoff={handoff} onHandoffDone={done} />)
    fireEvent.click(await screen.findByRole('button', { name: messages.handoff.drop }))
    expect(done).toHaveBeenCalled()
  })

  it('cuts an answer longer than the field holds, keeping the question and the sources', () => {
    const long: Handoff = {
      question: 'Domanda lunga?',
      answer: { ...handoff.answer, text: 'parola '.repeat(2000) },
    }
    const filled = handoffText(long)
    expect(filled.length).toBeLessThanOrEqual(DELIVERABLE_INPUT_LIMIT)
    expect(filled).toContain('Domanda: Domanda lunga?')
    expect(filled).toContain('- posta/a.md')
    expect(filled.endsWith('…')).toBe(true)
    // A kind without a long field takes no context.
    expect(handoffField({ ...OWN_KIND, fields: [] })).toBeNull()
    expect(handoffField(OWN_KIND)).toBe('domanda-1')
    expect(
      handoffText({ ...long, answer: { ...long.answer, citations: [], missing: [] } }, 30),
    ).toHaveLength(30)
  })
})

describe('the review beside the draft', () => {
  it('marks a finding as seen for the draft in view only, and names who the text is for', async () => {
    const again: Deliverable = {
      ...review,
      rounds: [
        ...review.rounds,
        {
          at: '2026-11-14T10:05:00.000Z',
          request: 'Togli il budget',
          durationMs: 1000,
          error: null,
        },
      ],
    }
    const { api } = fakeApi({
      listDeliverables: vi.fn(async () => ok([review])),
      reviseDeliverable: vi.fn(async () => ok(again)),
    })
    render(<DeliverablesView api={api} project={project} />)
    fireEvent.click(await screen.findByRole('button', { name: /Collaudo/ }))
    const panel = () => screen.getByRole('complementary', { name: messages.review.panel })
    expect(screen.getAllByText(messages.deliverableFor.client).length).toBeGreaterThan(0)
    expect(within(panel()).getByText(messages.review.left(1))).toBeTruthy()

    fireEvent.click(within(panel()).getByRole('button', { name: messages.review.seen }))
    expect(within(panel()).getByText(messages.review.left(0))).toBeTruthy()
    fireEvent.click(within(panel()).getByRole('button', { name: /Rivisto/ }))
    expect(within(panel()).getByText(messages.review.left(1))).toBeTruthy()
    fireEvent.click(within(panel()).getByRole('button', { name: messages.review.seen }))

    // Another draft was written: what was seen was seen on the one before.
    type(messages.deliverableChange, 'Togli il budget')
    const change = screen.getByRole('button', {
      name: new RegExp(messages.deliverableChangeSubmit),
    })
    fireEvent.click(change)
    await waitFor(() => expect(api.reviseDeliverable).toHaveBeenCalled())
    await waitFor(() => expect(within(panel()).getByText(messages.review.left(1))).toBeTruthy())
  })

  it('shows nothing of a project the PM has left, whenever its draft comes back', async () => {
    let finish: (result: Result<Deliverable>) => void = () => {}
    const { api } = fakeApi({
      listDeliverables: vi.fn(async (projectId: string) => ok(projectId === 'p-1' ? [review] : [])),
      approveDeliverable: vi.fn(
        () => new Promise<Result<Deliverable>>((resolve) => (finish = resolve)),
      ),
    })
    const { rerender } = render(<DeliverablesView api={api} project={project} />)
    fireEvent.click(await screen.findByRole('button', { name: /Collaudo/ }))
    fireEvent.click(screen.getByRole('button', { name: messages.deliverableApprove }))
    rerender(<DeliverablesView api={api} project={{ ...project, id: 'p-2', name: 'Boreale' }} />)
    expect(await screen.findByText(messages.deliverableNone)).toBeTruthy()
    await act(async () => finish(ok(approved)))
    expect(screen.queryByText(messages.deliverableFiles)).toBeNull()
    expect(screen.getByText(messages.deliverableNone)).toBeTruthy()
  })
})
