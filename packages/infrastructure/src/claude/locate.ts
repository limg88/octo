import { posix, win32 } from 'node:path'

export type LocateInput = {
  platform: NodeJS.Platform
  env: Record<string, string | undefined>
  home: string
  exists: (path: string) => boolean
}

export const CLAUDE_PATH_VARIABLE = 'OCTO_CLAUDE_PATH'
const COMMAND_ON_PATH = 'claude'
const PATH_VARIABLE = 'PATH'
const WINDOWS = 'win32'
const WINDOWS_EXECUTABLE = 'claude.exe'

/**
 * Where Claude Code is: the place the PM configured, else the first folder of the PATH that holds
 * it, else the usual install places. A desktop app does not inherit the PATH of the PM's
 * terminal, so the PATH given here is the one asked of the shell (see `shellPath`). When nothing
 * is found the bare command is returned and the system decides.
 */
export function locateClaude(input: LocateInput): string {
  const configured = input.env[CLAUDE_PATH_VARIABLE]
  if (configured) return configured
  return candidates(input).find((candidate) => input.exists(candidate)) ?? COMMAND_ON_PATH
}

/** The paths as the system asked about writes them, whatever system this code runs on. */
const pathsOf = (platform: NodeJS.Platform) => (platform === WINDOWS ? win32 : posix)

function onPath(input: LocateInput): string[] {
  const { join, delimiter } = pathsOf(input.platform)
  const name = input.platform === WINDOWS ? WINDOWS_EXECUTABLE : COMMAND_ON_PATH
  return (input.env[PATH_VARIABLE] ?? '')
    .split(delimiter)
    .filter((folder) => folder !== '')
    .map((folder) => join(folder, name))
}

function candidates(input: LocateInput): string[] {
  const { join } = pathsOf(input.platform)
  if (input.platform === WINDOWS) {
    return [...onPath(input), join(input.home, '.local', 'bin', WINDOWS_EXECUTABLE)]
  }
  return [
    ...onPath(input),
    join(input.home, '.local', 'bin', 'claude'),
    join(input.home, '.claude', 'local', 'claude'),
    '/opt/homebrew/bin/claude',
    '/usr/local/bin/claude',
  ]
}
