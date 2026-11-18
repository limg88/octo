import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import type { AgentProgress } from '@octo/application'
import { DomainError, type DomainErrorCode } from '@octo/domain'
import { type z, toJSONSchema as zodToJsonSchema } from 'zod'
import { parseStreamLine, type ResultEvent } from './stream-events.ts'

export type ClaudeCliConfig = {
  /** The Claude Code executable. */
  command: string
  /** Arguments placed before ours: lets a test run a script through Node. */
  prefixArgs?: string[]
  env: Record<string, string | undefined>
  askTimeoutMs?: number
  /** The interpreter Octo ships for calculations, as an absolute path; null when it has none. */
  interpreter?: string | null
}

/** One run of the agent: what it is told, what it reads from, the shape of what it gives back. */
export type StructuredRun<Output> = {
  projectFolder: string
  /** What the agent is asked, sent on standard input. */
  input: string
  systemPrompt: string
  schema: z.ZodType<Output>
  /** The model asked of the CLI; absent or null: its own default on this seat. */
  model?: string | null | undefined
  /** Told the model the run says it uses. */
  onModel?: ((model: string) => void) | undefined
  onProgress?: ((progress: AgentProgress) => void) | undefined
  signal?: AbortSignal | undefined
}

const DEFAULT_TIMEOUT_MS = 10 * 60 * 1000
const NOT_FOUND = 'ENOENT'
const SIGN_IN_HINT = /\/login|not logged in|invalid api key|authentication/i
/** What the CLI says when the PM's seat has no quota left for now. */
const LIMIT_HINT = /usage limit|rate limit|limit reached|quota/i
/** Variables of another Claude session or credential: the run must use the PM's own seat. */
const SESSION_OVERRIDE = /^(ANTHROPIC_|CLAUDE)/
/** Read-only tools: the agent can look at the whole project and change nothing. */
export const READ_ONLY_TOOLS = ['Read', 'Grep', 'Glob'] as const
const PROJECT_RULES_FILE = 'CLAUDE.md'
/** Rules longer than this are cut: they travel in the prompt of every run. */
const MAX_PROJECT_RULES_CHARS = 60_000

type RunOutput = { result: ResultEvent | null; exitCode: number | null; stderr: string }

export function seatEnvironment(env: Record<string, string | undefined>): Record<string, string> {
  const kept: Record<string, string> = {}
  for (const [name, value] of Object.entries(env)) {
    if (value !== undefined && !SESSION_OVERRIDE.test(name)) kept[name] = value
  }
  return kept
}

/** The rules the PM wrote for the project (its CLAUDE.md), or null when it has none. */
export async function projectRules(projectFolder: string): Promise<string | null> {
  try {
    const rules = await readFile(join(projectFolder, PROJECT_RULES_FILE), 'utf8')
    return rules.slice(0, MAX_PROJECT_RULES_CHARS)
  } catch {
    return null
  }
}

/** The CLI refuses a schema that names its dialect, so `$schema` is left out. */
function jsonSchemaOf(schema: z.ZodType): string {
  const { $schema: _dialect, ...body } = zodToJsonSchema(schema)
  return JSON.stringify(body)
}

/** What a run may use: its tools, the rules that allow them, and what else the CLI is told. */
export type RunGrant = { tools: readonly string[]; allowed: readonly string[]; more: string[] }

/** Read-only: the agent can look at the whole project and change nothing. */
const READ_ONLY_GRANT: RunGrant = { tools: READ_ONLY_TOOLS, allowed: READ_ONLY_TOOLS, more: [] }

function runArguments(
  systemPrompt: string,
  jsonSchema: string,
  model: string | null,
  grant: RunGrant,
): string[] {
  return [
    '-p',
    ...(model === null ? [] : ['--model', model]),
    '--output-format',
    'stream-json',
    '--verbose',
    '--json-schema',
    jsonSchema,
    '--tools',
    ...grant.tools,
    '--allowedTools',
    ...grant.allowed,
    ...grant.more,
    // File tools confined to the project folder; no settings, hooks or plugins from the PC.
    '--restricted',
    // No connectors: what is written comes from the project folder only.
    '--strict-mcp-config',
    '--append-system-prompt',
    systemPrompt,
  ]
}

/** Why a run gave nothing, as far as the CLI's own words tell. */
function failureCode(detail: string): DomainErrorCode {
  if (LIMIT_HINT.test(detail)) return 'agent_limit_reached'
  return SIGN_IN_HINT.test(detail) ? 'agent_not_signed_in' : 'agent_failed'
}

function isNotFound(error: unknown): boolean {
  return error instanceof Error && 'code' in error && error.code === NOT_FOUND
}

/**
 * Runs Claude Code, signed in with the PM's seat, in the project folder with read-only tools, and
 * returns what it gave in the shape asked. Failures are DomainErrors with an `agent_*` code.
 */
export async function runStructured<Output>(
  config: ClaudeCliConfig,
  run: StructuredRun<Output>,
  /** What the run may use; read-only tools unless a fence says more (see `runFenced`). */
  grant: RunGrant = READ_ONLY_GRANT,
  /** A reason of its own for a run that gave nothing, read in the CLI's words; else the usual. */
  failure: (detail: string) => DomainErrorCode | null = () => null,
): Promise<Output> {
  const args = [
    ...(config.prefixArgs ?? []),
    ...runArguments(run.systemPrompt, jsonSchemaOf(run.schema), run.model ?? null, grant),
  ]
  const timeout = AbortSignal.timeout(config.askTimeoutMs ?? DEFAULT_TIMEOUT_MS)
  const signal = run.signal ? AbortSignal.any([run.signal, timeout]) : timeout
  const output = await new Promise<RunOutput>((resolve, reject) => {
    const child = spawn(config.command, args, {
      cwd: run.projectFolder,
      env: seatEnvironment(config.env),
      signal,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    })
    let result: ResultEvent | null = null
    let stderr = ''
    createInterface({ input: child.stdout }).on('line', (line) => {
      const event = parseStreamLine(line, run.projectFolder)
      if (event.kind === 'result') result = event.result
      if (event.kind === 'model') run.onModel?.(event.model)
      if (event.kind !== 'progress') return
      for (const step of event.steps) run.onProgress?.(step)
    })
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8')
    })
    child.on('error', (error) => {
      if (isNotFound(error)) reject(new DomainError('agent_not_installed'))
      else if (run.signal?.aborted) reject(new DomainError('agent_cancelled'))
      else reject(new DomainError('agent_failed', error.message))
    })
    child.on('close', (exitCode) => resolve({ result, exitCode, stderr }))
    // The request travels on standard input: no quoting, on any system.
    child.stdin.end(run.input)
  })
  if (run.signal?.aborted) throw new DomainError('agent_cancelled')
  const { result } = output
  if (!result || result.is_error) {
    const detail = `${result?.result ?? ''}\n${output.stderr}`
    throw new DomainError(failure(detail) ?? failureCode(detail), `exit ${output.exitCode}`)
  }
  const parsed = run.schema.safeParse(result.structured_output)
  if (!parsed.success) throw new DomainError('agent_output_invalid')
  return parsed.data
}
