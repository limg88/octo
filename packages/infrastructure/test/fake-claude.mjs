// Stands in for the Claude Code executable in tests. The question, read from standard input,
// chooses the behaviour; the events have the shape of `claude -p --output-format stream-json`.
import { readdirSync, readFileSync } from 'node:fs'
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

// As the real one: the model asked with --model, or the default of the seat.
const asked = args.indexOf('--model')
emit({
  type: 'system',
  subtype: 'init',
  model: asked < 0 ? 'claude-fake-default' : `claude-${args[asked + 1]}-fake`,
})

const WORDS_QUOTED = 60

/** What the author of a mail of the memory wrote: the first line after its header and title. */
function firstLineOf(path) {
  try {
    const lines = readFileSync(join(process.cwd(), path), 'utf8').split('\n')
    const body = lines.slice(lines.indexOf('---', 1) + 1)
    const line = body.find((candidate) => candidate.trim() !== '' && !candidate.startsWith('#'))
    return (line ?? '').trim().slice(0, WORDS_QUOTED).trim()
  } catch {
    return ''
  }
}

/**
 * Whom the first line of a mail asks: the whole group, another person named before a comma, or
 * the Project Manager.
 */
function addresseeOf(line, pmName) {
  if (/\b(a tutti|tutti|all|team)\b/i.test(line))
    return { addressee: 'everyone', addresseeName: null }
  const named = /^(?:ciao |buongiorno |gentile )?([A-ZÀ-Ý][a-zà-ÿ]+),/.exec(line)?.[1]
  const own = (pmName ?? '').split(/\s+/).some((part) => part !== '' && part === named)
  if (named && !own) return { addressee: 'someone_else', addresseeName: named }
  return { addressee: 'me', addresseeName: null }
}

/** A mail that only thanks, confirms or informs asks nothing of who reads it. */
const ASKS_NOTHING = /\b(grazie|per conoscenza|vi informo|confermo che|ricevuto)\b/i

// A run of the judge of the mail: every mail given is weighed, with words copied from its file.
if (args.join(' ').includes('You read the mail a Project Manager is written to')) {
  const { mails, pm } = JSON.parse(question)
  emit({
    type: 'result',
    is_error: false,
    structured_output: {
      mails: mails.map((mail) => {
        const money = /budget|ordine|fattur/i.test(mail.subject)
        const quote = firstLineOf(mail.path)
        const asksAction = !ASKS_NOTHING.test(quote)
        return {
          id: mail.id,
          importance: !asksAction ? 'bassa' : money ? 'alta' : 'media',
          reason: !asksAction
            ? 'Ringrazia o informa: non chiede nulla.'
            : money
              ? 'Riguarda il budget del progetto: va confermato al cliente.'
              : 'Chiede una risposta, ma nulla si ferma nel frattempo.',
          quote,
          deadline: null,
          ...addresseeOf(quote, pm?.name ?? null),
          asksAction,
        }
      }),
    },
  })
  process.exit(0)
}

// A run of the judge of what comes first: a sentence for each signal, with words of a file. A
// mail is backed by its own first line, anything else by the state of the project when there.
if (args.join(' ').includes('A Project Manager opens the page of the day of one project')) {
  const { items } = JSON.parse(question)
  const WHY = {
    meeting_soon:
      'Alla riunione si decide la data del collaudo: conviene arrivarci con lo stato aggiornato.',
    due: 'La consegna è vicina: chiudere oggi evita di portarsi dietro numeri non allineati.',
    later: 'L’avevi rimandata a oggi e la consegna si avvicina.',
    important_mail: 'Il cliente aspetta una conferma sul budget del progetto.',
    worse: 'È peggiorata e la consegna si avvicina.',
  }
  emit({
    type: 'result',
    is_error: false,
    structured_output: {
      sentences: items.map((item) => {
        const mail = item.facts.kind === 'mail_reply' ? item.facts.path : null
        return {
          key: item.key,
          text: WHY[item.rule],
          path: mail ?? 'wiki/stato.md',
          quote: mail ? firstLineOf(mail) : 'fissata al 12 dicembre 2026',
        }
      }),
    },
  })
  process.exit(0)
}

