import {
  COUNTED_KINDS,
  type MailTurn,
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
  /** The conversations of which the PM said whose turn it is. */
  mailTurns: MailTurnChoice[]
  /** The signals of the last time the page was computed: what is gone since is told. */
  present: PresentSignal[]
  /** The signals that went away by themselves, with the day they did. */
  resolved: ResolvedSignal[]
  /** When the PM last looked at the page; null when never. */
  lastSeenAt: string | null
  /** The signals that were on the page then: what came since is marked. */
  seen: PresentSignal[]
  /** Whether the system tells the PM when a signal comes first. */
  notify: boolean
}

/** A signal as the page last computed it. */
export type PresentSignal = { key: string; kind: TodayKind; weight: number }
/** A signal that is no longer there because its data changed, not because the PM said so. */
export type ResolvedSignal = { key: string; kind: TodayKind; day: string }

/** The PM's word on a conversation of the mail: it is theirs to answer, or it is not. */
export type MailTurnChoice = { conversation: string; turn: MailTurn; at: string }

export const NO_TODAY_SETTINGS: TodaySettings = {
  decisions: [],
  mutedKinds: [],
  ownAddresses: [],
  mailTurns: [],
  present: [],
  resolved: [],
  lastSeenAt: null,
  seen: [],
  notify: true,
}

/** Signals remembered at most from a computation to the next. */
export const MAX_PRESENT = 1000
/** Kinds that end with the hour or the day they name: their going away resolves nothing. */
export const TIMED_KINDS: readonly TodayKind[] = ['meeting', 'calendar']

/** Words on conversations kept at most: the oldest go first. */
export const MAX_MAIL_TURNS = 500

/** The PM's word on each conversation, the last one said. */
export function mailTurnsOf(settings: Pick<TodaySettings, 'mailTurns'>): Record<string, MailTurn> {
  return Object.fromEntries(settings.mailTurns.map((choice) => [choice.conversation, choice.turn]))
}

/** The settings with the PM's word on a conversation; null takes it back. */
export function withMailTurn(
  settings: TodaySettings,
  conversation: string,
  turn: MailTurn | null,
  at: string,
): TodaySettings {
  const others = settings.mailTurns.filter((choice) => choice.conversation !== conversation)
  return {
    ...settings,
    mailTurns: (turn === null ? others : [...others, { conversation, turn, at }]).slice(
      -MAX_MAIL_TURNS,
    ),
  }
}

const DAY_LENGTH = 'YYYY-MM-DD'.length
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
  // Only a weight that counts what is wrong tells better from worse: days that pass do not.
  if (COUNTED_KINDS.includes(item.facts.kind)) {
    if (item.weight > decision.weight) {
      return { why: 'worse', was: decision.weight, now: item.weight }
    }
    // What is getting better is being done: it stays away for as long as it does not get worse.
    if (item.weight < decision.weight) return 'hidden'
  }
  return workdaysBetween(decision.at, today) >= DONE_GRACE_WORKDAYS
    ? { why: 'still', since: decision.at }
    : 'hidden'
}

/** The day Claude judged the mail of a signal, when the signal is a mail and it was kept. */
function judgedDay(item: TodayItem): string | null {
  const judged =
    item.facts.kind === 'mail_reply' || item.facts.kind === 'mail_follow'
      ? item.facts.judgement?.judgedAt
      : undefined
  return judged === undefined ? null : judged.slice(0, DAY_LENGTH)
}

/** A signal that stays away today, with the decision that keeps it there. */
export type HiddenItem = {
  item: TodayItem
  /** What the PM decided, or `claude` when Claude read that the signal asks nothing. */
  state: DecisionState | 'claude'
  /** The day the decision was taken. */
  at: string
  /** For `later`: the day it comes back. */
  until: string | null
}

