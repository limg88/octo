// @vitest-environment jsdom
import { DEFAULT_MODEL_SETTINGS, type ModelSettings, type Project } from '@octo/domain'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ModelsSection } from '../src/renderer/ModelsSection.tsx'
import { messages } from '../src/renderer/messages.ts'
import type { OctoApi, Result } from '../src/shared/api.ts'

const ok = <T,>(value: T): Result<T> => ({ ok: true, value })
const project: Project = { id: 'p-1', name: 'Aurora', folder: '/progetti/Aurora', addedAt: '' }
const text = messages.models
type Api = Pick<OctoApi, 'modelSettings' | 'saveModelSettings'>

afterEach(cleanup)

describe('the models of a project', () => {
  it('shows the choice of each task and saves what the PM changes', async () => {
    const api: Api = {
      modelSettings: vi.fn(async () =>
        ok<ModelSettings>({ ...DEFAULT_MODEL_SETTINGS, ask: 'haiku' }),
      ),
      saveModelSettings: vi.fn(async (_id: string, settings: ModelSettings) => ok(settings)),
    }
    render(<ModelsSection api={api} project={project} />)
    const select = (label: string) => screen.findByLabelText<HTMLSelectElement>(label)
    expect((await select(text.task.ask)).value).toBe('haiku')
    expect((await select(text.task.write)).value).toBe('')

    fireEvent.change(await select(text.task.write), { target: { value: 'opus' } })
    fireEvent.change(await select(text.task.ask), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: text.save }))

    await waitFor(() =>
      expect(api.saveModelSettings).toHaveBeenCalledWith('p-1', {
        ask: null,
        write: 'opus',
        review: null,
      }),
    )
    expect(await screen.findByText(text.saved)).toBeTruthy()
    // A change after saving is not yet saved: the note goes away.
    fireEvent.change(await select(text.task.review), { target: { value: 'sonnet' } })
    expect(screen.queryByText(text.saved)).toBeNull()
  })

  it('explains a failure to read or to save', async () => {
    const failing: Api = {
      modelSettings: vi.fn(async () => ({
        ok: false as const,
        code: 'project_not_found' as const,
      })),
      saveModelSettings: vi.fn(),
    }
    render(<ModelsSection api={failing} project={project} />)
    expect((await screen.findByRole('alert')).textContent).toMatch(/non è più in elenco/)
    cleanup()
    const unsaved: Api = {
      modelSettings: vi.fn(async () => ok(DEFAULT_MODEL_SETTINGS)),
      saveModelSettings: vi.fn(async () => ({
        ok: false as const,
        code: 'project_not_found' as const,
      })),
    }
    render(<ModelsSection api={unsaved} project={project} />)
    fireEvent.click(await screen.findByRole('button', { name: text.save }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/non è più in elenco/)
  })

  it('names the models that worked, once when they are the same', () => {
    expect(text.used('claude-fable-5-2')).toBe('modello claude-fable-5-2')
    expect(text.wroteAndReviewed('a', 'a')).toBe('modello a')
    expect(text.wroteAndReviewed('a', null)).toBe('modello a')
    expect(text.wroteAndReviewed('a', 'b')).toBe('scritto da a, riletto da b')
  })
})
