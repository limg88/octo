import type { DashboardRange } from '@octo/application'

/** The periods offered at one click; `custom` is the PM's own two dates. */
export const RANGE_PRESETS = ['w8', 'm3', 'm6', 'y1', 'custom'] as const
export type RangePreset = (typeof RANGE_PRESETS)[number]

const WEEKS_SHOWN = 8
const PRESET_MONTHS: Record<Exclude<RangePreset, 'w8' | 'custom'>, number> = {
  m3: 3,
  m6: 6,
  y1: 12,
}

const dayOf = (date: Date): string => date.toISOString().slice(0, 10)

/** The range a preset stands for, ending today: weeks for the short one, months for the others. */
export function presetRange(preset: Exclude<RangePreset, 'custom'>, today: Date): DashboardRange {
  const from = new Date(today)
  if (preset === 'w8') {
    from.setUTCDate(from.getUTCDate() - 7 * (WEEKS_SHOWN - 1))
    return { from: dayOf(from), to: dayOf(today), granularity: 'week' }
  }
  from.setUTCMonth(from.getUTCMonth() - (PRESET_MONTHS[preset] - 1), 1)
  return { from: dayOf(from), to: dayOf(today), granularity: 'month' }
}

/** The end of a range as an instant: the whole last day counts. */
export const wholeDays = (range: DashboardRange): DashboardRange => ({
  ...range,
  to: range.to.length === 10 ? `${range.to}T23:59:59.999Z` : range.to,
})
