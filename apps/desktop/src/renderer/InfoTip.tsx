import { useId, useState } from 'react'

type Props = {
  /** What the icon answers, read by who cannot see it. */
  title: string
  /** What to do, one step after the other. */
  steps: readonly string[]
  /** What to know once the steps are done. */
  note?: string
}

/** A small "i" beside a field: a short guide that opens on request and closes by itself. */
export function InfoTip({ title, steps, note }: Props) {
  const [open, setOpen] = useState(false)
  const panel = useId()
  return (
    <span className="info-tip">
      <button
        type="button"
        className="info-tip-button"
        aria-label={title}
        aria-expanded={open}
        aria-controls={panel}
        onClick={() => setOpen(!open)}
        onBlur={() => setOpen(false)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setOpen(false)
        }}
      >
        i
      </button>
      {open && (
        <span id={panel} className="info-tip-panel" role="note">
          <strong>{title}</strong>
          {steps.length > 0 && (
            <ol>
              {steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          )}
          {note && <span className="hint">{note}</span>}
        </span>
      )}
    </span>
  )
}
