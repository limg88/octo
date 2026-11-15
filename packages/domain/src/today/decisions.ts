import {
  orderToday,
  type TodayItem,
  type TodayKind,
  type TodayReturn,
  workdaysBetween,
} from './model.ts'

export const DECISION_STATES = ['done', 'later', 'muted'] as const
export type DecisionState = (typeof DECISION_STATES)[number]

/** What the PM said of a signal, with its date: nothing is changed in the sources. */
export type TodayDecision = {
  key: string
  kind: TodayKind
  state: DecisionState
  /** The day it was said, `YYYY-MM-DD`. */
  at: string
  /** For `later`: the day the signal comes back. */
  until: string | null
  /** How bad the signal was when it was put away: worse than this, it comes back. */
  weight: number
}

/** What the PM keeps about the page of a project. */
export type TodaySettings = {
  decisions: TodayDecision[]
  /** Kinds of signal the PM does not want to see at all. */
  mutedKinds: TodayKind[]
  /** Other addresses of the PM, beside the one of the sign-in. */
  ownAddresses: string[]
}

export const NO_TODAY_SETTINGS: TodaySettings = { decisions: [], mutedKinds: [], ownAddresses: [] }

/** Working days after which a signal marked done, and still there, is shown again. */
export const DONE_GRACE_WORKDAYS = 3
/** Times a kind is put away for good before Octo offers to stop showing it. */
export const MUTE_OFFER_AFTER = 3
/** Decisions kept at most: the oldest go first. */
export const MAX_DECISIONS = 2000

/** The last word of the PM on each signal. */
function latest(decisions: readonly TodayDecision[]): Map<string, TodayDecision> {
  const byKey = new Map<string, TodayDecision>()
  for (const decision of decisions) byKey.set(decision.key, decision)
  return byKey
}

/** Why a signal put away shows again, or that it stays away. */
function comesBack(
  item: TodayItem,
  decision: TodayDecision,
  today: string,
): TodayReturn | 'hidden' {
  if (decision.state === 'muted') return 'hidden'
  if (decision.state === 'later') {
    return decision.until !== null && today < decision.until ? 'hidden' : { why: 'later' }
  }
  if (item.weight > decision.weight) return { why: 'worse', was: decision.weight, now: item.weight }
  return workdaysBetween(decision.at, today) >= DONE_GRACE_WORKDAYS
    ? { why: 'still', since: decision.at }
    : 'hidden'
}

export type TodayPage = {
  items: TodayItem[]
  /** Signals the PM put away and that stay away today. */
  hidden: number
  /** Kinds the PM keeps putting away: Octo offers to stop showing them. */
  muteOffers: TodayKind[]
}

/**
 * The signals of the day after what the PM decided: what is muted or put off stays away, what
 * was marked done comes back when it got worse or is still there after a few working days.
 */
export function applyDecisions(
  items: readonly TodayItem[],
  settings: TodaySettings,
  today: string,
): TodayPage {
  const byKey = latest(settings.decisions)
  const muted = new Set(settings.mutedKinds)
  const shown: TodayItem[] = []
  let hidden = 0
  for (const item of items) {
    if (muted.has(item.facts.kind)) {
      hidden += 1
      continue
    }
    const decision = byKey.get(item.key)
    if (!decision) {
      shown.push(item)
      continue
    }
    const back = comesBack(item, decision, today)
    if (back === 'hidden') hidden += 1
    else shown.push({ ...item, returned: back, ...(back.why === 'later' ? { band: 'due' } : {}) })
  }
  const mutedTimes = new Map<TodayKind, number>()
  for (const decision of byKey.values()) {
    if (decision.state === 'muted') {
      mutedTimes.set(decision.kind, (mutedTimes.get(decision.kind) ?? 0) + 1)
    }
  }
  const muteOffers = [...mutedTimes.entries()]
    .filter(([kind, times]) => times >= MUTE_OFFER_AFTER && !muted.has(kind))
    .map(([kind]) => kind)
  return { items: orderToday(shown), hidden, muteOffers }
}

/** The settings with one more decision; the same signal keeps only its last word. */
export function withDecision(settings: TodaySettings, decision: TodayDecision): TodaySettings {
  const others = settings.decisions.filter((kept) => kept.key !== decision.key)
  return { ...settings, decisions: [...others, decision].slice(-MAX_DECISIONS) }
}

/** The settings without the decision on a signal: it is shown again as if never touched. */
export function withoutDecision(settings: TodaySettings, key: string): TodaySettings {
  return { ...settings, decisions: settings.decisions.filter((kept) => kept.key !== key) }
}

const ADDRESS = /^[^\s@]+@[^\s@]+$/

export function cleanTodaySettings(settings: TodaySettings): TodaySettings {
  return {
    decisions: settings.decisions.slice(-MAX_DECISIONS),
    mutedKinds: [...new Set(settings.mutedKinds)],
    ownAddresses: [
      ...new Set(
        settings.ownAddresses
          .map((address) => address.trim().toLowerCase())
          .filter((address) => ADDRESS.test(address)),
      ),
    ],
  }
}
