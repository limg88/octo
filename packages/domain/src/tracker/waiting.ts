import { personKey } from '../hours/model.ts'
import type { ProjectTeam } from '../team/model.ts'
import { workdaysBetween } from '../workdays.ts'
import {
  type DashboardSettings,
  inScope,
  isOfType,
  phaseOf,
  type TrackerData,
  type TrackerItem,
} from './model.ts'

/** An item whose last comment asks something nobody answered yet. */
export type WaitingRow = {
  id: string
  type: 'bug' | 'story'
  title: string
  state: string
  assignee: string | null
  /** Who asked, and when. */
  askedBy: string
  askedAt: string
  /** Working days the question has waited, up to the reading of the tracker. */
  workdays: number
  /** The sentence that asks, as the comment writes it. */
  question: string
  /** Whether who has to answer is on the client's side, as far as the team tells. */
  fromClient: boolean
}

const TAG = /<[^>]+>/g
const plain = (text: string): string => text.replace(TAG, ' ').replace(/\s+/g, ' ').trim()
const SENTENCE_END = /(?<=[.!?])\s+/
/** Words people ask with when they do not close the sentence with a question mark. */
const ASKING =
  /\b(puoi|potete|potresti|potreste|può|riesci|riuscite|fammi sapere|fateci sapere|attendiamo|in attesa di (un |una |vostr\w+ |tu\w+ )?(riscontro|conferma|risposta|feedback)|could you|can you|would you|please (confirm|advise|let)|let (me|us) know|waiting for (your|a|an) )\b/i
const MAX_QUESTION_CHARS = 280

/** The last sentence of a comment that asks something; null when none does. */
export function questionIn(comment: string): string | null {
  const sentences = plain(comment)
    .split(SENTENCE_END)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence !== '')
  const asking = sentences.findLast((sentence) => sentence.endsWith('?') || ASKING.test(sentence))
  return asking ? asking.slice(0, MAX_QUESTION_CHARS) : null
}

const dayOf = (instant: string | Date): string => new Date(instant).toISOString().slice(0, 10)

/** Whether a text names a person: the whole name, in the order the team writes it or reversed. */
function names(text: string, person: string): boolean {
  const parts = person.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return false
  const said = text.toLowerCase()
  return said.includes(parts.join(' ')) || said.includes([...parts].reverse().join(' '))
}

/**
 * Whether the answer is the client's to give: one of the supplier's people asked, and the item is
 * assigned to a person of the client or the comment names one. Without both sides in the team
 * nothing tells, and the answer is taken as anybody's.
 */
function isFromClient(item: TrackerItem, askedBy: string, text: string, team: ProjectTeam) {
  const supplier = team.people.filter((person) => person.side === 'supplier')
  const client = team.people.filter((person) => person.side === 'client')
  if (!supplier.some((person) => personKey(person.name) === personKey(askedBy))) return false
  const assignee = item.assignee === null ? null : personKey(item.assignee)
  return client.some((person) => personKey(person.name) === assignee || names(text, person.name))
}

/** Whether the team tells the two sides apart: only then «waits for the client» means something. */
export const tellsSides = (team: ProjectTeam): boolean =>
  team.people.some((person) => person.side === 'supplier') &&
  team.people.some((person) => person.side === 'client')

/**
 * The bugs and the stories still to be closed whose last comment asks something and has waited at
 * least the working days the project allows. The longest wait first.
 */
export function awaitingAnswer(
  data: TrackerData,
  settings: DashboardSettings,
  team: ProjectTeam,
  now: Date,
): WaitingRow[] {
  const today = dayOf(now)
  const rows: WaitingRow[] = []
  for (const item of data.items) {
    const bug = isOfType(item, settings.bugTypes)
    if (!bug && !isOfType(item, settings.storyTypes)) continue
    if (!inScope(item.tags, settings) || phaseOf(item.state, settings) === 'closed') continue
    const last = item.comments.at(-1)
    if (!last || Number.isNaN(Date.parse(last.at))) continue
    const question = questionIn(last.text)
    if (question === null) continue
    const workdays = workdaysBetween(dayOf(last.at), today)
    if (workdays < settings.answerWorkdays) continue
    rows.push({
      id: item.id,
      type: bug ? 'bug' : 'story',
      title: item.title,
      state: item.state,
      assignee: item.assignee,
      askedBy: last.by,
      askedAt: last.at,
      workdays,
      question,
      fromClient: isFromClient(item, last.by, plain(last.text), team),
    })
  }
  return rows.sort(
    (a, b) => b.workdays - a.workdays || a.id.localeCompare(b.id, 'en', { numeric: true }),
  )
}
