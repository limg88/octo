// @vitest-environment jsdom
import {
  DEFAULT_FORECAST_SETTINGS,
  type ForecastSettings,
  type Lifetime,
  NO_FORECAST_PROJECT,
  NO_ROW_INPUTS,
  type Project,
} from '@octo/domain'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { lifetimeMail } from '../src/renderer/forecast-text.ts'
import { messages } from '../src/renderer/messages.ts'
import { ProjectSheetView } from '../src/renderer/ProjectSheetView.tsx'
import type { Section } from '../src/renderer/sections.ts'
import type { OctoApi, Result } from '../src/shared/api.ts'

const project: Project = { id: 'p-1', name: 'Aurora', folder: '/progetti/Aurora', addedAt: '' }
const ok = <T,>(value: T): Result<T> => ({ ok: true, value })
const text = messages.forecast
const words = messages.sheet.summary

// The hours and the forecast of the month have their own tests: here they are only held.
vi.mock('../src/renderer/HoursView.tsx', () => ({
  HoursView: (props: { project: Project; onOpenSources: () => void }) => (
    <button type="button" onClick={props.onOpenSources}>
      sources<span>hours of {props.project.id}</span>
    </button>
  ),
}))
vi.mock('../src/renderer/ForecastView.tsx', () => ({
  ForecastView: (props: { project: Project }) => <p>forecast of {props.project.id}</p>,
}))

type Api = Pick<OctoApi, 'projectSheets' | 'forecastSettings' | 'saveForecastSettings'>
type SheetProps = {
  api: Api
  project: Project
  place?: 'sheet' | 'hours' | 'forecast'
  onOpenSection?: (section: Section) => void
}
/** The page as the app holds it: on its figures, unless a test says where the PM is. */
const Sheet = ({ api, project, place = 'sheet', onOpenSection = () => {} }: SheetProps) => (
  <ProjectSheetView
    api={api as OctoApi}
    project={project}
    place={place}
    onOpenSection={onOpenSection}
  />
)

function fakeApi(overrides: Partial<Api> = {}) {
  const api: Api = {
    projectSheets: vi.fn(async () => ok<Lifetime[]>([])),
    forecastSettings: vi.fn(async () => ok(DEFAULT_FORECAST_SETTINGS)),
    saveForecastSettings: vi.fn(async (_id: string, settings: ForecastSettings) => ok(settings)),
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
  estimatedHours: 0,
  estimatedCosts: 0,
  marginToDate: (7500 - 3457) / 7500,
  budgetCosts: 4800,
  proposedBudget: null,
  progress: { share: 0.55, source: 'system', day: '2026-10-31' },
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
    render(<Sheet api={api} project={project} />)
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
      `${words.progress}: 55%${words.progressSources.system('31/10/2026')}`,
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
    const { unmount } = render(<Sheet api={api} project={other} />)
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
      `${words.progress}: —${words.noProgress}`,
      `${words.marginAtEnd}: —${words.noExpected}`,
    ])
    // Back from another section the same code is shown.
    unmount()
    render(<Sheet api={api} project={other} />)
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
    render(<Sheet api={api} project={project} />)
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
    render(<Sheet api={api} project={project} />)
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
    render(<Sheet api={unread} project={project} />)
    fireEvent.click(await screen.findByRole('button', { name: words.useProposed }))
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(unread.saveForecastSettings).not.toHaveBeenCalled()
    cleanup()
    const unsaved = fakeApi({
      projectSheets: vi.fn(async () => ok([proposed])),
      saveForecastSettings: vi.fn(async () => refused),
    })
    render(<Sheet api={unsaved} project={project} />)
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
    render(<Sheet api={failing} project={project} onOpenSection={onOpenSection} />)
    expect((await screen.findByRole('alert')).textContent).toMatch(/timesheet/i)
    cleanup()
    render(<Sheet api={fakeApi()} project={project} />)
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
    render(<Sheet api={api} project={project} />)
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
    render(<Sheet api={api} project={project} />)
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
      <Sheet api={fakeApi({ projectSheets: vi.fn(async () => ok([same])) })} project={project} />,
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
      <Sheet api={fakeApi({ projectSheets: vi.fn(async () => ok([empty])) })} project={project} />,
    )
    expect(await screen.findByText(words.ledger.none)).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: messages.sheet.parts.billing }))
    expect(screen.getByText(messages.sheet.billing.noInvoices)).toBeTruthy()
    expect(screen.getByText(messages.sheet.billing.noSuppliers)).toBeTruthy()
  })

  it('shows the invoices to the client by order and by month, and the orders to the suppliers', async () => {
    const bill = messages.sheet.billing
    const api = fakeApi({ projectSheets: vi.fn(async () => ok([withSuppliers])) })
    render(<Sheet api={api} project={project} />)
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
    render(<Sheet api={api} project={project} onOpenSection={onOpenSection} />)
    fireEvent.click(await screen.findByRole('tab', { name: messages.sheet.parts.billing }))
    expect(screen.getByText(bill.notRead)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: messages.openSection(messages.sourcesTab) }))
    expect(onOpenSection).toHaveBeenCalledWith('sources')
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
    // How far the code is never goes without what says so.
    expect(mail).toContain(words.progressMail('55%', words.progressSources.system('31/10/2026')))
    expect(mail).toContain(`${words.budgetCosts}: 4.800,00`)
    const other = { ...life, progress: { share: 0.7, source: 'recognized' as const, day: null } }
    expect(lifetimeMail(other)).toContain(words.progressSources.recognized)
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

  it('holds the hours and the forecast of the month as parts of the page, each a place of its own', async () => {
    const onOpenSection = vi.fn()
    const api = fakeApi({ projectSheets: vi.fn(async () => ok([life])) })
    const { rerender } = render(<Sheet api={api} project={project} onOpenSection={onOpenSection} />)
    await screen.findByRole('table', { name: words.people })
    const parts = messages.sheet.parts
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      parts.summary,
      parts.billing,
      parts.hours,
      parts.forecast,
    ])
    // The hours are a place the signals of «Oggi» send to: the app is told, and shows them.
    fireEvent.click(screen.getByRole('tab', { name: parts.hours }))
    expect(onOpenSection).toHaveBeenLastCalledWith('hours')
    rerender(<Sheet api={api} project={project} place="hours" onOpenSection={onOpenSection} />)
    expect(screen.getByText('hours of p-1')).toBeTruthy()
    expect(screen.getByRole('tab', { name: parts.hours }).getAttribute('aria-selected')).toBe(
      'true',
    )
    expect(screen.queryByRole('table', { name: words.people })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /^sources/ }))
    expect(onOpenSection).toHaveBeenLastCalledWith('sources')
    rerender(<Sheet api={api} project={project} place="forecast" onOpenSection={onOpenSection} />)
    expect(screen.getByText('forecast of p-1')).toBeTruthy()
    // Back to the figures: they are read again, so hours read meanwhile are counted.
    fireEvent.click(screen.getByRole('tab', { name: parts.summary }))
    expect(onOpenSection).toHaveBeenLastCalledWith('sheet')
    rerender(<Sheet api={api} project={project} place="sheet" onOpenSection={onOpenSection} />)
    await screen.findByRole('table', { name: words.people })
    expect(api.projectSheets).toHaveBeenCalledTimes(2)
  })
})
