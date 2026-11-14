const MARKER_NOT_ALREADY_A_LINK = /\[(\d+)\](?!\()/g
const SOURCE_ANCHOR_PREFIX = '#fonte-'

/** Turns each [n] of the answer into a Markdown link to its source in the list below. */
export function linkMarkers(text: string): string {
  return text.replace(MARKER_NOT_ALREADY_A_LINK, `[$1](${SOURCE_ANCHOR_PREFIX}$1)`)
}

/** The marker a link points to, or null for any other link. */
export function markerOfLink(href: string | undefined): number | null {
  if (!href?.startsWith(SOURCE_ANCHOR_PREFIX)) return null
  const marker = Number(href.slice(SOURCE_ANCHOR_PREFIX.length))
  return Number.isInteger(marker) ? marker : null
}

export const sourceElementId = (marker: number): string => `fonte-${marker}`
