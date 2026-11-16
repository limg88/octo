// A fake Azure DevOps for the demos of the dashboard: the project «Aurora» with four sprints,
// stories in every stage, bugs of every severity with their history, and comments that ask
// something nobody answered. It also writes what a PM sets once: the source, its token, the
// people of the two sides and the calendar with the sprints.
// Usage: node demo/lib/fake-ado-cruscotto.ts <project folder> <app data folder>
//        (prints its address and keeps running; SIGUSR1 opens one more critical bug)
// The token it accepts is `demo-pat`.
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  type FakeWorkItem,
  startFakeAdo,
  workItem,
} from '../../packages/connectors/test/support/fake-ado.ts'

const [project, dataFolder] = process.argv.slice(2)
if (!project || !dataFolder) {
  throw new Error('usage: fake-ado-cruscotto.ts <project folder> <app data folder>')
}

const ADO = { organization: 'contoso', project: 'Aurora', pat: 'demo-pat' }
const PROJECT_ID = 'demo-aurora'
const PI = 'PI7'
const DAY_MS = 24 * 60 * 60 * 1000
const now = Date.now()
const daysAgo = (days: number): string => new Date(now - days * DAY_MS).toISOString()
const dayOf = (offset: number): string => new Date(now + offset * DAY_MS).toISOString().slice(0, 10)

const person = (displayName: string) => ({
  displayName,
  uniqueName: `${displayName.toLowerCase().replace(' ', '.')}@example.test`,
})
const MARIO = 'Mario Rossi'
const ANNA = 'Anna Bianchi'
const CARLA = 'Carla Neri'
const LUCA = 'Luca Galli'

type Change = [daysAgo: number, state: string]
type Comment = [daysAgo: number, by: string, text: string]
type Spec = {
  id: number
  type: 'User Story' | 'Bug'
  title: string
  sprint: string | null
  /** The states it went through, oldest first; the last one is the present. */
  states: Change[]
  assignee?: string | null
  severity?: string
  description?: string
  criteria?: string
  comments?: Comment[]
}

const LONG =
  'Come addetto agli ordini voglio completare l’operazione senza uscire dalla pagina, con i dati già compilati dal sistema.'
const CRITERIA = 'Dato un ordine valido, quando confermo, allora ricevo l’esito entro due secondi.'

function item(spec: Spec): FakeWorkItem {
  const first = spec.states[0] as Change
  const last = spec.states.at(-1) as Change
  const built = workItem(spec.id, {
    area: ADO.project,
    iteration: spec.sprint ? `${ADO.project}\\${PI}\\${spec.sprint}` : ADO.project,
    changedAt: daysAgo(last[0]),
    createdAt: daysAgo(first[0]),
    title: spec.title,
    state: last[1],
    type: spec.type,
    tags: 'Squadra',
    assignedTo: spec.assignee ? person(spec.assignee) : null,
    description: spec.description ?? LONG,
  })
  built.fields['Microsoft.VSTS.Common.StateChangeDate'] = daysAgo(last[0])
  built.fields['Microsoft.VSTS.Common.AcceptanceCriteria'] = spec.criteria ?? CRITERIA
  if (spec.severity) built.fields['Microsoft.VSTS.Common.Severity'] = spec.severity
  built.updates = spec.states.map(([days, state], index) => ({
    fields: {
      'System.ChangedDate': { newValue: daysAgo(days) },
      'System.State': { newValue: state },
      ...(index === 0
        ? {
            'System.CreatedDate': { newValue: daysAgo(days) },
            'System.Tags': { newValue: 'Squadra' },
          }
        : {}),
    },
  }))
  const comments = spec.comments ?? []
  built.fields['System.CommentCount'] = comments.length
  built.comments = comments.map(([days, by, text]) => ({
    createdBy: { displayName: by },
    createdDate: daysAgo(days),
    text: `<div>${text}</div>`,
  }))
  return built
}

const story = (spec: Omit<Spec, 'type'>): FakeWorkItem => item({ ...spec, type: 'User Story' })
const bug = (spec: Omit<Spec, 'type'>): FakeWorkItem => item({ ...spec, type: 'Bug' })

