import type { CheckedAnswer } from './answer.ts'
import { DomainError, type DomainErrorCode } from './errors.ts'
import { OCTO_FOLDER, PRIVATE_FOLDER, SETTINGS_FOLDER } from './extracted-document.ts'

/**
 * Where the questions of a project are kept: in its folder, so they travel with it. Earlier
 * answers are not a source: nothing in here may be cited.
 */
export const HISTORY_FOLDER = `${OCTO_FOLDER}/.cronologia`

/** The folders of a project that are never a source: not searched, not read, not cited. */
export const UNCITABLE_FOLDERS = [HISTORY_FOLDER, SETTINGS_FOLDER, PRIVATE_FOLDER] as const

/** One question of the PM with its outcome: a checked answer or the reason it failed. */
export type QuestionRecord = {
  id: string
  projectId: string
  question: string
  askedAt: string
  durationMs: number
  answer: CheckedAnswer | null
  error: DomainErrorCode | null
}

export function cleanQuestion(question: string): string {
  const cleaned = question.trim()
  if (cleaned.length === 0) throw new DomainError('empty_question')
  return cleaned
}
