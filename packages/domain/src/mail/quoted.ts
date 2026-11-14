import { tidyText } from './text.ts'

// A reply carries, under what its author wrote, every message of the thread before it: on a real
// project that is most of the text of the mail archive, and the same sentences come back in
// every reply. What a mail says is what its author wrote; the messages it quotes are mails of
// their own.

/**
 * Where a quoted message starts, as mail programs write it: the header block of Outlook («Da: …»
 * then «Inviato: …» within a few lines, in Italian or English), the «Original Message» line, or
 * the «On … wrote:» line. Linear in the text: every quantifier is bounded.
 */
const QUOTED_MESSAGE =
  /^(?:(?:Da|From):.{0,300}\n(?:.{0,300}\n){0,3}?(?:Inviato|Sent|Data|Date):|-{2,} ?(?:Messaggio originale|Original Message|Messaggio inoltrato|Forwarded message) ?-{2,}|(?:Il giorno|Il|On) .{5,200}(?:ha scritto|wrote):[ \t]*$)/gim

/** The footer of a Teams invitation: how to join, never what the mail says. */
const TEAMS_FOOTER = /^_{10,}[ \t]*\n\s*(?:Riunione di Microsoft Teams|Microsoft Teams)/im

/** A line that only separates: the rule mail programs draw above a quoted message. */
const TRAILING_RULE = /(?:\n[ \t]*[_-]{5,}[ \t]*)+$/

/**
 * Letters and digits an author must have written for the mail to stand without what it quotes:
 * less («ok», «in allegato», a forward with no comment) and the message it answers stays.
 */
export const MIN_OWN_CHARS = 40

const written = (text: string): number => text.replace(/[^\p{L}\d]/gu, '').length

const upTo = (text: string, end: number): string =>
  tidyText(tidyText(text.slice(0, end)).replace(TRAILING_RULE, ''))

/**
 * What the author of a mail wrote, without the messages quoted under it nor the footer of a
 * meeting invitation. A mail that says almost nothing of its own (a forward, a one-word reply)
 * keeps the first message it quotes, and only that one: without it the mail would say nothing.
 */
export function ownText(text: string): string {
  const footer = TEAMS_FOOTER.exec(text)
  const body = footer ? text.slice(0, footer.index) : text
  const starts = [...body.matchAll(QUOTED_MESSAGE)].map((match) => match.index)
  const [first, second] = starts
  if (first === undefined) return tidyText(body)
  const own = upTo(body, first)
  return written(own) >= MIN_OWN_CHARS ? own : upTo(body, second ?? body.length)
}
