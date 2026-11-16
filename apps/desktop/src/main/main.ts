// Composition root of the desktop app: the only place where adapters meet use cases.
import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  createAlignments,
  createAskQuestion,
  createBackups,
  createDashboard,
  createDashboardAdvice,
  createDayClosing,
  createDeliverables,
  createDocuments,
  createFeeding,
  createFeeds,
  createForecasts,
  createHours,
  createMeetings,
  createModels,
  createOpenPoints,
  createPreferences,
  createProgress,
  createProjects,
  createRisks,
  createSession,
  createSourceMap,
  createSources,
  createTeam,
  createToday,
  createTrackerSnapshots,
  createUpdates,
  type Feeding,
  type MailArchive,
  type Projects,
  type Session,
  settingsOwnedBy,
  type Today,
  type TodayView,
  TRACKER_REFRESH_MS,
  type TrackerSnapshots,
  type Updates,
} from '@octo/application'
import {
  backupFileName,
  DomainError,
  firstEntered,
  meetingKey,
  meetingNotices,
  type Project,
  prepCount,
} from '@octo/domain'
import {
  createAdoTrackerReader,
  createAppleMailArchive,
  createClaudeCliRunner,
  createClaudeDeliverableWriter,
  createClaudeMeetingReader,
  createClaudeTodayJudge,
  createClaudeTrackerAdvisor,
  createConnectorFeedReader,
  createEd25519Verifier,
  createFeedRecords,
  createFileVault,
  createFixedIdentityProvider,
  createFsAlignmentSettings,
  createFsDashboardSettings,
  createFsEvidenceReader,
  createFsFolderProbe,
  createFsForecastSettings,
  createFsHoursSettings,
  createFsMeetingExports,
  createFsMemoryWriter,
  createFsModelSettings,
  createFsOpenPointStore,
  createFsProgressSettings,
  createFsProjectFiles,
  createFsProjectScaffold,
  createFsQuestionLog,
  createFsRiskRegisterStore,
  createFsSourceSettings,
  createFsTeamStore,
  createFsTodayStore,
  createFsTrackerExports,
  createGithubReleaseFeed,
  createHttpDownloads,
  createJiraHoursReader,
  createJsonBackupFiles,
  createJsonFeedIndexes,
  createJsonPreferences,
  createJsonProjectRegistry,
  createJsonSetAsideProjects,
  createJsonSourceStates,
  createOidcIdentityProvider,
  createSignInConfig,
  createUpdateApplier,
  createWarehouseTimesheetReader,
  createWordRenderer,
  createWorkerTextExtractor,
  createXlsxModel,
  fixedPersonOf,
  locateClaude,
  type SecretCipher,
  shellPath,
  withShellPath,
} from '@octo/infrastructure'
import { app, BrowserWindow, safeStorage, shell } from 'electron'
import releaseKeys from '../../release-keys.json' with { type: 'json' }
import { CHANNELS } from '../shared/api.ts'
import { registerIpc } from './ipc.ts'

const WINDOW_SIZE = { width: 1280, height: 860, minWidth: 900, minHeight: 600 }
const FOLDER_DIALOG_TITLE = 'Scegli la cartella del progetto'
const LETTERHEAD_DIALOG_TITLE = 'Scegli il documento Word da usare come carta intestata'
const KIND_TEMPLATE_DIALOG_TITLE =
  'Scegli il documento Word o la presentazione da usare come modello di questo tipo'
