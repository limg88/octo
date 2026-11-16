import { messages } from './messages.ts'

const text = messages.dashboard

export function Figure({
  label,
  value,
  note,
}: {
  label: string
  value: string | number
  note?: string
}) {
  return (
    <div className="figure">
      <dt>{label}</dt>
      <dd>
        {value}
        {note && <span className="figure-note">{note}</span>}
      </dd>
    </div>
  )
}

/** Takes the PM to an item where the tracker keeps it; absent when the item has no address. */
export function OpenItem({
  id,
  onOpen,
}: {
  id: string
  onOpen: ((id: string) => void) | undefined
}) {
  if (!onOpen) return null
  return (
    <button type="button" className="quiet" onClick={() => onOpen(id)}>
      {text.openInTracker}
    </button>
  )
}

const TAG = /<[^>]+>/g
/** A text of the tracker as plain words: its markup is not shown. */
export const plain = (value: string): string => value.replace(TAG, ' ').replace(/\s+/g, ' ').trim()
