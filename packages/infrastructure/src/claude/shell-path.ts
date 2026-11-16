import { execFile } from 'node:child_process'
import { delimiter } from 'node:path'

/** Runs a shell and gives back what it wrote; rejects when it fails or takes too long. */
export type ShellRun = (shell: string, args: string[], timeoutMs: number) => Promise<string>

export type ShellPathInput = {
  platform: NodeJS.Platform
  env: Record<string, string | undefined>
  run?: ShellRun
}

const PATH_VARIABLE = 'PATH'
const SHELL_VARIABLE = 'SHELL'
const FALLBACK_SHELL = '/bin/zsh'
const WINDOWS = 'win32'
const SHELL_TIMEOUT_MS = 5 * 1000
/** What the profile of a shell prints around the answer is told apart by these. */
const MARK = '__OCTO_PATH__'
const PRINT_PATH = `printf '%s%s%s' '${MARK}' "$PATH" '${MARK}'`
const BETWEEN_MARKS = new RegExp(`${MARK}(.*?)${MARK}`, 's')

const runShell: ShellRun = (shell, args, timeoutMs) =>
  new Promise((resolve, reject) => {
    execFile(
      shell,
      args,
      { timeout: timeoutMs, windowsHide: true, encoding: 'utf8' },
      (error, stdout) => (error ? reject(error) : resolve(stdout)),
    )
  })

/**
 * The PATH of the PM's terminal. An app opened from the Finder gets the bare PATH of the system,
 * without what the profile of the shell adds: a Node version manager, Homebrew, the user's own
 * folders. Null where there is nothing to ask (Windows) or the shell does not answer.
 */
export async function shellPath(input: ShellPathInput): Promise<string | null> {
  if (input.platform === WINDOWS) return null
  const shell = input.env[SHELL_VARIABLE] || FALLBACK_SHELL
  try {
    const written = await (input.run ?? runShell)(shell, ['-ilc', PRINT_PATH], SHELL_TIMEOUT_MS)
    const found = BETWEEN_MARKS.exec(written)?.[1]?.trim()
    return found ? found : null
  } catch {
    return null
  }
}

/** The environment with the folders of the terminal's PATH put before its own, each once. */
export function withShellPath(
  env: Record<string, string | undefined>,
  fromShell: string | null,
): Record<string, string | undefined> {
  if (fromShell === null) return env
  const folders = [...fromShell.split(delimiter), ...(env[PATH_VARIABLE] ?? '').split(delimiter)]
  const once = [...new Set(folders.filter((folder) => folder !== ''))]
  return { ...env, [PATH_VARIABLE]: once.join(delimiter) }
}
