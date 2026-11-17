// @vitest-environment jsdom
import type { ProgressView as View } from '@octo/application'
import {
  DEFAULT_PROGRESS_SETTINGS,
  type Lifetime,
  type ProgressSettings,
  type Project,
} from '@octo/domain'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { messages } from '../src/renderer/messages.ts'
import { ProgressView } from '../src/renderer/ProgressView.tsx'
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
  salesOrders: [],
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
  invoices: null,
}

type Api = Pick<
  OctoApi,
  | 'chooseProjectPath'
  | 'progressSettings'
  | 'saveProgressSettings'
  | 'progressCandidates'
  | 'progressView'
  | 'compileProgress'
  | 'registerProgressInvoices'
  | 'openEvidence'
  | 'forecastLifetime'
>

function fakeApi(overrides: Partial<Api> = {}) {
  const api: Api = {
    chooseProjectPath: vi.fn(async () => ok<string | null>('scelto/qui')),
    forecastLifetime: vi.fn(async () => ok<Lifetime[]>([])),
    progressSettings: vi.fn(async () => ok(configured)),
    saveProgressSettings: vi.fn(async (_id: string, settings: ProgressSettings) => ok(settings)),
    progressCandidates: vi.fn(async () => ok(['Moduli/Richiesta SAL.xlsx'])),
    progressView: vi.fn(async () => ok(view)),
    compileProgress: vi.fn(async (_id: string, n: number) =>
      ok({ n, path: `_octo/avanzamento/Richiesta SAL - ${n}.xlsx` }),
    ),
    registerProgressInvoices: vi.fn(async () => ok(configured)),
    openEvidence: vi.fn(async () => ok(null)),
    ...overrides,
  }
  return api
}

afterEach(cleanup)

const onlyFirst: ProgressSettings = { ...configured, requests: [first] }
const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
const press = (name: string) => fireEvent.click(screen.getByRole('button', { name }))

