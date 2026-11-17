// @vitest-environment jsdom
import type { FeedView, TrackerSnapshotRun, DashboardView as View } from '@octo/application'
import {
  type DashboardSettings,
  DEFAULT_DASHBOARD_SETTINGS,
  type FeedName,
  type Project,
} from '@octo/domain'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
const READ_ADO = text.readTracker(text.trackerNames.ado)
const OPEN_ADO = text.openInTracker(text.trackerNames.ado)

const FEED_CONFIGS = {
  ado: { organization: 'contoso', project: 'Aurora', areas: [] },
  jira: { site: 'contoso', email: 'pm@example.test', projects: ['AUR'] },
}
/** A feed of the project as «Fonti» shows it: linked, or never set. */
const feedView = (feed: FeedName, linked: boolean): FeedView =>
  ({
    feed,
    config:
      linked && (feed === 'ado' || feed === 'jira')
        ? { ...FEED_CONFIGS[feed], since: '2026-01-01', targetFolder: `Fonti/${feed}` }
        : null,
    suggestedFolder: `Fonti/${feed}`,
    hasSecret: linked,
    state: { cursor: null, lastRun: null },
    readBy: null,
    readingBy: null,
  }) as FeedView

const configured: DashboardSettings = {
  ...DEFAULT_DASHBOARD_SETTINGS,
  exportPath: 'data/latest.json',
  tags: ['Team'],
}

