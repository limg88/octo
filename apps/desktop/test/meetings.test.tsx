// @vitest-environment jsdom
import type { MeetingsSourceView } from '@octo/application'
import type { Project, SourceRun, StoredMeeting } from '@octo/domain'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MeetingsSection } from '../src/renderer/MeetingsSection.tsx'
import { dateTimeText, errorText, messages } from '../src/renderer/messages.ts'
import type { OctoApi, Result } from '../src/shared/api.ts'

const project: Project = { id: 'p-1', name: 'Aurora', folder: '/progetti/Aurora', addedAt: '' }
const ok = <T,>(value: T): Result<T> => ({ ok: true, value })
const now = () => new Date('2026-11-16T09:00:00.000Z')
const run: SourceRun = { at: '2026-11-14T10:00:00.000Z', written: 2, unchanged: 5, error: null }
const empty: MeetingsSourceView = {
  config: null,
  suggestedRoot: '~/Documents/Verbale',
  targetFolder: '_octo/riunioni',
  state: { cursor: null, lastRun: null },
  readBy: null,
  readingBy: null,
  readableHere: true,
}
const linked: MeetingsSourceView = {
  config: { root: '~/Documents/Verbale', since: '2026-11-10' },
  suggestedRoot: null,
  targetFolder: '_octo/riunioni',
  state: { cursor: run.at, lastRun: run },
  readBy: null,
  readingBy: null,
  readableHere: true,
}

type MeetingsApi = Pick<
  OctoApi,
  | 'meetingsSource'
  | 'saveMeetingsSource'
  | 'syncMeetings'
  | 'chooseMeetingsRoot'
  | 'onSourcesChanged'
  | 'importedMeetings'
  | 'meetingDestinations'
  | 'moveMeeting'
>

function fakeApi(overrides: Partial<MeetingsApi> = {}) {
  let changed: (projectId: string) => void = () => {}
  const api: MeetingsApi = {
    meetingsSource: vi.fn(async () => ok(linked)),
    saveMeetingsSource: vi.fn(async () => ok(linked)),
    syncMeetings: vi.fn(async () => ok(run)),
    chooseMeetingsRoot: vi.fn(async () => ok<string | null>('/Volumes/Riunioni')),
    importedMeetings: vi.fn(async () => ok<StoredMeeting[]>([])),
    meetingDestinations: vi.fn(async () => ok([{ id: 'p-2', name: 'Borea' }])),
    moveMeeting: vi.fn(async () => ok<StoredMeeting[]>([])),
    onSourcesChanged: (listener) => {
      changed = listener
      return () => {}
    },
    ...overrides,
  }
  return { api: api as OctoApi, changed: (projectId: string) => changed(projectId) }
}

const show = (api: OctoApi, open = true) =>
  render(<MeetingsSection api={api} project={project} open={open} onToggle={() => {}} now={now} />)
const rootField = () => screen.getByLabelText<HTMLInputElement>(messages.meetingsRoot)

afterEach(cleanup)

