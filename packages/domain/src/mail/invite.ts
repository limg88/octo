import { isCalendarDate, romeMidnight } from '../rome-time.ts'
import type { MailMeeting } from './message.ts'

const HOUR_MS = 60 * 60 * 1000
const MINUTE_MS = 60 * 1000
const SECOND_MS = 1000
const MOMENT = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/
const EVENT_OPEN = 'BEGIN:VEVENT'
const EVENT_CLOSE = 'END:VEVENT'

/** Lines of a calendar part, with those folded over several lines put back together. */
function unfolded(text: string): string[] {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\n[ \t]/g, '')
    .split('\n')
}

const unescaped = (value: string): string =>
  value
    .replace(/\\n/gi, ' ')
    .replace(/\\([,;\\])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()

/**
 * A moment of a calendar part as an instant. One ending in `Z` is universal time; any other is
 * read as the time in Italy, whatever zone the invitation names: the meetings of the product are
 * there. A day without a time starts at midnight.
 */
function instantOf(value: string): string | null {
  const found = MOMENT.exec(value.trim())
  if (!found) return null
  const [year, month, day, hour, minute, second] = found
    .slice(1, 7)
    .map((part) => Number(part ?? 0))
  if (!isCalendarDate(year as number, month as number, day as number)) return null
  const time =
    (hour as number) * HOUR_MS + (minute as number) * MINUTE_MS + (second as number) * SECOND_MS
  const start = found[7]
    ? Date.UTC(year as number, (month as number) - 1, day as number)
    : romeMidnight(year as number, month as number, day as number).getTime()
  return new Date(start + time).toISOString()
}

/** People of an invitation kept at most: a meeting of a whole company is not prepared by name. */
export const MAX_INVITE_ATTENDEES = 50
const PERSON_FIELDS: readonly string[] = ['ORGANIZER', 'ATTENDEE']
const COMMON_NAME = /;CN=(?:"([^"]*)"|([^;:]*))/i
const MAIL_ADDRESS = /mailto:([^\s;>]+)/i

/** Who a line of the people of an event names: `Name <address>`, the address, or the name. */
function personOf(line: string): string | null {
  const name = COMMON_NAME.exec(line)
  // A name never holds what parts the people of a meeting in the file of the mail.
  const shown = unescaped(name?.[1] ?? name?.[2] ?? '').replaceAll(';', ',')
  const address = (MAIL_ADDRESS.exec(line)?.[1] ?? '').toLowerCase()
  if (address === '') return shown === '' ? null : shown
  return shown === '' || shown.toLowerCase() === address ? address : `${shown} <${address}>`
}

const addressOf = (person: string): string =>
  (/<([^>]+)>$/.exec(person)?.[1] ?? person).toLowerCase()

/** The people of an event, each once, the one who calls it first. */
function peopleOf(lines: readonly string[]): string[] {
  const people = new Map<string, string>()
  for (const field of PERSON_FIELDS) {
    for (const line of lines) {
      const name = (line.split(/[;:]/)[0] ?? '').toUpperCase()
      const person = name === field ? personOf(line) : null
      if (person !== null && !people.has(addressOf(person))) people.set(addressOf(person), person)
    }
  }
  return [...people.values()].slice(0, MAX_INVITE_ATTENDEES)
}

/** The times a series leaves out: every `EXDATE` line, each with one or more moments. */
function excludedOf(lines: readonly string[]): string[] {
  return lines
    .filter((line) => (line.split(/[;:]/)[0] ?? '').toUpperCase() === 'EXDATE')
    .flatMap((line) => line.slice(line.indexOf(':') + 1).split(','))
    .flatMap((moment) => instantOf(moment) ?? [])
}

/**
 * The meeting a calendar part invites to: the first event it holds. Null when it has none, or
 * when the event has no id or no start that can be read. A meeting that repeats carries its
 * rule: which days it falls on is told by `occurrenceOn`.
 */
export function parseInvite(calendar: string): MailMeeting | null {
  const lines = unfolded(calendar)
  const open = lines.indexOf(EVENT_OPEN)
  const close = lines.indexOf(EVENT_CLOSE, open + 1)
  if (open < 0 || close < 0) return null
  const fields = new Map<string, string>()
  const event = lines.slice(open + 1, close)
  for (const line of event) {
    const colon = line.indexOf(':')
    if (colon < 0) continue
    // `DTSTART;TZID=Europe/Rome:…`: the name of the field ends at the first parameter.
    const name = (line.slice(0, colon).split(';')[0] ?? '').toUpperCase()
    if (!fields.has(name)) fields.set(name, line.slice(colon + 1))
  }
  const uid = unescaped(fields.get('UID') ?? '')
  const start = instantOf(fields.get('DTSTART') ?? '')
  if (uid === '' || start === null) return null
  return {
    uid,
    summary: unescaped(fields.get('SUMMARY') ?? ''),
    start,
    end: instantOf(fields.get('DTEND') ?? ''),
    location: unescaped(fields.get('LOCATION') ?? ''),
    recurrence: (fields.get('RRULE') ?? '').trim() || null,
    excluded: excludedOf(event),
    occurrence: instantOf(fields.get('RECURRENCE-ID') ?? ''),
    attendees: peopleOf(event),
  }
}
