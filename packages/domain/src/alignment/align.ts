import { type DashboardSettings, type Phase, phaseOf } from '../tracker/model.ts'
import type { AlignItem, AlignmentSettings, AlignTicket } from './model.ts'

/** A client's item with the tickets that stand for it. */
export type AlignedPair = {
  item: AlignItem
  tickets: AlignTicket[]
  /** How they were tied: the key of the ticket among the item's tags, or the item's id in the title. */
  via: 'tag' | 'title'
  /** The group of states each side is in; null when the PM named no group for that state. */
  itemGroup: string | null
  ticketGroup: string | null
  /** Whether the two states mean the same; null when one of them is in no group. */
  coherent: boolean | null
}

/** A ticket that names an item the comparison does not hold. */
export type Orphan = {
  ticket: AlignTicket
  ids: string[]
  /** `unknown`: the client's tracker has no such item. `out_of_scope`: it has, outside the sprint or the tags. */
  reason: 'unknown' | 'out_of_scope'
}

/** A missing item and a ticket without reference whose titles look alike: a pair to confirm by hand. */
export type Suggestion = {
  item: AlignItem
  ticket: AlignTicket
  score: number
  confidence: 'high' | 'medium'
}

export type Alignment = {
  /** The client's items in the sprint: each is in exactly one of the three lists that follow. */
  total: number
  /** Items with a ticket in the same sprint. */
  linked: AlignedPair[]
  /** Items whose ticket exists, in another sprint or in none. */
  needsUpdate: AlignedPair[]
  /** Items with no ticket. */
  missing: AlignItem[]
  /** Pairs, among the two lists above, with more than one ticket for the item. */
  duplicates: AlignedPair[]
  orphans: Orphan[]
  /** Tickets of the sprint that name no item of the client. */
  unreferenced: AlignTicket[]
  suggestions: Suggestion[]
  /** The three lists add up to the total: nothing was lost on the way. */
  adds: boolean
}

const NUMBER = /\d+/g

/** `Aurora\Sprint 2`, `sprint  2` and `Sprint 2` are one sprint; `Sprint 28` is another. */
const sprintKey = (name: string): string =>
  (name.split(/[\\/]/).pop() ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
const sameSprint = (name: string | null, wanted: string): boolean =>
  name !== null && sprintKey(name) === sprintKey(wanted)

/** The ids of the client's items a title names: `[AZDO 123]`, `[AZDO-123, 456]`. */
export function referencedIds(title: string, prefixes: readonly string[]): string[] {
  if (prefixes.length === 0) return []
  const pattern = new RegExp(String.raw`\[(?:${prefixes.join('|')})[\s:#-]+([^\]]*)\]?`, 'gi')
  const ids = [...title.matchAll(pattern)].flatMap((found) => (found[1] ?? '').match(NUMBER) ?? [])
  return [...new Set(ids)]
}

/** Words too common in a title to tell two items apart. */
const COMMON = new Set([
  'the',
  'and',
  'for',
  'with',
  'from',
  'che',
  'per',
  'con',
  'del',
  'della',
  'dei',
  'delle',
  'nel',
  'nella',
  'una',
  'uno',
  'gli',
  'dal',
  'dalla',
  'bug',
  'fix',
  'story',
  'task',
  'user',
  'new',
])
const MIN_WORD = 3

const plainTitle = (title: string): string =>
  title
    .replace(/\[[^\]]*\]/g, ' ')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()

const wordsOf = (plain: string): Set<string> =>
  new Set(plain.split(' ').filter((word) => word.length >= MIN_WORD && !COMMON.has(word)))

function pairsOfLetters(plain: string): Map<string, number> {
  const pairs = new Map<string, number>()
  for (let at = 0; at < plain.length - 1; at += 1) {
    const pair = plain.slice(at, at + 2)
    pairs.set(pair, (pairs.get(pair) ?? 0) + 1)
  }
  return pairs
}

/** How much two texts share, letter pair by letter pair: 0 nothing, 1 the same text. */
function likeness(a: string, b: string): number {
  if (a === b) return a === '' ? 0 : 1
  const left = pairsOfLetters(a)
  const right = pairsOfLetters(b)
  let shared = 0
  let total = 0
  for (const [pair, count] of left) {
    shared += Math.min(count, right.get(pair) ?? 0)
    total += count
  }
  for (const count of right.values()) total += count
  return total === 0 ? 0 : (2 * shared) / total
}

