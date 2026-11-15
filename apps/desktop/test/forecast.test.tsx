// @vitest-environment jsdom
import type { ForecastView as View } from '@octo/application'
import {
  DEFAULT_FORECAST_SETTINGS,
  type ForecastSettings,
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
        number: 2,
        code: 'P1',
        description: 'Sviluppo',
        ordered: 100000,
        hours: 148,
        values,
        note: 'timesheet approvati',
        cells: {},
      },
      {
        number: 3,
        code: 'P2',
        description: 'A corpo',
        ordered: 50000,
        hours: 0,
        values: { ...values, quantity: 0.125, quantityIsShare: true, marginEnd: 0.4 },
        note: 'avanzamento',
        cells: {},
      },
    ],
    gaps: [
      { kind: 'no_cost', code: 'P1', person: 'Verdi Luca', hours: 8 },
      { kind: 'no_rate', code: 'P1', person: 'Bianchi Anna', hours: 16.5 },
      { kind: 'no_total_costs', code: 'P1' },
      { kind: 'no_ordered', code: 'P2' },
    ],
    notApprovedHours: 8,
    otherCodes: ['P7', 'P8'],
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
      ok({ path: '_octo/previsionale/2026-06/Previsionale.xlsx' }),
    ),
    openEvidence: vi.fn(async () => ok(null)),
    ...overrides,
  }
  return api
}

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
    expect(await screen.findByText('P1')).toBeTruthy()
    expect(api.forecastView).toHaveBeenCalledWith('p-1', '2026-06')
    expect(screen.getAllByText('3.200,00')).toHaveLength(2)
    expect(screen.getByText('18,5 gg')).toBeTruthy()
    expect(screen.getByText('12,5%')).toBeTruthy()
    expect(screen.getAllByText('38,28%')).toHaveLength(2)
    expect(screen.getByText('40%')).toBeTruthy()
    expect(screen.getByText(text.gap.no_cost('P1', 'Verdi Luca', '8'))).toBeTruthy()
    expect(screen.getByText(text.gap.no_rate('P1', 'Bianchi Anna', '16,5'))).toBeTruthy()
    expect(screen.getByText(text.gap.no_total_costs('P1'))).toBeTruthy()
    expect(screen.getByText(text.gap.no_ordered('P2'))).toBeTruthy()
    expect(screen.getByText(text.notApproved('8'))).toBeTruthy()
    expect(screen.getByText(text.otherCodes('P7, P8'))).toBeTruthy()
    expect(screen.getByText(text.internal)).toBeTruthy()
  })

  it('says when nothing is missing and when the model lists no code', async () => {
    const empty: View = {
      ...view,
      forecast: { ...view.forecast, rows: [], gaps: [], notApprovedHours: 0, otherCodes: [] },
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
    expect(await screen.findByText(new RegExp(path))).toBeTruthy()
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
    fireEvent.click(screen.getByRole('button', { name: text.forCode(text.moreData, 'P1') }))
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
    fireEvent.change(cell(text.note, 'P1'), { target: { value: 'SAL di giugno' } })
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
    await waitFor(() => expect(api.forecastView).toHaveBeenCalledTimes(2))
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
          ...view.forecast.gaps,
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

  it('asks for the model first, proposing the only one found, and saves rates', async () => {
    const api = fakeApi({ forecastSettings: vi.fn(async () => ok(DEFAULT_FORECAST_SETTINGS)) })
    render(<ForecastView api={api} project={project} now={now} />)
    expect(await screen.findByText(text.setupIntro)).toBeTruthy()
    const model = screen.getByLabelText(text.modelPath) as HTMLInputElement
    await waitFor(() => expect(model.value).toBe('amministrazione/Previsionale.xlsx'))
    const rates = within(screen.getByRole('group', { name: text.rates }))
    const externals = within(screen.getByRole('group', { name: text.externalRates }))
    const set = (group: typeof rates, column: string, row: number, value: string) =>
      fireEvent.change(group.getByLabelText(text.cell(column, row)), { target: { value } })
    fireEvent.change(screen.getByLabelText(text.hoursPerDay), { target: { value: '7.5' } })
    // A rate without its figure, an external without its cost: told, and nothing is saved.
    set(rates, text.columns.person, 1, 'Rossi Mario')
    set(externals, text.columns.name, 1, 'Studio Blu')
    set(externals, text.columns.code, 1, 'p1')
    set(externals, text.columns.rate, 1, '500')
    fireEvent.click(screen.getByRole('button', { name: text.save }))
    expect(screen.getByText(text.wrong.rate(1))).toBeTruthy()
    expect(screen.getByText(text.wrong.external(1))).toBeTruthy()
    expect(api.saveForecastSettings).not.toHaveBeenCalled()

    set(rates, text.columns.rate, 1, '400')
    fireEvent.click(rates.getByRole('button', { name: text.add.rate }))
    set(rates, text.columns.person, 2, 'Rossi Mario')
    set(rates, text.columns.code, 2, 'p2')
    set(rates, text.columns.rate, 2, '630')
    fireEvent.click(rates.getByRole('button', { name: text.add.rate }))
    fireEvent.click(rates.getByRole('button', { name: text.removeRow(3) }))
    set(externals, text.columns.cost, 1, '300')
    fireEvent.click(screen.getByRole('button', { name: text.save }))
    await waitFor(() =>
      expect(api.saveForecastSettings).toHaveBeenCalledWith('p-1', {
        ...DEFAULT_FORECAST_SETTINGS,
        modelPath: 'amministrazione/Previsionale.xlsx',
        hoursPerDay: 7.5,
        rates: [
          { person: 'Rossi Mario', code: null, ratePerDay: 400 },
          { person: 'Rossi Mario', code: 'P2', ratePerDay: 630 },
        ],
        externals: [{ name: 'Studio Blu', code: 'P1', costPerDay: 300, ratePerDay: 500 }],
      }),
    )
    expect(await screen.findByText('P1')).toBeTruthy()
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
    expect((screen.getByRole('button', { name: text.save }) as HTMLButtonElement).disabled).toBe(
      true,
    )
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
