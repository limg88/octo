// Composition root of the desktop app: the only place where adapters meet use cases.
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  createAskQuestion,
  createDocuments,
  createFeeding,
  createFeeds,
  createProjects,
  createSources,
  type Feeding,
  type MailArchive,
  type Projects,
} from '@octo/application'
import { DomainError } from '@octo/domain'
import {
  createAppleMailArchive,
  createClaudeCliRunner,
  createConnectorFeedReader,
  createFileVault,
  createFsEvidenceReader,
  createFsFolderProbe,
  createFsMemoryWriter,
  createFsProjectFiles,
  createFsSourceSettings,
  createJsonFeedIndexes,
  createJsonProjectRegistry,
  createJsonQuestionLog,
  createJsonSourceStates,
  createWorkerTextExtractor,
  locateClaude,
  type SecretCipher,
} from '@octo/infrastructure'
import { app, BrowserWindow, safeStorage } from 'electron'
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
/** Demos and tests only: a fake Jira or Azure DevOps on this computer instead of the real one. */
const DEV_JIRA_VARIABLE = 'OCTO_DEV_JIRA_URL'
const DEV_ADO_VARIABLE = 'OCTO_DEV_ADO_URL'
/**
 * Demos and tests only: credentials kept without the system's store, so a run needs no keychain.
 * Never set for real use: the file would hold the credentials in clear.
 */
const DEMO_SECRETS_VARIABLE = 'OCTO_DEMO_PLAIN_SECRETS'

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

/** Feeds the memory of every project, one after the other, and tells the window. */
async function feedAll(projects: Projects, feeding: Feeding, window: BrowserWindow): Promise<void> {
  for (const project of await projects.list()) {
    try {
      await feeding.fill(project)
    } catch (error) {
      console.error('[octo] periodic reading failed', error)
    }
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
  const settings = createFsSourceSettings()
  const sources = createSources({
    settings,
    states: sourceStates,
    archive: mailArchive(),
    writer,
    clock,
  })
  const files = createFsProjectFiles()
  const feeds = createFeeds({
    settings,
    states: sourceStates,
    indexes: createJsonFeedIndexes(dataFolder),
    secrets: createFileVault(dataFolder, secretCipher()),
    reader: createConnectorFeedReader({
      devEndpoints: {
        jira: process.env[DEV_JIRA_VARIABLE],
        ado: process.env[DEV_ADO_VARIABLE],
      },
    }),
    writer,
    files,
    clock,
  })
  const documents = createDocuments({
    files,
    extractor: createWorkerTextExtractor(join(here, EXTRACT_WORKER_FILE)),
    writer,
    states: sourceStates,
    clock,
  })
  const window = createWindow()
  const feeding = createFeeding({ sources, feeds, documents })
  const periodic = () => void feedAll(projects, feeding, window)
  setTimeout(periodic, FIRST_SYNC_DELAY_MS)
  setInterval(periodic, SYNC_INTERVAL_MS)
  registerIpc({
    window,
    sources,
    feeds,
    documents,
    feeding,
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
