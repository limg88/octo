// @vitest-environment jsdom
import type {
  AgentProgress,
  AgentStatus,
  FeedingStatus,
  FeedingStep,
  FeedView,
  MailSourceView,
  ReadingView,
  SessionView,
  TodayView,
} from '@octo/application'
import {
  type Assignment,
  DEFAULT_ALIGNMENT_SETTINGS,
  DEFAULT_DASHBOARD_SETTINGS,
  DEFAULT_FORECAST_SETTINGS,
  DEFAULT_HOURS_SETTINGS,
  DEFAULT_MODEL_SETTINGS,
  DEFAULT_PROGRESS_SETTINGS,
  type Deliverable,
  type DeliverableKind,
  type FeedName,
  type ModelSettings,
  NO_RISKS,
  NO_TEAM,
  type Preferences,
  type Project,
  type ProjectTeam,
  type QuestionRecord,
  type RestoreOutcome,
  type SourceRun,
  type SourceState,
} from '@octo/domain'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { App } from '../src/renderer/App.tsx'
import { linkMarkers, markerOfLink } from '../src/renderer/answer-text.ts'
import { messages, progressText } from '../src/renderer/messages.ts'
import type { OctoApi, Result, SavedBackup } from '../src/shared/api.ts'

const aurora: Project = {
  id: 'p-1',
  name: 'Aurora',
  folder: '/progetti/Aurora',
  addedAt: '2026-11-01',
}
const boreale: Project = {
  id: 'p-2',
  name: 'Boreale',
  folder: '/progetti/Boreale',
  addedAt: '2026-11-02',
}

const answered: QuestionRecord = {
  id: 'q-1',
  projectId: 'p-1',
  question: 'Quando consegniamo?',
  askedAt: '2026-11-14T08:00:00.000Z',
  durationMs: 9000,
  answer: {
    text: 'Consegna il **12 dicembre** [1]. Budget 14.500 euro [2]. Rischio alto [3]. Vedi [sito](https://example.com).',
    citations: [
      {
        n: 1,
        path: 'wiki/stato.md',
        quote: 'fissata al 12 dicembre 2026',
        status: 'verified',
        modifiedAt: '2026-11-10T09:00:00.000Z',
      },
      {
        n: 2,
        path: 'wiki/costi.md',
        quote: 'budget 99.000',
        status: 'quote_not_found',
        modifiedAt: null,
      },
    ],
    missing: ['data di collaudo'],
    markersWithoutCitation: [3],
  },
  error: null,
}

const ok = <T,>(value: T): Result<T> => ({ ok: true, value })

const OWN_KIND: DeliverableKind = {
  id: 'proprio-nota-di-rilascio',
  title: 'Nota di rilascio',
  summary: 'Novità per chi usa il prodotto.',
  audience: 'client',
  fields: [{ key: 'domanda-1', label: 'Quale versione', kind: 'long', required: true }],
  instructions: 'Scrivi le novità.',
  checklist: ['Nessun nome interno'],
}

const documentsRun: SourceRun = {
  at: '2026-11-14T10:00:00.000Z',
  written: 2,
  unchanged: 5,
  error: null,
}

/** The documents as a folder nobody else opens shows them. */
const documentsView = (state: SourceState): ReadingView => ({
  state,
  readBy: null,
  readingBy: null,
})

const feedView = (feed: FeedName): FeedView => ({
  feed,
  config: null,
  suggestedFolder: `Fonti/${feed}`,
  hasSecret: false,
  state: { cursor: null, lastRun: null },
  readBy: null,
  readingBy: null,
})

const mailView: MailSourceView = {
  config: null,
  suggestedFolder: 'Posta',
  state: { cursor: null, lastRun: null },
  readBy: null,
  readingBy: null,
  readableHere: true,
}

const signedIn: SessionView = {
  identity: {
    id: 'u-1',
    username: 'pm@example.test',
    email: 'pm@example.test',
    name: 'Paola Verdi',
    tenant: 't-1',
  },
  configured: true,
}

const emptyToday: TodayView = {
  day: '2026-11-16',
  items: [],
  agenda: { today: [], next: { day: '2026-11-17', meetings: [] } },
  points: { since: '2026-11-13', queued: [], closed: [], toConfirm: [] },
  prep: [],
  closing: { unread: 0, key: '', at: null, model: null },
  week: { until: '2026-11-22', ongoing: [], coming: [] },
  now: [],
  nowSummary: [],
  marks: {},
  count: 0,
  notify: true,
  hidden: 0,
  hiddenItems: [],
  resolvedToday: [],
  sprintEnd: null,
  muteOffers: [],
  mutedKinds: [],
  freshness: [],
  evaluation: { at: null, model: null },
  evaluationDue: false,
  ownAddresses: ['pm@example.test'],
  addedAddresses: [],
}

