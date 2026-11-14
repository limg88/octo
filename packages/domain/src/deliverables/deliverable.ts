import type { CheckedAnswer, DraftAnswer } from '../answer.ts'
import { DomainError, type DomainErrorCode } from '../errors.ts'
import { OCTO_FOLDER } from '../extracted-document.ts'
import { slugOf } from '../mail/document.ts'
import type { WbsRow } from './pert.ts'

/** Who reads a deliverable: what may be said in it depends on it. */
export type DeliverableAudience = 'client' | 'internal'

/** One thing the PM tells Octo before a deliverable is written. */
export type DeliverableField = {
  key: string
  label: string
  kind: 'text' | 'long' | 'date'
  required: boolean
  hint?: string
}

/**
 * A kind of deliverable Octo knows how to write: what it is for, what to ask the PM, how to
 * write it, and what a person checks before it leaves. It ships with the app.
 */
export type DeliverableKind = {
  id: string
  title: string
  summary: string
  audience: DeliverableAudience
  fields: DeliverableField[]
  /** How to write it: the rules the writer follows, in the words of the craft. */
  instructions: string
  /** What the PM checks before approving: shown as a list, never ticked by the model. */
  checklist: string[]
  /** The numbers this kind needs that only the code may compute. */
  calculation?: 'pert'
}

/** What the writer gives back: the text and, for a kind with numbers, the lines to compute. */
export type DeliverableDraft = DraftAnswer & { wbs?: WbsRow[] }

export const RED_TEAM_SEVERITIES = ['grave', 'media', 'lieve'] as const
export type RedTeamSeverity = (typeof RED_TEAM_SEVERITIES)[number]

/** One thing the reader could contest, found by a second reading that did not see the writing. */
export type RedTeamFinding = {
  severity: RedTeamSeverity
  finding: string
  /** The words of the draft it is about. */
  where: string
  why: string
}

export const RED_TEAM_VERDICTS = ['deliverable', 'fix_first'] as const
export type RedTeamVerdict = (typeof RED_TEAM_VERDICTS)[number]

export type RedTeamReport = {
  verdict: RedTeamVerdict
  findings: RedTeamFinding[]
  /** What holds, in brief: a red team that only attacks is not believed. */
  holds: string
}

/** One writing of the draft: the first, or a change the PM asked for in words. */
export type DeliverableRound = {
  at: string
  /** What the PM asked; null for the first draft. */
  request: string | null
  durationMs: number
  error: DomainErrorCode | null
}

export const DELIVERABLE_STATUSES = ['writing', 'review', 'approved', 'failed'] as const
export type DeliverableStatus = (typeof DELIVERABLE_STATUSES)[number]

/** A deliverable being made for a project, from the PM's request to the approved file. */
export type Deliverable = {
  id: string
  projectId: string
  kindId: string
  title: string
  inputs: Record<string, string>
  status: DeliverableStatus
  createdAt: string
  rounds: DeliverableRound[]
  /** The text with its sources checked by the code; null until a draft exists. */
  draft: CheckedAnswer | null
  /** What the writer gave, before the code put the numbers in: a change starts from here. */
  written: DeliverableDraft | null
  redTeam: RedTeamReport | null
  /** When the draft now shown became ready: the review time is counted from here. */
  readyAt: string | null
  /** Time the PM spent reviewing, summed over the rounds. */
  reviewMs: number
  approvedAt: string | null
  /** Files written at approval, as paths inside the project folder. */
  files: string[]
}

/** Where Octo keeps the deliverables of a project. */
export const DELIVERABLES_FOLDER = `${OCTO_FOLDER}/deliverable`
/**
 * Octo's own bookkeeping sits in hidden folders: the agent's search skips them, so a draft in the
 * making or a setting is never read as if it were a source of the project.
 */
export const JOBS_FOLDER = `${OCTO_FOLDER}/.lavori`
export const APPROVED_FOLDER = `${DELIVERABLES_FOLDER}/approvati`
export const PROJECT_INSTRUCTIONS_FOLDER = `${OCTO_FOLDER}/.istruzioni`

export const jobPath = (id: string): string => `${JOBS_FOLDER}/${id}.json`
export const projectInstructionsPath = (kindId: string): string =>
  `${PROJECT_INSTRUCTIONS_FOLDER}/${kindId}.md`

/**
 * A pause in the review longer than this is not review: the PM went to do something else. The
 * measure is of the work a deliverable costs, not of how long it sat open.
 */
export const MAX_REVIEW_PAUSE_MS = 20 * 60 * 1000