const DECK_MODEL_DIALOG_TITLE = 'Scegli la presentazione da usare come modello'
const NEW_PROJECT_DIALOG_TITLE = 'Scegli dove creare la cartella del progetto'
const MEETINGS_DIALOG_TITLE = 'Scegli la cartella in cui Verbale esporta le riunioni'
const BACKUP_DIALOGS = {
  saveTitle: 'Scegli dove scrivere la copia di sicurezza',
  openTitle: 'Scegli la copia di sicurezza da ripristinare',
  fileKind: 'Copia di sicurezza di Octo',
  locateTitle: (projectName: string) =>
    `Dov’è la cartella del progetto «${projectName}» su questo computer?`,
}
/** Lets a demo or a test keep its state apart from the PM's real one. */
const DATA_FOLDER_VARIABLE = 'OCTO_DATA_DIR'
/** Points the mail reader at another Mail folder: a demo's fake archive. */
const MAIL_ROOT_VARIABLE = 'OCTO_MAIL_ROOT'
/** Demos and tests only: a folder that stands for Verbale's own data on this computer. */
const VERBALE_FOLDER_VARIABLE = 'OCTO_VERBALE_DIR'
/** Demos and tests only: a publisher of releases on this computer instead of the real one. */
const UPDATE_URL_VARIABLE = 'OCTO_UPDATE_URL'
/** Demos and tests only: the key that publisher signs with. Read only together with its address. */
const UPDATE_KEY_VARIABLE = 'OCTO_UPDATE_KEY'
/** Where the releases of Octo are published. */
const RELEASES_REPOSITORY = 'limg88/octo'
const UPDATE_FOLDER = 'octo-aggiornamento'
/** Where Octo keeps the version it last ran as, to know when it has just been updated. */
const LAST_VERSION_FILE = 'version.json'
const MAC = 'darwin'
/** How often the sources of every project are read while the app is open. */
const SYNC_INTERVAL_MS = 15 * 60 * 1000
const FIRST_SYNC_DELAY_MS = 10 * 1000
const MINUTE_MS = 60 * 1000
/**
 * Demos and tests only: the seconds between two readings, so that a demo does not wait a quarter
 * of an hour to show what a reading brings.
 */
const DEV_SYNC_SECONDS_VARIABLE = 'OCTO_DEV_SYNC_SECONDS'
const devSyncSeconds = Number(process.env[DEV_SYNC_SECONDS_VARIABLE] ?? '')
const devSync = Number.isFinite(devSyncSeconds) && devSyncSeconds > 0
const syncIntervalMs = devSync ? devSyncSeconds * 1000 : SYNC_INTERVAL_MS
/**
 * How old the reading of the tracker must be before a periodic reading asks it again: an hour,
 * or in a demo every time, so that what changed on the tracker is seen without waiting.
 */
const trackerRefreshMs = devSync ? 0 : TRACKER_REFRESH_MS
/** Demos and tests only: a fake Jira or Azure DevOps on this computer instead of the real one. */
const DEV_JIRA_VARIABLE = 'OCTO_DEV_JIRA_URL'
const DEV_CONFLUENCE_VARIABLE = 'OCTO_DEV_CONFLUENCE_URL'
const DEV_ADO_VARIABLE = 'OCTO_DEV_ADO_URL'
/**
 * Demos and tests only: credentials kept without the system's store, so a run needs no keychain.
 * Never set for real use: the file would hold the credentials in clear.
 */
const DEMO_SECRETS_VARIABLE = 'OCTO_DEMO_PLAIN_SECRETS'
/**
 * Demos and tests only: `Name <address>` of a person who is signed in from the start, without
 * any organization asked. Never set for real use: Octo would let anybody in under that name.
 */
const DEMO_IDENTITY_VARIABLE = 'OCTO_DEMO_IDENTITY'
/** Where the organization signs in, when it is told by the environment and not by its file. */
const ENTRA_TENANT_VARIABLE = 'OCTO_ENTRA_TENANT'
const ENTRA_CLIENT_VARIABLE = 'OCTO_ENTRA_CLIENT'
/** Demos and tests only: a sign-in on this computer instead of the organization's. */
const DEV_ENTRA_VARIABLE = 'OCTO_DEV_ENTRA_URL'

/** The operating system's own store (Keychain, DPAPI): only this user reads the secrets back. */
function secretCipher(): SecretCipher {
  if (process.env[DEMO_SECRETS_VARIABLE] === '1') {
    return {
      available: () => true,
      encrypt: (value) => new TextEncoder().encode(value),
      decrypt: (bytes) => new TextDecoder().decode(bytes),
    }
  }
  return {
    available: () => safeStorage.isEncryptionAvailable(),
    encrypt: (value) => safeStorage.encryptString(value),
    decrypt: (bytes) => safeStorage.decryptString(Buffer.from(bytes)),
  }
}

