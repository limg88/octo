import { JOBS_FOLDER } from './deliverable.ts'

/** A ticket the alignment of a sprint found missing in the internal tracker. */
export type MissingTicket = { summary: string; type: string; description: string }

/** One ticket Octo created in the internal tracker because the PM asked: when, by whom, its key. */
export type TicketWritten = { summary: string; key: string; at: string; by: string }

/** Where Octo keeps what it wrote in the internal tracker: it never creates a ticket twice. */
export const TICKETS_WRITTEN_FILE = `${JOBS_FOLDER}/allineamento/scritture.json`
/** The file of the missing tickets among those an alignment leaves. */
export const MISSING_TICKETS_FILE = /^mancanti_.*\.csv$/
/** Tickets created at one request at most: a sprint, not a backlog. */
export const MAX_TICKETS_PER_REQUEST = 100
/** A Jira project key, as Jira writes it. */
export const PROJECT_KEY = /^[A-Z][A-Z0-9_]{1,19}$/

/** The rows of a CSV file, quoted cells and line breaks inside them included. */
function csvRows(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let at = 0; at < text.length; at += 1) {
    const char = text[at]
    if (quoted) {
      if (char !== '"') cell += char
      else if (text[at + 1] === '"') {
        cell += '"'
        at += 1
      } else quoted = false
    } else if (char === '"') quoted = true
    else if (char === ',') {
      row.push(cell)
      cell = ''
    } else if (char === '\n') {
      rows.push([...row, cell.replace(/\r$/, '')])
      row = []
      cell = ''
    } else cell += char
  }
  if (cell !== '' || row.length > 0) rows.push([...row, cell])
  return rows
}

/**
 * The missing tickets as the alignment wrote them in its file: the summary already carries the
 * id of the item of the client, so the next alignment ties the two. Rows without a summary are
 * left out, and a summary is taken once.
 */
export function missingTickets(csv: string): MissingTicket[] {
  const [head = [], ...rows] = csvRows(csv)
  const column = (name: string) => head.indexOf(name)
  const [summary, type, description] = [
    column('Summary'),
    column('Issue Type'),
    column('Description'),
  ]
  if (summary < 0) return []
  const seen = new Set<string>()
  const tickets: MissingTicket[] = []
  for (const row of rows) {
    const title = (row[summary] ?? '').trim()
    if (title === '' || seen.has(title)) continue
    seen.add(title)
    tickets.push({ summary: title, type: row[type] ?? '', description: row[description] ?? '' })
  }
  return tickets
}

/** What was written so far, read from its file: anything that is not a record of it is dropped. */
export function parseTicketsWritten(text: string | null): TicketWritten[] {
  if (text === null) return []
  try {
    const parsed: unknown = JSON.parse(text)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (entry): entry is TicketWritten =>
        typeof entry === 'object' &&
        entry !== null &&
        ['summary', 'key', 'at', 'by'].every(
          (name) => typeof Reflect.get(entry, name) === 'string',
        ),
    )
  } catch {
    return []
  }
}
