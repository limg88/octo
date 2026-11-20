import { useId } from 'react'
import { messages } from './messages.ts'

type Props = {
  label: string
  /** The month as `YYYY-MM`; empty when the period is not one whole month. */
  value: string
  onChange: (month: string) => void
}

/** The month `steps` after a month written `YYYY-MM`. */
export function shiftMonth(month: string, steps: number): string {
  const [year = 0, number = 1] = month.split('-').map(Number)
  return new Date(Date.UTC(year, number - 1 + steps, 1)).toISOString().slice(0, 7)
}

/** A month to choose, with one step back and one forward: what is done every month. */
export function MonthField({ label, value, onChange }: Props) {
  const id = useId()
  const step = (steps: number) => () => onChange(shiftMonth(value, steps))
  return (
    <div className="month-field">
      <label htmlFor={id}>{label}</label>
      <span className="month-field-step">
        <button
          type="button"
          aria-label={messages.monthBefore}
          disabled={value === ''}
          onClick={step(-1)}
        >
          ‹
        </button>
        <input
          id={id}
          type="month"
          value={value}
          onChange={(event) => {
            if (event.target.value !== '') onChange(event.target.value)
          }}
        />
        <button
          type="button"
          aria-label={messages.monthAfter}
          disabled={value === ''}
          onClick={step(1)}
        >
          ›
        </button>
      </span>
    </div>
  )
}
