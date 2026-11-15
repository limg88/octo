import { EXTRACTED_TEXT_FOLDER, OCTO_FOLDER } from '@octo/domain'

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

const SEPARATOR = /[\\/]/
const EXTENSION = /\.[^.]+$/
/** Under this length a file name alone says too little: the folder it is in is shown with it. */
const SHORT_NAME = 14
const MAIL_ROOT = `${OCTO_FOLDER}/posta/`
const FEED_ROOT = `${OCTO_FOLDER}/fonti/`
const TRACKER_ROOT = `${OCTO_FOLDER}/cruscotto/`
const TEXT_ROOT = `${EXTRACTED_TEXT_FOLDER}/`

/** Where a cited file comes from, read from the folder Octo keeps it in. */
export type Provenance =
  | { kind: 'mail' | 'tracker' | 'text' | 'file' }
  | { kind: 'feed'; name: string }

export function provenanceOf(path: string): Provenance {
  const normal = path.split(SEPARATOR).join('/')
  if (normal.startsWith(MAIL_ROOT)) return { kind: 'mail' }
  if (normal.startsWith(TRACKER_ROOT)) return { kind: 'tracker' }
  if (normal.startsWith(TEXT_ROOT)) return { kind: 'text' }
  if (normal.startsWith(FEED_ROOT)) {
    return { kind: 'feed', name: normal.slice(FEED_ROOT.length).split('/')[0] ?? '' }
  }
  return { kind: 'file' }
}

/** A cited file by a name a person reads: its own, with its folder when the name says little. */
export function sourceTitle(path: string): string {
  const parts = path.split(SEPARATOR).filter((part) => part !== '')
  const name = (parts.at(-1) ?? path).replace(EXTENSION, '')
  const folder = parts.at(-2)
  return folder !== undefined && name.length < SHORT_NAME ? `${folder} · ${name}` : name
}
