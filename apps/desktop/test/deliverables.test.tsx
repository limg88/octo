// @vitest-environment jsdom
import type { AgentProgress } from '@octo/application'
import type {
  Deliverable,
  DeliverableKind,
  Project,
  StoredMeeting,
  TemplateFormat,
} from '@octo/domain'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DELIVERABLE_CATALOG } from '../../../packages/domain/test/support/catalog.ts'
import { SOURCES_SHOWN } from '../src/renderer/AnswerView.tsx'
import type { Handoff } from '../src/renderer/context.ts'
import { DeliverablesView } from '../src/renderer/DeliverablesView.tsx'
import { handoffField, handoffText } from '../src/renderer/handoff-text.ts'
import { DECK_MODEL_TEXT, LETTERHEAD_TEXT, ModelFile } from '../src/renderer/ModelFile.tsx'
import { errorText, messages, progressText } from '../src/renderer/messages.ts'
import { DELIVERABLE_INPUT_LIMIT, type OctoApi, type Result } from '../src/shared/api.ts'

const project: Project = { id: 'p-1', name: 'Aurora', folder: '/progetti/Aurora', addedAt: '' }
const ok = <T,>(value: T): Result<T> => ({ ok: true, value })
const words = messages.kindTemplate

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
  | 'correctKind'
  | 'approveKindCorrection'
  | 'restoreKind'
  | 'onDeliverableProgress'
  | 'onDeliverableDraft'
  | 'saveDeliverableKind'
  | 'removeDeliverableKind'
  | 'kindTemplates'
  | 'chooseKindTemplate'
  | 'removeKindTemplate'
  | 'openEvidence'
  | 'importedMeetings'
>

// The deliverables with a script stand under the catalog and have their own tests.
vi.mock('../src/renderer/ScriptedDeliverables.tsx', () => ({ ScriptedDeliverables: () => null }))

