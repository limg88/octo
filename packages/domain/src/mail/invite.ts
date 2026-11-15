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

/**
 * The meeting a calendar part invites to: the first event it holds. Null when it has none, or
 * when the event has no id or no start that can be read. A meeting that repeats is given as its
 * first time only.
 */
export function parseInvite(calendar: string): MailMeeting | null {
  const lines = unfolded(calendar)
  const open = lines.indexOf(EVENT_OPEN)
  const close = lines.indexOf(EVENT_CLOSE, open + 1)
  if (open < 0 || close < 0) return null
  const fields = new Map<string, string>()
  for (const line of lines.slice(open + 1, close)) {
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
  }
}
