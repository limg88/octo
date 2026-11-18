import type { ProgressReading } from './model.ts'

/**
 * Where the progress of a project code comes from, in the order they are tried. `system`: what
 * the company's system says of the period. `recognized`: the revenue recognised over the order.
 * `costs`: the costs so far over those of the whole project, an estimate Octo computes.
 */
export const PROGRESS_SOURCES = ['system', 'recognized', 'costs'] as const
export type ProgressSource = (typeof PROGRESS_SOURCES)[number]

/** How far a project code is, with what says so. Octo never writes it: it is read. */
export type SheetProgress = {
  /** Between 0 and 1. */
  share: number
  source: ProgressSource
  /** The day the figure is of, `YYYY-MM-DD`; null when its source carries no day. */
  day: string | null
}

const WHOLE = 1
const share = (value: number): number => Math.min(WHOLE, Math.max(0, value))

/**
 * The progress of a project code up to a month: the last period the company's system tells up
 * to then; without one the revenue recognised over the order; without those the costs so far
 * over the costs of the whole project. Null when none of the three can be told.
 */
export function sheetProgress(input: {
  readings: readonly ProgressReading[]
  /** The last month counted, `YYYY-MM`. */
  through: string
  recognized: number | null
  ordered: number | null
  costs: number
  /** The costs of the whole project, as last written; null when never written. */
  totalCosts: number | null
}): SheetProgress | null {
  const { through, recognized, ordered, costs, totalCosts } = input
  const told = input.readings
    .filter((reading) => reading.day.slice(0, through.length) <= through)
    .sort((a, b) => a.day.localeCompare(b.day))
    .at(-1)
  if (told !== undefined) return { share: share(told.share), source: 'system', day: told.day }
  if (recognized !== null && ordered !== null && ordered > 0) {
    return { share: share(recognized / ordered), source: 'recognized', day: null }
  }
  if (totalCosts !== null && totalCosts > 0) {
    return { share: share(costs / totalCosts), source: 'costs', day: null }
  }
  return null
}
