import type { SheetWrite, SpreadsheetModel } from '@octo/application'
import { DomainError, type ForecastCell, type SheetGrid, type SheetRow } from '@octo/domain'
import { strFromU8, strToU8, zipSync } from 'fflate'
import { relationships, resolveTarget } from '../extract/package-parts.ts'
import { cellValue, columnIndex, normalizeRef, sharedStrings } from '../extract/xlsx.ts'
import { attr, decodeXml, elements, tags } from '../extract/xml.ts'
import { readZip } from '../extract/zip.ts'

const WORKBOOK_PART = 'xl/workbook.xml'
const WORKBOOK_RELS = 'xl/_rels/workbook.xml.rels'
const STRINGS_PART = 'xl/sharedStrings.xml'
const STYLES_PART = 'xl/styles.xml'
const CONTENT_TYPES = '[Content_Types].xml'
/** The order Excel last computed the formulas in: wrong once formulas change, and optional. */
const CALC_CHAIN = 'calcChain.xml'
const ROW = /<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g
const CELL = /<c\b([^>]*?)(?:\/>|>[\s\S]*?<\/c>)/g
const CALC_SETTINGS = /<calcPr\b[^>]*\/>/
/** What comes before the calculation settings in a workbook, last first. */
const BEFORE_CALC_SETTINGS = ['</definedNames>', '</externalReferences>', '</sheets>']
const RECALCULATE = '<calcPr fullCalcOnLoad="1"/>'

const invalid = (): DomainError => new DomainError('forecast_model_invalid')

/** Text as it may stand inside an XML element; characters XML forbids are dropped. */
const escaped = (text: string): string =>
  text
    // biome-ignore lint/suspicious/noControlCharactersInRegex: these are the characters XML 1.0 forbids.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

/** A number as a sheet keeps it, without the noise binary arithmetic leaves at the end. */
const numberText = (value: number): string => String(Number(value.toFixed(10)))

function parts(bytes: Uint8Array): Record<string, Uint8Array> {
  const zip = readZip(bytes, () => true)
  if (!zip.ok) throw invalid()
  return zip.files
}

/** The part that holds the first sheet of the workbook. */
function firstSheet(files: Record<string, Uint8Array>): string {
  const workbook = files[WORKBOOK_PART]
  const first = workbook ? tags(decodeXml(workbook), 'sheet')[0] : undefined
  const target = first ? relationships(files[WORKBOOK_RELS]).get(attr(first, 'r:id') ?? '') : null
  const part = target ? resolveTarget('xl', target) : null
  if (!part || !files[part]) throw invalid()
  return part
}

function read(bytes: Uint8Array): SheetGrid {
  const files = parts(bytes)
  const sheet = files[firstSheet(files)] as Uint8Array
  const strings = sharedStrings(files[STRINGS_PART])
  const rows: SheetRow[] = []
  let number = 0
  for (const row of elements(decodeXml(sheet), 'row')) {
    number = Number(attr(row.attrs, 'r')) || number + 1
    const cells = elements(row.body, 'c').flatMap((cell) => {
      const ref = normalizeRef(attr(cell.attrs, 'r'))
      const text = cellValue(cell, strings)
      return ref !== undefined && text !== '' ? [{ ref, text }] : []
    })
    if (cells.length > 0) rows.push({ number, cells })
  }
  return { rows }
}

/** The cell as the sheet stores it, with the look (`s`) the model gave that place. */
function cellXml(ref: string, style: string | undefined, cell: ForecastCell): string {
  const open = `<c r="${ref}"${style === undefined ? '' : ` s="${style}"`}`
  switch (cell.kind) {
    case 'formula':
      // A formula that gives no number gives an empty text: the value says which.
      return cell.value === null
        ? `${open} t="str"><f>${escaped(cell.formula)}</f><v></v></c>`
        : `${open}><f>${escaped(cell.formula)}</f><v>${numberText(cell.value)}</v></c>`
    case 'number':
      return `${open}><v>${numberText(cell.value)}</v></c>`
    case 'text':
      return `${open} t="inlineStr"><is><t xml:space="preserve">${escaped(cell.value)}</t></is></c>`
    case 'empty':
      return `${open}/>`
  }
}

const CELL_LOOKS = /(<cellXfs\b)([^>]*)(>)([\s\S]*?)(<\/cellXfs>)/
const LOOK = /<xf\b[^>]*?(?:\/>|>[\s\S]*?<\/xf>)/g
/** The built-in number format `0.00%`. */
const PERCENT_FORMAT = 10

/** The same look shown as a percentage: font, fill and borders stay the model's. */
const asPercent = (look: string): string =>
  look.replace(/^<xf\b([^>]*?)(\/?)>/, (_whole, attrs: string, close: string) => {
    const kept = attrs.replace(/\s(?:numFmtId|applyNumberFormat)="[^"]*"/g, '')
    return `<xf${kept} numFmtId="${PERCENT_FORMAT}" applyNumberFormat="1"${close}>`
  })

/**
 * Looks added to the styles of the workbook while cells are written: the percentage twin of a
 * look the model already has, made once.
 */
class Looks {
  private readonly styles: string | undefined
  private readonly known: string[]
  private readonly added: string[] = []
  private readonly twins = new Map<number, number>()

