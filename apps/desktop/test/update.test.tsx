// @vitest-environment jsdom
import type { UpdateOffer, UpdateProgress } from '@octo/domain'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { messages } from '../src/renderer/messages.ts'
import { UpdateNotice } from '../src/renderer/UpdateNotice.tsx'
import type { OctoApi, Result } from '../src/shared/api.ts'

const ok = <T,>(value: T): Result<T> => ({ ok: true, value })
const text = messages.update
const offer: UpdateOffer = { version: '1.4.0', notes: '' }

type UpdateApi = Pick<
  OctoApi,
  | 'checkForUpdate'
  | 'installUpdate'
  | 'onUpdateProgress'
  | 'updateJustDone'
  | 'openDiskAccessSettings'
>

function fakeApi(overrides: Partial<UpdateApi> = {}) {
  let tell: (progress: UpdateProgress) => void = () => {}
  const api: UpdateApi = {
    checkForUpdate: vi.fn(async () => ok<UpdateOffer | null>(offer)),
    installUpdate: vi.fn(() => new Promise<Result<null>>(() => {})),
    onUpdateProgress: (listener) => {
      tell = listener
      return () => {}
    },
    updateJustDone: vi.fn(async () => ok<string | null>(null)),
    openDiskAccessSettings: vi.fn(async () => ok(null)),
    ...overrides,
  }
  return { api, progress: (step: UpdateProgress) => tell(step) }
}

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('the notice of a newer Octo', () => {
  it('says nothing when this Octo is the latest, or when the check fails', async () => {
    const latest = fakeApi({ checkForUpdate: vi.fn(async () => ok(null)) })
    const first = render(<UpdateNotice api={latest.api} />)
    await waitFor(() => expect(latest.api.checkForUpdate).toHaveBeenCalled())
    expect(screen.queryByRole('status')).toBeNull()
    first.unmount()

    const offline = fakeApi({
      checkForUpdate: vi.fn(
        async (): Promise<Result<UpdateOffer | null>> => ({
          ok: false,
          code: 'update_check_failed',
        }),
      ),
    })
    render(<UpdateNotice api={offline.api} />)
    await waitFor(() => expect(offline.api.checkForUpdate).toHaveBeenCalled())
    expect(screen.queryByRole('status')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('offers the newer version, and on a click says how far it is until Octo restarts', async () => {
    const { api, progress } = fakeApi()
    render(<UpdateNotice api={api} />)
    expect((await screen.findByRole('status')).textContent).toContain(text.available('1.4.0'))
    expect(screen.getByText(text.hint, { exact: false })).toBeTruthy()

    const install = screen.getByRole('button', { name: text.install })
    fireEvent.click(install)
    await waitFor(() => expect(install.getAttribute('aria-busy')).toBe('true'))
    expect(api.installUpdate).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('status').textContent).toContain(text.preparing)
    // While it installs it cannot be put off.
    expect(screen.queryByRole('button', { name: text.later })).toBeNull()

    act(() => progress({ received: 42, total: 100 }))
    expect(screen.getByRole('status').textContent).toContain(text.downloading(42))
    act(() => progress({ received: 100, total: 100 }))
    expect(screen.getByRole('status').textContent).toContain(text.restarting)
  })

  it('explains an update that failed and lets the PM try again', async () => {
    const install = vi
      .fn<OctoApi['installUpdate']>()
      .mockResolvedValueOnce({ ok: false, code: 'update_checksum_mismatch' })
      .mockResolvedValue(ok(null))
    const { api } = fakeApi({ installUpdate: install })
    render(<UpdateNotice api={api} />)
    fireEvent.click(await screen.findByRole('button', { name: text.install }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/non è quello pubblicato/)

    fireEvent.click(screen.getByRole('button', { name: text.install }))
    await waitFor(() => expect(install).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
  })

  it('is put off until another version comes, and looks again while Octo stays open', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const check = vi
      .fn<OctoApi['checkForUpdate']>()
      .mockResolvedValueOnce(ok(offer))
      .mockResolvedValueOnce(ok(offer))
      .mockResolvedValue(ok({ version: '1.5.0', notes: '' }))
    const { api } = fakeApi({ checkForUpdate: check })
    render(<UpdateNotice api={api} everyMs={1000} />)
    fireEvent.click(await screen.findByRole('button', { name: text.later }))
    expect(screen.queryByRole('status')).toBeNull()

    // The same version again: still put off. A newer one: offered.
    await act(async () => vi.advanceTimersByTimeAsync(1000))
    expect(check).toHaveBeenCalledTimes(2)
    expect(screen.queryByRole('status')).toBeNull()
    await act(async () => vi.advanceTimersByTimeAsync(1000))
    expect((await screen.findByRole('status')).textContent).toContain(text.available('1.5.0'))
  })

  it('says, after an update, that the access to the disk has to be given again, once', async () => {
    const { api } = fakeApi({ updateJustDone: vi.fn(async () => ok<string | null>('1.4.0')) })
    render(<UpdateNotice api={api} />)
    expect((await screen.findByRole('status')).textContent).toBe(
      messages.diskAccess.afterUpdate('1.4.0'),
    )
    fireEvent.click(screen.getByRole('button', { name: messages.diskAccess.open }))
    expect(api.openDiskAccessSettings).toHaveBeenCalledTimes(1)
    // Seen: what is left is the offer of a newer version, as usual.
    fireEvent.click(screen.getByRole('button', { name: messages.diskAccess.done }))
    expect((await screen.findByRole('status')).textContent).toContain(text.available('1.4.0'))
  })
})
