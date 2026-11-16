import type { DashboardDecisions, TrackerItem } from './model.ts'

/** A decision the PM took on an item of the tracker, as a row that can be read and taken back. */
export type DecisionRow = {
  kind: 'clear' | 'signal' | 'note'
  id: string
  /** The title of the item; null when the tracker no longer has it. */
  title: string | null
  at: string
  /** The signal taken off, for `signal`. */
  signal: string | null
  /** The words of the note, for `note`. */
  text: string | null
}

/** Every decision kept, the latest first. Of the notes of an item only the last one counts. */
export function decisionRows(
  decisions: DashboardDecisions,
  items: readonly TrackerItem[],
): DecisionRow[] {
  const titles = new Map(items.map((item) => [item.id, item.title]))
  const title = (id: string) => titles.get(id) ?? null
  const lastNotes = new Map(decisions.notes.map((note) => [note.id, note]))
  const rows: DecisionRow[] = [
    ...decisions.excludedRequirements.map((entry) => ({
      kind: 'clear' as const,
      id: entry.id,
      title: title(entry.id),
      at: entry.at,
      signal: null,
      text: null,
    })),
    ...decisions.removedSignals.map((entry) => ({
      kind: 'signal' as const,
      id: entry.id,
      title: title(entry.id),
      at: entry.at,
      signal: entry.signal,
      text: null,
    })),
    ...[...lastNotes.values()].map((note) => ({
      kind: 'note' as const,
      id: note.id,
      title: title(note.id),
      at: note.at,
      signal: null,
      text: note.text,
    })),
  ]
  return rows.sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
}

/** The decisions without one of them: the item comes back as the tracker shows it. */
export function withoutTrackerDecision(
  decisions: DashboardDecisions,
  row: Pick<DecisionRow, 'kind' | 'id' | 'signal'>,
): DashboardDecisions {
  if (row.kind === 'clear') {
    return {
      ...decisions,
      excludedRequirements: decisions.excludedRequirements.filter((entry) => entry.id !== row.id),
    }
  }
  if (row.kind === 'signal') {
    return {
      ...decisions,
      removedSignals: decisions.removedSignals.filter(
        (entry) => entry.id !== row.id || entry.signal !== row.signal,
      ),
    }
  }
  return { ...decisions, notes: decisions.notes.filter((note) => note.id !== row.id) }
}