const view: View = {
  tracker: 'ado',
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
    validated: [
      {
        id: '201',
        title: 'Data nel PDF',
        state: '10 - Validated',
        phase: 'validated',
        assignee: 'Luca',
        severity: null,
        environment: null,
        createdAt: '2026-04-01T08:00:00Z',
        daysInState: 12,
        stuck: false,
        lastComment: null,
        note: null,
      },
      {
        id: '202',
        title: 'Etichetta del riepilogo',
        state: '10 - Validated',
        phase: 'validated',
        assignee: 'Luca',
        severity: null,
        environment: null,
        createdAt: '2026-04-01T08:00:00Z',
        daysInState: 3,
        stuck: false,
        lastComment: null,
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
    before: { open: 3, work: 2, verify: 1, stuck: 0, validated: 2 },
    flowBefore: {
      toVerify: { median: 9, sample: 5 },
      toValidated: { median: null, sample: 0 },
      toClosed: { median: null, sample: 0 },
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
  linked: true,
  waiting: [
    {
      id: '301',
      type: 'story',
      title: 'Formato della data',
      state: 'Active',
      assignee: 'Carla Bianchi',
      askedBy: 'Mario Rossi',
      askedAt: '2026-06-22T09:00:00Z',
      workdays: 6,
      question: 'Quale formato serve?',
      fromClient: true,
    },
    {
      id: '302',
      type: 'bug',
      title: 'Arrotondamento',
      state: 'Active',
      assignee: null,
      askedBy: 'Carla Bianchi',
      askedAt: '2026-06-25T09:00:00Z',
      workdays: 3,
      question: 'Potete confermare la regola?',
      fromClient: false,
    },
  ],
  tellsSides: true,
  sprints: ['Sprint 11', 'Sprint 12'],
  currentSprint: 'Sprint 12',
  upcomingSprint: 'Sprint 13',
  sprint: {
    name: 'Sprint 12',
    from: '2026-06-15',
    to: '2026-07-01',
    stories: [
      {
        id: '401',
        title: 'Invio conferma',
        state: 'Active',
        stage: 'work',
        assignee: 'Luca',
        daysInState: 6,
      },
      {
        id: '402',
        title: 'Stampa ordine',
        state: 'Closed',
        stage: 'closed',
        assignee: null,
        daysInState: null,
      },
    ],
    byStage: { todo: 0, work: 1, verify: 0, validated: 0, closed: 1 },
    bugs: [
      {
        id: '101',
        title: 'Totale sbagliato',
        state: '04 - In Progress',
        stage: 'work',
        assignee: null,
        daysInState: 45,
      },
    ],
    bugsOpen: 1,
    bugsClosed: 0,
    ending: true,
    atRisk: [
      {
        id: '401',
        title: 'Invio conferma',
        state: 'Active',
        stage: 'work',
        assignee: 'Luca',
        daysInState: 6,
      },
    ],
  },
  comparison: [
    {
      name: 'Sprint 11',
      from: '2026-06-01',
      to: '2026-06-14',
      stories: 5,
      done: 4,
      doneInTime: 3,
      open: 1,
      bugsEntered: 2,
    },
    {
      name: 'Sprint 12',
      from: null,
      to: null,
      stories: 2,
      done: 1,
      doneInTime: null,
      open: 1,
      bugsEntered: null,
    },
  ],
  decisions: [
    {
      kind: 'clear',
      id: '501',
      title: 'Vecchio requisito',
      at: '2026-06-10T08:00:00Z',
      signal: null,
      text: null,
    },
  ],
  types: [
    { type: 'Bug', count: 30 },
    { type: 'User Story', count: 12 },
    { type: 'Task', count: 4 },
  ],
  parts: { sprint: true, bugs: true, trend: true, activities: false },
  activities: { rows: [], people: [], hours: 0, otherHours: 0 },
}

type Api = Pick<
  OctoApi,
  | 'chooseProjectPath'
  | 'dashboardSettings'
  | 'saveDashboardSettings'
  | 'dashboardCandidates'
  | 'dashboardView'
  | 'readTrackerSnapshot'
  | 'refreshTrackerSnapshot'
  | 'openTrackerItem'
  | 'commentDashboard'
  | 'draftReminder'
  | 'onSourcesChanged'
  | 'feed'
>

function fakeApi(overrides: Partial<Api> = {}) {
  const api: Api = {
    chooseProjectPath: vi.fn(async () => ok<string | null>('scelto/qui')),
    dashboardSettings: vi.fn(async () => ok(configured)),
    saveDashboardSettings: vi.fn(async (_id: string, settings: DashboardSettings) => ok(settings)),
    dashboardCandidates: vi.fn(async () => ok({ exports: ['data/latest.json'], histories: [] })),
    dashboardView: vi.fn(async () => ok(view)),
    readTrackerSnapshot: vi.fn(async () =>
      ok({
        tracker: 'ado' as const,
        at: '2026-06-30T09:30:00.000Z',
        items: 4601,
        withHistory: 677,
      }),
    ),
    refreshTrackerSnapshot: vi.fn(async () => ok(null)),
    openTrackerItem: vi.fn(async () => ok(true)),
    commentDashboard: vi.fn(async () =>
      ok({
        at: '2026-06-30T10:00:00.000Z',
        exportedAt: view.exportedAt,
        range: wholeDays(presetRange('w8', NOW)),
        sentences: [{ text: 'Il bug #101 è fermo da 45 giorni.', ids: ['101'] }],
        dropped: 1,
      }),
    ),
    draftReminder: vi.fn(async (_id: string, id: string) =>
      ok({ id, to: 'Carla Bianchi', text: 'Buongiorno Carla,\nserve il formato.' }),
    ),
    onSourcesChanged: vi.fn(() => () => {}),
    feed: vi.fn(async (_id: string, feed: FeedName) => ok(feedView(feed, feed === 'ado'))),
    ...overrides,
  }
  return api
}

const openTab = (name: string) => fireEvent.click(screen.getByRole('tab', { name }))

afterEach(cleanup)

describe('dashboard', () => {
  it('shows figures, trend, flow, open bugs and unclear requirements', async () => {
    const api = fakeApi()
    render(<DashboardView api={api} project={project} now={now} />)
    const open = await screen.findByRole('region', { name: text.qualityTitle })
    // The bug in view is in the list and, beside it, in its detail.
    expect(within(open).getAllByText('Totale sbagliato')).toHaveLength(2)
    expect(within(open).getAllByText(new RegExp(text.stuckBadge)).length).toBeGreaterThan(0)
    expect(within(open).getByText(/In attesa del dato/)).toBeTruthy()
    expect(screen.getByText(text.total(10))).toBeTruthy()
    expect(screen.getByText(new RegExp(text.age.fresh))).toBeTruthy()
    expect(api.dashboardView).toHaveBeenCalledWith('p-1', wholeDays(presetRange('w8', NOW)), null)
    openTab(text.tabs.trend)
    expect(screen.getByText(text.days(12))).toBeTruthy()
    // A median with decimals is written the Italian way: a comma, not a point.
    expect(text.days(14.7)).toBe('14,7 gg')
    expect(text.flowBefore(9.5)).toBe('periodo prima: 9,5 gg')
    expect(text.days(null)).toBe('—')
    expect(screen.getAllByText(text.days(null)).length).toBeGreaterThan(0)
    expect(screen.getByRole('img', { name: text.trendTitle })).toBeTruthy()
    // The stretch before, beside the median of the period.
    expect(screen.getByText(new RegExp(text.flowBefore(9)))).toBeTruthy()
    openTab(text.tabs.sprint)
    expect(screen.getByText(/il formato è TBD/)).toBeTruthy()
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
        .mockResolvedValue(
          ok({ tracker: 'ado', at: '2026-06-30T09:30:00.000Z', items: 4601, withHistory: 677 }),
        ),
    })
    render(<DashboardView api={api} project={project} now={now} />)
    const read = await screen.findByRole('button', { name: READ_ADO })
    fireEvent.click(read)
    expect((await screen.findByRole('alert')).textContent).toMatch(/Serve la credenziale/)
    expect(api.dashboardView).not.toHaveBeenCalled()

    fireEvent.click(read)
    expect(await screen.findByText(/Lette 4601 voci, 677 con la cronologia/)).toBeTruthy()
    // The settings now point at the file Octo wrote: the dashboard is computed from it.
    expect(await screen.findByRole('region', { name: text.qualityTitle })).toBeTruthy()
    expect(api.readTrackerSnapshot).toHaveBeenLastCalledWith('p-1')
  })

  it('reads Jira for a project without Azure DevOps, and names it in what it offers', async () => {
    const onJira: View = { ...view, tracker: 'jira', linked: true }
    const api = fakeApi({
      feed: vi.fn(async (_id: string, feed: FeedName) => ok(feedView(feed, feed === 'jira'))),
      dashboardSettings: vi
        .fn<Api['dashboardSettings']>()
        .mockResolvedValueOnce(ok({ ...configured, exportPath: '' }))
        .mockResolvedValue(ok(configured)),
      dashboardView: vi.fn(async () => ok(onJira)),
      readTrackerSnapshot: vi.fn(async () =>
        ok({ tracker: 'jira' as const, at: '2026-06-30T09:30:00.000Z', items: 5, withHistory: 5 }),
      ),
    })
    render(<DashboardView api={api} project={project} now={now} />)
    const jira = text.trackerNames.jira
    const read = await screen.findByRole('button', { name: text.readTracker(jira) })
    expect(screen.getByRole('region', { name: text.trackerTitle(jira) })).toBeTruthy()
    expect(screen.getByText(text.trackerIntro.jira)).toBeTruthy()
    expect(screen.queryByRole('button', { name: READ_ADO })).toBeNull()
    fireEvent.click(read)
    expect(await screen.findByText(/Lette 5 voci/)).toBeTruthy()
    const open = await screen.findByRole('region', { name: text.qualityTitle })
    expect(
      within(open).getAllByRole('button', { name: text.openInTracker(jira) }).length,
    ).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: OPEN_ADO })).toBeNull()
  })

  it('says that no tracker is linked, with or without the way to the sources', async () => {
    const api = fakeApi({
      dashboardSettings: async () => ok({ ...configured, exportPath: '' }),
      readTrackerSnapshot: async () => ({ ok: false, code: 'source_not_configured' }),
    })
    const onOpenSources = vi.fn()
    const view = render(
      <DashboardView api={api} project={project} now={now} onOpenSources={onOpenSources} />,
    )
    expect(await screen.findByText(text.saveNeeds)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: READ_ADO }))
    expect((await screen.findByRole('alert')).textContent).toContain(text.trackerUnlinked)
    fireEvent.click(screen.getByRole('button', { name: messages.openSources }))
    expect(onOpenSources).toHaveBeenCalledTimes(1)
    view.unmount()

    render(<DashboardView api={api} project={project} now={now} />)
    fireEvent.click(await screen.findByRole('button', { name: READ_ADO }))
    expect((await screen.findByRole('alert')).textContent).toContain(text.trackerUnlinked)
    expect(screen.queryByRole('button', { name: messages.openSources })).toBeNull()
  })

  it('keeps the reading beside the age of the data, and the numbers of the trend folded', async () => {
    const api = fakeApi()
    render(<DashboardView api={api} project={project} now={now} />)
    await screen.findByRole('region', { name: text.qualityTitle })
    // Newer data are one click away, without opening the settings.
    const read = screen.getByRole('button', { name: READ_ADO })
    expect(read.closest('details')).toBeNull()
    fireEvent.click(read)
    await waitFor(() => expect(api.readTrackerSnapshot).toHaveBeenCalledWith('p-1'))
    openTab(text.tabs.trend)
    expect(screen.getByText(text.trendNumbers).closest('details')?.open).toBe(false)
  })

  it('offers the reading first and the file second, folded when no export is found', async () => {
    const api = fakeApi({
      dashboardSettings: vi.fn(async () => ok(DEFAULT_DASHBOARD_SETTINGS)),
      dashboardCandidates: vi.fn(async () => ok({ exports: [], histories: [] })),
    })
    render(<DashboardView api={api} project={project} now={now} />)
    const read = await screen.findByRole('button', { name: READ_ADO })
    expect(read.className).toBe('primary')
    expect(screen.getByText(text.haveExport).closest('details')?.open).toBe(false)
  })

  it('reads a longer period by month, or the one the PM chooses', async () => {
    const api = fakeApi()
    render(<DashboardView api={api} project={project} now={now} />)
    await screen.findByRole('region', { name: text.qualityTitle })
    fireEvent.click(screen.getByRole('button', { name: text.presets.y1 }))
    await waitFor(() =>
      expect(api.dashboardView).toHaveBeenLastCalledWith(
        'p-1',
        { from: '2025-07-01', to: '2026-06-30T23:59:59.999Z', granularity: 'month' },
        null,
      ),
    )
    fireEvent.click(screen.getByRole('button', { name: text.presets.custom }))
    fireEvent.change(screen.getByLabelText(text.from), { target: { value: '2024-01-01' } })
    fireEvent.change(screen.getByLabelText(text.granularity), { target: { value: 'week' } })
    await waitFor(() =>
      expect(api.dashboardView).toHaveBeenLastCalledWith(
        'p-1',
        { from: '2024-01-01', to: '2026-06-30T23:59:59.999Z', granularity: 'week' },
        null,
      ),
    )
  })

  it('keeps what the PM decides as data with its date', async () => {
    const api = fakeApi()
    render(<DashboardView api={api} project={project} now={now} />)
    await screen.findByRole('region', { name: text.qualityTitle })
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
    openTab(text.tabs.sprint)
    fireEvent.click(screen.getByRole('button', { name: text.removeSignal(text.signals.S5 ?? '') }))
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
    // Only the items of the supplier's own people: a tick, off until the PM asks.
    const own = screen.getByLabelText<HTMLInputElement>(messages.ownPeopleOnly.label)
    expect(own.checked).toBe(false)
    fireEvent.click(own)
    fireEvent.click(screen.getByRole('button', { name: text.save }))
    await waitFor(() => expect(api.saveDashboardSettings).toHaveBeenCalled())
    expect(await screen.findByText(messages.saved)).toBeTruthy()
    expect(vi.mocked(api.saveDashboardSettings).mock.calls[0]?.[1]).toMatchObject({
      ownPeopleOnly: true,
      exportPath: 'data/latest.json',
      tags: ['Team', 'Altro'],
    })
    await screen.findByRole('region', { name: text.qualityTitle })
  })

  it('lets the PM correct phases, periods and the handover state', async () => {
    const api = fakeApi()
    render(<DashboardView api={api} project={project} now={now} />)
    await screen.findByRole('region', { name: text.qualityTitle })
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
    openTab(text.tabs.sprint)
    expect(screen.getByText(text.noRequirements)).toBeTruthy()
    openTab(text.tabs.trend)
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

describe('the bugs as counts that open their lists', () => {
  it('lists what each count counts, and shows the bug in view beside the list', async () => {
    const asked: string[] = []
    const focus = vi.fn()
    render(
      <DashboardView
        api={fakeApi()}
        project={project}
        now={now}
        onAsk={(question) => asked.push(question)}
        onFocus={focus}
      />,
    )
    const quality = await screen.findByRole('region', { name: text.qualityTitle })
    const filters = within(quality).getByRole('group', { name: text.filterLabel })
    const count = (name: string) =>
      within(filters).getByRole('button', { name: new RegExp(name) }).textContent
    // The open ones, the stuck ones among them, and apart the validated ones.
    expect(count(text.open)).toContain('1')
    expect(count(text.stuck(configured.stuckDays))).toContain(text.ofWhich)
    expect(count(text.validated)).toContain('2')
    expect(within(quality).getByText(text.relation(1, 1, 2, configured.stuckDays))).toBeTruthy()

    fireEvent.click(within(filters).getByRole('button', { name: new RegExp(text.validated) }))
    const list = within(quality).getByRole('list', { name: new RegExp(text.bugList) })
    expect(within(list).getAllByRole('button')).toHaveLength(2)
    const detail = within(quality).getByRole('region', { name: text.bugDetail })
    expect(detail.textContent).toContain('Data nel PDF')
    expect(detail.textContent).toContain(text.noComment)

    fireEvent.click(within(list).getByText('Etichetta del riepilogo'))
    expect(focus).toHaveBeenLastCalledWith(
      expect.objectContaining({ tab: 'bugs', filter: 'validated', bugId: '202' }),
    )
    expect(detail.textContent).toContain('Etichetta del riepilogo')
    fireEvent.click(within(detail).getByRole('button', { name: text.askAbout }))
    expect(asked).toEqual([text.askSeed('202', 'Etichetta del riepilogo', '10 - Validated', 3)])

    // The bug in view is not among the stuck ones: the first of them takes its place.
    fireEvent.click(
      within(filters).getByRole('button', { name: new RegExp(text.stuck(configured.stuckDays)) }),
    )
    expect(detail.textContent).toContain('Totale sbagliato')
    expect(detail.textContent).toContain('In attesa del dato')
  })

  it('shows the period asked last, whatever comes back first', async () => {
    const answers: Array<(result: Result<View>) => void> = []
    const api = fakeApi({
      dashboardView: vi.fn(() => new Promise<Result<View>>((resolve) => answers.push(resolve))),
    })
    render(<DashboardView api={api} project={project} now={now} />)
    fireEvent.click(await screen.findByRole('button', { name: text.presets.m3 }))
    await waitFor(() => expect(answers).toHaveLength(2))
    const later: View = { ...view, bugs: { ...view.bugs, total: 77 } }
    await act(async () => answers[1]?.(ok(later)))
    await act(async () => answers[0]?.(ok(view)))
    expect(screen.getByText(text.total(77))).toBeTruthy()
    expect(screen.queryByText(text.total(10))).toBeNull()
  })
})

const withBugs: View = {
  ...view,
  bugs: {
    ...view.bugs,
    open: [
      { ...(view.bugs.open[0] as View['bugs']['open'][number]), severity: '1 - Critical' },
      {
        ...(view.bugs.open[0] as View['bugs']['open'][number]),
        id: '102',
        title: 'Etichetta tagliata',
        severity: '3 - Medium',
        environment: 'Test',
        assignee: 'Luca',
        daysInState: 4,
        stuck: false,
      },
    ],
  },
}

describe('the list of bugs, split and filtered', () => {
  it('filters by a row of a split, by words, and takes the filters off', async () => {
    const api = fakeApi({ dashboardView: vi.fn(async () => ok(withBugs)) })
    render(<DashboardView api={api} project={project} now={now} />)
    const quality = await screen.findByRole('region', { name: text.qualityTitle })
    const list = () => within(quality).getByRole('list', { name: new RegExp(text.bugList) })
    expect(within(list()).getAllByRole('button')).toHaveLength(2)
    // The count says how it moved since the start of the period: 2 open now, 3 then.
    expect(within(quality).getAllByText(text.sinceStart(-1)).length).toBeGreaterThan(0)
    expect(within(quality).getAllByText(text.sinceStart(0)).length).toBeGreaterThan(0)
    expect(within(quality).getAllByText(text.sinceStart(1)).length).toBeGreaterThan(0)

    const splits = within(quality).getByRole('group', { name: text.breakdownsLabel })
    // Every bug states its severity, some their environment and person: three splits.
    expect(within(splits).getAllByRole('heading')).toHaveLength(3)
    const luca = within(splits).getByRole('button', {
      name: text.filterBy(text.facetNames.assignee, 'Luca'),
    })
    fireEvent.click(luca)
    expect(within(list()).getAllByRole('button')).toHaveLength(1)
    expect(within(quality).getByText(new RegExp(text.shown(1, 2)))).toBeTruthy()
    // The same row takes its filter off.
    fireEvent.click(luca)
    expect(within(list()).getAllByRole('button')).toHaveLength(2)

    fireEvent.click(
      within(splits).getByRole('button', {
        name: text.filterBy(text.facetNames.environment, text.notStated),
      }),
    )
    expect(within(list()).getByText('Totale sbagliato')).toBeTruthy()
    fireEvent.click(
      within(quality).getByRole('button', {
        name: text.removeFilter(`${text.facetNames.environment}: ${text.notStated}`),
      }),
    )
    fireEvent.change(within(quality).getByLabelText(text.search), { target: { value: 'etich' } })
    expect(within(list()).getAllByRole('button')).toHaveLength(1)
    fireEvent.change(within(quality).getByLabelText(text.search), { target: { value: 'zzz' } })
    expect(within(quality).getByText(text.noneInFilter)).toBeTruthy()
    fireEvent.click(within(quality).getByRole('button', { name: text.clearFilters }))
    fireEvent.change(within(quality).getByLabelText(text.order), { target: { value: 'severity' } })
    expect(within(list()).getAllByRole('button')[0]?.textContent).toContain('Totale sbagliato')
  })

  it('opens a bug where the tracker keeps it, when it has an address', async () => {
    const api = fakeApi()
    const shown = render(<DashboardView api={api} project={project} now={now} />)
    const detail = await screen.findByRole('region', { name: text.bugDetail })
    fireEvent.click(within(detail).getByRole('button', { name: OPEN_ADO }))
    expect(api.openTrackerItem).toHaveBeenCalledWith('p-1', '101')
    shown.unmount()

    const failing = fakeApi({
      openTrackerItem: vi.fn(async () => ({ ok: false as const, code: 'unexpected' as const })),
    })
    render(<DashboardView api={failing} project={project} now={now} />)
    const again = await screen.findByRole('region', { name: text.bugDetail })
    fireEvent.click(within(again).getByRole('button', { name: OPEN_ADO }))
    expect(await screen.findByRole('alert')).toBeTruthy()
    cleanup()

    const unlinked = fakeApi({
      dashboardView: vi.fn(async () =>
        ok({ ...view, linked: false, bugs: { ...view.bugs, before: null } }),
      ),
    })
    render(<DashboardView api={unlinked} project={project} now={now} />)
    await screen.findByRole('region', { name: text.bugDetail })
    // No bug of the list states severity, environment or person: nothing to split by.
    expect(screen.queryByRole('group', { name: text.breakdownsLabel })).toBeNull()
    expect(screen.queryByRole('button', { name: OPEN_ADO })).toBeNull()
    // Without a history nothing is compared with the start of the period, and the page says so.
    expect(screen.getByText(new RegExp(text.noHistoryDelta))).toBeTruthy()
  })
})

describe('the items to chase', () => {
  it('lists who waits for the client, or everybody, and drafts a reminder to copy', async () => {
    const writeText = vi.fn(async () => {})
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const api = fakeApi()
    render(<DashboardView api={api} project={project} now={now} canAsk />)
    const waiting = await screen.findByRole('list', { name: text.waitingTitle(1) })
    expect(within(waiting).getByText('Formato della data')).toBeTruthy()
    expect(within(waiting).getByText('«Quale formato serve?»')).toBeTruthy()

    fireEvent.click(within(waiting).getByRole('button', { name: text.draftReminder }))
    expect(await screen.findByText(text.reminderFor('Carla Bianchi'))).toBeTruthy()
    expect(api.draftReminder).toHaveBeenCalledWith('p-1', '301')
    fireEvent.click(screen.getByRole('button', { name: text.copy }))
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith('Buongiorno Carla,\nserve il formato.'),
    )
    expect(await screen.findByText(text.copied)).toBeTruthy()
    fireEvent.click(within(waiting).getByRole('button', { name: OPEN_ADO }))
    expect(api.openTrackerItem).toHaveBeenCalledWith('p-1', '301')

    fireEvent.click(screen.getByLabelText(text.onlyClient))
    const everybody = screen.getByRole('list', { name: text.waitingTitle(2) })
    expect(within(everybody).getByText('Arrotondamento')).toBeTruthy()
  })

  it('says why a reminder cannot be drafted', async () => {
    const api = fakeApi({
      draftReminder: vi.fn(async () => ({
        ok: false as const,
        code: 'tracker_item_not_waiting' as const,
      })),
    })
    const shown = render(<DashboardView api={api} project={project} now={now} canAsk />)
    const waiting = await screen.findByRole('list', { name: text.waitingTitle(1) })
    fireEvent.click(within(waiting).getByRole('button', { name: text.draftReminder }))
    expect((await screen.findByRole('alert')).textContent).toContain('non aspetta più')
    shown.unmount()

    // Without Claude on this computer the button is there, and says what is missing.
    render(<DashboardView api={fakeApi()} project={project} now={now} />)
    await screen.findByRole('list', { name: text.waitingTitle(1) })
    expect(
      screen.getByRole<HTMLButtonElement>('button', { name: text.draftReminder }).disabled,
    ).toBe(true)
    expect(screen.getByText(text.needsClaude)).toBeTruthy()
  })

  it('says when nobody waits, and when the team does not tell the two sides', async () => {
    const nobody = fakeApi({
      dashboardView: vi.fn(async () =>
        ok({ ...view, waiting: view.waiting.filter((row) => !row.fromClient) }),
      ),
    })
    const shown = render(<DashboardView api={nobody} project={project} now={now} />)
    expect(await screen.findByText(text.waitingNoneFromClient)).toBeTruthy()
    shown.unmount()

    const sides = fakeApi({
      dashboardView: vi.fn(async () => ok({ ...view, tellsSides: false })),
    })
    const unknown = render(<DashboardView api={sides} project={project} now={now} />)
    expect(await screen.findByText(text.sidesUnknown)).toBeTruthy()
    expect(screen.getByRole('list', { name: text.waitingTitle(2) })).toBeTruthy()
    unknown.unmount()

    const empty = fakeApi({
      dashboardView: vi.fn(async () => ok({ ...view, tellsSides: false, waiting: [] })),
    })
    render(<DashboardView api={empty} project={project} now={now} />)
    expect(await screen.findByText(text.waitingNone)).toBeTruthy()
  })
})

describe('the sprint', () => {
  async function openSprint(api = fakeApi()) {
    render(<DashboardView api={api} project={project} now={now} />)
    await screen.findByRole('region', { name: text.qualityTitle })
    openTab(text.tabs.sprint)
    return { api, stories: screen.getByRole('region', { name: text.storiesTitle }) }
  }

  it('shows the stories by stage, what is at risk while it ends, and its bugs', async () => {
    const { stories } = await openSprint()
    expect(within(stories).getByText(text.sprintEnding)).toBeTruthy()
    expect(within(stories).getByText(text.riskTitle(1))).toBeTruthy()
    const stages = within(stories).getByRole('group', { name: text.stageFilter })
    fireEvent.click(within(stages).getByRole('button', { name: new RegExp(text.stages.closed) }))
    const table = within(stories).getByRole('table', { name: text.storiesTitle })
    expect(within(table).getByText('Stampa ordine')).toBeTruthy()
    expect(within(table).queryByText('Invio conferma')).toBeNull()
    fireEvent.click(within(stages).getByRole('button', { name: new RegExp(text.stages.verify) }))
    expect(within(stories).getByText(text.noStories)).toBeTruthy()

    const bugs = screen.getByRole('region', { name: text.sprintBugsTitle })
    expect(within(bugs).getByText(text.showSprintBugs(1))).toBeTruthy()
    const compared = screen.getByRole('region', { name: text.comparisonTitle })
    expect(within(compared).getByText('Sprint 11')).toBeTruthy()
    expect(within(compared).getByText(text.comparisonUnknown)).toBeTruthy()
    expect(screen.getByText(text.requirementsScope('Sprint 13', false))).toBeTruthy()
  })

  it('shows another sprint when the PM chooses it', async () => {
    const { api, stories } = await openSprint()
    fireEvent.change(within(stories).getByLabelText(new RegExp(text.sprintLabel)), {
      target: { value: 'Sprint 11' },
    })
    await waitFor(() =>
      expect(api.dashboardView).toHaveBeenLastCalledWith(
        'p-1',
        wholeDays(presetRange('w8', NOW)),
        'Sprint 11',
      ),
    )
  })

  it('says what is missing when no sprint runs, or when its days are not known', async () => {
    const none = fakeApi({
      dashboardView: vi.fn(async () => ok({ ...view, sprint: null, currentSprint: null })),
    })
    await openSprint(none)
    expect(screen.getByText(text.noSprint)).toBeTruthy()
    cleanup()
    const never = fakeApi({
      dashboardView: vi.fn(async () =>
        ok({ ...view, sprint: null, sprints: [], comparison: [], upcomingSprint: null }),
      ),
    })
    await openSprint(never)
    expect(screen.getByText(text.noSprintAtAll)).toBeTruthy()
    expect(screen.getByText(text.requirementsScope(null, false))).toBeTruthy()
    cleanup()
    const undated = fakeApi({
      dashboardSettings: vi.fn(async () => ok({ ...configured, requirementPeriods: ['P2'] })),
      dashboardView: vi.fn(async () =>
        ok({
          ...view,
          linked: false,
          sprint: view.sprint && {
            ...view.sprint,
            from: null,
            to: null,
            ending: false,
            atRisk: [],
          },
        }),
      ),
    })
    await openSprint(undated)
    expect(screen.getByText(text.sprintNoDates)).toBeTruthy()
    expect(screen.getByText(text.requirementsScope('Sprint 13', true))).toBeTruthy()
  })
})

describe('the decisions taken', () => {
  it('are listed, taken back, and undone right after', async () => {
    const api = fakeApi({
      dashboardSettings: vi.fn(async () =>
        ok({
          ...configured,
          decisions: {
            excludedRequirements: [{ id: '501', at: '2026-06-10T08:00:00Z' }],
            removedSignals: [],
            notes: [],
          },
        }),
      ),
    })
    render(<DashboardView api={api} project={project} now={now} />)
    await screen.findByRole('region', { name: text.qualityTitle })
    openTab(text.tabs.sprint)
    const decisions = screen.getByRole('region', { name: text.decisionsLabel })
    expect(within(decisions).getByText(/Vecchio requisito/)).toBeTruthy()
    fireEvent.click(within(decisions).getByRole('button', { name: text.restore }))
    await waitFor(() => expect(api.saveDashboardSettings).toHaveBeenCalledTimes(1))
    const saved = () => vi.mocked(api.saveDashboardSettings).mock.calls.at(-1)?.[1].decisions
    expect(saved()?.excludedRequirements).toEqual([])
    // A decision says so by itself, with the way back; it is not a save of the settings.
    fireEvent.click(await screen.findByRole('button', { name: text.undo }))
    await waitFor(() => expect(api.saveDashboardSettings).toHaveBeenCalledTimes(2))
    expect(saved()?.excludedRequirements).toEqual([{ id: '501', at: '2026-06-10T08:00:00Z' }])
    await waitFor(() => expect(screen.queryByRole('button', { name: text.undo })).toBeNull())
    expect(screen.queryByText(messages.saved)).toBeNull()
  })

  it('offers no way back when the decision could not be kept, and says none was taken', async () => {
    const api = fakeApi({
      saveDashboardSettings: vi.fn(async () => ({
        ok: false as const,
        code: 'unexpected' as const,
      })),
      dashboardView: vi.fn(async () => ok({ ...view, decisions: [] })),
    })
    render(<DashboardView api={api} project={project} now={now} />)
    await screen.findByRole('region', { name: text.qualityTitle })
    openTab(text.tabs.sprint)
    expect(screen.getByText(text.decisionsNone)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: text.markClear }))
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.queryByRole('button', { name: text.undo })).toBeNull()
  })
})

