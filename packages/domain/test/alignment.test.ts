import { describe, expect, it } from 'vitest'
import {
  type AlignItem,
  type AlignmentSettings,
  type AlignTicket,
  alignTrackers,
  cleanAlignmentSettings,
  DEFAULT_ALIGNMENT_SETTINGS,
  missingTicketsCsv,
  referencedIds,
  stateMismatches,
} from '../src/index.ts'

const item = (id: string, title: string, over: Partial<AlignItem> = {}): AlignItem => ({
  id,
  title,
  type: 'User Story',
  state: 'In Progress',
  sprint: 'Aurora\\Sprint 28',
  period: 'PI7',
  tags: ['Squadra'],
  assignee: 'Rossi Mario',
  description: '',
  ...over,
})
const ticket = (key: string, title: string, over: Partial<AlignTicket> = {}): AlignTicket => ({
  key,
  title,
  type: 'Story',
  status: 'In corso',
  sprint: 'Sprint 28',
  sprints: ['Sprint 28'],
  assignee: null,
  ...over,
})

const settings: AlignmentSettings = {
  ...DEFAULT_ALIGNMENT_SETTINGS,
  sprint: 'sprint 28',
  period: 'PI7',
  tags: ['squadra'],
  stateGroups: [
    { name: 'in corso', item: ['In Progress'], ticket: ['In corso'] },
    { name: 'chiuso', item: ['Closed'], ticket: ['Completata'] },
  ],
}

const items = [
  item('101', 'Esportazione degli ordini in Excel'),
  item('102', 'Filtro per data nella lista ordini', { tags: ['Squadra', 'aur-7'] }),
  item('103', 'Stampa della conferma d’ordine', { state: 'Closed' }),
  item('104', 'Notifica via mail al cambio di stato'),
  item('105', 'Ricerca ordini per cliente'),
  item('106', 'Importazione listino prezzi', { state: 'New' }),
  item('201', 'Altro sprint', { sprint: 'Aurora\\Sprint 2' }),
  item('202', 'Altra squadra', { tags: ['Altri'] }),
  item('203', 'Altro periodo', { period: 'PI6' }),
]
const tickets = [
  ticket('AUR-1', '[AZDO 101] Esportazione ordini in Excel'),
  ticket('AUR-7', 'Filtro per data', { status: 'Completata' }),
  ticket('AUR-3', '[ADO-103, 104] Stampa e notifica', { sprint: 'Sprint 27' }),
  ticket('AUR-4', '[azdo 104] Notifica via mail'),
  ticket('AUR-5', 'Ricerca degli ordini per cliente'),
  ticket('AUR-6', '[AZDO 999] Voce che non esiste'),
  ticket('AUR-8', '[AZDO 201] Voce di un altro sprint'),
  ticket('AUR-9', 'Riunione di pianificazione'),
  ticket('AUR-10', '[AZDO 105] Ricerca, in un altro sprint', { sprint: null }),
  ticket('AUR-11', 'Di un altro sprint, senza riferimenti', { sprint: 'Sprint 27' }),
]

describe('references in a title', () => {
  it('finds the ids after one of the prefixes, one or several', () => {
    const prefixes = ['AZDO', 'ADO']
    expect(referencedIds('[AZDO 123] Titolo', prefixes)).toEqual(['123'])
    expect(referencedIds('[ado-12, 34 / 56] e [AZDO: 12]', prefixes)).toEqual(['12', '34', '56'])
    expect(referencedIds('[AZDO 77 senza chiusura', prefixes)).toEqual(['77'])
    expect(referencedIds('[JIRA 123] Sprint 28, voce 45', prefixes)).toEqual([])
    expect(referencedIds('[AZDO 123]', [])).toEqual([])
  })
})

