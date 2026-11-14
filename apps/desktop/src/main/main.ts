// Composition root of the desktop app: the only place where adapters meet use cases.
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  createAskQuestion,
  createDocuments,
  createProjects,
  createSources,
  type Documents,
  type MailArchive,
  type Projects,
  type Sources,
} from '@octo/application'
import { DomainError, isDomainError } from '@octo/domain'
import {
  createAppleMailArchive,
  createClaudeCliRunner,
  createFsEvidenceReader,
  createFsFolderProbe,
  createFsMemoryWriter,
  createFsProjectFiles,
  createFsSourceSettings,
  createJsonProjectRegistry,
  createJsonQuestionLog,
  createJsonSourceStates,
  createWorkerTextExtractor,
  locateClaude,
} from '@octo/infrastructure'
import { app, BrowserWindow } from 'electron'
import { CHANNELS } from '../shared/api.ts'
import { registerIpc } from './ipc.ts'

const WINDOW_SIZE = { width: 1280, height: 860, minWidth: 900, minHeight: 600 }
const FOLDER_DIALOG_TITLE = 'Scegli la cartella del progetto'
/** Lets a demo or a test keep its state apart from the PM's real one. */
const DATA_FOLDER_VARIABLE = 'OCTO_DATA_DIR'
/** Points the mail reader at another Mail folder: a demo's fake archive. */
const MAIL_ROOT_VARIABLE = 'OCTO_MAIL_ROOT'
const MAC = 'darwin'
/** How often the sources of every project are read while the app is open. */
const SYNC_INTERVAL_MS = 15 * 60 * 1000
const FIRST_SYNC_DELAY_MS = 10 * 1000
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

type Feeding = { projects: Projects; sources: Sources; documents: Documents }

/** One step of a periodic reading: a failure of it never stops the others. */
async function quietly(step: () => Promise<unknown>): Promise<void> {
  try {
    await step()
  } catch (error) {
    // A reading already running or a broken configuration: the Sources page shows it.
    if (!isDomainError(error)) console.error('[octo] periodic reading failed', error)
  }
}

/** Feeds the memory of every project, one after the other, and tells the window. */
async function feedAll(feeding: Feeding, window: BrowserWindow): Promise<void> {
  for (const project of await feeding.projects.list()) {
    await quietly(async () => {
      if (await feeding.sources.hasMail(project)) await feeding.sources.syncMail(project)
    })
    await quietly(() => feeding.documents.convert(project))
    if (!window.isDestroyed()) window.webContents.send(CHANNELS.sourcesChanged, project.id)
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

function start(): void {
  const dataFolder = process.env[DATA_FOLDER_VARIABLE] ?? app.getPath('userData')
  const clock = { now: () => new Date() }
  const ids = { next: () => randomUUID() }
  const questions = createJsonQuestionLog(dataFolder)
  const sourceStates = createJsonSourceStates(dataFolder)
  const evidence = createFsEvidenceReader()
  const agent = createClaudeCliRunner({
    command: locateClaude({
      platform: process.platform,
      env: process.env,
      home: homedir(),
      exists: existsSync,
    }),
    env: process.env,
  })
  const projects = createProjects({
    registry: createJsonProjectRegistry(dataFolder),
    questions,
    sourceStates,
    folders: createFsFolderProbe(),
    clock,
    ids,
  })
  const writer = createFsMemoryWriter()
  const sources = createSources({
    settings: createFsSourceSettings(),
    states: sourceStates,
    archive: mailArchive(),
    writer,
    clock,
  })
  const documents = createDocuments({
    files: createFsProjectFiles(),
    extractor: createWorkerTextExtractor(join(here, EXTRACT_WORKER_FILE)),
    writer,
    states: sourceStates,
    clock,
  })
  const window = createWindow()
  const periodic = () => void feedAll({ projects, sources, documents }, window)
  setTimeout(periodic, FIRST_SYNC_DELAY_MS)
  setInterval(periodic, SYNC_INTERVAL_MS)
  registerIpc({
    window,
    sources,
    documents,
    agent,
    projects,
    questions,
    evidence,
    askQuestion: createAskQuestion({ agent, evidence, questions, clock, ids }),
    folderDialogTitle: FOLDER_DIALOG_TITLE,
  })
}

app.on('window-all-closed', () => app.quit())
void app.whenReady().then(start)
