import type { BugRow } from './bugs.ts'

/** How a field no tracker filled is named in a filter and in a breakdown. */
export const NOT_STATED = ''

export const BUG_ORDERS = ['days', 'severity', 'created'] as const
export type BugOrder = (typeof BUG_ORDERS)[number]

/** The fields the bugs are split and filtered by. */
export const BUG_FACETS = ['severity', 'environment', 'assignee'] as const
export type BugFacet = (typeof BUG_FACETS)[number]

/**
 * Which bugs of a list the PM wants to see: null for a facet means any value, `NOT_STATED` the
 * bugs whose tracker says nothing of it.
 */
export type BugQuery = {
  severity: string | null
  environment: string | null
  assignee: string | null
  /** Words looked for in the id and in the title. */
  text: string
  order: BugOrder
}

export const NO_BUG_QUERY: BugQuery = {
  severity: null,
  environment: null,
  assignee: null,
  text: '',
  order: 'days',
}

/** One value of a facet: how many bugs have it, and how many of them are stuck. */
export type BreakdownRow = { value: string; count: number; stuck: number }
export type BugBreakdowns = Record<BugFacet, BreakdownRow[]>

const lower = (text: string): string => text.toLocaleLowerCase('en')
const facetOf = (row: BugRow, facet: BugFacet): string => row[facet] ?? NOT_STATED
const byName = (a: string, b: string): number => a.localeCompare(b, 'en', { numeric: true })
/** A value nobody stated comes after every stated one. */
const statedFirst = (a: string, b: string): number =>
  Number(a === NOT_STATED) - Number(b === NOT_STATED) || byName(a, b)

const ORDERS: Record<BugOrder, (a: BugRow, b: BugRow) => number> = {
  days: (a, b) => (b.daysInState ?? -1) - (a.daysInState ?? -1),
  // Trackers number their severities from the gravest: `1 - Critical` comes first.
  severity: (a, b) =>
    statedFirst(facetOf(a, 'severity'), facetOf(b, 'severity')) ||
    (b.daysInState ?? -1) - (a.daysInState ?? -1),
  created: (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt),
}

/** The bugs of a list that pass every filter set, in the order asked. */
export function filterBugs(rows: readonly BugRow[], query: BugQuery): BugRow[] {
  const words = lower(query.text).split(/\s+/).filter(Boolean)
  return rows
    .filter((row) =>
      BUG_FACETS.every((facet) => query[facet] === null || facetOf(row, facet) === query[facet]),
    )
    .filter((row) => {
      const searched = lower(`${row.id} ${row.title}`)
      return words.every((word) => searched.includes(word))
    })
    .sort(ORDERS[query.order])
}

/** Whether a split tells something: not when no bug of the list states the field. */
export const isTelling = (rows: readonly BreakdownRow[]): boolean =>
  rows.some((row) => row.value !== NOT_STATED)

/** The filters of a query that are set, to say them and to take them off. */
export const activeFacets = (query: BugQuery): BugFacet[] =>
  BUG_FACETS.filter((facet) => query[facet] !== null)

export const isFiltered = (query: BugQuery): boolean =>
  activeFacets(query).length > 0 || query.text.trim() !== ''

/**
 * A list of bugs split by severity, by environment and by person: where the trouble gathers.
 * The most numerous value first; for the severity, the gravest.
 */
export function bugBreakdowns(rows: readonly BugRow[]): BugBreakdowns {
  const split = (facet: BugFacet): BreakdownRow[] => {
    const found = new Map<string, BreakdownRow>()
    for (const row of rows) {
      const value = facetOf(row, facet)
      const entry = found.get(value) ?? { value, count: 0, stuck: 0 }
      entry.count += 1
      if (row.stuck) entry.stuck += 1
      found.set(value, entry)
    }
    const entries = [...found.values()]
    return facet === 'severity'
      ? entries.sort((a, b) => statedFirst(a.value, b.value))
      : entries.sort((a, b) => b.count - a.count || statedFirst(a.value, b.value))
  }
  return {
    severity: split('severity'),
    environment: split('environment'),
    assignee: split('assignee'),
  }
}
