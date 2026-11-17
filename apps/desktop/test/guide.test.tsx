// @vitest-environment jsdom
import type { FeedingStatus, FeedingStep, FeedView, MailSourceView } from '@octo/application'
import type { FeedChoices, MailPreview, Project, SourceRun } from '@octo/domain'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FeedSection } from '../src/renderer/FeedSection.tsx'
import { messages } from '../src/renderer/messages.ts'
import { SetupGuide } from '../src/renderer/SetupGuide.tsx'
import { SourcesView } from '../src/renderer/SourcesView.tsx'
import type { OctoApi, Result } from '../src/shared/api.ts'

const project: Project = { id: 'p-1', name: 'Aurora', folder: '/progetti/Aurora', addedAt: '' }
const ok = <T,>(value: T): Result<T> => ({ ok: true, value })
const run = (written: number, error: SourceRun['error'] = null): SourceRun => ({
  at: '2026-11-14T10:00:00.000Z',
  written,
  unchanged: 3,
  error,
})
const fields = messages.feedFields

afterEach(cleanup)

describe('SetupGuide', () => {
  type GuideApi = Pick<OctoApi, 'feedingStatus' | 'fill' | 'onFeedingStep' | 'onSourcesChanged'>

  function fakeApi(overrides: Partial<GuideApi> = {}) {
    let step: (projectId: string, step: FeedingStep) => void = () => {}
    let changed: (projectId: string) => void = () => {}
    const api: GuideApi = {
      feedingStatus: vi.fn(async () =>
        ok<FeedingStatus>({ mail: true, meetings: true, feeds: ['ado'] }),
      ),
      fill: vi.fn(async () => ok<FeedingStep[]>([])),
      onFeedingStep: (listener) => {
        step = listener
        return () => {}
      },
      onSourcesChanged: (listener) => {
        changed = listener
        return () => {}
      },
      ...overrides,
    }
    return {
      api: api as OctoApi,
      step: (projectId: string, value: FeedingStep) => step(projectId, value),
      changed: (projectId: string) => changed(projectId),
    }
  }

  it('shows what is linked and what is still to do, and follows the changes', async () => {
    const { api, changed } = fakeApi()
    render(<SetupGuide api={api} project={project} />)

    // Posta, the meetings and one system out of the six sources: the rows below say which.
    expect(await screen.findByText(messages.guideLinked(3, 6))).toBeTruthy()

    act(() => changed('altro'))
    act(() => changed('p-1'))
    await waitFor(() => expect(api.feedingStatus).toHaveBeenCalledTimes(2))
  })

  it('says where to start when nothing is linked yet', async () => {
    const { api } = fakeApi({
      feedingStatus: async () => ok({ mail: false, meetings: false, feeds: [] }),
    })
    render(<SetupGuide api={api} project={project} />)
    expect(await screen.findByText(messages.guideLinked(0, 6))).toBeTruthy()
  })

  it('fills the memory from everything linked and tells each step as it ends', async () => {
    let finish: (result: Result<FeedingStep[]>) => void = () => {}
    const { api, step } = fakeApi({
      fill: vi.fn(() => new Promise<Result<FeedingStep[]>>((resolve) => (finish = resolve))),
    })
    render(<SetupGuide api={api} project={project} />)
    fireEvent.click(await screen.findByRole('button', { name: messages.guideFill }))

    expect(await screen.findByText(messages.guideFilling)).toBeTruthy()
    act(() => step('altro', { source: 'mail', run: run(9), error: null }))
    act(() => step('p-1', { source: 'mail', run: run(2), error: null }))
    expect(screen.getByText('Posta: 2 nuovi o aggiornati, 3 invariati.')).toBeTruthy()

    await act(async () =>
      finish(
        ok([
          { source: 'mail', run: run(2), error: null },
          { source: 'ado', run: run(0, 'feed_unreachable'), error: null },
          { source: 'jira', run: null, error: 'source_busy' },
          { source: 'documents', run: run(4), error: null },
        ]),
      ),
    )
    expect(await screen.findByText(messages.guideAsk)).toBeTruthy()
    expect(screen.getByText('Azure DevOps: non riuscito.')).toBeTruthy()
    expect(screen.getByText('Jira: non riuscito.')).toBeTruthy()
    expect(screen.getByText('Documenti: 4 nuovi o aggiornati, 3 invariati.')).toBeTruthy()
  })

  it('explains what it could not load or start', async () => {
    const { api } = fakeApi({
      feedingStatus: async () => ({ ok: false, code: 'source_config_invalid' }),
      fill: async () => ({ ok: false, code: 'unexpected' }),
    })
    render(<SetupGuide api={api} project={project} />)
    expect(await screen.findByText(/uno dei due non è valido/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: messages.guideFill }))
    expect(await screen.findByText('Qualcosa non ha funzionato. Riprova.')).toBeTruthy()
  })
})

