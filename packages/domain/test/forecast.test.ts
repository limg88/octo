import { describe, expect, it } from 'vitest'
import {
  cleanForecastSettings,
  compileForecast,
  DEFAULT_FORECAST_SETTINGS,
  type ForecastExternalRate,
  type ForecastModel,
  type ForecastProject,
  type ForecastRate,
  type ForecastRowInputs,
  type ForecastSettings,
  forecastFormulaAt,
  type HoursEntry,
  NO_FORECAST_PROJECT,
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

/** What an hour costs in the timesheets of these tests, unless a row says otherwise. */
const COST_PER_HOUR = 25

const entry = (
  person: string,
  day: string,
  hours: number,
  project: string | null = 'P1',
  approved = true,
  cost: number | null = hours * COST_PER_HOUR,
): HoursEntry => ({ person, day, hours, project, approved, id: null, cost })

const CODES = ['P1', 'P2', 'P3']
const project = (part: Partial<ForecastProject>): ForecastProject => ({
  ...NO_FORECAST_PROJECT,
  ...part,
})
const PROJECTS: Record<string, ForecastProject> = {
  P1: project({ ordered: 100000, description: 'Sviluppo' }),
  P2: project({ ordered: 50000 }),
}

const settingsWith = (
  rows: Record<string, Partial<ForecastRowInputs>> = {},
  rates: ForecastRate[] = [{ person: 'Rossi Mario', code: null, ratePerDay: 400 }],
  externals: ForecastExternalRate[] = [],
  projects: Record<string, ForecastProject> = PROJECTS,
): ForecastSettings => ({
  ...DEFAULT_FORECAST_SETTINGS,
  modelPath: 'modello.xlsx',
  projects,
  rates,
  externals,
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
      { number: 2, code: 'P1' },
      { number: 3, code: 'P2' },
      { number: 4, code: 'P3' },
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
    expect(model.rows).toEqual([{ number: 5, code: 'P9' }])
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

  it('puts the cells a formula names at a row of the sheet', () => {
    const { columns } = modelOf()
    expect(forecastFormulaAt('IFERROR(({revenue}-{internalCosts})/{revenue},"")', columns, 7)).toBe(
      'IFERROR((G7-E7)/G7,"")',
    )
    expect(forecastFormulaAt('{ordered}/12+{unknown}', columns, 2)).toBe('D2/12+{unknown}')
  })
})

describe('compiling the forecast', () => {
  const timesheet = [
    entry('ROSSI Mario Luigi', '2026-06-03', 8),
    entry('Rossi, Mario Luigi', '2026-06-04', 4),
    entry('Bianchi Anna', '2026-06-05', 16),
    entry('Verdi Luca', '2026-06-08', 8, 'P1', true, null),
    entry('Rossi Mario', '2026-06-09', 8, 'P1', false),
    entry('Rossi Mario', '2026-07-01', 8),
    entry('Rossi Mario', '2026-06-10', 8, 'P7'),
    entry('Rossi Mario', '2026-06-10', 8, 'P8', false),
    entry('Rossi Mario', '2026-06-10', 8, null),
  ]

  it('prices the approved hours of the month as formulas that carry their value', () => {
    const forecast = compileForecast(CODES, timesheet, settingsWith(), '2026-06')
    const [row] = forecast.rows
    expect(row).toMatchObject({
      code: 'P1',
      description: 'Sviluppo',
      revenueKind: 'time_material',
      ordered: 100000,
    })
    expect(row?.hours).toBe(36)
    expect(row?.cells.internalCosts).toEqual({
      kind: 'formula',
      formula: '400+300',
      value: 700,
    })
    expect(row?.cells.revenue).toEqual({ kind: 'formula', formula: '1.5*400', value: 600 })
    expect(row?.cells.externalCosts).toEqual({ kind: 'number', value: 0 })
    expect(row?.cells.quantity).toEqual({ kind: 'number', value: 4.5 })
    expect(row?.cells.marginMonth).toEqual({
      kind: 'formula',
      formula: 'IFERROR(({revenue}-{internalCosts}-{externalCosts})/{revenue},"")',
      value: (600 - 700) / 600,
    })
    expect(row?.cells.marginEnd).toEqual({ kind: 'empty' })
    expect(row?.cells.toInvoice).toEqual({ kind: 'number', value: 0 })
    expect(row?.note).toContain('timesheet approvati: 36 h = 4,5 gg')
    expect(row?.note).toContain('fuori dai costi: Verdi Luca')
    expect(forecast.gaps).toEqual([
      { kind: 'no_rate', code: 'P1', person: 'Bianchi Anna', hours: 16 },
      { kind: 'no_cost', code: 'P1', person: 'Verdi Luca', hours: 8 },
      { kind: 'no_rate', code: 'P1', person: 'Verdi Luca', hours: 8 },
      { kind: 'no_total_costs', code: 'P1' },
    ])
    expect(forecast.notApprovedHours).toBe(8)
    expect(forecast.otherCodes).toEqual(['P7'])
  })

  it('writes zeros and says so for a code with no activity', () => {
    const forecast = compileForecast(CODES, timesheet, settingsWith(), '2026-06')
    const idle = forecast.rows[1]
    expect(idle?.note).toBe('nessuna attività nel mese')
    expect(idle?.values).toMatchObject({ internalCosts: 0, revenue: 0, marginMonth: null })
    expect(idle?.cells.marginMonth).toMatchObject({ kind: 'formula', value: null })
  })

  it('adds externals, the amount to invoice, the margin at the end and the note of the PM', () => {
    const settings = settingsWith(
      {
        P1: {
          externals: [{ name: 'Blu Studio', hours: 20 }],
          toInvoice: 12000,
          totalCosts: 60000,
          note: 'SAL di giugno',
        },
      },
      undefined,
      [
        { name: 'Studio Blu', code: 'P1', costPerDay: 300, ratePerDay: 500 },
        { name: 'Studio Blu', code: 'P2', costPerDay: 1, ratePerDay: 1 },
      ],
    )
    const [row] = compileForecast(CODES, timesheet, settings, '2026-06').rows
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
      formula: 'IFERROR(({ordered}-60000)/{ordered},"")',
      value: 0.4,
    })
    expect(row?.note).toMatch(/Blu Studio: 2,5 gg dichiarati · SAL di giugno$/)
  })

  it('adds the costs of the month when the total stops at the month before', () => {
    const settings = settingsWith({ P1: { totalCosts: 50000, totalCostsBeforeMonth: true } })
    const [row] = compileForecast(CODES, timesheet, settings, '2026-06').rows
    expect(row?.cells.marginEnd).toEqual({
      kind: 'formula',
      formula: 'IFERROR(({ordered}-(50000+{internalCosts}+{externalCosts}))/{ordered},"")',
      value: (100000 - 50700) / 100000,
    })
  })

  it('takes the revenue the PM decided instead of the computed one', () => {
    const settings = settingsWith({ P1: { revenue: 5000 }, P2: { revenue: 100 } })
    const forecast = compileForecast(CODES, timesheet, settings, '2026-06')
    expect(forecast.rows[0]?.cells.revenue).toEqual({ kind: 'number', value: 5000 })
    expect(forecast.rows[0]?.note).toContain('ricavi indicati dal PM')
    expect(forecast.gaps.some((gap) => gap.kind === 'no_rate')).toBe(false)
    expect(forecast.rows[1]?.note).toBe('ricavi indicati dal PM')
  })

  it('computes a fixed price as the costs so far over the budget, on the ordered amount', () => {
    const settings = settingsWith(
      {
        P1: { budgetCosts: 8000, externals: [{ name: 'Blu', hours: 8 }] },
        P3: { budgetCosts: 1000, externals: [{ name: 'Blu', hours: 8 }] },
      },
      undefined,
      [
        { name: 'Blu', code: 'P1', costPerDay: 100, ratePerDay: 9 },
        { name: 'Blu', code: 'P3', costPerDay: 100, ratePerDay: 0 },
      ],
      {
        P1: project({ kind: 'fixed_price', ordered: 100000 }),
        P2: project({ kind: 'fixed_price', ordered: 50000 }),
        P3: project({ kind: 'fixed_price' }),
      },
    )
    const forecast = compileForecast(CODES, timesheet, settings, '2026-06')
    const [row, unbudgeted, unordered] = forecast.rows
    expect(row?.cells.quantity).toEqual({
      kind: 'formula',
      formula: 'MIN(1,(0+{internalCosts}+{externalCosts})/8000)',
      value: 0.1,
      percent: true,
    })
    expect(row?.cells.revenue).toEqual({
      kind: 'formula',
      formula: '{ordered}*({quantity}-0)',
      value: 10000,
    })
    expect(row?.values.quantityIsShare).toBe(true)
    expect(row?.note).toContain(
      'avanzamento 10% (mese prima 0%) = costi fino al mese / costi a budget 8.000',
    )
    // Fixed price: nobody is asked a rate.
    expect(forecast.gaps.some((gap) => gap.kind === 'no_rate')).toBe(false)
    expect(unbudgeted?.values).toMatchObject({ revenue: 0, quantity: 0, quantityIsShare: true })
    expect(unbudgeted?.cells.quantity).toEqual({ kind: 'empty' })
    expect(forecast.gaps).toContainEqual({ kind: 'no_budget_costs', code: 'P2' })
    expect(unordered?.values.revenue).toBe(0)
    expect(forecast.gaps).toContainEqual({ kind: 'no_ordered', code: 'P3' })
  })

  it('counts for a fixed price the months before, with the budget written last', () => {
    const months = [
      entry('Rossi Mario', '2026-05-04', 16),
      entry('Rossi Mario', '2026-05-05', 8, 'P1', false),
      entry('Rossi Mario', '2026-06-03', 16),
    ]
    const fixed = { P1: project({ kind: 'fixed_price', ordered: 100000 }) }
    const settings: ForecastSettings = {
      ...settingsWith({}, [], [{ name: 'Blu', code: 'P1', costPerDay: 100, ratePerDay: 0 }], fixed),
      months: {
        '2026-04': { P1: { ...NO_ROW_INPUTS, budgetCosts: 99 } },
        '2026-05': {
          P1: { ...NO_ROW_INPUTS, budgetCosts: 4000, externals: [{ name: 'Blu', hours: 8 }] },
        },
        '2026-07': { P1: { ...NO_ROW_INPUTS, budgetCosts: 1 } },
      },
    }
    const [row] = compileForecast(['p1 '], months, settings, '2026-06').rows
    // May: 400 of hours and 100 of the external; June: 400 more, on 4.000 at budget.
    expect(row?.cells.quantity).toMatchObject({
      formula: 'MIN(1,(500+{internalCosts}+{externalCosts})/4000)',
      percent: true,
    })
    expect(row?.values.quantity).toBeCloseTo(0.225)
    expect(row?.cells.revenue).toMatchObject({ formula: '{ordered}*({quantity}-0.125)' })
    expect(row?.values.revenue).toBeCloseTo(10000)

    // Costs beyond the budget stop at the whole order.
    const small = {
      ...settings,
      months: { '2026-05': { P1: { ...NO_ROW_INPUTS, budgetCosts: 800 } } },
    }
    const [capped] = compileForecast(['P1'], months, small, '2026-06').rows
    expect(capped?.values.quantity).toBe(1)
    expect(capped?.values.revenue).toBeCloseTo(50000)
  })

  it('spreads a fee in equal monthly parts, whatever was worked', () => {
    const fees = {
      P1: project({ kind: 'fee', ordered: 22500, feeMonths: 12 }),
      P2: project({ kind: 'fee', ordered: 6000 }),
      P3: project({ kind: 'fee', feeMonths: 12 }),
    }
    const forecast = compileForecast(CODES, timesheet, settingsWith({}, [], [], fees), '2026-06')
    const [row, noMonths, unordered] = forecast.rows
    expect(row?.cells.revenue).toEqual({ kind: 'formula', formula: '{ordered}/12', value: 1875 })
    expect(row?.cells.quantity).toEqual({ kind: 'number', value: 1 / 12, percent: true })
    expect(row?.values).toMatchObject({ internalCosts: 700, quantityIsShare: true })
    expect(row?.note).toContain('canone: ordinato in 12 rate mensili')
    expect(noMonths?.values.revenue).toBe(0)
    expect(unordered?.note).toBe('canone: ordinato in 12 rate mensili')
    expect(forecast.gaps).toContainEqual({ kind: 'no_fee_months', code: 'P2' })
    expect(forecast.gaps).toContainEqual({ kind: 'no_ordered', code: 'P3' })
    expect(forecast.gaps.some((gap) => gap.kind === 'no_rate')).toBe(false)

    // What the PM wrote wins over the fee too.
    const decided = settingsWith({ P1: { revenue: 2000 } }, [], [], fees)
    const [own] = compileForecast(CODES, timesheet, decided, '2026-06').rows
    expect(own?.cells.revenue).toEqual({ kind: 'number', value: 2000 })
    expect(own?.values.quantity).toBeCloseTo(1 / 12)
  })

  it('does not guess between two rates that fit a name', () => {
    const rates = [
      { person: 'Rossi Mario', code: null, ratePerDay: 400 },
      { person: 'Rossi Luigi', code: null, ratePerDay: 300 },
    ]
    const forecast = compileForecast(CODES, timesheet, settingsWith({}, rates), '2026-06')
    expect(forecast.gaps).toContainEqual({
      kind: 'no_rate',
      code: 'P1',
      person: 'ROSSI Mario Luigi',
      hours: 12,
    })
  })
})

