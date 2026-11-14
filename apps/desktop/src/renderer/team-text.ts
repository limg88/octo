import type { ProjectTeam, TeamPeriod, TeamPerson } from '@octo/domain'
import { messages } from './messages.ts'

const SEPARATOR = ';'
const CLIENT_WORDS = /^(cliente|client)$/i

const fieldsOf = (text: string): string[][] =>
  text
    .split('\n')
    .map((line) => line.split(SEPARATOR).map((field) => field.trim()))
    .filter((fields) => (fields[0] ?? '') !== '')

/** `31/12/2026` or `31-12-26` as `2026-12-31`; empty for anything that is not a day. */
export function dayOf(typed: string): string {
  const found = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(typed.trim())
  if (!found) return /^\d{4}-\d{2}-\d{2}$/.test(typed.trim()) ? typed.trim() : ''
  const [, day = '', month = '', year = ''] = found
  const full = year.length === 2 ? `20${year}` : year
  return `${full}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

export const dayText = (day: string): string => day.split('-').reverse().join('/')

/** `name; role; side; from; to; note` per line; the note may hold the separator itself. */
export function peopleOf(text: string): TeamPerson[] {
  return fieldsOf(text).map(([name = '', role = '', side = '', from = '', to = '', ...note]) => ({
    name,
    role,
    side: CLIENT_WORDS.test(side) ? 'client' : 'supplier',
    from: dayOf(from),
    to: dayOf(to),
    note: note.join(`${SEPARATOR} `),
  }))
}

export const peopleLines = (people: readonly TeamPerson[]): string =>
  people
    .map((person) =>
      [
        person.name,
        person.role,
        messages.team.sides[person.side],
        dayText(person.from),
        dayText(person.to),
        person.note,
      ].join(`${SEPARATOR} `),
    )
    .join('\n')

/** `name; from; to` per line. */
export function periodsOf(text: string): TeamPeriod[] {
  return fieldsOf(text).map(([name = '', from = '', to = '']) => ({
    name,
    from: dayOf(from),
    to: dayOf(to),
  }))
}

export const periodLines = (periods: readonly TeamPeriod[]): string =>
  periods
    .map((period) => [period.name, dayText(period.from), dayText(period.to)].join(`${SEPARATOR} `))
    .join('\n')

export const teamOf = (people: string, periods: string): ProjectTeam => ({
  people: peopleOf(people),
  periods: periodsOf(periods),
})