function sharedWords(a: Set<string>, b: Set<string>): number {
  const union = new Set([...a, ...b])
  if (union.size === 0) return 0
  let common = 0
  for (const word of a) if (b.has(word)) common += 1
  return common / union.size
}

/** Two titles are proposed as a pair when they are alike both in their letters and in their words. */
const MIN_LIKENESS = 0.45
const MIN_SHARED_WORDS = 0.35
const HIGH_CONFIDENCE = 0.95
const SCORE_DECIMALS = 2

function suggest(missing: readonly AlignItem[], free: readonly AlignTicket[]): Suggestion[] {
  const candidates = missing.flatMap((item) => {
    const title = plainTitle(item.title)
    const words = wordsOf(title)
    return free.flatMap((ticket): Suggestion[] => {
      const other = plainTitle(ticket.title)
      const score = likeness(title, other)
      if (score < MIN_LIKENESS || sharedWords(words, wordsOf(other)) < MIN_SHARED_WORDS) return []
      return [
        {
          item,
          ticket,
          score: Number(score.toFixed(SCORE_DECIMALS)),
          confidence: score >= HIGH_CONFIDENCE ? 'high' : 'medium',
        },
      ]
    })
  })
  // The best pair first; an item and a ticket are proposed once each.
  candidates.sort((a, b) => b.score - a.score || a.item.id.localeCompare(b.item.id))
  const items = new Set<string>()
  const tickets = new Set<string>()
  return candidates.filter((candidate) => {
    if (items.has(candidate.item.id) || tickets.has(candidate.ticket.key)) return false
    items.add(candidate.item.id)
    tickets.add(candidate.ticket.key)
    return true
  })
}

const inScope = (item: AlignItem, settings: AlignmentSettings): boolean =>
  sameSprint(item.sprint, settings.sprint) &&
  (settings.period === '' || item.period === settings.period) &&
  (settings.tags.length === 0 ||
    settings.tags.some((tag) => item.tags.some((own) => own.toLowerCase() === tag.toLowerCase())))

/**
 * Compares the client's items of a sprint with the supplier's tickets. An item and a ticket are
 * tied when the item carries the key of the ticket among its tags or, failing that, when the
 * title of the ticket names the id of the item. Every item ends in one list: with a ticket in the
 * sprint, with a ticket elsewhere, or without one. Nothing is tied on likeness alone: titles that
 * look alike are only proposed.
 */
export function alignTrackers(
  items: readonly AlignItem[],
  tickets: readonly AlignTicket[],
  settings: AlignmentSettings,
): Alignment {
  const scoped = items.filter((item) => inScope(item, settings))
  const byKey = new Map(tickets.map((ticket) => [ticket.key.toUpperCase(), ticket]))
  const citing = new Map<string, AlignTicket[]>()
  const cited = new Map<string, string[]>()
  for (const ticket of tickets) {
    const ids = referencedIds(ticket.title, settings.referencePrefixes)
    cited.set(ticket.key, ids)
    for (const id of ids) citing.set(id, [...(citing.get(id) ?? []), ticket])
  }
  const groupOf = (state: string, side: 'item' | 'ticket'): string | null =>
    settings.stateGroups.find((group) =>
      group[side].some((name) => name.toLowerCase() === state.toLowerCase()),
    )?.name ?? null

  const linked: AlignedPair[] = []
  const needsUpdate: AlignedPair[] = []
  const missing: AlignItem[] = []
  const tied = new Set<string>()
  for (const item of scoped) {
    const tagged = item.tags.flatMap((tag) => {
      const ticket = byKey.get(tag.toUpperCase())
      return ticket ? [ticket] : []
    })
    const found = tagged.length > 0 ? tagged : (citing.get(item.id) ?? [])
    if (found.length === 0) {
      missing.push(item)
      continue
    }
    for (const ticket of found) tied.add(ticket.key)
    const inSprint = found.filter((ticket) => sameSprint(ticket.sprint, settings.sprint))
    // The ticket whose state is compared: the one of the sprint, when there is one.
    const main = inSprint[0] ?? found[0]
    const itemGroup = groupOf(item.state, 'item')
    const ticketGroup = main ? groupOf(main.status, 'ticket') : null
    const pair: AlignedPair = {
      item,
      tickets: [...found],
      via: tagged.length > 0 ? 'tag' : 'title',
      itemGroup,
      ticketGroup,
      coherent: itemGroup === null || ticketGroup === null ? null : itemGroup === ticketGroup,
    }
    if (inSprint.length > 0) linked.push(pair)
    else needsUpdate.push(pair)
  }

  const scopedIds = new Set(scoped.map((item) => item.id))
  const allIds = new Set(items.map((item) => item.id))
  const sprintTickets = tickets.filter((ticket) => sameSprint(ticket.sprint, settings.sprint))
  const orphans: Orphan[] = []
  const unreferenced: AlignTicket[] = []
  for (const ticket of sprintTickets) {
    if (tied.has(ticket.key)) continue
    const ids = cited.get(ticket.key) ?? []
    if (ids.length === 0) {
      unreferenced.push(ticket)
      continue
    }
    const outside = ids.filter((id) => !scopedIds.has(id))
    const unknown = outside.filter((id) => !allIds.has(id))
    orphans.push({
      ticket,
      ids: unknown.length > 0 ? unknown : outside,
      reason: unknown.length > 0 ? 'unknown' : 'out_of_scope',
    })
  }

  return {
    total: scoped.length,
    linked,
    needsUpdate,
    missing,
    duplicates: [...linked, ...needsUpdate].filter((pair) => pair.tickets.length > 1),
    orphans,
    unreferenced,
    suggestions: suggest(missing, unreferenced),
    adds: linked.length + needsUpdate.length + missing.length === scoped.length,
  }
}

