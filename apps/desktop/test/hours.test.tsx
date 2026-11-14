// @vitest-environment jsdom
import type { HoursView as View } from '@octo/application'
import { DEFAULT_HOURS_SETTINGS, type HoursSettings, type Project } from '@octo/domain'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HoursView, monthPeriod, previousMonth } from '../src/renderer/HoursView.tsx'
import { messages } from '../src/renderer/messages.ts'
import type { OctoApi, Result } from '../src/shared/api.ts'

const project: Project = { id: 'p-1', name: 'Aurora', folder: '/progetti/Aurora', addedAt: '' }
const NOW = new Date('2026-07-10T10:00:00.000Z')
const now = () => NOW
const ok = <T,>(value: T): Result<T> => ({ ok: true, value })
const text = messages.hours
const JUNE = { from: '2026-06-01', to: '2026-06-30' }

const configured: HoursSettings = {
  ...DEFAULT_HOURS_SETTINGS,
  timesheetPath: 'ore/Timesheets',
  worklogPath: 'ore/jira',
  projects: ['P1'],
}

const view: View = {
  period: JUNE,
  reconciliation: {
    rows: [
      {
        person: 'Bianchi Anna',
        timesheetHours: 80,
        worklogHours: 40,
        deltaPct: 50,
        status: 'outlier',
      },
      {
        person: 'Verdi Luca',
        timesheetHours: 16,
        worklogHours: 0,
        deltaPct: 100,
        status: 'no_worklog',
      },
      {
        person: 'Gialli Ugo',
        timesheetHours: 0,
        worklogHours: 12.5,
        deltaPct: null,
        status: 'no_timesheet',
      },
      {
        person: 'Rossi Mario',
        timesheetHours: 160,
        worklogHours: 156,
        deltaPct: 2.5,
        status: 'ok',
      },
    ],
    totals: { timesheetHours: 256, worklogHours: 208.5, deltaPct: 18.6 },
    excluded: {
      notApprovedHours: 8,
      partialTimesheetHours: 4,
      partialWorklogHours: 2,
      otherProjects: [{ project: 'P9', hours: 6 }],
    },
    possibleDuplicates: [],
    tieOut: { approvedHours: 260, accountedHours: 260, ok: true },
  },
  sources: {
    timesheetFiles: 2,
    worklogFiles: 1,
    unreadable: ['ore/jira/altro.csv'],
    lastTimesheetDay: '2026-06-30',
    lastWorklogDay: null,
  },
  projectCodes: ['P1', 'P9'],
}

type Api = Pick<
  OctoApi,
  'hoursSettings' | 'saveHoursSettings' | 'hoursCandidates' | 'hoursView' | 'readTrackerHours'
>

function fakeApi(overrides: Partial<Api> = {}) {
  const api: Api = {
    hoursSettings: vi.fn(async () => ok(configured)),
    saveHoursSettings: vi.fn(async (_id: string, settings: HoursSettings) => ok(settings)),
    hoursCandidates: vi.fn(async () =>
      ok({ timesheets: ['ore/Timesheets'], worklogs: ['ore/jira/w.csv'] }),
    ),
    hoursView: vi.fn(async () => ok(view)),
    readTrackerHours: vi.fn(async () =>
      ok({
        at: '2026-07-10T10:00:00.000Z',
        entries: 42,
        months: ['2026-06'],
        folder: '_octo/ore/jira',
      }),
    ),
    ...overrides,
  }
  return api
}

afterEach(cleanup)

