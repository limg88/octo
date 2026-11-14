// @vitest-environment jsdom
import type { AgentProgress, AgentStatus, MailSourceView } from '@octo/application'
import type { Project, QuestionRecord } from '@octo/domain'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { App } from '../src/renderer/App.tsx'
import { linkMarkers, markerOfLink } from '../src/renderer/answer-text.ts'
import { messages, progressText } from '../src/renderer/messages.ts'
import type { OctoApi, Result } from '../src/shared/api.ts'

const aurora: Project = {
  id: 'p-1',
  name: 'Aurora',
  folder: '/progetti/Aurora',
  addedAt: '2026-11-01',
}
const boreale: Project = {
  id: 'p-2',
  name: 'Boreale',
  folder: '/progetti/Boreale',
  addedAt: '2026-11-02',
}

const answered: QuestionRecord = {
  id: 'q-1',
  projectId: 'p-1',
  question: 'Quando consegniamo?',
  askedAt: '2026-11-14T08:00:00.000Z',
  durationMs: 9000,
  answer: {
    text: 'Consegna il **12 dicembre** [1]. Budget 14.500 euro [2]. Rischio alto [3]. Vedi [sito](https://example.com).',
    citations: [
      {
        n: 1,
        path: 'wiki/stato.md',
        quote: 'fissata al 12 dicembre 2026',
        status: 'verified',
        modifiedAt: '2026-11-10T09:00:00.000Z',
      },
      {
        n: 2,
        path: 'wiki/costi.md',
        quote: 'budget 99.000',
        status: 'quote_not_found',
        modifiedAt: null,
      },
    ],
    missing: ['data di collaudo'],
    markersWithoutCitation: [3],
  },
  error: null,
}

const ok = <T,>(value: T): Result<T> => ({ ok: true, value })

const mailView: MailSourceView = {
  config: null,
  suggestedFolder: 'Posta',
  state: { cursor: null, lastRun: null },
}

function fakeApi(overrides: Partial<OctoApi> = {}) {
  let emit: (projectId: string, progress: AgentProgress) => void = () => {}
  const status: AgentStatus = { available: true, version: '2.1' }
  const api: OctoApi = {
    agentStatus: vi.fn(async () => ok(status)),
    listProjects: vi.fn(async () => ok([aurora])),
    addProject: vi.fn(async () => ok<Project | null>(boreale)),
    removeProject: vi.fn(async () => ok(null)),
    listQuestions: vi.fn(async () => ok<QuestionRecord[]>([])),
    ask: vi.fn(async () => ok(answered)),
    cancelAsk: vi.fn(async () => ok(null)),
    openEvidence: vi.fn(async () => ok(null)),
    onProgress: (listener) => {
      emit = listener
      return () => {}
    },
    mailSource: vi.fn(async () => ok(mailView)),
    saveMailSource: vi.fn(async () => ok(mailView)),
    syncMail: vi.fn(async () =>
      ok({ at: '2026-11-14T10:00:00.000Z', written: 0, unchanged: 0, error: null }),
    ),
    onSourcesChanged: () => () => {},
    ...overrides,
  }
  return { api, emit: (projectId: string, step: AgentProgress) => emit(projectId, step) }
}

async function askQuestion(text: string) {
  fireEvent.change(await screen.findByPlaceholderText(messages.askPlaceholder), {
    target: { value: text },
  })
  fireEvent.click(screen.getByRole('button', { name: messages.askSubmit }))
}

afterEach(cleanup)

