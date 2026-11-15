/** Why a line the PM typed cannot be kept. */
export type LineReason = 'shape' | 'amount' | 'date' | 'side' | 'cell'

/** A line that was not understood: where it is, what it says and what is wrong with it. */
export type LineProblem = { line: number; text: string; reason: LineReason }

/** What was read from a field typed one item per line, and what could not be read. */
export type Lines<T> = { values: T[]; problems: LineProblem[] }

/** What reading one line gives: its value, or why it has none. */
export type LineRead<T> = { value: T } | { reason: LineReason }

/**
 * Reads a field one item per line. Empty lines are skipped; a line that is not understood is
 * never dropped in silence: it comes back as a problem, with its place in the field.
 */
export function readLines<T>(text: string, read: (line: string) => LineRead<T>): Lines<T> {
  const result: Lines<T> = { values: [], problems: [] }
  text.split('\n').forEach((raw, index) => {
    const line = raw.trim()
    if (line === '') return
    const outcome = read(line)
    if ('value' in outcome) result.values.push(outcome.value)
    else result.problems.push({ line: index + 1, text: line, reason: outcome.reason })
  })
  return result
}

/** One value typed in a field of its own, read as a line: the same problems, the same words. */
export function readValue<T>(text: string, read: (value: string) => LineRead<T>): Lines<T> {
  return readLines(text.replaceAll('\n', ' '), read)
}

export const noProblems = (...fields: Lines<unknown>[]): boolean =>
  fields.every((field) => field.problems.length === 0)
