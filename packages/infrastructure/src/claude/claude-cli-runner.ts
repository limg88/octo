import { spawn } from 'node:child_process'
import { createInterface } from 'node:readline'
import type { AgentRunner, AgentStatus, AskRequest } from '@octo/application'
import { DomainError, type DraftAnswer } from '@octo/domain'
import {
  ASK_SYSTEM_PROMPT,
  DRAFT_ANSWER_JSON_SCHEMA,
  draftAnswerSchema,
  READ_ONLY_TOOLS,
} from './ask-prompt.ts'
import { parseStreamLine, type ResultEvent } from './stream-events.ts'

export type ClaudeCliConfig = {
  /** The Claude Code executable. */
  command: string
  /** Arguments placed before ours: lets a test run a script through Node. */
  prefixArgs?: string[]
  env: Record<string, string | undefined>
  askTimeoutMs?: number
}

const DEFAULT_ASK_TIMEOUT_MS = 10 * 60 * 1000
const STATUS_TIMEOUT_MS = 15 * 1000
const NOT_FOUND = 'ENOENT'
const SIGN_IN_HINT = /\/login|not logged in|invalid api key|authentication/i
/** Variables of another Claude session or credential: the run must use the PM's own seat. */
const SESSION_OVERRIDE = /^(ANTHROPIC_|CLAUDE)/

type RunOutput = { result: ResultEvent | null; exitCode: number | null; stderr: string }

/** Runs Claude Code, signed in with the PM's seat, in the project folder with read-only tools. */
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

  async function ask(request: AskRequest): Promise<DraftAnswer> {
    const output = await run(request)
    if (request.signal?.aborted) throw new DomainError('agent_cancelled')
    return draftFrom(output)
  }

  function run(request: AskRequest): Promise<RunOutput> {
    const args = [...prefix, ...askArguments()]
    const timeout = AbortSignal.timeout(config.askTimeoutMs ?? DEFAULT_ASK_TIMEOUT_MS)
    const signal = request.signal ? AbortSignal.any([request.signal, timeout]) : timeout
    return new Promise((resolve, reject) => {
      const child = spawn(config.command, args, {
        cwd: request.projectFolder,
        env,
        signal,
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
      })
      let result: ResultEvent | null = null
      let stderr = ''
      createInterface({ input: child.stdout }).on('line', (line) => {
        const event = parseStreamLine(line, request.projectFolder)
        if (event.kind === 'result') result = event.result
        if (event.kind !== 'progress') return
        for (const step of event.steps) request.onProgress?.(step)
      })
      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString('utf8')
      })
      child.on('error', (error) => {
        if (isNotFound(error)) reject(new DomainError('agent_not_installed'))
        else if (request.signal?.aborted) reject(new DomainError('agent_cancelled'))
        else reject(new DomainError('agent_failed', error.message))
      })
      child.on('close', (exitCode) => resolve({ result, exitCode, stderr }))
      // The question travels on standard input: no quoting, on any system.
      child.stdin.end(request.question)
    })
  }

  return { status, ask }
}

function askArguments(): string[] {
  return [
    '-p',
    '--output-format',
    'stream-json',
    '--verbose',
    '--json-schema',
    DRAFT_ANSWER_JSON_SCHEMA,
    '--tools',
    ...READ_ONLY_TOOLS,
    '--allowedTools',
    ...READ_ONLY_TOOLS,
    // File tools confined to the project folder; no settings, hooks or plugins from the PC.
    '--restricted',
    // No connectors: an answer comes from the project folder only.
    '--strict-mcp-config',
    '--append-system-prompt',
    ASK_SYSTEM_PROMPT,
  ]
}

function draftFrom(output: RunOutput): DraftAnswer {
  const { result } = output
  if (!result || result.is_error) {
    const detail = result?.result ?? output.stderr
    const code = SIGN_IN_HINT.test(detail) ? 'agent_not_signed_in' : 'agent_failed'
    throw new DomainError(code, `exit ${output.exitCode}`)
  }
  const draft = draftAnswerSchema.safeParse(result.structured_output)
  if (!draft.success) throw new DomainError('agent_output_invalid')
  return draft.data
}

function seatEnvironment(env: Record<string, string | undefined>): Record<string, string> {
  const kept: Record<string, string> = {}
  for (const [name, value] of Object.entries(env)) {
    if (value !== undefined && !SESSION_OVERRIDE.test(name)) kept[name] = value
  }
  return kept
}

function isNotFound(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === NOT_FOUND
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
