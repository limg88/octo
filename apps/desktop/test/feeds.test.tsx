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

type FeedApi = Pick<OctoApi, 'feed' | 'saveFeed' | 'syncFeed' | 'onSourcesChanged' | 'feedChoices'>

function fakeApi(overrides: Partial<FeedApi> = {}) {
  let changed: (projectId: string) => void = () => {}
  const api: FeedApi = {
    feed: vi.fn(async () => ok(linked)),
    saveFeed: vi.fn(async () => ok(linked)),
    feedChoices: vi.fn(async () => ok({ projects: [], areas: [] })),
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

    // Unlinking forgets the credential: it is asked first, and can be given up.
    fireEvent.click(screen.getByRole('button', { name: messages.feedOff }))
    expect(screen.getByRole('alert').textContent).toContain(messages.feedOffConfirm('Azure DevOps'))
    fireEvent.click(screen.getByRole('button', { name: messages.cancel }))
    expect(screen.queryByRole('alert')).toBeNull()
    expect(api.saveFeed).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: messages.feedOff }))
    fireEvent.click(screen.getByRole('button', { name: messages.feedOff }))
    await waitFor(() => expect(api.saveFeed).toHaveBeenCalledWith('p-1', 'ado', null, null))
  })

  it('explains beside the credential how to get one, on request', async () => {
    const { api } = fakeApi()
    render(<FeedSection api={api} project={project} feed="ado" now={now} />)
    const info = await screen.findByRole('button', { name: messages.feedHelpTitle.ado })
    expect(screen.queryByRole('note')).toBeNull()
    fireEvent.click(info)
    const guide = screen.getByRole('note')
    expect(guide.textContent).toContain(messages.feedHelp.ado.steps[0])
    expect(guide.textContent).toContain(messages.feedHelp.ado.note)
    expect(guide.querySelectorAll('li')).toHaveLength(messages.feedHelp.ado.steps.length)
    // It closes with Escape, with a second click, or when the focus goes elsewhere.
    fireEvent.keyDown(info, { key: 'Escape' })
    expect(screen.queryByRole('note')).toBeNull()
    fireEvent.click(info)
    fireEvent.click(info)
    expect(screen.queryByRole('note')).toBeNull()
    fireEvent.click(info)
    fireEvent.blur(info, { relatedTarget: secretInput() })
    expect(screen.queryByRole('note')).toBeNull()
    // The credential keeps its own name: the guide is beside the label, not inside it.
    expect(secretInput().type).toBe('password')
  })

  it('links Confluence by its spaces, searched and picked with a click', async () => {
    const confluence: FeedView = {
      ...empty,
      feed: 'confluence',
      suggestedFolder: '_octo/fonti/Confluence',
    }
    const { api } = fakeApi({
      feed: vi.fn(async () => ok(confluence)),
      feedChoices: vi.fn(async () =>
        ok({ projects: [{ value: 'AUR', label: 'Aurora (AUR)' }], areas: [] }),
      ),
    })
    render(<FeedSection api={api} project={project} feed="confluence" now={now} />)
    await screen.findByText(messages.feedIntro.confluence)
    type(fields.site, 'contoso')
    type(fields.email, 'pm@example.test')
    fireEvent.change(screen.getByLabelText(new RegExp(`^${messages.feedSecret.confluence}`)), {
      target: { value: 'token' },
    })
    fireEvent.click(screen.getByRole('button', { name: messages.feedChoicesSpaces }))
    expect(await screen.findByText(messages.feedChoicesSpacesTitle)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Aurora (AUR)' }))
    expect(screen.getByLabelText<HTMLTextAreaElement>(fields.spaces).value).toBe('AUR')
    fireEvent.click(screen.getByRole('button', { name: messages.feedSave }))
    await waitFor(() => expect(api.saveFeed).toHaveBeenCalled())
    expect(vi.mocked(api.saveFeed).mock.calls[0]?.slice(1)).toMatchObject([
      'confluence',
      { site: 'contoso', email: 'pm@example.test', spaces: ['AUR'] },
      'token',
    ])
  })

  it('says when the account sees no space', async () => {
    const confluence: FeedView = { ...empty, feed: 'confluence' }
    const { api } = fakeApi({
      feed: vi.fn(async () => ok(confluence)),
      feedChoices: vi.fn(async () => ok({ projects: [], areas: [] })),
    })
    render(<FeedSection api={api} project={project} feed="confluence" now={now} />)
    fireEvent.click(await screen.findByRole('button', { name: messages.feedChoicesSpaces }))
    expect(await screen.findByText(messages.feedChoicesNoSpaces)).toBeTruthy()
  })

  it('is one row of a list when folded: its state, a reading, and the way in', async () => {
    const { api } = fakeApi()
    const onToggle = vi.fn()
    const view = render(
      <FeedSection
        api={api}
        project={project}
        feed="ado"
        now={now}
        open={false}
        onToggle={onToggle}
      />,
    )
    expect(await screen.findByText(/4 aggiornati, 120 invariati/)).toBeTruthy()
    expect(screen.getByLabelText(fields.organization).closest('form')?.hidden).toBe(true)
    expect(screen.queryByText(messages.feedIntro.ado)).toBeNull()
    // Linked: it is read from the row, and changed rather than linked.
    fireEvent.click(screen.getAllByRole('button', { name: messages.feedSync })[0] as HTMLElement)
    await waitFor(() => expect(api.syncFeed).toHaveBeenCalledWith('p-1', 'ado'))
    const edit = screen.getByRole('button', {
      name: `${messages.sourceEdit}: Azure DevOps`,
    })
    expect(edit.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(edit)
    expect(onToggle).toHaveBeenCalledTimes(1)
    view.unmount()

    const unlinked = fakeApi({ feed: vi.fn(async () => ok(empty)) })
    render(
      <FeedSection
        api={unlinked.api}
        project={project}
        feed="ado"
        now={now}
        open={false}
        onToggle={onToggle}
      />,
    )
    const link = await screen.findByRole('button', { name: `${messages.sourceLink}: Azure DevOps` })
    expect(link.className).toBe('primary')
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
    // What is empty is said field by field, before the system is asked anything.
    expect(screen.getAllByText(messages.feedFieldMissing)).toHaveLength(5)
    expect(screen.getByRole('status').textContent).toBe(messages.feedMissingFields)
    expect(api.saveFeed).not.toHaveBeenCalled()
    type(fields.host, 'dwh')
    type(fields.database, 'dwsi')
    type(fields.user, 'lettore')
    type(fields.ownerEmail, 'pm@example.test')
    fireEvent.change(screen.getByLabelText(new RegExp(`^${messages.feedSecret.dwsi}`)), {
      target: { value: 'segreto' },
    })
    fireEvent.click(screen.getByRole('button', { name: messages.feedSave }))

    await waitFor(() => expect(api.saveFeed).toHaveBeenCalled())
    expect(screen.queryByText(messages.feedFieldMissing)).toBeNull()
    const sent = vi.mocked(api.saveFeed).mock.calls[0]
    expect(sent?.[2]).toMatchObject({ port: 5432, projectCodes: ['PRJ000101'], tls: 'plaintext' })
    expect(sent?.[3]).toBe('segreto')
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
