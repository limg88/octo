import { DomainError } from '@octo/domain'
import { strFromU8, strToU8, zipSync } from 'fflate'
import { relationships, resolveTarget } from '../extract/package-parts.ts'
import { attr, tags } from '../extract/xml.ts'
import { readZip } from '../extract/zip.ts'
import {
  type DeckLine,
  type DeckRun,
  type DeckSlide,
  type DeckTable,
  deckContent,
} from './deck-slides.ts'

const PRESENTATION = 'ppt/presentation.xml'
const PRESENTATION_RELS = 'ppt/_rels/presentation.xml.rels'
const CONTENT_TYPES = '[Content_Types].xml'
const SLIDE_TYPE = 'application/vnd.openxmlformats-officedocument.presentationml.slide+xml'
const OFFICE = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const TABLE_URI = 'http://schemas.openxmlformats.org/drawingml/2006/table'
const TITLE_HOLDER = /<p:ph\b[^>]*type="(?:title|ctrTitle)"/
/** A shape that is the title of its slide; shapes do not nest, so the first end closes it. */
const TITLE_SHAPE =
  /<p:sp\b[^>]*>(?:(?!<p:sp\b)[\s\S])*?<p:ph\b[^>]*type="(?:title|ctrTitle)"[\s\S]*?<\/p:sp>/
const TEXT_BODY = /(<p:txBody>[\s\S]*?)(<a:p\b[\s\S]*<\/a:p>)(\s*<\/p:txBody>)/
const FIRST_RUN_LOOK = /<a:rPr\b[^>]*?(?:\/>|>[\s\S]*?<\/a:rPr>)/
const TABLE_FRAME = /<p:graphicFrame\b[\s\S]*?<\/p:graphicFrame>/g
const FRAME_PLACE =
  /<p:xfrm>\s*<a:off x="(-?\d+)" y="(-?\d+)"\s*\/>\s*<a:ext cx="(\d+)" cy="(\d+)"\s*\/>/
const TABLE_LOOK = /<a:tblPr\b[^>]*?(?:\/>|>[\s\S]*?<\/a:tblPr>)/
const SLIDE_SIZE = /<p:sldSz\b[^>]*\bcx="(\d+)"[^>]*\bcy="(\d+)"/
const SLIDE_LIST = /<p:sldIdLst>[\s\S]*?<\/p:sldIdLst>/
/** The sections of the model name slides that are no longer there. */
const SECTIONS = /<p:ext\b[^>]*>\s*<p14:sectionLst\b[\s\S]*?<\/p14:sectionLst>\s*<\/p:ext>/
const SLIDE_NUMBER = /slide(\d+)\.xml$/
const DEFAULT_TABLE_LOOK = '<a:tblPr firstRow="1" bandRow="1"/>'
/** Where the content goes when the model shows no table to copy the place of: shares of the slide. */
const DEFAULT_AREA = { left: 0.05, top: 0.22, width: 0.9, height: 0.66 }
const DEFAULT_SLIDE = { cx: 12_192_000, cy: 6_858_000 }
/** The share of the area the lines take when a table follows them. */
const LINES_SHARE = 0.2
/** Sizes in hundredths of a point, lengths in EMU, as PowerPoint counts them. */
const TEXT_SIZE = 1400
const TABLE_TEXT_SIZE = 1100
const ROW_HEIGHT = 370_840
const INDENT = 285_750

type Area = { x: number; y: number; cx: number; cy: number }
type Parts = Record<string, Uint8Array>

const invalid = (): DomainError => new DomainError('deck_model_invalid')

/** Text as it may stand inside an XML element; characters XML forbids are dropped. */
const escaped = (text: string): string =>
  text
    // biome-ignore lint/suspicious/noControlCharactersInRegex: these are the characters XML 1.0 forbids.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

const run = (piece: DeckRun, size: number, bold = false): string =>
  `<a:r><a:rPr lang="it-IT" sz="${size}"${piece.bold || bold ? ' b="1"' : ''}${piece.italics ? ' i="1"' : ''} dirty="0"/><a:t>${escaped(piece.text)}</a:t></a:r>`

function lineXml(line: DeckLine): string {
  const left = INDENT * (line.level + (line.marker === null ? 0 : 1))
  const mark =
    line.marker === null
      ? '<a:buNone/>'
      : /^\d/.test(line.marker)
        ? `<a:buFont typeface="+mj-lt"/><a:buAutoNum type="arabicPeriod" startAt="${Number.parseInt(line.marker, 10)}"/>`
        : `<a:buFont typeface="Arial"/><a:buChar char="${escaped(line.marker)}"/>`
  const hanging = line.marker === null ? 0 : -INDENT
  return `<a:p><a:pPr marL="${left}" indent="${hanging}">${mark}</a:pPr>${line.runs.map((piece) => run(piece, TEXT_SIZE)).join('')}</a:p>`
}

