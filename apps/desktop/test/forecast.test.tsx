// @vitest-environment jsdom
import type { ForecastView as View } from '@octo/application'
import {
  DEFAULT_FORECAST_SETTINGS,
  type ForecastSettings,
  NO_FORECAST_PROJECT,
  NO_ROW_INPUTS,
  type Project,
} from '@octo/domain'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ForecastView, previousMonthOf } from '../src/renderer/ForecastView.tsx'
import { amountField, amountOf, amountText } from '../src/renderer/forecast-text.ts'
import { messages } from '../src/renderer/messages.ts'
import type { OctoApi, Result } from '../src/shared/api.ts'

const project: Project = { id: 'p-1', name: 'Aurora', folder: '/progetti/Aurora', addedAt: '' }
const now = () => new Date('2026-07-10T10:00:00.000Z')
const ok = <T,>(value: T): Result<T> => ({ ok: true, value })
const text = messages.forecast

const configured: ForecastSettings = {
  ...DEFAULT_FORECAST_SETTINGS,
  modelPath: 'amministrazione/Previsionale.xlsx',
  rates: [{ person: 'Rossi Mario', code: null, ratePerDay: 400 }],
  months: { '2026-06': { P1: { ...NO_ROW_INPUTS, toInvoice: 12000 } } },
}

const values = {
  internalCosts: 3200,
  externalCosts: 750,
  revenue: 6400,
  quantity: 18.5,
  quantityIsShare: false,
  marginMonth: 0.3828,
  marginEnd: null,
  toInvoice: 12000,
}
const view: View = {
  modelPath: configured.modelPath,
  forecast: {
    month: '2026-06',
    rows: [
      {
        code: 'P1',
        description: 'Sviluppo',
        revenueKind: 'time_material',
        ordered: 100000,
        hours: 148,
        values,
        note: 'timesheet approvati',
        cells: {},
      },
      {
        code: 'P2',
        description: 'A corpo',
        revenueKind: 'fixed_price',
        ordered: 50000,
        hours: 0,
        values: { ...values, quantity: 0.125, quantityIsShare: true, marginEnd: 0.4 },
        note: 'avanzamento',
        cells: {},
      },
    ],
    gaps: [
      { kind: 'no_cost', code: 'P1', person: 'Verdi Luca', hours: 8 },
      { kind: 'no_rate', code: 'P1', person: 'Bianchi Anna', hours: 16.5, proposed: null },
      { kind: 'no_total_costs', code: 'P1' },
      { kind: 'no_ordered', code: 'P2' },
      { kind: 'unread_months', code: 'P2', months: ['2026-04', '2026-05'] },
    ],
    notApprovedHours: 8,
    otherCodes: ['P7', 'P8'],
    unreadMonths: ['2026-04', '2026-05'],
    orphanCodes: [],
  },
}

type Api = Pick<
  OctoApi,
  | 'chooseProjectPath'
  | 'forecastSettings'
  | 'saveForecastSettings'
  | 'forecastCandidates'
  | 'forecastView'
  | 'compileForecast'
  | 'readForecastOrders'
  | 'openEvidence'
>

function fakeApi(overrides: Partial<Api> = {}) {
  const api: Api = {
    chooseProjectPath: vi.fn(async () => ok<string | null>('scelto/qui')),
    forecastSettings: vi.fn(async () => ok(configured)),
    saveForecastSettings: vi.fn(async (_id: string, settings: ForecastSettings) => ok(settings)),
    forecastCandidates: vi.fn(async () => ok(['amministrazione/Previsionale.xlsx'])),
    forecastView: vi.fn(async () => ok(view)),
    compileForecast: vi.fn(async () =>
      ok({ path: '_octo/previsionale/2026-06/Previsionale.xlsx', notInModel: ['P2'] }),
    ),
    // NetSuite is not linked: what Octo asks by itself for a code it does not know changes nothing.
    readForecastOrders: vi.fn(async () => UNLINKED),
    openEvidence: vi.fn(async () => ok(null)),
    ...overrides,
  }
  return api
}

const UNLINKED = { ok: false as const, code: 'source_not_configured' as const }

/** The headings of the columns of a table, as they are read. */
const headings = (table: HTMLElement): string[] =>
  within(table)
    .getAllByRole('columnheader')
    .map((heading) => heading.textContent ?? '')
/** What NetSuite says of the codes of the project. */
const ordersRead = (projects: ForecastSettings['projects']) =>
  ok({ settings: { ...configured, projects }, codes: Object.keys(projects) })

afterEach(cleanup)