/** Built beside this file by scripts/build.mjs. */
const EXTRACT_WORKER_FILE = 'extract-worker.mjs'

/** The mail program this computer keeps its mail in. Today only Mail on a Mac is read. */
function mailArchive(): MailArchive {
  const root = process.env[MAIL_ROOT_VARIABLE]
  if (root || process.platform === MAC) return createAppleMailArchive(root)
  const missing = async (): Promise<never> => {
    throw new DomainError('mail_reader_missing')
  }
  return { between: missing, read: missing }
}

/** What came first on the page of the day of each project at the reading before, by its key. */
const firstBefore = new Map<string, string[]>()

/**
 * Tells the window when, after a reading, a signal of a project comes first that did not before:
 * one for a reading at most. The words and the notice of the system are the interface's.
 */
async function tellEntered(
  today: Pick<Today, 'view'>,
  project: Project,
  window: BrowserWindow,
): Promise<void> {
  const view = await today.view(project)
  const entered = view.notify ? firstEntered(firstBefore.get(project.id), view.now) : null
  firstBefore.set(
    project.id,
    view.now.map((entry) => entry.item.key),
  )
  if (view.notify) announceMeetings(view, project, window)
  if (entered === null || window.isDestroyed()) return
  window.webContents.send(CHANNELS.todayEntered, {
    projectId: project.id,
    projectName: project.name,
    item: entered.item,
  })
}

/** The meetings the window was already told about before they start, by project and key. */
const announced = new Set<string>()

/**
 * Tells the window, a quarter of an hour before, about each meeting of the day that starts
 * before the next reading: once for a meeting, with how much there is to bring to it.
 */
function announceMeetings(view: TodayView, project: Project, window: BrowserWindow): void {
  for (const { meeting, inMs } of meetingNotices(view.agenda.today, new Date(), syncIntervalMs)) {
    const key = meetingKey(meeting)
    const item = view.items.find((candidate) => candidate.key === key)
    const mark = `${project.id}\n${key}`
    if (!item || announced.has(mark)) continue
    announced.add(mark)
    const prep = view.prep.find((card) => card.key === key)
    setTimeout(() => {
      if (window.isDestroyed()) return
      window.webContents.send(CHANNELS.todayEntered, {
        projectId: project.id,
        projectName: project.name,
        item,
        meeting: {
          minutes: Math.max(1, Math.ceil((Date.parse(meeting.start) - Date.now()) / MINUTE_MS)),
          toBring: prep ? prepCount(prep) : 0,
        },
      })
    }, inMs)
  }
}

/**
 * Feeds the memory of every project of who is signed in, one after the other, and tells the
 * window. While nobody is signed in nothing is read.
 */
async function feedAll(
  session: Session,
  projects: Projects,
  feeding: Feeding,
  trackers: Pick<TrackerSnapshots, 'refresh'>,
  today: Pick<Today, 'view'>,
  window: BrowserWindow,
): Promise<void> {
  if (session.current() === null) return
  for (const project of await projects.list()) {
    try {
      await feeding.fill(project)
    } catch (error) {
      console.error('[octo] periodic reading failed', error)
    }
    // The tracker of the dashboard, when Octo reads it by itself and its reading is old enough.
    await trackers
      .refresh(project, trackerRefreshMs)
      .catch((error: unknown) => console.error('[octo] the tracker could not be read', error))
    if (!window.isDestroyed()) window.webContents.send(CHANNELS.sourcesChanged, project.id)
    await tellEntered(today, project, window).catch((error: unknown) =>
      console.error('[octo] the page of the day could not be computed', error),
    )
  }
}

const here = fileURLToPath(new URL('.', import.meta.url))

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    ...WINDOW_SIZE,
    title: 'Octo',
    webPreferences: {
      preload: join(here, '..', 'preload', 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  })
  // The interface is a local page: it never navigates away and never opens other windows.
  window.webContents.on('will-navigate', (event) => event.preventDefault())
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  void window.loadFile(join(here, '..', 'renderer', 'index.html'))
  return window
}

