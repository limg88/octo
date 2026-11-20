import type { Reader } from '@octo/domain'
import { messages } from './messages.ts'

type Props = {
  /** Who made the reading shown, when it was made from another computer. */
  readBy: Reader | null
  /** Who is reading from another computer right now. */
  readingBy: Reader | null
}

/**
 * What a source owes to the other computers that share the folder of the project: who read it
 * last and who is reading it now. Why this computer leaves it to them is said once for all the
 * sources, by where their credential is.
 */
export function Elsewhere({ readBy, readingBy }: Props) {
  const text = messages.elsewhere
  return (
    <>
      {readingBy && (
        <p className="badge" role="status">
          {text.reading(text.who(readingBy))}
        </p>
      )}
      {readBy && <p className="badge">{text.read(text.who(readBy))}</p>}
    </>
  )
}