describe('MeetingsSection', () => {
  it('proposes the folder Verbale uses on this computer and links it', async () => {
    const { api } = fakeApi({ meetingsSource: vi.fn(async () => ok(empty)) })
    show(api)

    expect(await screen.findByText(messages.meetingsNotConfigured)).toBeTruthy()
    expect(rootField().value).toBe('~/Documents/Verbale')
    expect(screen.getByText(messages.meetingsRootFound)).toBeTruthy()
    expect(screen.getByText(messages.meetingsTarget('_octo/riunioni'))).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: messages.meetingsSave }))

    expect(await screen.findByText(messages.meetingsSaved)).toBeTruthy()
    // A project linked now starts from today; after the saving the form shows what was kept.
    expect(api.saveMeetingsSource).toHaveBeenCalledWith('p-1', {
      root: '~/Documents/Verbale',
      since: '2026-11-16',
    })
    const since = screen.getByLabelText<HTMLInputElement>(new RegExp(messages.meetingsSince))
    expect(since.value).toBe('2026-11-10')
    // Left empty, every meeting of the folder is taken.
    fireEvent.change(since, { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: messages.meetingsSave }))
    await waitFor(() =>
      expect(api.saveMeetingsSource).toHaveBeenLastCalledWith('p-1', {
        root: '~/Documents/Verbale',
        since: null,
      }),
    )
    expect(screen.queryByText(messages.meetingsRootFound)).toBeNull()
  })

  it('asks to choose the folder when Verbale does not tell it, from the whole computer', async () => {
    const { api } = fakeApi({
      meetingsSource: vi.fn(async () => ok({ ...empty, suggestedRoot: null })),
    })
    show(api)

    expect(await screen.findByText(messages.meetingsRootMissing)).toBeTruthy()
    const save = screen.getByRole<HTMLButtonElement>('button', { name: messages.meetingsSave })
    expect(save.disabled).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: new RegExp(messages.choosePath) }))

    await waitFor(() => expect(rootField().value).toBe('/Volumes/Riunioni'))
    expect(save.disabled).toBe(false)
  })

  it('says whose meetings these are on a computer that has no folder of Verbale', async () => {
    const giovanni = { name: 'Giovanni', computer: 'mac-di-giovanni' }
    const elsewhere = { ...linked, readBy: giovanni, readableHere: false }
    const { api } = fakeApi({ meetingsSource: vi.fn(async () => ok(elsewhere)) })
    show(api, false)

    const who = messages.elsewhere.who(giovanni)
    expect(await screen.findByText(messages.elsewhere.read(who))).toBeTruthy()
    // Nothing to read from here: no way to ask for it.
    const ask = [messages.meetingsSync, messages.readSavedSource].flatMap((name) =>
      screen.queryAllByRole<HTMLButtonElement>('button', { name }),
    )
    expect(ask.every((button) => button.disabled)).toBe(true)
  })

  it('says when it was last read, reads again on request and follows a periodic reading', async () => {
    const { api, changed } = fakeApi()
    show(api, false)

    const last = messages.meetingsLastRun(dateTimeText(run.at), 2, 5)
    expect(await screen.findByText(last)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: messages.meetingsSync }))
    await waitFor(() => expect(api.syncMeetings).toHaveBeenCalledWith('p-1'))
    await waitFor(() => expect(api.meetingsSource).toHaveBeenCalledTimes(2))

    act(() => changed('altro'))
    act(() => changed('p-1'))
    await waitFor(() => expect(api.meetingsSource).toHaveBeenCalledTimes(3))
  })

  it('says a folder never read, one that cannot be opened and what it could not do', async () => {
    const never = fakeApi({
      meetingsSource: vi.fn(async () => ok({ ...linked, state: { cursor: null, lastRun: null } })),
    })
    show(never.api)
    expect(await screen.findByText(messages.meetingsNever)).toBeTruthy()
    cleanup()

    const failed: SourceRun = { ...run, error: 'meetings_root_unreadable' }
    const unreadable = fakeApi({
      meetingsSource: vi.fn(async () =>
        ok({ ...linked, state: { cursor: null, lastRun: failed } }),
      ),
      saveMeetingsSource: vi.fn(async () => ({
        ok: false as const,
        code: 'source_config_invalid' as const,
      })),
      syncMeetings: vi.fn(async () => ({ ok: false as const, code: 'source_busy' as const })),
      chooseMeetingsRoot: vi.fn(async () => ({ ok: false as const, code: 'unexpected' as const })),
    })
    show(unreadable.api)
    expect(await screen.findByText(errorText('meetings_root_unreadable'))).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: messages.meetingsSave }))
    expect(await screen.findByText(errorText('source_config_invalid'))).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: messages.readSavedSource }))
    expect(await screen.findByText(errorText('source_busy'))).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: new RegExp(messages.choosePath) }))
    expect(await screen.findByText(errorText('unexpected'))).toBeTruthy()
    cleanup()

    const closed = fakeApi({
      meetingsSource: vi.fn(async () => ({
        ok: false as const,
        code: 'project_not_found' as const,
      })),
    })
    show(closed.api)
    expect(await screen.findByText(errorText('project_not_found'))).toBeTruthy()
  })
  it('moves a meeting held by mistake to another project, or takes it away, after asking once more', async () => {
    const daily: StoredMeeting = {
      id: 'm-1',
      title: 'Daily Standup',
      started: '2026-11-17T08:30:00.000Z',
      minutes: 15,
      participants: ['Mario Rossi'],
      folder: '_octo/riunioni/2026-11-17_daily-standup_m-1',
    }
    const text = messages.meetingsHeld
    const { api } = fakeApi({ importedMeetings: vi.fn(async () => ok([daily])) })
    show(api)
    expect(await screen.findByText(text.title)).toBeTruthy()
    const where = screen.getByLabelText<HTMLSelectElement>(text.targetOf('Daily Standup'))
    fireEvent.change(where, { target: { value: 'p-2' } })
    fireEvent.click(screen.getByRole('button', { name: text.moveOf('Daily Standup') }))
    // Nothing moves before the PM read what goes away with the meeting.
    expect(screen.getByText(text.confirmMove('Borea'))).toBeTruthy()
    expect(api.moveMeeting).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: text.cancel }))
    expect(screen.queryByText(text.confirmMove('Borea'))).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: text.moveOf('Daily Standup') }))
    fireEvent.click(screen.getByRole('button', { name: text.confirm }))
    await waitFor(() => expect(api.moveMeeting).toHaveBeenCalledWith('p-1', 'm-1', 'p-2'))
    expect(await screen.findByText(text.moved('Borea'))).toBeTruthy()
    expect(screen.queryByLabelText(text.targetOf('Daily Standup'))).toBeNull()

    cleanup()
    // To no project: it goes back among the meetings to assign. A failure is said.
    const failing = fakeApi({
      importedMeetings: vi.fn(async () => ok([daily])),
      moveMeeting: vi
        .fn()
        .mockResolvedValueOnce({ ok: false, code: 'meeting_not_found' })
        .mockResolvedValueOnce(ok([])),
    })
    show(failing.api)
    fireEvent.click(await screen.findByRole('button', { name: text.moveOf('Daily Standup') }))
    expect(screen.getByText(text.confirmRelease)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: text.confirm }))
    expect((await screen.findByRole('alert')).textContent).toBe(errorText('meeting_not_found'))
    fireEvent.click(screen.getByRole('button', { name: text.moveOf('Daily Standup') }))
    fireEvent.click(screen.getByRole('button', { name: text.confirm }))
    await waitFor(() =>
      expect(failing.api.moveMeeting).toHaveBeenLastCalledWith('p-1', 'm-1', null),
    )
    expect(await screen.findByText(text.released)).toBeTruthy()
  })
})
