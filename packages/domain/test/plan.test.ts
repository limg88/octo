import { describe, expect, it } from 'vitest'
import {
  DEFAULT_FORECAST_SETTINGS,
  type ForecastSettings,
  type PlanLine,
  type SheetPlan,
  settingsWithPlans,
  sheetPlansText,
} from '../src/index.ts'

const line = (more: Partial<PlanLine> & Pick<PlanLine, 'group' | 'name'>): PlanLine => ({
  unitCost: null,
  unitPrice: null,
  budget: {},
  forecast: {},
  declared: {},
  ...more,
})

const plan: SheetPlan = {
  lines: [
    line({
      group: 'internal',
      name: 'Rossi Mario',
      unitPrice: 60,
      budget: { '2026-10': 40, '2026-09': 40 },
      forecast: { '2026-11': 20 },
      declared: { '2026-10': 30 },
    }),
    line({ group: 'external', name: 'Studio Blu', unitCost: 50, unitPrice: 70 }),
    line({ group: 'external', name: 'verdi sara', unitCost: 55 }),
    line({ group: 'external', name: 'Nessuno' }),
    line({ group: 'internal', name: 'Bianchi Luca' }),
  ],
  confirmedOn: '2026-10-02',
  milestones: [
    { salesOrder: 'SO-1', month: '2026-11', amount: 2250 },
    { salesOrder: '', month: '2026-12', amount: 500 },
  ],
  declaredProgress: { '2026-10': 0.4 },
  registry: { sales: 'Paola | Verdi', offerCode: ' ' },
}

describe('the plans the sheet of a project code kept, when they leave Octo', () => {
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

  it('leave their rates and costs to the monthly forecast, whatever the settings said', () => {
    const used = settingsWithPlans(written, { P1: plan })
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

  it('are taken over the same way twice: a take-over cut short can be done again', () => {
    const once = settingsWithPlans(written, { P1: plan })
    expect(settingsWithPlans(once, { P1: plan })).toEqual(once)
  })

  it('are handed back as a text with every line, month, invoice planned and field written', () => {
    const text = sheetPlansText(
      { P2: { ...plan, lines: [], milestones: [] }, P1: plan },
      '2026-11-18',
    )
    expect(text).toContain('Scritto il 2026-11-18.')
    // The codes in order, each with what it had.
    expect(text.indexOf('## P1')).toBeLessThan(text.indexOf('## P2'))
    expect(text).toContain('Budget confermato il 2026-10-02.')
    expect(text).toContain(
      '| Risorse interne | Rossi Mario | — | 60 | 2026-09: 40; 2026-10: 40 | 2026-11: 20 | 2026-10: 30 |',
    )
    expect(text).toContain('| Risorse esterne | Studio Blu | 50 | 70 | — | — | — |')
    expect(text).toContain('| SO-1 | 2026-11 | 2250 |')
    expect(text).toContain('| — | 2026-12 | 500 |')
    expect(text).toContain('Avanzamento dichiarato (quota fra 0 e 1): 2026-10: 0.4')
    // A field of the registry left empty is not written; a bar would break the table of nobody.
    expect(text).toContain('- sales: Paola | Verdi')
    expect(text).not.toContain('offerCode')
  })

  it('say nothing of a code that had nothing but its name', () => {
    const empty: SheetPlan = {
      lines: [],
      confirmedOn: null,
      milestones: [],
      declaredProgress: {},
      registry: {},
    }
    expect(sheetPlansText({ P9: empty }, '2026-11-18').trimEnd().endsWith('## P9')).toBe(true)
  })
})
