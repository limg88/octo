type Props = {
  /** What is wrong with what was typed, one line for each thing to correct. */
  lines: readonly string[]
}

/** Under a field or a group of rows: what in it cannot be saved as it is. */
export function FieldProblems({ lines }: Props) {
  if (lines.length === 0) return null
  return (
    <ul className="field-problems" role="alert">
      {lines.map((line) => (
        <li key={line}>{line}</li>
      ))}
    </ul>
  )
}

/** Beside the button that saves: nothing was saved, and where to look. */
export function NotSaved({ text }: { text: string }) {
  return (
    <span className="field-problems" role="status">
      {text}
    </span>
  )
}
