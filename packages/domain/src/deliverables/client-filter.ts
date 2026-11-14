/** A figure in a text for the client that may be internal: an effort or an amount of money. */
export type ClientFilterFinding = {
  kind: 'effort' | 'money'
  /** The figure with its unit, as written. */
  match: string
  /** The words around it, to find it in the text. */
  excerpt: string
}

const NUMBER = String.raw`\d+(?:[.,]\d+)*`
/**
 * Units of effort as they are written inside a supplier: days of work, never days of the
 * calendar ("entro 5 giorni" is a deadline, and stays).
 */
const EFFORT_UNIT = String.raw`(?:gg|g\.?\s?u\.?|giornat[ae](?:\s+uomo)?|giorn[oi][\s/-]uomo|ore[\s/-]uomo|m\.?d\.?|man[\s-]?days?|man[\s-]?hours?|person[\s-]days?|fte)`
const MONEY_UNIT = String.raw`(?:k?€|euro|eur)`
const EFFORT = new RegExp(String.raw`(?<![\w.,])${NUMBER}\s?${EFFORT_UNIT}(?![\w])`, 'giu')
const MONEY = new RegExp(
  String.raw`(?<![\w.,])${NUMBER}\s?(?:k|mila\s|milioni\s(?:di\s)?)?\s?${MONEY_UNIT}(?![\w])|(?:€|eur)\s?${NUMBER}`,
  'giu',
)
const AROUND = 40
const MARKUP = /[*|#>`]|-{3,}/g

function findings(text: string, pattern: RegExp, kind: ClientFilterFinding['kind']) {
  return [...text.matchAll(pattern)].map((found): ClientFilterFinding => {
    const from = Math.max(0, found.index - AROUND)
    const to = Math.min(text.length, found.index + found[0].length + AROUND)
    return {
      kind,
      match: found[0].trim(),
      // The marks of the formatting are not words: an excerpt reads as the text does.
      excerpt: text.slice(from, to).replace(MARKUP, ' ').replace(/\s+/g, ' ').trim(),
    }
  })
}

/**
 * The figures of a text for the client that the PM should look at before it leaves: days of
 * effort and amounts of money. A check by the code, on the words: it does not know whether an
 * amount is a price already agreed, so it never removes anything and only points.
 */
export function clientFilter(text: string): ClientFilterFinding[] {
  const seen = new Set<string>()
  return [...findings(text, EFFORT, 'effort'), ...findings(text, MONEY, 'money')].filter(
    (finding) => {
      const key = `${finding.kind}:${finding.excerpt}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    },
  )
}
