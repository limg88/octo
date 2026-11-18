import { execFile } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { DomainError } from '@octo/domain'
import type { Launcher } from './structured-run.ts'

/**
 * On Windows the sandbox Claude Code fences a run with exists only inside WSL2. Octo runs on
 * Windows and starts Claude Code inside the distribution: every path it names is told as the
 * distribution sees it, and the command travels in a small script, so that nothing but plain
 * paths crosses the command line of Windows.
 */

const DRIVE = /^([A-Za-z]):[\\/]*(.*)$/
/** A folder of a distribution as Windows names it: `\\wsl$\Ubuntu\home\x`, `\\wsl.localhost\…`. */
const DISTRO_SHARE = /^[\\/]{2}wsl(?:\$|\.localhost)[\\/][^\\/]+(?:[\\/](.*))?$/i
const NETWORK = /^[\\/]{2}/

/**
 * A path of Windows as the distribution sees it: `C:\Progetti\Aurora` is `/mnt/c/Progetti/Aurora`,
 * a folder of the distribution is itself, a path already of Linux stays. Null for a network
 * share: the distribution does not see it unless somebody mounted it, and Octo does not guess.
 */
export function wslPath(path: string): string | null {
  const own = DISTRO_SHARE.exec(path)
  if (own) return `/${(own[1] ?? '').replaceAll('\\', '/')}`.replace(/\/+$/, '') || '/'
  if (NETWORK.test(path)) return null
  const drive = DRIVE.exec(path)
  if (!drive) return path.replaceAll('\\', '/')
  const rest = (drive[2] ?? '').replaceAll('\\', '/').replace(/\/+$/, '')
  const mount = `/mnt/${(drive[1] ?? '').toLowerCase()}`
  return rest === '' ? mount : `${mount}/${rest}`
}

/** A word as a POSIX shell reads it back unchanged, whatever it holds. */
export const shellQuote = (word: string): string => `'${word.replaceAll("'", `'\\''`)}'`

/**
 * The script that starts the command inside the distribution. Claude Code installs itself in
 * the home of the person, where a shell that is not a login shell does not look: said first.
 */
export function launcherScript(command: readonly string[], args: readonly string[]): string {
  const words = [...command, ...args].map(shellQuote).join(' ')
  return `#!/bin/sh\nPATH="$HOME/.local/bin:$PATH"\nexport PATH\nexec ${words}\n`
}

export type WslDistro = { name: string; version: number; isDefault: boolean }

/**
 * The distributions `wsl.exe -l -v` lists. Its output is UTF-16, so read as bytes it has a zero
 * between the letters: they are dropped. The default one is marked with a star.
 */
export function parseWslList(output: string): WslDistro[] {
  const lines = output
    .replaceAll('\u0000', '')
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
  return lines.flatMap((line) => {
    const found = /^\s*(\*?)\s*(\S.*?)\s+\S+\s+([12])\s*$/.exec(line)
    return found
      ? [{ name: found[2] ?? '', version: Number(found[3]), isDefault: found[1] === '*' }]
      : []
  })
}

/** The distribution to use: the default one when it is WSL2, else the first that is. */
export function usableDistro(distros: readonly WslDistro[]): string | null {
  const second = distros.filter((distro) => distro.version === 2)
  return (second.find((distro) => distro.isDefault) ?? second[0])?.name ?? null
}

/** What `wsl.exe` is asked: which distribution, from which folder, to run which script. */
export function wslArguments(distro: string, folder: string, script: string): string[] {
  return ['-d', distro, '--cd', folder, '--exec', '/bin/sh', script]
}

/** Why Claude Code cannot be started inside WSL2 on this computer. */
export type WslMissing = 'no_wsl' | 'not_wsl2' | 'no_claude'
export type WslState = { ready: true; distro: string } | { ready: false; why: WslMissing }

/** Runs a program and gives back what it wrote, as bytes read one by one; rejects when it fails. */
export type WslRun = (command: string, args: string[]) => Promise<string>

const DETECT_TIMEOUT_MS = 15 * 1000
const FIND_CLAUDE = 'PATH="$HOME/.local/bin:$PATH" command -v claude'

const runProgram: WslRun = (command, args) =>
  new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      { timeout: DETECT_TIMEOUT_MS, windowsHide: true, encoding: 'latin1' },
      (error, stdout) => (error ? reject(error) : resolve(stdout)),
    )
  })

/**
 * Whether this computer can start Claude Code inside WSL2: a distribution of version 2, with
 * Claude Code installed in it. Whether the person is signed in there is told by the first run.
 */
export async function wslState(wsl: string, run: WslRun = runProgram): Promise<WslState> {
  let distros: WslDistro[]
  try {
    distros = parseWslList(await run(wsl, ['-l', '-v']))
  } catch {
    return { ready: false, why: 'no_wsl' }
  }
  const distro = usableDistro(distros)
  if (distro === null) return { ready: false, why: distros.length === 0 ? 'no_wsl' : 'not_wsl2' }
  try {
    const found = await run(wsl, ['-d', distro, '--exec', '/bin/sh', '-c', FIND_CLAUDE])
    return found.trim() === '' ? { ready: false, why: 'no_claude' } : { ready: true, distro }
  } catch {
    return { ready: false, why: 'no_claude' }
  }
}

export type WslLauncherOptions = {
  /** `wsl.exe`, or what stands for it in a test. */
  wsl: string
  /** Arguments placed before ours: lets a test run a script through Node. */
  wslPrefix?: string[]
  /** The distribution to run in, found when first needed; a test names it. */
  state: () => Promise<WslState>
  /** The command inside the distribution: `claude`, found on its PATH. */
  command: string[]
  /** A folder of the state of the app for the scripts: never the project, never a work folder. */
  scripts: string
}

/** Starts a command inside the distribution, from the folder Octo names as Windows names it. */
export function createWslLauncher(options: WslLauncherOptions): Launcher {
  const seen = (path: string): string => {
    const inside = wslPath(path)
    // A place the distribution cannot see cannot be fenced: refused, never run from elsewhere.
    if (inside === null) throw new DomainError('fence_unavailable', path)
    return inside
  }
  let found: Promise<WslState> | null = null
  const state = (): Promise<WslState> => {
    found ??= options.state()
    return found
  }
  return {
    path: seen,
    ready: async () => (await state()).ready,
    async launch(_command, args, cwd) {
      const where = await state()
      // Without WSL2 and Claude Code inside it there is no sandbox: the run is refused.
      if (!where.ready) throw new DomainError('fence_unavailable', where.why)
      await mkdir(options.scripts, { recursive: true })
      const script = join(options.scripts, `${randomUUID()}.sh`)
      await writeFile(script, launcherScript(options.command, args))
      return {
        command: options.wsl,
        args: [
          ...(options.wslPrefix ?? []),
          ...wslArguments(where.distro, seen(cwd), seen(script)),
        ],
        cwd,
        done: () => rm(script, { force: true }),
      }
    },
  }
}
