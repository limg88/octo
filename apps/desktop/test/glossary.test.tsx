// @vitest-environment jsdom
import type { Glossary, Project } from '@octo/domain'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { GlossarySection } from '../src/renderer/GlossarySection.tsx'
import { errorText, messages } from '../src/renderer/messages.ts'
import type { Result } from '../src/shared/api.ts'

const ok = <T,>(value: T): Result<T> => ({ ok: true, value })
const project: Project = { id: 'p-1', name: 'Aurora', folder: '/progetti/Aurora', addedAt: '' }
const text = messages.glossary
const kept: Glossary = { entries: [{ heard: 'dim', right: 'DEEM' }], proposed: [] }
const field = (column: string, row: number) =>
  screen.getByLabelText<HTMLInputElement>(text.cell(column, row))

afterEach(cleanup)

describe('the glossary of a project, in its settings', () => {
  it('shows the pairs kept, saves what is typed, and takes or drops what Claude proposes', async () => {
    const proposal = { heard: 'aurora uan', right: 'Aurora ONE' }
    const api = {
      glossary: vi.fn(async () => ok(kept)),
      saveGlossary: vi.fn(async (_id: string, glossary: Glossary) => ok(glossary)),
      proposeGlossary: vi
        .fn()
        .mockResolvedValueOnce({ ok: false, code: 'agent_not_installed' })
        .mockResolvedValue(
          ok({ ...kept, proposed: [proposal, { heard: 'esse a elle', right: 'SAL' }] }),
        ),
    }
    render(<GlossarySection api={api} project={project} />)
    await waitFor(() => expect(field(text.heard, 1).value).toBe('dim'))
    fireEvent.change(field(text.right, 1), { target: { value: 'Deem' } })
    fireEvent.click(screen.getByRole('button', { name: text.save }))
    await waitFor(() =>
      expect(api.saveGlossary).toHaveBeenCalledWith('p-1', {
        entries: [{ heard: 'dim', right: 'Deem' }],
        proposed: [],
      }),
    )
    // Claude is asked on request; a refusal is explained, and nothing it proposes is applied.
    fireEvent.click(screen.getByRole('button', { name: text.propose }))
    expect(await screen.findByText(errorText('agent_not_installed'))).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: text.propose }))
    const proposed = await screen.findByRole('list', { name: text.proposed })
    expect(proposed.textContent).toContain(text.pair('aurora uan', 'Aurora ONE'))
    expect(api.saveGlossary).toHaveBeenCalledTimes(1)
    // One is taken into the glossary, the other dropped.
    fireEvent.click(screen.getByRole('button', { name: text.acceptOf('aurora uan') }))
    await waitFor(() =>
      expect(api.saveGlossary).toHaveBeenLastCalledWith('p-1', {
        entries: [{ heard: 'dim', right: 'DEEM' }, proposal],
        proposed: [{ heard: 'esse a elle', right: 'SAL' }],
      }),
    )
    fireEvent.click(await screen.findByRole('button', { name: text.dismissOf('esse a elle') }))
    await waitFor(() => expect(screen.queryByRole('list', { name: text.proposed })).toBeNull())
  })

  it('says why it cannot read the glossary', async () => {
    const api = {
      glossary: vi.fn(async () => ({ ok: false as const, code: 'unexpected' as const })),
      saveGlossary: vi.fn(),
      proposeGlossary: vi.fn(),
    }
    render(<GlossarySection api={api} project={project} />)
    expect(await screen.findByText(errorText('unexpected'))).toBeTruthy()
  })
})
