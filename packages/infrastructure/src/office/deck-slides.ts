import { lexer, type Token, type Tokens } from 'marked'

/** A piece of text with its emphasis. */
export type DeckRun = { text: string; bold: boolean; italics: boolean }
/** A line of a slide: a paragraph, or an item of a list with its marker and depth. */
export type DeckLine = { runs: DeckRun[]; level: number; marker: string | null }
export type DeckTable = { header: DeckRun[][]; rows: DeckRun[][][] }
/** What one slide holds: a title, some lines, and at most one table. */
export type DeckSlide = { title: string; lines: DeckLine[]; table: DeckTable | null }
export type DeckContent = { title: string; slides: DeckSlide[] }

/** A slide holds this many lines, and a table this many rows: more goes on a slide that follows. */
export const MAX_SLIDE_LINES = 9
export const MAX_TABLE_ROWS = 9
/** A table shares its slide with the few lines that introduce it; more lines get their own. */
const MAX_LINES_WITH_TABLE = 2
export const BULLET = '•'

const ENTITIES: Readonly<Record<string, string>> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
}
/** The lexer escapes what would be markup in HTML: a slide wants the characters. */
const unescaped = (text: string): string =>
  text.replace(/&(?:amp|lt|gt|quot|#39);/g, (entity) => ENTITIES[entity] ?? entity)

type Emphasis = { bold: boolean; italics: boolean }
const PLAIN: Emphasis = { bold: false, italics: false }

/** The runs of a line: bold and italics kept, the rest of the markup read as text. */
function runsOf(tokens: readonly Token[] | undefined, emphasis: Emphasis = PLAIN): DeckRun[] {
  return (tokens ?? []).flatMap((token): DeckRun[] => {
    switch (token.type) {
      case 'strong':
        return runsOf((token as Tokens.Strong).tokens, { ...emphasis, bold: true })
      case 'em':
        return runsOf((token as Tokens.Em).tokens, { ...emphasis, italics: true })
      case 'br':
        return [{ text: ' ', ...emphasis }]
      case 'link':
      case 'del':
        return runsOf((token as Tokens.Link).tokens, emphasis)
      default: {
        const nested = (token as Tokens.Text).tokens
        if (nested && nested.length > 0) return runsOf(nested, emphasis)
        return [{ text: unescaped((token as Tokens.Text).text ?? token.raw), ...emphasis }]
      }
    }
  })
}

const textOf = (runs: readonly DeckRun[]): string => runs.map((run) => run.text).join('')

function listLines(list: Tokens.List, level: number): DeckLine[] {
  const start = typeof list.start === 'number' ? list.start : 1
  return list.items.flatMap((item, at) => {
    const own = item.tokens.filter((token) => token.type !== 'list')
    const nested = item.tokens.filter((token): token is Tokens.List => token.type === 'list')
    const line = { runs: runsOf(own), level, marker: list.ordered ? `${start + at}.` : BULLET }
    return [line, ...nested.flatMap((inner) => listLines(inner, level + 1))]
  })
}

function linesOf(token: Token): DeckLine[] {
  const plain = (runs: DeckRun[]): DeckLine[] =>
    textOf(runs).trim() === '' ? [] : [{ runs, level: 0, marker: null }]
  switch (token.type) {
    case 'paragraph':
      return plain(runsOf((token as Tokens.Paragraph).tokens))
    case 'list':
      return listLines(token as Tokens.List, 0)
    case 'blockquote':
      return (token as Tokens.Blockquote).tokens.flatMap(linesOf)
    case 'code':
      return plain([{ text: (token as Tokens.Code).text, ...PLAIN }])
    case 'space':
    case 'hr':
      return []
    default:
      return plain([{ text: token.raw.trim(), ...PLAIN }])
  }
}

function chunks<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = []
  for (let at = 0; at < items.length; at += size) out.push(items.slice(at, at + size))
  return out
}

/**
 * The slides of a text: a heading of the second level or below opens a slide, the first-level
 * heading names the deck, and what is too long for a slide continues on the next with the same
 * title and its number.
 */
export function deckContent(title: string, markdown: string): DeckContent {
  let deckTitle = title
  let section = title
  let pending: DeckLine[] = []
  let count = 0
  const slides: DeckSlide[] = []
  const add = (lines: DeckLine[], table: DeckTable | null): void => {
    count += 1
    slides.push({ title: count === 1 ? section : `${section} (${count})`, lines, table })
  }
  const flush = (): void => {
    for (const lines of chunks(pending, MAX_SLIDE_LINES)) add(lines, null)
    pending = []
  }
  for (const token of lexer(markdown)) {
    if (token.type === 'heading') {
      const heading = textOf(runsOf((token as Tokens.Heading).tokens)).trim()
      if ((token as Tokens.Heading).depth === 1) {
        deckTitle = heading
        continue
      }
      flush()
      section = heading
      count = 0
    } else if (token.type === 'table') {
      const { header, rows } = token as Tokens.Table
      if (pending.length > MAX_LINES_WITH_TABLE) flush()
      const head = header.map((cell) => runsOf(cell.tokens))
      const body = rows.map((row) => row.map((cell) => runsOf(cell.tokens)))
      const parts = body.length === 0 ? [[]] : chunks(body, MAX_TABLE_ROWS)
      parts.forEach((part, at) => {
        add(at === 0 ? pending : [], { header: head, rows: part })
      })
      pending = []
    } else {
      pending.push(...linesOf(token))
    }
  }
  flush()
  return { title: deckTitle, slides }
}