describe('the comment of Claude', () => {
  it('is asked on the period, shown with what was thrown away, and marked old when the period changes', async () => {
    const api = fakeApi()
    render(<DashboardView api={api} project={project} now={now} canAsk />)
    await screen.findByRole('region', { name: text.qualityTitle })
    openTab(text.tabs.trend)
    const comment = screen.getByRole('region', { name: text.commentTitle })
    fireEvent.click(within(comment).getByRole('button', { name: text.comment }))
    expect(await within(comment).findByText(/Il bug #101 è fermo da 45 giorni/)).toBeTruthy()
    expect(api.commentDashboard).toHaveBeenCalledWith('p-1', wholeDays(presetRange('w8', NOW)))
    expect(within(comment).getByText(text.commentDropped(1))).toBeTruthy()
    expect(within(comment).queryByText(text.commentOld)).toBeNull()
    fireEvent.click(within(comment).getByRole('button', { name: OPEN_ADO }))
    expect(api.openTrackerItem).toHaveBeenCalledWith('p-1', '101')
    expect(within(comment).getByRole('button', { name: text.commentAgain })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: text.presets.m3 }))
    expect(await within(comment).findByText(text.commentOld)).toBeTruthy()
  })

  it('says when there is nothing to say, when it fails, and when Claude is not there', async () => {
    const empty = fakeApi({
      commentDashboard: vi
        .fn<Api['commentDashboard']>()
        .mockResolvedValueOnce({ ok: false, code: 'agent_failed' })
        .mockResolvedValue(
          ok({
            at: '2026-06-30T10:00:00.000Z',
            exportedAt: view.exportedAt,
            range: wholeDays(presetRange('w8', NOW)),
            sentences: [],
            dropped: 0,
          }),
        ),
    })
    const shown = render(<DashboardView api={empty} project={project} now={now} canAsk />)
    await screen.findByRole('region', { name: text.qualityTitle })
    openTab(text.tabs.trend)
    fireEvent.click(screen.getByRole('button', { name: text.comment }))
    expect(await screen.findByRole('alert')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: text.comment }))
    expect(await screen.findByText(text.commentEmpty)).toBeTruthy()
    shown.unmount()

    render(<DashboardView api={fakeApi()} project={project} now={now} />)
    await screen.findByRole('region', { name: text.qualityTitle })
    openTab(text.tabs.trend)
    expect(screen.getByRole<HTMLButtonElement>('button', { name: text.comment }).disabled).toBe(
      true,
    )
  })
})

