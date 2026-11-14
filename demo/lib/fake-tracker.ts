// Writes a synthetic tracker export and its history into a project folder, as a script of the
// team would: bugs opened over the last eight months and a few stories, dated back from today.
// Usage: node demo/lib/fake-tracker.ts <project folder> [old]
// `old` dates the export five days ago, as if nobody had refreshed it.
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const [project, old] = process.argv.slice(2)
if (!project) throw new Error('usage: fake-tracker.ts <project folder> [old]')

const DAY_MS = 24 * 60 * 60 * 1000
const STALE_DAYS = 5
const exportedAt = new Date(Date.now() - (old ? STALE_DAYS * DAY_MS : 0))
const daysAgo = (days: number) => new Date(exportedAt.getTime() - days * DAY_MS).toISOString()

const BUGS = 36
const DAYS_BETWEEN_BUGS = 6
const TITLES = [
  'Totale ordine sbagliato dopo lo sconto',
  'La ricerca clienti ignora gli accenti',
  'Il PDF della conferma esce senza logo',
  'Errore al salvataggio di un ordine vuoto',
  'La data di consegna torna a ieri',
  'Il filtro per stato perde la selezione',
]
const PEOPLE = ['Luca Verdi', 'Sara Neri', null]
/** The way of a bug, as days after its creation at which it enters each state. */
const WAY: Array<[number, string]> = [
  [0, '02 - To Do'],
  [3, '04 - In Progress'],
  [12, '06 - Ready for Test'],
  [19, '10 - Validated'],
  [40, '12b - Closed'],
]
/** How far along its way a bug got: every fourth is still in progress, every fifth waits a test. */
const stepsOf = (index: number, age: number): number => {
  const reached = WAY.filter(([after]) => after <= age).length
  if (index % 4 === 0) return Math.min(reached, 2)
  if (index % 5 === 0) return Math.min(reached, 3)
  return reached
}

const items: unknown[] = []
const history: Record<string, unknown> = {}
for (let index = 0; index < BUGS; index += 1) {
  const id = 1000 + index
  const age = 2 + index * DAYS_BETWEEN_BUGS
  const states = WAY.slice(0, stepsOf(index, age)).map(([after, state]) => [
    daysAgo(age - after),
    state,
  ])
  const last = states.at(-1) ?? [daysAgo(age), '02 - To Do']
  const tags = index % 6 === 5 ? ['Altro fornitore'] : ['Squadra']
  items.push({
    id,
    type: 'Bug',
    title: `${TITLES[index % TITLES.length]} (${id})`,
    state: last[1],
    tags,
    assigned_to: PEOPLE[index % PEOPLE.length],
    created_date: daysAgo(age),
    state_change_date: last[0],
    severity: index % 3 === 0 ? '2 - High' : '3 - Medium',
    discussion:
      index % 4 === 0
        ? [{ by: 'Sara Neri', date: daysAgo(1), text: 'In attesa dei dati di prova dal cliente.' }]
        : [],
  })
  history[String(id)] = { created: daysAgo(age), states, tags: [[daysAgo(age), tags.join('; ')]] }
}

const LONG =
  'Chi gestisce gli ordini vuole vedere il dettaglio completo di ogni riga, con prezzi e sconti applicati, per rispondere al cliente senza aprire altri sistemi.'
const story = (id: number, title: string, state: string, pi: string, extra: object = {}) => ({
  id,
  type: 'User Story',
  title,
  state,
  tags: ['Squadra'],
  pi,
  created_date: daysAgo(30),
  state_change_date: daysAgo(10),
  description: LONG,
  acceptance_criteria:
    'Dato un ordine con sconto, il dettaglio mostra prezzo pieno, sconto e totale.',
  discussion: [],
  ...extra,
})
items.push(
  story(2001, 'Dettaglio delle righe d’ordine', 'To Do', 'R2'),
  story(2002, 'Esportazione in Excel', 'New', 'R2', {
    acceptance_criteria: '',
    discussion: [
      {
        by: 'Luca Verdi',
        date: daysAgo(4),
        text: 'Il formato delle colonne è ancora da definire con il cliente.',
      },
    ],
  }),
  story(2003, 'Notifica al magazzino', 'On Hold', 'R2'),
  story(2004, 'Storico delle modifiche', 'To Do', 'R2', { description: 'Storico.' }),
  story(2005, 'Ricerca per codice articolo', 'Closed', 'R1', { acceptance_criteria: '' }),
  story(2006, 'Stampa etichette', 'New', 'R1'),
)

const folder = join(project, 'dati', 'tracker')
mkdirSync(folder, { recursive: true })
writeFileSync(
  join(folder, 'export.json'),
  JSON.stringify(
    { exported_at: exportedAt.toISOString(), item_count: items.length, items },
    null,
    1,
  ),
)
writeFileSync(
  join(folder, 'cronologia.json'),
  JSON.stringify({ exported_at: exportedAt.toISOString(), count: BUGS, bugs: history }, null, 1),
)
