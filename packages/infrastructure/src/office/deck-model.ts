import {
  type DeckDraft,
  type DeckOutline,
  type DeckOutlineSlide,
  type DeckSlideDraft,
  type DeckTableDraft,
  DomainError,
} from '@octo/domain'
import { strFromU8, strToU8, zipSync } from 'fflate'
import { relationships, resolveTarget } from '../extract/package-parts.ts'
import { readZip } from '../extract/zip.ts'
import {
  CONTENT_TYPES,
  escaped,
  folderOf,
  type ModelSlide,
  modelSlides,
  OFFICE,
  type Parts,
  PRESENTATION,
  PRESENTATION_RELS,
  relsOf,
  SECTIONS,
  SLIDE_LIST,
  SLIDE_NUMBER,
  SLIDE_TYPE,
  TITLE_HOLDER,
  without,
} from './deck-renderer.ts'

const invalid = (): DomainError => new DomainError('deck_model_invalid')

const FRAME = /<p:graphicFrame\b[\s\S]*?<\/p:graphicFrame>/g
const SHAPE = /<p:sp\b[\s\S]*?<\/p:sp>/g
/** A paragraph with something in it; `<a:pPr` and an empty `<a:p/>` are not one. */
const PARAGRAPH = /<a:p(?:\s[^>]*)?>[\s\S]*?<\/a:p>/g
const PIECE = /<a:t>([\s\S]*?)<\/a:t>|<a:br\b[^>]*?(?:\/>|>[\s\S]*?<\/a:br>)/g
const PARAGRAPH_OPEN = /^<a:p(?:\s[^>]*)?>/
const PARAGRAPH_LOOK = /<a:pPr\b[^>]*?(?:\/>|>[\s\S]*?<\/a:pPr>)/
const RUN_LOOK = /<a:rPr\b[^>]*?(?:\/>|>[\s\S]*?<\/a:rPr>)/
const PARAGRAPH_END = /<a:endParaRPr\b[^>]*?(?:\/>|>[\s\S]*?<\/a:endParaRPr>)/
const ROW = /<a:tr\b[^>]*>[\s\S]*?<\/a:tr>/g
const CELL = /<a:tc\b[^>]*?(?:\/>|>[\s\S]*?<\/a:tc>)/g
const CELL_OPEN = /^<a:tc\b[^>]*>/
/** A cell another one covers: it shows nothing of its own. */
const COVERED = /\b[hv]Merge="1"/
const ROW_HEIGHT = /^<a:tr\b[^>]*\bh="(\d+)"/
const FRAME_HEIGHT = /(<p:xfrm>[\s\S]*?<a:ext\b[^>]*\bcy=")(\d+)(")/
const LINE_BREAK = '\n'
/** A value this short is a status or a label: a row with the same one is shown the same way. */
const MAX_LOOK_KEY = 24
/** Rows a table shows on one slide before it goes on, when the model's own table is shorter. */
const MIN_ROWS_PER_SLIDE = 12
const CONTINUED = ' (segue)'
/** How much of the model's own rows the outline shows, as an example of how a row is written. */
const MAX_SAMPLE_ROWS = 20
const MAX_SAMPLE_CELL = 60

const unescaped = (text: string): string =>
  text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')

/** What a paragraph says: its runs in order, a break as a new line. */
function textOf(paragraph: string): string {
  let text = ''
  for (const piece of paragraph.matchAll(PIECE)) {
    text += piece[1] === undefined ? LINE_BREAK : unescaped(piece[1])
  }
  return text
}

/** The paragraph with other words: its place, its alignment and the look of its first run stay. */
function withText(paragraph: string, text: string): string {
  const open = PARAGRAPH_OPEN.exec(paragraph)?.[0] ?? '<a:p>'
  const look = PARAGRAPH_LOOK.exec(paragraph)?.[0] ?? ''
  const end = PARAGRAPH_END.exec(paragraph)?.[0] ?? ''
  // An empty paragraph has no run to take the look from: the look it ends with is the same one.
  const run =
    RUN_LOOK.exec(paragraph)?.[0] ??
    end.replace(/^<a:endParaRPr\b/, '<a:rPr').replace(/<\/a:endParaRPr>$/, '</a:rPr>')
  const runs =
    text === ''
      ? ''
      : text
          .split(LINE_BREAK)
          .map((line) => `<a:r>${run}<a:t>${escaped(line)}</a:t></a:r>`)
          .join('<a:br/>')
  return `${open}${look}${runs}${end}</a:p>`
}

