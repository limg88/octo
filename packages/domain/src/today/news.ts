import type { PresentSignal, TodaySettings } from './decisions.ts'
import { isToDo, type TodayItem, type TodayKind } from './model.ts'
import type { NowItem } from './now.ts'

/** What changed in a signal since the PM last looked at the page. */
export type TodayMark = 'new' | 'worse'

/**
 * The kinds whose weight counts what is wrong: more of it is worse. The weight of the others is
 * the days they have waited, which grows by itself and tells nothing new.
 */
export const COUNTED_KINDS: readonly TodayKind[] = [
  'hours',
  'forecast',
  'bugs_stuck',
  'requirements',
  'alignment',
  'risk_candidates',
]

/**
 * The signals that are new or got worse since the PM last looked at the page, by their key.
 * Before the first look nothing is marked: everything would be new.
 */
export function marksOf(
  items: readonly TodayItem[],
  settings: Pick<TodaySettings, 'lastSeenAt' | 'seen'>,
): Record<string, TodayMark> {
  if (settings.lastSeenAt === null) return {}
  const seen = new Map(settings.seen.map((signal) => [signal.key, signal]))
  const marks: Record<string, TodayMark> = {}
  for (const item of items) {
    const before =
      seen.get(item.key) ??
      (item.formerKeys ?? []).map((key) => seen.get(key)).find((found) => found !== undefined)
    if (before === undefined) marks[item.key] = 'new'
    else if (COUNTED_KINDS.includes(item.facts.kind) && item.weight > before.weight) {
      marks[item.key] = 'worse'
    }
  }
  return marks
}

/** The settings after the PM looked at the page: what is on it now is what they have seen. */
export function withVisit(
  settings: TodaySettings,
  items: readonly TodayItem[],
  at: string,
): TodaySettings {
  const seen: PresentSignal[] = items.map((item) => ({
    key: item.key,
    kind: item.facts.kind,
    weight: item.weight,
  }))
  return { ...settings, lastSeenAt: at, seen }
}

/** How many things the page asks of the PM today: what comes first and what is to do. */
export function todayCount(items: readonly TodayItem[], now: readonly NowItem[]): number {
  const first = new Set(now.map((entry) => entry.item.key))
  return first.size + items.filter((item) => isToDo(item) && !first.has(item.key)).length
}

/**
 * The first signal that comes first now and did not at the reading before; null when there is
 * none, or when there was no reading before: at the first one everything would be new.
 */
export function firstEntered(
  before: readonly string[] | undefined,
  now: readonly NowItem[],
): NowItem | null {
  if (before === undefined) return null
  return now.find((entry) => !before.includes(entry.item.key)) ?? null
}
