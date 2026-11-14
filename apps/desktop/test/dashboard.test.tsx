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
}

type Api = Pick<
  OctoApi,
  'dashboardSettings' | 'saveDashboardSettings' | 'dashboardCandidates' | 'dashboardView'
>

function fakeApi(overrides: Partial<Api> = {}) {
  const api: Api = {
    dashboardSettings: vi.fn(async () => ok(configured)),
    saveDashboardSettings: vi.fn(async (_id: string, settings: DashboardSettings) => ok(settings)),
    dashboardCandidates: vi.fn(async () => ok({ exports: ['data/latest.json'], histories: [] })),
    dashboardView: vi.fn(async () => ok(view)),
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
