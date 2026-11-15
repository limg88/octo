import { type KeyboardEvent, type ReactNode, useEffect, useRef } from 'react'
import type { ErrorCode } from '../shared/api.ts'
import { errorText, messages } from './messages.ts'

/** What Tab stops at inside a dialog. */
const FOCUSABLE = 'button:not(:disabled), input:not(:disabled), select, textarea, a[href]'

type Props = {
  title: string
  /** What went wrong with the last thing asked from this dialog. */
  error?: ErrorCode | null
  onClose: () => void
  children: ReactNode
}

/** A window over the page for one thing to decide: it closes with Escape, the cross or outside. */
export function Dialog({ title, error = null, onClose, children }: Props) {
  const panel = useRef<HTMLDivElement>(null)
  // The focus goes into the dialog, and back to where it was when the dialog closes.
  useEffect(() => {
    const before = document.activeElement
    panel.current?.focus()
    return () => {
      if (before instanceof HTMLElement) before.focus()
    }
  }, [])

  /** Tab goes round inside the dialog: what is behind it cannot be reached by mistake. */
  function keepInside(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') return onClose()
    if (event.key !== 'Tab' || !panel.current) return
    const stops = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)]
    const first = stops[0]
    const last = stops.at(-1)
    if (!first || !last) return
    const at = document.activeElement
    if (event.shiftKey && (at === first || at === panel.current)) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && at === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: a click outside the dialog closes it; the keyboard has Escape and the cross.
    <div
      className="dialog-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={panel}
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onKeyDown={keepInside}
      >
        <header className="dialog-header">
          <h2>{title}</h2>
          <button type="button" className="quiet" aria-label={messages.close} onClick={onClose}>
            ×
          </button>
        </header>
        {error && (
          <p className="warning" role="alert">
            {errorText(error)}
          </p>
        )}
        {children}
      </div>
    </div>
  )
}
