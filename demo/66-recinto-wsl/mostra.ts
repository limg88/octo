// Shows what Octo does on a Windows PC to start Claude Code inside WSL2, and runs it once on
// this computer through a stand-in for wsl.exe and the fake Claude.
import { mkdirSync, mkdtempSync, readdirSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fenceGrant, fenceSettings } from '../../packages/infrastructure/src/claude/fenced-run.ts'
import {
  createClaudeCliRunner,
  createFsWorkFolders,
  createWslLauncher,
  launcherScript,
  wslArguments,
  wslPath,
  wslState,
} from '../../packages/infrastructure/src/index.ts'

const here = fileURLToPath(new URL('.', import.meta.url))
const FAKE_WSL = join(
  here,
  '..',
  '..',
  'packages',
  'infrastructure',
  'test',
  'support',
  'fake-wsl.mjs',
)
const FAKE_CLAUDE = join(here, '..', '..', 'packages', 'infrastructure', 'test', 'fake-claude.mjs')
const say = (title: string, ...lines: string[]) => console.log(`\n== ${title}\n${lines.join('\n')}`)

const windows = {
  project: 'C:\\Users\\paola\\OneDrive - Azienda\\Aurora',
  work: 'C:\\Users\\paola\\AppData\\Roaming\\Octo\\lavoro\\demo-aurora\\q-1',
  interpreter: 'C:\\Program Files\\Octo\\resources\\python-linux\\bin\\python3',
  script: 'C:\\Users\\paola\\AppData\\Roaming\\Octo\\avvio\\a1b2.sh',
}
const seen = Object.fromEntries(
  Object.entries(windows).map(([name, path]) => [name, wslPath(path) ?? '(non visibile)']),
)
say(
  '1. I percorsi di Windows come li vede la distribuzione',
  ...Object.entries(windows).map(([name, path]) => `${path}\n   -> ${seen[name]}`),
  `\\\\server\\condivisa\\Aurora\n   -> ${wslPath('\\\\server\\condivisa\\Aurora') ?? 'rifiutato: una condivisione di rete non si vede da WSL'}`,
)
const fence = { workFolder: seen.work as string, interpreter: seen.interpreter as string }
const grant = fenceGrant(seen.project as string, fence)
say(
  '2. Il recinto, disegnato su quei percorsi',
  JSON.stringify(fenceSettings(seen.project as string, fence), null, 1),
  `regole: ${grant.allowed.slice(3).join('  |  ')}`,
)
say(
  '3. Che cosa attraversa la riga di comando di Windows: solo percorsi',
  `wsl.exe ${wslArguments('Ubuntu', seen.project as string, seen.script as string).join(' ')}`,
  '',
  'e lo script che porta il comando (qui abbreviato):',
  launcherScript(['claude'], ['-p', '--restricted', '--settings', '{"sandbox":{"enabled":true}}']),
)
say(
  '4. Se WSL2 o Claude Code dentro la distribuzione mancano, Octo rifiuta di calcolare',
  `distribuzione trovata dal wsl finto: ${JSON.stringify(await wslState(process.execPath, async (_wsl, args) => (await import('node:child_process')).execFileSync(process.execPath, [FAKE_WSL, ...args], { encoding: 'latin1' })))}`,
  `senza wsl.exe: ${JSON.stringify(await wslState('wsl-che-non-esiste.exe'))}`,
)

// A whole run on this computer, through the stand-in: same code path as on Windows.
const root = realpathSync(mkdtempSync(join(tmpdir(), 'octo-demo-66-')))
try {
  const project = join(root, 'Aurora')
  mkdirSync(join(project, 'wiki'), { recursive: true })
  writeFileSync(
    join(project, 'wiki', 'stato.md'),
    'La consegna è il 12 dicembre.\nIl budget residuo è di 14.500 euro.\n',
  )
  mkdirSync(join(root, 'python', 'bin'), { recursive: true })
  writeFileSync(join(root, 'python', 'bin', 'python3'), '')
  const runner = createClaudeCliRunner({
    command: 'claude',
    env: { ...process.env },
    interpreter: join(root, 'python', 'bin', 'python3'),
    fenceLauncher: createWslLauncher({
      wsl: process.execPath,
      wslPrefix: [FAKE_WSL],
      state: async () => ({ ready: true, distro: 'Ubuntu' }),
      command: [process.execPath, FAKE_CLAUDE],
      scripts: join(root, 'avvio'),
    }),
  })
  const work = createFsWorkFolders(join(root, 'dati'))
  const folder = await work.create('demo-aurora', 'q-1')
  console.log(
    '\n== 5. Un calcolo intero attraverso il wsl finto (la riga «wsl …» è ciò che gli è stato chiesto)',
  )
  const draft = await runner.compute({
    projectFolder: project,
    workFolder: folder,
    question: 'Quante righe ha il file di stato?',
    history: [],
    liveSources: [],
  })
  console.log(`tabella: ${JSON.stringify(draft.tables?.[0]?.rows)}`)
  console.log(
    `file nella cartella di lavoro: ${(await work.files('demo-aurora', 'q-1')).join(', ')}`,
  )
  console.log(`script di avvio rimasti: ${readdirSync(join(root, 'avvio')).length}`)
} finally {
  rmSync(root, { recursive: true, force: true })
}
