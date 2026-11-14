import { bad, isRecord } from '../shared/values.ts'

/** One logging of hours on an issue, as the reconciliation of hours needs it: nothing else. */
export interface JiraWorklog {
  /** The display name of who logged: the only thing kept of the author. */
  person: string
  /** The day the work started, `YYYY-MM-DD`, as Jira wrote it for who logged it. */
  day: string
  seconds: number
  issueKey: string
}

/** The days to read, both included, `YYYY-MM-DD`. */
export interface WorklogPeriod {
  from: string
  to: string
}

const DAY = /^\d{4}-\d{2}-\d{2}$/
const DAY_MS = 24 * 60 * 60 * 1000
/** Worklogs asked per page: the most Jira gives. */
export const WORKLOG_PAGE_SIZE = 5000
/** Pages of the worklogs of one issue read at most. */
export const MAX_WORKLOG_PAGES = 20
/** Issues with hours in a period read at most. */
export const MAX_WORKLOG_ISSUES = 5000

export function checkedPeriod(period: WorklogPeriod): WorklogPeriod {
  const valid =
    DAY.test(period.from) &&
    DAY.test(period.to) &&
    period.from <= period.to &&
    !Number.isNaN(Date.parse(period.from)) &&
    !Number.isNaN(Date.parse(period.to))
  if (!valid) throw new TypeError('a period of days')
  return period
}

const shifted = (day: string, days: number): string =>
  new Date(Date.parse(day) + days * DAY_MS).toISOString().slice(0, 10)

/**
 * The issues of the chosen projects with hours logged in the period, by key. JQL reads a day in
 * the time zone of the account: one day more on each side is asked, and the worklogs are then
 * kept by their own day.
 */
export function worklogJql(projectIds: readonly string[], period: WorklogPeriod): string {
  for (const id of projectIds) {
    if (!/^\d{1,18}$/.test(id)) throw new TypeError('a Jira project id is digits')
  }
  const { from, to } = checkedPeriod(period)
  return (
    `project in (${projectIds.join(', ')}) AND worklogDate >= "${shifted(from, -1)}" ` +
    `AND worklogDate <= "${shifted(to, 1)}" ORDER BY key ASC`
  )
}

/** The instants between which the worklogs of an issue are asked, a day wider than the period. */
export function worklogWindow(period: WorklogPeriod): { after: number; before: number } {
  const { from, to } = checkedPeriod(period)
  return { after: Date.parse(from) - DAY_MS, before: Date.parse(to) + 2 * DAY_MS }
}

export interface WorklogPage {
  worklogs: JiraWorklog[]
  /** How many worklogs the page held, kept or not: where the next page starts. */
  read: number
  total: number
}

/** A page of the worklogs of an issue; of each, only author name, start and seconds are read. */
export function worklogPageOf(json: unknown, issueKey: string, period: WorklogPeriod): WorklogPage {
  if (!isRecord(json) || !Array.isArray(json.worklogs) || typeof json.total !== 'number') {
    return bad()
  }
  const worklogs: JiraWorklog[] = []
  for (const raw of json.worklogs) {
    if (!isRecord(raw) || typeof raw.started !== 'string') return bad()
    const seconds = raw.timeSpentSeconds
    if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) return bad()
    const day = raw.started.slice(0, 10)
    if (!DAY.test(day)) return bad()
    if (day < period.from || day > period.to) continue
    const author = isRecord(raw.author) ? raw.author.displayName : undefined
    worklogs.push({
      person: typeof author === 'string' ? author.normalize('NFC') : '',
      day,
      seconds,
      issueKey,
    })
  }
  return { worklogs, read: json.worklogs.length, total: json.total }
}
