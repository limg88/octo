// @vitest-environment jsdom
import type { MailSourceView } from '@octo/application'
import type { MailSourceConfig, Project, SourceRun } from '@octo/domain'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { messages } from '../src/renderer/messages.ts'
import { SourcesView } from '../src/renderer/SourcesView.tsx'
import type { OctoApi, Result } from '../src/shared/api.ts'

const project: Project = { id: 'p-1', name: 'Aurora', folder: '/progetti/Aurora', addedAt: '' }
const NOW = new Date('2026-11-14T10:00:00.000Z')
const now = () => NOW
const ok = <T,>(value: T): Result<T> => ({ ok: true, value })

const config: MailSourceConfig = {
  since: '2026-11-01',
  keywords: ['Aurora', '@cliente.example'],
  folders: [],
  excludeSenders: ['avvisi@monitor.example'],
  keepQuoted: false,
  targetFolder: 'raw/Mail',
}
const run: SourceRun = { at: '2026-11-14T09:30:00.000Z', written: 3, unchanged: 12, error: null }
const empty: MailSourceView = {
  config: null,
  suggestedFolder: 'raw/Mail',
  state: { cursor: null, lastRun: null },
}
const configured: MailSourceView = {
  config,
  suggestedFolder: 'raw/Mail',
  state: { cursor: run.at, lastRun: run },
}

type SourcesApi = Pick<OctoApi, 'mailSource' | 'saveMailSource' | 'syncMail' | 'onSourcesChanged'>

function fakeApi(overrides: Partial<SourcesApi> = {}) {
  let changed: (projectId: string) => void = () => {}
  const api: SourcesApi = {
    mailSource: vi.fn(async () => ok(configured)),
    saveMailSource: vi.fn(async () => ok(configured)),
    syncMail: vi.fn(async () => ok(run)),
    onSourcesChanged: (listener) => {
      changed = listener
      return () => {}
    },
    ...overrides,
  }
  return { api: api as OctoApi, changed: (projectId: string) => changed(projectId) }
}

afterEach(cleanup)

describe('SourcesView', () => {
  it('proposes a first configuration and saves what the PM types, one rule per line', async () => {
    const { api } = fakeApi({ mailSource: vi.fn(async () => ok(empty)) })
    render(<SourcesView api={api} project={project} now={now} />)

    expect(await screen.findByText(messages.mailNotConfigured)).toBeTruthy()
    expect(screen.getByLabelText<HTMLInputElement>(messages.mailTarget).value).toBe('raw/Mail')
    expect(screen.getByLabelText<HTMLInputElement>(messages.mailSince).value).toBe('2026-10-15')
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: messages.mailSync }).disabled,
    ).toBe(true)

    fireEvent.change(screen.getByLabelText(new RegExp(messages.mailKeywords.slice(0, 14))), {
      target: { value: 'Aurora\n@cliente.example' },
    })
    fireEvent.click(screen.getByLabelText(messages.mailKeepQuoted))
    fireEvent.click(screen.getByRole('button', { name: messages.mailSave }))

    expect(await screen.findByText(messages.mailSaved)).toBeTruthy()
    expect(api.saveMailSource).toHaveBeenCalledWith('p-1', {
      since: '2026-10-15',
      keywords: ['Aurora', '@cliente.example'],
      folders: [''],
      excludeSenders: [''],
      keepQuoted: true,
      targetFolder: 'raw/Mail',
    })
  })

  it('shows how fresh the mail is and reads it on request', async () => {
    let finish: (result: Result<SourceRun>) => void = () => {}
    const { api } = fakeApi({
      syncMail: vi.fn(() => new Promise<Result<SourceRun>>((resolve) => (finish = resolve))),
    })
    render(<SourcesView api={api} project={project} now={now} />)

    expect(await screen.findByText(/3 nuove, 12 già presenti/)).toBeTruthy()
    expect(screen.queryByText(messages.mailStale)).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: messages.mailSync }))
    expect(await screen.findByText(messages.mailSyncing)).toBeTruthy()
    await act(async () => finish(ok(run)))
    await waitFor(() => expect(api.mailSource).toHaveBeenCalledTimes(2))
    expect(screen.queryByText(messages.mailSyncing)).toBeNull()
  })

  it('is one row of the list when folded, read from the row itself', async () => {
    const { api } = fakeApi()
    const onToggle = vi.fn()
    render(<SourcesView api={api} project={project} now={now} open={false} onToggle={onToggle} />)
    expect(await screen.findByText(/3 nuove, 12 già presenti/)).toBeTruthy()
    expect(screen.getByLabelText(messages.mailSince).closest('form')?.hidden).toBe(true)
    expect(screen.queryByText(messages.mailIntro)).toBeNull()
    fireEvent.click(screen.getAllByRole('button', { name: messages.mailSync })[0] as HTMLElement)
    await waitFor(() => expect(api.syncMail).toHaveBeenCalledWith('p-1'))
    fireEvent.click(
      screen.getByRole('button', { name: `${messages.sourceEdit}: ${messages.mailTitle}` }),
    )
    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('warns when the mail is stale, was never read, or the last reading failed', async () => {
    const old = { ...run, at: '2026-11-12T09:00:00.000Z' }
    const stale = fakeApi({
      mailSource: async () => ok({ ...configured, state: { cursor: old.at, lastRun: old } }),
    })
    render(<SourcesView api={stale.api} project={project} now={now} />)
    expect(await screen.findByText(messages.mailStale)).toBeTruthy()
    cleanup()

    const never = fakeApi({
      mailSource: async () => ok({ ...configured, state: { cursor: null, lastRun: null } }),
    })
    render(<SourcesView api={never.api} project={project} now={now} />)
    expect(await screen.findByText(messages.mailNeverRead)).toBeTruthy()
    cleanup()

    const failed = { ...run, error: 'mail_archive_unreadable' as const }
    const broken = fakeApi({
      mailSource: async () => ok({ ...configured, state: { cursor: null, lastRun: failed } }),
    })
    render(<SourcesView api={broken.api} project={project} now={now} />)
    expect(await screen.findByText(/Accesso completo al disco/)).toBeTruthy()
  })

  it('refreshes after a periodic reading of this project only', async () => {
    const { api, changed } = fakeApi()
    render(<SourcesView api={api} project={project} now={now} />)
    await screen.findByText(/3 nuove/)

    act(() => changed('altro'))
    act(() => changed('p-1'))
    await waitFor(() => expect(api.mailSource).toHaveBeenCalledTimes(2))
  })

  it('explains what it could not load, save or read', async () => {
    const unloaded = fakeApi({
      mailSource: async () => ({ ok: false, code: 'source_config_invalid' }),
    })
    render(<SourcesView api={unloaded.api} project={project} now={now} />)
    expect(await screen.findByText(/uno dei due non è valido/)).toBeTruthy()
    cleanup()

    const { api } = fakeApi({
      saveMailSource: async () => ({ ok: false, code: 'source_config_invalid' }),
      syncMail: async () => ({ ok: false, code: 'source_busy' }),
    })
    render(<SourcesView api={api} project={project} now={now} />)
    fireEvent.click(await screen.findByRole('button', { name: messages.mailSave }))
    expect(await screen.findByText(/uno dei due non è valido/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: messages.mailSync }))
    expect(await screen.findByText('Una lettura è già in corso.')).toBeTruthy()
  })
})
