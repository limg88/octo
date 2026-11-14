import type { DocumentRenderer } from '@octo/application'
import { DomainError } from '@octo/domain'
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import { lexer, type Token, type Tokens } from 'marked'
import { renderDeck } from './deck-renderer.ts'

type Style = { bold?: boolean; italics?: boolean; size?: number }

const DOCUMENT_PART = 'word/document.xml'
/** Sizes in half-points, as Word counts them. */
const HEADING_SIZES = [32, 28, 24, 22] as const
const DEFAULT_FONT = 'Calibri'
const DEFAULT_SIZE = 22
const INDENT_PER_LEVEL = 360
const SPACE_AFTER = 120
const SPACE_BEFORE_HEADING = 240
const BORDER =
  '<w:top w:val="single" w:sz="4" w:color="999999"/><w:left w:val="single" w:sz="4" w:color="999999"/><w:bottom w:val="single" w:sz="4" w:color="999999"/><w:right w:val="single" w:sz="4" w:color="999999"/><w:insideH w:val="single" w:sz="4" w:color="999999"/><w:insideV w:val="single" w:sz="4" w:color="999999"/>'
const BULLET = '•'

const ENTITIES: Readonly<Record<string, string>> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
}

/** The lexer escapes what would be markup in HTML: a Word document wants the characters. */
const unescaped = (text: string): string =>
  text.replace(/&(?:amp|lt|gt|quot|#39);/g, (entity) => ENTITIES[entity] ?? entity)

/** Text as it may stand inside an XML element; characters XML forbids are dropped. */
const xml = (text: string): string =>
  text
    // biome-ignore lint/suspicious/noControlCharactersInRegex: these are the characters XML 1.0 forbids.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

function run(text: string, style: Style): string {
  const properties = [
    style.bold ? '<w:b/>' : '',
    style.italics ? '<w:i/>' : '',
    style.size ? `<w:sz w:val="${style.size}"/><w:szCs w:val="${style.size}"/>` : '',
  ].join('')
  return `<w:r>${properties ? `<w:rPr>${properties}</w:rPr>` : ''}<w:t xml:space="preserve">${xml(text)}</w:t></w:r>`
}

/** The runs of a line of text: bold and italics kept, the rest of the markup read as text. */
function runs(tokens: readonly Token[] | undefined, style: Style = {}): string {
  return (tokens ?? [])
    .map((token): string => {
      switch (token.type) {
        case 'strong':
          return runs((token as Tokens.Strong).tokens, { ...style, bold: true })
        case 'em':
          return runs((token as Tokens.Em).tokens, { ...style, italics: true })
        case 'br':
          return '<w:r><w:br/></w:r>'
        case 'link':
        case 'del':
          return runs((token as Tokens.Link).tokens, style)
        default: {
          const nested = (token as Tokens.Text).tokens
          if (nested && nested.length > 0) return runs(nested, style)
          return run(unescaped((token as Tokens.Text).text ?? token.raw), style)
        }
      }
    })
    .join('')
}

type ParagraphOptions = { before?: number; after?: number; indent?: number; hanging?: number }

function paragraph(content: string, options: ParagraphOptions = {}): string {
  const spacing = `<w:spacing w:before="${options.before ?? 0}" w:after="${options.after ?? SPACE_AFTER}"/>`
  const indent = options.indent
    ? `<w:ind w:left="${options.indent}" w:hanging="${options.hanging ?? 0}"/>`
    : ''
  return `<w:p><w:pPr>${spacing}${indent}</w:pPr>${content}</w:p>`
}

/**
 * A list as paragraphs with their own marker and indent: no numbering part is needed, so the
 * same body stands in any document it is put in.
 */
function listItems(list: Tokens.List, level: number): string {
  const start = typeof list.start === 'number' ? list.start : 1
  return list.items
    .map((item, at) => {
      const own = item.tokens.filter((token) => token.type !== 'list')
      const nested = item.tokens.filter((token): token is Tokens.List => token.type === 'list')
      const marker = list.ordered ? `${start + at}.` : BULLET
      const indent = INDENT_PER_LEVEL * (level + 1)
      const line = paragraph(`${run(`${marker}\t`, {})}${runs(own)}`, {
        after: 60,
        indent,
        hanging: INDENT_PER_LEVEL,
      })
      return line + nested.map((inner) => listItems(inner, level + 1)).join('')
    })
    .join('')
}

function tableOf(table: Tokens.Table): string {
  const row = (cells: readonly Tokens.TableCell[], header: boolean): string =>
    `<w:tr>${cells
      .map(
        (cell) =>
          `<w:tc><w:tcPr><w:tcW w:w="0" w:type="auto"/></w:tcPr>${paragraph(
            runs(cell.tokens, header ? { bold: true } : {}),
            { after: 40 },
          )}</w:tc>`,
      )
      .join('')}</w:tr>`
  const rows = [row(table.header, true), ...table.rows.map((cells) => row(cells, false))]
  // A paragraph after the table: Word joins two tables that touch.
  return `<w:tbl><w:tblPr><w:tblW w:w="5000" w:type="pct"/><w:tblBorders>${BORDER}</w:tblBorders></w:tblPr>${rows.join('')}</w:tbl>${paragraph('')}`
}

function blocks(tokens: readonly Token[]): string {
  return tokens
    .map((token): string => {
      switch (token.type) {
        case 'heading': {
          const heading = token as Tokens.Heading
          const size = HEADING_SIZES[Math.min(heading.depth, HEADING_SIZES.length) - 1]
          const style: Style = { bold: true, ...(size ? { size } : {}) }
          return paragraph(runs(heading.tokens, style), { before: SPACE_BEFORE_HEADING })
        }
        case 'paragraph':
          return paragraph(runs((token as Tokens.Paragraph).tokens))
        case 'list':
          return listItems(token as Tokens.List, 0)
        case 'table':
          return tableOf(token as Tokens.Table)
        case 'blockquote':
          return blocks((token as Tokens.Blockquote).tokens)
        case 'code':
          return paragraph(run((token as Tokens.Code).text, {}))
        case 'space':
        case 'hr':
          return ''
        default:
          return token.raw.trim() ? paragraph(run(token.raw.trim(), {})) : ''
      }
    })
    .join('')
}

const NAMESPACE = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'
const PLAIN_PARTS: Readonly<Record<string, string>> = {
  '[Content_Types].xml':
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>',
  '_rels/.rels':
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
  'word/_rels/document.xml.rels':
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>',
  'word/styles.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles ${NAMESPACE}><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="${DEFAULT_FONT}" w:hAnsi="${DEFAULT_FONT}" w:cs="${DEFAULT_FONT}"/><w:sz w:val="${DEFAULT_SIZE}"/><w:szCs w:val="${DEFAULT_SIZE}"/></w:rPr></w:rPrDefault></w:docDefaults></w:styles>`,
}

/** A plain document around a body: what Word needs to open it, and nothing else. */
function plainPackage(body: string): Uint8Array {
  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document ${NAMESPACE}><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1417" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`
  const parts: Record<string, Uint8Array> = { [DOCUMENT_PART]: strToU8(document) }
  for (const [name, content] of Object.entries(PLAIN_PARTS)) parts[name] = strToU8(content)
  return zipSync(parts)
}

const BODY = /(<w:body\b[^>]*>)([\s\S]*)(<\/w:body>)/
/** The last section of a document: page size, margins and which header and footer it shows. */
const LAST_SECTION =
  /<w:sectPr\b(?:(?!<w:sectPr\b)[\s\S])*?<\/w:sectPr>\s*$|<w:sectPr\b[^>]*\/>\s*$/

function templateParts(template: Uint8Array): Record<string, Uint8Array> {
  try {
    return unzipSync(template)
  } catch {
    throw new DomainError('letterhead_invalid')
  }
}

/**
 * The body put in the PM's letterhead: only the text of the document part changes, and its last
 * section stays, so header, footer, margins, fonts and every other part are the letterhead's.
 */
function inTemplate(template: Uint8Array, body: string): Uint8Array {
  const parts = templateParts(template)
  const document = parts[DOCUMENT_PART]
  const match = document ? BODY.exec(strFromU8(document)) : null
  if (!document || !match) throw new DomainError('letterhead_invalid')
  const [whole, open, inner, close] = match
  const section = LAST_SECTION.exec(inner ?? '')?.[0] ?? ''
  const text = strFromU8(document).replace(whole, `${open}${body}${section}${close}`)
  return zipSync({ ...parts, [DOCUMENT_PART]: strToU8(text) })
}

/**
 * A Word document from the Markdown of an approved deliverable: headings, paragraphs, lists and
 * tables, written by the code with their own formatting. The same text always gives the same
 * document, plain or on the letterhead the PM chose.
 */
export function createWordRenderer(): DocumentRenderer {
  return {
    async word(_title, markdown, letterhead) {
      const body = blocks(lexer(markdown))
      return letterhead ? inTemplate(letterhead, body) : plainPackage(body)
    },
    async checkLetterhead(bytes) {
      inTemplate(bytes, '')
    },
    deck: async (title, markdown, model) => renderDeck(title, markdown, model),
    async checkDeckModel(bytes) {
      renderDeck('', '', bytes)
    },
  }
}
