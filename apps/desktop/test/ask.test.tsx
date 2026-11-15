// @vitest-environment jsdom
import type { CheckedAnswer, Project, QuestionRecord } from '@octo/domain'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AnswerView } from '../src/renderer/AnswerView.tsx'
import { AskView } from '../src/renderer/AskView.tsx'
import { provenanceOf, sourceTitle } from '../src/renderer/answer-text.ts'
import { messages } from '../src/renderer/messages.ts'
import type { OctoApi, Result } from '../src/shared/api.ts'

const aurora: Project = { id: 'p-1', name: 'Aurora', folder: '/progetti/Aurora', addedAt: '' }
const boreale: Project = { ...aurora, id: 'p-2', name: 'Boreale' }
const ok = <T,>(value: T): Result<T> => ({ ok: true, value })
const text = messages.citation

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

type AskApi = Pick<OctoApi, 'listQuestions' | 'ask' | 'cancelAsk' | 'openEvidence' | 'onProgress'>

const askApi = (overrides: Partial<AskApi> = {}): AskApi => ({
  listQuestions: vi.fn(async (projectId: string) => ok(projectId === 'p-1' ? [record] : [])),
  ask: vi.fn(async () => ok(record)),
  cancelAsk: vi.fn(async () => ok(null)),
  openEvidence: vi.fn(async () => ok(null)),
  onProgress: () => () => {},
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

    fireEvent.click(await screen.findByRole('button', { name: messages.askDraft }))
    expect(drafts).toEqual([{ question: record.question, answer }])
  })

  it('says it is asking on the button, can be stopped, and drops what comes back for another project', async () => {
    let finish: (result: Result<QuestionRecord>) => void = () => {}
    const api = askApi({
      listQuestions: vi.fn(async () => ok([])),
      ask: vi.fn(() => new Promise<Result<QuestionRecord>>((resolve) => (finish = resolve))),
    })
    const { rerender } = render(<AskView api={api} project={aurora} />)
    fireEvent.change(screen.getByLabelText(messages.askPlaceholder), {
      target: { value: 'Quando consegniamo?' },
    })
    const submit = screen.getByRole('button', { name: messages.askSubmit })
    fireEvent.click(submit)
    await waitFor(() => expect(submit.getAttribute('aria-busy')).toBe('true'))
    expect(submit.textContent).toContain(messages.wait.asking)
    fireEvent.click(submit)
    expect(api.ask).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: messages.askCancel }))
    expect(api.cancelAsk).toHaveBeenCalledWith('p-1')

    rerender(<AskView api={api} project={boreale} />)
    await act(async () => finish(ok(record)))
    expect(screen.queryByText(record.question)).toBeNull()
    expect(screen.getByText(messages.askEmpty)).toBeTruthy()
  })
})
