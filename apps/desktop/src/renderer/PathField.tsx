import { useId } from 'react'
import { messages } from './messages.ts'

type Props = {
  label: string
  value: string
  onChange: (value: string) => void
  /** Places of the project that look right: proposed while typing. */
  candidates?: readonly string[]
  /** Opens the dialog of the system on the project folder; null when the PM closes it. */
  onChoose: () => Promise<string | null>
}

/** A file or a folder of the project: chosen from the dialog of the system, or typed. */
export function PathField({ label, value, onChange, candidates = [], onChoose }: Props) {
  const id = useId()
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <span className="path-field">
        <input
          id={id}
          type="text"
          list={candidates.length > 0 ? `${id}-found` : undefined}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          type="button"
          aria-label={`${messages.choosePath}: ${label}`}
          onClick={() =>
            void onChoose().then((chosen) => {
              if (chosen !== null) onChange(chosen)
            })
          }
        >
          {messages.choosePath}
        </button>
      </span>
      {candidates.length > 0 && (
        <datalist id={`${id}-found`}>
          {candidates.map((candidate) => (
            <option key={candidate} value={candidate} />
          ))}
        </datalist>
      )}
    </div>
  )
}