export type TodayPage = {
  items: TodayItem[]
  /** Signals the PM put away and that stay away today, those of a muted kind included. */
  hidden: number
  /** The signals a decision keeps away, to be read and taken back. */
  hiddenItems: HiddenItem[]
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
  const hiddenItems: HiddenItem[] = []
  let ofMutedKind = 0
  for (const item of items) {
    if (muted.has(item.facts.kind)) {
      ofMutedKind += 1
      continue
    }
    if (item.setAsideBy === 'claude') {
      hiddenItems.push({ item, state: 'claude', at: judgedDay(item) ?? today, until: null })
      continue
    }
    // A decision taken when the signal had another key is the decision on this signal.
    const decision =
      byKey.get(item.key) ??
      (item.formerKeys ?? []).map((key) => byKey.get(key)).find((found) => found !== undefined)
    if (!decision) {
      shown.push(item)
      continue
    }
    const back = comesBack(item, decision, today)
    if (back === 'hidden') {
      hiddenItems.push({ item, state: decision.state, at: decision.at, until: decision.until })
    } else {
      shown.push({ ...item, returned: back, ...(back.why === 'later' ? { band: 'due' } : {}) })
    }
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
  return {
    items: orderToday(shown),
    hidden: hiddenItems.length + ofMutedKind,
    hiddenItems: hiddenItems.sort(
      (a, b) => b.at.localeCompare(a.at) || a.item.key.localeCompare(b.item.key),
    ),
    muteOffers,
  }
}

/**
 * The settings after the page was computed again. A signal that was there and is gone went away
 * by itself: it is told for the day, and what the PM had marked done about it is forgotten, so
 * that the same trouble coming back is new. A signal of a kind that could not be told now
 * (`unsettled`: its source was not read, or its days are over) is neither gone nor there.
 */
export function reconcileSignals(
  settings: TodaySettings,
  items: readonly TodayItem[],
  unsettled: ReadonlySet<TodayKind>,
  today: string,
): TodaySettings {
  const there = new Set(items.flatMap((item) => [item.key, ...(item.formerKeys ?? [])]))
  const told = (kind: TodayKind): boolean => !unsettled.has(kind) && !TIMED_KINDS.includes(kind)
  const gone = settings.present.filter((signal) => !there.has(signal.key) && told(signal.kind))
  const resolved = [
    ...settings.resolved.filter(
      (signal) =>
        signal.day === today &&
        !there.has(signal.key) &&
        gone.every((left) => left.key !== signal.key),
    ),
    ...gone.map(({ key, kind }) => ({ key, kind, day: today })),
  ]
  const untold = settings.present.filter(
    (signal) => !there.has(signal.key) && unsettled.has(signal.kind),
  )
  return {
    ...settings,
    decisions: settings.decisions.filter(
      (decision) => decision.state !== 'done' || there.has(decision.key) || !told(decision.kind),
    ),
    present: [
      ...untold,
      ...items.map((item) => ({ key: item.key, kind: item.facts.kind, weight: item.weight })),
    ].slice(-MAX_PRESENT),
    resolved,
  }
}

/** The settings with one more decision; the same signal keeps only its last word. */
export function withDecision(settings: TodaySettings, decision: TodayDecision): TodaySettings {
  const others = settings.decisions.filter((kept) => kept.key !== decision.key)
  return { ...settings, decisions: [...others, decision].slice(-MAX_DECISIONS) }
}

/**
 * The settings without the decision on a signal: it is shown again as if never touched. A
 * decision taken when the signal had another key goes with it.
 */
export function withoutDecision(
  settings: TodaySettings,
  key: string,
  formerKeys: readonly string[] = [],
): TodaySettings {
  const keys = new Set([key, ...formerKeys])
  return { ...settings, decisions: settings.decisions.filter((kept) => !keys.has(kept.key)) }
}

const ADDRESS = /^[^\s@]+@[^\s@]+$/

export function cleanTodaySettings(settings: TodaySettings): TodaySettings {
  return {
    decisions: settings.decisions.slice(-MAX_DECISIONS),
    mailTurns: (settings.mailTurns ?? []).slice(-MAX_MAIL_TURNS),
    present: (settings.present ?? []).slice(-MAX_PRESENT),
    resolved: settings.resolved ?? [],
    lastSeenAt: settings.lastSeenAt ?? null,
    seen: (settings.seen ?? []).slice(-MAX_PRESENT),
    notify: settings.notify ?? true,
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
