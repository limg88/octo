import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { messages } from './messages.ts'

/** How long the PM is told that what was typed is saved: long enough to read, then gone. */
const SHOWN_MS = 4000

/**
 * The same confirmation after every save, in every section: said once, and gone by itself.
 * `saved` shows it, `clear` takes it away when another save starts.
 */
export function useSavedNote(): { note: ReactNode; saved: () => void; clear: () => void } {
  const [shown, setShown] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    setShown(false)
  }, [])
  const saved = useCallback(() => {
    clear()
    setShown(true)
    timer.current = setTimeout(() => setShown(false), SHOWN_MS)
  }, [clear])
  useEffect(() => clear, [clear])

  return {
    note: shown ? (
      <p className="badge badge-ok saved-note" role="status">
        {messages.saved}
      </p>
    ) : null,
    saved,
    clear,
  }
}