describe('the tracker read again by itself', () => {
  it('is read on opening when its reading is old, and the page follows', async () => {
    const stale: View = { ...view, age: 'warning' }
    let release: (result: Result<TrackerSnapshotRun | null>) => void = () => {}
    const api = fakeApi({
      dashboardView: vi
        .fn<Api['dashboardView']>()
        .mockResolvedValueOnce(ok(stale))
        .mockResolvedValue(ok(view)),
      refreshTrackerSnapshot: vi.fn(
        () =>
          new Promise<Result<TrackerSnapshotRun | null>>((resolve) => {
            release = resolve
          }),
      ),
    })
    render(<DashboardView api={api} project={project} now={now} />)
    expect(await screen.findByText(text.refreshing(text.trackerNames.ado))).toBeTruthy()
    await act(async () =>
      release(ok({ tracker: 'ado', at: '2026-06-30T09:30:00.000Z', items: 12, withHistory: 3 })),
    )
    expect(await screen.findByText(/Lette 12 voci, 3 con la cronologia/)).toBeTruthy()
    expect(await screen.findByText(new RegExp(text.age.fresh))).toBeTruthy()
    expect(api.dashboardView).toHaveBeenCalledTimes(2)
  })

  it('says why it could not be read again', async () => {
    const api = fakeApi({
      refreshTrackerSnapshot: vi.fn(async () => ({
        ok: false as const,
        code: 'feed_unreachable' as const,
      })),
    })
    render(<DashboardView api={api} project={project} now={now} />)
    expect(await screen.findByRole('alert')).toBeTruthy()
    expect(screen.getByRole('region', { name: text.qualityTitle })).toBeTruthy()
  })

  it('follows a periodic reading of its own project, and no other', async () => {
    let tell: (projectId: string) => void = () => {}
    const stop = vi.fn()
    const api = fakeApi({
      onSourcesChanged: vi.fn((listener: (projectId: string) => void) => {
        tell = listener
        return stop
      }),
    })
    const shown = render(<DashboardView api={api} project={project} now={now} />)
    await screen.findByRole('region', { name: text.qualityTitle })
    await waitFor(() => expect(api.onSourcesChanged).toHaveBeenCalled())
    await act(async () => tell('another'))
    expect(api.dashboardView).toHaveBeenCalledTimes(1)
    await act(async () => tell('p-1'))
    await waitFor(() => expect(api.dashboardView).toHaveBeenCalledTimes(2))
    shown.unmount()
    expect(stop).toHaveBeenCalled()
  })
})

