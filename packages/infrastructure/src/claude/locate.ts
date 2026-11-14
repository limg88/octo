import { join } from 'node:path'

export type LocateInput = {
  platform: NodeJS.Platform
  env: Record<string, string | undefined>
  home: string
  exists: (path: string) => boolean
}

export const CLAUDE_PATH_VARIABLE = 'OCTO_CLAUDE_PATH'
const COMMAND_ON_PATH = 'claude'

/**
 * A desktop app does not inherit the PATH of the PM's terminal, so the usual install places are
 * tried first. When none exists the bare command is returned and the PATH decides.
 */
export function locateClaude(input: LocateInput): string {
  const configured = input.env[CLAUDE_PATH_VARIABLE]
  if (configured) return configured
  return candidates(input).find((candidate) => input.exists(candidate)) ?? COMMAND_ON_PATH
}

function candidates(input: LocateInput): string[] {
  if (input.platform === 'win32') {
    return [join(input.home, '.local', 'bin', 'claude.exe')]
  }
  return [
    join(input.home, '.local', 'bin', 'claude'),
    '/opt/homebrew/bin/claude',
    '/usr/local/bin/claude',
  ]
}
