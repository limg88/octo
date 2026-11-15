import type { StoredMail } from './document.ts'

const DAY_MS = 24 * 60 * 60 * 1000

/** A mail older than this no longer waits for an answer: it was answered some other way. */
export const REPLY_WINDOW_DAYS = 14
/** A mail of the PM is said to wait for an answer only after this long without one. */
export const WAITING_AFTER_DAYS = 3
export const WAITING_WINDOW_DAYS = 30

/** Senders nobody answers: alerts, mailing systems, addresses that say so themselves. */
const NOT_A_PERSON =
  /(^|[<\s"])(no-?reply|do-?not-?reply|noreply|mailer-daemon|postmaster|avvisi|alerts?|notifications?|notifiche)@/i

const ADDRESSES = /[^\s<>,;"']+@[^\s<>,;"']+/g
const REPLY_PREFIX = /^\s*((re|r|rif|fw|fwd|i|inoltro)\s*:\s*)+/i

/** The addresses a header line names, in lower case. */
export const addressesIn = (line: string): string[] =>
  (line.match(ADDRESSES) ?? []).map((address) => address.toLowerCase())

/** A subject without the marks of an answer or of a forward: what a conversation is about. */
export const threadSubject = (subject: string): string =>
  subject.replace(REPLY_PREFIX, '').trim().toLowerCase().replace(/\s+/g, ' ')

const isFrom = (mail: StoredMail, addresses: ReadonlySet<string>): boolean =>
  addressesIn(mail.from).some((address) => addresses.has(address))

/** Whether a later mail answers an earlier one: it cites it, or goes on with the same subject. */
function answers(later: StoredMail, earlier: StoredMail): boolean {
  if (Date.parse(later.date) <= Date.parse(earlier.date)) return false
  if (later.inReplyTo === earlier.id || later.references.includes(earlier.id)) return true
  // A mail program that drops the reference still keeps the subject.
  return (
    later.inReplyTo === null &&
    later.references.length === 0 &&
    threadSubject(later.subject) !== '' &&
    threadSubject(later.subject) === threadSubject(earlier.subject)
  )
}

export type MailThreads = {
  /** Mail written to the PM by a person, that the PM has not answered. */
  awaitingMe: StoredMail[]
  /** Mail of the PM that asks something and that nobody has answered. */
  awaitingThem: StoredMail[]
}

/**
 * Who waits for whom, from the mail of the project: every answer is found by what the mail
 * itself says it answers. Nothing is judged here: only dates, addresses and references.
 */
export function mailThreads(
  mails: readonly StoredMail[],
  ownAddresses: readonly string[],
  now: Date,
): MailThreads {
  const own = new Set(ownAddresses.map((address) => address.toLowerCase()))
  if (own.size === 0) return { awaitingMe: [], awaitingThem: [] }
  const age = (mail: StoredMail): number => (now.getTime() - Date.parse(mail.date)) / DAY_MS
  const mine = mails.filter((mail) => isFrom(mail, own))
  const others = mails.filter((mail) => !isFrom(mail, own))
  const awaitingMe = others.filter(
    (mail) =>
      mail.invite === null &&
      age(mail) <= REPLY_WINDOW_DAYS &&
      !NOT_A_PERSON.test(mail.from) &&
      addressesIn(mail.to).some((address) => own.has(address)) &&
      !mine.some((reply) => answers(reply, mail)),
  )
  const awaitingThem = mine.filter(
    (mail) =>
      mail.invite === null &&
      mail.asks &&
      addressesIn(mail.to).length > 0 &&
      age(mail) >= WAITING_AFTER_DAYS &&
      age(mail) <= WAITING_WINDOW_DAYS &&
      !others.some((reply) => answers(reply, mail)) &&
      // A later mail of the PM in the same conversation: the question was taken up again there.
      !mine.some((again) => answers(again, mail)),
  )
  const newestFirst = (a: StoredMail, b: StoredMail) => Date.parse(b.date) - Date.parse(a.date)
  return { awaitingMe: awaitingMe.sort(newestFirst), awaitingThem: awaitingThem.sort(newestFirst) }
}

/** The meetings the invitations of the project call on a day, each once, without those called off. */
export function meetingsOn(
  mails: readonly StoredMail[],
  day: string,
  dayOf: (instant: Date) => string,
): StoredMail[] {
  const lastByUid = new Map<string, StoredMail>()
  const oldestFirst = [...mails].sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
  for (const mail of oldestFirst) {
    if (mail.meeting && mail.invite !== 'REPLY') lastByUid.set(mail.meeting.uid, mail)
  }
  return [...lastByUid.values()]
    .filter(
      (mail) =>
        mail.invite !== 'CANCEL' &&
        mail.meeting !== null &&
        dayOf(new Date(mail.meeting.start)) === day,
    )
    .sort((a, b) => Date.parse(a.meeting?.start ?? '') - Date.parse(b.meeting?.start ?? ''))
}