describe('rates by project code and externals', () => {
  const hours = [
    entry('Rossi Mario', '2026-06-03', 8, 'P1'),
    entry('Rossi Mario', '2026-06-04', 8, 'P2'),
  ]

  it('uses the rate written for the code, and the person’s own where there is none', () => {
    const rates = [
      { person: 'Rossi Mario', code: null, ratePerDay: 400 },
      { person: 'Mario Rossi', code: 'P2', ratePerDay: 630 },
    ]
    const forecast = compileForecast(CODES, hours, settingsWith({}, rates), '2026-06')
    expect(forecast.rows[0]?.cells.revenue).toMatchObject({ formula: '1*400', value: 400 })
    expect(forecast.rows[1]?.cells.revenue).toMatchObject({ formula: '1*630', value: 630 })
    // A rate written for another code only is not this person's rate here.
    const onlyP2 = settingsWith({}, [{ person: 'Rossi Mario', code: 'P2', ratePerDay: 630 }])
    expect(compileForecast(CODES, hours, onlyP2, '2026-06').gaps).toContainEqual({
      kind: 'no_rate',
      code: 'P1',
      person: 'Rossi Mario',
      hours: 8,
    })
  })

  it('takes the cost from the rows: what a row lacks is out of the costs, not of the revenue', () => {
    const mixed = [
      entry('Rossi Mario', '2026-06-03', 8, 'P1', true, 210.456),
      entry('Rossi Mario', '2026-06-04', 4, 'P1', true, null),
      {
        person: 'Rossi Mario',
        day: '2026-06-05',
        hours: 4,
        project: 'P1',
        approved: true,
        id: null,
      },
    ]
    const forecast = compileForecast(CODES, mixed, settingsWith(), '2026-06')
    expect(forecast.rows[0]?.cells.internalCosts).toEqual({
      kind: 'formula',
      formula: '210.46',
      value: 210.456,
    })
    expect(forecast.rows[0]?.cells.revenue).toMatchObject({ formula: '2*400', value: 800 })
    expect(forecast.gaps).toContainEqual({
      kind: 'no_cost',
      code: 'P1',
      person: 'Rossi Mario',
      hours: 8,
    })
  })

  it('leaves out an external with hours and no cost and rate for that code, and says so', () => {
    const settings = settingsWith({ P1: { externals: [{ name: 'Blu', hours: 16 }] } }, undefined, [
      { name: 'Blu', code: 'P2', costPerDay: 300, ratePerDay: 500 },
    ])
    const forecast = compileForecast(CODES, [], settings, '2026-06')
    expect(forecast.rows[0]?.values).toMatchObject({ externalCosts: 0, revenue: 0, quantity: 0 })
    expect(forecast.rows[0]?.note).toContain(
      'esterni senza costo e tariffa, fuori dal calcolo: Blu',
    )
    expect(forecast.gaps).toContainEqual({
      kind: 'no_external_rate',
      code: 'P1',
      person: 'Blu',
      hours: 16,
    })
  })
})

