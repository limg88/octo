import { useEffect, useRef } from 'react'

/**
 * Runs `again` each time a view that stayed mounted comes back in sight: what it shows may have
 * changed while the PM was elsewhere. Not at the first showing, which the view loads by itself.
 */
export function useReentry(active: boolean, again: () => void): void {
  const was = useRef(active)
  const latest = useRef(again)
  latest.current = again
  useEffect(() => {
    if (active && !was.current) latest.current()
    was.current = active
  }, [active])
}
