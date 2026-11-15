import type { ReactNode } from 'react'

/** A small turning ring: something is being done. The words beside it say what. */
export function Spinner() {
  return <span className="spinner" aria-hidden="true" />
}

type BusyButtonProps = {
  /** True while the operation the button started is running. */
  busy: boolean
  /** The verb of the operation, shown with the ring while it runs. */
  busyLabel: string
  children: ReactNode
  className?: string
  type?: 'button' | 'submit'
  disabled?: boolean
  title?: string
  onClick?: () => void
}

/**
 * A button that says what it is doing while it does it. Its usual words keep their place, unseen,
 * so the button never changes size; a second press while it works does nothing.
 */
export function BusyButton({
  busy,
  busyLabel,
  children,
  className,
  type = 'button',
  disabled = false,
  title,
  onClick,
}: BusyButtonProps) {
  return (
    <button
      type={type}
      className={className}
      title={title}
      disabled={disabled && !busy}
      aria-disabled={busy || undefined}
      aria-busy={busy || undefined}
      data-loading={busy ? '' : undefined}
      onClick={(event) => {
        if (busy) return event.preventDefault()
        onClick?.()
      }}
    >
      <span className="button-label">{children}</span>
      {busy && (
        <span className="button-busy">
          <Spinner />
          {busyLabel}
        </span>
      )}
    </button>
  )
}

/** A line that says what is going on, read aloud when it appears. */
export function Waiting({ children }: { children: ReactNode }) {
  return (
    <p className="waiting" role="status">
      <Spinner />
      <span>{children}</span>
    </p>
  )
}
