/** What the model proposes: a text with [n] markers, and for each marker a file and a quote. */
export type Citation = {
  n: number
  path: string
  quote: string
}

export type DraftAnswer = {
  text: string
  citations: Citation[]
  /** What the model looked for and did not find. */
  missing: string[]
}

/** What the code found when it opened the cited file. */
export type Evidence =
  | { kind: 'found'; text: string; modifiedAt: string }
  | { kind: 'missing' }
  | { kind: 'outside' }
  | { kind: 'too_large' }

export const CITATION_STATUSES = [
  'verified',
  'quote_not_found',
  'quote_too_short',
  'file_not_found',
  'file_too_large',
  'outside_project',
] as const

export type CitationStatus = (typeof CITATION_STATUSES)[number]

export type CheckedCitation = Citation & {
  status: CitationStatus
  modifiedAt: string | null
}

export type CheckedAnswer = {
  text: string
  citations: CheckedCitation[]
  missing: string[]
  /** Markers in the text that no citation backs. */
  markersWithoutCitation: number[]
}

/** Shorter quotes match almost any file, so they prove nothing. */
export const MIN_QUOTE_LENGTH = 12

const MARKER = /\[(\d+)\]/g

/** Quotes are compared ignoring line breaks, runs of spaces and Unicode composition. */
export function normalizeForMatch(text: string): string {
  return text.normalize('NFC').replace(/\s+/g, ' ').trim()
}

export function checkCitation(citation: Citation, evidence: Evidence): CheckedCitation {
  if (evidence.kind === 'outside') {
    return { ...citation, status: 'outside_project', modifiedAt: null }
  }
  if (evidence.kind === 'missing') {
    return { ...citation, status: 'file_not_found', modifiedAt: null }
  }
  if (evidence.kind === 'too_large') {
    return { ...citation, status: 'file_too_large', modifiedAt: null }
  }
  const status = quoteStatus(normalizeForMatch(citation.quote), evidence)
  return { ...citation, status, modifiedAt: evidence.modifiedAt }
}

type FoundEvidence = Extract<Evidence, { kind: 'found' }>

function quoteStatus(quote: string, evidence: FoundEvidence): CitationStatus {
  if (quote.length < MIN_QUOTE_LENGTH) return 'quote_too_short'
  const { plain, decoded } = searchable(evidence)
  // A JSON export may write "—" as \u2014: the model quotes the character it read.
  return plain.includes(quote) || decoded().includes(quote) ? 'verified' : 'quote_not_found'
}

type Searchable = { plain: string; decoded: () => string }

/** One file is often cited many times: its text is prepared for matching only once. */
const searchableByEvidence = new WeakMap<FoundEvidence, Searchable>()

function searchable(evidence: FoundEvidence): Searchable {
  const known = searchableByEvidence.get(evidence)
  if (known) return known
  let decoded: string | null = null
  const prepared: Searchable = {
    plain: normalizeForMatch(evidence.text),
    decoded: () => {
      decoded ??= normalizeForMatch(decodeUnicodeEscapes(evidence.text))
      return decoded
    },
  }
  searchableByEvidence.set(evidence, prepared)
  return prepared
}

const UNICODE_ESCAPE = /\\u([0-9a-fA-F]{4})/g

export function decodeUnicodeEscapes(text: string): string {
  return text.replace(UNICODE_ESCAPE, (_match, hex: string) =>
    String.fromCharCode(Number.parseInt(hex, 16)),
  )
}

export function markersIn(text: string): number[] {
  const markers = new Set<number>()
  for (const match of text.matchAll(MARKER)) {
    markers.add(Number(match[1]))
  }
  return [...markers].sort((a, b) => a - b)
}

/**
 * The model proposes, the code checks: every citation is compared with the file it names.
 * Nothing is removed from the answer; what is not verified is marked as such.
 */
export function checkAnswer(
  draft: DraftAnswer,
  evidenceByPath: ReadonlyMap<string, Evidence>,
): CheckedAnswer {
  const citations = draft.citations.map((citation) =>
    checkCitation(citation, evidenceByPath.get(citation.path) ?? { kind: 'missing' }),
  )
  const cited = new Set(citations.map((citation) => citation.n))
  return {
    text: draft.text,
    citations,
    missing: draft.missing,
    markersWithoutCitation: markersIn(draft.text).filter((marker) => !cited.has(marker)),
  }
}

export function unverifiedCount(answer: CheckedAnswer): number {
  const unverified = answer.citations.filter((citation) => citation.status !== 'verified')
  return unverified.length + answer.markersWithoutCitation.length
}