describe('what the PM types', () => {
  it('reads amounts written the Italian way', () => {
    expect(amountOf('1.234,5')).toBe(1234.5)
    expect(amountOf(' 1234.5 € ')).toBe(1234.5)
    expect(amountOf('120.000')).toBe(120000)
    expect(amountOf('1.5')).toBe(1.5)
    expect(amountOf('')).toBeNull()
    expect(amountOf('abc')).toBeNull()
    expect(amountText(1234.5)).toBe('1234,5')
    expect(amountText(null)).toBe('')
  })

  it('tells an amount typed in a field of its own from nothing and from nonsense', () => {
    expect(amountField('')).toEqual({ value: null, wrong: false })
    expect(amountField(' 1.200,5 ')).toEqual({ value: 1200.5, wrong: false })
    expect(amountField('tanto')).toEqual({ value: null, wrong: true })
  })

  it('knows the month before', () => {
    expect(previousMonthOf(new Date('2026-01-15T00:00:00Z'))).toBe('2025-12')
  })
})

describe('the forecast', () => {
  it('shows the last complete month with what is missing', async () => {
    const api = fakeApi()
    render(<ForecastView api={api} project={project} now={now} />)
    expect((await screen.findAllByText(text.project('Sviluppo', 'P1'))).length).toBeGreaterThan(0)
    expect(api.forecastView).toHaveBeenCalledWith('p-1', '2026-06')
    expect(screen.getAllByText('3.200,00')).toHaveLength(2)
    // Days sold and progress of a fixed price each in its own column: the other stays empty.
    const table = screen.getByRole('table', { name: text.monthData })
    const cellsOf = (code: string) =>
      within(within(table).getByRole('row', { name: new RegExp(`· ${code} `) }))
        .getAllByRole('cell')
        .map((cell) => cell.textContent)
    expect(cellsOf('P1').slice(1, 7)).toEqual([
      '100.000,00',
      '3.200,00',
      '750,00',
      '6.400,00',
      '18,5',
      '—',
    ])
    expect(cellsOf('P2').slice(5, 7)).toEqual(['—', '12,5%'])
    // The name of the code is in the row, not only under the pointer.
    expect(within(table).getByText(text.project('Sviluppo', 'P1'))).toBeTruthy()
    expect(within(table).getByText(text.project('A corpo', 'P2'))).toBeTruthy()
    // A row whose figures miss something says so itself; both rows here do.
    expect(within(table).getAllByText(text.incomplete)).toHaveLength(2)
    // The project as a whole: ordered, costs, revenue, days, and the margin of the month on them.
    const total = within(table).getByRole('row', { name: new RegExp(`^${text.totalRow}`) })
    expect(
      within(total)
        .getAllByRole('cell')
        .map((cell) => cell.textContent)
        .slice(0, 7),
    ).toEqual(['150.000,00', '6.400,00', '1.500,00', '12.800,00', '18,5', '', '38,28%'])
    expect(screen.getByText('40%')).toBeTruthy()
    expect(screen.getByText(text.gap.no_cost('P1', 'Verdi Luca', '8'))).toBeTruthy()
    expect(screen.getByText(text.gap.no_rate('P1', 'Bianchi Anna', '16,5'))).toBeTruthy()
    expect(screen.getByText(text.gap.no_total_costs('P1'))).toBeTruthy()
    expect(screen.getByText(text.gap.no_ordered('P2'))).toBeTruthy()
    expect(screen.getByText(text.notApproved('8'))).toBeTruthy()
    expect(screen.getByText(text.otherCodes('P7, P8'))).toBeTruthy()
    // The months of timesheets nobody read are said on the page and on the code they belong to.
    expect(screen.getByText(text.unreadMonths('2026-04, 2026-05'))).toBeTruthy()
    expect(screen.getByText(text.gap.unread_months('P2', '2026-04, 2026-05'))).toBeTruthy()
    expect(screen.getByText(text.internal)).toBeTruthy()
  })

  it('shows no total for a single code, and no mark on a row that misses nothing', async () => {
    const single: View = {
      ...view,
      forecast: {
        ...view.forecast,
        rows: [{ ...(view.forecast.rows[0] as View['forecast']['rows'][number]), ordered: null }],
        gaps: [{ kind: 'no_total_costs', code: 'P1' }],
        unreadMonths: [],
      },
    }
    render(
      <ForecastView
        api={fakeApi({ forecastView: vi.fn(async () => ok(single)) })}
        project={project}
        now={now}
      />,
    )
    const table = await screen.findByRole('table', { name: text.monthData })
    expect(within(table).queryByText(text.totalRow)).toBeNull()
    // The margin at the end that is missing does not make the figures of the month wrong.
    expect(within(table).queryByText(text.incomplete)).toBeNull()
    // A month sold by the day only has no column of dashes for the progress.
    expect(headings(table)).toContain(text.columnDays)
    expect(headings(table)).not.toContain(text.columnProgress)
    const cells = within(within(table).getByRole('row', { name: /· P1 / })).getAllByRole('cell')
    expect(cells.map((cell) => cell.textContent).slice(1, 7)).toEqual([
      text.none,
      '3.200,00',
      '750,00',
      '6.400,00',
      '18,5',
      '38,28%',
    ])
    // Octo fills one column less: the heading of its group covers those that are there.
    expect(
      within(table).getByRole('columnheader', { name: text.groupComputed }).getAttribute('colspan'),
    ).toBe('8')
  })

  it('shows the progress and no days for a month sold at a fixed price only', async () => {
    const share = view.forecast.rows[1] as View['forecast']['rows'][number]
    const shares: View = {
      ...view,
      forecast: { ...view.forecast, rows: [share, { ...share, code: 'P3' }], gaps: [] },
    }
    render(
      <ForecastView
        api={fakeApi({ forecastView: vi.fn(async () => ok(shares)) })}
        project={project}
        now={now}
      />,
    )
    const table = await screen.findByRole('table', { name: text.monthData })
    expect(headings(table)).toContain(text.columnProgress)
    expect(headings(table)).not.toContain(text.columnDays)
    const cellsOf = (name: string) =>
      within(within(table).getByRole('row', { name: new RegExp(`(^|· )${name} `) }))
        .getAllByRole('cell')
        .map((cell) => cell.textContent)
    expect(cellsOf('P3')[5]).toBe('12,5%')
    // The total has a cell for each column that is there: nothing slips under another heading.
    expect(cellsOf(text.totalRow).slice(0, 6)).toEqual([
      '100.000,00',
      '6.400,00',
      '1.500,00',
      '12.800,00',
      '',
      '38,28%',
    ])
    expect(
      within(table).getByRole('columnheader', { name: text.groupComputed }).getAttribute('colspan'),
    ).toBe('8')
  })

  it('says it is reading until the settings come, then shows the month or why it cannot', async () => {
    const failing = { ok: false as const, code: 'forecast_settings_invalid' as const }
    for (const answer of [ok(configured), failing]) {
      let arrive: (value: Result<ForecastSettings>) => void = () => {}
      const late = new Promise<Result<ForecastSettings>>((resolve) => {
        arrive = resolve
      })
      render(
        <ForecastView
          api={fakeApi({ forecastSettings: vi.fn(() => late) })}
          project={project}
          now={now}
        />,
      )
      expect(screen.getByRole('status').textContent).toBe(text.loading)
      arrive(answer)
      await waitFor(() => expect(screen.queryByText(text.loading)).toBeNull())
      expect(screen.queryByRole('alert') !== null).toBe(!answer.ok)
      cleanup()
    }
  })

  it('says when nothing is missing and when the model lists no code', async () => {
    const empty: View = {
      ...view,
      forecast: {
        ...view.forecast,
        rows: [],
        gaps: [],
        notApprovedHours: 0,
        otherCodes: [],
        unreadMonths: [],
      },
    }
    render(
      <ForecastView
        api={fakeApi({ forecastView: vi.fn(async () => ok(empty)) })}
        project={project}
        now={now}
      />,
    )
    expect(await screen.findByText(text.noGaps)).toBeTruthy()
    expect(screen.getByText(text.noRows)).toBeTruthy()
  })

  it('follows the month chosen', async () => {
    const api = fakeApi()
    render(<ForecastView api={api} project={project} now={now} />)
    const month = await screen.findByLabelText(text.month)
    fireEvent.change(month, { target: { value: '2026-05' } })
    await waitFor(() => expect(api.forecastView).toHaveBeenCalledWith('p-1', '2026-05'))
    fireEvent.change(month, { target: { value: '' } })
    expect(api.forecastView).toHaveBeenCalledTimes(2)
    // One step back and one forward, across the turn of a year too.
    fireEvent.click(screen.getByRole('button', { name: messages.monthAfter }))
    await waitFor(() => expect(api.forecastView).toHaveBeenLastCalledWith('p-1', '2026-06'))
    fireEvent.change(month, { target: { value: '2026-01' } })
    fireEvent.click(screen.getByRole('button', { name: messages.monthBefore }))
    await waitFor(() => expect(api.forecastView).toHaveBeenLastCalledWith('p-1', '2025-12'))
  })

  it('writes the filled model and opens it', async () => {
    const api = fakeApi()
    render(<ForecastView api={api} project={project} now={now} />)
    fireEvent.click(await screen.findByRole('button', { name: text.compile }))
    const path = '_octo/previsionale/2026-06/Previsionale.xlsx'
    const done = await screen.findByText(new RegExp(path))
    // A code of the project the model has no row for is named.
    expect(done.textContent).toContain(text.notInModel('P2'))
    expect(api.compileForecast).toHaveBeenCalledWith('p-1', '2026-06')
    fireEvent.click(screen.getByRole('button', { name: text.open }))
    expect(api.openEvidence).toHaveBeenCalledWith('p-1', path)
  })

  it('says why the model could not be written', async () => {
    const api = fakeApi({
      compileForecast: vi.fn(async () => ({
        ok: false as const,
        code: 'forecast_model_missing' as const,
      })),
    })
    render(<ForecastView api={api} project={project} now={now} />)
    fireEvent.click(await screen.findByRole('button', { name: text.compile }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/Non trovo il file del modello/)
  })

  it('saves in one go what the PM adds for every code of the month, typed in its row', async () => {
    const api = fakeApi()
    render(<ForecastView api={api} project={project} now={now} />)
    const form = await screen.findByRole('form', { name: text.monthData })
    const cell = (label: string, code: string) =>
      within(form).getByLabelText<HTMLInputElement>(text.forCode(label, code))
    await waitFor(() => expect(cell(text.toInvoice, 'P1').value).toBe('12000'))
    // What is used less often opens under the row of its code.
    expect(screen.queryByRole('group', { name: text.inputsTitle('P1') })).toBeNull()
    // How a row is computed is read with its details, not under every row.
    const howP1 = `${text.howComputed} timesheet approvati`
    expect(screen.queryByText(howP1)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: text.forCode(text.moreData, 'P1') }))
    expect(screen.getByText(howP1)).toBeTruthy()
    expect(screen.queryByText(`${text.howComputed} avanzamento`)).toBeNull()
    const more = within(screen.getByRole('group', { name: text.inputsTitle('P1') }))
    // A figure that is not one is told under its field, and the month is not saved.
    fireEvent.change(more.getByLabelText(text.cell(text.columns.name, 1)), {
      target: { value: 'Studio Blu' },
    })
    fireEvent.change(more.getByLabelText(text.cell(text.columns.hours, 1)), {
      target: { value: 'tante' },
    })
    fireEvent.change(cell(text.revenue, 'P2'), { target: { value: 'boh' } })
    fireEvent.click(screen.getByRole('button', { name: text.saveInputs }))
    expect(more.getByText(text.wrong.hours(1))).toBeTruthy()
    expect(within(form).getByText(messages.amountWrong)).toBeTruthy()
    expect(within(form).getByRole('status').textContent).toBe(messages.notSaved)
    expect(api.saveForecastSettings).not.toHaveBeenCalled()

    fireEvent.change(more.getByLabelText(text.cell(text.columns.hours, 1)), {
      target: { value: '20' },
    })
    fireEvent.change(cell(text.revenue, 'P2'), { target: { value: '' } })
    fireEvent.change(cell(text.revenue, 'P1'), { target: { value: '7.000,50' } })
    fireEvent.change(more.getByLabelText(text.budgetCosts), { target: { value: '' } })
    fireEvent.change(more.getByLabelText(text.totalCosts), { target: { value: '60000' } })
    fireEvent.click(more.getByLabelText(text.totalCostsBeforeMonth))
    // The note is written in a window of its own, opened from the row.
    fireEvent.click(screen.getByRole('button', { name: text.forCode(text.addNote, 'P2') }))
    fireEvent.click(screen.getByRole('button', { name: messages.cancel }))
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: text.forCode(text.addNote, 'P1') }))
    const noteWindow = within(screen.getByRole('dialog', { name: text.noteTitle('P1') }))
    // A new note has nothing to take off.
    expect(noteWindow.queryByRole('button', { name: text.removeNote })).toBeNull()
    fireEvent.change(noteWindow.getByLabelText(text.note), {
      target: { value: ' SAL di giugno ' },
    })
    fireEvent.click(noteWindow.getByRole('button', { name: text.noteSave }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByText('SAL di giugno')).toBeTruthy()
    // Saving the note saves the month as typed, the note with it.
    await waitFor(() => expect(api.saveForecastSettings).toHaveBeenCalledTimes(1))
    expect(vi.mocked(api.saveForecastSettings).mock.calls[0]?.[1].months['2026-06']?.P1?.note).toBe(
      'SAL di giugno',
    )
    vi.mocked(api.saveForecastSettings).mockClear()
    // Pointing at a code tells the name of its project and how it is sold.
    expect(screen.getAllByRole('tooltip').map((tip) => tip.textContent)).toEqual([
      text.projectName('Sviluppo', 'P1', text.kinds.time_material),
      text.projectName('A corpo', 'P2', text.kinds.fixed_price),
    ])
    fireEvent.change(cell(text.toInvoice, 'P2'), { target: { value: '500' } })
    fireEvent.click(screen.getByRole('button', { name: text.saveInputs }))
    await waitFor(() => expect(api.saveForecastSettings).toHaveBeenCalled())
    const saved = vi.mocked(api.saveForecastSettings).mock.calls[0]?.[1]
    expect(saved?.months['2026-06']).toEqual({
      P1: {
        externals: [{ name: 'Studio Blu', hours: 20 }],
        toInvoice: 12000,
        revenue: 7000.5,
        budgetCosts: null,
        totalCosts: 60000,
        totalCostsBeforeMonth: true,
        note: 'SAL di giugno',
      },
      P2: {
        externals: [],
        toInvoice: 500,
        revenue: null,
        budgetCosts: null,
        totalCosts: null,
        totalCostsBeforeMonth: false,
        note: '',
      },
    })
    await waitFor(() => expect(api.forecastView).toHaveBeenCalledTimes(3))
    // A note that is there is changed in the same window, or taken off: from there or the row.
    const noteOf = () => vi.mocked(api.saveForecastSettings).mock.lastCall?.[1].months['2026-06']
    fireEvent.click(screen.getByRole('button', { name: text.forCode(text.editNote, 'P1') }))
    const editing = within(screen.getByRole('dialog', { name: text.noteTitle('P1') }))
    expect(editing.getByLabelText<HTMLTextAreaElement>(text.note).value).toBe('SAL di giugno')
    fireEvent.change(editing.getByLabelText(text.note), { target: { value: 'SAL di luglio' } })
    fireEvent.click(editing.getByRole('button', { name: text.noteSave }))
    await waitFor(() => expect(noteOf()?.P1?.note).toBe('SAL di luglio'))
    fireEvent.click(screen.getByRole('button', { name: text.forCode(text.editNote, 'P1') }))
    fireEvent.click(screen.getByRole('button', { name: text.removeNote }))
    await waitFor(() => expect(noteOf()?.P1?.note).toBe(''))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('button', { name: text.forCode(text.addNote, 'P1') })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: text.forCode(text.addNote, 'P1') }))
    fireEvent.change(screen.getByLabelText(text.note), { target: { value: 'da togliere' } })
    fireEvent.click(screen.getByRole('button', { name: text.noteSave }))
    fireEvent.click(
      await screen.findByRole('button', { name: text.forCode(text.removeNote, 'P1') }),
    )
    await waitFor(() => expect(noteOf()?.P1?.note).toBe(''))
    // The details close with a second click.
    fireEvent.click(screen.getByRole('button', { name: text.forCode(text.moreData, 'P1') }))
    expect(screen.queryByRole('group', { name: text.inputsTitle('P1') })).toBeNull()
  })

  it('puts right what is missing beside where it is said to be missing', async () => {
    const withExternal: View = {
      ...view,
      forecast: {
        ...view.forecast,
        gaps: [
          ...view.forecast.gaps.filter((gap) => gap.kind !== 'unread_months'),
          { kind: 'no_external_rate', code: 'P2', person: 'Studio Blu', hours: 40 },
        ],
      },
    }
    const api = fakeApi({ forecastView: vi.fn(async () => ok(withExternal)) })
    const onOpenSection = vi.fn()
    render(<ForecastView api={api} project={project} now={now} onOpenSection={onOpenSection} />)
    await screen.findByText(text.gap.no_rate('P1', 'Bianchi Anna', '16,5'))
    const who = text.remedy.of('Bianchi Anna', 'P1')
    const rate = screen.getByLabelText(`${text.columns.rate}, ${who}`)
    const saveRate = screen.getByRole('button', { name: `${text.remedy.save}: ${who}` })
    // The rate that is missing is typed where it is said to be missing.
    fireEvent.change(rate, { target: { value: 'tanta' } })
    fireEvent.click(saveRate)
    expect(screen.getByText(messages.amountWrong)).toBeTruthy()
    expect(api.saveForecastSettings).not.toHaveBeenCalled()
    fireEvent.change(rate, { target: { value: '450' } })
    fireEvent.click(saveRate)
    await waitFor(() => expect(api.saveForecastSettings).toHaveBeenCalledTimes(1))
    expect(vi.mocked(api.saveForecastSettings).mock.calls[0]?.[1].rates).toEqual([
      ...configured.rates,
      { person: 'Bianchi Anna', code: null, ratePerDay: 450 },
    ])

    // An external needs what a day costs and what it is sold for, on that code.
    const external = text.remedy.of('Studio Blu', 'P2')
    fireEvent.change(screen.getByLabelText(`${text.columns.rate}, ${external}`), {
      target: { value: '500' },
    })
    fireEvent.click(screen.getByRole('button', { name: `${text.remedy.save}: ${external}` }))
    expect(api.saveForecastSettings).toHaveBeenCalledTimes(1)
    fireEvent.change(screen.getByLabelText(`${text.columns.cost}, ${external}`), {
      target: { value: '300' },
    })
    fireEvent.click(screen.getByRole('button', { name: `${text.remedy.save}: ${external}` }))
    await waitFor(() => expect(api.saveForecastSettings).toHaveBeenCalledTimes(2))
    expect(vi.mocked(api.saveForecastSettings).mock.calls[1]?.[1].externals.at(-1)).toEqual({
      name: 'Studio Blu',
      code: 'P2',
      costPerDay: 300,
      ratePerDay: 500,
    })

    // Costs that are missing lead to where they are typed; a cost NetSuite lacks, to the hours.
    fireEvent.click(screen.getByRole('button', { name: text.remedy.openCode('P1') }))
    expect(screen.getByRole('group', { name: text.inputsTitle('P1') })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: messages.openSection(messages.hoursTab) }))
    expect(onOpenSection).toHaveBeenCalledWith('hours')
  })

  it('works with no model, proposing the only one found, and saves the projects', async () => {
    // Rates and costs written before the budget existed stay as they are through a save.
    const before: ForecastSettings = {
      ...DEFAULT_FORECAST_SETTINGS,
      rates: [{ person: 'Rossi Mario', code: null, ratePerDay: 400 }],
      externals: [{ name: 'Studio Blu', code: 'P1', costPerDay: 300, ratePerDay: 500 }],
      hourlyCosts: [{ person: 'Verdi Sara', costPerHour: 70 }],
    }
    const onOpenSection = vi.fn()
    const api = fakeApi({ forecastSettings: vi.fn(async () => ok(before)) })
    render(<ForecastView api={api} project={project} now={now} onOpenSection={onOpenSection} />)
    expect(await screen.findByText(text.setupIntro)).toBeTruthy()
    // The month is computed with no model; only filling the spreadsheet needs one.
    await waitFor(() => expect(api.forecastView).toHaveBeenCalledWith('p-1', '2026-06'))
    expect(screen.queryByRole('button', { name: text.compile })).toBeNull()
    const model = screen.getByLabelText(text.modelPath) as HTMLInputElement
    await waitFor(() => expect(model.value).toBe('amministrazione/Previsionale.xlsx'))
    // Rates and costs are of the budget of a code: here they are said to be there, not typed.
    expect(screen.getByText(text.ratesInBudget)).toBeTruthy()
    expect(screen.queryByRole('group', { name: text.rates })).toBeNull()
    expect(screen.queryByRole('group', { name: text.externalRates })).toBeNull()
    expect(screen.queryByRole('group', { name: text.hourlyCosts })).toBeNull()
    const settings = screen.getByText(text.ratesInBudget).closest('form') as HTMLElement
    fireEvent.click(
      within(settings).getByRole('button', { name: messages.openSection(messages.sheetTab) }),
    )
    expect(onOpenSection).toHaveBeenCalledWith('sheet')
    fireEvent.change(screen.getByLabelText(text.hoursPerDay), { target: { value: '7.5' } })

    // How each code of the project is sold: a fee with months that are not a number is told.
    const ofCode = (label: string, code: string) =>
      screen.getByLabelText<HTMLInputElement>(text.forCode(label, code))
    expect(ofCode(text.columnFeeMonths, 'P2').disabled).toBe(true)
    fireEvent.change(ofCode(text.columnKind, 'P2'), { target: { value: 'fee' } })
    fireEvent.change(ofCode(text.columnOrdered, 'P2'), { target: { value: '22.500' } })
    fireEvent.change(ofCode(text.columnFeeMonths, 'P2'), { target: { value: 'un anno' } })
    fireEvent.click(screen.getByRole('button', { name: text.save }))
    expect(screen.getByText(text.wrong.project('P2'))).toBeTruthy()
    expect(api.saveForecastSettings).not.toHaveBeenCalled()
    fireEvent.change(ofCode(text.columnFeeMonths, 'P2'), { target: { value: '12' } })
    fireEvent.change(ofCode(text.columnKind, 'P1'), { target: { value: 'fixed_price' } })
    fireEvent.click(screen.getByRole('button', { name: text.save }))
    await waitFor(() =>
      expect(api.saveForecastSettings).toHaveBeenCalledWith('p-1', {
        ...before,
        modelPath: 'amministrazione/Previsionale.xlsx',
        projects: {
          P1: { ...NO_FORECAST_PROJECT, kind: 'fixed_price' },
          P2: {
            kind: 'fee',
            description: '',
            ordered: 22500,
            feeMonths: 12,
            startMonth: null,
            invoiced: null,
            recognized: null,
          },
        },
        hoursPerDay: 7.5,
      }),
    )
    expect((await screen.findAllByText(text.project('Sviluppo', 'P1'))).length).toBeGreaterThan(0)
  })

  it('reads name and ordered amount from NetSuite, and says when it cannot', async () => {
    const api = fakeApi({
      readForecastOrders: vi
        .fn<Api['readForecastOrders']>()
        // The first time Octo asks by itself, and NetSuite does not answer: nothing is said.
        .mockResolvedValueOnce(UNLINKED)
        .mockResolvedValue(
          ordersRead({ P1: { ...NO_FORECAST_PROJECT, description: 'Sviluppo', ordered: 100000 } }),
        ),
    })
    render(<ForecastView api={api} project={project} now={now} />)
    fireEvent.click(await screen.findByRole('button', { name: text.readOrders }))
    await waitFor(() =>
      expect(
        screen.getByLabelText<HTMLInputElement>(text.forCode(text.columnOrdered, 'P1')).value,
      ).toBe('100000'),
    )
    expect(api.readForecastOrders).toHaveBeenCalledWith('p-1')
    expect(api.forecastView).toHaveBeenCalledTimes(2)
    cleanup()
    const unlinked = fakeApi()
    render(<ForecastView api={unlinked} project={project} now={now} />)
    // Asked by itself, a NetSuite that is not linked is no error to show.
    await waitFor(() => expect(unlinked.readForecastOrders).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('alert')).toBeNull()
    fireEvent.click(await screen.findByRole('button', { name: text.readOrders }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/non è ancora configurata/)
  })

  it('learns by itself how a new code is sold, and asks no rate in its settings', async () => {
    const fixed: View = {
      ...view,
      forecast: {
        ...view.forecast,
        rows: view.forecast.rows.filter((row) => row.code === 'P2'),
        gaps: [],
      },
    }
    const known = {
      P2: {
        ...NO_FORECAST_PROJECT,
        kind: 'fixed_price' as const,
        ordered: 7500,
        startMonth: '2026-04',
        invoiced: null,
        recognized: null,
      },
    }
    const api = fakeApi({
      forecastView: vi.fn(async () => ok(fixed)),
      readForecastOrders: vi.fn(async () => ordersRead(known)),
    })
    render(<ForecastView api={api} project={project} now={now} />)
    // Nobody pressed anything: the code was not in the settings, and NetSuite was asked.
    await waitFor(() =>
      expect(
        screen.getByLabelText<HTMLSelectElement>(text.forCode(text.columnKind, 'P2')).value,
      ).toBe('fixed_price'),
    )
    expect(api.readForecastOrders).toHaveBeenCalledTimes(1)
    expect(
      screen.getByLabelText<HTMLInputElement>(text.forCode(text.columnOrdered, 'P2')).value,
    ).toBe('7500')
    // No rate is asked here, however the code is sold: rates are of its budget.
    expect(screen.queryByRole('group', { name: text.rates })).toBeNull()

    cleanup()
    // Every code is known already: NetSuite is not asked again.
    const settled = fakeApi({
      forecastSettings: vi.fn(async () => ok({ ...configured, projects: known })),
      forecastView: vi.fn(async () => ok(fixed)),
    })
    render(<ForecastView api={settled} project={project} now={now} />)
    expect(await screen.findByText(text.ratesInBudget)).toBeTruthy()
    expect(settled.readForecastOrders).not.toHaveBeenCalled()

    cleanup()
    // A fixed price whose start is not known: NetSuite is asked when its first order was.
    const noStart = { P2: { ...known.P2, startMonth: null } }
    const asking = fakeApi({
      forecastSettings: vi.fn(async () => ok({ ...configured, projects: noStart })),
      forecastView: vi.fn(async () => ok(fixed)),
      readForecastOrders: vi.fn(async () => ordersRead(known)),
    })
    render(<ForecastView api={asking} project={project} now={now} />)
    const start = () =>
      screen.getByLabelText<HTMLInputElement>(text.forCode(text.columnStartMonth, 'P2'))
    await waitFor(() => expect(start().value).toBe('2026-04'))
    expect(asking.readForecastOrders).toHaveBeenCalledTimes(1)
    // A month that is read is a value; an empty field shows the format only, never a month.
    expect(start().placeholder).toBe(text.startMonthFormat)
    fireEvent.change(start(), { target: { value: '' } })
    expect(start().value).toBe('')
    expect(start().placeholder).not.toMatch(/\d/)
  })

  it('offers to a new code the rates of the code before, one by one or all at once', async () => {
    const proposed: View = {
      ...view,
      forecast: {
        ...view.forecast,
        gaps: [
          {
            kind: 'no_rate',
            code: 'PI7',
            person: 'Rossi Mario',
            hours: 16,
            proposed: { code: 'PI6', ratePerDay: 400 },
          },
          {
            kind: 'no_rate',
            code: 'PI7',
            person: 'Bianchi Anna',
            hours: 8,
            proposed: { code: 'PI6', ratePerDay: 420 },
          },
          { kind: 'no_rate', code: 'PI7', person: 'Neri Ugo', hours: 8, proposed: null },
        ],
        orphanCodes: ['OLD1'],
      },
    }
    const api = fakeApi({ forecastView: vi.fn(async () => ok(proposed)) })
    render(<ForecastView api={api} project={project} now={now} />)
    // Data of the month on a code that is not of the project are said, not dropped in silence.
    expect(await screen.findByText(text.orphanCodes('OLD1'))).toBeTruthy()
    expect(screen.getByText(text.copyRatesHint)).toBeTruthy()
    const one = `${text.proposedRate('420,00', 'PI6')}: ${text.remedy.of('Bianchi Anna', 'PI7')}`
    fireEvent.click(screen.getByRole('button', { name: one }))
    await waitFor(() =>
      expect(api.saveForecastSettings).toHaveBeenLastCalledWith(
        'p-1',
        expect.objectContaining({
          rates: [...configured.rates, { person: 'Bianchi Anna', code: 'PI7', ratePerDay: 420 }],
        }),
      ),
    )
    // Who has no rate anywhere gets no proposal: the rate is typed as before.
    expect(screen.getAllByRole('button', { name: /^Usa .* come su PI6: / })).toHaveLength(2)
    cleanup()
    // All at once: every person the code before has a rate for, in one save.
    render(<ForecastView api={api} project={project} now={now} />)
    fireEvent.click(await screen.findByRole('button', { name: text.copyRates(2, 'PI6', 'PI7') }))
    await waitFor(() =>
      expect(api.saveForecastSettings).toHaveBeenLastCalledWith(
        'p-1',
        expect.objectContaining({
          rates: [
            ...configured.rates,
            { person: 'Rossi Mario', code: 'PI7', ratePerDay: 400 },
            { person: 'Bianchi Anna', code: 'PI7', ratePerDay: 420 },
          ],
        }),
      ),
    )
  })

  it('sends to the hours the PM who has months of timesheets nobody read', async () => {
    const onOpenSection = vi.fn()
    const unread: View = {
      ...view,
      forecast: {
        ...view.forecast,
        gaps: view.forecast.gaps.filter((gap) => gap.kind === 'unread_months'),
      },
    }
    const api = fakeApi({ forecastView: vi.fn(async () => ok(unread)) })
    render(<ForecastView api={api} project={project} now={now} onOpenSection={onOpenSection} />)
    fireEvent.click(
      await screen.findByRole('button', { name: messages.openSection(messages.hoursTab) }),
    )
    expect(onOpenSection).toHaveBeenCalledWith('hours')
  })

  it('asks the costs of the whole project first for a fixed price, the externals first by the day', async () => {
    render(<ForecastView api={fakeApi()} project={project} now={now} />)
    const order = async (code: string) => {
      fireEvent.click(
        await screen.findByRole('button', { name: text.forCode(text.moreData, code) }),
      )
      const group = screen.getByRole('group', { name: text.inputsTitle(code) })
      const budget = within(group).getByLabelText(text.budgetCosts)
      const externals = within(group).getByRole('heading', { name: text.externals })
      // Whether the costs at budget come before the hours of the externals.
      return Boolean(budget.compareDocumentPosition(externals) & Node.DOCUMENT_POSITION_FOLLOWING)
    }
    expect(await order('P2')).toBe(true)
    expect(await order('P1')).toBe(false)
  })

  it('chooses the model from the dialog of the system, and says when it is elsewhere', async () => {
    const api = fakeApi({
      forecastSettings: vi.fn(async () => ok(DEFAULT_FORECAST_SETTINGS)),
      forecastCandidates: vi.fn(async () => ok([])),
      chooseProjectPath: vi
        .fn<OctoApi['chooseProjectPath']>()
        .mockResolvedValueOnce({ ok: false, code: 'path_outside_project' })
        .mockResolvedValueOnce(ok(null))
        .mockResolvedValue(ok('amministrazione/Altro.xlsx')),
    })
    render(<ForecastView api={api} project={project} now={now} />)
    const model = (await screen.findByLabelText(text.modelPath)) as HTMLInputElement
    const choose = screen.getByRole('button', {
      name: `${messages.choosePath}: ${text.modelPath}`,
    })
    fireEvent.click(choose)
    expect((await screen.findByRole('alert')).textContent).toMatch(/fuori dalla cartella/)
    // The PM closes the dialog: nothing changes.
    fireEvent.click(choose)
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
    expect(model.value).toBe('')
    fireEvent.click(choose)
    await waitFor(() => expect(model.value).toBe('amministrazione/Altro.xlsx'))
    expect(api.chooseProjectPath).toHaveBeenLastCalledWith('p-1', 'file', ['xlsx'])
  })

  it('keeps the model empty when more than one could be it, and shows a failed save', async () => {
    const api = fakeApi({
      forecastSettings: vi.fn(async () => ok(DEFAULT_FORECAST_SETTINGS)),
      forecastCandidates: vi.fn(async () => ok(['a.xlsx', 'b.xlsx'])),
      saveForecastSettings: vi.fn(async () => ({
        ok: false as const,
        code: 'forecast_settings_invalid' as const,
      })),
    })
    render(<ForecastView api={api} project={project} now={now} />)
    const model = (await screen.findByLabelText(text.modelPath)) as HTMLInputElement
    await waitFor(() => expect(api.forecastCandidates).toHaveBeenCalled())
    expect(model.value).toBe('')
    fireEvent.change(model, { target: { value: '../fuori.xlsx' } })
    fireEvent.click(screen.getByRole('button', { name: text.save }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/cartella del progetto/)
  })

  it('shows why the settings or the month cannot be read', async () => {
    const failing = fakeApi({
      forecastSettings: vi.fn(async () => ({
        ok: false as const,
        code: 'forecast_settings_invalid' as const,
      })),
    })
    render(<ForecastView api={failing} project={project} now={now} />)
    expect((await screen.findByRole('alert')).textContent).toMatch(/non sono valide/)
    cleanup()
    const noTimesheet = fakeApi({
      forecastView: vi.fn(async () => ({
        ok: false as const,
        code: 'forecast_timesheet_not_set' as const,
      })),
    })
    render(<ForecastView api={noTimesheet} project={project} now={now} />)
    expect((await screen.findByRole('alert')).textContent).toMatch(/in «Ore»/)
    // Without a way to another section the error only says where to go.
    expect(
      screen.queryByRole('button', { name: messages.openSection(messages.hoursTab) }),
    ).toBeNull()
    expect(screen.queryByRole('button', { name: text.compile })).toBeNull()
  })
})