describe('the requests of an order', () => {
  it('shows the order at a glance and the shares of each request with what to look at', async () => {
    render(<ProgressView api={fakeApi()} project={project} />)
    const order = await screen.findByRole('region', { name: text.orderName('ORD-77') })
    expect(within(order).getAllByText('1.000,00')).toHaveLength(2)
    expect(within(order).getByText('0,00')).toBeTruthy()
    const one = screen.getByRole('region', { name: text.requestN(1) })
    expect(within(one).getByText('25,12%', { selector: 'td:nth-child(4)' })).toBeTruthy()
    expect(within(one).getByText(text.drift('0,48'))).toBeTruthy()
    expect(screen.getByText(/700,00, in tutto 700,00 su 1\.000,00/)).toBeTruthy()
    const two = screen.getByRole('region', { name: text.requestN(2) })
    expect(within(two).getByText(text.closing)).toBeTruthy()
    expect(within(two).getByText('74,88%')).toBeTruthy()
    expect(within(two).queryByText(/ricostruiscono/)).toBeNull()
    expect(screen.getByText(/al …/)).toBeTruthy()
    // What is about the whole order is said once; what is about a request, inside it.
    expect(screen.getByText(text.warning.total_differs('900,00', '1.000,00'))).toBeTruthy()
    expect(within(two).getByText(text.warning.dates_missing(2))).toBeTruthy()
    expect(within(two).getByText(text.warning.dates_not_chained(2))).toBeTruthy()
    expect(within(two).getByText(text.warning.note_missing(2))).toBeTruthy()
    // Only the latest request is the main action, and only it can be taken off.
    expect(screen.getByRole('button', { name: text.compile(2) }).className).toBe('primary')
    expect(screen.getByRole('button', { name: text.compile(1) }).className).toBe('')
    expect(screen.queryByRole('button', { name: text.removeN(1) })).toBeNull()
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
    const broken: View = {
      computation: { ok: false, total: 1000, problem },
      warnings: [],
      invoices: null,
    }
    render(
      <ProgressView
        api={fakeApi({ progressView: vi.fn(async () => ok(broken)) })}
        project={project}
      />,
    )
    expect((await screen.findByRole('alert')).textContent).toBe(message)
    // The requests are still there to be corrected, without shares to show or a form to fill.
    expect(screen.getByRole('button', { name: text.correctN(1) })).toBeTruthy()
    expect(screen.queryByRole('button', { name: text.compile(1) })).toBeNull()
  })

  it('says when there is no request yet', async () => {
    const empty: View = {
      computation: { ok: true, total: 1000, steps: [] },
      warnings: [],
      invoices: null,
    }
    const api = fakeApi({
      progressSettings: vi.fn(async () => ok({ ...configured, order: '', requests: [] })),
      progressView: vi.fn(async () => ok(empty)),
    })
    render(<ProgressView api={api} project={project} />)
    expect(await screen.findByText(text.noRequests)).toBeTruthy()
    expect(screen.getByRole('region', { name: text.orderName('') })).toBeTruthy()
  })

  it('writes the form of a request and opens it', async () => {
    const api = fakeApi()
    render(<ProgressView api={api} project={project} />)
    fireEvent.click(await screen.findByRole('button', { name: text.compile(2) }))
    const path = '_octo/avanzamento/Richiesta SAL - 2.xlsx'
    const two = screen.getByRole('region', { name: text.requestN(2) })
    expect(await within(two).findByText(new RegExp(path))).toBeTruthy()
    expect(api.compileProgress).toHaveBeenCalledWith('p-1', 2)
    press(text.open)
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

  it('adds a request with its shares shown while typing, saves it and fills its form', async () => {
    const api = fakeApi({ progressSettings: vi.fn(async () => ok(onlyFirst)) })
    render(<ProgressView api={api} project={project} />)
    fireEvent.click(await screen.findByRole('button', { name: text.newRequest }))
    const form = screen.getByRole('form', { name: text.request.titleNew(2) })
    // It starts where the request before ends, and shows nothing until there is an amount.
    expect((within(form).getByLabelText(text.from) as HTMLInputElement).value).toBe('2026-03-31')
    expect(within(form).getByText(text.request.previewNone)).toBeTruthy()
    expect(within(form).queryByText(text.request.laterRecomputed)).toBeNull()

    // Nothing typed, or something that is not an amount, is refused under the field.
    press(text.request.saveOnly)
    expect(within(form).getByRole('alert').textContent).toBe(messages.amountWrong)
    type(text.request.amount, 'tanto')
    expect(within(form).getByRole('alert').textContent).toBe(messages.amountWrong)
    // More than what is left is said while typing, and not saved.
    type(text.request.amount, '5.000')
    expect(within(form).getByRole('alert').textContent).toBe(text.problem.over_total(2, '4.700,00'))
    press(text.request.saveAndCompile)
    expect(api.saveProgressSettings).not.toHaveBeenCalled()

    press(text.request.allLeft('300,00'))
    expect((within(form).getByLabelText(text.request.amount) as HTMLInputElement).value).toBe('300')
    expect(within(form).getByText(text.closing)).toBeTruthy()
    expect(within(form).getByText(text.warning.dates_missing(2))).toBeTruthy()
    type(text.to, '2026-04-30')
    type(text.request.note, 'Fattura 2')
    // Only on the positions ticked, kept in the order of the order.
    fireEvent.click(within(form).getByLabelText(text.request.chosen))
    fireEvent.click(within(form).getByLabelText(text.request.positionLeft('2', '300,00')))
    fireEvent.click(within(form).getByLabelText(text.request.positionLeft('1', '0,00')))
    fireEvent.click(within(form).getByLabelText(text.request.positionLeft('1', '0,00')))
    press(text.request.saveAndCompile)
    await waitFor(() => expect(api.compileProgress).toHaveBeenCalledWith('p-1', 2))
    expect(api.saveProgressSettings).toHaveBeenCalledWith('p-1', {
      ...onlyFirst,
      requests: [
        first,
        {
          n: 2,
          from: '2026-03-31',
          to: '2026-04-30',
          amount: 300,
          note: 'Fattura 2',
          positions: ['2'],
        },
      ],
    })
    expect(screen.queryByRole('form')).toBeNull()
  })

  it('corrects a request, saying that the later ones change, and can be left', async () => {
    const api = fakeApi()
    render(<ProgressView api={api} project={project} />)
    fireEvent.click(await screen.findByRole('button', { name: text.correctN(2) }))
    let form = screen.getByRole('form', { name: text.request.titleEdit(2) })
    // The positions the request names are ticked, and can be given up for the usual order.
    expect(
      (within(form).getByLabelText(text.request.positionLeft('2', '300,00')) as HTMLInputElement)
        .checked,
    ).toBe(true)
    fireEvent.click(within(form).getByLabelText(text.request.inOrder))
    press(text.request.saveOnly)
    await waitFor(() =>
      expect(api.saveProgressSettings).toHaveBeenCalledWith('p-1', {
        ...configured,
        requests: [first, { ...second, positions: [] }],
      }),
    )
    expect(api.compileProgress).not.toHaveBeenCalled()

    fireEvent.click(await screen.findByRole('button', { name: text.correctN(1) }))
    form = screen.getByRole('form', { name: text.request.titleEdit(1) })
    expect(within(form).getByText(text.request.laterRecomputed)).toBeTruthy()
    expect((within(form).getByLabelText(text.request.amount) as HTMLInputElement).value).toBe('700')
    press(messages.cancel)
    expect(screen.queryByRole('form')).toBeNull()
    expect(api.saveProgressSettings).toHaveBeenCalledTimes(1)
  })

  it('keeps the request open when the save fails', async () => {
    const api = fakeApi({
      progressSettings: vi.fn(async () => ok(onlyFirst)),
      saveProgressSettings: vi.fn(async () => ({
        ok: false as const,
        code: 'progress_settings_invalid' as const,
      })),
    })
    render(<ProgressView api={api} project={project} />)
    fireEvent.click(await screen.findByRole('button', { name: text.newRequest }))
    type(text.request.amount, '100')
    press(text.request.saveAndCompile)
    expect((await screen.findByRole('alert')).textContent).toMatch(/non sono valide/)
    expect(screen.getByRole('form', { name: text.request.titleNew(2) })).toBeTruthy()
    expect(api.compileProgress).not.toHaveBeenCalled()
  })

  it('takes off the latest request only after a confirmation', async () => {
    const api = fakeApi()
    render(<ProgressView api={api} project={project} />)
    fireEvent.click(await screen.findByRole('button', { name: text.removeN(2) }))
    expect(screen.getByText(text.removeConfirm(2))).toBeTruthy()
    press(messages.cancel)
    expect(screen.queryByText(text.removeConfirm(2))).toBeNull()
    press(text.removeN(2))
    press(text.remove)
    await waitFor(() => expect(api.saveProgressSettings).toHaveBeenCalledWith('p-1', onlyFirst))
  })
})

describe('the settings of the order and of the form', () => {
  it('asks for them the first time, proposing the only form found, and saves what is typed', async () => {
    const api = fakeApi({ progressSettings: vi.fn(async () => ok(DEFAULT_PROGRESS_SETTINGS)) })
    render(<ProgressView api={api} project={project} />)
    expect(await screen.findByText(text.setup.firstTime)).toBeTruthy()
    const model = screen.getByLabelText(text.setup.modelPath) as HTMLInputElement
    await waitFor(() => expect(model.value).toBe('Moduli/Richiesta SAL.xlsx'))
    expect(screen.getAllByText(text.setup.todo)).toHaveLength(3)
    expect(screen.queryByRole('button', { name: text.setup.close })).toBeNull()
    const setup = text.setup

    // What is not understood is told under its part, and nothing is saved.
    type(setup.cellN(1), 'Numero')
    type(setup.cellTextN(1), 'x')
    type(setup.firstRow, '14')
    type(setup.total, 'mille')
    type(setup.codeN(1), '1')
    press(setup.save)
    expect(screen.getByText(setup.cellWrong(1))).toBeTruthy()
    expect(screen.getByText(setup.tableWrong)).toBeTruthy()
    expect(screen.getByText(setup.positionWrong(1))).toBeTruthy()
    expect(screen.getByText(messages.amountWrong)).toBeTruthy()
    expect(screen.getByRole('status').textContent).toBe(messages.notSaved)
    expect(api.saveProgressSettings).not.toHaveBeenCalled()

    // A datum of the request is inserted with a button into the row last typed in.
    type(setup.cellN(1), 'd2')
    type(setup.cellTextN(1), '')
    press(setup.addCell)
    press(setup.addCell)
    type(setup.cellN(2), 'A4')
    type(setup.cellTextN(2), 'Fornitore')
    fireEvent.focus(screen.getByLabelText(setup.cellTextN(1)))
    press('Numero della richiesta')
    press(setup.removeCell(2))
    expect(screen.queryByLabelText(setup.cellN(3))).toBeNull()
    for (const [label, value] of [
      [setup.rows, '6'],
      [setup.position, 'a'],
      [setup.previous, 'B'],
      [setup.current, 'C'],
      [setup.period, 'D'],
      [setup.order, 'ORD-77'],
      [setup.total, '900'],
      [setup.amountN(1), '600'],
    ] as const) {
      type(label, value)
    }
    press(setup.addPosition)
    press(setup.addPosition)
    type(setup.codeN(2), '2')
    type(setup.amountN(2), '400')
    press(setup.removePosition(3))
    // The sum is shown while typing, and compared with the total written.
    expect(screen.getByText(setup.sumDiffers('1.000,00', '900,00'))).toBeTruthy()
    type(setup.total, '1.000')
    expect(screen.getByText(setup.sum('1.000,00'))).toBeTruthy()
    press(setup.save)
    await waitFor(() =>
      expect(api.saveProgressSettings).toHaveBeenCalledWith('p-1', {
        ...configured,
        requests: [],
      }),
    )
    // With the three things in place the page of the requests takes over.
    expect(await screen.findByRole('button', { name: text.newRequest })).toBeTruthy()
  })

  it('lets the path be typed when no form is found, and shows a failed save', async () => {
    const api = fakeApi({
      progressSettings: vi.fn(async () => ok(DEFAULT_PROGRESS_SETTINGS)),
      progressCandidates: vi.fn(async () => ok([])),
      saveProgressSettings: vi.fn(async () => ({
        ok: false as const,
        code: 'progress_settings_invalid' as const,
      })),
    })
    render(<ProgressView api={api} project={project} />)
    const model = (await screen.findByLabelText(text.setup.modelPath)) as HTMLInputElement
    await waitFor(() => expect(api.progressCandidates).toHaveBeenCalled())
    expect(model.value).toBe('')
    expect(screen.getByText(text.setup.modelNone)).toBeTruthy()
    type(text.setup.modelPath, '../fuori.xlsx')
    press(text.setup.save)
    expect((await screen.findByRole('alert')).textContent).toMatch(/cartella del progetto/)
  })

  it('opens from the page, shows what is saved and closes without saving', async () => {
    const api = fakeApi({
      progressSettings: vi.fn(async () => ok({ ...configured, modelPath: 'Altro/Modulo.xlsx' })),
      progressCandidates: vi.fn(async () => ok(['Moduli/Richiesta SAL.xlsx', 'Moduli/B.xlsx'])),
    })
    render(<ProgressView api={api} project={project} />)
    fireEvent.click(await screen.findByRole('button', { name: text.setup.open }))
    const form = screen.getByRole('form', { name: text.setup.title })
    expect(within(form).getAllByText(text.setup.done)).toHaveLength(3)
    // The form in use is kept as it is; another can be chosen from the dialog of the system.
    const model = within(form).getByLabelText(text.setup.modelPath) as HTMLInputElement
    expect(model.value).toBe('Altro/Modulo.xlsx')
    fireEvent.click(
      within(form).getByRole('button', {
        name: `${messages.choosePath}: ${text.setup.modelPath}`,
      }),
    )
    await waitFor(() => expect(model.value).toBe('scelto/qui'))
    expect(api.chooseProjectPath).toHaveBeenCalledWith('p-1', 'file', ['xlsx'])
    expect((screen.getByLabelText(text.setup.cellN(1)) as HTMLInputElement).value).toBe('D2')
    expect((screen.getByLabelText(text.setup.firstRow) as HTMLInputElement).value).toBe('14')
    expect((screen.getByLabelText(text.setup.amountN(2)) as HTMLInputElement).value).toBe('400')
    // A table left wholly empty is no table, and a list emptied keeps one row to type in.
    press(text.setup.removeCell(1))
    expect((screen.getByLabelText(text.setup.cellN(1)) as HTMLInputElement).value).toBe('')
    press(text.setup.close)
    expect(screen.queryByRole('form')).toBeNull()
    expect(api.saveProgressSettings).not.toHaveBeenCalled()
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

  describe('beside what the company system billed', () => {
    const words = text.invoices
    const invoice = {
      id: '2026/1',
      date: '2026-03-31',
      amount: 600,
      status: 'Open',
      salesOrder: 'SO-1',
    }
    const other = {
      id: '2026/7',
      date: '2026-04-30',
      amount: 55,
      status: 'Open',
      salesOrder: 'SO-1',
    }
    const empty: View = {
      computation: { ok: true, total: 1000, steps: [] },
      warnings: [],
      invoices: null,
    }
    const noRequests: ProgressSettings = { ...configured, requests: [] }
    const billed = (part: Partial<NonNullable<NonNullable<View['invoices']>['order']>>): View => ({
      ...empty,
      invoices: {
        salesOrders: ['SO-1', 'SO-2'],
        suggested: ['SO-1'],
        order: {
          invoices: [invoice, other],
          invoiced: 655,
          remaining: 345,
          positions: [
            { code: '1', amount: 600, invoice },
            { code: '2', amount: 400, invoice: null },
          ],
          unregistered: [invoice, other],
          fulfilled: false,
          ...part,
        },
      },
    })

    it('asks which sales orders are the order, proposing those billed for its amounts', async () => {
      const unlinked: View = {
        ...empty,
        invoices: { salesOrders: ['SO-1', 'SO-2'], suggested: ['SO-1'], order: null },
      }
      const api = fakeApi({
        progressSettings: vi.fn(async () => ok(noRequests)),
        progressView: vi.fn(async () => ok(unlinked)),
      })
      render(<ProgressView api={api} project={project} />)
      const netsuite = await screen.findByRole('region', { name: words.title })
      expect(within(netsuite).getByText(words.suggested('SO-1'))).toBeTruthy()
      expect(within(netsuite).getByLabelText<HTMLInputElement>('SO-1').checked).toBe(true)
      fireEvent.click(within(netsuite).getByLabelText('SO-2'))
      press(words.link)
      await waitFor(() =>
        expect(api.saveProgressSettings).toHaveBeenCalledWith('p-1', {
          ...noRequests,
          salesOrders: ['SO-1', 'SO-2'],
        }),
      )
    })

    it('shows what is billed for each position and takes unknown invoices as requests', async () => {
      const linked = { ...noRequests, salesOrders: ['SO-1'] }
      const api = fakeApi({
        progressSettings: vi.fn(async () => ok(linked)),
        progressView: vi.fn(async () => ok(billed({}))),
        registerProgressInvoices: vi.fn(async () => ok({ ...linked, requests: [first] })),
      })
      render(<ProgressView api={api} project={project} />)
      const order = await screen.findByRole('region', { name: text.orderName('ORD-77') })
      // The order counts what is billed, though nothing was asked through Octo.
      expect(within(order).getByText(words.billedTotal)).toBeTruthy()
      expect(within(order).getByText('655,00')).toBeTruthy()
      expect(within(order).getByText('345,00')).toBeTruthy()

      const netsuite = screen.getByRole('region', { name: words.title })
      expect(within(netsuite).getByText(words.billed)).toBeTruthy()
      expect(within(netsuite).getByText(words.notBilled)).toBeTruthy()
      expect(within(netsuite).getByText(words.unregistered(2, '2026/1, 2026/7'))).toBeTruthy()
      expect(
        within(netsuite).getByText(
          (content) => content.includes('fattura 2026/7') && content.includes('55,00'),
        ),
      ).toBeTruthy()
      press(words.register)
      await waitFor(() => expect(api.registerProgressInvoices).toHaveBeenCalledWith('p-1'))
      expect(await screen.findByRole('region', { name: text.requestN(1) })).toBeTruthy()

      // The link can be changed, or left as it is.
      press(words.change('SO-1'))
      press(messages.cancel)
      expect(within(netsuite).getByText(words.billed)).toBeTruthy()
    })

    it('says an order fulfilled and offers no new request, and says a failure', async () => {
      const linked = { ...configured, salesOrders: ['SO-1'] }
      const done = billed({ invoiced: 1000, remaining: 0, unregistered: [], fulfilled: true })
      const api = fakeApi({
        progressSettings: vi.fn(async () => ok(linked)),
        progressView: vi.fn(async () => ok(done)),
      })
      render(<ProgressView api={api} project={project} />)
      expect(await screen.findByText(words.fulfilled)).toBeTruthy()
      expect(screen.queryByRole('button', { name: text.newRequest })).toBeNull()
      expect(screen.queryByRole('button', { name: words.register })).toBeNull()
      cleanup()

      const failing = fakeApi({
        progressSettings: vi.fn(async () => ok(linked)),
        progressView: vi.fn(async () => ok(billed({ unregistered: [invoice] }))),
        registerProgressInvoices: vi.fn(async () => ({
          ok: false as const,
          code: 'progress_settings_invalid' as const,
        })),
      })
      render(<ProgressView api={failing} project={project} />)
      expect(await screen.findByText(words.unregistered(1, '2026/1'))).toBeTruthy()
      press(words.register)
      expect((await screen.findByRole('alert')).textContent).toMatch(/non sono valide/)
    })
  })
})

describe('the progress of a project sold at a fixed price', () => {
  const words = messages.progress.fixedPrice
  const code = (more: Partial<Lifetime>): Lifetime => ({
    code: 'AUR-01',
    description: 'Assessment Aurora',
    kind: 'fixed_price',
    through: '2026-11',
    ordered: 7500,
    invoiced: 2250,
    recognized: 5250,
    lines: [],
    hours: 0,
    costs: 0,
    estimatedHours: 0,
    estimatedCosts: 0,
    marginToDate: null,
    budgetCosts: null,
    proposedBudget: null,
    progress: null,
    expectedCosts: null,
    marginAtEnd: null,
    notApprovedHours: 0,
    unreadMonths: [],
    ...more,
  })
  const unset = { progressSettings: vi.fn(async () => ok(DEFAULT_PROGRESS_SETTINGS)) }

  it('is what NetSuite says of its invoices, with no form of the client asked for', async () => {
    const onOpenSection = vi.fn()
    const api = fakeApi({
      ...unset,
      forecastLifetime: vi.fn(async () =>
        ok([
          code({}),
          code({ code: 'AUR-02', description: '', invoiced: null, recognized: null }),
          // A code sold by the day is not told here.
          code({ code: 'AUR-03', kind: 'time_material' }),
        ]),
      ),
    })
    render(<ProgressView api={api} project={project} fixedPrice onOpenSection={onOpenSection} />)
    const table = await screen.findByRole('table', { name: words.title })
    expect(
      within(table)
        .getAllByRole('row')
        .map((row) => row.textContent),
    ).toEqual([
      `${words.code}${words.ordered}${words.invoiced}${words.toInvoice}${words.recognized}`,
      // The advance invoiced, what is left to invoice, the revenue recognised.
      'AUR-01Assessment Aurora7.500,002.250,00 (30%)5.250,00 (70%)5.250,00 (70%)',
      `AUR-027.500,00${words.unknown}${words.unknown}${words.unknown}`,
    ])
    expect(screen.getByText(words.intro)).toBeTruthy()
    expect(screen.getByText(words.notRead)).toBeTruthy()
    // Nothing of the form of the client: neither its model nor the positions of the order.
    expect(screen.queryByText(text.setup.firstTime)).toBeNull()
    fireEvent.click(
      screen.getByRole('button', { name: messages.openSection(messages.forecastTab) }),
    )
    expect(onOpenSection).toHaveBeenCalledWith('forecast')
    // A fixed price that has a form to fill all the same gets to it with one press.
    fireEvent.click(screen.getByRole('button', { name: words.useForm }))
    expect(await screen.findByText(text.setup.firstTime)).toBeTruthy()
  })

  it('says why NetSuite could not be asked, and leaves the form to who already set it', async () => {
    const failing = fakeApi({
      ...unset,
      forecastLifetime: vi.fn(async () => ({
        ok: false as const,
        code: 'forecast_timesheet_not_set' as const,
      })),
    })
    render(<ProgressView api={failing} project={project} fixedPrice />)
    expect((await screen.findByRole('alert')).textContent).toMatch(/timesheet/i)
    cleanup()
    // The form of the client is set: the page is the one of the requests, as before.
    const api = fakeApi()
    render(<ProgressView api={api} project={project} fixedPrice />)
    await screen.findAllByText(/SAL|Richiest/i)
    expect(api.forecastLifetime).not.toHaveBeenCalled()
    expect(screen.queryByRole('table', { name: words.title })).toBeNull()
  })
})