describe('hours', () => {
  it('knows the months', () => {
    expect(previousMonth(new Date('2026-01-15T00:00:00Z'))).toEqual({
      from: '2025-12-01',
      to: '2025-12-31',
    })
    expect(monthPeriod('2026-02')).toEqual({ from: '2026-02-01', to: '2026-02-28' })
    expect(monthPeriod('')).toBeNull()
  })

  it('shows the comparison of the last complete month with what was left out', async () => {
    const api = fakeApi()
    render(<HoursView api={api} project={project} now={now} />)
    expect(await screen.findByText('Bianchi Anna')).toBeTruthy()
    expect(api.hoursView).toHaveBeenCalledWith('p-1', JUNE)
    expect(screen.getByText(text.tieOutOk('260'))).toBeTruthy()
    expect(screen.getByText(text.status.outlier)).toBeTruthy()
    expect(screen.getByText('12,5')).toBeTruthy()
    expect(screen.getByText('18,6%')).toBeTruthy()
    expect(screen.getByText(text.notApproved('8'))).toBeTruthy()
    expect(screen.getByText(text.partial('4', '2'))).toBeTruthy()
    expect(screen.getByText(text.otherProject('P9', '6'))).toBeTruthy()
    expect(screen.getByText(text.unreadable('ore/jira/altro.csv'))).toBeTruthy()
    expect(screen.getByText(new RegExp(`tracker ${text.noDay}`))).toBeTruthy()
    expect(screen.getByText(/P1, P9/)).toBeTruthy()
  })

  it('follows the month or the two days the PM chooses', async () => {
    const api = fakeApi()
    render(<HoursView api={api} project={project} now={now} />)
    await screen.findByText('Bianchi Anna')
    fireEvent.change(screen.getByLabelText(text.month), { target: { value: '2026-05' } })
    await waitFor(() =>
      expect(api.hoursView).toHaveBeenLastCalledWith('p-1', {
        from: '2026-05-01',
        to: '2026-05-31',
      }),
    )
    fireEvent.change(screen.getByLabelText(text.to), { target: { value: '2026-06-15' } })
    await waitFor(() =>
      expect(api.hoursView).toHaveBeenLastCalledWith('p-1', {
        from: '2026-05-01',
        to: '2026-06-15',
      }),
    )
  })

  it('remembers who is expected to have no hours on one side', async () => {
    const api = fakeApi()
    render(<HoursView api={api} project={project} now={now} />)
    await screen.findByText('Bianchi Anna')
    fireEvent.click(screen.getByRole('button', { name: `${text.markExpected}: Verdi Luca` }))
    await waitFor(() => expect(api.saveHoursSettings).toHaveBeenCalledTimes(1))
    expect(vi.mocked(api.saveHoursSettings).mock.calls[0]?.[1].noWorklogExpected).toEqual([
      'Verdi Luca',
    ])
    fireEvent.click(screen.getByRole('button', { name: `${text.markExpected}: Gialli Ugo` }))
    await waitFor(() => expect(api.saveHoursSettings).toHaveBeenCalledTimes(2))
    expect(vi.mocked(api.saveHoursSettings).mock.calls[1]?.[1].noTimesheetExpected).toEqual([
      'Gialli Ugo',
    ])
  })

  it('asks where the hours are the first time, proposing what it found', async () => {
    const api = fakeApi({ hoursSettings: vi.fn(async () => ok(DEFAULT_HOURS_SETTINGS)) })
    render(<HoursView api={api} project={project} now={now} />)
    await screen.findByRole('region', { name: text.setupTitle })
    const path = screen.getByLabelText(text.timesheetPath) as HTMLInputElement
    await waitFor(() => expect(path.value).toBe('ore/Timesheets'))
    fireEvent.change(screen.getByLabelText(text.projects), { target: { value: 'P1, P2' } })
    fireEvent.change(screen.getByLabelText(text.threshold), { target: { value: '30' } })
    fireEvent.change(screen.getByLabelText(text.aliases), {
      target: { value: 'anna.b = Bianchi Anna\nriga senza segno' },
    })
    fireEvent.click(screen.getByRole('button', { name: text.save }))
    await waitFor(() => expect(api.saveHoursSettings).toHaveBeenCalled())
    expect(vi.mocked(api.saveHoursSettings).mock.calls[0]?.[1]).toMatchObject({
      timesheetPath: 'ore/Timesheets',
      worklogPath: 'ore/jira/w.csv',
      projects: ['P1', 'P2'],
      thresholdPct: 30,
      aliases: [{ worklog: 'anna.b', timesheet: 'Bianchi Anna' }],
    })
    expect(await screen.findByText('Bianchi Anna')).toBeTruthy()
  })

  it('reads the hours from Jira when asked and compares again from what it read', async () => {
    const fromJira = { ...configured, worklogPath: '_octo/ore/jira' }
    const settings = vi
      .fn<Api['hoursSettings']>()
      .mockResolvedValueOnce(ok({ ...DEFAULT_HOURS_SETTINGS, timesheetPath: 'ore/Timesheets' }))
      .mockResolvedValue(ok(fromJira))
    const api = fakeApi({ hoursSettings: settings })
    render(<HoursView api={api} project={project} now={now} />)
    fireEvent.click(await screen.findByRole('button', { name: text.readTracker }))
    expect(await screen.findByText(/^Lette 42 registrazioni di ore \(2026-06\)/)).toBeTruthy()
    expect(api.readTrackerHours).toHaveBeenCalledWith('p-1', JUNE)
    expect(await screen.findByText('Bianchi Anna')).toBeTruthy()
    cleanup()
    const refused = fakeApi({
      readTrackerHours: vi.fn(async () => ({
        ok: false as const,
        code: 'source_not_configured' as const,
      })),
    })
    render(<HoursView api={refused} project={project} now={now} />)
    await screen.findByText('Bianchi Anna')
    fireEvent.click(screen.getByRole('button', { name: text.readTracker }))
    expect((await screen.findByRole('alert')).textContent).toBeTruthy()
  })

  it('says when the numbers cannot be used and explains a failure', async () => {
    const broken = fakeApi({
      hoursView: vi.fn(async () =>
        ok({
          ...view,
          reconciliation: {
            ...view.reconciliation,
            rows: [],
            excluded: {
              notApprovedHours: 0,
              partialTimesheetHours: 0,
              partialWorklogHours: 0,
              otherProjects: [],
            },
            possibleDuplicates: [{ projects: ['P1', 'P2'] as [string, string], hours: 16 }],
            tieOut: { approvedHours: 260, accountedHours: 250, ok: false },
          },
          sources: { ...view.sources, unreadable: [] },
        }),
      ),
    })
    render(<HoursView api={broken} project={project} now={now} />)
    const alerts = (await screen.findAllByRole('alert')).map((alert) => alert.textContent)
    expect(alerts).toEqual([
      text.tieOutFailed('260', '250'),
      text.possibleDuplicate('16', 'P1', 'P2'),
    ])
    expect(screen.getByText(text.noRows)).toBeTruthy()
    expect(screen.getByText(text.nothingExcluded)).toBeTruthy()
    cleanup()
    const missing = fakeApi({
      hoursView: vi.fn(async () => ({
        ok: false as const,
        code: 'hours_worklog_missing' as const,
      })),
    })
    render(<HoursView api={missing} project={project} now={now} />)
    expect((await screen.findByRole('alert')).textContent).toContain('.csv')
    cleanup()
    const damaged = fakeApi({
      hoursSettings: vi.fn(async () => ({
        ok: false as const,
        code: 'hours_settings_invalid' as const,
      })),
    })
    render(<HoursView api={damaged} project={project} now={now} />)
    expect((await screen.findByRole('alert')).textContent).toContain('non sono valide')
  })
})