const place = (area: Area): string =>
  `<a:off x="${area.x}" y="${area.y}"/><a:ext cx="${area.cx}" cy="${area.cy}"/>`

function linesShape(lines: readonly DeckLine[], area: Area, id: number): string {
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="Testo ${id}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm>${place(area)}</a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr><p:txBody><a:bodyPr wrap="square" rtlCol="0"><a:normAutofit/></a:bodyPr><a:lstStyle/>${lines.map(lineXml).join('')}</p:txBody></p:sp>`
}

function tableShape(table: DeckTable, look: string, area: Area, id: number): string {
  const columns = Math.max(table.header.length, 1)
  const width = Math.floor(area.cx / columns)
  const cell = (runs: readonly DeckRun[] | undefined, header: boolean): string =>
    `<a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p>${(runs ?? []).map((piece) => run(piece, TABLE_TEXT_SIZE, header)).join('')}</a:p></a:txBody><a:tcPr/></a:tc>`
  // A row shorter than the heading is filled out: a table wants every cell.
  const row = (cells: readonly DeckRun[][], header: boolean): string =>
    `<a:tr h="${ROW_HEIGHT}">${Array.from({ length: columns }, (_unused, at) => cell(cells[at], header)).join('')}</a:tr>`
  const grid = `<a:tblGrid>${`<a:gridCol w="${width}"/>`.repeat(columns)}</a:tblGrid>`
  const rows = [row(table.header, true), ...table.rows.map((cells) => row(cells, false))]
  const frame = { ...area, cy: ROW_HEIGHT * rows.length }
  return `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="${id}" name="Tabella ${id}"/><p:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></p:cNvGraphicFramePr><p:nvPr/></p:nvGraphicFramePr><p:xfrm>${place(frame)}</p:xfrm><a:graphic><a:graphicData uri="${TABLE_URI}"><a:tbl>${look}${grid}${rows.join('')}</a:tbl></a:graphicData></a:graphic></p:graphicFrame>`
}

/** A title shape with other words: its place and its look stay the model's. */
function retitled(shape: string, title: string): string {
  const look = FIRST_RUN_LOOK.exec(shape)?.[0] ?? ''
  const paragraph = `<a:p><a:r>${look}<a:t>${escaped(title)}</a:t></a:r></a:p>`
  if (!TEXT_BODY.test(shape)) throw invalid()
  return shape.replace(TEXT_BODY, (_whole, open: string, _old: string, close: string) => {
    return `${open}${paragraph}${close}`
  })
}

/** What a slide of content is made from: taken once from the slide of the model chosen for it. */
type Mould = {
  /** The opening tag of the slide, with the namespaces its shapes use. */
  root: string
  titleShape: string
  tableLook: string
  area: Area
  /** The layout the slide stands on, as a target from the folder of the slides. */
  layout: string
}

