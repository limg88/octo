import { messages } from './messages.ts'

type Props = {
  /** Which system is missing and what to do, in the words of the tab that needs it. */
  text: string
  /** Takes the PM to where the systems are linked. */
  onOpenSources?: (() => void) | undefined
}

/** A reading was asked from a system that is not linked: said by name, with the way there. */
export function Unlinked({ text, onOpenSources }: Props) {
  return (
    <p className="warning" role="alert">
      {text}{' '}
      {onOpenSources && (
        <button type="button" className="quiet" onClick={onOpenSources}>
          {messages.openSources}
        </button>
      )}
    </p>
  )
}