const ITEMS: FakeWorkItem[] = [
  // The sprint before the last: all closed in time.
  story({
    id: 181,
    title: 'Accesso con le credenziali aziendali',
    sprint: 'Sprint 26',
    states: [
      [45, 'New'],
      [40, 'Active'],
      [31, 'Closed'],
    ],
  }),
  story({
    id: 182,
    title: 'Elenco ordini',
    sprint: 'Sprint 26',
    states: [
      [45, 'New'],
      [39, 'Active'],
      [30, 'Closed'],
    ],
  }),
  // The last sprint: two closed in time, one closed late, one still being worked on.
  story({
    id: 191,
    title: 'Dettaglio ordine',
    sprint: 'Sprint 27',
    states: [
      [30, 'New'],
      [26, 'Active'],
      [16, 'Closed'],
    ],
  }),
  story({
    id: 192,
    title: 'Filtri dell’elenco ordini',
    sprint: 'Sprint 27',
    states: [
      [30, 'New'],
      [25, 'Active'],
      [15, 'Closed'],
    ],
  }),
  story({
    id: 193,
    title: 'Stampa dell’ordine',
    sprint: 'Sprint 27',
    states: [
      [30, 'New'],
      [24, 'Active'],
      [9, 'Closed'],
    ],
  }),
  story({
    id: 194,
    title: 'Allegati dell’ordine',
    sprint: 'Sprint 27',
    assignee: MARIO,
    states: [
      [30, 'New'],
      [22, 'Active'],
    ],
  }),
  // The running sprint, which ends tomorrow.
  story({
    id: 201,
    title: 'Modulo ordini: invio conferma via mail',
    sprint: 'Sprint 28',
    assignee: MARIO,
    states: [
      [14, 'New'],
      [6, 'Active'],
    ],
  }),
  story({
    id: 202,
    title: 'Modulo ordini: export in PDF',
    sprint: 'Sprint 28',
    assignee: CARLA,
    states: [[14, 'New']],
    comments: [
      [9, CARLA, 'Il PDF serve per l’archivio fiscale.'],
      [5, MARIO, 'Grazie Carla. Quale formato serve per la data nel PDF, quello italiano o ISO?'],
    ],
  }),
  story({
    id: 203,
    title: 'Anagrafica clienti: ricerca per partita IVA',
    sprint: 'Sprint 28',
    assignee: ANNA,
    states: [
      [14, 'New'],
      [10, 'Active'],
      [2, 'Resolved'],
    ],
  }),
  story({
    id: 204,
    title: 'Riepilogo dell’ordine',
    sprint: 'Sprint 28',
    assignee: MARIO,
    states: [
      [14, 'New'],
      [11, 'Active'],
      [4, 'Closed'],
    ],
  }),
  story({
    id: 205,
    title: 'Storico degli ordini',
    sprint: 'Sprint 28',
    assignee: ANNA,
    states: [
      [14, 'New'],
      [12, 'Active'],
      [3, 'Closed'],
    ],
  }),
  // The next sprint: what is about to be planned, and is asked whether it is clear.
  story({
    id: 211,
    title: 'Resi: richiesta dal portale',
    sprint: 'Sprint 29',
    states: [[8, 'New']],
    description: 'Da fare.',
    criteria: '',
  }),
  story({
    id: 212,
    title: 'Resi: etichetta di spedizione',
    sprint: 'Sprint 29',
    states: [[8, 'New']],
    description: `${LONG} Il corriere è ancora da definire con il cliente.`,
  }),
  story({ id: 213, title: 'Resi: rimborso', sprint: 'Sprint 29', states: [[8, 'Active']] }),
  // The backlog nobody is planning yet: vague, and for now nobody is told.
  story({
    id: 221,
    title: 'Notifiche push',
    sprint: null,
    states: [[20, 'New']],
    description: '',
    criteria: '',
  }),
  story({
    id: 222,
    title: 'Tema scuro',
    sprint: null,
    states: [[20, 'New']],
    description: '',
    criteria: '',
  }),

  bug({
    id: 301,
    title: 'Errore nel calcolo dell’IVA',
    sprint: 'Sprint 28',
    assignee: MARIO,
    severity: '1 - Critical',
    states: [
      [60, 'New'],
      [45, 'Active'],
    ],
  }),
  bug({
    id: 302,
    title: 'Totale ordine arrotondato male',
    sprint: 'Sprint 28',
    assignee: ANNA,
    severity: '2 - High',
    states: [
      [25, 'New'],
      [20, 'Active'],
      [3, 'Ready for Test'],
    ],
    comments: [[3, ANNA, 'Corretto e rilasciato in test.']],
  }),
  bug({
    id: 303,
    title: 'Etichetta tagliata nel riepilogo',
    sprint: 'Sprint 27',
    assignee: null,
    severity: '3 - Medium',
    // Opened well before any period of eight weeks starts: it is there at the start of it.
    states: [
      [75, 'New'],
      [38, 'Active'],
    ],
    comments: [[4, CARLA, 'Potete confermare se la correzione è prevista per questo sprint?']],
  }),
  bug({
    id: 304,
    title: 'PDF dell’ordine senza logo',
    sprint: 'Sprint 28',
    assignee: MARIO,
    severity: '2 - High',
    states: [
      [18, 'New'],
      [12, 'Active'],
    ],
    comments: [[6, MARIO, 'Luca Galli, ci serve il logo in formato vettoriale: puoi mandarlo?']],
  }),
  bug({
    id: 305,
    title: 'Refuso nella mail di conferma',
    sprint: 'Sprint 27',
    assignee: ANNA,
    severity: '4 - Low',
    states: [
      [40, 'New'],
      [35, 'Active'],
      [28, 'Resolved'],
      [20, 'Validated'],
    ],
  }),
  bug({
    id: 306,
    title: 'Ordine duplicato al doppio clic',
    sprint: 'Sprint 27',
    assignee: MARIO,
    severity: '2 - High',
    states: [
      [33, 'New'],
      [30, 'Active'],
      [24, 'Resolved'],
      [19, 'Validated'],
      [17, 'Closed'],
    ],
  }),
  bug({
    id: 307,
    title: 'Ricerca che ignora gli accenti',
    sprint: 'Sprint 28',
    assignee: ANNA,
    severity: '3 - Medium',
    states: [[2, 'New']],
  }),
]

