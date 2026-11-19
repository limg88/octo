// @vitest-environment jsdom
import type { ChatAttachment, CheckedAnswer, Project, QuestionRecord } from '@octo/domain'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AnswerView } from '../src/renderer/AnswerView.tsx'
import { AskView } from '../src/renderer/AskView.tsx'
import { provenanceOf, sourceTitle } from '../src/renderer/answer-text.ts'
import { errorText, messages } from '../src/renderer/messages.ts'
import type { OctoApi, Result } from '../src/shared/api.ts'

const aurora: Project = { id: 'p-1', name: 'Aurora', folder: '/progetti/Aurora', addedAt: '' }
const boreale: Project = { ...aurora, id: 'p-2', name: 'Boreale' }
const ok = <T,>(value: T): Result<T> => ({ ok: true, value })
const text = messages.citation
const chats = messages.askChats

const answer: CheckedAnswer = {
  text: 'Il collaudo è mercoledì [1]. Serve un dataset [2]. Lo slot è confermato [3]. Forse [9].',
  citations: [
    {
      n: 1,
      path: '_octo/posta/2026-11/finestra-di-collaudo.md',
      quote: 'lo slot disponibile è mercoledì alle 10',
      status: 'verified',
      modifiedAt: '2026-11-14T09:00:00.000Z',
    },
    {
      n: 2,
      path: '_octo/fonti/ADO/1842.md',
      quote: 'serve un dataset di prova',
      status: 'quote_not_found',
      modifiedAt: null,
    },
    {
      n: 3,
      path: '_octo/posta/2026-11/finestra-di-collaudo.md',
      quote: 'ci confermate entro lunedì',
      status: 'verified',
      modifiedAt: '2026-11-14T09:00:00.000Z',
    },
    { n: 4, path: 'Verbali/perso.md', quote: 'x', status: 'file_not_found', modifiedAt: null },
  ],
  missing: ['Disponibilità del dataset'],
  markersWithoutCitation: [9],
}

const record: QuestionRecord = {
  id: 'q-1',
  projectId: 'p-1',
  question: 'Possiamo confermare il collaudo?',
  askedAt: '2026-11-16T09:12:00.000Z',
  durationMs: 1000,
  answer,
  error: null,
}

type AskApi = Pick<
  OctoApi,
  | 'listQuestions'
  | 'ask'
  | 'keepWork'
  | 'cancelAsk'
  | 'openEvidence'
  | 'onProgress'
  | 'attachToChat'
  | 'chatFiles'
>

const askApi = (overrides: Partial<AskApi> = {}): AskApi => ({
  listQuestions: vi.fn(async (projectId: string) => ok(projectId === 'p-1' ? [record] : [])),
  ask: vi.fn(async () => ok(record)),
  keepWork: vi.fn(async () => ok(record)),
  cancelAsk: vi.fn(async () => ok(null)),
  openEvidence: vi.fn(async () => ok(null)),
  onProgress: () => () => {},
  attachToChat: vi.fn(async () => ok<ChatAttachment | null>(null)),
  chatFiles: vi.fn(async () => ok<ChatAttachment[]>([])),
  ...overrides,
})

const panel = () => screen.getByRole('complementary', { name: text.panel })
const marker = (n: number) => screen.getByRole('button', { name: text.marker(n) })

afterEach(cleanup)

