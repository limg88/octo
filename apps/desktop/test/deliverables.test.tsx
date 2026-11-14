// @vitest-environment jsdom
import type { AgentProgress } from '@octo/application'
import { DELIVERABLE_CATALOG, type Deliverable, type Project } from '@octo/domain'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DeliverablesView } from '../src/renderer/DeliverablesView.tsx'
import { messages } from '../src/renderer/messages.ts'
import type { OctoApi, Result } from '../src/shared/api.ts'

const project: Project = { id: 'p-1', name: 'Aurora', folder: '/progetti/Aurora', addedAt: '' }
const ok = <T,>(value: T): Result<T> => ({ ok: true, value })

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
    const [source] = screen.getAllByRole('button', { name: 'posta/a.md' })
    if (source) fireEvent.click(source)
    expect(api.openEvidence).toHaveBeenCalledWith('p-1', 'posta/a.md')
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