function fakeApi(overrides: Partial<OctoApi> = {}) {
  let emit: (projectId: string, progress: AgentProgress) => void = () => {}
  const status: AgentStatus = { available: true, version: '2.1' }
  const api: OctoApi = {
    chooseProjectPath: vi.fn(async () => ok<string | null>(null)),
    alignmentChoices: vi.fn(async () => ok({ sprints: [], periods: [], tags: [] })),
    agentStatus: vi.fn(async () => ok(status)),
    preferences: vi.fn(async () => ok<Preferences>({ theme: 'system' })),
    savePreferences: vi.fn(async (preferences: Preferences) => ok(preferences)),
    listProjects: vi.fn(async () => ok([aurora])),
    addProject: vi.fn(async () => ok<Project | null>(boreale)),
    removeProject: vi.fn(async () => ok(null)),
    restoreProject: vi.fn(async () => ok(boreale)),
    relocateProject: vi.fn(async () => ok<Project | null>(null)),
    listQuestions: vi.fn(async () => ok<QuestionRecord[]>([])),
    ask: vi.fn(async () => ok(answered)),
    cancelAsk: vi.fn(async () => ok(null)),
    openEvidence: vi.fn(async () => ok(null)),
    onProgress: (listener) => {
      emit = listener
      return () => {}
    },
    mailSource: vi.fn(async () => ok(mailView)),
    meetingsSource: vi.fn(async () =>
      ok({
        config: null,
        suggestedRoot: null,
        targetFolder: '_octo/riunioni',
        state: { cursor: null, lastRun: null },
        readBy: null,
        readingBy: null,
        readableHere: true,
      }),
    ),
    saveMeetingsSource: vi.fn(async () => ({ ok: false as const, code: 'unexpected' as const })),
    syncMeetings: vi.fn(async () => ({ ok: false as const, code: 'unexpected' as const })),
    chooseMeetingsRoot: vi.fn(async () => ok(null)),
    importedMeetings: vi.fn(async () => ok([])),
    assignMeeting: vi.fn(async () => ({ ok: false as const, code: 'unexpected' as const })),
    meetingDestinations: vi.fn(async () => ok([])),
    moveMeeting: vi.fn(async () => ({ ok: false as const, code: 'unexpected' as const })),
    saveMailSource: vi.fn(async () => ok(mailView)),
    syncMail: vi.fn(async () =>
      ok({ at: '2026-11-14T10:00:00.000Z', written: 0, unchanged: 0, error: null }),
    ),
    deliverableCatalog: vi.fn(async () => ok<DeliverableKind[]>([])),
    listDeliverables: vi.fn(async () => ok<Deliverable[]>([])),
    startDeliverable: vi.fn(async () => ({ ok: false, code: 'unexpected' }) as Result<Deliverable>),
    reviseDeliverable: vi.fn(
      async () => ({ ok: false, code: 'unexpected' }) as Result<Deliverable>,
    ),
    approveDeliverable: vi.fn(
      async () => ({ ok: false, code: 'unexpected' }) as Result<Deliverable>,
    ),
    deliverableInstructions: vi.fn(async () => ok('')),
    saveDeliverableInstructions: vi.fn(async () => ok(null)),
    saveDeliverableKind: vi.fn(async () => ok(OWN_KIND)),
    removeDeliverableKind: vi.fn(async () => ok(null)),
    checkForUpdate: vi.fn(async () => ok(null)),
    installUpdate: vi.fn(async () => ok(null)),
    onUpdateProgress: () => () => {},
    updateJustDone: vi.fn(async () => ok(null)),
    openDiskAccessSettings: vi.fn(async () => ok(null)),
    kindTemplates: vi.fn(async () => ok({})),
    chooseKindTemplate: vi.fn(async () => ok(null)),
    removeKindTemplate: vi.fn(async () => ok(null)),
    hasLetterhead: vi.fn(async () => ok(false)),
    chooseLetterhead: vi.fn(async () => ok(true)),
    removeLetterhead: vi.fn(async () => ok(null)),
    hasDeckModel: vi.fn(async () => ok(false)),
    chooseDeckModel: vi.fn(async () => ok(true)),
    removeDeckModel: vi.fn(async () => ok(null)),
    modelSettings: vi.fn(async () => ok(DEFAULT_MODEL_SETTINGS)),
    saveModelSettings: vi.fn(async (_id: string, settings: ModelSettings) => ok(settings)),
    team: vi.fn(async () => ok(NO_TEAM)),
    saveTeam: vi.fn(async (_id: string, team: ProjectTeam) => ok(team)),
    createProject: vi.fn(async () => ok<Project | null>(boreale)),
    saveBackup: vi.fn(async () =>
      ok<SavedBackup | null>({ file: '/chiavetta/c.json', projects: 1 }),
    ),
    restoreBackup: vi.fn(async () =>
      ok<RestoreOutcome | null>({
        restored: ['Boreale'],
        alreadyHere: ['Aurora'],
        skipped: ['Cometa'],
      }),
    ),
    alignmentSettings: vi.fn(async () => ok(DEFAULT_ALIGNMENT_SETTINGS)),
    saveAlignmentSettings: vi.fn(async () => ok(DEFAULT_ALIGNMENT_SETTINGS)),
    alignmentView: vi.fn(async () => ({
      ok: false as const,
      code: 'alignment_sprint_not_set' as const,
    })),
    exportMissingTickets: vi.fn(async () => ({
      ok: false as const,
      code: 'alignment_sprint_not_set' as const,
    })),
    progressSettings: vi.fn(async () => ok(DEFAULT_PROGRESS_SETTINGS)),
    saveProgressSettings: vi.fn(async () => ok(DEFAULT_PROGRESS_SETTINGS)),
    progressCandidates: vi.fn(async () => ok<string[]>([])),
    progressView: vi.fn(async () => ({
      ok: false as const,
      code: 'progress_settings_invalid' as const,
    })),
    compileProgress: vi.fn(async () => ({
      ok: false as const,
      code: 'progress_model_not_set' as const,
    })),
    registerProgressInvoices: vi.fn(async () => ({
      ok: false as const,
      code: 'progress_settings_invalid' as const,
    })),
    forecastSettings: vi.fn(async () => ok(DEFAULT_FORECAST_SETTINGS)),
    saveForecastSettings: vi.fn(async () => ok(DEFAULT_FORECAST_SETTINGS)),
    forecastCandidates: vi.fn(async () => ok<string[]>([])),
    forecastView: vi.fn(async () => ({
      ok: false as const,
      code: 'forecast_timesheet_not_set' as const,
    })),
    compileForecast: vi.fn(async () => ({
      ok: false as const,
      code: 'forecast_model_not_set' as const,
    })),
    forecastLifetime: vi.fn(async () => ok([])),
    projectShape: vi.fn(async () => ok({ twoTrackers: true, fixedPriceOnly: false })),
    readForecastOrders: vi.fn(async () => ({
      ok: false as const,
      code: 'source_not_configured' as const,
    })),
    hoursSettings: vi.fn(async () => ok(DEFAULT_HOURS_SETTINGS)),
    saveHoursSettings: vi.fn(async () => ok(DEFAULT_HOURS_SETTINGS)),
    hoursCandidates: vi.fn(async () => ok({ timesheets: [], worklogs: [] })),
    hoursView: vi.fn(async () => ({ ok: false as const, code: 'hours_sources_not_set' as const })),
    readTimesheets: vi.fn(async () => ({
      ok: false as const,
      code: 'source_not_configured' as const,
    })),
    readTrackerHours: vi.fn(async () => ({
      ok: false as const,
      code: 'source_not_configured' as const,
    })),
    dashboardSettings: vi.fn(async () => ok(DEFAULT_DASHBOARD_SETTINGS)),
    saveDashboardSettings: vi.fn(async () => ok(DEFAULT_DASHBOARD_SETTINGS)),
    dashboardCandidates: vi.fn(async () => ok({ exports: [], histories: [] })),
    readTrackerSnapshot: vi.fn(async () =>
      ok({ tracker: 'ado' as const, at: '', items: 0, withHistory: 0 }),
    ),
    refreshTrackerSnapshot: vi.fn(async () => ok(null)),
    openTrackerItem: vi.fn(async () => ok(false)),
    commentDashboard: vi.fn(async () => ({
      ok: false as const,
      code: 'agent_not_installed' as const,
    })),
    draftReminder: vi.fn(async () => ({
      ok: false as const,
      code: 'agent_not_installed' as const,
    })),
    dashboardView: vi.fn(async () => ({
      ok: false as const,
      code: 'tracker_export_not_set' as const,
    })),
    onDeliverableProgress: () => () => {},
    session: vi.fn(async () => ok(signedIn)),
    signIn: vi.fn(async () => ok(signedIn)),
    cancelSignIn: vi.fn(async () => ok(null)),
    configureSignIn: vi.fn(async () => ok(signedIn)),
    signOut: vi.fn(async () => ok({ identity: null, configured: true })),
    todayView: vi.fn(async () => ok(emptyToday)),
    markTodaySeen: vi.fn(async () => ok(null)),
    setTodayNotify: vi.fn(async () => ok(emptyToday)),
    onTodayEntered: () => () => {},
    nextReading: vi.fn(async () => ok<string | null>(null)),
    focusWindow: vi.fn(async () => ok(null)),
    decideToday: vi.fn(async () => ok(emptyToday)),
    muteTodayKind: vi.fn(async () => ok(emptyToday)),
    setMailTurn: vi.fn(async () => ok(emptyToday)),
    saveOwnAddresses: vi.fn(async () => ok(emptyToday)),
    evaluateToday: vi.fn(async () => ok(emptyToday)),
    closeToday: vi.fn(async () => ok(emptyToday)),
    cancelEvaluateToday: vi.fn(async () => ok(null)),
    onTodayProgress: () => () => {},
    todayOverview: vi.fn(async () => ok([])),
    addOpenPoint: vi.fn(async () => ({ ok: false as const, code: 'unexpected' as const })),
    updateOpenPoint: vi.fn(async () => ({ ok: false as const, code: 'unexpected' as const })),
    confirmOpenPoint: vi.fn(async () => ({ ok: false as const, code: 'unexpected' as const })),
    risks: vi.fn(async () => ok(NO_RISKS)),
    proposeRisks: vi.fn(async () => ok(NO_RISKS)),
    acceptRisk: vi.fn(async () => ok(NO_RISKS)),
    dismissRisk: vi.fn(async () => ok(NO_RISKS)),
    addRisk: vi.fn(async () => ok(NO_RISKS)),
    updateRisk: vi.fn(async () => ok(NO_RISKS)),
    assignment: vi.fn(async () => ok<Assignment>('unknown')),
    previewMail: vi.fn(async () => ok({ count: 0, subjects: [] })),
    feedingStatus: vi.fn(async () =>
      ok<FeedingStatus>({ mail: false, meetings: false, feeds: [] }),
    ),
    fill: vi.fn(async () => ok<FeedingStep[]>([])),
    onFeedingStep: () => () => {},
    feedChoices: vi.fn(async () => ok({ projects: [], areas: [] })),
    feed: vi.fn(async (_projectId: string, feed: FeedName) => ok(feedView(feed))),
    saveFeed: vi.fn(async (_projectId: string, feed: FeedName) => ok(feedView(feed))),
    syncFeed: vi.fn(async () => ok(documentsRun)),
    documentsState: vi.fn(async () => ok(documentsView({ cursor: null, lastRun: null }))),
    convertDocuments: vi.fn(async () => ok(documentsRun)),
    onSourcesChanged: () => () => {},
    ...overrides,
  }
  return { api, emit: (projectId: string, step: AgentProgress) => emit(projectId, step) }
}

