// Stands in for the Claude Code executable in tests. The question, read from standard input,
// chooses the behaviour; the events have the shape of `claude -p --output-format stream-json`.
import { join } from 'node:path'

const args = process.argv.slice(2)

if (args.includes('--version')) {
  console.log('9.9.9 (Fake Claude)')
  process.exit(0)
}

const emit = (event) => console.log(JSON.stringify(event))
const toolUse = (name, input) =>
  emit({ type: 'assistant', message: { content: [{ type: 'tool_use', name, input }] } })

let question = ''
for await (const chunk of process.stdin) question += chunk

const answer = {
  text: 'La consegna è il 12 dicembre [1].',
  citations: [{ n: 1, path: 'wiki/stato.md', quote: 'fissata al 12 dicembre 2026' }],
  missing: [],
}

// A run of the red team: it is told so in its system prompt, and reads the text on standard input.
if (args.join(' ').includes('You attack the content of a deliverable')) {
  const invented = question.includes('99.000')
  emit({
    type: 'result',
    is_error: false,
    structured_output: {
      verdict: invented ? 'fix_first' : 'deliverable',
      findings: invented
        ? [
            {
              severity: 'grave',
              finding: 'Il budget non ha una fonte',
              where: 'budget residuo è di 99.000 euro',
              why: 'Il cliente può chiedere da dove viene',
            },
          ]
        : [],
      holds: 'La data di consegna è sostenuta dalla fonte.',
    },
  })
  process.exit(0)
}

emit({ type: 'system', subtype: 'init' })
console.log('not json at all')

if (question.includes('#lento')) {
  await new Promise((resolve) => setTimeout(resolve, 60_000))
} else if (question.includes('#accesso')) {
  emit({ type: 'result', is_error: true, result: 'Invalid API key · Please run /login' })
  process.exit(1)
} else if (question.includes('#rotto')) {
  console.error('boom')
  process.exit(2)
} else if (question.includes('#forma')) {
  emit({ type: 'result', is_error: false, structured_output: { text: 42 } })
} else {
  toolUse('Grep', { pattern: 'consegna' })
  toolUse('Glob', { pattern: '**/*.md' })
  toolUse('Read', { file_path: join(process.cwd(), 'wiki', 'stato.md') })
  toolUse('Bash', { command: 'ignored' })
  toolUse('StructuredOutput', answer)
  if (question.includes('#inventa')) {
    answer.text += ' Il budget residuo è di 99.000 euro [2].'
    answer.citations.push({ n: 2, path: 'wiki/stato.md', quote: 'budget residuo di 99.000 euro' })
  }
  if (question.includes('#ambiente')) {
    answer.missing = Object.keys(process.env).filter((name) => /^(ANTHROPIC_|CLAUDE)/.test(name))
    answer.missing.push(`rules:${args.join(' ').includes('REGOLA-DI-PROVA')}`)
    answer.missing.push(
      `args:${args.includes('--restricted') && args.includes('--strict-mcp-config')}`,
    )
  }
  emit({ type: 'result', is_error: false, result: 'ok', structured_output: answer })
}