describe('a source beside the answer that cites it', () => {
  it('shows what the file is, where it comes from, the sentence and what the check found', () => {
    render(<AnswerView answer={answer} onOpenSource={async () => ok(null)} />)
    // The first source is in view; the answer and what is missing stay where they are.
    expect(panel().textContent).toContain(messages.detail.position(1, 4))
    expect(panel().textContent).toContain(text.provenance.mail)
    expect(panel().textContent).toContain('finestra-di-collaudo')
    expect(panel().textContent).toContain('«lo slot disponibile è mercoledì alle 10»')
    expect(within(panel()).getByText(text.foundNote)).toBeTruthy()
    // The same file cited twice is said so.
    expect(within(panel()).getByText(text.sameFile('[3]'))).toBeTruthy()
    expect(marker(1).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByText(messages.missingTitle)).toBeTruthy()
    expect(screen.getByText(messages.missingCount(1))).toBeTruthy()
    expect(screen.getByText(text.orphan(9))).toBeTruthy()

    fireEvent.click(marker(2))
    expect(marker(1).getAttribute('aria-pressed')).toBe('false')
    expect(panel().textContent).toContain('ADO')
    expect(panel().textContent).toContain(text.undated)
    expect(within(panel()).getByText(text.notFoundNote)).toBeTruthy()
    expect(within(panel()).getByText('_octo/fonti/ADO/1842.md')).toBeTruthy()

    // The sources are walked one after the other, round the list.
    fireEvent.click(within(panel()).getByRole('button', { name: text.previous }))
    expect(panel().textContent).toContain(messages.detail.position(1, 4))
    fireEvent.click(within(panel()).getByRole('button', { name: text.previous }))
    expect(panel().textContent).toContain(messages.detail.position(4, 4))
    // A file that is not there cannot be handed to the system.
    const open = within(panel()).getByRole<HTMLButtonElement>('button', { name: text.open })
    expect(open.disabled).toBe(true)
    fireEvent.click(within(panel()).getByRole('button', { name: text.next }))
    expect(panel().textContent).toContain(messages.detail.position(1, 4))
  })

  it('says so when the answer cites nothing', () => {
    const bare: CheckedAnswer = {
      text: 'Non lo so.',
      citations: [],
      missing: [],
      markersWithoutCitation: [],
    }
    render(<AnswerView answer={bare} onOpenSource={async () => ok(null)} />)
    expect(within(panel()).getByText(text.noSources)).toBeTruthy()
    expect(screen.getByText(messages.noSources)).toBeTruthy()
  })

  it('tells of the source asked last: an older opening that ends later says nothing', async () => {
    const endings: Array<(result: Result<null>) => void> = []
    const open = vi.fn(() => new Promise<Result<null>>((resolve) => endings.push(resolve)))
    render(<AnswerView answer={answer} onOpenSource={open} />)
    const button = () => within(panel()).getByRole('button', { name: new RegExp(text.open) })
    fireEvent.click(button())
    expect(button().getAttribute('aria-busy')).toBe('true')
    expect(within(panel()).getByText(text.opening)).toBeTruthy()

    fireEvent.click(marker(3))
    expect(button().getAttribute('aria-busy')).toBeNull()
    await act(async () => endings[0]?.({ ok: false, code: 'unexpected' }))
    expect(within(panel()).queryByRole('alert')).toBeNull()

    // The one in view fails: it says so there, and can be tried again.
    fireEvent.click(button())
    await act(async () => endings[1]?.({ ok: false, code: 'unexpected' }))
    expect(within(panel()).getByRole('alert').textContent).toContain(text.openFailed)
    fireEvent.click(within(panel()).getByRole('button', { name: messages.wait.retry }))
    await act(async () => endings[2]?.(ok(null)))
    expect(within(panel()).queryByRole('alert')).toBeNull()
    expect(open).toHaveBeenCalledTimes(3)
  })

  it('reads where a file comes from in its path, and names it as a person would', () => {
    expect(provenanceOf('_octo/posta/2026-11/a.md')).toEqual({ kind: 'mail' })
    expect(provenanceOf('_octo/cruscotto/azure-devops.json')).toEqual({ kind: 'tracker' })
    expect(provenanceOf('_octo\\fonti\\Jira\\AB-1.md')).toEqual({ kind: 'feed', name: 'Jira' })
    expect(provenanceOf('_octo/testo/SOW/offerta.md')).toEqual({ kind: 'text' })
    expect(provenanceOf('Meetings/Riepilogo.md')).toEqual({ kind: 'file' })
    expect(sourceTitle('Meetings/2026-11-13 - Allineamento/Riepilogo.md')).toBe(
      '2026-11-13 - Allineamento · Riepilogo',
    )
    expect(sourceTitle('Documenti/Offerta economica Aurora.docx')).toBe('Offerta economica Aurora')
    expect(sourceTitle('a.md')).toBe('a')
  })
})