/** What somebody opens while the PM is looking elsewhere: the periodic reading finds it. */
const lateBug = (): FakeWorkItem =>
  bug({
    id: 399,
    title: 'Pagamento rifiutato senza messaggio',
    sprint: 'Sprint 28',
    assignee: MARIO,
    severity: '1 - Critical',
    states: [[0, 'New']],
  })

const settings = join(project, '_octo', '.impostazioni')
mkdirSync(settings, { recursive: true })
mkdirSync(dataFolder, { recursive: true })
const write = (file: string, value: unknown) => writeFileSync(file, JSON.stringify(value, null, 1))

write(join(settings, 'sources.json'), {
  mail: null,
  ado: {
    organization: ADO.organization,
    project: ADO.project,
    areas: [],
    since: dayOf(-90),
    targetFolder: 'Fonti/Azure DevOps',
  },
  jira: null,
  confluence: null,
  dwsi: null,
})
// Demo only: the token is kept in clear, as `OCTO_DEMO_PLAIN_SECRETS=1` reads it back.
write(join(dataFolder, 'secrets.json'), {
  [`${PROJECT_ID}/ado`]: Buffer.from(ADO.pat).toString('base64'),
})
const member = (name: string, role: string, side: 'supplier' | 'client') => ({
  name,
  role,
  side,
  from: '',
  to: '',
  allocation: null,
  note: '',
})
write(join(settings, 'team.json'), {
  people: [
    member('Paola Verdi', 'Project manager', 'supplier'),
    member(MARIO, 'Sviluppo', 'supplier'),
    member(ANNA, 'Test', 'supplier'),
    member(CARLA, 'Referente del cliente', 'client'),
    member(LUCA, 'Comunicazione del cliente', 'client'),
  ],
  periods: [
    { name: 'Sprint 26', from: dayOf(-41), to: dayOf(-28) },
    { name: 'Sprint 27', from: dayOf(-27), to: dayOf(-14) },
    // The running sprint ends tomorrow: what is not in verification is at risk.
    { name: 'Sprint 28', from: dayOf(-13), to: dayOf(1) },
    { name: 'Sprint 29', from: dayOf(2), to: dayOf(15) },
  ],
})
write(join(settings, 'dashboard.json'), { tags: ['Squadra'], stuckDays: 30 })

const fake = await startFakeAdo({
  organization: ADO.organization,
  projectId: '6ce954b1-ce1f-45d1-b94d-e6bf2464ba2c',
  projectName: ADO.project,
  pat: ADO.pat,
  areas: [{ name: 'Team A' }],
  iterations: [
    {
      name: PI,
      children: ['Sprint 26', 'Sprint 27', 'Sprint 28', 'Sprint 29'].map((name) => ({ name })),
    },
  ],
  items: ITEMS,
})
// As the real one does, it answers as of the moment it is asked.
const tick = setInterval(() => {
  fake.asOf = new Date()
}, 1000)
fake.asOf = new Date()
console.log(fake.server.origin)

process.on('SIGUSR1', () => {
  if (!fake.options.items.some((entry) => entry.id === 399)) fake.options.items.push(lateBug())
})
process.on('SIGTERM', () => {
  clearInterval(tick)
  fake.server.close()
  process.exit(0)
})
