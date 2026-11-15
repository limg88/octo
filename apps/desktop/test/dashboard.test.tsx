// @vitest-environment jsdom
import type { DashboardView as View } from '@octo/application'
import { type DashboardSettings, DEFAULT_DASHBOARD_SETTINGS, type Project } from '@octo/domain'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { DashboardView } from '../src/renderer/DashboardView.tsx'
import { presetRange, wholeDays } from '../src/renderer/dashboard-range.ts'
import { messages } from '../src/renderer/messages.ts'
import type { OctoApi, Result } from '../src/shared/api.ts'

const project: Project = { id: 'p-1', name: 'Aurora', folder: '/progetti/Aurora', addedAt: '' }
const NOW = new Date('2026-06-30T10:00:00.000Z')
const now = () => NOW
const ok = <T,>(value: T): Result<T> => ({ ok: true, value })
const text = messages.dashboard

const configured: DashboardSettings = {
  ...DEFAULT_DASHBOARD_SETTINGS,
  exportPath: 'data/latest.json',
  tags: ['Team'],
}

const view: View = {
  exportedAt: '2026-06-30T08:00:00.000Z',
  age: 'fresh',
  bugs: {
    open: [
      {
        id: '101',
        title: 'Totale sbagliato',
        state: '04 - In Progress',
        phase: 'work',
        assignee: null,
        severity: null,
        environment: null,
        createdAt: '2026-05-01T08:00:00Z',
        daysInState: 45,
        stuck: true,
        lastComment: { by: 'Dev', at: '2026-06-01', text: '<p>In attesa del dato</p>' },
        note: null,
      },
    ],
    byPhase: { work: 1, verify: 0, validated: 2, closed: 7 },
    stuck: 1,
    total: 10,
    trend: [
      { from: '2026-06-22', entered: 3, closed: 1, openAtEnd: 2 },
      { from: '2026-06-29', entered: 0, closed: 1, openAtEnd: 1 },
    ],
    trendSource: 'history',
    flow: {
      toVerify: { median: 12, sample: 8 },
      toValidated: { median: null, sample: 0 },
      toClosed: { median: 30, sample: 4 },
    },
  },
  requirements: [
    {
      id: '201',
      title: 'Esportazione',
      state: 'New',
      period: 'P2',
      assignee: null,
      signals: ['S1', 'S5'],
      unclear: { word: 'TBD', context: 'il formato è TBD' },
      note: null,
    },
  ],
  states: [
    { state: '04 - In Progress', phase: 'work', mappedByHand: false, count: 1 },
    { state: '06 - Ready for Test', phase: 'verify', mappedByHand: false, count: 0 },
  ],
  periods: ['P1', 'P2'],
  tags: ['Team', 'Altro', 'Terzo'],
}

type Api = Pick<
  OctoApi,
  | 'chooseProjectPath'
  | 'dashboardSettings'
  | 'saveDashboardSettings'
  | 'dashboardCandidates'
  | 'dashboardView'
  | 'readTrackerSnapshot'
>

function fakeApi(overrides: Partial<Api> = {}) {
  const api: Api = {
    chooseProjectPath: vi.fn(async () => ok<string | null>('scelto/qui')),
    dashboardSettings: vi.fn(async () => ok(configured)),
    saveDashboardSettings: vi.fn(async (_id: string, settings: DashboardSettings) => ok(settings)),
    dashboardCandidates: vi.fn(async () => ok({ exports: ['data/latest.json'], histories: [] })),
    dashboardView: vi.fn(async () => ok(view)),
    readTrackerSnapshot: vi.fn(async () =>
      ok({ at: '2026-06-30T09:30:00.000Z', items: 4601, withHistory: 677 }),
    ),
    ...overrides,
  }
  return api
}

afterEach(cleanup)

