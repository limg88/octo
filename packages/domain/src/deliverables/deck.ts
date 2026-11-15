/** A line of text of a slide of the model: where it is and what it says there. */
export type DeckOutlineText = {
  id: string
  text: string
  /** True for the title of the slide. */
  title: boolean
}

/** A table of a slide of the model: its headings and the rows it holds there. */
export type DeckOutlineTable = {
  id: string
  columns: string[]
  rows: number
  /**
   * The rows the model shows, cut short: how a row is written there (a status with its mark, a
   * total at the end). They are of the period of the model: an example, never a source.
   */
  sample: string[][]
}

export type DeckOutlineSlide = {
  /** The place of the slide in the model, from 1. */
  slide: number
  texts: DeckOutlineText[]
  tables: DeckOutlineTable[]
}

/**
 * What a model deck is made of, slide by slide: every line of text and every table, each with an
 * id. It is the structure a deck for another period keeps; what it says is of the period it was
 * made for, and is never a source.
 */
export type DeckOutline = { slides: DeckOutlineSlide[] }

export type DeckTextDraft = { id: string; text: string }
export type DeckTableDraft = { id: string; columns: string[]; rows: string[][] }
export type DeckSlideDraft = {
  slide: number
  /** True when the project has nothing to put on this slide for the period: it is left out. */
  skip: boolean
  texts: DeckTextDraft[]
  tables: DeckTableDraft[]
}

/** The content of a deck written on the outline of a model, for a period. */
export type DeckDraft = { slides: DeckSlideDraft[] }

/** What the code had to mend in a deck as it was written, told to the PM. */
export type DeckProblem =
  | { kind: 'slide_missing'; slide: number }
  | { kind: 'text_missing'; slide: number; id: string; was: string }
  | { kind: 'table_missing'; slide: number; id: string }
  | { kind: 'row_width'; slide: number; id: string; rows: number }

/**
 * A deck made to fit its outline: the slides of the model in their order, every text and table of
 * each. What the writer left out is left empty, never filled with what the model said (that is of
 * another period); what it added beyond the outline is dropped. Each mending is a problem.
 */
export function fitDeckDraft(
  outline: DeckOutline,
  draft: DeckDraft,
): { deck: DeckDraft; problems: DeckProblem[] } {
  const problems: DeckProblem[] = []
  const slides = outline.slides.map((model): DeckSlideDraft => {
    const written = draft.slides.find((candidate) => candidate.slide === model.slide)
    if (!written) {
      problems.push({ kind: 'slide_missing', slide: model.slide })
      return { slide: model.slide, skip: true, texts: [], tables: [] }
    }
    if (written.skip) return { slide: model.slide, skip: true, texts: [], tables: [] }
    const texts = model.texts.map((text): DeckTextDraft => {
      const given = written.texts.find((candidate) => candidate.id === text.id)
      if (!given)
        problems.push({ kind: 'text_missing', slide: model.slide, id: text.id, was: text.text })
      return { id: text.id, text: given?.text.trim() ?? '' }
    })
    const tables = model.tables.map((table): DeckTableDraft => {
      const given = written.tables.find((candidate) => candidate.id === table.id)
      if (!given) {
        problems.push({ kind: 'table_missing', slide: model.slide, id: table.id })
        return { id: table.id, columns: table.columns, rows: [] }
      }
      const width = table.columns.length
      const uneven = given.rows.filter((row) => row.length !== width).length
      if (uneven > 0)
        problems.push({ kind: 'row_width', slide: model.slide, id: table.id, rows: uneven })
      return {
        id: table.id,
        // Headings may name the new period, but a table keeps its columns.
        columns:
          given.columns.length === width ? given.columns.map((c) => c.trim()) : table.columns,
        rows: given.rows.map((row) =>
          Array.from({ length: width }, (_unused, at) => (row[at] ?? '').trim()),
        ),
      }
    })
    return { slide: model.slide, skip: false, texts, tables }
  })
  return { deck: { slides }, problems }
}

/** Every string of a deck passed through `change`: to take the source markers off, for one. */
export function mapDeckStrings(deck: DeckDraft, change: (text: string) => string): DeckDraft {
  return {
    slides: deck.slides.map((slide) => ({
      ...slide,
      texts: slide.texts.map((text) => ({ ...text, text: change(text.text) })),
      tables: slide.tables.map((table) => ({
        ...table,
        columns: table.columns.map(change),
        rows: table.rows.map((row) => row.map(change)),
      })),
    })),
  }
}

const cell = (text: string): string => text.replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ')

/**
 * The deck as a text a person reviews and the code checks: a section per slide, its lines, its
 * tables. The first title of a slide is the heading of its section.
 */
export function deckMarkdown(title: string, outline: DeckOutline, deck: DeckDraft): string {
  const parts: string[] = [`# ${title}`, '']
  for (const slide of deck.slides) {
    if (slide.skip) continue
    const model = outline.slides.find((candidate) => candidate.slide === slide.slide)
    const titleId = model?.texts.find((text) => text.title)?.id
    const heading = slide.texts.find((text) => text.id === titleId)?.text
    parts.push(`## Slide ${slide.slide}${heading ? ` — ${heading}` : ''}`, '')
    const lines = slide.texts.filter((text) => text.id !== titleId && text.text !== '')
    if (lines.length > 0) parts.push(...lines.map((text) => `- ${cell(text.text)}`), '')
    for (const table of slide.tables) {
      if (table.columns.length === 0) continue
      parts.push(
        `| ${table.columns.map(cell).join(' | ')} |`,
        `|${table.columns.map(() => '---').join('|')}|`,
        ...table.rows.map((row) => `| ${row.map(cell).join(' | ')} |`),
        '',
      )
    }
  }
  return `${parts.join('\n').trimEnd()}\n`
}

/** A problem of a deck in the words the PM reads among what is missing. */
export function deckProblemText(problem: DeckProblem): string {
  switch (problem.kind) {
    case 'slide_missing':
      return `Slide ${problem.slide} del modello: non è stata scritta, quindi è stata tolta dalla presentazione.`
    case 'text_missing':
      return `Slide ${problem.slide}: il testo che nel modello dice «${problem.was}» non è stato scritto ed è rimasto vuoto.`
    case 'table_missing':
      return `Slide ${problem.slide}: una tabella del modello non è stata scritta ed è rimasta senza righe.`
    case 'row_width':
      return `Slide ${problem.slide}: ${problem.rows} righe di una tabella avevano più o meno valori delle colonne e sono state adattate.`
  }
}
