// @vitest-environment jsdom
import type { FeedView } from '@octo/application'
import type { AdoFeedConfig, Project, SourceRun } from '@octo/domain'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { FeedSection } from '../src/renderer/FeedSection.tsx'
import { messages } from '../src/renderer/messages.ts'
import type { OctoApi, Result } from '../src/shared/api.ts'

const project: Project = { id: 'p-1', name: 'Aurora', folder: '/progetti/Aurora', addedAt: '' }
const NOW = new Date('2026-11-14T10:00:00.000Z')
const now = () => NOW
const ok = <T,>(value: T): Result<T> => ({ ok: true, value })
const fields = messages.feedFields

const config: AdoFeedConfig = {
  organization: 'contoso',
  project: 'Aurora',
  areas: ['Team A', 'Team B'],
  since: '2026-11-01',
  targetFolder: 'raw/ADO',
}
const run: SourceRun = { at: '2026-11-14T09:30:00.000Z', written: 4, unchanged: 120, error: null }
const empty: FeedView = {
  feed: 'ado',
  config: null,
  suggestedFolder: 'raw/ADO',
  hasSecret: false,
  state: { cursor: null, lastRun: null },
}
const linked: FeedView = { ...empty, config, hasSecret: true, state: { cursor: 'x', lastRun: run } }

type FeedApi = Pick<OctoApi, 'feed' | 'saveFeed' | 'syncFeed' | 'onSourcesChanged'>

function fakeApi(overrides: Partial<FeedApi> = {}) {
  let changed: (projectId: string) => void = () => {}
  const api: FeedApi = {
    feed: vi.fn(async () => ok(linked)),
    saveFeed: vi.fn(async () => ok(linked)),
    syncFeed: vi.fn(async () => ok(run)),
    onSourcesChanged: (listener) => {
      changed = listener
      return () => {}
    },
    ...overrides,
  }
  return { api: api as OctoApi, changed: (projectId: string) => changed(projectId) }
}

const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } })

/** The label of the credential also holds its hint: it is found by how it starts. */
const secretInput = () =>
  screen.getByLabelText<HTMLInputElement>(new RegExp(`^${messages.feedSecret.ado}`))

afterEach(cleanup)