describe('the conversation with a project', () => {
  it('takes a question written elsewhere without asking it, and hands an answer on', async () => {
    const api = askApi()
    const used = vi.fn()
    const drafts: unknown[] = []
    render(
      <AskView
        api={api}
        project={aurora}
        seed="Bug 1842: che cosa lo blocca?"
        onSeedUsed={used}
        onDraft={(handoff) => drafts.push(handoff)}
      />,
    )
    const field = await screen.findByLabelText<HTMLTextAreaElement>(messages.askPlaceholder)
    expect(field.value).toBe('Bug 1842: che cosa lo blocca?')
    expect(used).toHaveBeenCalled()
    expect(api.ask).not.toHaveBeenCalled()

    // The page opens on a new conversation; what was asked before is one click away.
    expect(screen.getByText(chats.freshHint)).toBeTruthy()
    fireEvent.click(await screen.findByRole('button', { name: new RegExp(chats.legacy) }))
    fireEvent.click(await screen.findByRole('button', { name: messages.askDraft }))
    expect(drafts).toEqual([{ question: record.question, answer }])
  })

  it('says it is asking beside the button, can be stopped, and drops what comes back for another project', async () => {
    let finish: (result: Result<QuestionRecord>) => void = () => {}
    const api = askApi({
      listQuestions: vi.fn(async () => ok([])),
      ask: vi.fn(() => new Promise<Result<QuestionRecord>>((resolve) => (finish = resolve))),
    })
    const { rerender } = render(<AskView api={api} project={aurora} />)
    fireEvent.change(screen.getByLabelText(messages.askPlaceholder), {
      target: { value: 'Quando consegniamo?' },
    })
    fireEvent.click(screen.getByRole('button', { name: messages.askSubmit }))
    // While it asks the round button stops, and nothing else can be asked.
    await waitFor(() => expect(screen.getByText(messages.wait.asking)).toBeTruthy())
    expect(screen.queryByRole('button', { name: messages.askSubmit })).toBeNull()
    fireEvent.keyDown(screen.getByLabelText(messages.askPlaceholder), { key: 'Enter' })
    expect(api.ask).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: messages.askCancel }))
    expect(api.cancelAsk).toHaveBeenCalledWith('p-1')

    rerender(<AskView api={api} project={boreale} />)
    await act(async () => finish(ok(record)))
    expect(screen.queryByText(record.question)).toBeNull()
    expect(screen.getByText(chats.freshHint)).toBeTruthy()
  })

  const asked = (id: string, question: string, conversationId: string, at: string) => ({
    ...record,
    id,
    question,
    conversationId,
    askedAt: at,
  })

  it('opens on a new conversation, takes an old one up again and asks inside it', async () => {
    const old = asked('q-2', 'Chi è il referente del cliente?', 'c-1', '2026-11-15T10:00:00.000Z')
    const api = askApi({
      listQuestions: vi.fn(async () => ok([record, old])),
      ask: vi.fn(async (_project: string, question: string, conversationId: string | null) =>
        ok(asked('q-9', question, conversationId ?? 'c-nuova', '2026-11-16T12:00:00.000Z')),
      ),
    })
    render(<AskView api={api} project={aurora} />)
    const list = await screen.findByRole('navigation', { name: chats.title })
    const fresh = within(list).getByRole('button', { name: chats.fresh })
    expect(fresh.getAttribute('aria-current')).toBe('page')
    expect(screen.queryByText(old.question, { selector: '.question' })).toBeNull()

    // The conversation asked in last comes first; the questions of before are one conversation.
    const names = within(list)
      .getAllByRole('button')
      .map((button) => button.textContent ?? '')
    expect(names[1]).toContain(chats.legacy)
    expect(names[2]).toContain(old.question)

    fireEvent.click(within(list).getByRole('button', { name: new RegExp(old.question) }))
    expect(screen.getByText(old.question, { selector: '.question' })).toBeTruthy()
    fireEvent.change(screen.getByLabelText(messages.askPlaceholder), {
      target: { value: 'E il suo sostituto?' },
    })
    fireEvent.click(screen.getByRole('button', { name: messages.askSubmit }))
    await waitFor(() =>
      expect(api.ask).toHaveBeenCalledWith('p-1', 'E il suo sostituto?', 'c-1', false),
    )
    expect(await screen.findByText('E il suo sostituto?', { selector: '.question' })).toBeTruthy()
    expect(screen.getByText(old.question, { selector: '.question' })).toBeTruthy()

    // A new conversation starts with no id, and the page stays on it once it has one.
    fireEvent.click(fresh)
    expect(screen.getByText(chats.freshHint)).toBeTruthy()
    fireEvent.change(screen.getByLabelText(messages.askPlaceholder), {
      target: { value: 'Quando è il collaudo?' },
    })
    fireEvent.click(screen.getByRole('button', { name: messages.askSubmit }))
    await waitFor(() =>
      expect(api.ask).toHaveBeenCalledWith('p-1', 'Quando è il collaudo?', null, false),
    )
    expect(await screen.findByText('Quando è il collaudo?', { selector: '.question' })).toBeTruthy()
    expect(fresh.getAttribute('aria-current')).toBeNull()
    expect(screen.queryByText(old.question, { selector: '.question' })).toBeNull()
  })

  it('finds a conversation among many, and keeps an answer for the one it was asked in', async () => {
    const many = Array.from({ length: 7 }, (_unused, at) =>
      asked(`q-${at}`, `Domanda sul rilascio ${at}`, `c-${at}`, `2026-11-0${at + 1}T10:00:00.000Z`),
    )
    let finish: (result: Result<QuestionRecord>) => void = () => {}
    const api = askApi({
      listQuestions: vi.fn(async () => ok(many)),
      ask: vi.fn(() => new Promise<Result<QuestionRecord>>((resolve) => (finish = resolve))),
    })
    render(<AskView api={api} project={aurora} />)
    const list = await screen.findByRole('navigation', { name: chats.title })
    const filter = await within(list).findByRole('searchbox', { name: chats.filter })
    fireEvent.change(filter, { target: { value: 'rilascio 3' } })
    expect(within(list).getAllByRole('button')).toHaveLength(2)
    fireEvent.change(filter, { target: { value: 'niente' } })
    expect(within(list).getByText(chats.nothingFound)).toBeTruthy()
    fireEvent.change(filter, { target: { value: '' } })

    // Asked in one conversation, read in another: the answer waits in its own.
    fireEvent.click(within(list).getByRole('button', { name: /rilascio 3/ }))
    fireEvent.change(screen.getByLabelText(messages.askPlaceholder), {
      target: { value: 'E poi?' },
    })
    fireEvent.click(screen.getByRole('button', { name: messages.askSubmit }))
    expect(await screen.findByText('E poi?', { selector: '.question' })).toBeTruthy()
    fireEvent.click(within(list).getByRole('button', { name: /rilascio 5/ }))
    expect(screen.queryByText('E poi?', { selector: '.question' })).toBeNull()
    await act(async () => finish(ok(asked('q-99', 'E poi?', 'c-3', '2026-11-16T12:00:00.000Z'))))
    expect(screen.queryByText('E poi?', { selector: '.question' })).toBeNull()
    fireEvent.click(within(list).getByRole('button', { name: /rilascio 3/ }))
    expect(screen.getByText('E poi?', { selector: '.question' })).toBeTruthy()
  })

  it('attaches a file to the conversation, which is then asked in, and explains a refusal', async () => {
    const brief = { name: 'capitolato.docx', path: '_octo/.lavori/chiedi/c-9/capitolato.docx.md' }
    const attachToChat = vi
      .fn<OctoApi['attachToChat']>()
      .mockResolvedValueOnce(ok(null))
      .mockResolvedValueOnce({ ok: false, code: 'attachment_unsupported' })
      .mockResolvedValue(ok(brief))
    const api = askApi({ listQuestions: vi.fn(async () => ok([])), attachToChat })
    render(<AskView api={api} project={aurora} />)
    const attach = await screen.findByRole('button', { name: messages.attach.button })
    // Nothing chosen: nothing changes. A format Octo does not read is refused with the reason.
    fireEvent.click(attach)
    await waitFor(() => expect(attachToChat).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('list', { name: messages.attach.list })).toBeNull()
    fireEvent.click(attach)
    expect(await screen.findByText(errorText('attachment_unsupported'))).toBeTruthy()
    fireEvent.click(attach)
    const list = await screen.findByRole('list', { name: messages.attach.list })
    expect(list.textContent).toBe('capitolato.docx')
    // The conversation not yet started got an id with its first file: the question goes there.
    const chat = attachToChat.mock.calls[2]?.[1] ?? ''
    expect(chat).not.toBe('')
    fireEvent.change(screen.getByPlaceholderText(messages.askPlaceholder), {
      target: { value: 'Che cosa chiede il capitolato?' },
    })
    fireEvent.click(screen.getByRole('button', { name: messages.askSubmit }))
    await waitFor(() =>
      expect(api.ask).toHaveBeenCalledWith('p-1', 'Che cosa chiede il capitolato?', chat, false),
    )
  })

  it('says so when no conversation was had yet', async () => {
    render(<AskView api={askApi({ listQuestions: vi.fn(async () => ok([])) })} project={aurora} />)
    expect(await screen.findByText(chats.none)).toBeTruthy()
  })
})