describe('the mail of a new project', () => {
  const empty: MailSourceView = {
    config: null,
    suggestedFolder: 'Posta',
    state: { cursor: null, lastRun: null },
    readBy: null,
    readingBy: null,
    readableHere: true,
  }
  const base = {
    mailSource: vi.fn(async () => ok(empty)),
    saveMailSource: vi.fn(async () => ok(empty)),
    syncMail: vi.fn(async () => ok(run(0))),
    onSourcesChanged: () => () => {},
  }

  it('starts from the name of the project and shows what the rules would bring in', async () => {
    const preview: MailPreview = { count: 2, subjects: ['Aurora: collaudo', 'Aurora: budget'] }
    const api = { ...base, previewMail: vi.fn(async () => ok(preview)) } as unknown as OctoApi
    render(<SourcesView api={api} project={project} />)

    const keywords = await screen.findByLabelText<HTMLTextAreaElement>(/^Parole chiave/)
    expect(keywords.value).toBe('Aurora')
    fireEvent.click(screen.getByRole('button', { name: messages.mailPreview }))

    expect(await screen.findByText(messages.mailPreviewCount(2))).toBeTruthy()
    expect(screen.getByText('Aurora: collaudo')).toBeTruthy()
    expect(vi.mocked(api.previewMail).mock.calls[0]?.[1]).toMatchObject({ keywords: ['Aurora'] })
  })

  it('says when one mail, or none, would come in, and explains a preview that failed', async () => {
    const one = { ...base, previewMail: async () => ok({ count: 1, subjects: [] }) }
    render(<SourcesView api={one as unknown as OctoApi} project={project} />)
    fireEvent.click(await screen.findByRole('button', { name: messages.mailPreview }))
    expect(await screen.findByText(messages.mailPreviewCount(1))).toBeTruthy()
    expect(screen.queryByText(messages.mailPreviewNewest)).toBeNull()
    cleanup()

    const failing = {
      ...base,
      previewMail: async () => ({ ok: false, code: 'mail_archive_unreadable' }),
    }
    render(<SourcesView api={failing as unknown as OctoApi} project={project} />)
    fireEvent.click(await screen.findByRole('button', { name: messages.mailPreview }))
    expect(await screen.findByText(/abilita Octo e riaprilo/)).toBeTruthy()
  })
})

describe('choosing a project and its areas instead of typing them', () => {
  const view = (feed: 'ado' | 'jira' | 'dwsi'): FeedView => ({
    feed,
    config: null,
    suggestedFolder: `Fonti/${feed}`,
    hasSecret: false,
    state: { cursor: null, lastRun: null },
    readBy: null,
    readingBy: null,
  })
  const apiWith = (feed: 'ado' | 'jira' | 'dwsi', choices: Result<FeedChoices>) =>
    ({
      feed: vi.fn(async () => ok(view(feed))),
      saveFeed: vi.fn(async () => ok(view(feed))),
      syncFeed: vi.fn(async () => ok(run(0))),
      feedChoices: vi.fn(async () => choices),
      onSourcesChanged: () => () => {},
    }) as unknown as OctoApi

  it('fills the project of Azure DevOps and adds its areas with a click', async () => {
    const api = apiWith(
      'ado',
      ok({
        projects: [{ value: 'Aurora', label: 'Aurora' }],
        areas: [
          { value: 'Team A', label: 'Team A' },
          { value: 'Team B', label: 'Team B' },
        ],
      }),
    )
    render(<FeedSection api={api} project={project} feed="ado" />)
    fireEvent.change(await screen.findByLabelText(fields.organization), {
      target: { value: 'contoso' },
    })
    fireEvent.change(screen.getByLabelText(/^Personal Access Token/), { target: { value: 'pat' } })
    fireEvent.click(screen.getByRole('button', { name: messages.feedChoices }))

    fireEvent.click(await screen.findByRole('button', { name: 'Aurora' }))
    fireEvent.click(screen.getByRole('button', { name: 'Team A' }))
    fireEvent.click(screen.getByRole('button', { name: 'Team B' }))
    fireEvent.click(screen.getByRole('button', { name: 'Team A' }))

    expect(screen.getByLabelText<HTMLInputElement>(fields.project).value).toBe('Aurora')
    expect(screen.getByLabelText<HTMLTextAreaElement>(fields.areas).value).toBe('Team A\nTeam B')
    expect(vi.mocked(api.feedChoices).mock.calls[0]).toMatchObject([
      'p-1',
      'ado',
      { organization: 'contoso' },
      'pat',
    ])
  })

  it('adds the projects of Jira by their key, and offers no search for the warehouse', async () => {
    const jira = apiWith(
      'jira',
      ok({ projects: [{ value: 'AUR', label: 'Aurora (AUR)' }], areas: [] }),
    )
    render(<FeedSection api={jira} project={project} feed="jira" />)
    fireEvent.click(await screen.findByRole('button', { name: messages.feedChoices }))
    fireEvent.click(await screen.findByRole('button', { name: 'Aurora (AUR)' }))
    expect(screen.getByLabelText<HTMLTextAreaElement>(fields.projects).value).toBe('AUR')
    expect(vi.mocked(jira.feedChoices).mock.calls[0]?.[3]).toBeNull()
    cleanup()

    render(
      <FeedSection
        api={apiWith('dwsi', ok({ projects: [], areas: [] }))}
        project={project}
        feed="dwsi"
      />,
    )
    await screen.findByText(messages.feedNotConfigured)
    expect(screen.queryByRole('button', { name: messages.feedChoices })).toBeNull()
  })

  it('says when the credential sees nothing, and explains a search that failed', async () => {
    const nothing = apiWith('ado', ok({ projects: [], areas: [] }))
    render(<FeedSection api={nothing} project={project} feed="ado" />)
    fireEvent.click(await screen.findByRole('button', { name: messages.feedChoices }))
    expect(await screen.findByText(messages.feedChoicesNone)).toBeTruthy()
    cleanup()

    const refused = apiWith('ado', { ok: false, code: 'secret_missing' })
    render(<FeedSection api={refused} project={project} feed="ado" />)
    fireEvent.click(await screen.findByRole('button', { name: messages.feedChoices }))
    expect(await screen.findByText(/Serve la credenziale/)).toBeTruthy()
  })
})
