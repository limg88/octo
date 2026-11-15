import type { LineProblem } from './lines.ts'
import { messages } from './messages.ts'

type Props = {
  problems: readonly LineProblem[]
  /** The form a line must have, as the label of the field writes it. */
  shape: string
  /** A field that holds one value says what is wrong without naming the line. */
  single?: boolean
}

/** Under a field: every line of it that was not understood, and how to write it. */
export function LineProblems({ problems, shape, single = false }: Props) {
  if (problems.length === 0) return null
  return (
    <ul className="field-problems" role="alert">
      {problems.map((problem) => (
        <li key={problem.line}>
          {single
            ? messages.lines.single[problem.reason](shape)
            : messages.lines.line(problem.line, problem.text, problem.reason, shape)}
        </li>
      ))}
    </ul>
  )
}