/** The review time between when the draft became ready and now, with the pause capped. */
export function reviewTimeSince(readyAt: string | null, now: Date): number {
  if (readyAt === null) return 0
  const elapsed = now.getTime() - Date.parse(readyAt)
  return Math.max(0, Math.min(elapsed, MAX_REVIEW_PAUSE_MS))
}

/** What the PM typed for a kind, trimmed; a required field left empty is an error. */
export function cleanInputs(
  kind: DeliverableKind,
  inputs: Readonly<Record<string, string>>,
): Record<string, string> {
  const cleaned: Record<string, string> = {}
  for (const field of kind.fields) {
    const value = (inputs[field.key] ?? '').trim()
    if (field.required && value.length === 0) {
      throw new DomainError('deliverable_input_missing', field.key)
    }
    if (value.length > 0) cleaned[field.key] = value
  }
  return cleaned
}

const MARKER = /\s*\[\d+\]/g

/** The text as the reader gets it: without the markers of the sources, which are for the PM. */
export function withoutMarkers(text: string): string {
  return text.replace(MARKER, '')
}

/** The name of the file of an approved deliverable: its day, its kind, what it is about. */
export function approvedFileName(deliverable: Deliverable, extension: string): string {
  const day = (deliverable.approvedAt ?? deliverable.createdAt).slice(0, 10)
  return `${day}_${deliverable.kindId}_${slugOf(deliverable.title)}.${extension}`
}

/** What a deliverable cost: what the register of a project shows, one row each. */
export type DeliverableCost = {
  draftMinutes: number
  reviewMinutes: number
  rounds: number
}

const MS_PER_MINUTE = 60 * 1000
const minutes = (ms: number): number => Math.round((ms / MS_PER_MINUTE) * 10) / 10

export function costOf(deliverable: Deliverable): DeliverableCost {
  const writing = deliverable.rounds.reduce((sum, round) => sum + round.durationMs, 0)
  return {
    draftMinutes: minutes(writing),
    reviewMinutes: minutes(deliverable.reviewMs),
    rounds: deliverable.rounds.length,
  }
}

/** The register of a project: what each deliverable cost, kept beside the approved files. */
export const REGISTER_PATH = `${DELIVERABLES_FOLDER}/registro.md`

const STATUS_LABELS: Readonly<Record<DeliverableStatus, string>> = {
  writing: 'in scrittura',
  review: 'da rivedere',
  approved: 'approvato',
  failed: 'non riuscito',
}

export type RegisterTotals = DeliverableCost & { deliverables: number }

/** What the approved deliverables of a project cost in all. */
export function registerTotals(deliverables: readonly Deliverable[]): RegisterTotals {
  const approved = deliverables.filter((deliverable) => deliverable.status === 'approved')
  const costs = approved.map(costOf)
  const sum = (pick: (cost: DeliverableCost) => number): number =>
    Math.round(costs.reduce((total, cost) => total + pick(cost), 0) * 10) / 10
  return {
    deliverables: approved.length,
    draftMinutes: sum((cost) => cost.draftMinutes),
    reviewMinutes: sum((cost) => cost.reviewMinutes),
    rounds: sum((cost) => cost.rounds),
  }
}

/**
 * The register as a file of the project: one line per deliverable, newest first, with the minutes
 * of writing, the minutes of review and the rounds. It is the measure of what the work costs.
 */
export function registerMarkdown(
  deliverables: readonly Deliverable[],
  kinds: readonly DeliverableKind[],
): string {
  const titles = new Map(kinds.map((kind) => [kind.id, kind.title]))
  const cell = (text: string): string => text.replace(/\|/g, '\\|')
  const lines = [...deliverables]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((deliverable) => {
      const cost = costOf(deliverable)
      return `| ${[
        deliverable.createdAt.slice(0, 10),
        cell(titles.get(deliverable.kindId) ?? deliverable.kindId),
        cell(deliverable.title),
        STATUS_LABELS[deliverable.status],
        cost.draftMinutes,
        cost.reviewMinutes,
        cost.rounds,
      ].join(' | ')} |`
    })
  const totals = registerTotals(deliverables)
  return [
    '# Registro dei deliverable',
    '',
    'Una riga per deliverable. I minuti di revisione sono il tempo passato sulla bozza prima di una richiesta o dell’approvazione; una pausa oltre 20 minuti non conta.',
    '',
    '| Data | Tipo | Oggetto | Stato | Scrittura (min) | Revisione (min) | Giri |',
    '|---|---|---|---|---:|---:|---:|',
    ...lines,
    '',
    `Approvati: ${totals.deliverables} · scrittura ${totals.draftMinutes} min · revisione ${totals.reviewMinutes} min · ${totals.rounds} giri.`,
    '',
  ].join('\n')
}
