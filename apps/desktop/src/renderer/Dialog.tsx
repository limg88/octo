import { type ReactNode, useEffect, useRef } from 'react'
import type { ErrorCode } from '../shared/api.ts'
import { errorText, messages } from './messages.ts'

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
  useEffect(() => panel.current?.focus(), [])

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
        onKeyDown={(event) => {
          if (event.key === 'Escape') onClose()
        }}
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
