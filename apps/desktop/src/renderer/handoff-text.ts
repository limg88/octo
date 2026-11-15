import type { DeliverableKind } from '@octo/domain'
import { DELIVERABLE_INPUT_LIMIT } from '../shared/api.ts'
import type { Handoff } from './context.ts'
import { messages } from './messages.ts'

const labels = messages.handoff.labels
const CUT = '…'
/** The field of a kind where the PM tells what else there is to know. */
const NOTES_FIELD = 'note'

const list = (title: string, items: readonly string[]): string[] =>
  items.length === 0 ? [] : ['', `${title}:`, ...items.map((item) => `- ${item}`)]

/** The files an answer cites, each once, in the order of the answer. */
export const citedPaths = (handoff: Handoff): string[] => [
  ...new Set(handoff.answer.citations.map((citation) => citation.path)),
]

/**
 * An answer as the words a deliverable starts from: the question, the sources and what is still
 * to confirm, then the answer itself, cut where the field of the form would not hold it.
 */
export function handoffText(handoff: Handoff, limit = DELIVERABLE_INPUT_LIMIT): string {
  const frame = [
    `${labels.question}: ${handoff.question}`,
    ...list(labels.sources, citedPaths(handoff)),
    ...list(labels.missing, handoff.answer.missing),
    '',
    `${labels.answer}:`,
    '',
  ].join('\n')
  const room = limit - frame.length
  if (room <= CUT.length) return frame.slice(0, limit)
  const answer = handoff.answer.text
  return frame + (answer.length > room ? answer.slice(0, room - CUT.length) + CUT : answer)
}

/** The field of a kind the context goes in: its notes, or its last long text; none without one. */
export function handoffField(kind: DeliverableKind): string | null {
  const long = kind.fields.filter((field) => field.kind === 'long')
  return (long.find((field) => field.key === NOTES_FIELD) ?? long.at(-1))?.key ?? null
}
