import { useRef } from 'react'

/**
 * Which row of a list is the one in view. The row the person chose stays chosen while it is in
 * the list; when a filter or an action takes it away, the row that took its place is chosen, and
 * nothing is when the list is empty.
 */
export function useSelection(keys: readonly string[], wanted: string | null): string | null {
  const place = useRef(0)
  const at = wanted === null ? -1 : keys.indexOf(wanted)
  if (at >= 0) {
    place.current = at
    return wanted
  }
  return keys[Math.min(place.current, keys.length - 1)] ?? null
}
