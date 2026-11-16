import { describe, expect, it } from 'vitest'
import {
  assignedToOwnPeople,
  cleanTeam,
  NO_TEAM,
  ownPeopleKeys,
  type ProjectTeam,
  peopleAway,
  periodsOn,
  projectFolderName,
  starterFiles,
  TEAM_FILE,
  type TeamPerson,
  teamMarkdown,
} from '../src/index.ts'

const person = (name: string, over: Partial<TeamPerson> = {}): TeamPerson => ({
  name,
  role: '',
  side: 'supplier',
  from: '',
  to: '',
  allocation: null,
  note: '',
  ...over,
})

const team: ProjectTeam = {
  people: [
    person('Rossi Mario', { role: 'sviluppatore', from: '2026-03-01' }),
    person('Verdi Luca', { to: '2026-05-31', allocation: 50 }),
    person('Neri Sara', { from: '2026-07-01', to: '2026-12-31' }),
    person('Carla Bianchi', {
      role: 'referente',
      side: 'client',
      note: 'dare del lei, prima la richiesta',
    }),
  ],
  periods: [
    { name: 'PI7', from: '2026-10-26', to: '2027-01-29' },
    { name: 'Sprint 28', from: '2026-10-26', to: '2026-11-13' },
    { name: 'Sprint 29', from: '2026-11-16', to: '2026-12-04' },
  ],
}

describe('the people and the calendar of a project', () => {
  it('are made tidy: one entry per person and per name, real days, periods in order', () => {
    const clean = cleanTeam({
      people: [
        person(' Rossi Mario ', { role: ' dev ', from: '01/03/2026', to: ' 2026-12-31 ' }),
        person('Mario Rossi', { role: 'sviluppatore', note: ' nota ' }),
        person('123'),
        { ...person('Carla Bianchi'), side: 'altro' as never },
      ],
      periods: [
        { name: 'Sprint 29', from: '2026-11-16', to: '2026-12-04' },
        { name: ' PI7 ', from: '2026-10-26', to: '2027-01-29' },
        { name: 'Sprint 28', from: '2026-10-26', to: '2026-11-13' },
        { name: 'sprint 28', from: '2026-10-27', to: '2026-11-13' },
        { name: '', from: '2026-10-26', to: '2026-11-13' },
        { name: 'Senza fine', from: '2026-10-26', to: '' },
        { name: 'Al rovescio', from: '2026-11-13', to: '2026-10-26' },
      ],
    })
    expect(clean.people).toEqual([
      person('Mario Rossi', { role: 'sviluppatore', note: 'nota' }),
      person('Carla Bianchi'),
    ])
    expect(clean.periods.map((period) => period.name)).toEqual(['PI7', 'sprint 28', 'Sprint 29'])
  })

  it('keep the share of time a person gives to the project only when it is one', () => {
    const allocations = [50, 100, 12.5, 0, -10, 150, Number.NaN, null]
    const clean = cleanTeam({
      people: allocations.map((allocation, index) =>
        person(`Persona ${'abcdefgh'[index]}`, { allocation }),
      ),
      periods: [],
    })
    expect(clean.people.map(({ allocation }) => allocation)).toEqual([
      50,
      100,
      12.5,
      null,
      null,
      null,
      null,
      null,
    ])
    expect(teamMarkdown(clean)).toContain('- **Persona c**, al 12,5% del suo tempo\n')
  })

  it('know who was not on the project in a stretch of time, and which periods hold a day', () => {
    expect(peopleAway(team, '2026-06-01', '2026-06-30')).toEqual(['Verdi Luca', 'Neri Sara'])
    expect(peopleAway(team, '2026-05-15', '2026-07-15')).toEqual([])
    expect(peopleAway(team, '2026-01-01', '2026-02-28')).toEqual(['Rossi Mario', 'Neri Sara'])
    expect(peopleAway(NO_TEAM, '2026-06-01', '2026-06-30')).toEqual([])
    expect(periodsOn(team, '2026-11-10').map((period) => period.name)).toEqual(['PI7', 'Sprint 28'])
    expect(periodsOn(team, '2026-11-14').map((period) => period.name)).toEqual(['PI7'])
    expect(periodsOn(team, '2026-01-01')).toEqual([])
  })

  it('are written as a text of the project, by side, with how to write to each one', () => {
    const text = teamMarkdown(team)
    expect(TEAM_FILE).toBe('_octo/progetto/persone-e-calendario.md')
    expect(text).toContain(
      '## Dalla nostra parte\n\n- **Rossi Mario**, sviluppatore — sul progetto dal 01/03/2026\n',
    )
    expect(text).toContain(
      '- **Verdi Luca**, al 50% del suo tempo — sul progetto fino al 31/05/2026\n',
    )
    expect(text).toContain('- **Neri Sara** — sul progetto dal 01/07/2026 fino al 31/12/2026\n')
    expect(text).toContain(
      '## Dal cliente\n\n- **Carla Bianchi**, referente\n  - Come scrivergli o scriverle: dare del lei, prima la richiesta\n',
    )
    expect(text).toContain('| Sprint 28 | 26/10/2026 | 13/11/2026 |')
    const empty = teamMarkdown(NO_TEAM)
    expect(empty).toContain('# Persone e calendario del progetto')
    expect(empty).not.toContain('##')
  })
})