function fakeApi(overrides: Partial<DeliverablesApi> = {}) {
  let progress: (projectId: string, step: AgentProgress) => void = () => {}
  let drafted: (projectId: string, deliverable: Deliverable) => void = () => {}
  const api: DeliverablesApi = {
    deliverableCatalog: vi.fn(async () => ok([...DELIVERABLE_CATALOG])),
    listDeliverables: vi.fn(async () => ok<Deliverable[]>([])),
    startDeliverable: vi.fn(async () => ok(review)),
    reviseDeliverable: vi.fn(async () => ok(review)),
    approveDeliverable: vi.fn(async () => ok(approved)),
    deliverableInstructions: vi.fn(async () => ok('Dai del lei.')),
    saveDeliverableInstructions: vi.fn(async () => ok(null)),
    correctKind: vi.fn(async (_project: string, kindId: string) =>
      ok({ id: 'c-1', kindId, instructions: 'Scrivi breve.', summary: 'Più breve.' }),
    ),
    approveKindCorrection: vi.fn(async () => ok(null)),
    restoreKind: vi.fn(async () => ok(null)),
    onDeliverableProgress: (listener) => {
      progress = listener
      return () => {}
    },
    onDeliverableDraft: (listener) => {
      drafted = listener
      return () => {}
    },
    saveDeliverableKind: vi.fn(async () => ok(OWN_KIND)),
    removeDeliverableKind: vi.fn(async () => ok(null)),
    kindTemplates: vi.fn(async () => ok<Record<string, TemplateFormat[]>>({})),
    chooseKindTemplate: vi.fn(async () => ok<TemplateFormat | null>('docx')),
    removeKindTemplate: vi.fn(async () => ok(null)),
    openEvidence: vi.fn(async () => ok(null)),
    importedMeetings: vi.fn(async () => ok<StoredMeeting[]>([])),
    ...overrides,
  }
  return {
    api: api as OctoApi,
    progress: (id: string, step: AgentProgress) => progress(id, step),
    drafted: (id: string, deliverable: Deliverable) => drafted(id, deliverable),
  }
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
    expect(screen.getByText('Chi firma il verbale')).toBeTruthy()
    expect(screen.getByText(DELIVERABLE_CATALOG[0]?.checklist[0] ?? '')).toBeTruthy()
    // Under the title: what it is, who reads it, how many rounds. The times are in the register.
    expect(
      screen.getByText(
        new RegExp(`${messages.deliverableFor.client} · ${messages.deliverableRounds(1)}`),
      ),
    ).toBeTruthy()
    expect(screen.queryByText(/Scrittura 2 min/)).toBeNull()
    // What the code computed and what Claude judged are told apart beside the draft.
    const computed = screen.getByRole('region', { name: messages.review.computed })
    expect(within(computed).getByText('Chi firma il verbale')).toBeTruthy()
    expect(
      within(computed).getByRole('region', { name: messages.deliverableClientFilter }),
    ).toBeTruthy()
    const judged = screen.getByRole('region', { name: messages.review.judged })
    expect(within(judged).getByRole('button', { name: messages.deliverableApprove })).toBeTruthy()
  })

  it('shows the draft as soon as it is written, while its critical reading goes on', async () => {
    let finish: (result: Result<Deliverable>) => void = () => {}
    const { api, progress, drafted } = fakeApi({
      startDeliverable: vi.fn(
        () => new Promise<Result<Deliverable>>((resolve) => (finish = resolve)),
      ),
    })
    render(<DeliverablesView api={api} project={project} />)
    fireEvent.click(await screen.findByRole('button', { name: /Email al cliente/ }))
    type('A chi scrivi', 'Carla Bianchi')
    type(/^Di che cosa/, 'Collaudo')
    type(/^Che cosa chiedi/, 'Conferma la data')
    fireEvent.click(screen.getByRole('button', { name: messages.deliverableWrite }))
    act(() => progress('p-1', { kind: 'checking', target: '' }))
    expect(screen.getByText(progressText({ kind: 'checking', target: '' }))).toBeTruthy()

    act(() => drafted('altro', { ...review, id: 'd-9', status: 'writing', redTeam: null }))
    expect(screen.queryByText(messages.review.pending)).toBeNull()
    act(() => drafted('p-1', { ...review, status: 'writing', redTeam: null }))
    // The text can be read; what the review will find is still to come, and nothing is approved.
    expect(screen.getByText(messages.review.pending)).toBeTruthy()
    expect(screen.queryByRole('button', { name: messages.deliverableApprove })).toBeNull()
    expect(screen.queryByText('Il budget non ha una fonte')).toBeNull()

    await act(async () => finish(ok(review)))
    expect(screen.queryByText(messages.review.pending)).toBeNull()
    expect(screen.getByText('Il budget non ha una fonte')).toBeTruthy()
  })

  it('asks a change in words and approves, then offers the files', async () => {
    const { api } = fakeApi({ listDeliverables: vi.fn(async () => ok([review])) })
    render(<DeliverablesView api={api} project={project} />)
    fireEvent.click(await screen.findByRole('button', { name: /Collaudo/ }))

    const change = screen.getByRole<HTMLButtonElement>('button', {
      name: messages.deliverableChangeSubmit,
    })
    // The general change is proposed from what the reading found: sent as it is, or written over.
    const field = screen.getByLabelText<HTMLTextAreaElement>(messages.deliverableChange)
    expect(field.value).toBe(messages.review.proposed(['Il budget non ha una fonte']))
    expect(change.disabled).toBe(false)
    type(messages.deliverableChange, ' ')
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
    expect(api.openEvidence).toHaveBeenCalledWith('p-1', approved.files[1], undefined)
    // A source of the draft is shown beside it; the original is one click further.
    const panel = screen.getByRole('complementary', { name: messages.citation.panel })
    expect(within(panel).getByText('posta/a.md')).toBeTruthy()
    fireEvent.click(within(panel).getByRole('button', { name: messages.citation.open }))
    // The sentence quoted goes with the file: where it is read, it is opened on it.
    await waitFor(() =>
      expect(api.openEvidence).toHaveBeenCalledWith('p-1', 'posta/a.md', expect.any(String)),
    )
  })

  it('writes again the passage of one finding only, with what the PM says of it', async () => {
    const { api } = fakeApi({ listDeliverables: vi.fn(async () => ok([review])) })
    render(<DeliverablesView api={api} project={project} />)
    fireEvent.click(await screen.findByRole('button', { name: /Collaudo/ }))
    const finding = review.redTeam?.findings[0]
    fireEvent.click(screen.getByRole('button', { name: messages.review.fix }))
    // Changing one's mind closes the field and asks nothing.
    fireEvent.click(screen.getByRole('button', { name: messages.cancel }))
    expect(api.reviseDeliverable).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: messages.review.fix }))
    type(messages.review.fixWhat, ' Cita il verbale del 10 novembre ')
    fireEvent.click(screen.getByRole('button', { name: messages.review.fixSubmit }))
    await waitFor(() =>
      expect(api.reviseDeliverable).toHaveBeenCalledWith(
        'p-1',
        'd-1',
        messages.review.fixRequest(
          finding?.where ?? '',
          finding?.finding ?? '',
          'Cita il verbale del 10 novembre',
        ),
      ),
    )
    // The request names the passage and tells to leave the rest as it is.
    const asked = vi.mocked(api.reviseDeliverable).mock.calls[0]?.[2] ?? ''
    expect(asked).toContain(`«${finding?.where}»`)
    expect(asked).toContain('Lascia tutto il resto')
    // With nothing typed, how to correct is left to Claude.
    expect(messages.review.fixRequest('a', 'b', '')).not.toContain('Che cosa cambiare')
    expect(messages.review.proposed([])).toBe('')
  })

  it('says in the past what the reading asked to correct, once the PM approved', async () => {
    const approvedAnyway: Deliverable = { ...approved, redTeam: review.redTeam }
    const { api } = fakeApi({ listDeliverables: vi.fn(async () => ok([approvedAnyway])) })
    render(<DeliverablesView api={api} project={project} />)
    fireEvent.click(await screen.findByRole('button', { name: /Collaudo/ }))
    expect(await screen.findByText(messages.deliverableRedTeamFixApproved)).toBeTruthy()
    expect(screen.queryByText(messages.deliverableRedTeamFix)).toBeNull()
    // The findings stay to read and the files stay at hand.
    expect(screen.getByText('Il budget non ha una fonte')).toBeTruthy()
    expect(screen.getByText(messages.deliverableFiles)).toBeTruthy()
    expect(
      screen.getByRole('button', { name: '2026-11-14_email-cliente_collaudo.docx' }),
    ).toBeTruthy()
  })

  it('folds a long list of sources, which still answer to their markers', async () => {
    const [source] = review.draft?.citations ?? []
    if (!source || !review.draft) throw new Error('the draft of the fixture has a source')
    const many = Array.from({ length: SOURCES_SHOWN + 1 }, (_, at) => ({
      ...source,
      // Numbers that skip one: the list keeps those of the text.
      n: at * 2 + 1,
      path: `posta/${at}.md`,
    }))
    const long: Deliverable = {
      ...review,
      draft: { ...review.draft, text: 'Il collaudo è il 17 dicembre [3].', citations: many },
    }
    const { api } = fakeApi({ listDeliverables: vi.fn(async () => ok([long])) })
    render(<DeliverablesView api={api} project={project} />)
    fireEvent.click(await screen.findByRole('button', { name: /Collaudo/ }))
    const summary = await screen.findByText(`${messages.sources} · ${many.length}`)
    const fold = summary.closest('details') as HTMLDetailsElement
    expect(fold.open).toBe(false)
    expect(
      within(fold)
        .getAllByRole('listitem')
        .map((item) => (item as HTMLLIElement).value),
    ).toEqual(many.map((citation) => citation.n))
    // A marker of the text shows its source beside it with the list still closed.
    const panel = screen.getByRole('complementary', { name: messages.citation.panel })
    fireEvent.click(screen.getByRole('button', { name: messages.citation.marker(3) }))
    expect(within(panel).getByText('posta/1.md')).toBeTruthy()
    expect(fold.open).toBe(false)
    // A short list is read as it is.
    cleanup()
    const short = fakeApi({ listDeliverables: vi.fn(async () => ok([review])) })
    render(<DeliverablesView api={short.api} project={project} />)
    fireEvent.click(await screen.findByRole('button', { name: /Collaudo/ }))
    const heading = await screen.findByRole('heading', { name: `${messages.sources} · 2` })
    expect(heading.closest('details')).toBeNull()
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

  it('keeps no model file among the kinds: a template belongs to its kind', async () => {
    const { api } = fakeApi()
    render(<DeliverablesView api={api} project={project} />)
    await screen.findByRole('button', { name: messages.ownKindNew })
    expect(screen.queryByText(messages.letterheadTitle)).toBeNull()
    expect(screen.queryByText(messages.deckModelTitle)).toBeNull()
  })

  it('lets the PM give a kind its template, see which it has, and take it away', async () => {
    const templates = vi
      .fn<OctoApi['kindTemplates']>()
      .mockResolvedValueOnce(ok({}))
      .mockResolvedValueOnce(ok({ 'email-cliente': ['docx'], 'voce-di-backlog': ['pptx'] }))
      .mockResolvedValue(ok({}))
    const { api } = fakeApi({ kindTemplates: templates })
    render(<DeliverablesView api={api} project={project} />)
    fireEvent.click(await screen.findByRole('button', { name: /Email al cliente/ }))

    const section = await screen.findByRole('region', { name: words.title })
    expect(within(section).getByText(words.none)).toBeTruthy()
    fireEvent.click(within(section).getByRole('button', { name: words.choose }))
    await waitFor(() => expect(api.chooseKindTemplate).toHaveBeenCalledWith('p-1', 'email-cliente'))
    // Only the template of this kind is shown, with what it does.
    expect(await within(section).findByText(words.format.docx)).toBeTruthy()
    expect(within(section).getByText(words.does.docx)).toBeTruthy()
    expect(within(section).queryByText(words.format.pptx)).toBeNull()

    fireEvent.click(
      within(section).getByRole('button', { name: words.removeFormat(words.format.docx) }),
    )
    await waitFor(() =>
      expect(api.removeKindTemplate).toHaveBeenCalledWith('p-1', 'email-cliente', 'docx'),
    )
    expect(await within(section).findByText(words.none)).toBeTruthy()
  })

  it('explains a file that cannot be the template of a kind', async () => {
    const { api } = fakeApi({
      chooseKindTemplate: vi.fn(
        async () => ({ ok: false, code: 'deck_model_invalid' }) as Result<TemplateFormat | null>,
      ),
    })
    render(<DeliverablesView api={api} project={project} />)
    fireEvent.click(await screen.findByRole('button', { name: /Email al cliente/ }))
    fireEvent.click(await screen.findByRole('button', { name: words.choose }))
    expect(await screen.findByText(/non è una presentazione che posso usare/)).toBeTruthy()
  })

  it('saves a kind of the PM and asks for its template right after', async () => {
    const { api } = fakeApi()
    render(<DeliverablesView api={api} project={project} />)
    fireEvent.click(await screen.findByRole('button', { name: messages.ownKindNew }))
    expect(screen.getByText(words.newKindHint)).toBeTruthy()
    type(messages.ownKindTitle, 'Nota di rilascio')
    type(/^Come va scritto/, 'Scrivi le novità.')
    fireEvent.click(screen.getByRole('button', { name: words.saveAndChoose }))
    await waitFor(() =>
      expect(api.chooseKindTemplate).toHaveBeenCalledWith('p-1', 'proprio-nota-di-rilascio'),
    )
    expect(api.saveDeliverableKind).toHaveBeenCalledTimes(1)
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
    // The name of the field is short: how to write the questions is told under it, and read with it.
    const questions = screen.getByLabelText(messages.ownKindQuestions)
    const told = document.getElementById(questions.getAttribute('aria-describedby') ?? '')
    expect(told?.textContent).toBe(messages.ownKindQuestionsHint)
    type(messages.ownKindQuestions, 'Quale versione *\nChe cosa evidenziare')
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
    // A kind of the PM is in the group of who reads it, marked as theirs, with short commands.
    const group = await screen.findByRole('list', { name: messages.deliverableFor.client })
    expect(within(group).getByText(messages.ownKindBadge)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Modifica Nota di rilascio' }).textContent).toBe(
      messages.ownKindEdit,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Modifica Nota di rilascio' }))
    expect(screen.getByLabelText<HTMLInputElement>(messages.ownKindTitle).value).toBe(
      'Nota di rilascio',
    )
    // A kind that exists shows its template where it is changed.
    expect(await screen.findByRole('region', { name: words.title })).toBeTruthy()
    expect(screen.getByLabelText<HTMLTextAreaElement>(messages.ownKindQuestions).value).toBe(
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
    // The totals are a row of the table, under the columns they add up.
    const total = screen.getByRole('rowheader', { name: messages.deliverableRegisterApproved(1) })
    expect(total.closest('tr')?.textContent).toBe(`${messages.deliverableRegisterApproved(1)}281`)
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

  it('corrects in words how a kind of Octo is written: proposed, read, then kept', async () => {
    const text = messages.kindCorrection
    const { api } = fakeApi()
    render(<DeliverablesView api={api} project={project} />)
    fireEvent.click(await screen.findByRole('button', { name: /Verbale di riunione/ }))

    const ask = await screen.findByRole<HTMLButtonElement>('button', { name: text.ask })
    expect(ask.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText(text.words), { target: { value: 'Più breve' } })
    fireEvent.click(ask)

    const proposal = await screen.findByRole('region', { name: text.proposed })
    expect(proposal.textContent).toContain('Più breve.')
    expect(proposal.textContent).toContain('Scrivi breve.')
    expect(api.correctKind).toHaveBeenCalledWith('p-1', 'verbale', 'Più breve')
    fireEvent.click(screen.getByRole('button', { name: text.approve }))

    expect(await screen.findByText(text.approved)).toBeTruthy()
    expect(api.approveKindCorrection).toHaveBeenCalledWith('p-1', 'verbale', 'c-1')
    // The catalog is read again: the kind is now the corrected one.
    await waitFor(() => expect(api.deliverableCatalog).toHaveBeenCalledTimes(2))
  })

  it('discards a proposal, says what went wrong, and goes back to the kind of Octo', async () => {
    const text = messages.kindCorrection
    const corrected = DELIVERABLE_CATALOG.map((kind) =>
      kind.id === 'verbale' ? { ...kind, corrected: true as const } : kind,
    )
    const { api } = fakeApi({ deliverableCatalog: vi.fn(async () => ok(corrected)) })
    render(<DeliverablesView api={api} project={project} />)
    fireEvent.click(await screen.findByRole('button', { name: /Verbale di riunione/ }))

    fireEvent.change(await screen.findByLabelText(text.words), { target: { value: 'Più breve' } })
    fireEvent.click(screen.getByRole('button', { name: text.ask }))
    await screen.findByRole('region', { name: text.proposed })
    fireEvent.click(screen.getByRole('button', { name: text.discard }))
    expect(screen.queryByRole('region', { name: text.proposed })).toBeNull()

    vi.mocked(api.correctKind).mockResolvedValueOnce({ ok: false, code: 'agent_failed' })
    fireEvent.click(screen.getByRole('button', { name: text.ask }))
    expect(await screen.findByText(errorText('agent_failed'))).toBeTruthy()

    expect(screen.getByText(text.corrected, { exact: false })).toBeTruthy()
    vi.mocked(api.restoreKind).mockResolvedValueOnce({ ok: false, code: 'agent_cancelled' })
    fireEvent.click(screen.getByRole('button', { name: text.restore }))
    expect(await screen.findByText(errorText('agent_cancelled'))).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: text.restore }))
    expect(await screen.findByText(text.restored)).toBeTruthy()
    expect(api.restoreKind).toHaveBeenCalledWith('p-1', 'verbale')
  })

  it('offers the meetings imported from Verbale for the minutes, or any other told in words', async () => {
    const folder = '_octo/riunioni/2026-11-10_kickoff-aurora_ab12cd34'
    const kickoff: StoredMeeting = {
      id: 'ab12cd34-0000-4000-8000-000000000001',
      title: 'Kickoff Aurora',
      started: '2026-11-10T09:00:00.000Z',
      minutes: 45,
      participants: ['Anna'],
      folder,
    }
    const { api } = fakeApi({ importedMeetings: vi.fn(async () => ok([kickoff])) })
    render(<DeliverablesView api={api} project={project} />)
    fireEvent.click(await screen.findByRole('button', { name: /Verbale di riunione/ }))

    const list = await screen.findByLabelText<HTMLSelectElement>(messages.meetingField.imported)
    expect(list.options[1]?.textContent).toContain('Kickoff Aurora')
    // Another meeting is told in words, in the field under the list.
    const words = screen.getByRole<HTMLInputElement>('textbox', { name: /Quale riunione/ })
    fireEvent.change(words, { target: { value: 'Standup del 13/11' } })
    expect(words.value).toBe('Standup del 13/11')
    fireEvent.change(list, { target: { value: folder } })
    // Once a meeting is chosen the list is the field: there is nothing left to type.
    expect(screen.getByRole<HTMLSelectElement>('combobox').value).toBe(folder)
    expect(screen.queryByRole('textbox', { name: /Quale riunione/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: messages.deliverableWrite }))

    await waitFor(() =>
      expect(api.startDeliverable).toHaveBeenCalledWith('p-1', 'verbale', { riunione: folder }),
    )
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
    expect(screen.getByText(new RegExp(messages.deliverableFor.client))).toBeTruthy()
    expect(within(panel()).getByText(messages.review.left(1))).toBeTruthy()

    fireEvent.click(within(panel()).getByRole('button', { name: messages.review.seen }))
    expect(within(panel()).getByText(messages.review.left(0))).toBeTruthy()
    fireEvent.click(within(panel()).getByRole('button', { name: /Visto/ }))
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

describe('a file the deliverables of the project are written on', () => {
  const has = () =>
    vi
      .fn<() => Promise<Result<boolean>>>()
      .mockResolvedValueOnce(ok(false))
      .mockResolvedValueOnce(ok(true))
      .mockResolvedValue(ok(false))

  it('is chosen and taken away, and a file that cannot be used is explained', async () => {
    const choose = vi.fn(async () => ok(true))
    const remove = vi.fn(async () => ok(null))
    render(<ModelFile text={LETTERHEAD_TEXT} has={has()} choose={choose} remove={remove} />)
    expect(await screen.findByText(messages.letterheadNone)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: messages.letterheadChoose }))
    expect(await screen.findByText(messages.letterheadSet)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: messages.letterheadRemove }))
    expect(await screen.findByText(messages.letterheadNone)).toBeTruthy()
    expect(choose).toHaveBeenCalledTimes(1)
    expect(remove).toHaveBeenCalledTimes(1)
    cleanup()

    const refused = vi.fn(
      async () => ({ ok: false, code: 'letterhead_invalid' }) as Result<boolean>,
    )
    render(
      <ModelFile
        text={LETTERHEAD_TEXT}
        has={async () => ok(false)}
        choose={refused}
        remove={remove}
      />,
    )
    fireEvent.click(await screen.findByRole('button', { name: messages.letterheadChoose }))
    expect(await screen.findByText(/non è un documento Word che posso usare/)).toBeTruthy()
  })

  it('shows a file of before only while it is there, to be taken away and not chosen', async () => {
    const remove = vi.fn(async () => ok(null))
    const present = vi
      .fn<() => Promise<Result<boolean>>>()
      .mockResolvedValueOnce(ok(true))
      .mockResolvedValue(ok(false))
    render(
      <ModelFile
        onlyWhenSet
        text={DECK_MODEL_TEXT}
        has={present}
        choose={async () => ok(true)}
        remove={remove}
      />,
    )
    expect(await screen.findByText(messages.deckModelSet)).toBeTruthy()
    expect(screen.queryByRole('button', { name: messages.deckModelChoose })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: messages.letterheadRemove }))
    await waitFor(() => expect(screen.queryByText(messages.deckModelTitle)).toBeNull())
    expect(remove).toHaveBeenCalledTimes(1)
  })
})