describe('the alignment of two trackers', () => {
  const result = alignTrackers(items, tickets, settings)

  it('puts every item of the sprint in one list, and the lists add up', () => {
    expect(result.total).toBe(6)
    expect(result.linked.map((pair) => pair.item.id)).toEqual(['101', '102', '104'])
    expect(result.needsUpdate.map((pair) => pair.item.id)).toEqual(['103', '105'])
    expect(result.missing.map((entry) => entry.id)).toEqual(['106'])
    expect(result.adds).toBe(true)
  })

  it('ties by the key among the tags first, then by the id in the title', () => {
    const [byTitle, byTag] = result.linked
    expect(byTitle).toMatchObject({ via: 'title', coherent: true, itemGroup: 'in corso' })
    expect(byTitle?.tickets.map((entry) => entry.key)).toEqual(['AUR-1'])
    expect(byTag).toMatchObject({
      via: 'tag',
      itemGroup: 'in corso',
      ticketGroup: 'chiuso',
      coherent: false,
    })
    expect(byTag?.tickets.map((entry) => entry.key)).toEqual(['AUR-7'])
  })

  it('compares the state with the ticket of the sprint and flags an item with two tickets', () => {
    const notified = result.linked[2]
    expect(notified?.tickets.map((entry) => entry.key)).toEqual(['AUR-3', 'AUR-4'])
    expect(notified?.coherent).toBe(true)
    expect(result.duplicates.map((pair) => pair.item.id)).toEqual(['104'])
    // A state the PM put in no group is not judged.
    const elsewhere = result.needsUpdate[0]
    expect(elsewhere).toMatchObject({
      itemGroup: 'chiuso',
      ticketGroup: 'in corso',
      coherent: false,
    })
    expect(
      alignTrackers([item('1', 'x', { state: 'Altro' })], [ticket('A-1', '[ADO 1] x')], settings)
        .linked[0]?.coherent,
    ).toBeNull()
  })

  it('reports the tickets that name an item the comparison does not hold', () => {
    expect(result.orphans).toEqual([
      { ticket: tickets[5], ids: ['999'], reason: 'unknown' },
      { ticket: tickets[6], ids: ['201'], reason: 'out_of_scope' },
    ])
    expect(result.unreferenced.map((entry) => entry.key)).toEqual(['AUR-5', 'AUR-9'])
  })

  it('proposes look-alike titles without tying them', () => {
    const free = [
      ticket('B-1', 'Importazione del listino prezzi'),
      ticket('B-2', 'Importazione listino prezzi'),
      ticket('B-3', 'Riunione di pianificazione'),
    ]
    const proposed = alignTrackers([items[5] as AlignItem], free, settings)
    expect(proposed.missing).toHaveLength(1)
    expect(proposed.suggestions).toEqual([
      { item: items[5], ticket: free[1], score: 1, confidence: 'high' },
    ])
    const loose = alignTrackers([items[5] as AlignItem], [free[0] as AlignTicket], settings)
    expect(loose.suggestions[0]).toMatchObject({ confidence: 'medium' })
    expect(loose.suggestions[0]?.score).toBeGreaterThan(0.8)
    expect(result.suggestions).toEqual([])
  })

  it('takes every item when no period or tag narrows it, and nothing without a sprint', () => {
    const wide = alignTrackers(items, tickets, { ...settings, period: '', tags: [] })
    expect(wide.total).toBe(8)
    expect(alignTrackers(items, tickets, { ...settings, sprint: 'Sprint 2' }).total).toBe(1)
    const none = alignTrackers([item('1', '', { sprint: null })], [], settings)
    expect(none).toMatchObject({ total: 0, adds: true, missing: [] })
    const untitled = alignTrackers([item('1', '')], [ticket('A-1', '')], settings)
    expect(untitled.suggestions).toEqual([])
  })
})

describe('the import file of the missing items', () => {
  it('writes one ticket per item, with the id in the title and a plain description', () => {
    const missing = [
      item('106', 'Importazione "listino", prezzi', {
        description: '<p>Primo&nbsp;passo</p><ul><li>voce &amp; altro</li></ul><br/>fine',
      }),
      item('107', 'Segnalazione', { type: 'Bug', assignee: null }),
      item('108', 'Attività', { type: 'Task' }),
    ]
    const csv = missingTicketsCsv(missing, { ...settings, sprint: 'Sprint 28' })
    expect(csv.split('\r\n')).toEqual([
      'Summary,Issue Type,Priority,Assignee,Description,Sprint',
      '"[AZDO 106] Importazione ""listino"", prezzi",Story,,Rossi Mario,"Primo passo\nvoce & altro\n\nfine",Sprint 28',
      '[AZDO 107] Segnalazione,Bug,,,,Sprint 28',
      '[AZDO 108] Attività,Task,,Rossi Mario,,Sprint 28',
      '',
    ])
    const bare = missingTicketsCsv([missing[1] as AlignItem], {
      ...settings,
      referencePrefixes: [],
    })
    expect(bare).toContain('\r\nSegnalazione,Bug')
  })
})

describe('the settings of the alignment', () => {
  it('are made tidy', () => {
    expect(
      cleanAlignmentSettings({
        sprint: ' Sprint 28 ',
        period: ' PI7 ',
        tags: [' Squadra ', 'Squadra', ''],
        ownPeopleOnly: true,
        exportPath: ' dati/tracker.json ',
        ticketFolder: ' _octo/fonti/Jira ',
        referencePrefixes: ['azdo', 'A.*', '', 'ADO'],
        stateGroups: [
          { name: ' in corso ', item: [' In Progress ', ''], ticket: ['In corso'] },
          { name: '', item: ['x'], ticket: ['y'] },
          { name: 'vuoto', item: [], ticket: ['y'] },
        ],
        typeMap: [
          { item: ' User Story ', ticket: ' Story ' },
          { item: '', ticket: 'x' },
        ],
      }),
    ).toEqual({
      sprint: 'Sprint 28',
      period: 'PI7',
      tags: ['Squadra'],
      ownPeopleOnly: true,
      exportPath: 'dati/tracker.json',
      ticketFolder: '_octo/fonti/Jira',
      referencePrefixes: ['AZDO', 'ADO'],
      stateGroups: [{ name: 'in corso', item: ['In Progress'], ticket: ['In corso'] }],
      typeMap: [{ item: 'User Story', ticket: 'Story' }],
    })
  })
})

describe('a state the alignment and the dashboard read in two ways', () => {
  const groups = [
    { name: 'Chiuso', item: ['Closed', 'Demo'], ticket: ['Done'] },
    { name: 'In verifica', item: ['Ready for Test'], ticket: ['In test'] },
    // A name that says no phase is compared with nothing.
    { name: 'Gruppo A', item: ['Closed'], ticket: ['Done'] },
  ]

  it('is told with the group it is in and the phase the dashboard gives it', () => {
    // «Demo» is closed for the alignment and waiting to be verified for the dashboard.
    expect(stateMismatches({ stateGroups: groups }, { phases: {} })).toEqual([
      { state: 'Demo', group: 'Chiuso', groupPhase: 'closed', dashboardPhase: 'verify' },
    ])
  })

  it('goes away when the PM tells the dashboard the same, or there are no groups', () => {
    expect(stateMismatches({ stateGroups: groups }, { phases: { Demo: 'closed' } })).toEqual([])
    expect(stateMismatches({ stateGroups: [] }, { phases: {} })).toEqual([])
  })
})
