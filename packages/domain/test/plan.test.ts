import { describe, expect, it } from 'vitest'
import {
  cleanSheetPlans,
  confirmedPlan,
  DEFAULT_FORECAST_SETTINGS,
  type ForecastSettings,
  type HoursEntry,
  NO_SHEET_PLAN,
  NO_SHEET_REGISTRY,
  type PlanLine,
  planMargin,
  planView,
  proposedPlan,
  type SheetPlan,
  settingsWithPlans,
  sheetDataCsv,
  sheetDataRows,
  standingOf,
} from '../src/index.ts'

const hours = (person: string, day: string, worked: number, approved = true): HoursEntry => ({
  person,
  day,
  hours: worked,
  project: 'P1',
  approved,
  id: null,
  cost: null,
})
const line = (more: Partial<PlanLine> & Pick<PlanLine, 'group' | 'name'>): PlanLine => ({
  unitCost: null,
  unitPrice: null,
  budget: {},
  forecast: {},
  declared: {},
  ...more,
})

const plan: SheetPlan = {
  ...NO_SHEET_PLAN,
  lines: [
    line({
      group: 'internal',
      name: 'Rossi Mario',
      unitPrice: 60,
      budget: { '2026-09': 40, '2026-10': 40, '2026-11': 40 },
      forecast: { '2026-11': 20, '2026-12': 8 },
      declared: { '2026-10': 30 },
    }),
    line({
      group: 'external',
      name: 'Studio Blu',
      unitCost: 50,
      unitPrice: 70,
      budget: { '2026-10': 16 },
    }),
    line({
      group: 'product',
      name: 'Licenza',
      unitCost: 100,
      unitPrice: 150,
      budget: { '2026-09': 2 },
    }),
    line({ group: 'other_internal', name: 'Trasferte', unitCost: 1, budget: { '2026-11': 300 } }),
  ],
}
const timesheet = [
  hours('Mario Rossi', '2026-09-10', 32),
  hours('Rossi Mario', '2026-10-05', 48),
  // Not approved, of the month that is not a fact yet, of another code: not counted.
  hours('Rossi Mario', '2026-10-06', 8, false),
  hours('Rossi Mario', '2026-11-03', 8),
  { ...hours('Rossi Mario', '2026-10-07', 8), project: 'P2' },
  hours('Bianchi Luca', '2026-10-08', 4),
]
const costs = new Map([['mario rossi', 40]])
const view = planView(plan, 'P1', timesheet, costs, '2026-10', 8)