describe('a question answered with calculations', () => {
  const words = messages.computed
  const computed: QuestionRecord = {
    ...record,
    id: 'q-7',
    question: 'Quanto vale ogni regione?',
    conversationId: 'c-7',
    answer: {
      text: 'Ho sommato gli importi per regione.',
      citations: [],
      missing: [],
      markersWithoutCitation: [],
      tables: [
        {
          title: 'Totale per regione',
          columns: ['regione', 'totale'],
          rows: [
            ['Nord', '2459774.23'],
            ['Sud', '2468018.59'],
          ],
          sources: [{ path: 'dati/vendite.csv', found: true }],
          file: 'totali.csv',
          fileWritten: true,
        },
        {
          title: 'Senza appoggio',
          columns: ['x'],
          rows: [['1']],
          sources: [{ path: 'dati/assente.csv', found: false }],
          file: '',
          fileWritten: true,
        },
        {
          title: 'Senza fonte',
          columns: ['x'],
          rows: [],
          sources: [],
          file: '',
          fileWritten: true,
        },
        {
          title: 'Senza file',
          columns: ['x'],
          rows: [],
          sources: [{ path: 'dati/vendite.csv', found: true }],
          file: 'mai.csv',
          fileWritten: false,
        },
      ],
    },
    work: { files: ['calcolo.py', 'totali.csv'], keptIn: null },
  }

  /** The page opens on a new conversation: the one with the calculation is taken up from the list. */
  const openChat = async () =>
    fireEvent.click(await screen.findByRole('button', { name: /Quanto vale ogni regione/ }))

  it('is asked only when the PM says so, where Claude can be fenced', async () => {
    const api = askApi({ ask: vi.fn(async () => ok(computed)) })
    const { unmount } = render(<AskView api={api} project={aurora} />)
    await screen.findByLabelText(messages.askPlaceholder)
    // Where there is no fence the option is not offered at all.
    expect(screen.queryByLabelText(words.option)).toBeNull()
    unmount()
    render(<AskView api={api} project={aurora} canCompute />)
    const field = await screen.findByLabelText(messages.askPlaceholder)
    // What the option does and when it is worth it is a click away, beside it.
    fireEvent.click(screen.getByRole('button', { name: words.help }))
    expect(screen.getByText(words.steps[0])).toBeTruthy()
    expect(screen.getByText(words.note)).toBeTruthy()
    fireEvent.change(field, { target: { value: 'Quando consegniamo?' } })
    fireEvent.click(screen.getByRole('button', { name: messages.askSubmit }))
    await waitFor(() =>
      expect(api.ask).toHaveBeenCalledWith('p-1', 'Quando consegniamo?', null, false),
    )
    fireEvent.click(screen.getByLabelText(words.option))
    fireEvent.change(field, { target: { value: computed.question } })
    fireEvent.click(screen.getByRole('button', { name: messages.askSubmit }))
    await waitFor(() =>
      expect(api.ask).toHaveBeenLastCalledWith('p-1', computed.question, expect.anything(), true),
    )
  })

  it('shows each table with the files it was computed from, and says what cannot be traced', async () => {
    const api = askApi({ listQuestions: vi.fn(async () => ok([computed])) })
    render(<AskView api={api} project={aurora} canCompute />)
    await openChat()
    const table = await screen.findByRole('table', { name: 'Totale per regione' })
    expect(
      within(table)
        .getAllByRole('row')
        .map((row) => row.textContent),
    ).toEqual(['regionetotale', 'Nord2459774.23', 'Sud2468018.59'])
    const first = screen.getByRole('region', { name: 'Totale per regione' })
    expect(first.textContent).toContain(words.computedFrom)
    expect(first.textContent).toContain(words.inFile('totali.csv'))
    // The source opens as the source of a citation does.
    fireEvent.click(within(first).getByRole('button', { name: 'dati/vendite.csv' }))
    expect(api.openEvidence).toHaveBeenCalledWith('p-1', 'dati/vendite.csv', undefined)
    expect(within(first).queryByText(words.unverified)).toBeNull()
    const loose = screen.getByRole('region', { name: 'Senza appoggio' })
    expect(loose.textContent).toContain(words.sourceMissing('dati/assente.csv'))
    expect(within(loose).getByText(words.unverified)).toBeTruthy()
    expect(
      within(screen.getByRole('region', { name: 'Senza fonte' })).getByText(words.noSource),
    ).toBeTruthy()
    expect(
      within(screen.getByRole('region', { name: 'Senza file' })).getByText(
        words.fileMissing('mai.csv'),
      ),
    ).toBeTruthy()
  })

  it('keeps the files of the calculation in the project only when the PM says so', async () => {
    const kept = {
      ...computed,
      work: { files: computed.work?.files ?? [], keptIn: '_octo/analisi/x' },
    }
    const api = askApi({
      listQuestions: vi.fn(async () => ok([computed])),
      keepWork: vi.fn(async () => ok(kept)),
    })
    render(<AskView api={api} project={aurora} canCompute />)
    await openChat()
    expect(await screen.findByText(words.files('calcolo.py, totali.csv'))).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: words.keep }))
    expect(await screen.findByText(words.kept('_octo/analisi/x'))).toBeTruthy()
    expect(api.keepWork).toHaveBeenCalledWith('p-1', 'q-7')
    expect(screen.queryByRole('button', { name: words.keep })).toBeNull()
    cleanup()
    const refusing = askApi({
      listQuestions: vi.fn(async () => ok([computed])),
      keepWork: vi.fn(async () => ({ ok: false as const, code: 'work_not_found' as const })),
    })
    render(<AskView api={refusing} project={aurora} canCompute />)
    await openChat()
    fireEvent.click(await screen.findByRole('button', { name: words.keep }))
    expect((await screen.findByRole('alert')).textContent).toBe(errorText('work_not_found'))
  })
})
