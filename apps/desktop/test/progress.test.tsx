// @vitest-environment jsdom
import type { ProgressView as View } from '@octo/application'
import { DEFAULT_PROGRESS_SETTINGS, type ProgressSettings, type Project } from '@octo/domain'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { messages } from '../src/renderer/messages.ts'
import { ProgressView } from '../src/renderer/ProgressView.tsx'
import {
  fieldLines,
  fieldsOf,
  listOf,
  positionLines,
  positionsOf,
  tableLine,
  tableOf,
} from '../src/renderer/progress-text.ts'
import type { OctoApi, Result } from '../src/shared/api.ts'

const project: Project = { id: 'p-1', name: 'Aurora', folder: '/progetti/Aurora', addedAt: '' }
const ok = <T,>(value: T): Result<T> => ({ ok: true, value })
const text = messages.progress

const first = {
  n: 1,
  from: '2026-03-01',
  to: '2026-03-31',
  amount: 700,
  note: 'Fattura 1',
  positions: [],
}
const second = { n: 2, from: '2026-03-31', to: '', amount: 300, note: '', positions: ['2'] }
const configured: ProgressSettings = {
  modelPath: 'Moduli/Richiesta SAL.xlsx',
  order: 'ORD-77',
  total: 1000,
  positions: [
    { code: '1', amount: 600 },
    { code: '2', amount: 400 },
  ],
  requests: [first, second],
  form: {
    fields: [{ ref: 'D2', text: '{n}' }],
    table: { firstRow: 14, rows: 6, position: 'A', previous: 'B', current: 'C', period: 'D' },
  },
}
const view: View = {
  computation: {
    ok: true,
    total: 1000,
    steps: [
      {
        request: first,
        cumulative: 700,
        closing: false,
        previous: [0, 0],
        current: [1, 0.2512],
        period: [1, 0.2512],
        rebuilt: 700.48,
      },
      {
        request: second,
        cumulative: 1000,
        closing: true,
        previous: [1, 0.2512],
        current: [1, 1],
        period: [0, 0.7488],
        rebuilt: 1000,
      },
    ],
  },
  warnings: [
    { kind: 'total_differs', declared: 900, positions: 1000 },
    { kind: 'dates_missing', n: 2 },
    { kind: 'dates_not_chained', n: 2 },
    { kind: 'note_missing', n: 2 },
  ],
}

type Api = Pick<
  OctoApi,
  | 'progressSettings'
  | 'saveProgressSettings'
  | 'progressCandidates'
  | 'progressView'
  | 'compileProgress'
  | 'openEvidence'
>

function fakeApi(overrides: Partial<Api> = {}) {
  const api: Api = {
    progressSettings: vi.fn(async () => ok(configured)),
    saveProgressSettings: vi.fn(async (_id: string, settings: ProgressSettings) => ok(settings)),
    progressCandidates: vi.fn(async () => ok(['Moduli/Richiesta SAL.xlsx'])),
    progressView: vi.fn(async () => ok(view)),
    compileProgress: vi.fn(async (_id: string, n: number) =>
      ok({ n, path: `_octo/avanzamento/Richiesta SAL - ${n}.xlsx` }),
    ),
    openEvidence: vi.fn(async () => ok(null)),
    ...overrides,
  }
  return api
}

afterEach(cleanup)

describe('what the PM types for a progress request', () => {
  it('reads positions, the map of the form and its table, and writes them back', () => {
    const positions = positionsOf('00001; 100.000,50\n\nsenza importo\n; 5\n00002; 60000')
    expect(positions).toEqual([
      { code: '00001', amount: 100000.5 },
      { code: '00002', amount: 60000 },
    ])
    expect(positionLines(positions)).toBe('00001; 100000,5\n00002; 60000')
    const fields = fieldsOf('D2 = {n}\nA10 = Oggetto = DEEM\nsenza uguale')
    expect(fields).toEqual([
      { ref: 'D2', text: '{n}' },
      { ref: 'A10', text: 'Oggetto = DEEM' },
    ])
    expect(fieldLines(fields)).toBe('D2 = {n}\nA10 = Oggetto = DEEM')
    const table = tableOf('14; 6; A; B; C; D')
    expect(table).toEqual({
      firstRow: 14,
      rows: 6,
      position: 'A',
      previous: 'B',
      current: 'C',
      period: 'D',
    })
    expect(tableLine(table)).toBe('14; 6; A; B; C; D')
    expect(tableOf('14; 6; A')).toBeNull()
    expect(tableLine(null)).toBe('')
    expect(listOf(' 1, ,2 ')).toEqual(['1', '2'])
  })
})

