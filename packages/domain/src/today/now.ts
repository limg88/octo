import { orderToday, type TodayItem } from './model.ts'

/** What comes first today, at most: two that are certain are better than three to fill. */
export const NOW_LIMIT = 3
/** A meeting that starts within these hours comes before everything else. */
export const MEETING_SOON_HOURS = 2

/** Why a signal comes first, in the order the rules are tried. */
export const NOW_RULES = ['meeting_soon', 'due', 'later', 'important_mail', 'worse'] as const
export type NowRule = (typeof NOW_RULES)[number]

/** A signal that comes first today, with the rule that put it there. */
export type NowItem = {
  item: TodayItem
  rule: NowRule
  /** For a meeting: the minutes before it starts. */
  minutes?: number
}

const MINUTE_MS = 60 * 1000
const MEETING_SOON_MS = MEETING_SOON_HOURS * 60 * MINUTE_MS

/** The minutes before a meeting starts, when it has not started and starts soon; null otherwise. */
function minutesToMeeting(item: TodayItem, now: Date): number | null {
  if (item.facts.kind !== 'meeting') return null
  const wait = Date.parse(item.facts.start) - now.getTime()
  return wait > 0 && wait <= MEETING_SOON_MS ? Math.ceil(wait / MINUTE_MS) : null
}

/** The first rule a signal falls under, or null: such a signal never comes first. */
function ruleOf(item: TodayItem, now: Date): Omit<NowItem, 'item'> | null {
  if (item.band === 'alert') return null
  const minutes = minutesToMeeting(item, now)
  if (minutes !== null) return { rule: 'meeting_soon', minutes }
  // A meeting of the day is due by its hour, not by a date: far or begun, it does not come first.
  if (item.facts.kind === 'meeting') return null
  if (item.dueBecause !== undefined) return { rule: 'due' }
  if (item.returned?.why === 'later') return { rule: 'later' }
  if (item.facts.kind === 'mail_reply' && item.facts.judgement?.importance === 'alta') {
    return { rule: 'important_mail' }
  }
  if (item.returned?.why === 'worse') return { rule: 'worse' }
  return null
}

/**
 * The few things that come first now, chosen by rules a PM can read: a meeting about to start,
 * what a date makes due, what was put off until today, a mail that matters much, what got worse.
 * What falls under no rule is left out, even when there is room.
 */
export function nowItems(items: readonly TodayItem[], now: Date): NowItem[] {
  const chosen = orderToday(items).flatMap((item): NowItem[] => {
    const rule = ruleOf(item, now)
    return rule ? [{ item, ...rule }] : []
  })
  // The sort is stable: within a rule the order of the page holds.
  return chosen
    .sort((a, b) => NOW_RULES.indexOf(a.rule) - NOW_RULES.indexOf(b.rule))
    .slice(0, NOW_LIMIT)
}
