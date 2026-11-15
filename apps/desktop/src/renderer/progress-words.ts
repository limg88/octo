import type { ProgressProblem, ProgressWarning } from '@octo/domain'
import { messages } from './messages.ts'

const text = messages.progress

/** Why the shares cannot be computed, in the words of the PM. */
export function problemText(problem: ProgressProblem): string {
  switch (problem.kind) {
    case 'no_positions':
      return text.problem.no_positions
    case 'over_total':
      return text.problem.over_total(problem.n, text.money(problem.excess))
    case 'unknown_positions':
      return text.problem.unknown_positions(problem.n, problem.codes.join(', '))
    case 'over_positions':
      return text.problem.over_positions(problem.n, text.money(problem.excess))
  }
}

/** Something to look at before a form is sent; it stops nothing. */
export function warningText(warning: ProgressWarning): string {
  switch (warning.kind) {
    case 'total_differs':
      return text.warning.total_differs(text.money(warning.declared), text.money(warning.positions))
    case 'dates_missing':
      return text.warning.dates_missing(warning.n)
    case 'dates_not_chained':
      return text.warning.dates_not_chained(warning.n)
    case 'note_missing':
      return text.warning.note_missing(warning.n)
  }
}

/** The request a warning is about; null when it is about the whole order. */
export const warningRequest = (warning: ProgressWarning): number | null =>
  'n' in warning ? warning.n : null
