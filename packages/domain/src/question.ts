import type { CheckedAnswer } from './answer.ts'
import { DomainError, type DomainErrorCode } from './errors.ts'

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
