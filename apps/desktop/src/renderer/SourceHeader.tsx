import type { ReactNode } from 'react'
import { messages } from './messages.ts'

/** Where the credential a source is read with is kept, as this computer sees it. */
export type CredentialPlace = 'here' | 'shared' | 'none' | 'not_needed'

/** Where the credential of a source is, from whether it is linked and can be read from here. */
export const credentialPlace = (linked: boolean, readableHere: boolean): CredentialPlace =>
  !linked ? 'none' : readableHere ? 'here' : 'shared'

/** A place that is no credential at all is said in grey: there is nothing to look after. */
const NO_CREDENTIAL: ReadonlySet<CredentialPlace> = new Set(['none', 'not_needed'])

type Props = {
  title: string
  /** How fresh the source is, or that it is not linked yet. */
  status: ReactNode
  credential: CredentialPlace
  /** True once the source has been set up: it is changed, not linked. */
  linked: boolean
  open: boolean
  /** Absent when the section stands alone: there is nothing to fold. */
  onToggle?: (() => void) | undefined
  /** What can be done without opening the section. */
  children?: ReactNode
}

/** One source in the list: its name, its state, its credential, and the way into its settings. */
export function SourceHeader({
  title,
  status,
  credential,
  linked,
  open,
  onToggle,
  children,
}: Props) {
  return (
    <header className="source-header">
      <h3>{title}</h3>
      <div className="source-status">{status}</div>
      <span
        className={NO_CREDENTIAL.has(credential) ? 'source-credential hint' : 'source-credential'}
      >
        {messages.credential.places[credential]}
      </span>
      <div className="actions source-actions">
        {!open && children}
        {onToggle && (
          <button
            type="button"
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
