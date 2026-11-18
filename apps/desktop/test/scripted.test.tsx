// @vitest-environment jsdom
import type { ScriptedCorrection, ScriptedRun, ScriptedSummary } from '@octo/application'
import type { Project } from '@octo/domain'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { errorText, messages } from '../src/renderer/messages.ts'
import { ScriptedDeliverables } from '../src/renderer/ScriptedDeliverables.tsx'
import type { OctoApi, Result } from '../src/shared/api.ts'

const project: Project = { id: 'p-1', name: 'Aurora', folder: '/progetti/Aurora', addedAt: '' }
const ok = <T,>(value: T): Result<T> => ({ ok: true, value })
const text = messages.scripted

const form: ScriptedSummary = {
  slug: 'avanzamento',
  title: 'Modulo di avanzamento',
  about: 'Il modulo del cliente.',
  parameters: [{ name: 'richiesta', label: 'Numero della richiesta' }],
  installed: true,
}
const shipped: ScriptedSummary = {
  slug: 'allineamento',
  title: 'Allineamento dello sprint',
  about: 'Le voci del cliente e i ticket.',
  parameters: [],
  installed: false,
}
const run: ScriptedRun = {
  runId: 'run-1',
  ok: true,
  messages: ['Richiesta 2: chiesto fin qui 340.000,00.'],
  files: ['Richiesta - 2.xlsx', 'quote.csv'],
}
const correction: ScriptedCorrection = {
  runId: 'run-2',
  ok: true,
  messages: ['Richiesta 3: chiesto fin qui 352.000,00.'],
  files: [],
  summary: 'Ho aggiunto la richiesta 3.',
  changed: [{ name: 'config.json', text: '{"requests": 3}' }],
}

type Api = Pick<
  OctoApi,
  | 'scriptedDeliverables'
  | 'installScripted'
  | 'runScripted'
  | 'keepScripted'
  | 'correctScripted'
  | 'approveScripted'
  | 'onDeliverableProgress'
>
function fakeApi(overrides: Partial<Api> = {}) {
  let tell: Parameters<Api['onDeliverableProgress']>[0] = () => {}
  const api: Api = {
    scriptedDeliverables: vi.fn(async () => ok([form, shipped])),
    installScripted: vi.fn(async () => ok([form, { ...shipped, installed: true }])),
    runScripted: vi.fn(async () => ok(run)),
    keepScripted: vi.fn(async () => ok({ folder: '_octo/deliverable/avanzamento', files: [] })),
    correctScripted: vi.fn(async () => ok(correction)),
    approveScripted: vi.fn(async () => ok(null)),
    onDeliverableProgress: (listener) => {
      tell = listener
      return () => {}
    },
    ...overrides,
  }
  return { api, tell: (projectId: string) => tell(projectId, { kind: 'computing', target: '' }) }
}
const box = (title: string) => screen.getByRole('region', { name: title })

afterEach(cleanup)

