import { personKey } from '../hours/model.ts'
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

/** Systems that write under their own name from an address that does not say so. */
/** Also when it signs with the person who caused the notice: `Mario Rossi (Jira)`. */
const NOTIFIER_NAME =
  /^\s*"?(azure devops|jira|confluence|sharepoint|microsoft teams)\b|\((jira|azure devops|confluence)\)\s*"?\s*(<|$)/i

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

/**
 * Whom a mail that waits is for, as far as its headers and its conversation say: the PM alone,
 * many people of whom the PM is one, or a conversation one of the supplier's own has taken up.
 */
export type MailAddressing = 'only_me' | 'answered_by_own' | 'among_many'

/** What the code knows of a mail that waits, beside the mail itself. */
export type WaitingMail = {
  addressing: MailAddressing
  /** What the conversation is about: the same for every mail of the same exchange. */
  conversation: string
  /** How many mails of the conversation wait: only the last is shown. */
  mails: number
  /** How many people the mail is written to. */
  recipients: number
  /** Who of the supplier's own wrote after it, when somebody did. */
  answeredBy: string | null
}

/** The name a header line gives before the address: `Rossi Mario <m.rossi@…>` is `Rossi Mario`. */
export const senderName = (from: string): string =>
  from
    .replace(/<[^>]*>/g, '')
    .replace(/"/g, '')
    .trim()

/** What a conversation is told by: its subject, or the mail itself when it has none. */
export const conversationOfMail = (mail: StoredMail): string =>
  threadSubject(mail.subject) || mail.id

export type MailThreads = {
  /**
   * Mail written to the PM by a person, that the PM has not answered: the last of each
   * conversation, newest first.
   */
  awaitingMe: StoredMail[]
  /** What the code knows of each mail of `awaitingMe`, by the id of the mail. */
  waiting: Record<string, WaitingMail>
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
  /** The supplier's own people, each as `personKey` gives it: who answers in the PM's place. */
  ownPeople: ReadonlySet<string> = new Set(),
): MailThreads {
  const own = new Set(ownAddresses.map((address) => address.toLowerCase()))
  if (own.size === 0) return { awaitingMe: [], waiting: {}, awaitingThem: [] }
  const age = (mail: StoredMail): number => (now.getTime() - Date.parse(mail.date)) / DAY_MS
  const mine = mails.filter((mail) => isFrom(mail, own))
  const others = mails.filter((mail) => !isFrom(mail, own))
  const after = (later: StoredMail, earlier: StoredMail): boolean =>
    Date.parse(later.date) > Date.parse(earlier.date) &&
    conversationOfMail(later) === conversationOfMail(earlier)
  const unanswered = others.filter(
    (mail) =>
      mail.invite === null &&
      age(mail) <= REPLY_WINDOW_DAYS &&
      !NOT_A_PERSON.test(mail.from) &&
      !NOTIFIER_NAME.test(mail.from) &&
      addressesIn(mail.to).some((address) => own.has(address)) &&
      !mine.some((reply) => answers(reply, mail)) &&
      // The PM wrote later in the same conversation: it was taken up there.
      !mine.some((reply) => after(reply, mail)),
  )
  // A conversation is one thing to answer: its last mail stands for the ones before it.
  const lastOf = new Map<string, StoredMail>()
  const mailsOf = new Map<string, number>()
  for (const mail of unanswered) {
    const conversation = conversationOfMail(mail)
    const known = lastOf.get(conversation)
    if (!known || Date.parse(mail.date) > Date.parse(known.date)) lastOf.set(conversation, mail)
    mailsOf.set(conversation, (mailsOf.get(conversation) ?? 0) + 1)
  }
  const awaitingMe = [...lastOf.values()]
  const waiting: Record<string, WaitingMail> = {}
  for (const mail of awaitingMe) {
    const recipients = addressesIn(mail.to)
    const taker = others
      .filter((later) => after(later, mail) && ownPeople.has(personKey(senderName(later.from))))
      .sort((a, b) => Date.parse(a.date) - Date.parse(b.date))[0]
    waiting[mail.id] = {
      addressing: recipients.every((address) => own.has(address))
        ? 'only_me'
        : taker
          ? 'answered_by_own'
          : 'among_many',
      conversation: conversationOfMail(mail),
      mails: mailsOf.get(conversationOfMail(mail)) ?? 1,
      recipients: recipients.length,
      answeredBy: taker ? senderName(taker.from) : null,
    }
  }
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
  return {
    awaitingMe: awaitingMe.sort(newestFirst),
    waiting,
    awaitingThem: awaitingThem.sort(newestFirst),
  }
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
