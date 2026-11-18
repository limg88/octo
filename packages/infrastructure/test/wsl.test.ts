import { mkdir, mkdtemp, readdir, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { fenceGrant, fenceSettings } from '../src/claude/fenced-run.ts'
import {
  createClaudeCliRunner,
  createFsWorkFolders,
  createWslLauncher,
  launcherScript,
  parseWslList,
  shellQuote,
  usableDistro,
  type WslState,
  wslArguments,
  wslPath,
  wslState,
} from '../src/index.ts'

const FAKE_CLAUDE = fileURLToPath(new URL('./fake-claude.mjs', import.meta.url))
const FAKE_WSL = fileURLToPath(new URL('./support/fake-wsl.mjs', import.meta.url))
/** `wsl.exe -l -v` as it comes: UTF-16, read here byte by byte as the app reads it. */
const listing = (text: string): string => Buffer.from(`\uFEFF${text}`, 'utf16le').toString('latin1')

describe('a path of Windows as the distribution sees it', () => {
  it('puts a drive under /mnt, whatever the slashes and the case of its letter', () => {
    expect(wslPath('C:\\Progetti\\Aurora')).toBe('/mnt/c/Progetti/Aurora')
    expect(wslPath('D:/Dati condivisi/Aurora/')).toBe('/mnt/d/Dati condivisi/Aurora')
    expect(wslPath('c:\\')).toBe('/mnt/c')
    expect(wslPath('E:')).toBe('/mnt/e')
    expect(wslPath('C:\\Users\\paola\\OneDrive - Azienda\\Aurora\\_octo')).toBe(
      '/mnt/c/Users/paola/OneDrive - Azienda/Aurora/_octo',
    )
  })

  it('knows a folder of the distribution, leaves a path of Linux, and refuses a network share', () => {
    expect(wslPath('\\\\wsl$\\Ubuntu\\home\\paola\\Aurora')).toBe('/home/paola/Aurora')
    expect(wslPath('\\\\wsl.localhost\\Ubuntu\\home\\paola\\')).toBe('/home/paola')
    expect(wslPath('\\\\wsl$\\Ubuntu')).toBe('/')
    expect(wslPath('/mnt/c/Progetti/Aurora')).toBe('/mnt/c/Progetti/Aurora')
    // The distribution does not see a share unless somebody mounted it: Octo does not guess.
    expect(wslPath('\\\\server\\condivisa\\Aurora')).toBeNull()
  })

  it('draws the fence on the folders as the distribution calls them', () => {
    const project = wslPath('C:\\Progetti\\Aurora') ?? ''
    const fence = {
      workFolder: wslPath('C:\\Users\\paola\\AppData\\Roaming\\Octo\\lavoro\\p-1\\q-1') ?? '',
      interpreter: wslPath('C:\\Program Files\\Octo\\resources\\python-linux\\bin\\python3') ?? '',
    }
    expect(fenceSettings(project, fence)).toMatchObject({
      sandbox: {
        filesystem: {
          denyWrite: ['/mnt/c/Progetti/Aurora'],
          allowWrite: ['/mnt/c/Users/paola/AppData/Roaming/Octo/lavoro/p-1/q-1'],
          allowRead: [
            '/mnt/c/Progetti/Aurora',
            '/mnt/c/Users/paola/AppData/Roaming/Octo/lavoro/p-1/q-1',
            '/mnt/c/Program Files/Octo/resources/python-linux',
          ],
        },
      },
    })
    const grant = fenceGrant(project, fence)
    expect(grant.allowed.slice(3)).toEqual([
      'Edit(//mnt/c/Users/paola/AppData/Roaming/Octo/lavoro/p-1/q-1/**)',
      'Bash("/mnt/c/Program Files/Octo/resources/python-linux/bin/python3" *)',
    ])
  })
})

describe('the script that starts Claude Code inside the distribution', () => {
  it('quotes every word so a shell reads it back as it was', () => {
    expect(shellQuote('semplice')).toBe("'semplice'")
    expect(shellQuote("l'ordine")).toBe("'l'\\''ordine'")
    expect(shellQuote('$HOME `id` "x" \n a')).toBe('\'$HOME `id` "x" \n a\'')
  })

  it('looks where Claude Code installs itself, then starts it with its words untouched', () => {
    const script = launcherScript(['claude'], ['-p', '--settings', '{"sandbox":{"enabled":true}}'])
    expect(script.split('\n')).toEqual([
      '#!/bin/sh',
      'PATH="$HOME/.local/bin:$PATH"',
      'export PATH',
      "exec 'claude' '-p' '--settings' '{\"sandbox\":{\"enabled\":true}}'",
      '',
    ])
  })

  it('is asked of wsl.exe by distribution, folder and script: plain paths only', () => {
    expect(wslArguments('Ubuntu', '/mnt/c/Progetti/Aurora', '/mnt/c/Octo/avvio/a.sh')).toEqual([
      '-d',
      'Ubuntu',
      '--cd',
      '/mnt/c/Progetti/Aurora',
      '--exec',
      '/bin/sh',
      '/mnt/c/Octo/avvio/a.sh',
    ])
  })
})

describe('the distributions of this computer', () => {
  const two = listing(
    '  NAME            STATE           VERSION\r\n* Ubuntu-24.04    Running         2\r\n  docker-desktop  Stopped         2\r\n  Vecchia         Stopped         1\r\n',
  )

  it('are read from what wsl.exe lists, the default one marked', () => {
    expect(parseWslList(two)).toEqual([
      { name: 'Ubuntu-24.04', version: 2, isDefault: true },
      { name: 'docker-desktop', version: 2, isDefault: false },
      { name: 'Vecchia', version: 1, isDefault: false },
    ])
    expect(parseWslList('')).toEqual([])
    expect(
      parseWslList(listing('Il sottosistema Windows per Linux non è installato.\r\n')),
    ).toEqual([])
  })

  it('give the default one when it is WSL2, else the first that is, else none', () => {
    expect(usableDistro(parseWslList(two))).toBe('Ubuntu-24.04')
    const old = listing(
      '  NAME     STATE    VERSION\r\n* Vecchia  Stopped  1\r\n  Nuova    Stopped  2\r\n',
    )
    expect(usableDistro(parseWslList(old))).toBe('Nuova')
    expect(usableDistro([{ name: 'Vecchia', version: 1, isDefault: true }])).toBeNull()
  })

  it('tell why Claude Code cannot be started inside WSL2, or where it can', async () => {
    const answering = (found: string) => async (_wsl: string, args: string[]) =>
      args[0] === '-l' ? two : found
    expect(await wslState('wsl.exe', answering('/home/paola/.local/bin/claude\n'))).toEqual({
      ready: true,
      distro: 'Ubuntu-24.04',
    })
    expect(await wslState('wsl.exe', answering(''))).toEqual({ ready: false, why: 'no_claude' })
    const failing = async (_wsl: string, args: string[]) => {
      if (args[0] === '-l') return two
      throw new Error('exit 1')
    }
    expect(await wslState('wsl.exe', failing)).toEqual({ ready: false, why: 'no_claude' })
    const missing = async (): Promise<string> => {
      throw new Error('ENOENT')
    }
    expect(await wslState('wsl.exe', missing)).toEqual({ ready: false, why: 'no_wsl' })
    expect(await wslState('wsl.exe', async () => '')).toEqual({ ready: false, why: 'no_wsl' })
    const first = listing('  NAME     STATE    VERSION\r\n* Vecchia  Stopped  1\r\n')
    expect(await wslState('wsl.exe', async () => first)).toEqual({ ready: false, why: 'not_wsl2' })
  })
})

// The whole way through a stand-in for wsl.exe needs a shell: not on Windows, where the real
// one is tried on the PC of the pilot (docs/verifiche-da-fare.md).
const throughWsl = process.platform === 'win32' ? describe.skip : describe

throughWsl('a run started inside the distribution', () => {
  let root: string
  let project: string
  let interpreter: string
  beforeAll(async () => {
    root = await realpath(await mkdtemp(join(tmpdir(), 'octo-wsl-')))
    project = join(root, 'progetto')
    await mkdir(join(project, 'wiki'), { recursive: true })
    await writeFile(join(project, 'wiki', 'stato.md'), 'riga uno\nriga due\n')
    await mkdir(join(root, 'python', 'bin'), { recursive: true })
    interpreter = join(root, 'python', 'bin', 'python3')
    await writeFile(interpreter, '')
  })
  afterAll(async () => {
    await rm(root, { recursive: true, force: true })
  })
  const ready = async (): Promise<WslState> => ({ ready: true, distro: 'Ubuntu' })
  const launcher = (state: () => Promise<WslState> = ready) =>
    createWslLauncher({
      wsl: process.execPath,
      wslPrefix: [FAKE_WSL],
      state,
      command: [process.execPath, FAKE_CLAUDE],
      scripts: join(root, 'avvio'),
    })
  const request = (question: string, workFolder: string) => ({
    projectFolder: project,
    question,
    history: [],
    liveSources: [],
    workFolder,
  })

  it('computes with the fence up, through the script, and leaves no script behind', async () => {
    const runner = createClaudeCliRunner({
      command: 'claude',
      env: { ...process.env },
      interpreter,
      fenceLauncher: launcher(),
    })
    const work = createFsWorkFolders(join(root, 'dati'))
    const folder = await work.create('p-1', 'q-1')
    const draft = await runner.compute(request('Quante righe? #recinto', folder))
    expect(draft.tables?.[0]?.rows).toEqual([['wiki/stato.md', '3']])
    expect(draft.missing).toEqual(['fence:true', 'prompts:none'])
    expect(await work.files('p-1', 'q-1')).toContain('righe.csv')
    expect(await readdir(join(root, 'avvio'))).toEqual([])
  })

  it('refuses where WSL2 or Claude Code inside it is missing, and says so before a run', async () => {
    const missing = launcher(async () => ({ ready: false, why: 'not_wsl2' }))
    const runner = createClaudeCliRunner({
      command: process.execPath,
      prefixArgs: [FAKE_CLAUDE],
      env: { ...process.env },
      interpreter,
      fenceLauncher: missing,
    })
    const folder = await createFsWorkFolders(join(root, 'dati')).create('p-1', 'q-2')
    await expect(runner.compute(request('Quante righe?', folder))).rejects.toMatchObject({
      code: 'fence_unavailable',
    })
    expect(await missing.ready?.()).toBe(false)
    // The answers that need no sandbox are not started inside the distribution.
    expect((await runner.ask(request('Quando consegniamo?', folder))).citations).toHaveLength(1)
  })

  it('refuses a project the distribution cannot see', async () => {
    expect(() => launcher().path('\\\\server\\condivisa\\Aurora')).toThrow('fence_unavailable')
    await expect(
      launcher().launch('claude', [], '\\\\server\\condivisa\\Aurora'),
    ).rejects.toMatchObject({ code: 'fence_unavailable' })
  })
})
