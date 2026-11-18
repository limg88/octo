import { realpath } from 'node:fs/promises'
import { basename, dirname, join, posix } from 'node:path'
import { DomainError, type DomainErrorCode } from '@octo/domain'
import {
  type ClaudeCliConfig,
  READ_ONLY_TOOLS,
  type RunGrant,
  runStructured,
  type StructuredRun,
} from './structured-run.ts'

/** Where a run may compute and write: outside the project, which it only reads. */
export type Fence = {
  /** The folder the run writes in, and the only one; never inside the project. */
  workFolder: string
  /** The interpreter Octo ships, as an absolute path: the only command the run may start. */
  interpreter: string
}

/** The systems whose sandbox Claude Code can put a run in. Windows has it only inside WSL2. */
const FENCED_PLATFORMS: readonly NodeJS.Platform[] = ['darwin', 'linux']
/**
 * True when a run can be fenced here: an interpreter to run, and a system with a sandbox or,
 * on Windows, a way into WSL2 where the sandbox is.
 */
export const canFence = (
  interpreter: string | null,
  platform: NodeJS.Platform = process.platform,
  inWsl = false,
): boolean => interpreter !== null && (FENCED_PLATFORMS.includes(platform) || inWsl)

const FENCE_TOOLS = [...READ_ONLY_TOOLS, 'Write', 'Edit', 'Bash'] as const
/** What the CLI says when the sandbox of the system cannot start. */
const SANDBOX_HINT = /sandbox/i
const HOME = '~/'

/**
 * The settings of the sandbox of a run (configuration D4 of docs/revisione-roadmap.md §6): the
 * project cannot be written, the work folder can, the home cannot be read but for what the run
 * needs, the network is closed. A run whose sandbox does not start fails, and a command never
 * runs outside it.
 */
export function fenceSettings(projectFolder: string, fence: Fence): object {
  // A path of the distribution is of Linux whatever system Octo runs on.
  const up = fence.interpreter.startsWith('/') ? posix.dirname : dirname
  const runtime = up(up(fence.interpreter))
  return {
    sandbox: {
      enabled: true,
      failIfUnavailable: true,
      allowUnsandboxedCommands: false,
      filesystem: {
        denyWrite: [projectFolder],
        allowWrite: [fence.workFolder],
        denyRead: [HOME],
        allowRead: [projectFolder, fence.workFolder, runtime],
      },
      network: { allowedDomains: [] },
    },
  }
}

/** A path as a rule of the CLI names it: two slashes say it is absolute, not of the project. */
const absoluteRule = (path: string): string => `/${path.replaceAll('\\', '/')}`

/**
 * What a fenced run is granted: the file tools write in the work folder only, and the only
 * command is the interpreter. The rules alone are not the fence: the sandbox is.
 */
export function fenceGrant(projectFolder: string, fence: Fence): RunGrant {
  return {
    tools: FENCE_TOOLS,
    allowed: [
      ...READ_ONLY_TOOLS,
      `Edit(${absoluteRule(fence.workFolder)}/**)`,
      // In quotes, as the run is told to write it: a folder may have a space in its name.
      `Bash("${fence.interpreter}" *)`,
    ],
    more: [
      '--add-dir',
      fence.workFolder,
      '--settings',
      JSON.stringify(fenceSettings(projectFolder, fence)),
      // Whatever would ask for a permission is refused: nobody is there to answer.
      '--permission-prompts',
      'none',
    ],
  }
}

/** How the run is told to compute: the fence refuses anything else, so it is said beforehand. */
export function fencePrompt(fence: Fence): string {
  return `

You can run calculations. To compute, write a Python script with the Write tool inside the work
folder \`${fence.workFolder}\`, then run it with one Bash command written exactly like this, the
double quotes included, with no variables, no \`cd\`, no pipes and no other command:
\`"${fence.interpreter}" "${fence.workFolder}/<script>.py"\`
- The interpreter has the standard library and openpyxl (Excel files). Nothing can be installed
  and there is no network.
- The script reads the files of the project by their absolute path and writes only in the work
  folder. The project cannot be written: never try, by any means.
- Any other command is refused. If a step is refused, do not look for another way: say what you
  could not compute.`
}

const fenceFailure = (detail: string): DomainErrorCode | null =>
  SANDBOX_HINT.test(detail) ? 'fence_unavailable' : null

/**
 * Runs Claude Code on the project with the fence up: it reads the project, computes with the
 * interpreter and writes only in the work folder. Refuses with `fence_unavailable` on a system
 * with no sandbox, and when the sandbox does not start: it never goes on without.
 */
export async function runFenced<Output>(
  config: ClaudeCliConfig,
  run: StructuredRun<Output>,
  fence: Fence,
  platform: NodeJS.Platform = process.platform,
): Promise<Output> {
  const launcher = config.fenceLauncher ?? config.launcher
  if (!FENCED_PLATFORMS.includes(platform) && !launcher) throw new DomainError('fence_unavailable')
  // The sandbox knows the folders by their real path: a link would be another place to it.
  const [projectFolder, workFolder, interpreter] = await Promise.all([
    realpath(run.projectFolder),
    realpath(fence.workFolder),
    realpath(dirname(fence.interpreter)).then(
      (folder) => join(folder, basename(fence.interpreter)),
      () => {
        throw new DomainError('fence_interpreter_missing')
      },
    ),
  ])
  // Inside WSL2 the fence is drawn on the folders as the distribution calls them.
  const seen = (path: string): string => launcher?.path(path) ?? path
  const real: Fence = { workFolder: seen(workFolder), interpreter: seen(interpreter) }
  return runStructured(
    launcher ? { ...config, launcher } : config,
    { ...run, projectFolder, systemPrompt: `${run.systemPrompt}${fencePrompt(real)}` },
    fenceGrant(seen(projectFolder), real),
    fenceFailure,
  )
}
