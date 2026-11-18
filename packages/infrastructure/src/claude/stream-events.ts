import { isAbsolute, relative } from 'node:path'
import type { AgentProgress } from '@octo/application'
import { z } from 'zod'

const toolUseSchema = z.object({
  type: z.literal('tool_use'),
  name: z.string(),
  input: z.record(z.string(), z.unknown()),
})

const assistantEventSchema = z.object({
  type: z.literal('assistant'),
  message: z.object({ content: z.array(z.unknown()) }),
})

const resultEventSchema = z.object({
  type: z.literal('result'),
  is_error: z.boolean(),
  result: z.string().optional(),
  structured_output: z.unknown().optional(),
})

const initEventSchema = z.object({
  type: z.literal('system'),
  subtype: z.literal('init'),
  model: z.string().min(1),
})

export type ResultEvent = z.infer<typeof resultEventSchema>

export type StreamEvent =
  | { kind: 'progress'; steps: AgentProgress[] }
  /** The first line of a run: which model it uses. */
  | { kind: 'model'; model: string }
  | { kind: 'result'; result: ResultEvent }
  | { kind: 'other' }

const STRUCTURED_OUTPUT_TOOL = 'StructuredOutput'

/** One line of `claude -p --output-format stream-json`. Lines we do not know are ignored. */
export function parseStreamLine(line: string, projectFolder: string): StreamEvent {
  const event = parseJson(line)
  const result = resultEventSchema.safeParse(event)
  if (result.success) return { kind: 'result', result: result.data }
  const started = initEventSchema.safeParse(event)
  if (started.success) return { kind: 'model', model: started.data.model }
  const assistant = assistantEventSchema.safeParse(event)
  if (!assistant.success) return { kind: 'other' }
  const steps = assistant.data.message.content.flatMap((block) => {
    const toolUse = toolUseSchema.safeParse(block)
    return toolUse.success ? progressOf(toolUse.data, projectFolder) : []
  })
  return steps.length > 0 ? { kind: 'progress', steps } : { kind: 'other' }
}

function parseJson(line: string): unknown {
  try {
    return JSON.parse(line)
  } catch {
    return null
  }
}

function progressOf(
  toolUse: z.infer<typeof toolUseSchema>,
  projectFolder: string,
): AgentProgress[] {
  const text = (key: string): string => {
    const value = toolUse.input[key]
    return typeof value === 'string' ? value : ''
  }
  switch (toolUse.name) {
    case 'Read':
      return [{ kind: 'reading', target: insideProject(text('file_path'), projectFolder) }]
    case 'Grep':
      return [{ kind: 'searching', target: text('pattern') }]
    case 'Glob':
      return [{ kind: 'listing', target: text('pattern') }]
    case 'Bash':
      return [{ kind: 'computing', target: '' }]
    case STRUCTURED_OUTPUT_TOOL:
      return [{ kind: 'writing', target: '' }]
    default:
      return []
  }
}

function insideProject(path: string, projectFolder: string): string {
  return isAbsolute(path) ? relative(projectFolder, path) : path
}
