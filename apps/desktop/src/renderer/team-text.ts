import type { TeamPeriod, TeamPerson } from '@octo/domain'
import { type Lines, readLines } from './lines.ts'
import { messages } from './messages.ts'

const SEPARATOR = ';'
const CLIENT_WORDS = /^(cliente|client)$/i

const SUPPLIER_WORDS = /^(nostra|nostro|fornitore|supplier)$/i

const pieces = (line: string): string[] => line.split(SEPARATOR).map((field) => field.trim())

/** True for a day of the calendar: 31/02 and 32/13 are not days. */
function exists(day: string): boolean {
  const date = new Date(`${day}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === day
}

/** `31/12/2026` or `31-12-26` as `2026-12-31`; empty for anything that is not a day. */
export function dayOf(typed: string): string {
  const found = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/.exec(typed.trim())
  const day = found
    ? `${found[3]?.length === 2 ? `20${found[3]}` : found[3]}-${found[2]?.padStart(2, '0')}-${found[1]?.padStart(2, '0')}`
    : typed.trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(day) && exists(day) ? day : ''
}

/** A day that was typed and is not one. */
const wrongDay = (typed: string): boolean => typed !== '' && dayOf(typed) === ''

export const dayText = (day: string): string => day.split('-').reverse().join('/')

/** `name; role; side; from; to; note` per line; the note may hold the separator itself. */
export function peopleOf(text: string): Lines<TeamPerson> {
  return readLines(text, (line) => {
    const [name = '', role = '', side = '', from = '', to = '', ...note] = pieces(line)
    if (name === '') return { reason: 'shape' }
    if (side !== '' && !CLIENT_WORDS.test(side) && !SUPPLIER_WORDS.test(side)) {
      return { reason: 'side' }
    }
    if (wrongDay(from) || wrongDay(to)) return { reason: 'date' }
    return {
      value: {
        name,
        role,
        side: CLIENT_WORDS.test(side) ? 'client' : 'supplier',
        from: dayOf(from),
        to: dayOf(to),
        note: note.join(`${SEPARATOR} `),
      },
    }
  })
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

/** `name; from; to` per line: a period is its two days. */
export function periodsOf(text: string): Lines<TeamPeriod> {
  return readLines(text, (line) => {
    const [name = '', from = '', to = '', ...rest] = pieces(line)
    if (name === '' || from === '' || to === '' || rest.length > 0) return { reason: 'shape' }
    if (wrongDay(from) || wrongDay(to)) return { reason: 'date' }
    return { value: { name, from: dayOf(from), to: dayOf(to) } }
  })
}

export const periodLines = (periods: readonly TeamPeriod[]): string =>
  periods
    .map((period) => [period.name, dayText(period.from), dayText(period.to)].join(`${SEPARATOR} `))
    .join('\n')
