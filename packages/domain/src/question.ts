import type { CheckedAnswer } from './answer.ts'
import { DomainError, type DomainErrorCode } from './errors.ts'
import { OCTO_FOLDER, PRIVATE_FOLDER, SETTINGS_FOLDER } from './extracted-document.ts'

/**
 * Where the questions of a project are kept: in its folder, so they travel with it. Earlier
 * answers are not a source: nothing in here may be cited.
 */
export const HISTORY_FOLDER = `${OCTO_FOLDER}/.cronologia`

/**
 * The folders of a project that are never a source: not searched, not read, not cited. The last
 * holds the deliverables in the making.
 */
export const UNCITABLE_FOLDERS = [
  HISTORY_FOLDER,
  SETTINGS_FOLDER,
  PRIVATE_FOLDER,
  `${OCTO_FOLDER}/.lavori`,
] as const

/** One question of the PM with its outcome: a checked answer or the reason it failed. */
export type QuestionRecord = {
  id: string
  projectId: string
  question: string
  askedAt: string
  durationMs: number
  answer: CheckedAnswer | null
  error: DomainErrorCode | null
  /** The model that answered, as Claude Code named it; absent in what was asked before. */
  model?: string | null | undefined
  /** The conversation the question belongs to; absent in what was asked before there were any. */
  conversationId?: string | undefined
}

/** The conversation of the questions asked before there were conversations. */
export const LEGACY_CONVERSATION = 'precedenti'

/** The questions asked one after the other on the same matter, each knowing those before it. */
export type Conversation = {
  id: string
  /** Its first question: what the PM recognises it by. */
  title: string
  startedAt: string
  lastAt: string
  records: QuestionRecord[]
}

/** A question and its answer, as the next question of the conversation is told of them. */
export type ConversationTurn = { question: string; answer: string }

/** How much of a conversation goes with a new question: the latest turns, each cut short. */
const MAX_TURNS = 6
const MAX_TURN_ANSWER_CHARS = 4000

export const conversationOf = (record: QuestionRecord): string =>
  record.conversationId ?? LEGACY_CONVERSATION

/** The conversations of a project, the one asked in last first; each with its questions in order. */
export function conversationsOf(records: readonly QuestionRecord[]): Conversation[] {
  const byId = new Map<string, Conversation>()
  for (const record of records) {
    const id = conversationOf(record)
    const known = byId.get(id)
    if (known) {
      known.records.push(record)
      known.lastAt = record.askedAt
    } else {
      byId.set(id, {
        id,
        title: record.question,
        startedAt: record.askedAt,
        lastAt: record.askedAt,
        records: [record],
      })
    }
  }
  return [...byId.values()].sort((a, b) => b.lastAt.localeCompare(a.lastAt))
}

/**
 * What a new question of a conversation is told of the ones before it: the latest that had an
 * answer. A question that failed taught nothing, and is left out.
 */
export function earlierTurns(
  records: readonly QuestionRecord[],
  conversationId: string,
): ConversationTurn[] {
  return records
    .filter((record) => conversationOf(record) === conversationId && record.answer !== null)
    .slice(-MAX_TURNS)
    .map((record) => ({
      question: record.question,
      answer: (record.answer?.text ?? '').slice(0, MAX_TURN_ANSWER_CHARS),
    }))
}

export function cleanQuestion(question: string): string {
  const cleaned = question.trim()
  if (cleaned.length === 0) throw new DomainError('empty_question')
  return cleaned
}