describe('FeedSection', () => {
  it('links Azure DevOps with what the PM types and a token that is never shown again', async () => {
    const { api } = fakeApi({ feed: vi.fn(async () => ok(empty)) })
    render(<FeedSection api={api} project={project} feed="ado" now={now} />)

    expect(await screen.findByText(messages.feedNotConfigured)).toBeTruthy()
    expect(screen.getByLabelText<HTMLInputElement>(fields.targetFolder).value).toBe('raw/ADO')
    expect(screen.getByLabelText<HTMLInputElement>(fields.since).value).toBe('2026-10-15')
    expect(screen.queryByRole('button', { name: messages.feedOff })).toBeNull()

    type(fields.organization, 'contoso')
    type(fields.project, 'Aurora')
    type(fields.areas, 'Team A\nTeam B')
    fireEvent.change(secretInput(), { target: { value: 'pat-segreto' } })
    fireEvent.click(screen.getByRole('button', { name: messages.feedSave }))

    expect(await screen.findByText(messages.feedSaved)).toBeTruthy()
    expect(api.saveFeed).toHaveBeenCalledWith(
      'p-1',
      'ado',
      { ...config, since: '2026-10-15' },
      'pat-segreto',
    )
    expect(secretInput().value).toBe('')
    expect(screen.getByText(messages.feedSecretKept)).toBeTruthy()
  })

  it('shows how fresh the data are, reads on request and can unlink', async () => {
    let finish: (result: Result<SourceRun>) => void = () => {}
    const { api, changed } = fakeApi({
      syncFeed: vi.fn(() => new Promise<Result<SourceRun>>((resolve) => (finish = resolve))),
    })
    render(<FeedSection api={api} project={project} feed="ado" now={now} />)

    expect(await screen.findByText(/4 aggiornati, 120 invariati/)).toBeTruthy()
    expect(screen.getByLabelText<HTMLTextAreaElement>(fields.areas).value).toBe('Team A\nTeam B')

    fireEvent.click(screen.getByRole('button', { name: messages.feedSync }))
    expect(await screen.findByText(messages.feedSyncing)).toBeTruthy()
    await act(async () => finish(ok(run)))
    await waitFor(() => expect(api.feed).toHaveBeenCalledTimes(2))

    act(() => changed('altro'))
    act(() => changed('p-1'))
    await waitFor(() => expect(api.feed).toHaveBeenCalledTimes(3))

    fireEvent.click(screen.getByRole('button', { name: messages.feedOff }))
    await waitFor(() => expect(api.saveFeed).toHaveBeenCalledWith('p-1', 'ado', null, null))
  })

  it('offers the fields of the warehouse, with the port and the security of the connection', async () => {
    const dwsi: FeedView = { ...empty, feed: 'dwsi', suggestedFolder: 'raw/NetSuite' }
    const { api } = fakeApi({ feed: vi.fn(async () => ok(dwsi)) })
    render(<FeedSection api={api} project={project} feed="dwsi" now={now} />)

    await screen.findByText(messages.feedNotConfigured)
    expect(screen.getByLabelText<HTMLInputElement>(fields.port).value).toBe('5432')
    type(fields.projectCodes, 'PRJ000101')
    fireEvent.change(screen.getByLabelText(fields.tls), { target: { value: 'plaintext' } })
    fireEvent.click(screen.getByRole('button', { name: messages.feedSave }))

    await waitFor(() => expect(api.saveFeed).toHaveBeenCalled())
    const sent = vi.mocked(api.saveFeed).mock.calls[0]
    expect(sent?.[2]).toMatchObject({ port: 5432, projectCodes: ['PRJ000101'], tls: 'plaintext' })
    expect(sent?.[3]).toBeNull()
  })

  it('warns when the data are stale, never read, or the last reading failed', async () => {
    const state = (lastRun: SourceRun | null) => ({ ...linked, state: { cursor: null, lastRun } })
    const old = fakeApi({ feed: async () => ok(state({ ...run, at: '2026-11-12T09:00:00.000Z' })) })
    render(<FeedSection api={old.api} project={project} feed="ado" now={now} />)
    expect(await screen.findByText(messages.feedStale)).toBeTruthy()
    cleanup()

    const never = fakeApi({ feed: async () => ok(state(null)) })
    render(<FeedSection api={never.api} project={project} feed="ado" now={now} />)
    expect(await screen.findByText(messages.feedNeverRead)).toBeTruthy()
    cleanup()

    const failed = fakeApi({ feed: async () => ok(state({ ...run, error: 'feed_unreachable' })) })
    render(<FeedSection api={failed.api} project={project} feed="ado" now={now} />)
    expect(await screen.findByText(/Il sistema non risponde/)).toBeTruthy()
  })

  it('explains what it could not load, link or read', async () => {
    const unloaded = fakeApi({ feed: async () => ({ ok: false, code: 'unexpected' }) })
    render(<FeedSection api={unloaded.api} project={project} feed="jira" />)
    expect(await screen.findByText('Qualcosa non ha funzionato. Riprova.')).toBeTruthy()
    cleanup()

    const { api } = fakeApi({
      saveFeed: async () => ({ ok: false, code: 'feed_credential_refused' }),
      syncFeed: async () => ({ ok: false, code: 'source_busy' }),
    })
    render(<FeedSection api={api} project={project} feed="ado" now={now} />)
    fireEvent.click(await screen.findByRole('button', { name: messages.feedSave }))
    expect(await screen.findByText(/ha rifiutato la credenziale/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: messages.feedSync }))
    expect(await screen.findByText('Una lettura è già in corso.')).toBeTruthy()
  })
})