/** Octo opens on the page of the day: the questions are a section away. */
async function openAsk() {
  fireEvent.click(await screen.findByRole('tab', { name: messages.ask }))
}

async function askQuestion(text: string) {
  await openAsk()
  fireEvent.change(await screen.findByPlaceholderText(messages.askPlaceholder), {
    target: { value: text },
  })
  fireEvent.click(screen.getByRole('button', { name: messages.askSubmit }))
}

afterEach(cleanup)

describe('App', () => {
  it('says beside «Oggi» how many things wait, and counts again after a reading elsewhere', async () => {
    let changed: (projectId: string) => void = () => {}
    let count = 3
    const { api } = fakeApi({
      todayView: vi.fn(async () => ok({ ...emptyToday, count })),
      onSourcesChanged: (listener) => {
        changed = listener
        return () => {}
      },
    })
    render(<App api={api} />)
    // The page of the day is open: it says itself how much it asks.
    const today = await screen.findByRole('tab', { name: /^Oggi/ })
    await waitFor(() => expect(today.textContent).toBe('Oggi3'))
    // In another section the count is asked after every reading of this project.
    await openAsk()
    count = 0
    await act(async () => changed('altro'))
    expect(today.textContent).toBe('Oggi3')
    await act(async () => changed('p-1'))
    // Nothing is said of zero.
    await waitFor(() => expect(today.textContent).toBe('Oggi'))
  })

  it('tells with a notice of the system a signal that comes first, unless the PM is looking', async () => {
    let entered: Parameters<Parameters<OctoApi['onTodayEntered']>[0]>[0] | null = null
    let tell: Parameters<OctoApi['onTodayEntered']>[0] = () => {}
    const notices: Array<{ title: string; body: string; click: () => void }> = []
    const { api } = fakeApi({
      listProjects: async () => ok([aurora, boreale]),
      onTodayEntered: (listener) => {
        tell = listener
        return () => {}
      },
    })
    render(<App api={api} notify={(title, body, click) => notices.push({ title, body, click })} />)
    await screen.findByRole('tab', { name: /^Oggi/ })
    const item = {
      key: 'bugs-stuck',
      band: 'due' as const,
      facts: { kind: 'bugs_stuck' as const, count: 6, stuckDays: 30, oldestDays: 90 },
      weight: 6,
      target: 'dashboard' as const,
      asOf: null,
    }
    entered = { projectId: boreale.id, projectName: boreale.name, item }
    const focus = vi.spyOn(document, 'hasFocus').mockReturnValue(true)
    // Another project than the one in view: the PM is told.
    await act(async () => tell(entered as NonNullable<typeof entered>))
    expect(notices.map(({ title, body }) => [title, body])).toEqual([
      ['6 bug fermi da più di 30 giorni', messages.today.notifyBody(boreale.name)],
    ])
    // The page of that very project is in front: nothing is told.
    await act(async () =>
      tell({ ...entered, projectId: aurora.id, projectName: aurora.name } as never),
    )
    expect(notices).toHaveLength(1)
    // A meeting about to start is told with how long is left and how much there is to bring.
    for (const toBring of [0, 1, 3]) {
      await act(async () => tell({ ...entered, meeting: { minutes: 15, toBring } } as never))
    }
    expect(notices.slice(1).map(({ body }) => body)).toEqual([
      `${boreale.name} · fra 15 minuti`,
      `${boreale.name} · fra 15 minuti · 1 cosa da portare`,
      `${boreale.name} · fra 15 minuti · 3 cose da portare`,
    ])
    // A click on the notice brings Octo in front, on the page of the day of that project.
    await openAsk()
    await act(async () => notices[0]?.click())
    expect(api.focusWindow).toHaveBeenCalled()
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: /^Oggi/ }).getAttribute('aria-selected')).toBe('true'),
    )
    expect(screen.getByRole('heading', { name: boreale.name })).toBeTruthy()
    focus.mockRestore()
  })

  it('shows the answer with each source checked and what is left to check', async () => {
    const { api } = fakeApi()
    render(<App api={api} />)

    await askQuestion('Quando consegniamo?')

    expect(await screen.findByText(messages.toCheck(2))).toBeTruthy()
    expect(api.ask).toHaveBeenCalledWith('p-1', 'Quando consegniamo?', null)
    // The first source is in view beside the answer, with what the check found about it.
    const panel = screen.getByRole('complementary', { name: messages.citation.panel })
    expect(within(panel).getByText('Frase riscontrata nel file')).toBeTruthy()
    expect(within(panel).getByText(messages.citation.foundNote)).toBeTruthy()
    // A marker shows its source there, and the answer stays where it is.
    fireEvent.click(screen.getByRole('button', { name: messages.citation.marker(2) }))
    expect(within(panel).getByText('La frase non è nel file')).toBeTruthy()
    expect(within(panel).getByText(messages.citation.notFoundNote)).toBeTruthy()
    expect(screen.getByText(messages.toCheck(2))).toBeTruthy()
    expect(screen.getByText(messages.citation.orphan(3))).toBeTruthy()
    expect(screen.getByText('data di collaudo')).toBeTruthy()
    expect(screen.queryByRole('link', { name: 'sito' })).toBeNull()

    // Every source stays one click away, by a name a person reads; the original opens from there.
    fireEvent.click(screen.getByRole('button', { name: 'wiki · stato' }))
    expect(within(panel).getByText('wiki/stato.md')).toBeTruthy()
    fireEvent.click(within(panel).getByRole('button', { name: messages.citation.open }))
    await waitFor(() => expect(api.openEvidence).toHaveBeenCalledWith('p-1', 'wiki/stato.md'))
  })

  it('tells what the agent is doing and lets the PM stop it', async () => {
    let finish: (result: Result<QuestionRecord>) => void = () => {}
    const { api, emit } = fakeApi({
      ask: () => new Promise<Result<QuestionRecord>>((resolve) => (finish = resolve)),
    })
    render(<App api={api} />)

    await askQuestion('Quando consegniamo?')
    expect(await screen.findByText(messages.working)).toBeTruthy()

    act(() => emit('p-2', { kind: 'reading', target: 'altro.md' }))
    act(() => emit('p-1', { kind: 'reading', target: 'wiki/stato.md' }))
    expect(screen.getByRole('status').textContent).toBe('Leggo wiki/stato.md')

    fireEvent.click(screen.getByRole('button', { name: messages.askCancel }))
    expect(api.cancelAsk).toHaveBeenCalledWith('p-1')

    await act(async () => finish({ ok: false, code: 'agent_cancelled' }))
    expect(await screen.findByText('Domanda fermata.')).toBeTruthy()
  })

  it('keeps the history and explains a question that failed', async () => {
    const failed: QuestionRecord = {
      ...answered,
      id: 'q-0',
      answer: null,
      error: 'agent_not_signed_in',
    }
    const verified: QuestionRecord = {
      ...answered,
      answer: {
        text: 'Consegna il 12 dicembre [1].',
        citations: [
          {
            n: 1,
            path: 'wiki/stato.md',
            quote: 'fissata al 12 dicembre 2026',
            status: 'verified',
            modifiedAt: null,
          },
        ],
        missing: [],
        markersWithoutCitation: [],
      },
    }
    const { api } = fakeApi({ listQuestions: async () => ok([failed, verified]) })
    render(<App api={api} />)
    await openAsk()
    // What was asked before there were conversations is kept together, one click away.
    fireEvent.click(
      await screen.findByRole('button', { name: new RegExp(messages.askChats.legacy) }),
    )

    expect(await screen.findByText(messages.allVerified(1))).toBeTruthy()
    expect(screen.getByText(/Claude non ha un accesso attivo/)).toBeTruthy()
  })

  const openMenu = async () =>
    fireEvent.click(await screen.findByRole('button', { name: /Aurora|Boreale|Nessun progetto/ }))
  const openAdd = async () => {
    await openMenu()
    fireEvent.click(screen.getByRole('menuitem', { name: messages.addProject }))
    return screen.getByRole('dialog', { name: messages.addDialog.title })
  }
  const openManage = async () => {
    await openMenu()
    fireEvent.click(screen.getByRole('menuitem', { name: messages.manage.open }))
    return screen.getByRole('dialog', { name: messages.manage.title })
  }

  it('switches project from the list in the sidebar, by click or by number', async () => {
    const { api } = fakeApi({ listProjects: async () => ok([aurora, boreale]) })
    render(<App api={api} />)
    await openMenu()
    const menu = screen.getByRole('menu', { name: messages.projects })
    expect(
      within(menu).getByRole('menuitemradio', { name: 'Aurora' }).getAttribute('aria-checked'),
    ).toBe('true')

    fireEvent.click(within(menu).getByRole('menuitemradio', { name: 'Boreale' }))
    expect(await screen.findByRole('heading', { name: 'Boreale' })).toBeTruthy()
    expect(screen.queryByRole('menu')).toBeNull()

    fireEvent.keyDown(window, { key: '1', metaKey: true })
    expect(await screen.findByRole('heading', { name: 'Aurora' })).toBeTruthy()
    fireEvent.keyDown(window, { key: '2', ctrlKey: true })
    expect(await screen.findByRole('heading', { name: 'Boreale' })).toBeTruthy()
    // A number with no project, or without the modifier, changes nothing.
    fireEvent.keyDown(window, { key: '7', metaKey: true })
    fireEvent.keyDown(window, { key: '1' })
    expect(screen.getByRole('heading', { name: 'Boreale' })).toBeTruthy()

    await openMenu()
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' })
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('adds a project from a folder and opens its sources', async () => {
    const { api } = fakeApi()
    render(<App api={api} />)
    const dialog = await openAdd()
    fireEvent.click(within(dialog).getByRole('button', { name: messages.addDialog.existingChoose }))
    expect(await screen.findByRole('heading', { name: 'Boreale' })).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(await screen.findByRole('region', { name: messages.guideTitle })).toBeTruthy()
  })

  it('points a project at the folder it was moved to, keeping it the same project', async () => {
    const moved = { ...boreale, folder: '/OneDrive/Boreale' }
    const { api } = fakeApi({
      listProjects: async () => ok([aurora, boreale]),
      relocateProject: vi
        .fn<OctoApi['relocateProject']>()
        .mockResolvedValueOnce(ok(null))
        .mockResolvedValueOnce({ ok: false, code: 'project_already_added' })
        .mockResolvedValue(ok(moved)),
    })
    render(<App api={api} />)
    const dialog = await openManage()
    const relocate = () =>
      fireEvent.click(
        within(dialog).getByRole('button', { name: messages.manage.relocateOf('Boreale') }),
      )

    // The PM closes the dialog of the system: nothing changes.
    relocate()
    await waitFor(() => expect(api.relocateProject).toHaveBeenCalledWith(boreale.id))
    expect(within(dialog).getByText(boreale.folder)).toBeTruthy()

    relocate()
    expect(await screen.findByRole('alert')).toBeTruthy()

    relocate()
    expect(await within(dialog).findByText('/OneDrive/Boreale')).toBeTruthy()
  })

  it('takes a project off only after a confirmation, and puts it back', async () => {
    const { api } = fakeApi({
      listProjects: async () => ok([aurora, boreale]),
      removeProject: vi
        .fn<OctoApi['removeProject']>()
        .mockResolvedValueOnce({ ok: false, code: 'project_not_found' })
        .mockResolvedValue(ok(null)),
    })
    render(<App api={api} />)
    const dialog = await openManage()
    fireEvent.click(
      within(dialog).getByRole('button', { name: messages.manage.removeOf('Boreale') }),
    )
    const confirm = screen.getByRole('dialog', { name: messages.manage.confirmTitle('Boreale') })
    expect(confirm.textContent).toContain(messages.manage.confirmBody)
    expect(api.removeProject).not.toHaveBeenCalled()

    // Changing one's mind goes back to the list, with the project still there.
    fireEvent.click(within(confirm).getByRole('button', { name: messages.cancel }))
    expect(api.removeProject).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: messages.manage.removeOf('Boreale') }))
    fireEvent.click(screen.getByRole('button', { name: messages.manage.confirm }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/non è più in elenco/)
    fireEvent.click(screen.getByRole('button', { name: messages.manage.confirm }))

    const note = await screen.findByRole('status')
    expect(note.textContent).toBe(messages.manage.removed('Boreale'))
    expect(api.removeProject).toHaveBeenLastCalledWith('p-2')
    expect(screen.queryByRole('dialog')).toBeNull()
    // The project that was open stays open.
    expect(screen.getByRole('heading', { name: 'Aurora' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: messages.manage.undo }))
    expect(await screen.findByRole('heading', { name: 'Boreale' })).toBeTruthy()
    expect(api.restoreProject).toHaveBeenCalledWith('p-2')
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('opens another project when the open one is taken off, and says when undo fails', async () => {
    const { api } = fakeApi({
      restoreProject: async () => ({ ok: false, code: 'project_not_found' }),
    })
    render(<App api={api} />)
    const dialog = await openManage()
    fireEvent.click(
      within(dialog).getByRole('button', { name: messages.manage.removeOf('Aurora') }),
    )
    fireEvent.click(screen.getByRole('button', { name: messages.manage.confirm }))
    expect(await screen.findByText(messages.noProjectTitle, { selector: 'h2' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: messages.manage.undo }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/non è più in elenco/)
    // Every notice closes.
    for (const close of screen.getAllByRole('button', { name: messages.close })) {
      fireEvent.click(close)
    }
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.queryByRole('status')).toBeNull()

    const empty = await openManage()
    expect(empty.textContent).toContain(messages.manage.none)
    fireEvent.click(
      within(empty).getAllByRole('button', { name: messages.close })[0] as HTMLElement,
    )
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('makes a new project from its name and opens its sources', async () => {
    const { api } = fakeApi({
      createProject: vi
        .fn<OctoApi['createProject']>()
        .mockResolvedValueOnce({ ok: false, code: 'project_folder_exists' })
        .mockResolvedValueOnce(ok(null))
        .mockResolvedValue(ok(boreale)),
    })
    render(<App api={api} />)
    const dialog = await openAdd()
    const create = within(dialog).getByRole<HTMLButtonElement>('button', {
      name: messages.newProjectCreate,
    })
    expect(create.disabled).toBe(true)
    fireEvent.change(within(dialog).getByLabelText(messages.newProjectName), {
      target: { value: 'Boreale' },
    })
    fireEvent.click(create)
    expect((await within(dialog).findByRole('alert')).textContent).toMatch(/c’è già una cartella/)
    // The PM closes the system dialog: the name stays, to try again.
    fireEvent.click(create)
    await waitFor(() => expect(api.createProject).toHaveBeenCalledTimes(2))
    expect(screen.getByLabelText<HTMLInputElement>(messages.newProjectName).value).toBe('Boreale')
    fireEvent.click(create)
    expect(await screen.findByRole('heading', { name: 'Boreale' })).toBeTruthy()
    expect(api.createProject).toHaveBeenLastCalledWith('Boreale')
    expect(await screen.findByRole('region', { name: messages.guideTitle })).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('closes a dialog with Cancel, with Escape or outside it, and forgets its error', async () => {
    const { api } = fakeApi({
      addProject: async () => ({ ok: false, code: 'project_already_added' }),
    })
    render(<App api={api} />)
    let dialog = await openAdd()
    fireEvent.click(within(dialog).getByRole('button', { name: messages.addDialog.existingChoose }))
    expect((await within(dialog).findByRole('alert')).textContent).toMatch(/già fra i tuoi/)
    fireEvent.click(within(dialog).getByRole('button', { name: messages.cancel }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()

    dialog = await openAdd()
    fireEvent.keyDown(dialog, { key: 'Enter' })
    expect(screen.getByRole('dialog')).toBeTruthy()
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()

    dialog = await openAdd()
    fireEvent.mouseDown(dialog)
    expect(screen.getByRole('dialog')).toBeTruthy()
    fireEvent.mouseDown(dialog.parentElement as HTMLElement)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('keeps the focus inside a dialog and gives it back when the dialog closes', async () => {
    const { api } = fakeApi()
    render(<App api={api} />)
    const opener = await screen.findByRole('button', { name: 'Aurora' })
    opener.focus()
    const dialog = await openAdd()
    expect(document.activeElement).toBe(dialog)
    const stops = [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled), input')]
    const first = stops[0] as HTMLElement
    const last = stops.at(-1) as HTMLElement
    // From the dialog itself, back goes to its last stop; from the last, forward to the first.
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(last)
    fireEvent.keyDown(dialog, { key: 'Tab' })
    expect(document.activeElement).toBe(first)
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(last)
    // In the middle Tab is left to do what it does.
    ;(stops[1] as HTMLElement).focus()
    fireEvent.keyDown(dialog, { key: 'Tab' })
    expect(document.activeElement).toBe(stops[1])
    fireEvent.keyDown(dialog, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('writes a backup and says the credentials are not in it', async () => {
    const { api } = fakeApi({
      saveBackup: vi
        .fn<OctoApi['saveBackup']>()
        .mockResolvedValueOnce({ ok: false, code: 'backup_not_written' })
        .mockResolvedValueOnce(ok(null))
        .mockResolvedValue(ok({ file: '/chiavetta/c.json', projects: 2 })),
    })
    render(<App api={api} />)
    const dialog = await openManage()
    const save = within(dialog).getByRole('button', { name: messages.backup.save })
    fireEvent.click(save)
    expect((await screen.findByRole('alert')).textContent).toMatch(/Non riesco a scrivere/)
    fireEvent.click(save)
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
    expect(screen.queryByRole('status')).toBeNull()
    fireEvent.click(save)
    const note = await screen.findByRole('status')
    expect(note.textContent).toContain('/chiavetta/c.json: 2 progetti')
    expect(note.textContent).toMatch(/credenziali non ci sono/)
    // The note goes away when the PM has read it.
    fireEvent.click(screen.getByRole('button', { name: messages.close }))
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('restores a backup, lists the projects again and tells what was left out', async () => {
    const { api } = fakeApi()
    vi.mocked(api.listProjects)
      .mockResolvedValueOnce(ok([aurora]))
      .mockResolvedValue(ok([aurora, boreale]))
    render(<App api={api} />)
    const dialog = await openManage()
    fireEvent.click(within(dialog).getByRole('button', { name: messages.backup.restore }))
    const note = await screen.findByRole('status')
    expect(note.textContent).toContain('Ripristinati: Boreale.')
    expect(note.textContent).toContain('Già in elenco, lasciati come sono: Aurora.')
    expect(note.textContent).toMatch(/cartella non è su questo computer: Cometa/)
    expect(note.textContent).toContain(messages.backup.credentials)
    await openMenu()
    expect(screen.getByRole('menuitemradio', { name: 'Boreale' })).toBeTruthy()
    // The project that was open stays open.
    expect(screen.getByRole('heading', { name: 'Aurora' })).toBeTruthy()
  })

  it('says so when a backup holds no project, or is not a backup', async () => {
    const { api } = fakeApi({
      restoreBackup: vi
        .fn<OctoApi['restoreBackup']>()
        .mockResolvedValueOnce({ ok: false, code: 'backup_invalid' })
        .mockResolvedValueOnce(ok(null))
        .mockResolvedValue(ok({ restored: [], alreadyHere: [], skipped: [] })),
    })
    render(<App api={api} />)
    const dialog = await openManage()
    const restore = within(dialog).getByRole('button', { name: messages.backup.restore })
    fireEvent.click(restore)
    expect((await screen.findByRole('alert')).textContent).toMatch(/non è una copia di sicurezza/)
    fireEvent.click(restore)
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull())
    fireEvent.click(restore)
    expect((await screen.findByRole('status')).textContent).toBe(messages.backup.nothing)
  })

  it('offers ready questions that fill the composer without asking', async () => {
    const { api } = fakeApi()
    render(<App api={api} />)
    await openAsk()
    const ready = await screen.findByRole('group', { name: messages.askReadyTitle })
    fireEvent.click(within(ready).getByRole('button', { name: 'Blocchi e rischi' }))
    const composer = screen.getByLabelText<HTMLTextAreaElement>(messages.askPlaceholder)
    expect(composer.value).toMatch(/^Quali sono oggi i blocchi e i rischi aperti/)
    expect(api.ask).not.toHaveBeenCalled()
  })

  it('guides a PM with no project and no agent, and explains errors', async () => {
    const { api } = fakeApi({
      agentStatus: async () => ok<AgentStatus>({ available: false, reason: 'not_installed' }),
      listProjects: async () => ok([]),
      addProject: vi
        .fn<OctoApi['addProject']>()
        .mockResolvedValueOnce(ok(null))
        .mockResolvedValueOnce({ ok: false, code: 'project_already_added' }),
    })
    render(<App api={api} />)

    expect(await screen.findByText(messages.noProjectTitle, { selector: 'h2' })).toBeTruthy()
    expect(await screen.findByText(messages.agentMissingTitle)).toBeTruthy()

    // With no project the page itself offers the way in.
    fireEvent.click(screen.getByRole('button', { name: messages.addProject }))
    const choose = screen.getByRole('button', { name: messages.addDialog.existingChoose })
    fireEvent.click(choose)
    await waitFor(() => expect(api.addProject).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('dialog')).toBeTruthy()
    fireEvent.click(choose)
    expect(await screen.findByText('Questa cartella è già fra i tuoi progetti.')).toBeTruthy()
  })

  it('reports a project list or a history it cannot load', async () => {
    const first = fakeApi({ listProjects: async () => ({ ok: false, code: 'unexpected' }) })
    render(<App api={first.api} />)
    expect(await screen.findByText('Qualcosa non ha funzionato. Riprova.')).toBeTruthy()
    cleanup()

    const second = fakeApi({
      listQuestions: async () => ({ ok: false, code: 'project_not_found' }),
    })
    render(<App api={second.api} />)
    await openAsk()
    expect(await screen.findByText('Questo progetto non è più in elenco.')).toBeTruthy()
  })
})

describe('answer text', () => {
  it('links markers to their source and leaves real links alone', () => {
    expect(linkMarkers('a [1], b [2](x)')).toBe('a [1](#fonte-1), b [2](x)')
    expect(markerOfLink('#fonte-4')).toBe(4)
    expect(markerOfLink('https://example.com')).toBeNull()
    expect(markerOfLink(undefined)).toBeNull()
    expect(markerOfLink('#fonte-x')).toBeNull()
  })

  it('describes a step with or without a target', () => {
    expect(progressText({ kind: 'writing', target: '' })).toBe('Scrivo la risposta')
    expect(progressText({ kind: 'searching', target: 'budget' })).toBe('Cerco budget')
  })
})

describe('project tabs', () => {
  it('switches between asking and the sources of the project', async () => {
    const { api } = fakeApi()
    render(<App api={api} />)

    fireEvent.click(await screen.findByRole('tab', { name: messages.sourcesTab }))
    expect(await screen.findByText(messages.mailNotConfigured)).toBeTruthy()
    // The page loads once: with the real clock it must not reload at every render.
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(api.mailSource).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('tab', { name: messages.ask }))
    expect(await screen.findByPlaceholderText(messages.askPlaceholder)).toBeTruthy()
  })

  it('offers no alignment to a project with one tracker, and tells a fixed price by its invoices', async () => {
    const { api } = fakeApi({
      projectShape: vi.fn(async () => ok({ twoTrackers: false, fixedPriceOnly: true })),
    })
    render(<App api={api} />)
    await screen.findByRole('heading', { name: 'Aurora' })
    // Nothing to align: the section and its group are not in the sidebar.
    await waitFor(() =>
      expect(screen.queryByRole('tab', { name: messages.alignmentTab })).toBeNull(),
    )
    expect(screen.queryByRole('tablist', { name: messages.nav.sprint })).toBeNull()
    expect(screen.getByRole('tab', { name: messages.progressTab })).toBeTruthy()
    // Sold at a fixed price only: «Avanzamento» is what NetSuite says, no form of the client.
    fireEvent.click(screen.getByRole('tab', { name: messages.progressTab }))
    expect(await screen.findByText(messages.progress.fixedPrice.intro)).toBeTruthy()
  })

  it('groups the sections in the sidebar and moves among them with the arrows', async () => {
    const { api } = fakeApi()
    render(<App api={api} />)
    await screen.findByRole('heading', { name: 'Aurora' })
    const group = (title: string) =>
      within(screen.getByRole('tablist', { name: title }))
        .getAllByRole('tab')
        .map((tab) => tab.textContent)
    expect(group(messages.nav.daily)).toEqual([messages.todayTab])
    expect(group(messages.nav.work)).toEqual([
      messages.ask,
      messages.deliverablesTab,
      messages.dashboardTab,
    ])
    expect(group(messages.nav.monthly)).toEqual([
      messages.hoursTab,
      messages.forecastTab,
      messages.progressTab,
    ])
    expect(group(messages.nav.sprint)).toEqual([messages.alignmentTab])
    expect(group(messages.nav.project)).toEqual([messages.sourcesTab])
    expect(api.projectShape).toHaveBeenCalledWith('p-1')

    // The settings have tabs of their own: the section in use is the one of the sidebar.
    const selected = () =>
      within(screen.getByRole('navigation', { name: messages.projects })).getByRole('tab', {
        selected: true,
      }).textContent
    const today = screen.getByRole('tab', { name: messages.todayTab })
    // Octo opens on the page of the day.
    expect(selected()).toBe(messages.todayTab)
    // Down goes to the next section whatever its group; up from the first goes to the last.
    fireEvent.keyDown(today, { key: 'ArrowDown' })
    expect(selected()).toBe(messages.ask)
    expect(document.activeElement?.textContent).toBe(messages.ask)
    fireEvent.keyDown(today, { key: 'ArrowUp' })
    expect(selected()).toBe(messages.sourcesTab)
    fireEvent.keyDown(today, { key: 'a' })
    expect(selected()).toBe(messages.sourcesTab)
  })

  it('has no sections to show while there is no project', async () => {
    const { api } = fakeApi({ listProjects: async () => ok([]) })
    render(<App api={api} />)
    await screen.findByText(messages.noProjectTitle, { selector: 'h2' })
    expect(screen.queryByRole('tab')).toBeNull()
  })

  it('lists the sources as rows that open one at a time, apart from people and the rest', async () => {
    const { api } = fakeApi()
    render(<App api={api} />)
    fireEvent.click(await screen.findByRole('tab', { name: messages.sourcesTab }))
    await screen.findByText(messages.mailNotConfigured)
    const formOf = (label: string) => screen.getByLabelText(label).closest('form')
    const toggle = (action: string, source: string) =>
      screen.getByRole('button', { name: `${action}: ${source}` })
    // Every source is one folded row; what is typed once elsewhere is not on this page.
    expect(formOf(messages.mailExclude)?.hidden).toBe(true)
    expect(screen.queryByRole('region', { name: messages.team.title })).toBeNull()

    fireEvent.click(toggle(messages.sourceLink, messages.mailTitle))
    expect(formOf(messages.mailExclude)?.hidden).toBe(false)
    expect(screen.getByText(messages.mailIntro)).toBeTruthy()
    fireEvent.click(await screen.findByRole('button', { name: `${messages.sourceLink}: Jira` }))
    expect(formOf(messages.mailExclude)?.hidden).toBe(true)
    expect(formOf(messages.feedFields.projects)?.hidden).toBe(false)
    fireEvent.click(toggle(messages.close, 'Jira'))
    expect(formOf(messages.feedFields.projects)?.hidden).toBe(true)

    // The parts of the settings are moved through with the arrows too, round the row.
    const links = screen.getByRole('tab', { name: messages.settingsParts.links })
    fireEvent.keyDown(links, { key: 'ArrowLeft' })
    expect(await screen.findByRole('region', { name: messages.models.title })).toBeTruthy()
    expect(document.activeElement?.textContent).toBe(messages.settingsParts.advanced)
    fireEvent.keyDown(screen.getByRole('tab', { name: messages.settingsParts.advanced }), {
      key: 'ArrowRight',
    })
    fireEvent.keyDown(links, { key: 'a' })
    await screen.findByText(messages.mailNotConfigured)
    fireEvent.click(screen.getByRole('tab', { name: messages.settingsParts.team }))
    expect(await screen.findByRole('region', { name: messages.team.title })).toBeTruthy()
    expect(screen.queryByText(messages.mailNotConfigured)).toBeNull()
    fireEvent.click(screen.getByRole('tab', { name: messages.settingsParts.advanced }))
    expect(await screen.findByRole('region', { name: messages.models.title })).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: messages.settingsParts.links }))
    expect(await screen.findByText(messages.mailNotConfigured)).toBeTruthy()
  })
})

describe('documents of a project', () => {
  it('shows when they were last converted and converts them on request', async () => {
    const state = vi
      .fn<OctoApi['documentsState']>()
      .mockResolvedValueOnce(ok(documentsView({ cursor: null, lastRun: null })))
      .mockResolvedValue(ok(documentsView({ cursor: documentsRun.at, lastRun: documentsRun })))
    const { api } = fakeApi({ documentsState: state })
    render(<App api={api} />)
    fireEvent.click(await screen.findByRole('tab', { name: messages.sourcesTab }))

    expect(await screen.findByText(messages.documentsNever)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: messages.documentsConvert }))

    expect(await screen.findByText(/2 aggiornati, 5 già pronti/)).toBeTruthy()
    expect(api.convertDocuments).toHaveBeenCalledWith('p-1')
  })

  it('says who converted them from another computer, and who is converting now', async () => {
    const giovanni = { name: 'Giovanni', computer: 'mac-di-giovanni' }
    const state = { cursor: null, lastRun: { ...documentsRun, by: giovanni } }
    const { api } = fakeApi({
      documentsState: async () => ok({ state, readBy: giovanni, readingBy: giovanni }),
    })
    render(<App api={api} />)
    fireEvent.click(await screen.findByRole('tab', { name: messages.sourcesTab }))

    const who = messages.elsewhere.who(giovanni)
    expect(await screen.findByText(messages.elsewhere.read(who))).toBeTruthy()
    expect(screen.getByText(messages.elsewhere.reading(who))).toBeTruthy()
  })

  it('explains a conversion that failed or could not start', async () => {
    const failed = { ...documentsRun, error: 'source_config_invalid' as const }
    const { api } = fakeApi({
      documentsState: async () => ok(documentsView({ cursor: null, lastRun: failed })),
      convertDocuments: async () => ({ ok: false, code: 'source_busy' }),
    })
    render(<App api={api} />)
    fireEvent.click(await screen.findByRole('tab', { name: messages.sourcesTab }))

    expect(await screen.findByText(/uno dei due non è valido/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: messages.documentsConvert }))
    expect(await screen.findByText('Una lettura è già in corso.')).toBeTruthy()
  })

  it('says so when the state cannot be loaded', async () => {
    const { api } = fakeApi({ documentsState: async () => ({ ok: false, code: 'unexpected' }) })
    render(<App api={api} />)
    fireEvent.click(await screen.findByRole('tab', { name: messages.sourcesTab }))
    expect(await screen.findByText('Qualcosa non ha funzionato. Riprova.')).toBeTruthy()
  })
})
