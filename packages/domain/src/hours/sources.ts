import type { HoursEntry } from './model.ts'

type Json = Record<string, unknown>

const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const text = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : ''

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})/
const LOCAL_DAY = /^(\d{1,2})[/.](\d{1,2})[/.](\d{4})/
const two = (value: string): string => value.padStart(2, '0')

/** The day of a date written the ISO way or the Italian way (`31/12/2026`); null otherwise. */
export function dayOf(value: unknown): string | null {
  const written = text(value)
  const iso = ISO_DAY.exec(written)
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
  const local = LOCAL_DAY.exec(written)
  return local ? `${local[3]}-${two(local[2] ?? '')}-${two(local[1] ?? '')}` : null
}

/** A number written with a point or with a comma for the decimals; null when it is not one. */
export function amountOf(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  const written = text(value).replace(/\s/g, '')
  if (written === '') return null
  const parsed = Number(
    written.includes(',') ? written.replace(/\./g, '').replace(',', '.') : written,
  )
  return Number.isFinite(parsed) ? parsed : null
}

/** The cost of a row of timesheet, as the company's system names it. */
export const TIMESHEET_COST_FIELD = 'laborcost_new'

const APPROVED = /^(approved|approvat[oa])$/i

/**
 * Timesheet rows as the company's system exports them: `{ rows: [{ employee, timesheetdate,
 * projectid, duration, approvalstatus }] }`, or the rows alone. A row without a person, a day
 * or hours is left out; null when the content is not an export.
 */
export function parseTimesheetExport(value: unknown): HoursEntry[] | null {
  const rows = Array.isArray(value) ? value : isObject(value) ? value.rows : null
  if (!Array.isArray(rows)) return null
  return rows.flatMap((row): HoursEntry[] => {
    if (!isObject(row)) return []
    const person = text(row.employee)
    const day = dayOf(row.timesheetdate)
    const hours = amountOf(row.duration)
    if (person === '' || day === null || hours === null) return []
    const status = text(row.approvalstatus)
    return [
      {
        person,
        day,
        hours,
        project: text(row.projectid) || null,
        // An export that does not say counts as approved: it has no other hours to tell apart.
        approved: status === '' || APPROVED.test(status),
        id: text(row.internalid) || null,
        cost: amountOf(row[TIMESHEET_COST_FIELD]),
      },
    ]
  })
}

/**
 * The costs of timesheet rows kept apart from their hours: `{ rows: [{ internalid,
 * laborcost_new }] }`. A row without an id or a cost is left out; null when the text is not one.
 */
export function parseTimesheetCosts(content: string): Array<{ id: string; cost: number }> | null {
  let value: unknown
  try {
    value = JSON.parse(content)
  } catch {
    return null
  }
  if (!isObject(value) || !Array.isArray(value.rows)) return null
  return value.rows.flatMap((row) => {
    if (!isObject(row)) return []
    const id = text(row.internalid)
    const cost = amountOf(row[TIMESHEET_COST_FIELD])
    return id === '' || cost === null ? [] : [{ id, cost }]
  })
}

const SEPARATORS = [';', ',', '\t'] as const
const QUOTE = '"'
const BYTE_ORDER_MARK = '﻿'

/** The rows of a text with separators, quotes kept as the usual convention wants. */
export function parseSeparated(content: string): string[][] {
  const body = content.startsWith(BYTE_ORDER_MARK) ? content.slice(1) : content
  const firstLine = body.split(/\r?\n/, 1)[0] ?? ''
  const count = (separator: string) => firstLine.split(separator).length
  const separator = [...SEPARATORS].sort((a, b) => count(b) - count(a))[0] ?? ','
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let index = 0; index < body.length; index += 1) {
    const char = body[index]
    if (quoted) {
      if (char === QUOTE && body[index + 1] === QUOTE) {
        cell += QUOTE
        index += 1
      } else if (char === QUOTE) quoted = false
      else cell += char
    } else if (char === QUOTE) quoted = true
    else if (char === separator) {
      row.push(cell)
      cell = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && body[index + 1] === '\n') index += 1
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += char
  }
  if (cell !== '' || row.length > 0) rows.push([...row, cell])
  return rows.filter((cells) => cells.some((value) => value.trim() !== ''))
}