/** The environment Claude Code is found and run with: the app's own, with the terminal's PATH. */
async function seatEnvironment(): Promise<Record<string, string | undefined>> {
  const fromShell = await shellPath({ platform: process.platform, env: process.env })
  return withShellPath(process.env, fromShell)
}

/**
 * Octo that replaces itself with a newer one. Only an installed Octo looks for one: run from the
 * sources there is nothing to replace, unless a demo points it at its own publisher.
 */
function updatesOf(): Updates {
  const baseUrl = process.env[UPDATE_URL_VARIABLE]
  const workFolder = join(app.getPath('temp'), UPDATE_FOLDER)
  const looksForOne = app.isPackaged || baseUrl !== undefined
  // The keys of who publishes Octo are built into the app. A demo names its own publisher and,
  // with it, the key that publisher signs with: never a key alone, for the real releases.
  const demoKey = baseUrl === undefined ? undefined : process.env[UPDATE_KEY_VARIABLE]
  return createUpdates({
    verifier: createEd25519Verifier(demoKey === undefined ? releaseKeys.keys : [demoKey]),
    feed: looksForOne
      ? createGithubReleaseFeed({
          repository: RELEASES_REPOSITORY,
          ...(baseUrl === undefined ? {} : { baseUrl }),
        })
      : { latest: async () => null },
    downloads: createHttpDownloads({ folder: workFolder }),
    applier: createUpdateApplier({
      platform: process.platform,
      execPath: process.execPath,
      pid: process.pid,
      workFolder,
      quit: () => app.quit(),
      // An Octo given its own data folder starts again with it: the system would not pass it on.
      relaunch: process.env[DATA_FOLDER_VARIABLE] === undefined ? 'system' : 'direct',
    }),
    current: app.getVersion(),
    target: { platform: process.platform, arch: process.arch },
  })
}

/**
 * The version of this Octo, when the one that ran before here was another one and the system is
 * a Mac: an unsigned app that changes loses there the access to the disk it was given.
 */
function updatedVersion(dataFolder: string): string | null {
  const file = join(dataFolder, LAST_VERSION_FILE)
  const current = app.getVersion()
  let previous: unknown = null
  try {
    previous = JSON.parse(readFileSync(file, 'utf8')).version
  } catch {
    // Never run before, or run by an Octo that did not keep its version.
  }
  if (previous !== current) {
    mkdirSync(dataFolder, { recursive: true })
    writeFileSync(file, JSON.stringify({ version: current }))
  }
  return typeof previous === 'string' && previous !== current && process.platform === MAC
    ? current
    : null
}

