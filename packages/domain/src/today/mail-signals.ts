import type { StoredMail } from '../mail/document.ts'
import type { MailThreads } from '../mail/thread.ts'
import type { MailJudgement, TodayItem } from './model.ts'

const DAY_MS = 24 * 60 * 60 * 1000
/** A meeting has an hour: it comes before what is due at any time of the day. */
const MEETING_WEIGHT = 1_000_000
const wholeDays = (from: string, now: Date): number =>
  Math.max(0, Math.floor((now.getTime() - Date.parse(from)) / DAY_MS))

export const mailKey = (id: string): string => `mail:${id}`

/**
 * The mail that waits for the PM and the mail the PM waits on. That a mail waits is computed;
 * how much it matters is the judgement given, when there is one. A mail whose judgement names a
 * day near enough is due today.
 */
export function mailItems(
  threads: MailThreads,
  judgements: Readonly<Record<string, MailJudgement>>,
  now: Date,
  /** The day after today, `YYYY-MM-DD`: an answer asked by then is due today. */
  tomorrow: string,
): TodayItem[] {
  const reply = threads.awaitingMe.map((mail): TodayItem => {
    const judgement = judgements[mail.id] ?? null
    const due = judgement?.deadline != null && judgement.deadline <= tomorrow
    const days = wholeDays(mail.date, now)
    return {
      key: mailKey(mail.id),
      band: due ? 'due' : 'waiting',
      facts: {
        kind: 'mail_reply',
        id: mail.id,
        path: mail.path,
        from: mail.from,
        subject: mail.subject,
        days,
        judgement,
      },
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