const CSV_HEADER = ['Summary', 'Issue Type', 'Priority', 'Assignee', 'Description', 'Sprint']
const TAG = /<[^>]+>/g
const ENTITIES: Readonly<Record<string, string>> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
}

/** A description as plain text: the tracker's markup removed, lines kept. */
const plainText = (text: string): string =>
  text
    .replace(/<\s*(?:br|\/p|\/div|\/li)\s*\/?>/gi, '\n')
    .replace(TAG, '')
    .replace(/&(?:nbsp|amp|lt|gt|quot|#39);/g, (entity) => ENTITIES[entity] ?? entity)
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

const csvCell = (value: string): string =>
  /[",\n\r]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value

/**
 * The missing items as a file the supplier's tracker imports: one ticket per item, its title
 * carrying the id of the item so the next comparison ties them. The priority is left empty: the
 * team sets it.
 */
export function missingTicketsCsv(
  missing: readonly AlignItem[],
  settings: AlignmentSettings,
): string {
  const prefix = settings.referencePrefixes[0]
  const typeOf = (type: string): string =>
    settings.typeMap.find((pair) => pair.item.toLowerCase() === type.toLowerCase())?.ticket ?? type
  const rows = missing.map((item) => [
    prefix ? `[${prefix} ${item.id}] ${item.title}` : item.title,
    typeOf(item.type),
    '',
    item.assignee ?? '',
    plainText(item.description),
    settings.sprint,
  ])
  return `${[CSV_HEADER, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`
}

/** A state of the client's tracker the alignment and the dashboard read in two different ways. */
export type StateMismatch = {
  state: string
  group: string
  groupPhase: Phase
  dashboardPhase: Phase
}

/**
 * The states the PM put in a group of the alignment whose name says a phase (closed, in
 * verification…) that is not the one the dashboard reads the state as: the two sections would
 * count the same sprint differently. A group whose name says no phase is compared with nothing.
 */
export function stateMismatches(
  settings: Pick<AlignmentSettings, 'stateGroups'>,
  dashboard: Pick<DashboardSettings, 'phases'>,
): StateMismatch[] {
  const NO_HAND_MAPPING = { phases: {} }
  return settings.stateGroups.flatMap((group) => {
    const groupPhase = phaseOf(group.name, NO_HAND_MAPPING)
    // «Work» is also what an unknown name falls into: only a name that says a phase counts.
    if (groupPhase === 'work') return []
    return group.item.flatMap((state) => {
      const dashboardPhase = phaseOf(state, dashboard)
      return dashboardPhase === groupPhase
        ? []
        : [{ state, group: group.name, groupPhase, dashboardPhase }]
    })
  })
}