/** The names a column may have in the exports of the tools people use to log hours. */
const COLUMNS = {
  person:
    /^(full name|user ?name|user|author|worker|display name|nome completo|utente|persona|risorsa)$/i,
  day: /^(work date|date|started|start date|worklog date|data|giorno)$/i,
  hours: /^(hours|logged|logged hours|worked|time spent \(h\)|ore|durata)$/i,
  seconds: /^(time ?spent ?seconds|time spent \(s\)|seconds|secondi)$/i,
} as const
const SECONDS_PER_HOUR = 3600

function columnOf(header: readonly string[], names: RegExp): number {
  return header.findIndex((name) => names.test(name.trim()))
}

/**
 * The hours logged on a tracker, from the file its time-tracking tool exports: one row per
 * logging, with a person, a day and the hours (or the seconds). Columns are found by name, in
 * English or Italian; null when the file has not the three of them.
 */
export function parseWorklogExport(content: string): HoursEntry[] | null {
  const [header, ...rows] = parseSeparated(content)
  if (!header) return null
  // `Full name` is preferred to `User`, which is often an account id.
  const person = [/^(full name|display name|nome completo)$/i, COLUMNS.person]
    .map((names) => columnOf(header, names))
    .find((index) => index >= 0)
  const day = columnOf(header, COLUMNS.day)
  const hours = columnOf(header, COLUMNS.hours)
  const seconds = columnOf(header, COLUMNS.seconds)
  if (person === undefined || day < 0 || (hours < 0 && seconds < 0)) return null
  return rows.flatMap((cells): HoursEntry[] => {
    const name = text(cells[person])
    const date = dayOf(cells[day])
    const inSeconds = amountOf(cells[seconds])
    const amount =
      hours >= 0 ? amountOf(cells[hours]) : inSeconds === null ? null : inSeconds / SECONDS_PER_HOUR
    if (name === '' || date === null || amount === null) return []
    return [{ person: name, day: date, hours: amount, project: null, approved: true, id: null }]
  })
}

/** Hours read from the tracker itself, before they are written as an export of the project. */
export type TrackerHours = { person: string; day: string; hours: number; issue: string }

export const WORKLOG_CSV_HEADER = 'Issue Key;Work date;Hours;Full name'
const HOURS_PRECISION = 10_000

const quoted = (value: string): string => `"${value.replaceAll('"', '""')}"`

/** The export Octo writes of the hours it read: the same file a time-tracking tool would give. */
export function worklogCsv(entries: readonly TrackerHours[]): string {
  const rows = [...entries]
    .sort(
      (a, b) =>
        a.day.localeCompare(b.day) ||
        a.person.localeCompare(b.person) ||
        a.issue.localeCompare(b.issue),
    )
    .map((entry) => {
      const hours = Math.round(entry.hours * HOURS_PRECISION) / HOURS_PRECISION
      return [quoted(entry.issue), entry.day, String(hours), quoted(entry.person)].join(';')
    })
  return `${[WORKLOG_CSV_HEADER, ...rows].join('\n')}\n`
}

const MONTH = /^(\d{4})-(\d{2})/

/** Every month a period touches, each with its first and last day: `2026-06` and so on. */
export function monthsOf(period: {
  from: string
  to: string
}): Array<{ month: string; from: string; to: string }> {
  const start = MONTH.exec(period.from)
  const end = MONTH.exec(period.to)
  if (!start || !end) return []
  const months: Array<{ month: string; from: string; to: string }> = []
  let year = Number(start[1])
  let month = Number(start[2])
  while (year < Number(end[1]) || (year === Number(end[1]) && month <= Number(end[2]))) {
    const name = `${year}-${String(month).padStart(2, '0')}`
    const last = new Date(Date.UTC(year, month, 0)).getUTCDate()
    months.push({ month: name, from: `${name}-01`, to: `${name}-${String(last).padStart(2, '0')}` })
    month += 1
    if (month > 12) {
      month = 1
      year += 1
    }
  }
  return months
}
