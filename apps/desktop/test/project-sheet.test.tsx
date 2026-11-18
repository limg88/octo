// @vitest-environment jsdom
import {
  DEFAULT_FORECAST_SETTINGS,
  type ForecastSettings,
  type Lifetime,
  NO_FORECAST_PROJECT,
  NO_ROW_INPUTS,
  NO_SHEET_PLAN,
  type Project,
  planView,
  type SheetPlan,
  type SheetPlans,
} from '@octo/domain'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { lifetimeMail } from '../src/renderer/forecast-text.ts'
import { dateText, errorText, messages } from '../src/renderer/messages.ts'
import { ProjectSheetView } from '../src/renderer/ProjectSheetView.tsx'
import type { OctoApi, Result } from '../src/shared/api.ts'

const project: Project = { id: 'p-1', name: 'Aurora', folder: '/progetti/Aurora', addedAt: '' }
const ok = <T,>(value: T): Result<T> => ({ ok: true, value })
const text = messages.forecast
const words = messages.sheet.summary

type Api = Pick<
  OctoApi,
  | 'projectSheets'
  | 'forecastSettings'
  | 'saveForecastSettings'
  | 'sheetPlans'
  | 'saveSheetPlans'
  | 'proposeSheetPlan'
  | 'confirmSheetBudget'
  | 'exportSheetData'
  | 'openEvidence'
>

function fakeApi(overrides: Partial<Api> = {}) {
  const api: Api = {
    projectSheets: vi.fn(async () => ok<Lifetime[]>([])),
    forecastSettings: vi.fn(async () => ok(DEFAULT_FORECAST_SETTINGS)),
    saveForecastSettings: vi.fn(async (_id: string, settings: ForecastSettings) => ok(settings)),
    sheetPlans: vi.fn(async () => ok<SheetPlans>({})),
    saveSheetPlans: vi.fn(async (_id: string, plans: SheetPlans) => ok(plans)),
    proposeSheetPlan: vi.fn(async () => ok<SheetPlans>({})),
    confirmSheetBudget: vi.fn(async () => ok<SheetPlans>({})),
    exportSheetData: vi.fn(async () => ok({ path: '_octo/commessa/AUR-01/Dati 2026-11-17.csv' })),
    openEvidence: vi.fn(async () => ok(null)),
    ...overrides,
  }
  return api
}

const life: Lifetime = {
  code: 'AUR-01',
  description: 'Assessment Aurora',
  kind: 'fixed_price',
  through: '2026-11',
  ordered: 7500,
  invoiced: 2250,
  recognized: 5250,
  lines: [
    { person: 'Bianchi Luca', hours: 26, cost: 1197, source: 'timesheet', months: [] },
    { person: 'Rossi Anna', hours: 34, cost: 1700, source: 'timesheet', months: [] },
    { person: 'Verdi Sara', hours: 8, cost: 560, source: 'declared', months: [] },
  ],
  hours: 68,
  costs: 3457,
  supplierCosts: 0,
  wip: 3457 - 2250,
  toBill: 5250 - 2250,
  economics: null,
  plan: null,
  estimatedHours: 0,
  estimatedCosts: 0,
  marginToDate: (7500 - 3457) / 7500,
  budgetCosts: 4800,
  proposedBudget: null,
  progress: 3457 / 4800,
  expectedCosts: 4800,
  marginAtEnd: 0.36,
  notApprovedHours: 3,
  unreadMonths: [],
}
const days: Lifetime = {
  ...life,
  code: 'AUR-02',
  description: '',
  kind: 'time_material',
  ordered: null,
  invoiced: null,
  recognized: null,
  lines: [{ person: 'Neri Ugo', hours: 2, cost: null, source: 'timesheet', months: [] }],
  hours: 2,
  costs: 0,
  wip: null,
  toBill: null,
  marginToDate: null,
  budgetCosts: null,
  progress: null,
  expectedCosts: null,
  marginAtEnd: null,
  notApprovedHours: 0,
  unreadMonths: ['2026-09'],
}