describe('a new project', () => {
  it('takes a name a folder can have', () => {
    expect(projectFolderName('  Boreale   2 ')).toBe('Boreale 2')
    expect(projectFolderName('Cliente & Figli (2026)')).toBe('Cliente & Figli (2026)')
    for (const name of ['', ' ', 'a/b', 'a\\b', 'a:b', 'a*b', '.git', 'fine.', 'x'.repeat(81)]) {
      expect(projectFolderName(name)).toBeNull()
    }
  })

  it('starts with a place for each kind of material and a note that says so', () => {
    const files = starterFiles('Boreale')
    expect(files.map((file) => file.path)).toEqual([
      'LEGGIMI.md',
      'Contratti/LEGGIMI.md',
      'Documenti/LEGGIMI.md',
      'Riunioni/LEGGIMI.md',
      'Tracker/LEGGIMI.md',
    ])
    expect(files[0]?.content).toMatch(/^# Boreale\n\nCartella del progetto, creata da Octo\./)
    expect(files[0]?.content).toContain('`Riunioni/`')
  })
})

describe('the items of the supplier’s own people', () => {
  const person = (name: string, side: 'supplier' | 'client') => ({
    name,
    role: '',
    side,
    from: '',
    to: '',
    allocation: null,
    note: '',
  })
  const team = {
    people: [
      person('Mario Rossi', 'supplier'),
      person('Giovanna Troiano Scognamiglio', 'supplier'),
      person('Cristian Lena', 'client'),
    ],
    periods: [],
  }
  const item = (id: string, assignee: string | null) => ({ id, assignee })
  const items = [
    item('1', 'Rossi Mario'),
    item('2', 'MARIO ROSSI'),
    item('3', 'Troiano Scognamiglio Giovanna'),
    item('4', 'Lena Cristian'),
    item('5', 'Scudiero Emilia'),
    item('6', null),
    item('7', ''),
  ]

  it('are told by the name, in any order: the client’s, strangers’ and nobody’s are left out', () => {
    expect(assignedToOwnPeople(items, team).map((kept) => kept.id)).toEqual(['1', '2', '3'])
    expect([...ownPeopleKeys(team)].sort()).toEqual([
      'giovanna scognamiglio troiano',
      'mario rossi',
    ])
  })

  it('are all the items while the team lists nobody of the supplier', () => {
    const onlyClient = { people: [person('Cristian Lena', 'client')], periods: [] }
    expect(assignedToOwnPeople(items, onlyClient)).toHaveLength(items.length)
    expect(assignedToOwnPeople(items, { people: [], periods: [] })).toHaveLength(items.length)
  })
})