describe('a tracker kept as a register of activities', () => {
  const comment = (at: string, said: string) => ({ by: 'Luca Bianchi', at, text: said })
  const register: View = {
    ...view,
    tracker: 'jira',
    linked: true,
    types: [
      { type: 'Task', count: 3 },
      { type: 'Story', count: 2 },
    ],
    parts: { sprint: false, bugs: false, trend: false, activities: true },
    activities: {
      rows: [
        {
          id: 'AUR-3',
          type: 'Task',
          title: 'Analisi dei processi',
          state: 'In corso',
          phase: 'work',
          assignee: 'Luca Bianchi',
          hours: 25.5,
          comments: [
            comment('2026-06-20T08:00:00Z', 'Inviata la <b>bozza</b> al cliente'),
            comment('2026-06-10T08:00:00Z', 'Prima bozza'),
          ],
        },
        {
          id: 'AUR-1',
          type: 'Story',
          title: 'Gestione progetto',
          state: 'In corso',
          phase: 'work',
          assignee: null,
          hours: 8,
          comments: [],
        },
      ],
      people: [
        { person: 'Luca Bianchi', hours: 25.5, capHours: null },
        { person: 'Anna Rossi', hours: 8, capHours: null },
      ],
      hours: 33.5,
      otherHours: 2,
    },
  }
  const words = text.activities

  it('shows the activities with hours and diary, and none of the parts that have no data', async () => {
    const api = fakeApi({ dashboardView: vi.fn(async () => ok(register)) })
    render(<DashboardView api={api} project={project} now={now} />)
    const table = await screen.findByRole('table', { name: words.title })
    // Only the part that has something: the others are said to be hidden, and why.
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([text.tabs.activities])
    expect(
      screen.getByText(
        text.hiddenTabs([text.tabs.sprint, text.tabs.bugs, text.tabs.trend].join(', ')),
      ),
    ).toBeTruthy()
    const [, first, second, total] = within(table).getAllByRole('row')
    expect(first?.textContent).toContain('AUR-3')
    expect(first?.textContent).toContain('25,5')
    expect(first?.textContent).toContain('«Inviata la bozza al cliente»')
    expect(second?.textContent).toContain(text.unassigned)
    expect(second?.textContent).toContain(words.noComment)
    expect(total?.textContent).toBe(`${words.total}33,5`)
    expect(screen.getByText(words.otherHours('2'))).toBeTruthy()
    const people = screen.getByRole('table', { name: words.people })
    expect(
      within(people)
        .getAllByRole('row')
        .map((row) => row.textContent),
    ).toEqual([`${words.columnPerson}${words.columnHours}`, 'Luca Bianchi25,5', 'Anna Rossi8'])

    // The comments of an activity are its diary: opened and closed from its row.
    fireEvent.click(screen.getByRole('button', { name: words.open('AUR-3') }))
    const diary = screen.getByRole('list', { name: words.diary('AUR-3', 2) })
    expect(
      within(diary)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual([
      expect.stringContaining('Inviata la  bozza  al cliente'),
      expect.stringContaining('Prima bozza'),
    ])
    fireEvent.click(screen.getByRole('button', { name: words.close('AUR-3') }))
    expect(screen.queryByRole('list', { name: words.diary('AUR-3', 2) })).toBeNull()

    // An item opens where Jira keeps it.
    fireEvent.click(within(table).getByRole('button', { name: 'AUR-1' }))
    expect(api.openTrackerItem).toHaveBeenCalledWith('p-1', 'AUR-1')
  })

  it('puts the hours of each person beside the most they are to spend, when the team says it', async () => {
    const capped: View = {
      ...register,
      activities: {
        ...register.activities,
        people: [
          { person: 'Luca Bianchi', hours: 25.5, capHours: 64 },
          { person: 'Anna Rossi', hours: 20, capHours: 16 },
          { person: 'Ugo Neri', hours: 1, capHours: null },
        ],
      },
    }
    render(
      <DashboardView
        api={fakeApi({ dashboardView: vi.fn(async () => ok(capped)) })}
        project={project}
        now={now}
      />,
    )
    const people = await screen.findByRole('table', { name: words.people })
    expect(
      within(people)
        .getAllByRole('row')
        .map((row) => row.textContent),
    ).toEqual([
      `${words.columnPerson}${words.columnHours}${words.columnCap}`,
      `Luca Bianchi25,5${words.cap('64', '8', '40%')}`,
      `Anna Rossi20${words.cap('16', '2', '125%')} ${words.overCap}`,
      `Ugo Neri1${words.noCap}`,
    ])
  })

  it('says when no hours were read, and offers the types the tracker has to choose from', async () => {
    const noHours: View = {
      ...register,
      linked: false,
      activities: { ...register.activities, people: [], hours: 0, otherHours: 0 },
    }
    const api = fakeApi({ dashboardView: vi.fn(async () => ok(noHours)) })
    render(<DashboardView api={api} project={project} now={now} />)
    expect(await screen.findByText(words.noHours)).toBeTruthy()
    // Without an address on the tracker the id is a text, not a button.
    expect(screen.queryByRole('button', { name: 'AUR-1' })).toBeNull()
    expect(screen.getByText(text.typesHint('Task (3), Story (2)'))).toBeTruthy()
    // The types read are ticked, not typed: a Task can be counted as a story.
    const stories = screen.getByRole('group', { name: text.storyTypes })
    fireEvent.click(within(stories).getByLabelText('Task'))
    fireEvent.click(screen.getByRole('button', { name: text.save }))
    await waitFor(() =>
      expect(api.saveDashboardSettings).toHaveBeenCalledWith(
        'p-1',
        expect.objectContaining({ storyTypes: [...configured.storyTypes, 'Task'] }),
      ),
    )
  })

  it('calls by the name of Jira what orders the bugs, and shows no column of periods', async () => {
    const onJira: View = { ...view, tracker: 'jira' }
    const api = fakeApi({ dashboardView: vi.fn(async () => ok(onJira)) })
    render(<DashboardView api={api} project={project} now={now} />)
    await screen.findByRole('region', { name: text.qualityTitle })
    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      text.tabs.sprint,
      text.tabs.bugs,
      text.tabs.trend,
    ])
    expect(screen.getByRole('option', { name: text.severityNames.jira })).toBeTruthy()
    expect(screen.queryByRole('option', { name: text.severityNames.ado })).toBeNull()
    openTab(text.tabs.sprint)
    expect(screen.queryByRole('columnheader', { name: new RegExp(text.columnPeriod) })).toBeNull()
    cleanup()
    // On Azure DevOps both stay as they were.
    render(<DashboardView api={fakeApi()} project={project} now={now} />)
    await screen.findByRole('region', { name: text.qualityTitle })
    expect(screen.getByRole('option', { name: text.severityNames.ado })).toBeTruthy()
    openTab(text.tabs.sprint)
    expect(
      screen.getAllByRole('columnheader', { name: new RegExp(text.columnPeriod) }).length,
    ).toBeGreaterThan(0)
  })
})