type Found = { at: number; xml: string }
const all = (xml: string, pattern: RegExp): Found[] =>
  [...xml.matchAll(pattern)].map((match) => ({ at: match.index, xml: match[0] }))
const inside = (found: Found, other: Found): boolean =>
  found.at >= other.at && found.at < other.at + other.xml.length

type SlideParts = {
  /** The paragraphs outside the tables that say something, in the order they are written. */
  texts: Array<Found & { id: string; text: string; title: boolean }>
  tables: Array<Found & { id: string }>
}

/** The lines of text and the tables of a slide, each with the id the outline gives it. */
function partsOf(xml: string, slide: number): SlideParts {
  const tables = all(xml, FRAME)
    .filter((frame) => frame.xml.includes('<a:tbl>'))
    .map((frame, at) => ({ ...frame, id: `S${slide}.TAB${at + 1}` }))
  const titles = all(xml, SHAPE).filter((shape) => TITLE_HOLDER.test(shape.xml))
  const said = all(xml, PARAGRAPH).filter(
    (paragraph) =>
      !tables.some((table) => inside(paragraph, table)) &&
      // A field is written by PowerPoint (the number of the slide, a date): it is not content.
      !paragraph.xml.includes('<a:fld') &&
      textOf(paragraph.xml).trim() !== '',
  )
  let titled = false
  const texts = said.map((paragraph, at) => {
    const title = !titled && titles.some((shape) => inside(paragraph, shape))
    titled ||= title
    return { ...paragraph, id: `S${slide}.T${at + 1}`, text: textOf(paragraph.xml).trim(), title }
  })
  return { texts, tables }
}

const shownCells = (row: string): string[] =>
  [...row.matchAll(CELL)]
    .map((cell) => cell[0])
    .filter((cell) => !COVERED.test(CELL_OPEN.exec(cell)?.[0] ?? ''))

const cellText = (cell: string): string =>
  [...cell.matchAll(PARAGRAPH)]
    .map((paragraph) => textOf(paragraph[0]).trim())
    .filter((text) => text !== '')
    .join(' ')

function outlineOf(slide: ModelSlide, number: number): DeckOutlineSlide {
  const { texts, tables } = partsOf(slide.xml, number)
  return {
    slide: number,
    texts: texts.map(({ id, text, title }) => ({ id, text, title })),
    tables: tables.map((table) => {
      const rows = [...table.xml.matchAll(ROW)].map((row) => row[0])
      return {
        id: table.id,
        columns: shownCells(rows[0] ?? '').map(cellText),
        rows: Math.max(rows.length - 1, 0),
        sample: rows
          .slice(1, 1 + MAX_SAMPLE_ROWS)
          .map((row) => shownCells(row).map((cell) => cellText(cell).slice(0, MAX_SAMPLE_CELL))),
      }
    }),
  }
}

function slidesOf(model: Uint8Array): { files: Parts; presentation: string; slides: ModelSlide[] } {
  const zip = readZip(model, () => true)
  if (!zip.ok) throw invalid()
  const files: Parts = { ...zip.files }
  const presentationPart = files[PRESENTATION]
  if (!presentationPart || !files[CONTENT_TYPES] || !files[PRESENTATION_RELS]) throw invalid()
  const presentation = strFromU8(presentationPart)
  return { files, presentation, slides: modelSlides(files, presentation) }
}

/**
 * The outline of a model deck: every line of text and every table of every slide, in the order
 * they are shown. Throws `deck_model_invalid` when the bytes are not a deck with something on it.
 */
export function readDeckOutline(model: Uint8Array): DeckOutline {
  const slides = slidesOf(model).slides.map((slide, at) => outlineOf(slide, at + 1))
  if (!slides.some((slide) => slide.texts.length > 0 || slide.tables.length > 0)) throw invalid()
  return { slides }
}

