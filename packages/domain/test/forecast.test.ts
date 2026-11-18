import { describe, expect, it } from 'vitest'
import {
  budgetFromCaps,
  cleanForecastSettings,
  compileForecast,
  compileLifetime,
  DEFAULT_FORECAST_SETTINGS,
  type ForecastExternalRate,
  type ForecastModel,
  type ForecastProject,
  type ForecastRate,
  type ForecastRowInputs,
  type ForecastSettings,
  type ForecastWorklog,
  forecastFormulaAt,
  forecastKindOfItems,
  forecastMonthsBetween,
  type HoursEntry,
  hourlyCostsOf,
  NO_FORECAST_PROJECT,
  NO_ROW_INPUTS,
  readForecastModel,
  type SheetGrid,
  unreadForecastMonths,
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
      { kind: 'no_rate', code: 'P1', person: 'Bianchi Anna', hours: 16, proposed: null },
      { kind: 'no_cost', code: 'P1', person: 'Verdi Luca', hours: 8 },
      { kind: 'no_rate', code: 'P1', person: 'Verdi Luca', hours: 8, proposed: null },
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

  it('says which months of timesheets a fixed price misses instead of counting them as zero', () => {
    // The work began in September (34 h); only October (21,5 h) was read from the company's system.
    const september = entry('Rossi Mario', '2026-09-15', 34)
    const october = entry('Rossi Mario', '2026-10-06', 21.5)
    const fixed = {
      P1: project({ kind: 'fixed_price', ordered: 7500, startMonth: '2026-09' }),
    }
    const settings: ForecastSettings = {
      ...settingsWith({}, [], [], fixed),
      months: { '2026-10': { P1: { ...NO_ROW_INPUTS, budgetCosts: 4000 } } },
    }
    const compile = (rows: HoursEntry[], month: string, read: string[] | null) =>
      compileForecast(['P1'], rows, settings, month, undefined, read)

    // Everything read: 850 of September and 537,50 of October over 4.000 at budget.
    const whole = compile([september, october], '2026-10', ['2026-09', '2026-10'])
    expect(whole.rows[0]?.values.quantity).toBeCloseTo(0.346875)
    expect(whole.unreadMonths).toEqual([])
    expect(whole.gaps).toEqual([{ kind: 'no_total_costs', code: 'P1' }])

    // September not read: the progress is lower than the true one, and the forecast says why.
    const partial = compile([october], '2026-10', ['2026-10'])
    expect(partial.rows[0]?.values.quantity).toBeCloseTo(0.134375)
    expect(partial.unreadMonths).toEqual(['2026-09'])
    expect(partial.gaps).toContainEqual({ kind: 'unread_months', code: 'P1', months: ['2026-09'] })
    expect(partial.rows[0]?.note).toContain('timesheet non letti, costi incompleti: 2026-09')

    // The month nobody read is not a month with no activity.
    const unreadMonth = compile([october], '2026-09', ['2026-10'])
    expect(unreadMonth.rows[0]?.note).not.toContain('nessuna attività nel mese')
    expect(unreadMonth.unreadMonths).toEqual(['2026-09'])
    // A month read with no hours is: nothing was worked.
    const idle = compile([october], '2026-09', ['2026-09', '2026-10'])
    expect(idle.rows[0]?.note).toContain('nessuna attività nel mese')

    // Files kept by hand: which months were read cannot be told, nothing is said to miss.
    expect(compile([october], '2026-10', null).unreadMonths).toEqual([])
  })

  it('needs of a code sold by days its own month only, and lists the months between two', () => {
    expect(unreadForecastMonths(null, '2026-10', ['2026-09'])).toEqual(['2026-10'])
    expect(unreadForecastMonths('2026-11', '2026-10', [])).toEqual(['2026-10'])
    expect(unreadForecastMonths('2025-11', '2026-02', ['2025-12'])).toEqual([
      '2025-11',
      '2026-01',
      '2026-02',
    ])
    expect(forecastMonthsBetween('2026-03', '2026-02')).toEqual([])
    expect(forecastMonthsBetween('marzo', '2026-02')).toEqual([])
    // Days sold: the start of the code changes nothing, the month of the forecast is what counts.
    const days = { P1: project({ ordered: 1000, startMonth: '2026-01' }) }
    const forecast = compileForecast(
      ['P1'],
      [],
      settingsWith({}, [], [], days),
      '2026-06',
      undefined,
      ['2026-06'],
    )
    expect(forecast.unreadMonths).toEqual([])
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
      proposed: null,
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
    // A rate written for another code only is not this person's rate here: it is proposed.
    const onlyP2 = settingsWith({}, [{ person: 'Rossi Mario', code: 'P2', ratePerDay: 630 }])
    expect(compileForecast(CODES, hours, onlyP2, '2026-06').gaps).toContainEqual({
      kind: 'no_rate',
      code: 'P1',
      person: 'Rossi Mario',
      hours: 8,
      proposed: { code: 'P2', ratePerDay: 630 },
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

describe('how a project is sold, by the items of its orders', () => {
  it('knows the item of a fixed price and the one of the days sold', () => {
    expect(forecastKindOfItems(['PROG-CORPO'])).toBe('fixed_price')
    expect(forecastKindOfItems([' prog-corpo ', 'PROG-CORPO'])).toBe('fixed_price')
    expect(forecastKindOfItems(['SERVPRO'])).toBe('time_material')
    // An item that says nothing does not hide the one that does.
    expect(forecastKindOfItems(['Trasferta', 'SERVPRO'])).toBe('time_material')
  })

  it('knows the items of a fee and of a licence, and leaves alone the one sold both ways', () => {
    for (const item of [
      'SERV - CAN',
      'serv - can ass. mnt',
      'CAN SU SW PROPRI',
      'CAN SU SW TERZI',
      'LIC SW TER',
    ]) {
      expect(forecastKindOfItems([item])).toBe('fee')
    }
    // Sold by the day on some projects and at a fixed price on as many: it tells nothing.
    expect(forecastKindOfItems(['SERVPRO-N'])).toBeNull()
    // A fee with days sold beside it is two things: the PM says which.
    expect(forecastKindOfItems(['SERV - CAN', 'SERVPRO'])).toBeNull()
  })

  it('says nothing when the orders do not tell, or tell two things', () => {
    expect(forecastKindOfItems([])).toBeNull()
    expect(forecastKindOfItems(['Servizi'])).toBeNull()
    expect(forecastKindOfItems(['PROG-CORPO', 'SERVPRO'])).toBeNull()
  })
})

describe('the settings of the forecast', () => {
  it('keeps what is usable and drops the rest', () => {
    const clean = cleanForecastSettings({
      modelPath: '  modello.xlsx ',
      projects: {
        ' p1 ': {
          kind: 'fee',
          description: ' Canone ',
          ordered: -1,
          feeMonths: 1.5,
          startMonth: 'settembre',
          invoiced: null,
          recognized: null,
        },
        P2: {
          kind: 'fixed_price',
          description: '',
          ordered: 5000,
          feeMonths: 12,
          startMonth: ' 2026-09 ',
          invoiced: null,
          recognized: null,
        },
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
      hourlyCosts: [
        { person: ' Verdi Sara ', costPerHour: 60 },
        { person: 'Sara Verdi', costPerHour: 70 },
        { person: 'Zero', costPerHour: 0 },
        { person: '', costPerHour: 50 },
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
        P1: {
          kind: 'fee',
          description: 'Canone',
          ordered: null,
          feeMonths: null,
          startMonth: null,
          invoiced: null,
          recognized: null,
        },
        P2: {
          kind: 'fixed_price',
          description: '',
          ordered: 5000,
          feeMonths: 12,
          startMonth: '2026-09',
          invoiced: null,
          recognized: null,
        },
        P3: NO_FORECAST_PROJECT,
      },
      hoursPerDay: 8,
      rates: [
        { person: 'Mario Rossi', code: null, ratePerDay: 400 },
        { person: 'Mario Rossi', code: 'P2', ratePerDay: 630 },
      ],
      externals: [{ name: 'Blu', code: 'P1', costPerDay: 310, ratePerDay: 500 }],
      // One cost per person, the last written; a cost of nothing is not one.
      hourlyCosts: [{ person: 'Sara Verdi', costPerHour: 70 }],
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

describe('a project code over its whole life', () => {
  // The sheet a PM keeps by hand for a fixed price: 68 hours, 7.500 ordered, 30% invoiced.
  const rows = [
    entry('Rossi Anna', '2026-09-10', 20, 'P1', true, 1000),
    entry('Rossi Anna', '2026-10-05', 14, 'P1', true, 700),
    entry('Bianchi Luca', '2026-10-06', 21.5, 'P1', true, 990),
    entry('Bianchi Luca', '2026-11-03', 4.5, 'P1', true, 207),
    // Left out: not approved, of another code, after the month asked, without a cost.
    entry('Bianchi Luca', '2026-11-04', 3, 'P1', false, 138),
    entry('Bianchi Luca', '2026-10-07', 8, 'P2', true, 368),
    entry('Rossi Anna', '2026-12-01', 8, 'P1', true, 400),
    entry('Neri Ugo', '2026-10-08', 2, 'P1', true, null),
  ]
  const settings: ForecastSettings = {
    ...DEFAULT_FORECAST_SETTINGS,
    projects: {
      P1: project({
        kind: 'fixed_price',
        description: 'Assessment Aurora',
        ordered: 7500,
        startMonth: '2026-09',
        invoiced: 2250,
        recognized: 5250,
      }),
    },
    externals: [{ name: 'Verdi Sara', code: 'P1', costPerDay: 560, ratePerDay: 0 }],
    months: {
      '2026-09': { P1: { ...NO_ROW_INPUTS, budgetCosts: 4000 } },
      '2026-10': {
        P1: { ...NO_ROW_INPUTS, budgetCosts: 4800, externals: [{ name: 'Verdi Sara', hours: 8 }] },
      },
      '2026-11': { P1: { ...NO_ROW_INPUTS, externals: [{ name: 'Studio Blu', hours: 4 }] } },
      '2026-12': { P1: { ...NO_ROW_INPUTS, budgetCosts: 1 } },
    },
  }

  it('lists who worked how much and at what cost, with the margins a PM computes by hand', () => {
    const life = compileLifetime(' p1 ', rows, settings, '2026-11', [
      '2026-09',
      '2026-10',
      '2026-11',
    ])
    expect(life.lines).toEqual([
      // Every hour at what an hour costs today: 26 hours at the 46 of November, not 990 + 207.
      { person: 'Bianchi Luca', hours: 26, cost: 1196, source: 'timesheet', months: [] },
      { person: 'Neri Ugo', hours: 2, cost: null, source: 'timesheet', months: [] },
      { person: 'Rossi Anna', hours: 34, cost: 1700, source: 'timesheet', months: [] },
      // Who has no timesheet, as the PM declared them; without a cost written, hours only.
      { person: 'Studio Blu', hours: 4, cost: null, source: 'declared', months: [] },
      { person: 'Verdi Sara', hours: 8, cost: 560, source: 'declared', months: [] },
    ])
    expect(life).toMatchObject({
      code: 'P1',
      description: 'Assessment Aurora',
      kind: 'fixed_price',
      through: '2026-11',
      ordered: 7500,
      invoiced: 2250,
      recognized: 5250,
      hours: 74,
      costs: 3456,
      budgetCosts: 4800,
      expectedCosts: 4800,
      notApprovedHours: 3,
      unreadMonths: [],
    })
    expect(life.marginToDate).toBeCloseTo((7500 - 3456) / 7500)
    expect(life.progress).toBeCloseTo(3456 / 4800)
    expect(life.marginAtEnd).toBeCloseTo((7500 - 4800) / 7500)
  })

  it('takes the costs the PM expects when written, never less than what was spent', () => {
    const expected = (totalCosts: number): ForecastSettings => ({
      ...settings,
      months: { ...settings.months, '2026-11': { P1: { ...NO_ROW_INPUTS, totalCosts } } },
    })
    const months = ['2026-09', '2026-10', '2026-11']
    const planned = compileLifetime('P1', rows, expected(5000), '2026-11', months)
    expect(planned.expectedCosts).toBe(5000)
    expect(planned.marginAtEnd).toBeCloseTo(2500 / 7500)
    // Already spent more than expected: the margin at the end is the one of today.
    const overrun = compileLifetime('P1', rows, expected(1000), '2026-11', months)
    expect(overrun.marginAtEnd).toBeCloseTo(overrun.marginToDate ?? 0)
    expect(
      compileLifetime('P1', rows, { ...settings, months: {} }, '2026-11', months),
    ).toMatchObject({ budgetCosts: null, progress: null, expectedCosts: null, marginAtEnd: null })
    // Costs beyond the budget stop at the whole.
    const small = {
      ...settings,
      months: { '2026-09': { P1: { ...NO_ROW_INPUTS, budgetCosts: 100 } } },
    }
    expect(compileLifetime('P1', rows, small, '2026-11', months).progress).toBe(1)
  })

  it('says the months it misses, and leaves the margins empty for a code nothing is known of', () => {
    expect(compileLifetime('P1', rows, settings, '2026-11', ['2026-10']).unreadMonths).toEqual([
      '2026-09',
      '2026-11',
    ])
    const unknown = compileLifetime('P9', rows, settings, '2026-11')
    expect(unknown).toMatchObject({
      code: 'P9',
      kind: 'time_material',
      lines: [],
      hours: 0,
      costs: 0,
      ordered: null,
      marginToDate: null,
      invoiced: null,
      recognized: null,
      unreadMonths: [],
    })
  })
})

describe('hours the timesheets do not hold', () => {
  // The sheet of the PM: 55,5 h in the timesheets of September and October, 4,5 h of November
  // logged on the tracker and not yet in the company's system, 8 h of who has no timesheet.
  const rows = [
    entry('Rossi Anna', '2026-09-10', 34, 'P1', true, 1700),
    entry('Bianchi Luca', '2026-09-12', 10, 'P1', true, 400),
    entry('Bianchi Luca', '2026-10-06', 11.5, 'P1', true, 529),
    // Another code: it tells what an hour costs, not what was worked here.
    entry('Costa Elena', '2026-10-06', 8, 'P9', true, 480),
  ]
  const logged = (person: string, day: string, hours: number) => ({
    issue: 'AUR-3',
    person,
    day,
    hours,
  })
  const worklog: ForecastWorklog = {
    code: 'P1',
    entries: [
      // September and October are in the timesheets: what was logged then is not counted again.
      logged('Luca Bianchi', '2026-10-06', 11.5),
      logged('luca.bianchi', '2026-11-03', 4.5),
      logged('Elena Costa', '2026-11-04', 2),
      logged('Ugo Neri', '2026-11-05', 1),
      // No timesheet at all: every month counts, at the cost the PM wrote.
      logged('Sara Verdi', '2026-10-20', 5),
      logged('Sara Verdi', '2026-11-06', 3),
      logged('Sara Verdi', '2026-12-01', 9),
    ],
  }
  const settings: ForecastSettings = {
    ...DEFAULT_FORECAST_SETTINGS,
    projects: { P1: project({ kind: 'fixed_price', ordered: 7500, startMonth: '2026-09' }) },
    hourlyCosts: [{ person: 'Verdi Sara', costPerHour: 70 }],
    months: { '2026-09': { P1: { ...NO_ROW_INPUTS, budgetCosts: 4000 } } },
  }
  const READ = ['2026-09', '2026-10', '2026-11']

  it('tells what an hour of each person costs by their last month of timesheets', () => {
    const costs = hourlyCostsOf([
      ...rows,
      entry('Bianchi Luca', '2026-10-07', 8, 'P1', false, 999),
      entry('Bianchi Luca', '2026-10-08', 0, 'P1', true, 5),
      entry('Neri Ugo', '2026-10-08', 2, 'P1', true, null),
    ])
    expect(costs.get('anna rossi')).toBe(50)
    // October, not September: 529 over 11,5 hours.
    expect(costs.get('bianchi luca')).toBe(46)
    expect(costs.get('costa elena')).toBe(60)
    expect(costs.has('neri ugo')).toBe(false)
  })

  it('estimates the months not yet in the timesheets from the tracker, and says it is an estimate', () => {
    const life = compileLifetime('P1', rows, settings, '2026-11', READ, worklog)
    expect(life.lines).toEqual([
      { person: 'Bianchi Luca', hours: 21.5, cost: 989, source: 'timesheet', months: [] },
      { person: 'Rossi Anna', hours: 34, cost: 1700, source: 'timesheet', months: [] },
      // Who has no timesheet: October and November, not December which is still to come.
      { person: 'Sara Verdi', hours: 8, cost: 560, source: 'no_timesheet', months: [] },
      // November only, at the cost of an hour of the last timesheet of each.
      // Called as the timesheets call them, whatever user name the tracker writes.
      { person: 'Bianchi Luca', hours: 4.5, cost: 207, source: 'estimate', months: ['2026-11'] },
      { person: 'Costa Elena', hours: 2, cost: 120, source: 'estimate', months: ['2026-11'] },
      // Never in a timesheet and no cost written: the hours are there, the cost is not.
      { person: 'Ugo Neri', hours: 1, cost: null, source: 'estimate', months: ['2026-11'] },
    ])
    expect(life).toMatchObject({ hours: 71, costs: 3576, estimatedHours: 7.5, estimatedCosts: 327 })
    expect(life.marginToDate).toBeCloseTo((7500 - 3576) / 7500)
  })

  it('counts nothing from the tracker when its hours are of another code, or of none', () => {
    for (const code of ['P9', null]) {
      const life = compileLifetime('P1', rows, settings, '2026-11', READ, { ...worklog, code })
      expect(life.lines.map((line) => line.source)).toEqual(['timesheet', 'timesheet'])
      expect(life).toMatchObject({ estimatedHours: 0, estimatedCosts: 0, costs: 2689 })
    }
    expect(compileLifetime('P1', rows, settings, '2026-11', READ).estimatedHours).toBe(0)
    // Who the PM said has no timesheet and has one after all is counted by the timesheet only.
    const both = { ...settings, hourlyCosts: [{ person: 'Rossi Anna', costPerHour: 99 }] }
    const anna = { code: 'P1', entries: [logged('Anna Rossi', '2026-09-10', 34)] }
    expect(compileLifetime('P1', rows, both, '2026-11', READ, anna).costs).toBe(2689)
  })

  it('counts in a month, beside the externals, who has no timesheet by the hours logged', () => {
    const month = (at: string) =>
      compileForecast(['P1'], rows, settings, at, undefined, READ, worklog).rows[0]
    const october = month('2026-10')
    // 5 hours at 70; the estimates of the months to come are never in a month.
    expect(october?.values).toMatchObject({ internalCosts: 529, externalCosts: 350 })
    expect(october?.cells.externalCosts).toEqual({ kind: 'formula', formula: '5*70', value: 350 })
    expect(october?.note).toContain('Sara Verdi: 5 h dal tracker, senza timesheet, a costo orario')
    // The progress counts them in the months before too: (2.100 + 529 + 350) over 4.000.
    expect(october?.values.quantity).toBeCloseTo(2979 / 4000)
    const november = month('2026-11')
    expect(november?.values).toMatchObject({ internalCosts: 0, externalCosts: 210 })
    // Worked, though no timesheet says so.
    expect(november?.note).not.toContain('nessuna attività nel mese')
    expect(november?.values.quantity).toBeCloseTo(3189 / 4000)
    const without = compileForecast(['P1'], rows, settings, '2026-10', undefined, READ).rows[0]
    expect(without?.values.externalCosts).toBe(0)
  })
})

describe('the costs at budget the caps of the people propose', () => {
  // Three people with a cap in days: 2, 8 and 1,5. An hour of theirs costs 50, 46 and 70.
  const rows = [
    entry('Rossi Anna', '2026-09-10', 34, 'P1', true, 1700),
    entry('Bianchi Luca', '2026-10-06', 11.5, 'P1', true, 529),
  ]
  const settings: ForecastSettings = {
    ...DEFAULT_FORECAST_SETTINGS,
    projects: { P1: project({ kind: 'fixed_price', ordered: 7500 }) },
    hourlyCosts: [{ person: 'Verdi Sara', costPerHour: 70 }],
  }
  const caps = [
    { person: 'Anna Rossi', days: 2 },
    { person: 'Luca Bianchi', days: 8 },
    { person: 'Sara Verdi', days: 1.5 },
  ]

  it('are the days of each cap at what an hour of the person costs', () => {
    const proposal = budgetFromCaps(caps, rows, settings)
    // 2 × 8 × 50 + 8 × 8 × 46 + 1,5 × 8 × 70.
    expect(proposal).toEqual({
      costs: 800 + 2944 + 840,
      people: [
        { person: 'Anna Rossi', days: 2, costPerHour: 50 },
        { person: 'Luca Bianchi', days: 8, costPerHour: 46 },
        { person: 'Sara Verdi', days: 1.5, costPerHour: 70 },
      ],
      withoutCost: [],
    })
    // A day of other hours changes the proposal with it.
    expect(budgetFromCaps(caps, rows, { ...settings, hoursPerDay: 7.5 })?.costs).toBeCloseTo(
      (800 + 2944 + 840) * (7.5 / 8),
    )
  })

  it('leave out who has no cost of an hour, and say nothing when nobody has one or a cap', () => {
    const partial = budgetFromCaps([...caps, { person: 'Ugo Neri', days: 3 }], rows, settings)
    expect(partial?.withoutCost).toEqual(['Ugo Neri'])
    expect(partial?.costs).toBe(4584)
    expect(budgetFromCaps([], rows, settings)).toBeNull()
    expect(budgetFromCaps([{ person: 'Ugo Neri', days: 3 }], rows, settings)).toBeNull()
  })

  it('go with the life of the code, beside the costs at budget the PM wrote', () => {
    const life = compileLifetime('P1', rows, settings, '2026-11', null, undefined, caps)
    expect(life.proposedBudget?.costs).toBe(4584)
    expect(life.budgetCosts).toBeNull()
    expect(compileLifetime('P1', rows, settings, '2026-11').proposedBudget).toBeNull()
  })
})

describe('a new code of a project that sells days', () => {
  // The same people move from one code to the next: the new one has no rate yet.
  const rows = [
    entry('Rossi Mario', '2026-10-05', 16, 'PI7'),
    entry('Bianchi Anna', '2026-10-05', 8, 'PI7'),
    entry('Neri Ugo', '2026-10-05', 8, 'PI7'),
    entry('Rossi Mario', '2026-10-06', 8, 'PI6'),
  ]
  const settings: ForecastSettings = {
    ...DEFAULT_FORECAST_SETTINGS,
    rates: [
      { person: 'Rossi Mario', code: 'PI5', ratePerDay: 370 },
      { person: 'Mario Rossi', code: 'PI6', ratePerDay: 400 },
      { person: 'Bianchi Anna', code: 'PI5', ratePerDay: 430 },
    ],
    months: {
      '2026-10': {
        PI6: { ...NO_ROW_INPUTS, note: 'ultimo mese' },
        ' old1 ': { ...NO_ROW_INPUTS, externals: [{ name: 'Studio Blu', hours: 174 }] },
      },
      '2026-09': { OLD2: { ...NO_ROW_INPUTS, toInvoice: 100 } },
    },
  }

  it('is proposed, for each person without a rate, the rate of the code written last', () => {
    const forecast = compileForecast(['PI6', 'PI7'], rows, settings, '2026-10')
    expect(forecast.gaps.filter((gap) => gap.kind === 'no_rate')).toEqual([
      {
        kind: 'no_rate',
        code: 'PI7',
        person: 'Bianchi Anna',
        hours: 8,
        proposed: { code: 'PI5', ratePerDay: 430 },
      },
      // Nobody ever wrote a rate for this person: nothing to propose.
      { kind: 'no_rate', code: 'PI7', person: 'Neri Ugo', hours: 8, proposed: null },
      // Two codes before: the one written last, whatever the order of the name.
      {
        kind: 'no_rate',
        code: 'PI7',
        person: 'Rossi Mario',
        hours: 16,
        proposed: { code: 'PI6', ratePerDay: 400 },
      },
    ])
    // A proposal is not a rate: the revenue of the new code stays out until the PM takes it.
    expect(forecast.rows.find((row) => row.code === 'PI7')?.values.revenue).toBe(0)
  })

  it('says which codes hold data of the month and are not of the project', () => {
    expect(compileForecast(['PI6', 'PI7'], rows, settings, '2026-10').orphanCodes).toEqual(['OLD1'])
    // Another month, other data; a code of the project is never an orphan.
    expect(compileForecast(['PI6', 'PI7'], rows, settings, '2026-09').orphanCodes).toEqual(['OLD2'])
    expect(compileForecast(['PI6', 'old1'], rows, settings, '2026-10').orphanCodes).toEqual([])
    expect(compileForecast(['PI6'], rows, settings, '2026-08').orphanCodes).toEqual([])
  })
})
