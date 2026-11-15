import { useState } from 'react'
import { messages } from './messages.ts'

type Props = {
  label: string
  /** The values Octo has already read: what there is to choose among. */
  known: readonly string[]
  chosen: readonly string[]
  onChange: (chosen: string[]) => void
}

const SEPARATOR = ','
const listOf = (typed: string): string[] =>
  typed
    .split(SEPARATOR)
    .map((value) => value.trim())
    .filter((value) => value !== '')

/**
 * Some of the values Octo already knows: ticked, not typed again. What was chosen before and is
 * no longer among the known values stays in the list, so it can be seen and taken off. While
 * nothing is known yet the values are typed, separated by commas.
 */
export function KnownList({ label, known, chosen, onChange }: Props) {
  const [typed, setTyped] = useState(() => chosen.join(`${SEPARATOR} `))
  const options = [...known, ...chosen.filter((value) => !known.includes(value))]

  if (known.length === 0) {
    return (
      <>
        <label>
          {label}
          <input
            type="text"
            value={typed}
            onChange={(event) => {
              setTyped(event.target.value)
              onChange(listOf(event.target.value))
            }}
          />
        </label>
        <p className="hint">{messages.commaList}</p>
      </>
    )
  }
  return (
    <fieldset>
      <legend>{label}</legend>
      <div className="checks">
        {options.map((option) => (
          <label key={option} className="check">
            <input
              type="checkbox"
              checked={chosen.includes(option)}
              onChange={() =>
                onChange(
                  chosen.includes(option)
                    ? chosen.filter((value) => value !== option)
                    : [...chosen, option],
                )
              }
            />
            {option}
          </label>
        ))}
      </div>
    </fieldset>
  )
}
