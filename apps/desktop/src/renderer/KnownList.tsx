import { useState } from 'react'
import { messages } from './messages.ts'

type Props = {
  label: string
  /** The values Octo has already read: what there is to choose among. */
  known: readonly string[]
  chosen: readonly string[]
  onChange: (chosen: string[]) => void
}

const text = messages.knownList
const SEPARATOR = ','
const listOf = (typed: string): string[] =>
  typed
    .split(SEPARATOR)
    .map((value) => value.trim())
    .filter((value) => value !== '')

/** With fewer values than this all are in sight: a search would only take room. */
const SEARCH_FROM_VALUES = 9

/**
 * Some of the values Octo already knows: ticked, not typed again. However many there are the
 * list keeps its height: what is chosen stays in sight above it, and a field finds the others.
 * What was chosen before and is no longer among the known values stays in the list, so it can be
 * seen and taken off. While nothing is known yet the values are typed, separated by commas.
 */
export function KnownList({ label, known, chosen, onChange }: Props) {
  const [typed, setTyped] = useState(() => chosen.join(`${SEPARATOR} `))
  const [sought, setSought] = useState('')
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
  const searchable = options.length >= SEARCH_FROM_VALUES
  const words = searchable ? sought.trim().toLocaleLowerCase('it') : ''
  const found = options.filter((option) => option.toLocaleLowerCase('it').includes(words))
  const toggle = (option: string) =>
    onChange(
      chosen.includes(option) ? chosen.filter((value) => value !== option) : [...chosen, option],
    )
  return (
    <fieldset className="known-list">
      <legend>{label}</legend>
      {searchable && (
        <>
          <ul className="chosen" aria-label={text.chosen(label)}>
            {chosen.length === 0 && <li className="hint">{text.noneChosen}</li>}
            {chosen.map((value) => (
              <li key={value} className="chosen-value">
                {value}
                <button
                  type="button"
                  className="signal-remove"
                  aria-label={text.remove(value)}
                  onClick={() => toggle(value)}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
          <input
            type="search"
            aria-label={text.searchIn(label)}
            placeholder={text.search(options.length)}
            value={sought}
            onChange={(event) => setSought(event.target.value)}
          />
        </>
      )}
      <div className={searchable ? 'checks checks-scroll' : 'checks'}>
        {found.map((option) => (
          <label key={option} className="check">
            <input
              type="checkbox"
              checked={chosen.includes(option)}
              onChange={() => toggle(option)}
            />
            {option}
          </label>
        ))}
        {found.length === 0 && <p className="hint">{text.nothingFound}</p>}
      </div>
    </fieldset>
  )
}
