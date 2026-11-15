import type { MailMessage, MailPerson } from './message.ts'

/**
 * The folders never read unless the configuration names them: drafts, trash, junk, what is still
 * to be sent, and what Exchange keeps for itself. Mail shows them in the language of the Mac.
 */
export const DEFAULT_EXCLUDED_FOLDERS: readonly string[] = [
  'Bozze',
  'Drafts',
  'Posta eliminata',
  'Deleted Items',
  'Trash',
  'Posta indesiderata',
  'Junk Email',
  'Junk',
  'Posta in uscita',
  'Outbox',
  'Problemi di sincronizzazione',
  'Sync Issues',
  'Cronologia delle conversazioni',
  'Conversation History',
]

/** The answer of an invited person to a meeting: it says nothing but yes, no or maybe. */
const CALENDAR_REPLY = 'REPLY'

/** What the configuration asks of the mail, as rules a message is checked against. */
export interface MailRules {
  /** Words, phrases, addresses or `@domain`: none means every mail is wanted. */
  readonly keywords: readonly string[]
  /** Folders to read, with what is under them; none means all but the excluded ones. */
  readonly folders: readonly string[]
  readonly excludeSenders: readonly string[]
}

const lower = (text: string): string => text.toLocaleLowerCase('it')
const escaped = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Whether a folder is one of those named, or under one of them. */
const under = (folder: string, names: readonly string[]): boolean =>
  names.some((name) => {
    const wanted = lower(name)
    const actual = lower(folder)
    return actual === wanted || actual.startsWith(`${wanted}/`)
  })

/** Whether a folder is read: one of those named, or any that is not excluded by default. */
export function folderWanted(folder: string, rules: MailRules): boolean {
  if (rules.folders.length > 0) return under(folder, rules.folders)
  return !under(folder, DEFAULT_EXCLUDED_FOLDERS)
}

const everyone = (message: MailMessage): MailPerson[] => [
  ...(message.from ? [message.from] : []),
  ...message.to,
  ...message.cc,
]

/** Whether an address is the one a keyword names: the address itself, or its `@domain`. */
const addressMatches = (email: string, keyword: string): boolean =>
  keyword.startsWith('@') ? lower(email).endsWith(lower(keyword)) : lower(email) === lower(keyword)

/**
 * Whether a keyword is in a mail. An address or a domain is looked for among who wrote and who
 * received, and in the text; a word or a phrase only as a whole, never inside a longer word.
 */
export function keywordIn(message: MailMessage, keyword: string): boolean {
  const body = `${message.subject}\n${message.text}`
  if (keyword.includes('@')) {
    return (
      everyone(message).some((person) => addressMatches(person.email, keyword)) ||
      lower(body).includes(lower(keyword))
    )
  }
  return phraseIn(body, keyword)
}

/** Whether a word or a phrase is in a text as a whole, never inside a longer word. */
export function phraseIn(text: string, phrase: string): boolean {
  const whole = new RegExp(`(?<![\\p{L}\\p{N}])${escaped(phrase)}(?![\\p{L}\\p{N}])`, 'iu')
  return whole.test(text)
}

/** Whether a mail may be taken at all: not an excluded sender, not a calendar answer. */
export function mailAllowed(message: MailMessage, rules: MailRules): boolean {
  if (message.calendarMethod === CALENDAR_REPLY) return false
  const sender = message.from?.email ?? ''
  return !rules.excludeSenders.some((excluded) => lower(excluded) === lower(sender))
}

/** Whether a mail is taken: not an excluded sender, not a calendar answer, and about the project. */
export function mailWanted(message: MailMessage, rules: MailRules): boolean {
  if (!mailAllowed(message, rules)) return false
  if (rules.keywords.length === 0) return true
  return rules.keywords.some((keyword) => keywordIn(message, keyword))
}