/** The text of a cell replaced: one paragraph, with the look of the first one it had. */
function withCellText(cell: string, text: string): string {
  const paragraphs = [...cell.matchAll(PARAGRAPH)]
  const first = paragraphs[0]
  const last = paragraphs.at(-1)
  if (!first || !last) return cell
  const start = first.index
  const end = last.index + last[0].length
  return `${cell.slice(0, start)}${withText(first[0], text)}${cell.slice(end)}`
}

function withCells(row: string, values: readonly string[]): string {
  let shown = -1
  return row.replace(CELL, (cell) => {
    if (COVERED.test(CELL_OPEN.exec(cell)?.[0] ?? '')) return cell
    shown += 1
    return withCellText(cell, values[shown] ?? '')
  })
}

/** The letters of a short value, whatever mark or symbol it is written with; numbers are no key. */
function lookKey(text: string): string {
  if (text.length > MAX_LOOK_KEY) return ''
  const letters = text
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .toLocaleLowerCase('it')
  return /\p{L}/u.test(letters) ? letters : ''
}

/**
 * The row of the model a new row is drawn like: one that shows the same short value in the same
 * column (a status, «Totale»), so that what was green stays green; else one of the first two, in
 * turn, which keeps the banding of the table.
 */
function lookFor(values: readonly string[], body: readonly string[], at: number): string {
  const scored = body.map((row) => {
    const cells = shownCells(row).map(cellText)
    const score = cells.filter((text, column) => {
      const wanted = lookKey(text)
      return wanted !== '' && wanted === lookKey(values[column] ?? '')
    }).length
    return { row, score }
  })
  const best = Math.max(0, ...scored.map((entry) => entry.score))
  // Rows that fit equally are taken in turn: a banded table stays banded.
  const fitting = best > 0 ? scored.filter((entry) => entry.score === best) : scored.slice(0, 2)
  return fitting[at % Math.max(fitting.length, 1)]?.row ?? ''
}

/** The table of a frame with other headings and rows, each row drawn like one of the model. */
function withRows(frame: string, table: DeckTableDraft): string {
  const rows = [...frame.matchAll(ROW)]
  const first = rows[0]
  const last = rows.at(-1)
  if (!first || !last) return frame
  const header = first[0]
  const body = rows.slice(1).map((row) => row[0])
  const drawn = [
    withCells(header, table.columns),
    ...table.rows.map((values, at) =>
      withCells(body.length > 0 ? lookFor(values, body, at) : header, values),
    ),
  ]
  const height = drawn.reduce((sum, row) => sum + Number(ROW_HEIGHT.exec(row)?.[1] ?? 0), 0)
  const filled = `${frame.slice(0, first.index)}${drawn.join('')}${frame.slice(last.index + last[0].length)}`
  return height > 0 ? filled.replace(FRAME_HEIGHT, `$1${height}$3`) : filled
}

/** The slide of the model with the texts and the tables written for it. */
function filledSlide(xml: string, number: number, written: DeckSlideDraft): string {
  const { texts, tables } = partsOf(xml, number)
  const changes: Array<Found & { next: string }> = [
    ...texts.map((text) => ({
      ...text,
      next: withText(text.xml, written.texts.find((given) => given.id === text.id)?.text ?? ''),
    })),
    ...tables.flatMap((table) => {
      const given = written.tables.find((candidate) => candidate.id === table.id)
      return given ? [{ ...table, next: withRows(table.xml, given) }] : []
    }),
  ]
  // From the end, so that the places found in the model still hold.
  return changes
    .sort((a, b) => b.at - a.at)
    .reduce(
      (slide, change) =>
        `${slide.slice(0, change.at)}${change.next}${slide.slice(change.at + change.xml.length)}`,
      xml,
    )
}

/**
 * A slide with one table too long for it, as the slides it takes: the same slide again for the
 * rows that follow, its title saying that it goes on.
 */
function pagesOf(written: DeckSlideDraft, model: DeckOutlineSlide): DeckSlideDraft[] {
  const [table] = written.tables
  const outline = model.tables[0]
  if (written.tables.length !== 1 || !table || !outline) return [written]
  const perSlide = Math.max(outline.rows, MIN_ROWS_PER_SLIDE)
  if (table.rows.length <= perSlide) return [written]
  const titleId = model.texts.find((text) => text.title)?.id
  const pages: DeckSlideDraft[] = []
  for (let from = 0; from < table.rows.length; from += perSlide) {
    pages.push({
      ...written,
      texts: written.texts.map((text) =>
        from > 0 && text.id === titleId ? { ...text, text: `${text.text}${CONTINUED}` } : text,
      ),
      tables: [{ ...table, rows: table.rows.slice(from, from + perSlide) }],
    })
  }
  return pages
}

