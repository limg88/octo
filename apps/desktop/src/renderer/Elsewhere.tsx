import type { Reader } from '@octo/domain'
import { messages } from './messages.ts'

type Props = {
  /** Who made the reading shown, when it was made from another computer. */
  readBy: Reader | null
  /** Who is reading from another computer right now. */
  readingBy: Reader | null
  /** Why this computer does not read the source, when it does not; null when it does. */
  notHere: string | null
}

/**
 * What a source owes to the other computers that share the folder of the project: who read it
 * last, who is reading it now, and why this computer leaves it to them.
 */
export function Elsewhere({ readBy, readingBy, notHere }: Props) {
  const text = messages.elsewhere
  return (
    <>
      {readingBy && (
        <p className="badge" role="status">
          {text.reading(text.who(readingBy))}
        </p>
      )}
      {readBy && <p className="badge">{text.read(text.who(readBy))}</p>}
      {notHere && <p className="hint">{notHere}</p>}
    </>
  )
}