describe('the settings of the forecast', () => {
  it('keeps what is usable and drops the rest', () => {
    const clean = cleanForecastSettings({
      modelPath: '  modello.xlsx ',
      projects: {
        ' p1 ': { kind: 'fee', description: ' Canone ', ordered: -1, feeMonths: 1.5 },
        P2: { kind: 'fixed_price', description: '', ordered: 5000, feeMonths: 12 },
        ' ': NO_FORECAST_PROJECT,
        P3: { ...NO_FORECAST_PROJECT, kind: 'altro' as ForecastProject['kind'] },
      },
      hoursPerDay: 0,
      rates: [
        { person: ' Rossi Mario ', code: null, ratePerDay: -1 },
        { person: 'Rossi Mario', code: null, ratePerDay: 380 },
        { person: 'Mario Rossi', code: ' ', ratePerDay: 400 },
        { person: 'Mario Rossi', code: ' p2 ', ratePerDay: 630 },
        { person: '123', code: null, ratePerDay: 1 },
        { person: 'Verdi', code: null, ratePerDay: Number.NaN },
      ],
      externals: [
        { name: ' Blu ', code: ' p1 ', costPerDay: 300, ratePerDay: 500 },
        { name: 'Blu', code: 'P1', costPerDay: 310, ratePerDay: 500 },
        { name: 'Blu', code: '', costPerDay: 300, ratePerDay: 500 },
        { name: '', code: 'P1', costPerDay: 300, ratePerDay: 500 },
        { name: 'Neg', code: 'P1', costPerDay: -3, ratePerDay: 500 },
      ],
      months: {
        '2026-06': {
          ' P1 ': {
            ...NO_ROW_INPUTS,
            externals: [
              { name: ' Blu ', hours: 16 },
              { name: '', hours: 16 },
              { name: 'Zero', hours: 0 },
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
      projects: {
        P1: { kind: 'fee', description: 'Canone', ordered: null, feeMonths: null },
        P2: { kind: 'fixed_price', description: '', ordered: 5000, feeMonths: 12 },
        P3: NO_FORECAST_PROJECT,
      },
      hoursPerDay: 8,
      rates: [
        { person: 'Mario Rossi', code: null, ratePerDay: 400 },
        { person: 'Mario Rossi', code: 'P2', ratePerDay: 630 },
      ],
      externals: [{ name: 'Blu', code: 'P1', costPerDay: 310, ratePerDay: 500 }],
      months: {
        '2026-06': {
          P1: {
            ...NO_ROW_INPUTS,
            externals: [{ name: 'Blu', hours: 16 }],
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