/**
 * The model deck with the content written for another period: the same slides in the same order,
 * each text and each table in its place and with its look. A slide marked to skip is left out; a
 * table too long goes on a copy of its slide. Master, layouts, theme and pictures are the model's.
 */
export function fillDeck(model: Uint8Array, deck: DeckDraft): Uint8Array {
  const { files, presentation, slides } = slidesOf(model)
  const outline = slides.map((slide, at) => outlineOf(slide, at + 1))
  let number = Math.max(
    0,
    ...slides.map((slide) => Number(SLIDE_NUMBER.exec(slide.part)?.[1] ?? 0)),
  )
  let id = Math.max(255, ...slides.map((slide) => slide.id))
  const entries = SLIDE_LIST.exec(presentation)?.[0].match(/<p:sldId\b[^>]*\/>/g) ?? []
  const entryOf = (slide: ModelSlide): string =>
    entries.find((entry) => new RegExp(`\\bid="${slide.id}"`).test(entry)) ?? ''
  const removed: string[] = []
  const added: Array<{ part: string; rel: string }> = []
  const list: string[] = []

  slides.forEach((slide, at) => {
    const written = deck.slides.find((candidate) => candidate.slide === at + 1)
    const outlined = outline[at]
    const rels = relsOf(slide.part)
    if (!written || written.skip || !outlined) {
      // The slide goes, with its notes: what it said was of another period.
      const notes = [...relationships(files[rels]).values()]
        .filter((target) => target.includes('notesSlide'))
        .map((target) => resolveTarget(folderOf(slide.part), target))
      for (const part of [slide.part, ...notes]) {
        delete files[part]
        delete files[relsOf(part)]
        removed.push(part)
      }
      return
    }
    const [first, ...more] = pagesOf(written, outlined)
    if (!first) return
    files[slide.part] = strToU8(filledSlide(slide.xml, at + 1, first))
    list.push(entryOf(slide))
    for (const page of more) {
      number += 1
      id += 1
      const part = `ppt/slides/slide${number}.xml`
      files[part] = strToU8(filledSlide(slide.xml, at + 1, page))
      // The copy stands on the same layout and shows the same pictures; the notes stay with the first.
      const copied = files[rels]
      if (copied) {
        files[relsOf(part)] = strToU8(
          strFromU8(copied).replace(/<Relationship\b[^>]*notesSlide[^>]*\/>/g, ''),
        )
      }
      const rel = `rIdOcto${number}`
      added.push({ part, rel })
      list.push(`<p:sldId id="${id}" r:id="${rel}"/>`)
    }
  })
  if (list.length === 0) throw invalid()

  files[PRESENTATION] = strToU8(
    presentation
      .replace(SLIDE_LIST, `<p:sldIdLst>${list.join('')}</p:sldIdLst>`)
      .replace(SECTIONS, ''),
  )
  const gone = removed.map((part) => part.slice('ppt/'.length))
  files[PRESENTATION_RELS] = strToU8(
    without(strFromU8(files[PRESENTATION_RELS] as Uint8Array), 'Relationship', gone).replace(
      '</Relationships>',
      `${added
        .map(
          (slide) =>
            `<Relationship Id="${slide.rel}" Type="${OFFICE}/slide" Target="${slide.part.slice('ppt/'.length)}"/>`,
        )
        .join('')}</Relationships>`,
    ),
  )
  files[CONTENT_TYPES] = strToU8(
    without(
      strFromU8(files[CONTENT_TYPES] as Uint8Array),
      'Override',
      removed.map((part) => `/${part}`),
    ).replace(
      '</Types>',
      `${added
        .map((slide) => `<Override PartName="/${slide.part}" ContentType="${SLIDE_TYPE}"/>`)
        .join('')}</Types>`,
    ),
  )
  return zipSync(files)
}