function slideXml(mould: Mould, slide: DeckSlide): string {
  const { area } = mould
  const lines = slide.lines.length > 0
  const split = lines && slide.table !== null
  const linesArea = split ? { ...area, cy: Math.floor(area.cy * LINES_SHARE) } : area
  const tableArea = split ? { ...area, y: area.y + linesArea.cy, cy: area.cy - linesArea.cy } : area
  const shapes = [
    retitled(mould.titleShape, slide.title),
    lines ? linesShape(slide.lines, linesArea, 3) : '',
    slide.table ? tableShape(slide.table, mould.tableLook, tableArea, 4) : '',
  ].join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${mould.root}<p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>${shapes}</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`
}

const relsOf = (part: string): string => {
  const at = part.lastIndexOf('/')
  return `${part.slice(0, at)}/_rels/${part.slice(at + 1)}.rels`
}
const folderOf = (part: string): string => part.slice(0, part.lastIndexOf('/'))

type ModelSlide = { id: number; part: string; xml: string }

/** The slides of the model in the order they are shown. */
function modelSlides(files: Parts, presentation: string): ModelSlide[] {
  const targets = relationships(files[PRESENTATION_RELS])
  return tags(SLIDE_LIST.exec(presentation)?.[0] ?? '', 'p:sldId').flatMap((attrs) => {
    const target = targets.get(attr(attrs, 'r:id') ?? '')
    const part = target ? resolveTarget('ppt', target) : null
    const bytes = part ? files[part] : undefined
    if (!part || !bytes) return []
    return [{ id: Number(attr(attrs, 'id')), part, xml: strFromU8(bytes) }]
  })
}

function mouldOf(files: Parts, slide: ModelSlide, presentation: string): Mould {
  const root = /<p:sld\b[^>]*>/.exec(slide.xml)?.[0]
  const titleShape = TITLE_SHAPE.exec(slide.xml)?.[0]
  const layout = [...relationships(files[relsOf(slide.part)]).values()].find((target) =>
    target.includes('slideLayout'),
  )
  if (!root || !titleShape || !layout) throw invalid()
  const table = slide.xml.match(TABLE_FRAME)?.find((frame) => frame.includes('<a:tbl>'))
  const at = table ? FRAME_PLACE.exec(table) : null
  const size = SLIDE_SIZE.exec(presentation)
  const sheet = size ? { cx: Number(size[1]), cy: Number(size[2]) } : DEFAULT_SLIDE
  const area: Area = at
    ? { x: Number(at[1]), y: Number(at[2]), cx: Number(at[3]), cy: Number(at[4]) }
    : {
        x: Math.round(sheet.cx * DEFAULT_AREA.left),
        y: Math.round(sheet.cy * DEFAULT_AREA.top),
        cx: Math.round(sheet.cx * DEFAULT_AREA.width),
        cy: Math.round(sheet.cy * DEFAULT_AREA.height),
      }
  const tableLook = (table ? TABLE_LOOK.exec(table)?.[0] : undefined) ?? DEFAULT_TABLE_LOOK
  return { root, titleShape, tableLook, area, layout }
}

const without = (xml: string, tag: string, targets: readonly string[]): string =>
  targets.reduce(
    (text, target) =>
      text.replace(
        new RegExp(`<${tag}\\b[^>]*"[^"]*${target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*/>`),
        '',
      ),
    xml,
  )

/**
 * A deck on the model of the PM. The first slide of the model stays as the cover (its title, when
 * it has one to fill, becomes the title of the deck) and the last one as the closing, when it is
 * not a slide of content. Every slide in between is written new on the model's first slide with a
 * title and, if there is one, a table: same layout, same place and same look of the table. The
 * master, the layouts, the theme and the pictures are the model's.
 */
export function renderDeck(title: string, markdown: string, model: Uint8Array): Uint8Array {
  const zip = readZip(model, () => true)
  if (!zip.ok) throw invalid()
  const files: Parts = { ...zip.files }
  const presentationPart = files[PRESENTATION]
  const typesPart = files[CONTENT_TYPES]
  const relsPart = files[PRESENTATION_RELS]
  if (!presentationPart || !typesPart || !relsPart) throw invalid()
  const presentation = strFromU8(presentationPart)
  const slides = modelSlides(files, presentation)
  const cover = slides[0]
  const inner = slides.slice(1)
  const withTitle = inner.filter((slide) => TITLE_SHAPE.test(slide.xml))
  const source = withTitle.find((slide) => slide.xml.includes('<a:tbl>')) ?? withTitle[0]
  if (!cover || !source) throw invalid()
  const last = inner.at(-1)
  const closing = last && last !== source && !TITLE_HOLDER.test(last.xml) ? last : null
  const mould = mouldOf(files, source, presentation)
  const content = deckContent(title, markdown)

  // The slides of the model that held the content of another period go, with their notes.
  const removed: string[] = []
  for (const slide of inner) {
    if (slide === closing) continue
    const rels = relsOf(slide.part)
    const notes = [...relationships(files[rels]).values()]
      .filter((target) => target.includes('notesSlide'))
      .map((target) => resolveTarget(folderOf(slide.part), target))
    for (const part of [slide.part, ...notes]) {
      delete files[part]
      delete files[relsOf(part)]
      removed.push(part)
    }
  }
  if (TITLE_SHAPE.test(cover.xml)) {
    files[cover.part] = strToU8(
      cover.xml.replace(TITLE_SHAPE, (shape) => retitled(shape, content.title)),
    )
  }

  const numbers = slides.map((slide) => Number(SLIDE_NUMBER.exec(slide.part)?.[1] ?? 0))
  let number = Math.max(...numbers)
  let id = Math.max(...slides.map((slide) => slide.id))
  const added = content.slides.map((slide) => {
    number += 1
    id += 1
    const part = `ppt/slides/slide${number}.xml`
    files[part] = strToU8(slideXml(mould, slide))
    files[relsOf(part)] = strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${OFFICE}/slideLayout" Target="${mould.layout}"/></Relationships>`,
    )
    return { id, part, rel: `rIdOcto${number}` }
  })

  const kept = (slide: ModelSlide | null): string => {
    if (slide === null) return ''
    const rel = /<p:sldId\b[^>]*\/>/g
    return (
      (SLIDE_LIST.exec(presentation)?.[0].match(rel) ?? []).find(
        (entry) => Number(attr(entry, 'id')) === slide.id,
      ) ?? ''
    )
  }
  const list = `<p:sldIdLst>${kept(cover)}${added
    .map((slide) => `<p:sldId id="${slide.id}" r:id="${slide.rel}"/>`)
    .join('')}${kept(closing)}</p:sldIdLst>`
  files[PRESENTATION] = strToU8(presentation.replace(SLIDE_LIST, list).replace(SECTIONS, ''))
  const gone = removed.map((part) => part.slice('ppt/'.length))
  files[PRESENTATION_RELS] = strToU8(
    without(strFromU8(relsPart), 'Relationship', gone).replace(
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
      strFromU8(typesPart),
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