describe('progress requests', () => {
  it('shows the shares of each request with what to look at', async () => {
    render(<ProgressView api={fakeApi()} project={project} />)
    const one = await screen.findByRole('region', { name: text.requestN(1) })
    expect(within(one).getByText('25,12%', { selector: 'td:nth-child(4)' })).toBeTruthy()
    expect(within(one).getByText(/700,00, in tutto 700,00 su 1\.000,00/)).toBeTruthy()
    expect(within(one).getByText(text.drift('0,48'))).toBeTruthy()
    const two = screen.getByRole('region', { name: text.requestN(2) })
    expect(within(two).getByText(text.closing)).toBeTruthy()
    expect(within(two).getByText('74,88%')).toBeTruthy()
    expect(within(two).queryByText(/ricostruiscono/)).toBeNull()
    expect(within(two).getByText(/al …/)).toBeTruthy()
    expect(screen.getByText(text.warning.total_differs('900,00', '1.000,00'))).toBeTruthy()
    expect(screen.getByText(text.warning.dates_missing(2))).toBeTruthy()
    expect(screen.getByText(text.warning.dates_not_chained(2))).toBeTruthy()
    expect(screen.getByText(text.warning.note_missing(2))).toBeTruthy()
  })

  it.each([
    [{ kind: 'no_positions' as const }, text.problem.no_positions],
    [{ kind: 'over_total' as const, n: 2, excess: 0.5 }, text.problem.over_total(2, '0,50')],
    [
      { kind: 'unknown_positions' as const, n: 1, codes: ['9', '8'] },
      text.problem.unknown_positions(1, '9, 8'),
    ],
    [
      { kind: 'over_positions' as const, n: 1, excess: 2000 },
      text.problem.over_positions(1, '2.000,00'),
    ],
  ])('says what makes the requests impossible: %o', async (problem, message) => {
    const broken: View = { computation: { ok: false, total: 1000, problem }, warnings: [] }
    render(
      <ProgressView
        api={fakeApi({ progressView: vi.fn(async () => ok(broken)) })}
        project={project}
      />,
    )
    expect((await screen.findByRole('alert')).textContent).toBe(message)
  })

  it('says when there is no request yet', async () => {
    const empty: View = { computation: { ok: true, total: 1000, steps: [] }, warnings: [] }
    render(
      <ProgressView
        api={fakeApi({ progressView: vi.fn(async () => ok(empty)) })}
        project={project}
      />,
    )
    expect(await screen.findByText(text.noRequests)).toBeTruthy()
  })

  it('writes the form of a request and opens it', async () => {
    const api = fakeApi()
    render(<ProgressView api={api} project={project} />)
    fireEvent.click(await screen.findByRole('button', { name: text.compile(2) }))
    const path = '_octo/avanzamento/Richiesta SAL - 2.xlsx'
    const two = screen.getByRole('region', { name: text.requestN(2) })
    expect(await within(two).findByText(new RegExp(path))).toBeTruthy()
    expect(api.compileProgress).toHaveBeenCalledWith('p-1', 2)
    fireEvent.click(screen.getByRole('button', { name: text.open }))
    expect(api.openEvidence).toHaveBeenCalledWith('p-1', path)
  })

  it('says why a form could not be written', async () => {
    const api = fakeApi({
      compileProgress: vi.fn(async () => ({
        ok: false as const,
        code: 'progress_model_invalid' as const,
      })),
    })
    render(<ProgressView api={api} project={project} />)
    fireEvent.click(await screen.findByRole('button', { name: text.compile(1) }))
    expect((await screen.findByRole('alert')).textContent).toMatch(
      /Non riesco a scrivere nel modulo/,
    )
  })

  it('starts from the order, proposing the only form found, and saves what is typed', async () => {
    const api = fakeApi({ progressSettings: vi.fn(async () => ok(DEFAULT_PROGRESS_SETTINGS)) })
    render(<ProgressView api={api} project={project} />)
    const model = (await screen.findByLabelText(text.modelPath)) as HTMLInputElement
    await waitFor(() => expect(model.value).toBe('Moduli/Richiesta SAL.xlsx'))
    const type = (label: string, value: string) =>
      fireEvent.change(screen.getByLabelText(label), { target: { value } })
    type(text.order, 'ORD-77')
    type(text.total, '1.000')
    type(text.positions, '1; 600\n2; 400')
    fireEvent.click(screen.getByRole('button', { name: text.addRequest }))
    fireEvent.click(screen.getByRole('button', { name: text.addRequest }))
    fireEvent.click(screen.getByRole('button', { name: text.addRequest }))
    const group = (n: number) => within(screen.getByRole('group', { name: text.requestN(n) }))
    const fill = (n: number, label: string, value: string) =>
      fireEvent.change(group(n).getByLabelText(label), { target: { value } })
    fill(1, text.from, '2026-03-01')
    fill(1, text.to, '2026-03-31')
    fill(1, text.amount, '700')
    fill(1, text.note, 'Fattura 1')
    fill(2, text.amount, 'abc')
    fill(3, text.amount, '300')
    fill(3, text.requestPositions, '2, 1')
    fireEvent.click(screen.getByRole('button', { name: text.removeRequest(2) }))
    // The request added after the first one starts where that one ends.
    fireEvent.click(screen.getByRole('button', { name: text.addRequest }))
    expect((group(3).getByLabelText(text.from) as HTMLInputElement).value).toBe('')
    fireEvent.click(screen.getByRole('button', { name: text.removeRequest(3) }))
    type(text.fields, 'D2 = {n}')
    type(text.table, '14; 6; A; B; C; D')
    fireEvent.click(screen.getByRole('button', { name: text.save }))
    await waitFor(() => expect(api.saveProgressSettings).toHaveBeenCalled())
    expect(api.saveProgressSettings).toHaveBeenCalledWith('p-1', {
      modelPath: 'Moduli/Richiesta SAL.xlsx',
      order: 'ORD-77',
      total: 1000,
      positions: configured.positions,
      requests: [first, { n: 2, from: '', to: '', amount: 300, note: '', positions: ['2', '1'] }],
      form: configured.form,
    })
  })

  it('keeps the form empty when more than one could be it, and shows a failed save', async () => {
    const api = fakeApi({
      progressSettings: vi.fn(async () => ok(DEFAULT_PROGRESS_SETTINGS)),
      progressCandidates: vi.fn(async () => ok(['a.xlsx', 'b.xlsx'])),
      saveProgressSettings: vi.fn(async () => ({
        ok: false as const,
        code: 'progress_settings_invalid' as const,
      })),
    })
    render(<ProgressView api={api} project={project} />)
    const model = (await screen.findByLabelText(text.modelPath)) as HTMLInputElement
    await waitFor(() => expect(api.progressCandidates).toHaveBeenCalled())
    expect(model.value).toBe('')
    fireEvent.click(screen.getByRole('button', { name: text.save }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/cartella del progetto/)
  })

  it('shows why the settings or the shares cannot be read', async () => {
    const failing = { ok: false as const, code: 'progress_settings_invalid' as const }
    render(
      <ProgressView
        api={fakeApi({ progressSettings: vi.fn(async () => failing) })}
        project={project}
      />,
    )
    expect((await screen.findByRole('alert')).textContent).toMatch(/non sono valide/)
    cleanup()
    render(
      <ProgressView
        api={fakeApi({ progressView: vi.fn(async () => failing) })}
        project={project}
      />,
    )
    expect((await screen.findByRole('alert')).textContent).toMatch(/non sono valide/)
  })
})