describe('the deliverables of the project made by a script', () => {
  it('starts in the project one the app ships, and says nothing where there is none', async () => {
    const { api } = fakeApi()
    render(<ScriptedDeliverables api={api} project={project} />)
    expect(await screen.findByRole('heading', { name: text.title })).toBeTruthy()
    expect(screen.getByText(shipped.about)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: text.install }))
    await waitFor(() => expect(api.installScripted).toHaveBeenCalledWith('p-1', 'allineamento'))
    // Once of the project it can be run: the button to add it is gone.
    expect(await screen.findByRole('region', { name: shipped.title })).toBeTruthy()
    expect(screen.queryByRole('button', { name: text.install })).toBeNull()
    cleanup()
    const none = fakeApi({ scriptedDeliverables: vi.fn(async () => ok([])) })
    const { container } = render(<ScriptedDeliverables api={none.api} project={project} />)
    await waitFor(() => expect(none.api.scriptedDeliverables).toHaveBeenCalled())
    expect(container.textContent).toBe('')
  })

  it('runs with what the PM typed, says what the script said, and keeps the files only when told', async () => {
    const { api, tell } = fakeApi()
    render(<ScriptedDeliverables api={api} project={project} />)
    const within1 = within(await screen.findByRole('region', { name: form.title }))
    fireEvent.change(within1.getByLabelText('Numero della richiesta'), { target: { value: '2' } })
    fireEvent.click(within1.getByRole('button', { name: text.run }))
    // What Claude is doing is said while it works, for this project only.
    act(() => tell('p-2'))
    expect(screen.queryByText(messages_computing())).toBeNull()
    act(() => tell('p-1'))
    expect(screen.getByText(messages_computing())).toBeTruthy()
    await waitFor(() =>
      expect(api.runScripted).toHaveBeenCalledWith('p-1', 'avanzamento', { richiesta: '2' }),
    )
    expect(await within1.findByText(run.messages[0] ?? '')).toBeTruthy()
    expect(within1.getByText(text.files('Richiesta - 2.xlsx, quote.csv'))).toBeTruthy()
    expect(api.keepScripted).not.toHaveBeenCalled()
    fireEvent.click(within1.getByRole('button', { name: text.keep }))
    expect(await within1.findByText(text.kept('_octo/deliverable/avanzamento'))).toBeTruthy()
    expect(api.keepScripted).toHaveBeenCalledWith('p-1', 'avanzamento', 'run-1')
    expect(within1.queryByRole('button', { name: text.keep })).toBeNull()
  })

  it('says what stopped a script, and why a run could not be had', async () => {
    const stopped = { ...run, ok: false, messages: ['La richiesta 3 supera il totale.'], files: [] }
    const { api } = fakeApi({ runScripted: vi.fn(async () => ok(stopped)) })
    render(<ScriptedDeliverables api={api} project={project} />)
    fireEvent.click(
      within(await screen.findByRole('region', { name: form.title })).getByRole('button', {
        name: text.run,
      }),
    )
    expect((await within(box(form.title)).findByRole('alert')).textContent).toBe(
      stopped.messages[0],
    )
    expect(within(box(form.title)).queryByRole('button', { name: text.keep })).toBeNull()
    cleanup()
    const refused = { ok: false as const, code: 'fence_unavailable' as const }
    const failing = fakeApi({ runScripted: vi.fn(async () => refused) })
    render(<ScriptedDeliverables api={failing.api} project={project} />)
    fireEvent.click(
      within(await screen.findByRole('region', { name: form.title })).getByRole('button', {
        name: text.run,
      }),
    )
    expect((await within(box(form.title)).findByRole('alert')).textContent).toBe(
      errorText('fence_unavailable'),
    )
  })

  it('corrects in words, shows what changed, and writes it in the project only when approved', async () => {
    const { api } = fakeApi()
    render(<ScriptedDeliverables api={api} project={project} />)
    const inside = within(await screen.findByRole('region', { name: form.title }))
    const field = inside.getByLabelText(text.correctLabel(form.title))
    const attempt = inside.getByRole('button', { name: text.tryCorrection }) as HTMLButtonElement
    expect(attempt.disabled).toBe(true)
    fireEvent.change(field, { target: { value: 'Aggiungi la richiesta 3' } })
    fireEvent.click(attempt)
    await waitFor(() =>
      expect(api.correctScripted).toHaveBeenCalledWith(
        'p-1',
        'avanzamento',
        'Aggiungi la richiesta 3',
      ),
    )
    const proposed = within(await screen.findByRole('region', { name: text.correctionTitle }))
    expect(proposed.getByText(correction.summary)).toBeTruthy()
    expect(proposed.getByText(text.changed('config.json'))).toBeTruthy()
    // The file as it would be in the project is there to read before approving.
    expect(proposed.getByText(text.seeFile('config.json'))).toBeTruthy()
    expect(proposed.getByText('{"requests": 3}')).toBeTruthy()
    expect(proposed.getByText(correction.messages[0] ?? '')).toBeTruthy()
    expect(api.approveScripted).not.toHaveBeenCalled()
    fireEvent.click(proposed.getByRole('button', { name: text.approve }))
    expect(await proposed.findByText(text.approved)).toBeTruthy()
    expect(api.approveScripted).toHaveBeenCalledWith('p-1', 'avanzamento', 'run-2')
    cleanup()
    // A correction that changed nothing has nothing to approve.
    const idle = fakeApi({ correctScripted: vi.fn(async () => ok({ ...correction, changed: [] })) })
    render(<ScriptedDeliverables api={idle.api} project={project} />)
    const again = within(await screen.findByRole('region', { name: form.title }))
    fireEvent.change(again.getByLabelText(text.correctLabel(form.title)), {
      target: { value: 'x' },
    })
    fireEvent.click(again.getByRole('button', { name: text.tryCorrection }))
    expect(await screen.findByText(text.nothingChanged)).toBeTruthy()
    expect(screen.queryByRole('button', { name: text.approve })).toBeNull()
  })
})

/** What the page says while Claude runs a command. */
function messages_computing(): string {
  return 'Calcolo'
}