describe('the plan of a project code', () => {
  it('prices the budget line by line, month by month, by kind of cost', () => {
    expect(view.budget['2026-09']).toEqual({
      revenue: 40 * 60 + 2 * 150,
      internalCosts: 40 * 40,
      externalCosts: 0,
      productCosts: 200,
      costs: 1800,
      internalDays: 5,
      externalDays: 0,
    })
    expect(view.totals.budget).toMatchObject({
      revenue: 120 * 60 + 16 * 70 + 300,
      internalCosts: 120 * 40 + 300,
      externalCosts: 800,
      productCosts: 200,
      externalDays: 2,
    })
    expect(planMargin(view.totals.budget)).toBeCloseTo((8620 - 6100) / 8620)
    expect(planMargin({ ...view.totals.budget, revenue: 0 })).toBeNull()
  })

  it('reads the timesheets for the months that are a fact and the plan for those to come', () => {
    const [mario, studio] = view.lines
    // September and October as worked; November as planned again, December as added.
    expect(mario?.current).toEqual({ '2026-09': 32, '2026-10': 48, '2026-11': 20, '2026-12': 8 })
    expect(mario?.unitCost).toBe(40)
    // Who is not of the company has no timesheet: the plan stands for every month.
    expect(studio?.current).toEqual({ '2026-10': 16 })
    // 30 hours declared to the client of the 48 worked in October: the revenue follows them.
    expect(view.current['2026-10']).toMatchObject({
      revenue: 30 * 60 + 16 * 70,
      internalCosts: 48 * 40,
      externalCosts: 800,
    })
    expect(view.totals.actual.costs).toBe(32 * 40 + 200 + 48 * 40 + 800)
    expect(view.totals.forecast).toMatchObject({ revenue: 28 * 60, costs: 28 * 40 + 300 })
    expect(view.totals.atEnd.costs).toBe(view.totals.actual.costs + view.totals.forecast.costs)
    expect(view.months).toEqual(['2026-09', '2026-10', '2026-11', '2026-12'])
  })

  it('gives a line of their own to who has hours and no line, with no cost when none is known', () => {
    const luca = view.lines.at(-1)
    expect(luca).toMatchObject({
      name: 'Bianchi Luca',
      unplanned: true,
      unitCost: null,
      current: { '2026-10': 4 },
    })
    expect(view.withoutCost).toEqual(['Bianchi Luca'])
    expect(view.lines.filter((entry) => entry.unplanned)).toHaveLength(1)
  })

  it('tells how far the work is: as planned, as declared, or by the costs so far', () => {
    expect(view.plannedProgress['2026-09']).toBeCloseTo(2700 / 8620)
    expect(view.plannedProgress['2026-11']).toBe(1)
    expect(view.progress['2026-10']).toBeCloseTo(view.totals.actual.costs / view.totals.atEnd.costs)
    expect(view.progress['2026-12']).toBe(1)
    const declared = planView(
      { ...plan, declaredProgress: { '2026-10': 0.5 } },
      'P1',
      timesheet,
      costs,
      '2026-10',
      8,
    )
    expect(declared.progress['2026-10']).toBe(0.5)
    // With nothing planned and nothing worked there is nothing to tell.
    expect(planView(NO_SHEET_PLAN, 'P1', [], costs, '2026-10', 8)).toMatchObject({
      months: [],
      lines: [],
      progress: {},
      plannedProgress: {},
    })
  })

  it('writes on the lines what an hour costs when the budget is confirmed', () => {
    const confirmed = confirmedPlan(plan, costs, '2026-11-17')
    expect(confirmed.confirmedOn).toBe('2026-11-17')
    expect(confirmed.lines.map((entry) => entry.unitCost)).toEqual([40, 50, 100, 1])
    // A cost that changes afterwards does not change what was confirmed.
    const later = planView(confirmed, 'P1', timesheet, new Map([['mario rossi', 99]]), '2026-10', 8)
    expect(later.lines[0]?.unitCost).toBe(40)
    expect(later.confirmedOn).toBe('2026-11-17')
  })

  it('proposes a line for everybody known and not planned yet, with no quantity', () => {
    const proposed = proposedPlan(plan, {
      people: ['Mario Rossi', 'Verdi Sara', 'Bianchi Luca'],
      priceOfAnHour: (person) => (person === 'Verdi Sara' ? 50 : null),
      externals: [
        { name: 'studio blu', unitCost: 1, unitPrice: 1 },
        { name: 'Alfa', unitCost: null, unitPrice: null },
        { name: ' ', unitCost: null, unitPrice: null },
      ],
    })
    expect(proposed.lines.slice(plan.lines.length)).toEqual([
      line({ group: 'internal', name: 'Bianchi Luca' }),
      line({ group: 'internal', name: 'Verdi Sara', unitPrice: 50 }),
      line({ group: 'external', name: 'Alfa' }),
    ])
  })

  it('keeps tidy what the PM typed, and nothing of a plan that says nothing', () => {
    const typed: SheetPlan = {
      lines: [
        line({
          group: 'internal',
          name: ' Rossi Mario ',
          unitCost: -1,
          unitPrice: Number.NaN,
          budget: { '2026-13': 8, '2026-10': 0, '2026-09': 8 },
          forecast: { '2026-10': 0, nope: 3 },
          declared: { '2026-09': 0, '2026-10': -1 },
        }),
        line({ group: 'internal', name: 'Mario Rossi' }),
        line({ group: 'product', name: '' }),
      ],
      confirmedOn: 'ieri',
      milestones: [
        { salesOrder: ' SO-2 ', month: '2026-11', amount: 100 },
        { salesOrder: 'SO-1', month: '2026-10', amount: 50 },
        { salesOrder: 'SO-1', month: '2026-10', amount: 0 },
        { salesOrder: 'SO-1', month: 'x', amount: 5 },
      ],
      declaredProgress: { '2026-10': 0.4, '2026-11': 1.5, '2026-12': 0 },
      registry: { ...NO_SHEET_REGISTRY, sales: ' Bassi ' },
    }
    expect(cleanSheetPlans({ ' p1 ': typed, P2: NO_SHEET_PLAN, '': typed })).toEqual({
      P1: {
        lines: [
          line({
            group: 'internal',
            name: 'Rossi Mario',
            budget: { '2026-09': 8 },
            forecast: { '2026-10': 0 },
            declared: { '2026-09': 0 },
          }),
        ],
        confirmedOn: null,
        milestones: [
          { salesOrder: 'SO-1', month: '2026-10', amount: 50 },
          { salesOrder: 'SO-2', month: '2026-11', amount: 100 },
        ],
        declaredProgress: { '2026-10': 0.4 },
        registry: { ...NO_SHEET_REGISTRY, sales: 'Bassi' },
      },
    })
  })

  it('goes in the long table the administration gathers the sheets with', () => {
    const rows = sheetDataRows(view)
    expect(rows.map((row) => `${row.group} ${row.item}`)).toEqual([
      'BUDGET Ricavi',
      'BUDGET Costi interni',
      'BUDGET Costi esterni',
      'BUDGET Prodotti',
      'BUDGET GG interne',
      'BUDGET GG esterne',
      'ACTUAL-FORECAST Ricavi',
      'ACTUAL-FORECAST Costi interni',
      'ACTUAL-FORECAST Costi esterni',
      'ACTUAL-FORECAST Prodotti',
      'ACTUAL-FORECAST GG interne',
      'ACTUAL-FORECAST GG esterne',
    ])
    expect(rows[0]).toMatchObject({ revenue: 8620, cost: 0 })
    expect(rows[1]).toMatchObject({ revenue: 0, cost: 5100 })
    const [headings, first] = sheetDataCsv('P1', view).split('\n')
    expect(headings?.split(';')).toHaveLength(21)
    expect(headings).toMatch(/^ProjectID;Anno;Periodo Riferimento;Gruppo;Item;Anno Prec\.;Gennaio/)
    // Budget revenue: nothing before 2026, September to November, nothing after.
    expect(first).toBe(
      'P1;2026;2026-10;BUDGET;Ricavi;0,00;0,00;0,00;0,00;0,00;0,00;0,00;0,00;0,00;2700,00;3520,00;2400,00;0,00;0,00;0,00;8620,00',
    )
    const next = planView(plan, 'P1', timesheet, costs, '2027-01', 8)
    expect(sheetDataCsv('P1', next).split('\n')[1]).toMatch(
      /^P1;2027;2027-01;BUDGET;Ricavi;8620,00;0,00/,
    )
  })

  describe('beside the settings of the monthly forecast', () => {
    const written: ForecastSettings = {
      ...DEFAULT_FORECAST_SETTINGS,
      rates: [
        { person: 'Rossi Mario', code: null, ratePerDay: 400 },
        { person: 'Mario Rossi', code: 'P1', ratePerDay: 440 },
        { person: 'Bianchi Luca', code: 'P2', ratePerDay: 300 },
      ],
      externals: [
        { name: 'Studio Blu', code: 'P1', costPerDay: 320, ratePerDay: 0 },
        { name: 'Verdi Sara', code: 'P1', costPerDay: 400, ratePerDay: 560 },
      ],
      hourlyCosts: [{ person: 'Verdi Sara', costPerHour: 45 }],
    }

    it('is what the forecast of its code uses, whatever the settings said before', () => {
      const used = settingsWithPlans(written, {
        P1: {
          ...plan,
          lines: [
            ...plan.lines,
            line({ group: 'external', name: 'verdi sara', unitCost: 55 }),
            line({ group: 'external', name: 'Nessuno' }),
            line({ group: 'internal', name: 'Bianchi Luca' }),
          ],
        },
      })
      // 60 an hour over 8 hours on P1; the rate for every code and the one of P2 stay.
      expect(used.rates).toEqual([
        { person: 'Rossi Mario', code: null, ratePerDay: 400 },
        { person: 'Bianchi Luca', code: 'P2', ratePerDay: 300 },
        { person: 'Rossi Mario', code: 'P1', ratePerDay: 480 },
      ])
      // What a line does not say stays as written: the rate of Verdi Sara, not her cost.
      expect(used.externals).toEqual([
        { name: 'Studio Blu', code: 'P1', costPerDay: 400, ratePerDay: 560 },
        { name: 'verdi sara', code: 'P1', costPerDay: 440, ratePerDay: 560 },
      ])
      expect(used.hourlyCosts).toEqual([
        { person: 'Studio Blu', costPerHour: 50 },
        { person: 'verdi sara', costPerHour: 55 },
      ])
      expect(settingsWithPlans(written, {})).toEqual(written)
    })

    it('stands where a line writes no cost or no price of its own', () => {
      const standing = standingOf(written, 'P1')
      expect(standing.price({ group: 'internal', name: 'Mario Rossi' })).toBe(55)
      expect(standingOf(written, 'P3').price({ group: 'internal', name: 'Rossi Mario' })).toBe(50)
      expect(standing.price({ group: 'internal', name: 'Bianchi Luca' })).toBeNull()
      expect(standing.cost({ group: 'external', name: 'studio blu' })).toBe(40)
      // A rate of nothing is no rate.
      expect(standing.price({ group: 'external', name: 'Studio Blu' })).toBeNull()
      expect(standing.price({ group: 'product', name: 'Licenza' })).toBeNull()
      expect(standing.cost({ group: 'internal', name: 'Rossi Mario' })).toBeNull()
      const bare: SheetPlan = {
        ...NO_SHEET_PLAN,
        lines: [
          line({ group: 'internal', name: 'Rossi Mario', budget: { '2026-11': 8 } }),
          line({ group: 'external', name: 'Verdi Sara', budget: { '2026-11': 8 } }),
        ],
      }
      const read = planView(bare, 'P1', [], costs, '2026-10', 8, standing)
      expect(read.lines.map((entry) => [entry.unitCost, entry.unitPrice])).toEqual([
        [40, 55],
        [50, 70],
      ])
      expect(read.totals.budget).toMatchObject({ revenue: 8 * 55 + 8 * 70, costs: 8 * 40 + 8 * 50 })
    })
  })
})
