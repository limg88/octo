// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MissingTickets } from '../src/renderer/MissingTickets.tsx'
import { errorText, messages } from '../src/renderer/messages.ts'
import type { Result } from '../src/shared/api.ts'

const ok = <T,>(value: T): Result<T> => ({ ok: true, value })
const text = messages.tickets
const ticket = (summary: string, key: string | null = null) => ({
  summary,
  type: 'Story',
  description: '',
  key,
})

afterEach(cleanup)

describe('the missing tickets to create on Jira', () => {
  it('shows them only when asked, creates the ticked ones after a confirmation, and says what became of each', async () => {
    const missingTickets = vi
      .fn()
      .mockResolvedValueOnce(
        ok({
          site: 'contoso',
          projectKey: '',
          tickets: [ticket('A'), ticket('B'), ticket('C', 'AUR-7')],
        }),
      )
      .mockResolvedValue(
        ok({
          site: 'contoso',
          projectKey: 'AUR',
          tickets: [ticket('A', 'AUR-8'), ticket('B'), ticket('C', 'AUR-7')],
        }),
      )
    const createTickets = vi.fn(async () =>
      ok([
        { summary: 'A', key: 'AUR-8', error: null },
        { summary: 'B', key: null, error: 'feed_failed' },
      ]),
    )
    render(<MissingTickets api={{ missingTickets, createTickets }} projectId="p-1" runId="run-1" />)
    expect(missingTickets).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: text.open }))
    await waitFor(() => expect(screen.getByText(text.created('AUR-7'))).toBeTruthy())
    // Without a project key nothing can be asked; one already created cannot be ticked again.
    const create = () => screen.getByRole('button', { name: text.create(2) }) as HTMLButtonElement
    expect(create().disabled).toBe(true)
    expect((screen.getByRole('checkbox', { name: /^C/ }) as HTMLInputElement).disabled).toBe(true)
    fireEvent.change(screen.getByLabelText(text.project), { target: { value: ' aur ' } })
    fireEvent.click(create())
    // Nothing is written before the confirmation, which says how many and where.
    expect(createTickets).not.toHaveBeenCalled()
    expect(screen.getByText(text.confirm(2, 'AUR', 'contoso'))).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: messages.cancel }))
    fireEvent.click(screen.getByRole('checkbox', { name: /^B/ }))
    fireEvent.click(screen.getByRole('checkbox', { name: /^B/ }))
    fireEvent.click(create())
    fireEvent.click(screen.getByRole('button', { name: text.yes }))
    await waitFor(() => expect(screen.getByText(text.created('AUR-8'))).toBeTruthy())
    expect(createTickets).toHaveBeenCalledWith('p-1', 'run-1', ['A', 'B'], 'AUR')
    expect(screen.getByText(text.refused)).toBeTruthy()
  })

  it('says why when the tickets cannot be read or created', async () => {
    const missingTickets = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, code: 'source_not_configured' })
      .mockResolvedValue(ok({ site: 'contoso', projectKey: 'AUR', tickets: [ticket('A')] }))
    const createTickets = vi.fn(async () => ({
      ok: false as const,
      code: 'secret_missing' as const,
    }))
    render(<MissingTickets api={{ missingTickets, createTickets }} projectId="p-1" runId="run-1" />)
    fireEvent.click(screen.getByRole('button', { name: text.open }))
    await waitFor(() => expect(screen.getByText(errorText('source_not_configured'))).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: text.open }))
    fireEvent.click(await screen.findByRole('button', { name: text.create(1) }))
    fireEvent.click(screen.getByRole('button', { name: text.yes }))
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe(errorText('secret_missing')),
    )
  })
})
