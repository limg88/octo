// Writes into a project folder what the alignment of two trackers needs: an export of the
// client's tracker with the items of a sprint, and the tickets of the supplier's tracker as a
// feed of Octo would have written them, one file each. Where they are is already set; the
// sprint and the groups of states are typed in the demo.
// Usage: node demo/lib/fake-alignment.ts <project folder>
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderSyncFile } from '../../packages/connectors/src/folder/sync-file.ts'

const [project] = process.argv.slice(2)
if (!project) throw new Error('usage: fake-alignment.ts <project folder>')

const EXPORT = 'dati/tracker/sprint.json'
const TICKETS = 'dati/ticket'
const now = new Date()

const item = (id: number, title: string, state: string, extra: object = {}) => ({
  id,
  type: 'User Story',
  title,
  state,
  tags: 'Squadra',
  pi: 'PI7',
  sprint: 'Aurora\\Sprint 28',
  assigned_to: 'Mario Rossi',
  created_date: '2026-10-20T08:00:00Z',
  description: '',
  ...extra,
})
const items = [
  item(101, 'Esportazione degli ordini in Excel', 'In Progress'),
  item(102, 'Filtro per data nella lista ordini', 'In Progress', { tags: 'Squadra; AUR-7' }),
  item(103, 'Stampa della conferma d’ordine', 'Closed'),
  item(104, 'Notifica via mail al cambio di stato', 'In Progress'),
  item(105, 'Ricerca ordini per cliente', 'New'),
  item(106, 'Importazione del listino prezzi', 'New', {
    description: '<p>Il listino arriva in Excel.</p><ul><li>Una riga per articolo</li></ul>',
  }),
  item(201, 'Voce di un altro sprint', 'New', { sprint: 'Aurora\\Sprint 27' }),
  item(202, 'Voce di un’altra squadra', 'New', { tags: 'Altri' }),
]
mkdirSync(join(project, 'dati', 'tracker'), { recursive: true })
writeFileSync(
  join(project, EXPORT),
  JSON.stringify({ exported_at: now.toISOString(), item_count: items.length, items }, null, 1),
)

const tickets: Array<[string, string, string, string | null]> = [
  ['AUR-1', '[AZDO 101] Esportazione ordini in Excel', 'In corso', 'Sprint 28'],
  ['AUR-7', 'Filtro per data', 'Completata', 'Sprint 28'],
  ['AUR-3', '[AZDO 103] Stampa della conferma', 'Completata', 'Sprint 27'],
  ['AUR-4', '[AZDO 104] Notifica via mail', 'In corso', 'Sprint 28'],
  ['AUR-5', '[AZDO 104] Notifica al cambio di stato', 'Da completare', 'Sprint 28'],
  ['AUR-6', 'Importazione listino prezzi', 'Da completare', 'Sprint 28'],
  ['AUR-8', '[AZDO 999] Voce che il cliente non ha', 'In corso', 'Sprint 28'],
  ['AUR-9', 'Riunione di pianificazione', 'Completata', 'Sprint 28'],
]
mkdirSync(join(project, TICKETS), { recursive: true })
for (const [key, title, status, sprint] of tickets) {
  const record = {
    externalId: key,
    version: '1',
    title,
    originAt: now,
    url: null,
    people: [],
    record: { key, type: 'Story', status, sprint, sprints: sprint ? [sprint] : [], assignee: null },
  }
  writeFileSync(
    join(project, TICKETS, `${key.toLowerCase()}.md`),
    renderSyncFile({ system: 'jira', type: 'record', record, body: `# ${title}\n` }),
  )
}

const settings = join(project, '_octo', '.impostazioni')
mkdirSync(settings, { recursive: true })
writeFileSync(
  join(settings, 'alignment.json'),
  JSON.stringify({ exportPath: EXPORT, ticketFolder: TICKETS }, null, 1),
)
