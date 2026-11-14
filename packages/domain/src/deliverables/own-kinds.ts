import { DomainError } from '../errors.ts'
import { OCTO_FOLDER } from '../extracted-document.ts'
import { slugOf } from '../mail/document.ts'
import type { DeliverableAudience, DeliverableField, DeliverableKind } from './deliverable.ts'

/**
 * A kind of deliverable the PM defines for one project, in words: what it is, what to ask before
 * writing it, how to write it, what to check. It is how a team's own way of working enters Octo
 * without any code.
 */
export type OwnKindInput = {
  title: string
  summary: string
  audience: DeliverableAudience
  /** What to ask before writing, one question per line; a line ending with `*` is required. */
  questions: string[]
  instructions: string
  checklist: string[]
}

/** Where a project keeps the kinds its PM defined. Hidden: they are settings, not sources. */
export const OWN_KINDS_FOLDER = `${OCTO_FOLDER}/.tipi`
export const OWN_KIND_PREFIX = 'proprio-'
const REQUIRED_MARK = '*'
const MAX_QUESTIONS = 8

export const ownKindPath = (id: string): string => `${OWN_KINDS_FOLDER}/${id}.json`
export const isOwnKind = (id: string): boolean => id.startsWith(OWN_KIND_PREFIX)

const lines = (values: readonly string[]): string[] =>
  values.map((value) => value.trim()).filter((value) => value.length > 0)

function fieldOf(question: string, at: number): DeliverableField {
  const required = question.endsWith(REQUIRED_MARK)
  const label = required ? question.slice(0, -REQUIRED_MARK.length).trim() : question
  return { key: `domanda-${at + 1}`, label, kind: 'long', required }
}

/**
 * The kind as Octo uses it, from what the PM typed. Its id comes from its title, so saving it
 * again with the same title replaces it.
 */
export function ownKind(input: OwnKindInput): DeliverableKind {
  const title = input.title.trim()
  const instructions = input.instructions.trim()
  if (title.length === 0) throw new DomainError('deliverable_kind_invalid', 'title')
  if (instructions.length === 0) throw new DomainError('deliverable_kind_invalid', 'instructions')
  const questions = lines(input.questions)
  if (questions.length > MAX_QUESTIONS) {
    throw new DomainError('deliverable_kind_invalid', 'questions')
  }
  return {
    id: `${OWN_KIND_PREFIX}${slugOf(title)}`,
    title,
    summary: input.summary.trim(),
    audience: input.audience,
    fields: questions.map(fieldOf),
    instructions,
    checklist: lines(input.checklist),
  }
}

/** What the PM typed for a kind, back from the kind: to show it again in the form. */
export function ownKindInput(kind: DeliverableKind): OwnKindInput {
  return {
    title: kind.title,
    summary: kind.summary,
    audience: kind.audience,
    questions: kind.fields.map((field) =>
      field.required ? `${field.label} ${REQUIRED_MARK}` : field.label,
    ),
    instructions: kind.instructions,
    checklist: kind.checklist,
  }
}