describe('App', () => {
  it('shows the answer with each source checked and what is left to check', async () => {
    const { api } = fakeApi()
    render(<App api={api} />)

    await askQuestion('Quando consegniamo?')

    expect(await screen.findByText(messages.toCheck(2))).toBeTruthy()
    expect(api.ask).toHaveBeenCalledWith('p-1', 'Quando consegniamo?')
    expect(screen.getByText('Controllata')).toBeTruthy()
    expect(screen.getByText('La frase non è nel file')).toBeTruthy()
    expect(screen.getByText(messages.markerWithoutSource(3))).toBeTruthy()
    expect(screen.getByText('data di collaudo')).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'sito' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'wiki/stato.md' }))
    expect(api.openEvidence).toHaveBeenCalledWith('p-1', 'wiki/stato.md')
  })

  it('tells what the agent is doing and lets the PM stop it', async () => {
    let finish: (result: Result<QuestionRecord>) => void = () => {}
    const { api, emit } = fakeApi({
      ask: () => new Promise<Result<QuestionRecord>>((resolve) => (finish = resolve)),
    })
    render(<App api={api} />)

    await askQuestion('Quando consegniamo?')
    expect(await screen.findByText(messages.working)).toBeTruthy()

    act(() => emit('p-2', { kind: 'reading', target: 'altro.md' }))
    act(() => emit('p-1', { kind: 'reading', target: 'wiki/stato.md' }))
    expect(screen.getByRole('status').textContent).toBe('Leggo wiki/stato.md')

    fireEvent.click(screen.getByRole('button', { name: messages.askCancel }))
    expect(api.cancelAsk).toHaveBeenCalledWith('p-1')

    await act(async () => finish({ ok: false, code: 'agent_cancelled' }))
    expect(await screen.findByText('Domanda fermata.')).toBeTruthy()
  })

  it('keeps the history and explains a question that failed', async () => {
    const failed: QuestionRecord = {
      ...answered,
      id: 'q-0',
      answer: null,
      error: 'agent_not_signed_in',
    }
    const verified: QuestionRecord = {
      ...answered,
      answer: {
        text: 'Consegna il 12 dicembre [1].',
        citations: [
          {
            n: 1,
            path: 'wiki/stato.md',
            quote: 'fissata al 12 dicembre 2026',
            status: 'verified',
            modifiedAt: null,
          },
        ],
        missing: [],
        markersWithoutCitation: [],
      },
    }
    const { api } = fakeApi({ listQuestions: async () => ok([failed, verified]) })
    render(<App api={api} />)

    expect(await screen.findByText(messages.allVerified(1))).toBeTruthy()
    expect(screen.getByText(/Claude non ha un accesso attivo/)).toBeTruthy()
  })

  it('adds a project from a folder and forgets it on request', async () => {
    const { api } = fakeApi()
    render(<App api={api} />)
    await screen.findByRole('button', { name: 'Aurora' })

    fireEvent.click(screen.getByRole('button', { name: messages.addProject }))
    expect(await screen.findByRole('heading', { name: 'Boreale' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: messages.removeProject }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Boreale' })).toBeNull())
    expect(api.removeProject).toHaveBeenCalledWith('p-2')
    expect(screen.getByRole('heading', { name: 'Aurora' })).toBeTruthy()
  })

  it('guides a PM with no project and no agent, and explains errors', async () => {
    const { api } = fakeApi({
      agentStatus: async () => ok<AgentStatus>({ available: false, reason: 'not_installed' }),
      listProjects: async () => ok([]),
      addProject: vi
        .fn<OctoApi['addProject']>()
        .mockResolvedValueOnce(ok(null))
        .mockResolvedValueOnce({ ok: false, code: 'project_already_added' }),
    })
    render(<App api={api} />)

    expect(await screen.findByText(messages.noProjectTitle)).toBeTruthy()
    expect(await screen.findByText(messages.agentMissingTitle)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: messages.addProject }))
    fireEvent.click(screen.getByRole('button', { name: messages.addProject }))
    expect(await screen.findByText('Questa cartella è già fra i tuoi progetti.')).toBeTruthy()
  })

  it('reports a project list or a history it cannot load', async () => {
    const first = fakeApi({ listProjects: async () => ({ ok: false, code: 'unexpected' }) })
    render(<App api={first.api} />)
    expect(await screen.findByText('Qualcosa non ha funzionato. Riprova.')).toBeTruthy()
    cleanup()

    const second = fakeApi({
      listQuestions: async () => ({ ok: false, code: 'project_not_found' }),
      removeProject: async () => ({ ok: false, code: 'project_not_found' }),
    })
    render(<App api={second.api} />)
    expect(await screen.findByText('Questo progetto non è più in elenco.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: messages.removeProject }))
    await waitFor(() => expect(screen.getAllByRole('alert').length).toBeGreaterThan(1))
  })
})

describe('answer text', () => {
  it('links markers to their source and leaves real links alone', () => {
    expect(linkMarkers('a [1], b [2](x)')).toBe('a [1](#fonte-1), b [2](x)')
    expect(markerOfLink('#fonte-4')).toBe(4)
    expect(markerOfLink('https://example.com')).toBeNull()
    expect(markerOfLink(undefined)).toBeNull()
    expect(markerOfLink('#fonte-x')).toBeNull()
  })

  it('describes a step with or without a target', () => {
    expect(progressText({ kind: 'writing', target: '' })).toBe('Scrivo la risposta')
    expect(progressText({ kind: 'searching', target: 'budget' })).toBe('Cerco budget')
  })
})

describe('project tabs', () => {
  it('switches between asking and the sources of the project', async () => {
    const { api } = fakeApi()
    render(<App api={api} />)

    fireEvent.click(await screen.findByRole('tab', { name: messages.sourcesTab }))
    expect(await screen.findByText(messages.mailNotConfigured)).toBeTruthy()
    // The page loads once: with the real clock it must not reload at every render.
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(api.mailSource).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('tab', { name: messages.ask }))
    expect(await screen.findByPlaceholderText(messages.askPlaceholder)).toBeTruthy()
  })
})
