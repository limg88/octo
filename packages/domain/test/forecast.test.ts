import { describe, expect, it } from 'vitest'
import {
  cleanForecastSettings,
  compileForecast,
  DEFAULT_FORECAST_SETTINGS,
  type ForecastModel,
  type ForecastRowInputs,
  type ForecastSettings,
  type HoursEntry,
  NO_ROW_INPUTS,
  readForecastModel,
  type SheetGrid,
} from '../src/index.ts'

const HEADINGS = [
  'Cliente',
  'Cod. prog. Netsuite',
  'Descrizione',
  'Ordinato',
  'Previsione costi interni giugno 2026',
  'Previsione costi esterni giugno 2026',
  'Previsione ricavi giugno 2026',
  'N. gg/€ se T&M o % se PROGCORPO',
  'Previsionale  marginalità giugno',
  'Previsionale marginalità a fine progetto',
  'Importo da fatturare giugno 2026',
  'Note su ricavi',
]
const letters = 'ABCDEFGHIJKL'
const headerRow = (number: number) => ({
  number,
  cells: HEADINGS.map((text, index) => ({ ref: `${letters[index]}${number}`, text })),
})
const line = (number: number, code: string, ordered: string, description = 'Sviluppo') => ({
  number,
  cells: [
    { ref: `A${number}`, text: 'Cliente Uno' },
    { ref: `B${number}`, text: code },
    { ref: `C${number}`, text: description },
    ...(ordered === '' ? [] : [{ ref: `D${number}`, text: ordered }]),
  ],
})

const grid: SheetGrid = {
  rows: [headerRow(1), line(2, 'P1', '100000'), line(3, 'P2', '50000'), line(4, 'P3', 'n/d')],
}

function modelOf(sheet: SheetGrid = grid): ForecastModel {
  const reading = readForecastModel(sheet)
  if (!reading.ok) throw new Error(reading.missing.join())
  return reading.model
}

const entry = (
  person: string,
  day: string,
  hours: number,
  project: string | null = 'P1',
  approved = true,
): HoursEntry => ({ person, day, hours, project, approved, id: null })

const settingsWith = (
  rows: Record<string, Partial<ForecastRowInputs>> = {},
  rates = [
    { person: 'Rossi Mario', costPerDay: 200, ratePerDay: 400 },
    { person: 'Bianchi Anna', costPerDay: 250, ratePerDay: null },
  ],
): ForecastSettings => ({
  ...DEFAULT_FORECAST_SETTINGS,
  modelPath: 'modello.xlsx',
  rates,
  months: {
    '2026-06': Object.fromEntries(
      Object.entries(rows).map(([code, row]) => [code, { ...NO_ROW_INPUTS, ...row }]),
    ),
  },
})

describe('the model of the forecast', () => {
  it('finds each column by how its heading starts, whatever month it names', () => {
    const model = modelOf()
    expect(model.columns).toEqual({
      code: 'B',
      ordered: 'D',
      internalCosts: 'E',
      externalCosts: 'F',
      revenue: 'G',
      quantity: 'H',
      marginMonth: 'I',
      marginEnd: 'J',
      toInvoice: 'K',
      note: 'L',
    })
    expect(model.rows).toEqual([
      { number: 2, code: 'P1', description: 'Sviluppo', ordered: 100000 },
      { number: 3, code: 'P2', description: 'Sviluppo', ordered: 50000 },
      { number: 4, code: 'P3', description: 'Sviluppo', ordered: null },
    ])
  })

  it('accepts headings that are not on the first row and skips rows without a code', () => {
    const model = modelOf({
      rows: [
        { number: 1, cells: [{ ref: 'A1', text: 'Previsionale' }] },
        headerRow(3),
        { number: 4, cells: [{ ref: 'A4', text: 'solo cliente' }] },
        line(5, 'P9', ''),
      ],
    })
    expect(model.rows).toEqual([{ number: 5, code: 'P9', description: 'Sviluppo', ordered: null }])
  })

  it('names the headings a sheet lacks', () => {
    const cells = headerRow(1).cells.filter((cell) => !cell.text.startsWith('Note'))
    expect(readForecastModel({ rows: [{ number: 1, cells }] })).toEqual({
      ok: false,
      missing: ['note'],
    })
    const none = readForecastModel({ rows: [{ number: 1, cells: [{ ref: 'A1', text: 'x' }] }] })
    expect(none.ok).toBe(false)
    expect(!none.ok && none.missing).toHaveLength(10)
  })
})

