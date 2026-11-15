import { spawn } from 'node:child_process'
import type { AgentRunner, AgentStatus } from '@octo/application'
import { askSystemPrompt, draftAnswerSchema } from './ask-prompt.ts'
import {
  type ClaudeCliConfig,
  projectRules,
  runStructured,
  seatEnvironment,
} from './structured-run.ts'

export type { ClaudeCliConfig } from './structured-run.ts'

const STATUS_TIMEOUT_MS = 15 * 1000

/** Answers a PM's question from the project folder, with Claude Code on the PM's seat. */
export function createClaudeCliRunner(config: ClaudeCliConfig): AgentRunner {
  const env = seatEnvironment(config.env)
  const prefix = config.prefixArgs ?? []

  async function status(): Promise<AgentStatus> {
    try {
      const version = await firstLine(config.command, [...prefix, '--version'], env)
      return { available: true, version }
    } catch {
      return { available: false, reason: 'not_installed' }
    }
  }

  return {
    status,
    ask: async (request) =>
      runStructured(config, {
        projectFolder: request.projectFolder,
        input: request.question,
        systemPrompt: askSystemPrompt(await projectRules(request.projectFolder)),
        schema: draftAnswerSchema,
        onProgress: request.onProgress,
        signal: request.signal,
        model: request.model,
        onModel: request.onModel,
      }),
  }
}

function firstLine(command: string, args: string[], env: Record<string, string>): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env,
      signal: AbortSignal.timeout(STATUS_TIMEOUT_MS),
      stdio: ['ignore', 'pipe', 'ignore'],
      windowsHide: true,
    })
    let stdout = ''
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8')
    })
    child.on('error', reject)
    child.on('close', (exitCode) => {
      const line = stdout.split('\n')[0]?.trim() ?? ''
      if (exitCode === 0 && line.length > 0) resolve(line)
      else reject(new Error(`exit ${exitCode}`))
    })
  })
}
