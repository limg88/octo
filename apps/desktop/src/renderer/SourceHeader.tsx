import type { ReactNode } from 'react'
import { messages } from './messages.ts'

type Props = {
  title: string
  /** How fresh the source is, or that it is not linked yet. */
  status: ReactNode
  /** True once the source has been set up: it is changed, not linked. */
  linked: boolean
  open: boolean
  /** Absent when the section stands alone: there is nothing to fold. */
  onToggle?: (() => void) | undefined
  /** What can be done without opening the section. */
  children?: ReactNode
}

/** One source in the list: its name, its state, and the way into its settings. */
export function SourceHeader({ title, status, linked, open, onToggle, children }: Props) {
  return (
    <header className="source-header">
      <div className="source-title">
        <h3>{title}</h3>
        {status}
      </div>
      <div className="actions">
        {!open && children}
        {onToggle && (
          <button
            type="button"
            className={linked || open ? undefined : 'primary'}
            aria-expanded={open}
            aria-label={`${toggleText(open, linked)}: ${title}`}
            onClick={onToggle}
          >
            {toggleText(open, linked)}
          </button>
        )}
      </div>
    </header>
  )
}

const toggleText = (open: boolean, linked: boolean): string =>
  open ? messages.close : linked ? messages.sourceEdit : messages.sourceLink