describe('compiling the forecast', () => {
  const timesheet = [
    entry('ROSSI Mario Luigi', '2026-06-03', 8),
    entry('Rossi, Mario Luigi', '2026-06-04', 4),
    entry('Bianchi Anna', '2026-06-05', 16),
    entry('Verdi Luca', '2026-06-08', 8),
    entry('Rossi Mario', '2026-06-09', 8, 'P1', false),
    entry('Rossi Mario', '2026-07-01', 8),
    entry('Rossi Mario', '2026-06-10', 8, 'P7'),
    entry('Rossi Mario', '2026-06-10', 8, 'P8', false),
    entry('Rossi Mario', '2026-06-10', 8, null),
  ]

  it('prices the approved hours of the month as formulas that carry their value', () => {
    const forecast = compileForecast(modelOf(), timesheet, settingsWith(), '2026-06')
    const [row] = forecast.rows
    expect(row?.hours).toBe(36)
    expect(row?.cells.internalCosts).toEqual({
      kind: 'formula',
      formula: '2*250+1.5*200',
      value: 800,
    })
    expect(row?.cells.revenue).toEqual({ kind: 'formula', formula: '1.5*400', value: 600 })
    expect(row?.cells.externalCosts).toEqual({ kind: 'number', value: 0 })
    expect(row?.cells.quantity).toEqual({ kind: 'number', value: 4.5 })
    expect(row?.cells.marginMonth).toEqual({
      kind: 'formula',
      formula: 'IFERROR((G2-E2-F2)/G2,"")',
      value: (600 - 800) / 600,
    })
    expect(row?.cells.marginEnd).toEqual({ kind: 'empty' })
    expect(row?.cells.toInvoice).toEqual({ kind: 'number', value: 0 })
    expect(row?.note).toContain('timesheet approvati: 36 h = 4,5 gg')
    expect(row?.note).toContain('fuori dal calcolo: Verdi Luca')
    expect(forecast.gaps).toEqual([
      { kind: 'no_rate', code: 'P1', person: 'Bianchi Anna', hours: 16 },
      { kind: 'no_cost', code: 'P1', person: 'Verdi Luca', hours: 8 },
      { kind: 'no_total_costs', code: 'P1' },
    ])
    expect(forecast.notApprovedHours).toBe(8)
    expect(forecast.otherCodes).toEqual(['P7'])
  })

  it('writes zeros and says so for a code with no activity', () => {
    const forecast = compileForecast(modelOf(), timesheet, settingsWith(), '2026-06')
    const idle = forecast.rows[1]
    expect(idle?.note).toBe('nessuna attività nel mese')
    expect(idle?.values).toMatchObject({ internalCosts: 0, revenue: 0, marginMonth: null })
    expect(idle?.cells.marginMonth).toMatchObject({ kind: 'formula', value: null })
  })

  it('adds externals, the amount to invoice, the margin at the end and the note of the PM', () => {
    const settings = settingsWith({
      P1: {
        externals: [{ name: 'Studio Blu', days: 2.5, costPerDay: 300, ratePerDay: 500 }],
        toInvoice: 12000,
        totalCosts: 60000,
        note: 'SAL di giugno',
      },
    })
    const [row] = compileForecast(modelOf(), timesheet, settings, '2026-06').rows
    expect(row?.cells.externalCosts).toEqual({ kind: 'formula', formula: '2.5*300', value: 750 })
    expect(row?.cells.revenue).toEqual({
      kind: 'formula',
      formula: '1.5*400+2.5*500',
      value: 1850,
    })
    expect(row?.values.quantity).toBe(7)
    expect(row?.cells.toInvoice).toEqual({ kind: 'number', value: 12000 })
    expect(row?.cells.marginEnd).toEqual({
      kind: 'formula',
      formula: 'IFERROR((D2-60000)/D2,"")',
      value: 0.4,
    })
    expect(row?.note).toMatch(/Studio Blu: 2,5 gg dichiarati · SAL di giugno$/)
  })

  it('adds the costs of the month when the total stops at the month before', () => {
    const settings = settingsWith({ P1: { totalCosts: 50000, totalCostsBeforeMonth: true } })
    const [row] = compileForecast(modelOf(), timesheet, settings, '2026-06').rows
    expect(row?.cells.marginEnd).toEqual({
      kind: 'formula',
      formula: 'IFERROR((D2-(50000+E2+F2))/D2,"")',
      value: (100000 - 50800) / 100000,
    })
  })

  it('takes the revenue the PM decided instead of the computed one', () => {
    const settings = settingsWith({ P1: { revenue: 5000 }, P2: { revenue: 100 } })
    const forecast = compileForecast(modelOf(), timesheet, settings, '2026-06')
    expect(forecast.rows[0]?.cells.revenue).toEqual({ kind: 'number', value: 5000 })
    expect(forecast.rows[0]?.note).toContain('ricavi indicati dal PM')
    expect(forecast.gaps.some((gap) => gap.kind === 'no_rate')).toBe(false)
    expect(forecast.rows[1]?.note).toBe('ricavi indicati dal PM')
  })

  it('computes a fixed price as costs over the budget, on the ordered amount', () => {
    const settings = settingsWith({
      P1: {
        budgetCosts: 8000,
        externals: [{ name: 'Blu', days: 1, costPerDay: 0, ratePerDay: 9 }],
      },
      P3: {
        budgetCosts: 1000,
        externals: [{ name: 'Blu', days: 1, costPerDay: 100, ratePerDay: 0 }],
      },
    })
    const forecast = compileForecast(modelOf(), timesheet, settings, '2026-06')
    const [row, , unordered] = forecast.rows
    expect(row?.cells.quantity).toEqual({
      kind: 'formula',
      formula: '(E2+F2)/8000',
      value: 0.1,
      percent: true,
    })
    expect(row?.cells.revenue).toEqual({ kind: 'formula', formula: 'D2*H2', value: 10000 })
    expect(row?.values.quantityIsShare).toBe(true)
    expect(row?.note).toContain('avanzamento 10% = costi del mese / costi a budget 8.000')
    expect(unordered?.values.revenue).toBe(0)
    expect(forecast.gaps).toContainEqual({ kind: 'no_ordered', code: 'P3' })
  })

  it('does not guess between two rates that fit a name', () => {
    const rates = [
      { person: 'Rossi Mario', costPerDay: 200, ratePerDay: 400 },
      { person: 'Rossi Luigi', costPerDay: 100, ratePerDay: 300 },
    ]
    const forecast = compileForecast(modelOf(), timesheet, settingsWith({}, rates), '2026-06')
    expect(forecast.gaps).toContainEqual({
      kind: 'no_cost',
      code: 'P1',
      person: 'ROSSI Mario Luigi',
      hours: 12,
    })
  })
})