describe('dashboard', () => {
  it('shows figures, trend, flow, open bugs and unclear requirements', async () => {
    const api = fakeApi()
    render(<DashboardView api={api} project={project} now={now} />)
    const open = await screen.findByRole('region', { name: text.openTitle })
    expect(within(open).getByText('Totale sbagliato')).toBeTruthy()
    expect(within(open).getByText(text.stuckBadge)).toBeTruthy()
    expect(within(open).getByText(/In attesa del dato/)).toBeTruthy()
    expect(screen.getByText(text.total(10))).toBeTruthy()
    expect(screen.getByText(text.days(12))).toBeTruthy()
    expect(screen.getByText(text.days(null))).toBeTruthy()
    expect(screen.getByRole('img', { name: text.trendTitle })).toBeTruthy()
    expect(screen.getByText(/il formato è TBD/)).toBeTruthy()
    expect(screen.getByText(new RegExp(text.age.fresh))).toBeTruthy()
    expect(api.dashboardView).toHaveBeenCalledWith('p-1', wholeDays(presetRange('w8', NOW)))
  })

  it('reads Azure DevOps on request, from the first setup, and shows the dashboard from it', async () => {
    const empty = { ...configured, exportPath: '' }
    const api = fakeApi({
      dashboardSettings: vi
        .fn<Api['dashboardSettings']>()
        .mockResolvedValueOnce(ok(empty))
        .mockResolvedValue(ok(configured)),
      readTrackerSnapshot: vi
        .fn<Api['readTrackerSnapshot']>()
        .mockResolvedValueOnce({ ok: false, code: 'secret_missing' })
        .mockResolvedValue(ok({ at: '2026-06-30T09:30:00.000Z', items: 4601, withHistory: 677 })),
    })
    render(<DashboardView api={api} project={project} now={now} />)
    const read = await screen.findByRole('button', { name: text.readTracker })
    fireEvent.click(read)
    expect((await screen.findByRole('alert')).textContent).toMatch(/Serve la credenziale/)
    expect(api.dashboardView).not.toHaveBeenCalled()

    fireEvent.click(read)
    expect(await screen.findByText(/Letti 4601 work item, 677 con la cronologia/)).toBeTruthy()
    // The settings now point at the file Octo wrote: the dashboard is computed from it.
    expect(await screen.findByRole('region', { name: text.openTitle })).toBeTruthy()
    expect(api.readTrackerSnapshot).toHaveBeenLastCalledWith('p-1')
  })

  it('says that Azure DevOps is not linked, with or without the way to the sources', async () => {
    const api = fakeApi({
      dashboardSettings: async () => ok({ ...configured, exportPath: '' }),
      readTrackerSnapshot: async () => ({ ok: false, code: 'source_not_configured' }),
    })
    const onOpenSources = vi.fn()
    const view = render(
      <DashboardView api={api} project={project} now={now} onOpenSources={onOpenSources} />,
    )
    expect(await screen.findByText(text.saveNeeds)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: text.readTracker }))
    expect((await screen.findByRole('alert')).textContent).toContain(text.adoUnlinked)
    fireEvent.click(screen.getByRole('button', { name: messages.openSources }))
    expect(onOpenSources).toHaveBeenCalledTimes(1)
    view.unmount()

    render(<DashboardView api={api} project={project} now={now} />)
    fireEvent.click(await screen.findByRole('button', { name: text.readTracker }))
    expect((await screen.findByRole('alert')).textContent).toContain(text.adoUnlinked)
    expect(screen.queryByRole('button', { name: messages.openSources })).toBeNull()
  })

  it('keeps the reading beside the age of the data, and the numbers of the trend folded', async () => {
    const api = fakeApi()
    render(<DashboardView api={api} project={project} now={now} />)
    await screen.findByRole('region', { name: text.openTitle })
    // Newer data are one click away, without opening the settings.
    const read = screen.getByRole('button', { name: text.readTracker })
    expect(read.closest('details')).toBeNull()
    fireEvent.click(read)
    await waitFor(() => expect(api.readTrackerSnapshot).toHaveBeenCalledWith('p-1'))
    expect(screen.getByText(text.trendNumbers).closest('details')?.open).toBe(false)
  })

  it('offers the reading first and the file second, folded when no export is found', async () => {
    const api = fakeApi({
      dashboardSettings: vi.fn(async () => ok(DEFAULT_DASHBOARD_SETTINGS)),
      dashboardCandidates: vi.fn(async () => ok({ exports: [], histories: [] })),
    })
    render(<DashboardView api={api} project={project} now={now} />)
    const read = await screen.findByRole('button', { name: text.readTracker })
    expect(read.className).toBe('primary')
    expect(screen.getByText(text.haveExport).closest('details')?.open).toBe(false)
  })

  it('reads a longer period by month, or the one the PM chooses', async () => {
    const api = fakeApi()
    render(<DashboardView api={api} project={project} now={now} />)
    await screen.findByRole('region', { name: text.openTitle })
    fireEvent.click(screen.getByRole('button', { name: text.presets.y1 }))
    await waitFor(() =>
      expect(api.dashboardView).toHaveBeenLastCalledWith('p-1', {
        from: '2025-07-01',
        to: '2026-06-30T23:59:59.999Z',
        granularity: 'month',
      }),
    )
    fireEvent.click(screen.getByRole('button', { name: text.presets.custom }))
    fireEvent.change(screen.getByLabelText(text.from), { target: { value: '2024-01-01' } })
    fireEvent.change(screen.getByLabelText(text.granularity), { target: { value: 'week' } })
    await waitFor(() =>
      expect(api.dashboardView).toHaveBeenLastCalledWith('p-1', {
        from: '2024-01-01',
        to: '2026-06-30T23:59:59.999Z',
        granularity: 'week',
      }),
    )
  })

  it('keeps what the PM decides as data with its date', async () => {
    const api = fakeApi()
    render(<DashboardView api={api} project={project} now={now} />)
    await screen.findByRole('region', { name: text.openTitle })
    fireEvent.click(screen.getByRole('button', { name: text.addNote }))
    fireEvent.change(screen.getByLabelText(text.noteLabel('101')), {
      target: { value: 'Sentito il cliente' },
    })
    fireEvent.click(screen.getByRole('button', { name: text.saveNote }))
    await waitFor(() => expect(api.saveDashboardSettings).toHaveBeenCalledTimes(1))
    const at = NOW.toISOString()
    expect(vi.mocked(api.saveDashboardSettings).mock.calls[0]?.[1].decisions.notes).toEqual([
      { id: '101', at, text: 'Sentito il cliente' },
    ])
    fireEvent.click(screen.getByRole('button', { name: text.removeSignal('S5') }))
    await waitFor(() => expect(api.saveDashboardSettings).toHaveBeenCalledTimes(2))
    expect(
      vi.mocked(api.saveDashboardSettings).mock.calls[1]?.[1].decisions.removedSignals,
    ).toEqual([{ id: '201', signal: 'S5', at }])
    fireEvent.click(screen.getByRole('button', { name: text.markClear }))
    await waitFor(() => expect(api.saveDashboardSettings).toHaveBeenCalledTimes(3))
    expect(
      vi.mocked(api.saveDashboardSettings).mock.calls[2]?.[1].decisions.excludedRequirements,
    ).toEqual([{ id: '201', at }])
  })

  it('asks where the export is the first time, proposing the one found', async () => {
    const api = fakeApi({ dashboardSettings: vi.fn(async () => ok(DEFAULT_DASHBOARD_SETTINGS)) })
    render(<DashboardView api={api} project={project} now={now} />)
    await screen.findByRole('region', { name: text.setupTitle })
    const path = screen.getByLabelText(text.exportPath) as HTMLInputElement
    await waitFor(() => expect(path.value).toBe('data/latest.json'))
    // The history is chosen from the dialog of the system; a file elsewhere is refused.
    const choose = screen.getByRole('button', {
      name: `${messages.choosePath}: ${text.historyPath}`,
    })
    vi.mocked(api.chooseProjectPath).mockResolvedValueOnce({
      ok: false,
      code: 'path_outside_project',
    })
    fireEvent.click(choose)
    expect((await screen.findByRole('alert')).textContent).toMatch(/fuori dalla cartella/)
    fireEvent.click(choose)
    await waitFor(() =>
      expect((screen.getByLabelText(text.historyPath) as HTMLInputElement).value).toBe(
        'scelto/qui',
      ),
    )
    expect(api.chooseProjectPath).toHaveBeenLastCalledWith('p-1', 'file', ['json'])
    fireEvent.change(screen.getByLabelText(text.tags), { target: { value: 'Team, Altro' } })
    fireEvent.click(screen.getByRole('button', { name: text.save }))
    await waitFor(() => expect(api.saveDashboardSettings).toHaveBeenCalled())
    expect(vi.mocked(api.saveDashboardSettings).mock.calls[0]?.[1]).toMatchObject({
      exportPath: 'data/latest.json',
      tags: ['Team', 'Altro'],
    })
    await screen.findByRole('region', { name: text.openTitle })
  })

  it('lets the PM correct phases, periods and the handover state', async () => {
    const api = fakeApi()
    render(<DashboardView api={api} project={project} now={now} />)
    await screen.findByRole('region', { name: text.openTitle })
    fireEvent.click(screen.getByLabelText('P2'))
    fireEvent.click(screen.getByLabelText('06 - Ready for Test'))
    fireEvent.change(screen.getByLabelText(/04 - In Progress/), { target: { value: 'closed' } })
    fireEvent.change(screen.getByLabelText(text.stuckDays), { target: { value: '15' } })
    fireEvent.click(screen.getByRole('button', { name: text.save }))
    await waitFor(() => expect(api.saveDashboardSettings).toHaveBeenCalled())
    expect(vi.mocked(api.saveDashboardSettings).mock.calls[0]?.[1]).toMatchObject({
      requirementPeriods: ['P2'],
      handoverStates: ['06 - Ready for Test'],
      phases: { '04 - In Progress': 'closed' },
      stuckDays: 15,
    })
  })

  it('explains a failure and says when the data are old', async () => {
    const failing = fakeApi({
      dashboardView: vi.fn(async () => ({
        ok: false as const,
        code: 'tracker_export_missing' as const,
      })),
    })
    render(<DashboardView api={failing} project={project} now={now} />)
    expect((await screen.findByRole('alert')).textContent).toContain('non c’è più')
    cleanup()
    const stale = fakeApi({
      dashboardView: vi.fn(async () =>
        ok({
          ...view,
          age: 'stale' as const,
          exportedAt: null,
          bugs: { ...view.bugs, open: [], flow: null, trendSource: 'approximate' as const },
          requirements: [],
        }),
      ),
    })
    render(<DashboardView api={stale} project={project} now={now} />)
    expect(await screen.findByText(new RegExp(text.age.stale))).toBeTruthy()
    expect(screen.getByText(text.noOpen)).toBeTruthy()
    expect(screen.getByText(text.noRequirements)).toBeTruthy()
    expect(screen.getByText(text.trendApproximate)).toBeTruthy()
    cleanup()
    const broken = fakeApi({
      dashboardSettings: vi.fn(async () => ({
        ok: false as const,
        code: 'dashboard_settings_invalid' as const,
      })),
    })
    render(<DashboardView api={broken} project={project} now={now} />)
    expect((await screen.findByRole('alert')).textContent).toContain('rovinate')
  })
})
