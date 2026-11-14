// Composition root of the desktop app: the only place where adapters meet use cases.
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createAskQuestion, createProjects } from '@octo/application'
import {
  createClaudeCliRunner,
  createFsEvidenceReader,
  createFsFolderProbe,
  createJsonProjectRegistry,
  createJsonQuestionLog,
  locateClaude,
} from '@octo/infrastructure'
import { app, BrowserWindow } from 'electron'
import { registerIpc } from './ipc.ts'

const WINDOW_SIZE = { width: 1280, height: 860, minWidth: 900, minHeight: 600 }
const FOLDER_DIALOG_TITLE = 'Scegli la cartella del progetto'
/** Lets a demo or a test keep its state apart from the PM's real one. */
const DATA_FOLDER_VARIABLE = 'OCTO_DATA_DIR'

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
    folders: createFsFolderProbe(),
    clock,
    ids,
  })
  registerIpc({
    window: createWindow(),
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
