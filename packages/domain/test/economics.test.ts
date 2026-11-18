import { describe, expect, it } from 'vitest'
import {
  compileLifetime,
  DEFAULT_FORECAST_SETTINGS,
  type ForecastSettings,
  NO_FORECAST_PROJECT,
  NO_PROJECT_ECONOMICS,
  NO_ROW_INPUTS,
  type ProjectEconomics,
  sheetEconomics,
  sheetProgress,
} from '../src/index.ts'

const economics: ProjectEconomics = {
  standardCosts: [{ person: 'Mario Rossi', costPerHour: 30 }],
  ledger: [
    { month: '2026-09', group: 'Labor (TS)', cost: 850, revenue: 3000 },
    { month: '2026-10', group: 'Labor (TS)', cost: 537.5, revenue: 2250 },
    { month: '2026-10', group: 'Service', cost: 1200, revenue: 0 },
    { month: '2026-10', group: 'Expense', cost: 0, revenue: 0 },
    // After the month asked: not counted yet.
    { month: '2026-12', group: 'Service', cost: 999, revenue: 999 },
  ],
  invoices: [
    { invoice: 'INV-1', salesOrder: 'SO-2', day: '2026-09-20', amount: 2250 },
    { invoice: 'INV-2', salesOrder: 'SO-1', day: '2026-10-05', amount: 1000 },
    { invoice: 'INV-3', salesOrder: 'SO-1', day: '2026-10-25', amount: 500 },
    // A credit note takes away from what was invoiced.
    { invoice: 'NC-1', salesOrder: 'SO-1', day: '2026-11-02', amount: -200 },
    { invoice: 'INV-9', salesOrder: 'SO-1', day: '2026-12-01', amount: 4000 },
  ],
  purchases: [
    { order: 'PO-31', vendor: 'Studio Blu', day: '2026-09-10', amount: 2000 },
    { order: 'PO-40', vendor: 'Alfa Licenze', day: '2026-10-01', amount: 300 },
  ],
  receipts: [
    { order: 'PO-31', vendor: 'Studio Blu', day: '2026-10-28', amount: 800 },
    { order: 'PO-31', vendor: 'Studio Blu', day: '2026-11-10', amount: 400 },
    // Received with no order known: a line of its own, named by the receipt.
    { order: '', vendor: 'Gamma', day: '2026-11-11', amount: 50 },
  ],
  vendorInvoices: [
    { invoice: 'FF-1', order: 'PO-31', vendor: 'Studio Blu', day: '2026-11-15', amount: 1200 },
  ],
  progress: [
    { day: '2026-10-31', share: 0.55 },
    { day: '2026-09-30', share: 0.3 },
    // After the month asked: not told yet.
    { day: '2026-12-31', share: 0.9 },
  ],
}

describe('the money of a project code', () => {
  it('sums the lines of the invoices by sales order and by month, up to the month asked', () => {
    const sheet = sheetEconomics(economics, '2026-11')
    expect(sheet.invoiced).toBe(3550)
    expect(sheet.billingMonths).toEqual(['2026-09', '2026-10', '2026-11'])
    expect(sheet.billing).toEqual([
      { salesOrder: 'SO-1', months: { '2026-10': 1500, '2026-11': -200 }, invoiced: 1300 },
      { salesOrder: 'SO-2', months: { '2026-09': 2250 }, invoiced: 2250 },
    ])
  })

  it('tells the ledger of the company system group by group, without the empty ones', () => {
    expect(sheetEconomics(economics, '2026-11').ledger).toEqual({
      revenue: 5250,
      costs: 2587.5,
      groups: [
        { group: 'Labor (TS)', cost: 1387.5 },
        { group: 'Service', cost: 1200 },
      ],
    })
    expect(sheetEconomics(economics, '2026-11').ledgerMonths).toEqual({
      '2026-09': { revenue: 3000, costs: 850 },
      '2026-10': { revenue: 2250, costs: 1737.5 },
    })
    expect(sheetEconomics(economics, '2026-09').ledger).toEqual({
      revenue: 3000,
      costs: 850,
      groups: [{ group: 'Labor (TS)', cost: 850 }],
    })
  })

  it('follows each order to a supplier: ordered, received as a cost, invoiced', () => {
    expect(sheetEconomics(economics, '2026-11').suppliers).toEqual({
      ordered: 2300,
      received: 1250,
      invoiced: 1200,
      toInvoice: 1100,
      orders: [
        { order: 'PO-40', vendor: 'Alfa Licenze', ordered: 300, received: 0, invoiced: 0 },
        { order: '', vendor: 'Gamma', ordered: 0, received: 50, invoiced: 0 },
        { order: 'PO-31', vendor: 'Studio Blu', ordered: 2000, received: 1200, invoiced: 1200 },
      ],
    })
    // Before anything was ordered there is no cycle to tell, and with nothing read none at all.
    expect(sheetEconomics(economics, '2026-08').suppliers).toBeNull()
    expect(sheetEconomics(NO_PROJECT_ECONOMICS, '2026-11')).toEqual({
      invoiced: 0,
      billingMonths: [],
      billing: [],
      ledger: { revenue: 0, costs: 0, groups: [] },
      ledgerMonths: {},
      suppliers: null,
    })
  })
})