// A run of the judge of the risks: one risk, with its source in the project.
if (args.join(' ').includes('You look for the risks of one project')) {
  const { alreadyInTheRegister } = JSON.parse(question)
  const title = 'La consegna del modulo ordini è a ridosso del collaudo'
  emit({
    type: 'result',
    is_error: false,
    structured_output: {
      risks: alreadyInTheRegister.includes(title)
        ? []
        : [
            {
              title,
              why: 'Fra la consegna e il collaudo restano pochi giorni: un ritardo sulla consegna sposta il collaudo.',
              path: 'wiki/stato.md',
              quote: 'fissata al 12 dicembre 2026',
            },
          ],
    },
  })
  process.exit(0)
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

// A run of a writer given the outline of a model deck: the same slides, for the period asked.
const outlined = /<deck_outline>\n([\s\S]*?)\n<\/deck_outline>/.exec(args.join(' '))
if (outlined) {
  const outline = JSON.parse(outlined[1])
  emit({
    type: 'result',
    is_error: false,
    structured_output: {
      deck: {
        slides: outline.slides.map((slide) => ({
          slide: slide.slide,
          // The model's last slide of content has nothing for this period.
          skip: slide.texts.some((text) => text.text.startsWith('Rischi')),
          texts: slide.texts.map((text) => ({
            id: text.id,
            text: text.text.replace('del periodo scorso', 'dello Sprint 28').replace('PI6', 'PI7'),
          })),
          tables: slide.tables.map((table) => ({
            id: table.id,
            columns: table.columns,
            rows: [
              ['Modulo ordini: consegna fissata al 12 dicembre 2026 [1]', 'In corso'].slice(
                0,
                table.columns.length,
              ),
            ],
          })),
        })),
      },
      citations: [{ n: 1, path: 'wiki/stato.md', quote: 'fissata al 12 dicembre 2026' }],
      missing: ['Rischi del periodo: nessuna fonte li elenca.'],
    },
  })
  process.exit(0)
}

// A run of a writer given the Word template of the kind: its sections, in its order.
const sectioned = /<template_sections>\n([\s\S]*?)\n<\/template_sections>/.exec(args.join(' '))
if (sectioned) {
  const headings = sectioned[1].split('\n')
  emit({
    type: 'result',
    is_error: false,
    structured_output: {
      text: headings
        .map((heading, at) =>
          at === 0
            ? `${heading}\n\nLa consegna del modulo ordini è fissata al 12 dicembre 2026 [1].`
            : `${heading}\n\nNessuna fonte del progetto lo dice.`,
        )
        .join('\n\n'),
      citations: [{ n: 1, path: 'wiki/stato.md', quote: 'fissata al 12 dicembre 2026' }],
      missing: headings.slice(1).map((heading) => heading.replace(/^#+\s*/, '')),
    },
  })
  process.exit(0)
}

// A question that continues a conversation: the answer says what it takes up.
const earlier =
  /<earlier_in_this_conversation>[\s\S]*?Question: ([^\n]*)[\s\S]*<\/earlier_in_this_conversation>/.exec(
    question,
  )
if (earlier && !question.includes('#')) {
  emit({
    type: 'result',
    is_error: false,
    structured_output: {
      text: `Riprendo dalla domanda «${earlier[1]}»: la consegna resta fissata al 12 dicembre 2026 [1].`,
      citations: [{ n: 1, path: 'wiki/stato.md', quote: 'fissata al 12 dicembre 2026' }],
      missing: [],
    },
  })
  process.exit(0)
}

// A run of the writer of a status report: sections with headings, some lines and tables.
if (args.join(' ').includes('Write the status report of the period')) {
  emit({
    type: 'result',
    is_error: false,
    structured_output: {
      text: [
        '# Stato di avanzamento — Aurora',
        '## Periodo e sintesi',
        'Il periodo si chiude **in linea** con il piano: la consegna del modulo ordini resta fissata al 12 dicembre 2026 [1].',
        '## Avanzamento per obiettivo',
        '| Obiettivo | Stato | Prossima scadenza |\n|---|---|---|\n| Modulo ordini | In corso | 12 dicembre 2026 |\n| Integrazione magazzino | Da avviare | Da pianificare |',
        '## Prossimi passi',
        '- Collaudo del modulo ordini con il cliente\n- Pianificazione dell’integrazione con il magazzino',
        '## Rischi e blocchi',
        '| Rischio | Responsabile |\n|---|---|\n| Ambiente di prova non ancora disponibile | Cliente |',
        '## Decisioni richieste',
        '1. Conferma della data di collaudo, entro il 20 novembre 2026',
      ].join('\n\n'),
      citations: [{ n: 1, path: 'wiki/stato.md', quote: 'fissata al 12 dicembre 2026' }],
      missing: [],
    },
  })
  process.exit(0)
}

// A run of the writer of release notes: what changes for who uses the system.
if (args.join(' ').includes('Write the release notes')) {
  emit({
    type: 'result',
    is_error: false,
    structured_output: {
      text: [
        '## Rilascio',
        'Il rilascio porta il modulo ordini, la cui consegna è fissata al 12 dicembre 2026 [1].',
        '## Novità',
        '- Gestione degli ordini dal nuovo modulo',
        '## Problemi noti',
        '- Nessuno segnalato nelle fonti del progetto',
      ].join('\n\n'),
      citations: [{ n: 1, path: 'wiki/stato.md', quote: 'fissata al 12 dicembre 2026' }],
      missing: ['Elenco delle voci chiuse per questo rilascio'],
    },
  })
  process.exit(0)
}

// A run of the writer of an estimate: it gives the lines, never the totals.
if (args.join(' ').includes('Write an estimate of effort in days')) {
  emit({
    type: 'result',
    is_error: false,
    structured_output: {
      text: '## Perimetro\n\nMigrazione del modulo ordini [1].\n\n## Stima\n\n{{STIMA}}\n\n## Domande aperte\n\n- Chi fa il collaudo?',
      citations: [{ n: 1, path: 'wiki/stato.md', quote: 'fissata al 12 dicembre 2026' }],
      missing: ['Numero di requisiti da migrare'],
      wbs: [
        {
          id: 'W-01',
          fase: 'Analisi',
          attivita: 'Allineamento con il cliente',
          driver: 'Una riunione [1]',
          ruolo: 'PM',
          ott: 1,
          prob: 2,
          pess: 3,
          stato: 'parziale',
        },
        {
          id: 'W-02',
          fase: 'Sviluppo',
          attivita: 'Migrazione',
          driver: 'Modulo ordini [1]',
          ruolo: 'Dev',
          ott: 4,
          prob: 6,
          pess: 14,
          stato: 'mancante',
        },
        {
          id: 'W-03',
          fase: 'Sviluppo',
          attivita: 'Riga sbagliata',
          driver: 'Niente',
          ruolo: 'Dev',
          ott: 5,
          prob: 3,
          pess: 9,
          stato: 'completo',
        },
      ],
    },
  })
  process.exit(0)
}

const MEETINGS_FOLDER = '_octo/riunioni'

/**
 * The first passage of the transcript of a meeting of the memory: the one whose folder the
 * request names or, for a question marked `#riunione`, the first the project holds.
 */
function meetingPassage(request) {
  try {
    const named = /_octo\/riunioni\/([^\s"/]+)/.exec(request)?.[1]
    const folder =
      named ??
      (request.includes('#riunione')
        ? readdirSync(join(process.cwd(), MEETINGS_FOLDER)).find((name) => !name.startsWith('_'))
        : undefined)
    if (!folder) return null
    const path = `${MEETINGS_FOLDER}/${folder}/transcript.md`
    const said = /\*\*: (.+)/.exec(readFileSync(join(process.cwd(), path), 'utf8'))?.[1]
    return said ? { path, quote: said.trim() } : null
  } catch {
    return null
  }
}

console.log('not json at all')

if (question.includes('#lento')) {
  await new Promise((resolve) => setTimeout(resolve, 60_000))
} else if (question.includes('#accesso')) {
  emit({ type: 'result', is_error: true, result: 'Invalid API key · Please run /login' })
  process.exit(1)
} else if (question.includes('#limite')) {
  emit({ type: 'result', is_error: true, result: 'Claude usage limit reached. Resets at 3pm.' })
  process.exit(1)
} else if (question.includes('#rotto')) {
  console.error('boom')
  process.exit(2)
} else if (question.includes('#forma')) {
  emit({ type: 'result', is_error: false, structured_output: { text: 42 } })
} else {
  const passage = meetingPassage(question)
  if (passage) {
    answer.text = `In riunione è stato detto: «${passage.quote}» [1].`
    answer.citations = [{ n: 1, ...passage }]
  }
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
