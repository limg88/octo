import { OCTO_FOLDER } from '../extracted-document.ts'
import { personKey } from '../hours/model.ts'

export const TEAM_SIDES = ['supplier', 'client'] as const
export type TeamSide = (typeof TEAM_SIDES)[number]

/** Someone who works on the project or reads what it produces. */
export type TeamPerson = {
  name: string
  role: string
  side: TeamSide
  /** The days the person is on the project, `YYYY-MM-DD`; empty: from the start, or still on it. */
  from: string
  to: string
  /** The share of their time given to the project, in percent; null: not said. */
  allocation: number | null
  /**
   * The most days the person is to spend on the project, as it was sold or planned; null or
   * absent: not said. The costs at budget of a fixed price are proposed from these.
   */
  capDays?: number | null | undefined
  /** How to write to them, what they want to read first, what never to tell them. */
  note: string
}

/** A stretch of the project's calendar: a planning period, a sprint, a phase. */
export type TeamPeriod = { name: string; from: string; to: string }

/** The people and the calendar of a project. */
export type ProjectTeam = { people: TeamPerson[]; periods: TeamPeriod[] }

export const NO_TEAM: ProjectTeam = { people: [], periods: [] }

/** Where the people and the calendar are written for whoever answers on the project. */
export const TEAM_FILE = `${OCTO_FOLDER}/progetto/persone-e-calendario.md`

const DAY = /^\d{4}-\d{2}-\d{2}$/
const day = (value: string): string => (DAY.test(value.trim()) ? value.trim() : '')

/** The most a person can give to a project. */
export const FULL_ALLOCATION = 100
/** A share of time that makes sense: more than nothing, at most all of it. */
const allocationOf = (value: number | null): number | null =>
  value !== null && Number.isFinite(value) && value > 0 && value <= FULL_ALLOCATION ? value : null

const capOf = (value: number | null | undefined): number | null =>
  value != null && Number.isFinite(value) && value > 0 ? value : null

/** Days written in a role, as PMs do while there is no field for them: «Analista (8 gg)». */
const DAYS_IN_ROLE = /(\d+(?:[.,]\d+)?)\s*(?:gg|giorn\w*|days?)\b/i

/**
 * The most days a person is to spend on the project: as written in its own field, else as the
 * role says in words («8 gg», «1,5 giorni»); null when neither says.
 */
export function capDaysOf(person: Pick<TeamPerson, 'role' | 'capDays'>): number | null {
  const written = capOf(person.capDays)
  if (written !== null) return written
  const inRole = DAYS_IN_ROLE.exec(person.role)?.[1]
  return inRole === undefined ? null : capOf(Number(inRole.replace(',', '.')))
}

/** The most days a person is to spend on the project. */
export type PersonCap = { person: string; days: number }

/** The caps of the supplier's people who have one: what the project was planned to take. */
export function teamCaps(team: ProjectTeam): PersonCap[] {
  return team.people.flatMap((person) => {
    const days = person.side === 'supplier' ? capDaysOf(person) : null
    return days === null ? [] : [{ person: person.name, days }]
  })
}

/** The people and the calendar as the PM typed them, made tidy: one entry per person and per name. */
export function cleanTeam(team: ProjectTeam): ProjectTeam {
  const people = new Map<string, TeamPerson>()
  for (const person of team.people) {
    const key = personKey(person.name)
    if (key === '') continue
    people.set(key, {
      name: person.name.trim(),
      role: person.role.trim(),
      side: TEAM_SIDES.includes(person.side) ? person.side : 'supplier',
      from: day(person.from),
      to: day(person.to),
      allocation: allocationOf(person.allocation),
      note: person.note.trim(),
      ...(capOf(person.capDays) === null ? {} : { capDays: capOf(person.capDays) }),
    })
  }
  const periods = new Map<string, TeamPeriod>()
  for (const period of team.periods) {
    const name = period.name.trim()
    const [from, to] = [day(period.from), day(period.to)]
    if (name === '' || from === '' || to === '' || from > to) continue
    periods.set(name.toLowerCase(), { name, from, to })
  }
  return {
    people: [...people.values()],
    periods: [...periods.values()].sort(
      (a, b) => a.from.localeCompare(b.from) || b.to.localeCompare(a.to),
    ),
  }
}

