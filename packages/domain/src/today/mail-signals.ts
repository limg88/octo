import type { StoredMail } from '../mail/document.ts'
import { conversationOfMail, type MailThreads, type WaitingMail } from '../mail/thread.ts'
import type {
  Importance,
  MailFollowWhy,
  MailJudgement,
  MailReplyWhy,
  MailTurn,
  TodayItem,
} from './model.ts'

const DAY_MS = 24 * 60 * 60 * 1000
/** A meeting has an hour: it comes before what is due at any time of the day. */
const MEETING_WEIGHT = 1_000_000
const wholeDays = (from: string, now: Date): number =>
  Math.max(0, Math.floor((now.getTime() - Date.parse(from)) / DAY_MS))

export const mailKey = (id: string): string => `mail:${id}`

/** A mail that matters as much as a mail can floats above the others that are only followed. */
const FOLLOW_WEIGHT: Readonly<Record<Importance, number>> = { alta: 2000, media: 1000, bassa: 0 }

/** The key of the signal of a conversation: a word of the PM on it holds for its next mail too. */
export const conversationKey = (conversation: string): string => `mail:c:${conversation}`

type Placing = { reply: MailReplyWhy } | { follow: MailFollowWhy; who: string | null }

/**
 * Whose turn a mail is. The PM's own word comes first; then what is certain from the headers and
 * the conversation; then what Claude read in the mail. A mail written to many that nobody has
 * read yet is followed, never asked an answer of: the code cannot tell whom it asks.
 */
function placingOf(
  waiting: WaitingMail,
  judgement: MailJudgement | null,
  turn: MailTurn | undefined,
): Placing {
  if (turn === 'mine') return { reply: 'chosen' }
  if (turn === 'not_mine') return { follow: 'chosen', who: null }
  if (waiting.addressing === 'only_me') return { reply: 'only_me' }
  if (waiting.addressing === 'answered_by_own') {
    return { follow: 'answered_by_own', who: waiting.answeredBy }
  }
  const addressee = judgement?.addressee
  if (addressee === undefined) return { follow: 'unjudged', who: null }
  if (addressee === 'me') return { reply: 'judged' }
  return { follow: addressee, who: judgement?.addresseeName?.trim() || null }
}

/**
 * The mail that waits for the PM, the mail the PM is only written to with others, and the mail
 * the PM waits on. That a mail waits and whom its headers name is computed; how much it matters
 * and whom its words ask is the judgement given, when there is one. A mail that is the PM's and
 * whose judgement names a day near enough is due today.
 */
export function mailItems(
  threads: MailThreads,
  judgements: Readonly<Record<string, MailJudgement>>,
  now: Date,
  /** The day after today, `YYYY-MM-DD`: an answer asked by then is due today. */
  tomorrow: string,
  /** The PM's word on whose turn a conversation is. */
  turns: Readonly<Record<string, MailTurn>> = {},
): TodayItem[] {
  const reply = threads.awaitingMe.map((mail): TodayItem => {
    const judgement = judgements[mail.id] ?? null
    const waiting = threads.waiting[mail.id] ?? {
      addressing: 'among_many' as const,
      conversation: conversationOfMail(mail),
      mails: 1,
      recipients: 1,
      answeredBy: null,
    }
    const placing = placingOf(waiting, judgement, turns[waiting.conversation])
    const days = wholeDays(mail.date, now)
    const shared = {
      id: mail.id,
      path: mail.path,
      from: mail.from,
      subject: mail.subject,
      days,
      judgement,
      conversation: waiting.conversation,
      mails: waiting.mails,
    }
    // A mail to the PM alone is its own signal: what was said of the conversation before it
    // came does not put it away.
    const direct = waiting.addressing === 'only_me'
    const keys = direct
      ? { key: mailKey(mail.id) }
      : { key: conversationKey(waiting.conversation), formerKeys: [mailKey(mail.id)] }
    if ('follow' in placing) {
      return {
        ...keys,
        band: 'watch',
        facts: {
          kind: 'mail_follow',
          ...shared,
          why: placing.follow,
          who: placing.who,
          recipients: waiting.recipients,
        },
        weight: days + (judgement ? FOLLOW_WEIGHT[judgement.importance] : 0),
        target: 'mail',
        asOf: mail.date,
      }
    }
    const due = judgement?.deadline != null && judgement.deadline <= tomorrow
    return {
      ...keys,
      band: due ? 'due' : 'waiting',
      facts: { kind: 'mail_reply', ...shared, why: placing.reply },
      weight: days,
      target: 'mail',
      asOf: mail.date,
      ...(due ? { dueBecause: 'deadline' as const } : {}),
    }
  })
  const waiting = threads.awaitingThem.map((mail): TodayItem => {
    const days = wholeDays(mail.date, now)
    return {
      key: `waiting:${mail.id}`,
      band: 'watch',
      facts: {
        kind: 'mail_waiting',
        id: mail.id,
        path: mail.path,
        to: mail.to,
        subject: mail.subject,
        days,
      },
      weight: days,
      target: 'mail',
      asOf: mail.date,
    }
  })
  return [...reply, ...waiting]
}

/** The meetings of the day, from the invitations in the mail. */
export function meetingItems(meetings: readonly StoredMail[]): TodayItem[] {
  return meetings.flatMap((mail): TodayItem[] =>
    mail.meeting === null
      ? []
      : [
          {
            key: `meeting:${mail.meeting.uid}:${mail.meeting.start}`,
            band: 'due',
            facts: {
              kind: 'meeting',
              subject: mail.meeting.summary || mail.subject,
              start: mail.meeting.start,
              location: mail.meeting.location,
              path: mail.path,
            },
            // Above whatever else is due, the earlier in the day the higher.
            weight: MEETING_WEIGHT - (Date.parse(mail.meeting.start) % DAY_MS) / DAY_MS,
            target: 'mail',
            asOf: mail.date,
          },
        ],
  )
}