describe('the settings of the forecast', () => {
  it('keeps what is usable and drops the rest', () => {
    const clean = cleanForecastSettings({
      modelPath: '  modello.xlsx ',
      hoursPerDay: 0,
      rates: [
        { person: ' Rossi Mario ', costPerDay: 200, ratePerDay: -1 },
        { person: 'Mario Rossi', costPerDay: 210, ratePerDay: 400 },
        { person: '123', costPerDay: 1, ratePerDay: 1 },
        { person: 'Verdi', costPerDay: Number.NaN, ratePerDay: 1 },
      ],
      months: {
        '2026-06': {
          ' P1 ': {
            ...NO_ROW_INPUTS,
            externals: [
              { name: ' Blu ', days: 2, costPerDay: 300, ratePerDay: 500 },
              { name: '', days: 2, costPerDay: 300, ratePerDay: 500 },
              { name: 'Zero', days: 0, costPerDay: 300, ratePerDay: 500 },
              { name: 'Neg', days: 1, costPerDay: -3, ratePerDay: 500 },
            ],
            toInvoice: -5,
            budgetCosts: 0,
            note: ' nota ',
          },
          P2: NO_ROW_INPUTS,
        },
        '2026-07': { P1: NO_ROW_INPUTS },
        giugno: { P1: { ...NO_ROW_INPUTS, note: 'x' } },
      },
    })
    expect(clean).toEqual({
      modelPath: 'modello.xlsx',
      hoursPerDay: 8,
      rates: [{ person: 'Mario Rossi', costPerDay: 210, ratePerDay: 400 }],
      months: {
        '2026-06': {
          P1: {
            ...NO_ROW_INPUTS,
            externals: [{ name: 'Blu', days: 2, costPerDay: 300, ratePerDay: 500 }],
            note: 'nota',
          },
        },
      },
    })
    expect(
      cleanForecastSettings({ ...DEFAULT_FORECAST_SETTINGS, hoursPerDay: 7.5 }).hoursPerDay,
    ).toBe(7.5)
  })
})