/**
 * The people who were not on the project on any day of a stretch of time: they left before it
 * or joined after it. Their missing hours in that stretch are no anomaly.
 */
/** The people of the project on the supplier's side, each as a name read in any order. */
export function ownPeopleKeys(team: ProjectTeam): Set<string> {
  return new Set(
    team.people
      .filter((person) => person.side === 'supplier')
      .map((person) => personKey(person.name)),
  )
}

/**
 * The items assigned to the supplier's own people: `Rossi Mario` in a tracker is `Mario Rossi` of
 * the team. An item assigned to nobody is nobody's. While the team lists no person of the
 * supplier there is nothing to tell the items by, and all are kept.
 */
export function assignedToOwnPeople<Item extends { assignee: string | null }>(
  items: readonly Item[],
  team: ProjectTeam,
): Item[] {
  const own = ownPeopleKeys(team)
  if (own.size === 0) return [...items]
  return items.filter((item) => item.assignee !== null && own.has(personKey(item.assignee)))
}

export function peopleAway(team: ProjectTeam, from: string, to: string): string[] {
  return team.people
    .filter(
      (person) =>
        (person.to !== '' && person.to < from) || (person.from !== '' && person.from > to),
    )
    .map((person) => person.name)
}

/** The stretches of the calendar a day falls in, the widest first. */
export function periodsOn(team: ProjectTeam, date: string): TeamPeriod[] {
  return team.periods.filter((period) => period.from <= date && date <= period.to)
}

const italianDay = (value: string): string => value.split('-').reverse().join('/')

const SIDE_TITLES: Readonly<Record<TeamSide, string>> = {
  supplier: 'Dalla nostra parte',
  client: 'Dal cliente',
}

function personLine(person: TeamPerson): string {
  const stay =
    person.from === '' && person.to === ''
      ? ''
      : ` — sul progetto${person.from ? ` dal ${italianDay(person.from)}` : ''}${person.to ? ` fino al ${italianDay(person.to)}` : ''}`
  const role = person.role === '' ? '' : `, ${person.role}`
  const allocation =
    person.allocation === null
      ? ''
      : `, al ${person.allocation.toLocaleString('it-IT')}% del suo tempo`
  const cap =
    capOf(person.capDays) === null
      ? ''
      : `, tetto di ${(person.capDays ?? 0).toLocaleString('it-IT')} giorni`
  const note = person.note === '' ? '' : `\n  - Come scrivergli o scriverle: ${person.note}`
  return `- **${person.name}**${role}${allocation}${cap}${stay}${note}`
}

/**
 * The people and the calendar as a text of the project: whoever answers a question or writes a
 * deliverable finds there who is who, how each one wants to be written to, and the dates of the
 * periods, and can cite it like any other source.
 */
export function teamMarkdown(team: ProjectTeam): string {
  const lines = ['# Persone e calendario del progetto', '']
  lines.push('Scritto da Octo dalle impostazioni del progetto: si cambia da lì, non qui.', '')
  for (const side of TEAM_SIDES) {
    const people = team.people.filter((person) => person.side === side)
    if (people.length === 0) continue
    lines.push(`## ${SIDE_TITLES[side]}`, '', ...people.map(personLine), '')
  }
  if (team.periods.length > 0) {
    lines.push('## Calendario', '', '| Periodo | Dal | Al |', '|---|---|---|')
    for (const period of team.periods) {
      lines.push(`| ${period.name} | ${italianDay(period.from)} | ${italianDay(period.to)} |`)
    }
    lines.push('')
  }
  return lines.join('\n')
}