describe('the sheet of a project code with what the company system says', () => {
  const settings: ForecastSettings = {
    ...DEFAULT_FORECAST_SETTINGS,
    projects: {
      P1: {
        ...NO_FORECAST_PROJECT,
        kind: 'fixed_price',
        ordered: 7500,
        invoiced: 9,
        recognized: 9,
      },
    },
    months: { '2026-09': { P1: { ...NO_ROW_INPUTS, budgetCosts: 4000 } } },
  }
  const hours = [
    {
      person: 'Rossi Mario',
      day: '2026-09-15',
      hours: 34,
      project: 'P1',
      approved: true,
      id: '1',
      cost: 850,
    },
  ]
  const life = (read: ProjectEconomics | null) =>
    compileLifetime('P1', hours, settings, '2026-11', null, undefined, [], read)

  it('counts what the suppliers delivered among the costs, and settles with the invoices', () => {
    const sheet = life(economics)
    expect(sheet).toMatchObject({
      invoiced: 3550,
      recognized: 5250,
      // 34 hours at the 30 an hour costs today, not the 850 its rows say; 1.250 of suppliers.
      supplierCosts: 1250,
      costs: 2270,
      wip: 2270 - 3550,
      toBill: 5250 - 3550,
    })
    expect(sheet.marginToDate).toBeCloseTo((7500 - 2270) / 7500)
    expect(sheet.progress).toMatchObject({ share: 0.55, source: 'system' })
    expect(sheet.economics?.suppliers?.received).toBe(1250)
  })

  it('keeps what the backlog said while no invoice and no ledger tell otherwise', () => {
    expect(life(null)).toMatchObject({
      invoiced: 9,
      recognized: 9,
      supplierCosts: 0,
      costs: 850,
      wip: 841,
      toBill: 0,
      economics: null,
    })
    expect(life(NO_PROJECT_ECONOMICS)).toMatchObject({ invoiced: 9, recognized: 9 })
    const unknown: ForecastSettings = { ...settings, projects: {} }
    expect(
      compileLifetime('P1', hours, unknown, '2026-11', null, undefined, [], null),
    ).toMatchObject({ wip: null, toBill: null })
  })
})

describe('how far a project code is', () => {
  const nothing = {
    readings: [],
    through: '2026-11',
    recognized: null,
    ordered: null,
    costs: 0,
    totalCosts: null,
  }

  it('is what the company system says of the last period up to the month, with its day', () => {
    const read = { ...nothing, readings: economics.progress, recognized: 100, ordered: 1000 }
    expect(sheetProgress(read)).toEqual({ share: 0.55, source: 'system', day: '2026-10-31' })
    expect(sheetProgress({ ...read, through: '2026-09' })).toMatchObject({ share: 0.3 })
    // A period told beyond the whole is the whole.
    expect(sheetProgress({ ...read, readings: [{ day: '2026-10-31', share: 1.2 }] })).toMatchObject(
      { share: 1 },
    )
  })

  it('without a period is the revenue recognised over the order', () => {
    const read = { ...nothing, recognized: 5250, ordered: 7500, costs: 10, totalCosts: 20 }
    expect(sheetProgress(read)).toEqual({ share: 0.7, source: 'recognized', day: null })
    // A period that comes only after the month asked tells nothing of it.
    expect(sheetProgress({ ...read, readings: [{ day: '2026-12-31', share: 0.9 }] })).toMatchObject(
      { source: 'recognized' },
    )
  })

  it('without those is the costs so far over the costs of the whole, said as an estimate', () => {
    const read = { ...nothing, costs: 1200, totalCosts: 4800 }
    expect(sheetProgress(read)).toEqual({ share: 0.25, source: 'costs', day: null })
    expect(sheetProgress({ ...read, ordered: 0, recognized: 10 })).toMatchObject({
      source: 'costs',
    })
    expect(sheetProgress({ ...read, costs: 9000 })).toMatchObject({ share: 1 })
  })

  it('is not told when none of the three can be', () => {
    expect(sheetProgress(nothing)).toBeNull()
    expect(sheetProgress({ ...nothing, costs: 10, totalCosts: 0 })).toBeNull()
  })

  it('reaches the sheet of the code from what the company system read', () => {
    const settings: ForecastSettings = {
      ...DEFAULT_FORECAST_SETTINGS,
      projects: { P1: { ...NO_FORECAST_PROJECT, ordered: 7500 } },
    }
    const life = compileLifetime('P1', [], settings, '2026-11', null, undefined, [], economics)
    expect(life.progress).toEqual({ share: 0.55, source: 'system', day: '2026-10-31' })
  })
})
