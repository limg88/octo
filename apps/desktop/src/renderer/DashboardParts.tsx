import type { TrackerKind } from '@octo/domain'
import { createContext, useContext } from 'react'
import { messages } from './messages.ts'

const text = messages.dashboard

/** The tracker the dashboard is read from: what its buttons name. */
export const TrackerContext = createContext<TrackerKind>('ado')

/** How the button that opens an item on its tracker reads. */
export const useOpenInTracker = (): string =>
  text.openInTracker(text.trackerNames[useContext(TrackerContext)])

/** How the tracker of the dashboard calls what orders its items by importance. */
export const useSeverityName = (): string => text.severityNames[useContext(TrackerContext)]

/** Whether the tracker of the dashboard plans by periods: Jira has sprints only. */
export const useHasPeriods = (): boolean => useContext(TrackerContext) !== 'jira'

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
  const label = useOpenInTracker()
  if (!onOpen) return null
  return (
    <button type="button" className="quiet" onClick={() => onOpen(id)}>
      {label}
    </button>
  )
}

const TAG = /<[^>]+>/g
/** A text of the tracker as plain words: its markup is not shown. */
export const plain = (value: string): string => value.replace(TAG, ' ').replace(/\s+/g, ' ').trim()
