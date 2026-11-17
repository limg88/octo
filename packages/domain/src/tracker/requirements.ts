import { noteOf } from './bugs.ts'
import {
  type DashboardSettings,
  inScope,
  isOfType,
  phaseOf,
  stateName,
  type TrackerData,
  type TrackerItem,
} from './model.ts'
import { sameSprint } from './sprint.ts'

/** Why a requirement looks unclear. Each signal is a check of the code on the tracker's data. */
export const REQUIREMENT_SIGNALS = ['S1', 'S2', 'S3', 'S4', 'S5'] as const
export type RequirementSignal = (typeof REQUIREMENT_SIGNALS)[number]

export type RequirementRow = {
  id: string
  title: string
  state: string
  period: string | null
  assignee: string | null
  signals: RequirementSignal[]
  /** For S5: the words found, with what stands around them. */
  unclear: { word: string; context: string } | null
  note: { at: string; text: string } | null
}

/** Acceptance criteria shorter than this say nothing that can be tested. */
export const MIN_ACCEPTANCE_CHARS = 20
/** A description shorter than this does not describe. */
export const MIN_DESCRIPTION_CHARS = 80
const CONTEXT_CHARS = 110

const NOT_REFINED = /^(new|refining|ready for planning|da raffinare|nuov[oa])$/i
const WAITING = /\b(on hold|blocked|in attesa|sospes[oa]|bloccat[oa])\b/i
/** Words people write when a point is still to be settled. `clarified` is a point settled. */
const UNCLEAR =
  /\b(tbd|to be defined|to be clarified|da definire|da chiarire|unclear|not clear|non chiar\w*|poco chiar\w*|clarif(?!ied)\w*|chiariment\w*|in attesa|waiting for|pending (decision|confirmation)|open point|punt\w* apert\w*)\b/i
const TAG = /<[^>]+>/g

const plain = (text: string): string => text.replace(TAG, ' ').replace(/\s+/g, ' ').trim()

function unclearIn(item: TrackerItem): RequirementRow['unclear'] {
  const text = plain(
    [
      item.description,
      item.acceptanceCriteria ?? '',
      ...item.comments.map((comment) => comment.text),
    ].join(' '),
  )
  const match = UNCLEAR.exec(text)
  if (!match) return null
  const from = Math.max(0, match.index - CONTEXT_CHARS)
  const to = Math.min(text.length, match.index + match[0].length + CONTEXT_CHARS)
  return { word: match[0], context: text.slice(from, to) }
}

function signalsOf(item: TrackerItem, unclear: RequirementRow['unclear']): RequirementSignal[] {
  const name = stateName(item.state)
  const signals: RequirementSignal[] = []
  if (NOT_REFINED.test(name)) signals.push('S1')
  // A tracker without the field cannot be asked for it: the signal would be on every story.
  if (
    item.acceptanceCriteria !== null &&
    plain(item.acceptanceCriteria).length < MIN_ACCEPTANCE_CHARS
  ) {
    signals.push('S2')
  }
  if (plain(item.description).length < MIN_DESCRIPTION_CHARS) signals.push('S3')
  if (WAITING.test(name)) signals.push('S4')
  if (unclear) signals.push('S5')
  return signals
}

/**
 * The stories still to be worked on whose requirement shows at least one sign of being unclear,
 * the ones with more signs first. A story already developed or closed is past this question, and
 * one that is not about to be planned is not asked it yet.
 */
export function unclearRequirements(
  data: TrackerData,
  settings: DashboardSettings,
  /** The sprint that comes next: with no period chosen by hand, only its stories are checked. */
  upcomingSprint: string | null = null,
): RequirementRow[] {
  const periods = new Set(settings.requirementPeriods)
  const planned = (item: TrackerItem): boolean => {
    if (periods.size > 0) return item.period !== null && periods.has(item.period)
    if (upcomingSprint === null) return true
    return item.sprint !== null && sameSprint(item.sprint, upcomingSprint)
  }
  const excluded = new Set(settings.decisions.excludedRequirements.map((entry) => entry.id))
  const removed = new Set(
    settings.decisions.removedSignals.map((entry) => `${entry.id} ${entry.signal}`),
  )
  return data.items
    .filter((item) => !excluded.has(item.id))
    .filter((item) => isOfType(item, settings.storyTypes) && inScope(item.tags, settings))
    .filter((item) => phaseOf(item.state, settings) === 'work')
    .filter(planned)
    .map((item) => {
      const unclear = unclearIn(item)
      return {
        id: item.id,
        title: item.title,
        state: item.state,
        period: item.period,
        assignee: item.assignee,
        signals: signalsOf(item, unclear).filter((signal) => !removed.has(`${item.id} ${signal}`)),
        unclear,
        note: noteOf(item.id, settings),
      }
    })
    .filter((row) => row.signals.length > 0)
    .sort(
      (a, b) =>
        b.signals.length - a.signals.length || a.id.localeCompare(b.id, 'en', { numeric: true }),
    )
}