  constructor(styles: string | undefined) {
    this.styles = styles
    this.known = [...(CELL_LOOKS.exec(styles ?? '')?.[4] ?? '').matchAll(LOOK)].map((m) => m[0])
  }

  /** The look of a cell: its own, or the percentage twin when the cell asks for one. */
  of(base: string | undefined, cell: ForecastCell): string | undefined {
    if ((cell.kind !== 'formula' && cell.kind !== 'number') || !cell.percent) return base
    const index = Number(base ?? 0)
    const look = this.known[index]
    if (look === undefined) return base
    const twin = this.twins.get(index) ?? this.known.length + this.added.push(asPercent(look)) - 1
    this.twins.set(index, twin)
    return String(twin)
  }

  /** The styles with the looks added; unchanged when none was. */
  written(): string | undefined {
    if (this.styles === undefined || this.added.length === 0) return this.styles
    const total = this.known.length + this.added.length
    return this.styles.replace(
      CELL_LOOKS,
      (_whole, open: string, attrs: string, end: string, body: string, close: string) =>
        `${open}${attrs.replace(/\scount="[^"]*"/, '')} count="${total}"${end}${body}${this.added.join('')}${close}`,
    )
  }
}

/** A row with some cells rewritten; a cell the row lacks is added where its column falls. */
function filledRow(body: string, writes: readonly SheetWrite[], looks: Looks): string {
  const pending = new Map(writes.map((write) => [write.ref, write.cell]))
  const pieces: Array<{ column: number; xml: string }> = []
  let from = 0
  for (const match of body.matchAll(CELL)) {
    const ref = normalizeRef(attr(match[1] ?? '', 'r'))
    const cell = ref === undefined ? undefined : pending.get(ref)
    const xml =
      ref !== undefined && cell !== undefined
        ? cellXml(ref, looks.of(attr(match[1] ?? '', 's'), cell), cell)
        : match[0]
    if (ref !== undefined) pending.delete(ref)
    pieces.push({
      column: ref === undefined ? -1 : columnIndex(ref),
      xml: body.slice(from, match.index) + xml,
    })
    from = match.index + match[0].length
  }
  for (const [ref, cell] of pending) {
    const column = columnIndex(ref)
    const next = pieces.findIndex((piece) => piece.column > column)
    const piece = { column, xml: cellXml(ref, looks.of(undefined, cell), cell) }
    if (next < 0) pieces.push(piece)
    else pieces.splice(next, 0, piece)
  }
  return pieces.map((piece) => piece.xml).join('') + body.slice(from)
}

function filledSheet(xml: string, writes: readonly SheetWrite[], looks: Looks): string {
  const byRow = new Map<number, SheetWrite[]>()
  for (const write of writes) {
    const number = Number(/[0-9]+$/.exec(write.ref)?.[0])
    byRow.set(number, [...(byRow.get(number) ?? []), write])
  }
  let number = 0
  const filled = xml.replace(ROW, (whole, attrs: string, body: string | undefined) => {
    number = Number(attr(attrs, 'r')) || number + 1
    const ofRow = byRow.get(number)
    if (ofRow === undefined || body === undefined) return whole
    byRow.delete(number)
    return `<row${attrs}>${filledRow(body, ofRow, looks)}</row>`
  })
  // Every write names a row the reading found: one that is not there means another file.
  if (byRow.size > 0) throw invalid()
  return filled
}

/** Excel computes every formula again when it opens the file. */
function recalculated(workbook: string): string {
  if (CALC_SETTINGS.test(workbook)) return workbook.replace(CALC_SETTINGS, RECALCULATE)
  const after = BEFORE_CALC_SETTINGS.find((tag) => workbook.includes(tag))
  return after === undefined ? workbook : workbook.replace(after, `${after}${RECALCULATE}`)
}

const withoutCalcChain = (xml: string, tag: string): string =>
  xml.replace(new RegExp(`<${tag}\\b[^>]*${CALC_CHAIN.replace('.', '\\.')}[^>]*/>`, 'g'), '')

function fill(bytes: Uint8Array, writes: readonly SheetWrite[]): Uint8Array {
  const files = { ...parts(bytes) }
  const sheet = firstSheet(files)
  const rewrite = (part: string, change: (xml: string) => string): void => {
    const content = files[part]
    if (content) files[part] = strToU8(change(strFromU8(content)))
  }
  const styles = files[STYLES_PART]
  const looks = new Looks(styles ? strFromU8(styles) : undefined)
  rewrite(sheet, (xml) => filledSheet(xml, writes, looks))
  rewrite(STYLES_PART, (xml) => looks.written() ?? xml)
  rewrite(WORKBOOK_PART, recalculated)
  rewrite(WORKBOOK_RELS, (xml) => withoutCalcChain(xml, 'Relationship'))
  rewrite(CONTENT_TYPES, (xml) => withoutCalcChain(xml, 'Override'))
  delete files[`xl/${CALC_CHAIN}`]
  return zipSync(files)
}

/**
 * Reads and fills a spreadsheet at the level of its parts: the cells named are rewritten and
 * everything else (widths, colours, the other sheets) stays byte for byte the model's.
 */
export function createXlsxModel(): SpreadsheetModel {
  return { read, fill }
}