/** The figures of a group, each as it is read: its name, its value and the line that reads it. */
const figuresOf = (group: string): string[] =>
  within(screen.getByRole('region', { name: group }))
    .getAllByRole('term')
    .map((term) => `${term.textContent}: ${term.nextElementSibling?.textContent}`)

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('the sheet of a project code', () => {
  it('shows what was ordered and invoiced, what it cost and by whom, and the margins', async () => {
    const writeText = vi.fn(async () => {})
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
    const api = fakeApi({ projectSheets: vi.fn(async () => ok([life])) })
    render(<ProjectSheetView api={api} project={project} />)
    const table = await screen.findByRole('table', { name: words.people })
    expect(screen.getByRole('heading', { name: /AUR-01 · Assessment Aurora/ })).toBeTruthy()
    expect(screen.getByText(text.internal)).toBeTruthy()
    expect(screen.getByText(words.through('novembre 2026'))).toBeTruthy()
    // What the company's system says of the order, each amount with its share of it.
    expect(figuresOf(words.groups.order)).toEqual([
      `${words.ordered}: 7.500,00`,
      `${words.invoiced}: 2.250,00${words.ofOrdered('30%')}`,
      `${words.toInvoice}: 5.250,00${words.ofOrdered('70%')}`,
      `${words.recognized}: 5.250,00${words.ofOrdered('70%')}`,
    ])
    expect(figuresOf(words.groups.margin)).toEqual([
      `${words.costs}: 3.457,00${words.hoursWorked('68')}`,
      `${words.marginToDate}: 53,91%`,
      `${words.budgetCosts}: 4.800,00${words.progress('72,02%')}`,
      `${words.marginAtEnd}: 36%${words.onCosts('4.800,00')}`,
    ])
    const rows = within(table)
      .getAllByRole('row')
      .map((row) => row.textContent)
    expect(rows).toEqual([
      `${words.person}${words.hours}${words.cost}${words.source}`,
      'Bianchi Luca261.197,00timesheet',
      'Rossi Anna341.700,00timesheet',
      'Verdi Sara8560,00senza timesheet, dichiarate',
      `${words.total}683.457,00`,
    ])
    expect(screen.getByText(text.notApproved('3'))).toBeTruthy()
    // One code only: nothing to choose.
    expect(screen.queryByLabelText(words.code)).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: words.copy }))
    expect(await screen.findByText(words.copied)).toBeTruthy()
    expect(writeText).toHaveBeenCalledWith(lifetimeMail(life))
  })

  it('is chosen among the codes of the project, the fixed price first, and stays chosen', async () => {
    const api = fakeApi({ projectSheets: vi.fn(async () => ok([days, life])) })
    const other: Project = { ...project, id: 'p-2' }
    const { unmount } = render(<ProjectSheetView api={api} project={other} />)
    // The fixed price is shown first, whatever the order of the codes.
    const chosen = await screen.findByLabelText<HTMLSelectElement>(words.code)
    expect(chosen.value).toBe('AUR-01')
    fireEvent.change(chosen, { target: { value: 'AUR-02' } })
    expect(screen.getByText(text.unreadMonths('2026-09'))).toBeTruthy()
    expect(screen.getByText(words.withoutCost('Neri Ugo'))).toBeTruthy()
    // What is not known is a dash with its reason, never a zero.
    expect(figuresOf(words.groups.order)).toEqual([
      `${words.ordered}: —`,
      `${words.invoiced}: —`,
      `${words.toInvoice}: —`,
      `${words.recognized}: —`,
    ])
    expect(figuresOf(words.groups.margin).slice(2)).toEqual([
      `${words.budgetCosts}: —${words.noBudget}`,
      `${words.marginAtEnd}: —${words.noExpected}`,
    ])
    // Back from another section the same code is shown.
    unmount()
    render(<ProjectSheetView api={api} project={other} />)
    expect((await screen.findByLabelText<HTMLSelectElement>(words.code)).value).toBe('AUR-02')
  })

  it('marks as an estimate the hours not yet in NetSuite, on the page and in the mail', async () => {
    const estimated: Lifetime = {
      ...life,
      lines: [
        ...life.lines,
        { person: 'Neri Ugo', hours: 8, cost: 560, source: 'no_timesheet', months: [] },
        { person: 'Bianchi Luca', hours: 4.5, cost: 207, source: 'estimate', months: ['2026-11'] },
      ],
      hours: 80.5,
      costs: 4224,
      estimatedHours: 4.5,
      estimatedCosts: 207,
    }
    const api = fakeApi({ projectSheets: vi.fn(async () => ok([estimated])) })
    render(<ProjectSheetView api={api} project={project} />)
    const table = await screen.findByRole('table', { name: words.people })
    const rows = within(table)
      .getAllByRole('row')
      .map((row) => row.textContent)
    expect(rows).toContain(`Neri Ugo8560,00${words.sources.no_timesheet}`)
    expect(rows).toContain(`Bianchi Luca4,5207,00${words.sources.estimate} (2026-11)`)
    expect(screen.getByText(words.estimated('4,5', '207,00'))).toBeTruthy()
    const mail = lifetimeMail(estimated)
    expect(mail).toMatch(new RegExp(`Bianchi Luca \\(${words.estimateMark}\\)\\s+4,5\\s+207,00`))
    expect(mail).toContain(words.estimated('4,5', '207,00'))
  })

  it('proposes the costs at budget from the caps of the people, and keeps them only when the PM says so', async () => {
    const proposed: Lifetime = {
      ...life,
      budgetCosts: null,
      progress: null,
      expectedCosts: null,
      marginAtEnd: null,
      proposedBudget: {
        costs: 4584,
        people: [
          { person: 'Anna Rossi', days: 2, costPerHour: 50 },
          { person: 'Luca Bianchi', days: 8, costPerHour: 46 },
          { person: 'Sara Verdi', days: 1.5, costPerHour: 70 },
        ],
        withoutCost: ['Ugo Neri'],
      },
    }
    const started: ForecastSettings = {
      ...DEFAULT_FORECAST_SETTINGS,
      projects: {
        'AUR-01': { ...NO_FORECAST_PROJECT, kind: 'fixed_price', startMonth: '2026-09' },
      },
    }
    const api = fakeApi({
      forecastSettings: vi.fn(async () => ok(started)),
      projectSheets: vi
        .fn()
        .mockResolvedValueOnce(ok([proposed]))
        .mockResolvedValue(ok([{ ...proposed, budgetCosts: 4584 }])),
    })
    render(<ProjectSheetView api={api} project={project} />)
    expect(
      await screen.findByText(
        new RegExp(
          words
            .proposed('4.584,00', 'Anna Rossi 2 gg, Luca Bianchi 8 gg, Sara Verdi 1,5 gg')
            .replace(/[.()]/g, '\\$&'),
        ),
      ),
    ).toBeTruthy()
    expect(screen.getByText(new RegExp(words.proposedWithoutCost('Ugo Neri')))).toBeTruthy()
    // Nothing is written until the PM presses: then from the month the code began.
    expect(api.saveForecastSettings).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: words.useProposed }))
    await waitFor(() =>
      expect(api.saveForecastSettings).toHaveBeenCalledWith(
        'p-1',
        expect.objectContaining({
          months: expect.objectContaining({
            '2026-09': { 'AUR-01': { ...NO_ROW_INPUTS, budgetCosts: 4584 } },
          }),
        }),
      ),
    )
    // The sheet is read again, and says the proposal is what is in use.
    expect(await screen.findByText(new RegExp(words.proposedInUse))).toBeTruthy()
    expect(screen.queryByRole('button', { name: words.useProposed })).toBeNull()
    expect(api.projectSheets).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('status').textContent).toBe(messages.saved)
  })

  it('says why the budget could not be kept', async () => {
    const proposed: Lifetime = {
      ...life,
      budgetCosts: null,
      proposedBudget: { costs: 100, people: [], withoutCost: [] },
    }
    const refused = { ok: false as const, code: 'forecast_settings_invalid' as const }
    const unread = fakeApi({
      projectSheets: vi.fn(async () => ok([proposed])),
      forecastSettings: vi.fn(async () => refused),
    })
    render(<ProjectSheetView api={unread} project={project} />)
    fireEvent.click(await screen.findByRole('button', { name: words.useProposed }))
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(unread.saveForecastSettings).not.toHaveBeenCalled()
    cleanup()
    const unsaved = fakeApi({
      projectSheets: vi.fn(async () => ok([proposed])),
      saveForecastSettings: vi.fn(async () => refused),
    })
    render(<ProjectSheetView api={unsaved} project={project} />)
    fireEvent.click(await screen.findByRole('button', { name: words.useProposed }))
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(unsaved.projectSheets).toHaveBeenCalledTimes(1)
  })

  it('says why it cannot be told, and when the project has no code yet', async () => {
    const onOpenSection = vi.fn()
    const failing = fakeApi({
      projectSheets: vi.fn(async () => ({
        ok: false as const,
        code: 'forecast_timesheet_not_set' as const,
      })),
    })
    render(<ProjectSheetView api={failing} project={project} onOpenSection={onOpenSection} />)
    expect((await screen.findByRole('alert')).textContent).toMatch(/timesheet/i)
    cleanup()
    render(<ProjectSheetView api={fakeApi()} project={project} />)
    expect(await screen.findByText(text.noRows)).toBeTruthy()
  })

  const withSuppliers: Lifetime = {
    ...life,
    costs: 4657,
    supplierCosts: 1200,
    wip: 4657 - 3550,
    toBill: 5250 - 3550,
    invoiced: 3550,
    economics: {
      invoiced: 3550,
      billingMonths: ['2026-09', '2026-10'],
      billing: [
        { salesOrder: '', months: { '2026-10': 300 }, invoiced: 300 },
        { salesOrder: 'SO-1', months: { '2026-09': 2250, '2026-10': 1000 }, invoiced: 3250 },
      ],
      ledger: {
        revenue: 5250,
        costs: 4500,
        groups: [
          { group: 'Labor (TS)', cost: 3300 },
          { group: 'Service', cost: 1200 },
        ],
      },
      ledgerMonths: { '2026-10': { revenue: 5250, costs: 4500 } },
      suppliers: {
        ordered: 2000,
        received: 1200,
        invoiced: 800,
        toInvoice: 1200,
        orders: [
          { order: 'PO-31', vendor: 'Studio Blu', ordered: 2000, received: 1200, invoiced: 800 },
          { order: '', vendor: '', ordered: 0, received: 0, invoiced: 0 },
        ],
      },
    },
  }
  const rowsOf = (name: string): Array<string | null> =>
    within(screen.getByRole('table', { name }))
      .getAllByRole('row')
      .map((row) => row.textContent)

  it('settles costs, revenue and invoices, and says once how each figure is computed', async () => {
    const api = fakeApi({ projectSheets: vi.fn(async () => ok([life])) })
    render(<ProjectSheetView api={api} project={project} />)
    await screen.findByRole('table', { name: words.people })
    expect(figuresOf(words.groups.settle)).toEqual([
      `${words.wip}: 1.207,00${words.wipNote}`,
      `${words.toBill}: 3.000,00${words.toBillNote}`,
    ])
    // The rules of the sheet of the administration, one line for each figure.
    const rules = screen.getByText(words.rules.title).closest('details') as HTMLElement
    expect(
      within(rules)
        .getAllByRole('term')
        .map((term) => term.textContent),
    ).toEqual(words.rules.items.map(([name]) => name))
    // NetSuite was not read: no ledger to compare with, and no warning about suppliers.
    expect(screen.queryByRole('table', { name: words.ledger.title })).toBeNull()
    expect(screen.queryByText(words.doubleCount)).toBeNull()
    expect(lifetimeMail(life)).toContain(`${words.wip} (${words.wipNote}): 1.207,00`)
  })

  it('puts what NetSuite booked beside what Octo computes, and counts the suppliers', async () => {
    const api = fakeApi({ projectSheets: vi.fn(async () => ok([withSuppliers])) })
    render(<ProjectSheetView api={api} project={project} />)
    await screen.findByRole('table', { name: words.people })
    expect(figuresOf(words.groups.margin)[0]).toBe(
      `${words.costs}: 4.657,00${words.withSuppliers('68', '1.200,00')}`,
    )
    // What the suppliers delivered is a line of the table: its total is the costs of the page.
    expect(rowsOf(words.people).slice(-2)).toEqual([
      `${words.suppliersLine}1.200,00${words.suppliersSource}`,
      `${words.total}684.657,00`,
    ])
    expect(lifetimeMail(withSuppliers)).toMatch(new RegExp(`${words.suppliersLine}\\s+1\\.200,00`))
    expect(rowsOf(words.ledger.title)).toEqual([
      `${words.ledger.group}${words.ledger.cost}`,
      'Labor (TS)3.300,00',
      'Service1.200,00',
      `${words.ledger.total}4.500,00`,
    ])
    expect(screen.getByText(words.ledger.compare('4.657,00', '157,00'))).toBeTruthy()
    // An external declared by hand and a receipt of a supplier may be the same cost twice.
    expect(screen.getByText(words.doubleCount)).toBeTruthy()
    cleanup()
    const same: Lifetime = {
      ...withSuppliers,
      costs: 4500,
      lines: life.lines.filter((line) => line.source !== 'declared'),
    }
    render(
      <ProjectSheetView
        api={fakeApi({ projectSheets: vi.fn(async () => ok([same])) })}
        project={project}
      />,
    )
    expect(await screen.findByText(words.ledger.same('4.500,00'))).toBeTruthy()
    expect(screen.queryByText(words.doubleCount)).toBeNull()
    cleanup()
    const empty: Lifetime = {
      ...life,
      economics: {
        invoiced: 0,
        billingMonths: [],
        billing: [],
        ledger: { revenue: 0, costs: 0, groups: [] },
        ledgerMonths: {},
        suppliers: null,
      },
    }
    render(
      <ProjectSheetView
        api={fakeApi({ projectSheets: vi.fn(async () => ok([empty])) })}
        project={project}
      />,
    )
    expect(await screen.findByText(words.ledger.none)).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: messages.sheet.parts.billing }))
    expect(screen.getByText(messages.sheet.billing.noInvoices)).toBeTruthy()
    expect(screen.getByText(messages.sheet.billing.noSuppliers)).toBeTruthy()
  })

  it('shows the invoices to the client by order and by month, and the orders to the suppliers', async () => {
    const bill = messages.sheet.billing
    const api = fakeApi({ projectSheets: vi.fn(async () => ok([withSuppliers])) })
    render(<ProjectSheetView api={api} project={project} />)
    const tab = await screen.findByRole('tab', { name: messages.sheet.parts.billing })
    expect(
      screen.getByRole('tab', { name: messages.sheet.parts.summary }).getAttribute('aria-selected'),
    ).toBe('true')
    fireEvent.click(tab)
    expect(tab.getAttribute('aria-selected')).toBe('true')
    expect(rowsOf(bill.clientTable)).toEqual([
      `${bill.salesOrder}set 2026ott 2026${bill.total}`,
      `${bill.noSalesOrder}300,00300,00`,
      'SO-12.250,001.000,003.250,00',
      `${bill.total}2.250,001.300,003.550,00`,
    ])
    expect(figuresOf(bill.suppliers)).toEqual([
      `${bill.ordered}: 2.000,00`,
      `${bill.received}: 1.200,00${bill.receivedNote}`,
      `${bill.invoiced}: 800,00`,
      `${bill.toInvoice}: 1.200,00`,
    ])
    expect(rowsOf(bill.suppliersTable)).toEqual([
      `${bill.vendor}${bill.order}${bill.ordered}${bill.received}${bill.invoiced}`,
      'Studio BluPO-312.000,001.200,00800,00',
      `${bill.noVendor}${bill.noOrder}0,000,000,00`,
    ])
    // The figures of the summary are not repeated here.
    expect(screen.queryByRole('table', { name: words.people })).toBeNull()
  })

  it('says that NetSuite was not read, and where to link it', async () => {
    const bill = messages.sheet.billing
    const onOpenSection = vi.fn()
    const api = fakeApi({ projectSheets: vi.fn(async () => ok([life])) })
    const { unmount } = render(
      <ProjectSheetView api={api} project={project} onOpenSection={onOpenSection} />,
    )
    fireEvent.click(await screen.findByRole('tab', { name: messages.sheet.parts.billing }))
    expect(screen.getByText(bill.notRead)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: messages.openSection(messages.sourcesTab) }))
    expect(onOpenSection).toHaveBeenCalledWith('sources')
    unmount()
    render(<ProjectSheetView api={api} project={project} />)
    fireEvent.click(await screen.findByRole('tab', { name: messages.sheet.parts.billing }))
    expect(screen.getByText(bill.notRead)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Apri/ })).toBeNull()
  })

  it('goes in a mail as plain text, with what it misses said in words', () => {
    const mail = lifetimeMail(life)
    expect(mail.split('\n').slice(0, 2)).toEqual([
      'AUR-01 · Assessment Aurora',
      words.through('novembre 2026'),
    ])
    expect(mail).toContain(`${words.invoiced}: 2.250,00 (30%)`)
    // A table in plain text: every row as wide as the others.
    const table = mail
      .split('\n')
      .filter((line) => /\d,\d\d$|Costo$/.test(line) && !line.includes(':'))
    expect(table.map((line) => line.replace(/\s+/g, ' '))).toEqual([
      `${words.person} ${words.hours} ${words.cost}`,
      'Bianchi Luca 26 1.197,00',
      'Rossi Anna 34 1.700,00',
      'Verdi Sara 8 560,00',
      `${words.total} 68 3.457,00`,
    ])
    expect(new Set(table.map((line) => line.length)).size).toBe(1)
    expect(mail).toContain(`${words.marginToDate}: 53,91%`)
    expect(mail).toContain(`${words.marginAtEnd}: 36% · ${words.onCosts('4.800,00')}`)
    const bare = lifetimeMail(days)
    expect(bare.split('\n')[0]).toBe('AUR-02')
    expect(bare).toContain(`${words.ordered}: —`)
    expect(bare).not.toContain(words.marginAtEnd)
    expect(bare).toContain(words.withoutCost('Neri Ugo'))
    expect(bare).toContain(text.unreadMonths('2026-09'))
    // An amount invoiced with no order to compare it with is said as it is.
    expect(lifetimeMail({ ...days, invoiced: 100 })).toContain(`${words.invoiced}: 100,00`)
  })

  describe('with a plan', () => {
    const plan = messages.sheet.plan
    const kept: SheetPlan = {
      ...NO_SHEET_PLAN,
      lines: [
        {
          group: 'internal',
          name: 'Rossi Anna',
          unitCost: null,
          unitPrice: 60,
          budget: { '2026-09': 40, '2026-10': 40, '2026-11': 16 },
          forecast: {},
          declared: {},
        },
        {
          group: 'external',
          name: 'Studio Blu',
          unitCost: 50,
          unitPrice: 70,
          budget: { '2026-10': 16 },
          forecast: {},
          declared: {},
        },
      ],
    }
    const worked = [
      {
        person: 'Rossi Anna',
        day: '2026-09-10',
        hours: 32,
        project: 'AUR-01',
        approved: true,
        id: null,
      },
      {
        person: 'Rossi Anna',
        day: '2026-10-05',
        hours: 48,
        project: 'AUR-01',
        approved: true,
        id: null,
      },
      {
        person: 'Bianchi Luca',
        day: '2026-10-06',
        hours: 4,
        project: 'AUR-01',
        approved: true,
        id: null,
      },
    ]
    const viewOf = (of: SheetPlan) =>
      planView(of, 'AUR-01', worked, new Map([['anna rossi', 40]]), '2026-10', 8)
    const planned: Lifetime = { ...life, plan: viewOf(kept) }
    const apiWith = (plans: SheetPlans, more: Partial<Api> = {}) =>
      fakeApi({
        projectSheets: vi.fn(async () => ok([planned])),
        sheetPlans: vi.fn(async () => ok(plans)),
        ...more,
      })
    const open = async (part: 'budget' | 'months' | 'billing') =>
      fireEvent.click(await screen.findByRole('tab', { name: messages.sheet.parts[part] }))
    const type = (label: string, value: string) =>
      fireEvent.change(screen.getByLabelText(label), { target: { value } })

    it('starts a budget from who is known, and says who works with no line', async () => {
      const proposed = { 'AUR-01': kept }
      const api = fakeApi({
        projectSheets: vi.fn(async () => ok([{ ...life, plan: viewOf(NO_SHEET_PLAN) }])),
        proposeSheetPlan: vi.fn(async () => ok(proposed)),
      })
      render(<ProjectSheetView api={api} project={project} />)
      await open('budget')
      expect(screen.getByText(plan.empty)).toBeTruthy()
      expect(screen.getByText(plan.unplannedWarning('Bianchi Luca, Rossi Anna'))).toBeTruthy()
      // Nothing to confirm and nothing to save yet.
      expect(screen.queryByRole('button', { name: plan.confirm })).toBeNull()
      expect(screen.getByRole<HTMLButtonElement>('button', { name: plan.save }).disabled).toBe(true)
      fireEvent.click(screen.getByRole('button', { name: plan.propose }))
      await waitFor(() => expect(api.proposeSheetPlan).toHaveBeenCalledWith('p-1', 'AUR-01'))
      expect(await screen.findByRole('status')).toBeTruthy()
      expect(api.projectSheets).toHaveBeenCalledTimes(2)
    })

    it('writes the budget line by line and month by month, and saves it in one go', async () => {
      const api = apiWith({ 'AUR-01': kept })
      render(<ProjectSheetView api={api} project={project} />)
      await open('budget')
      const table = screen.getByRole('table', { name: plan.budgetTitle })
      // The year of the month that runs: twelve months, the line, what it costs and is sold for.
      expect(within(table).getAllByRole('columnheader')).toHaveLength(16)
      expect(
        within(table)
          .getAllByRole('row')
          .map((row) => row.querySelector('th')?.textContent?.trim())
          .slice(-4),
      ).toEqual([plan.totals.budget, plan.totals.revenue, plan.totals.costs, plan.totals.margin])
      // What an hour of the person costs today stands where no cost is written.
      const cost = screen.getByLabelText<HTMLInputElement>(plan.costOf('Rossi Anna'))
      expect(cost.value).toBe('')
      expect(cost.placeholder).toBe(plan.followsToday('40,00'))
      // A price written nowhere shows nothing; a cost of who is not of the company is as typed.
      expect(screen.getByLabelText<HTMLInputElement>(plan.costOf('Studio Blu')).value).toBe('50')
      expect(
        screen.getByLabelText<HTMLInputElement>(plan.cellOf('Rossi Anna', 'set 2026')).value,
      ).toBe('40')
      type(plan.cellOf('Rossi Anna', 'dic 2026'), 'otto')
      expect(screen.getByRole('alert').textContent).toBe(plan.wrong)
      expect(screen.getByRole<HTMLButtonElement>('button', { name: plan.save }).disabled).toBe(true)
      type(plan.cellOf('Rossi Anna', 'dic 2026'), '8,5')
      type(plan.priceOf('Rossi Anna'), '65')
      type(plan.cellOf('Rossi Anna', 'set 2026'), '')
      expect(screen.getByText(plan.unsaved)).toBeTruthy()
      // A line more, named, and one less.
      fireEvent.click(screen.getByRole('button', { name: plan.addLine(plan.groups.product) }))
      type(plan.nameOf(plan.groups.product, 1), 'Licenza')
      fireEvent.click(screen.getByRole('button', { name: plan.removeLine('Studio Blu') }))
      // What is typed stays while another tab is read.
      await open('months')
      await open('budget')
      expect(screen.getByLabelText<HTMLInputElement>(plan.priceOf('Rossi Anna')).value).toBe('65')
      fireEvent.click(screen.getByRole('button', { name: plan.save }))
      await waitFor(() =>
        expect(api.saveSheetPlans).toHaveBeenCalledWith('p-1', {
          'AUR-01': {
            ...kept,
            lines: [
              {
                ...kept.lines[0],
                unitPrice: 65,
                budget: { '2026-10': 40, '2026-11': 16, '2026-12': 8.5 },
              },
              {
                group: 'product',
                name: 'Licenza',
                unitCost: null,
                unitPrice: null,
                budget: {},
                forecast: {},
                declared: {},
              },
            ],
          },
        }),
      )
    })

    it('confirms the budget, and reopens it only when the PM says so twice', async () => {
      const confirmed = { 'AUR-01': { ...kept, confirmedOn: '2026-11-17' } }
      const api = apiWith(
        { 'AUR-01': kept },
        { confirmSheetBudget: vi.fn(async () => ok(confirmed)) },
      )
      api.sheetPlans = vi
        .fn()
        .mockResolvedValueOnce(ok({ 'AUR-01': kept }))
        .mockResolvedValue(ok(confirmed))
      render(<ProjectSheetView api={api} project={project} />)
      await open('budget')
      fireEvent.click(screen.getByRole('button', { name: plan.confirm }))
      await waitFor(() => expect(api.confirmSheetBudget).toHaveBeenCalledWith('p-1', 'AUR-01'))
      const told = plan.confirmed(dateText('2026-11-17'))
      expect(
        await screen.findByText(
          (_text, element) =>
            element?.tagName === 'P' && (element.textContent ?? '').startsWith(told),
        ),
      ).toBeTruthy()
      expect(screen.queryByRole('button', { name: plan.confirm })).toBeNull()
      fireEvent.click(screen.getByRole('button', { name: plan.reopen }))
      const dialog = screen.getByRole('dialog', { name: plan.reopenTitle })
      fireEvent.click(within(dialog).getByRole('button', { name: plan.cancel }))
      expect(screen.queryByRole('dialog')).toBeNull()
      fireEvent.click(screen.getByRole('button', { name: plan.reopen }))
      fireEvent.click(
        within(screen.getByRole('dialog', { name: plan.reopenTitle })).getByRole('button', {
          name: plan.reopen,
        }),
      )
      expect(screen.getByRole('button', { name: plan.confirm })).toBeTruthy()
      expect(screen.getByText(plan.unsaved)).toBeTruthy()
    })

    it('reads the months as they went and plans again those to come', async () => {
      const withLedger: Lifetime = {
        ...planned,
        economics: {
          invoiced: 0,
          billingMonths: [],
          billing: [],
          ledger: { revenue: 1900, costs: 1300, groups: [] },
          ledgerMonths: { '2026-09': { revenue: 1900, costs: 1300 } },
          suppliers: null,
        },
      }
      const api = apiWith(
        { 'AUR-01': kept },
        { projectSheets: vi.fn(async () => ok([withLedger])) },
      )
      render(<ProjectSheetView api={api} project={project} />)
      await open('months')
      expect(screen.getByText(plan.monthsIntro('ottobre 2026', 'novembre 2026'))).toBeTruthy()
      const rows = within(screen.getByRole('table', { name: plan.monthsTitle }))
        .getAllByRole('row')
        .map((row) => row.textContent ?? '')
      // September and October are what the timesheets say: read, never typed.
      const anna = rows.find((row) => row.startsWith('Rossi Anna')) ?? ''
      expect(anna).toContain('40,0060,003248')
      expect(screen.queryByLabelText(plan.cellOf('Rossi Anna', 'ott 2026'))).toBeNull()
      // Who has hours and no line is told, with nothing to type.
      expect(rows.some((row) => row.startsWith(`Bianchi Luca ${plan.unplanned}`))).toBe(true)
      expect(screen.queryByLabelText(plan.cellOf('Bianchi Luca', 'nov 2026'))).toBeNull()
      expect(screen.getByText(plan.withoutCost('Bianchi Luca'))).toBeTruthy()
      // What is computed, what NetSuite booked, the distance from the budget, how far the work is.
      for (const band of [
        plan.totals.computed,
        plan.totals.netsuite,
        plan.totals.variance,
        plan.totals.progress,
      ]) {
        expect(rows).toContain(band)
      }
      expect(figuresOf(plan.monthsTitle).map((figure) => figure.split(':')[0])).toEqual([
        plan.figures.actual,
        plan.figures.forecast,
        plan.figures.atEnd,
      ])
      // November is planned as in the budget until the PM writes otherwise.
      const november = screen.getByLabelText<HTMLInputElement>(
        plan.cellOf('Rossi Anna', 'nov 2026'),
      )
      expect(november.value).toBe('')
      expect(november.placeholder).toBe('16')
      type(plan.cellOf('Rossi Anna', 'nov 2026'), '24')
      type(plan.cellOf('Studio Blu', 'ott 2026'), '20')
      type(plan.totals.declaredOf('ott 2026'), '55')
      fireEvent.click(screen.getByRole('button', { name: plan.save }))
      await waitFor(() =>
        expect(api.saveSheetPlans).toHaveBeenCalledWith('p-1', {
          'AUR-01': {
            ...kept,
            lines: [
              { ...kept.lines[0], forecast: { '2026-11': 24 } },
              { ...kept.lines[1], forecast: { '2026-10': 20 } },
            ],
            declaredProgress: { '2026-10': 0.55 },
          },
        }),
      )
      // Another year is another grid.
      fireEvent.change(screen.getByLabelText(plan.year), { target: { value: '2027' } })
      expect(screen.getByLabelText(plan.cellOf('Rossi Anna', 'gen 2027'))).toBeTruthy()
    })

    it('has nothing to plan again while there is no budget and nobody worked', async () => {
      const api = fakeApi({ projectSheets: vi.fn(async () => ok([life])) })
      render(<ProjectSheetView api={api} project={project} />)
      await open('months')
      expect(screen.getByText(plan.emptyMonths)).toBeTruthy()
    })

    it('plans the invoices to issue and sets them beside those issued', async () => {
      const bill = messages.sheet.billing
      const api = fakeApi({ projectSheets: vi.fn(async () => ok([withSuppliers])) })
      render(<ProjectSheetView api={api} project={project} />)
      await open('billing')
      expect(screen.queryByRole('table', { name: bill.compareTable })).toBeNull()
      const cell = (column: keyof typeof bill.planColumns, row: number) =>
        bill.planCell(bill.planColumns[column], row)
      type(cell('salesOrder', 1), 'SO-1')
      type(cell('month', 1), 'ottobre')
      type(cell('amount', 1), '1.000')
      expect(screen.getByText(bill.planWrong(1))).toBeTruthy()
      expect(screen.getByRole<HTMLButtonElement>('button', { name: bill.planSave }).disabled).toBe(
        true,
      )
      type(cell('month', 1), '2026-10')
      expect(rowsOf(bill.compareTable)).toEqual([
        `${bill.month}${bill.planned}${bill.invoiced}${bill.difference}`,
        'set 20260,002.250,002.250,00',
        'ott 20261.000,001.300,00300,00',
        `${bill.total}1.000,003.550,002.550,00`,
      ])
      fireEvent.click(screen.getByRole('button', { name: bill.planSave }))
      await waitFor(() =>
        expect(api.saveSheetPlans).toHaveBeenCalledWith('p-1', {
          'AUR-01': {
            ...NO_SHEET_PLAN,
            milestones: [{ salesOrder: 'SO-1', month: '2026-10', amount: 1000 }],
          },
        }),
      )
    })

    it('keeps what the sheet says of the code beyond its figures, and writes its data in a file', async () => {
      const api = apiWith({ 'AUR-01': kept })
      render(<ProjectSheetView api={api} project={project} />)
      const registry = messages.sheet.registry
      fireEvent.change(await screen.findByLabelText(registry.fields.sales), {
        target: { value: 'Bassi Luca' },
      })
      fireEvent.click(screen.getByRole('button', { name: registry.save }))
      await waitFor(() =>
        expect(api.saveSheetPlans).toHaveBeenCalledWith('p-1', {
          'AUR-01': { ...kept, registry: { ...kept.registry, sales: 'Bassi Luca' } },
        }),
      )
      fireEvent.click(await screen.findByRole('button', { name: messages.sheet.exportData }))
      const path = '_octo/commessa/AUR-01/Dati 2026-11-17.csv'
      expect(
        await screen.findByText(new RegExp(messages.sheet.exported(path).slice(0, 30))),
      ).toBeTruthy()
      fireEvent.click(screen.getByRole('button', { name: messages.sheet.open }))
      expect(api.openEvidence).toHaveBeenCalledWith('p-1', path)
    })

    it('says why a plan could not be read, kept or written', async () => {
      const refused = { ok: false as const, code: 'sheet_plan_invalid' as const }
      render(
        <ProjectSheetView
          api={fakeApi({
            projectSheets: vi.fn(async () => ok([life])),
            sheetPlans: vi.fn(async () => refused),
          })}
          project={project}
        />,
      )
      expect((await screen.findByRole('alert')).textContent).toContain(
        errorText('sheet_plan_invalid'),
      )
      cleanup()
      const api = apiWith(
        { 'AUR-01': kept },
        {
          saveSheetPlans: vi.fn(async () => refused),
          exportSheetData: vi.fn(async () => ({
            ok: false as const,
            code: 'sheet_code_unknown' as const,
          })),
        },
      )
      render(<ProjectSheetView api={api} project={project} />)
      fireEvent.click(await screen.findByRole('button', { name: messages.sheet.exportData }))
      expect((await screen.findByRole('alert')).textContent).toContain(
        errorText('sheet_code_unknown'),
      )
      await open('budget')
      type(plan.priceOf('Rossi Anna'), '1')
      fireEvent.click(screen.getByRole('button', { name: plan.save }))
      await waitFor(() =>
        expect(screen.getByRole('alert').textContent).toContain(errorText('sheet_plan_invalid')),
      )
      // What was typed is still there to be saved again.
      expect(screen.getByText(plan.unsaved)).toBeTruthy()
    })
  })
})