function start(seatEnv: Record<string, string | undefined>): void {
  const dataFolder = process.env[DATA_FOLDER_VARIABLE] ?? app.getPath('userData')
  const clock = { now: () => new Date() }
  const ids = { next: () => randomUUID() }
  const questions = createFsQuestionLog()
  const sourceStates = createJsonSourceStates(dataFolder)
  const evidence = createFsEvidenceReader()
  const claude = {
    command: locateClaude({
      platform: process.platform,
      env: seatEnv,
      home: homedir(),
      exists: existsSync,
    }),
    env: seatEnv,
  }
  const agent = createClaudeCliRunner(claude)
  const secrets = createFileVault(dataFolder, secretCipher())
  const demoPerson = fixedPersonOf(process.env[DEMO_IDENTITY_VARIABLE])
  const session = createSession({
    provider: demoPerson
      ? createFixedIdentityProvider(demoPerson)
      : createOidcIdentityProvider({
          config: createSignInConfig({
            dataFolder,
            env: {
              tenantId: process.env[ENTRA_TENANT_VARIABLE],
              clientId: process.env[ENTRA_CLIENT_VARIABLE],
              authority: process.env[DEV_ENTRA_VARIABLE],
            },
          }),
          openBrowser: (url) => shell.openExternal(url),
          allowLoopbackAuthority: process.env[DEV_ENTRA_VARIABLE] !== undefined,
        }),
    secrets,
  })
  const identity = () => session.current()
  // The company system is read as who is signed in, by the mail address and the sign-in name.
  // Somebody signed in without either is bound to nothing: the address of a project never
  // stands in for a person.
  const owner = () => {
    const person = session.current()
    return person === null ? null : { email: person.email, upn: person.username }
  }
  const registry = createJsonProjectRegistry(dataFolder)
  const folders = createFsFolderProbe()
  const projects = createProjects({
    registry,
    setAside: createJsonSetAsideProjects(dataFolder),
    folders,
    scaffold: createFsProjectScaffold(),
    clock,
    ids,
    identity,
  })
  const writer = createFsMemoryWriter()
  // The company system is read as who is signed in, wherever its settings are read from.
  const settings = settingsOwnedBy(createFsSourceSettings(), identity)
  const files = createFsProjectFiles()
  const sources = createSources({
    settings,
    states: sourceStates,
    archive: mailArchive(),
    writer,
    clock,
    files,
  })
  const verbaleFolder = process.env[VERBALE_FOLDER_VARIABLE]
  const meetings = createMeetings({
    settings,
    states: sourceStates,
    exports: createFsMeetingExports({
      home: homedir(),
      ...(verbaleFolder ? { verbaleFolder } : {}),
    }),
    projects: () => projects.list(),
    files,
    writer,
    clock,
  })
  const devEndpoints = {
    jira: process.env[DEV_JIRA_VARIABLE],
    ado: process.env[DEV_ADO_VARIABLE],
    confluence: process.env[DEV_CONFLUENCE_VARIABLE],
  }
  const indexes = createJsonFeedIndexes(dataFolder)
  const feeds = createFeeds({
    settings,
    states: sourceStates,
    indexes,
    secrets,
    reader: createConnectorFeedReader({ devEndpoints, owner }),
    writer,
    files,
    clock,
    identity,
  })
  const documents = createDocuments({
    files,
    extractor: createWorkerTextExtractor(join(here, EXTRACT_WORKER_FILE)),
    writer,
    states: sourceStates,
    clock,
  })
  const team = createTeam({ store: createFsTeamStore(), writer })
  const models = createModels({ store: createFsModelSettings() })
  const chosenModels = (project: Project) => models.get(project)
  const hoursSettings = createFsHoursSettings()
  const hours = createHours({
    settings: hoursSettings,
    files,
    sources: settings,
    secrets,
    tracker: createJiraHoursReader({ devEndpoints }),
    timesheets: createWarehouseTimesheetReader({ owner }),
    writer,
    clock,
    team: (project) => team.get(project),
  })
  const sheets = createXlsxModel()
  const dashboardSettings = createFsDashboardSettings()
  const trackerExports = createFsTrackerExports()
  const window = createWindow()
  const feeding = createFeeding({ writer, sources, meetings, feeds, documents })
  const liveSources = createSourceMap({ sources, meetings, feeds, hours: hoursSettings, files })
  /** When the sources are read next by themselves: the page of the day says it. */
  let nextReadingAt: string | null = null
  const readingIn = (delayMs: number) => {
    nextReadingAt = new Date(Date.now() + delayMs).toISOString()
  }
  const periodic = () => {
    readingIn(syncIntervalMs)
    void feedAll(session, projects, feeding, trackerSnapshots, today, window)
  }
  // At every start the sign-in kept on this computer is renewed; a demo person is simply in.
  void (demoPerson ? session.signIn() : session.resume())
    .catch((error: unknown) => console.error('[octo] sign-in at start failed', error))
    .then(() => {
      readingIn(FIRST_SYNC_DELAY_MS)
      setTimeout(periodic, FIRST_SYNC_DELAY_MS)
    })
  setInterval(periodic, syncIntervalMs)
  const deliverables = createDeliverables({
    writer: createClaudeDeliverableWriter(claude),
    renderer: createWordRenderer(),
    evidence,
    files,
    memory: writer,
    clock,
    ids,
    models: chosenModels,
    liveSources,
  })
  const dashboard = createDashboard({
    settings: dashboardSettings,
    exports: trackerExports,
    clock,
    writer,
    team: (project) => team.get(project),
    sources: settings,
  })
  const trackerSnapshots = createTrackerSnapshots({
    settings: dashboardSettings,
    sources: settings,
    secrets,
    tracker: createAdoTrackerReader({ devEndpoints }),
    writer,
    team: (project) => team.get(project),
    exports: trackerExports,
    clock,
  })
  const dashboardAdvice = createDashboardAdvice({
    dashboard,
    advisor: createClaudeTrackerAdvisor(claude),
    clock,
    author: () => identity()?.name ?? null,
    models: chosenModels,
    liveSources,
  })
  const alignments = createAlignments({
    settings: createFsAlignmentSettings(),
    dashboard: dashboardSettings,
    exports: trackerExports,
    sources: settings,
    records: createFeedRecords(files),
    writer,
    team: (project) => team.get(project),
  })
  const forecasts = createForecasts({
    settings: createFsForecastSettings(),
    files,
    sheets,
    timesheet: (project) => hours.timesheet(project),
    writer,
  })
  const judge = createClaudeTodayJudge(claude)
  const risks = createRisks({
    store: createFsRiskRegisterStore(),
    writer,
    judge,
    evidence,
    clock,
    models: chosenModels,
    liveSources,
  })
  const points = createOpenPoints({ store: createFsOpenPointStore(), writer, clock })
  const reader = createClaudeMeetingReader(claude)
  const closing = createDayClosing({
    points,
    meetings,
    files,
    reader,
    evidence,
    clock,
    models: chosenModels,
    liveSources,
  })
  const today = createToday({
    points,
    closing,
    reader,
    hours,
    forecasts,
    dashboard,
    alignments,
    deliverables,
    sources,
    feeds,
    meetings,
    team,
    risks,
    files,
    store: createFsTodayStore(),
    judge,
    evidence,
    clock,
    identity,
    models: chosenModels,
    liveSources,
  })
  registerIpc({
    window,
    nextReading: () => nextReadingAt,
    session,
    today,
    risks,
    points,
    sources,
    feeds,
    meetings,
    documents,
    feeding,
    deliverables,
    dashboard,
    alignments,
    hours,
    forecasts,
    progress: createProgress({
      settings: createFsProgressSettings(),
      files,
      sheets,
      writer,
      records: createFeedRecords(files),
      invoicesFolder: async (project) =>
        (await settings.load(project.folder)).dwsi?.targetFolder ?? null,
    }),
    agent,
    updates: updatesOf(),
    updatedTo: updatedVersion(dataFolder),
    projects,
    questions,
    evidence,
    askQuestion: createAskQuestion({
      agent,
      evidence,
      questions,
      clock,
      ids,
      models: chosenModels,
      liveSources,
    }),
    models,
    preferences: createPreferences({ store: createJsonPreferences(dataFolder) }),
    folderDialogTitle: FOLDER_DIALOG_TITLE,
    letterheadDialogTitle: LETTERHEAD_DIALOG_TITLE,
    kindTemplateDialogTitle: KIND_TEMPLATE_DIALOG_TITLE,
    deckModelDialogTitle: DECK_MODEL_DIALOG_TITLE,
    newProjectDialogTitle: NEW_PROJECT_DIALOG_TITLE,
    meetingsDialogTitle: MEETINGS_DIALOG_TITLE,
    team,
    trackerSnapshots,
    dashboardAdvice,
    backups: createBackups({
      registry,
      sourceStates,
      indexes,
      folders,
      files: createJsonBackupFiles(),
      clock,
    }),
    backupDialogs: { ...BACKUP_DIALOGS, defaultFileName: () => backupFileName(clock.now()) },
  })
}

app.on('window-all-closed', () => app.quit())
void app.whenReady().then(async () => start(await seatEnvironment()))
