import type { DocumentRenderer } from '@octo/application'
import {
  AlignmentType,
  Document,
  HeadingLevel,
  LevelFormat,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx'
import { lexer, type Token, type Tokens } from 'marked'

type Style = { bold?: boolean; italics?: boolean }
type Block = Paragraph | Table

const NUMBERING = 'octo-numbers'
const FONT = 'Calibri'
const BODY_SIZE = 22
const HEADINGS = [
  HeadingLevel.HEADING_1,
  HeadingLevel.HEADING_2,
  HeadingLevel.HEADING_3,
  HeadingLevel.HEADING_4,
] as const
const FULL_WIDTH = { size: 100, type: WidthType.PERCENTAGE } as const
const AFTER_PARAGRAPH = { after: 120 } as const

/** The runs of a line of text: bold and italics kept, the rest of the markup read as text. */
function runs(tokens: readonly Token[] | undefined, style: Style = {}): TextRun[] {
  return (tokens ?? []).flatMap((token): TextRun[] => {
    switch (token.type) {
      case 'strong':
        return runs((token as Tokens.Strong).tokens, { ...style, bold: true })
      case 'em':
        return runs((token as Tokens.Em).tokens, { ...style, italics: true })
      case 'br':
        return [new TextRun({ break: 1 })]
      case 'link':
      case 'del':
        return runs((token as Tokens.Link).tokens, style)
      default: {
        const nested = (token as Tokens.Text).tokens
        if (nested && nested.length > 0) return runs(nested, style)
        return [
          new TextRun({ text: unescaped((token as Tokens.Text).text ?? token.raw), ...style }),
        ]
      }
    }
  })
}

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

function listItems(list: Tokens.List, level: number): Paragraph[] {
  return list.items.flatMap((item) => {
    const own = item.tokens.filter((token) => token.type !== 'list')
    const nested = item.tokens.filter((token): token is Tokens.List => token.type === 'list')
    const marker = list.ordered
      ? { numbering: { reference: NUMBERING, level } }
      : { bullet: { level } }
    return [
      new Paragraph({ children: runs(own), ...marker }),
      ...nested.flatMap((inner) => listItems(inner, level + 1)),
    ]
  })
}

function tableOf(table: Tokens.Table): Table {
  const row = (cells: readonly Tokens.TableCell[], header: boolean): TableRow =>
    new TableRow({
      tableHeader: header,
      children: cells.map(
        (cell) =>
          new TableCell({
            children: [
              new Paragraph({ children: runs(cell.tokens, header ? { bold: true } : {}) }),
            ],
          }),
      ),
    })
  return new Table({
    width: FULL_WIDTH,
    rows: [row(table.header, true), ...table.rows.map((cells) => row(cells, false))],
  })
}

function blocks(tokens: readonly Token[]): Block[] {
  return tokens.flatMap((token): Block[] => {
    switch (token.type) {
      case 'heading': {
        const heading = token as Tokens.Heading
        const level = HEADINGS[Math.min(heading.depth, HEADINGS.length) - 1] ?? HEADINGS[0]
        return [new Paragraph({ heading: level, children: runs(heading.tokens) })]
      }
      case 'paragraph':
        return [
          new Paragraph({
            children: runs((token as Tokens.Paragraph).tokens),
            spacing: AFTER_PARAGRAPH,
          }),
        ]
      case 'list':
        return listItems(token as Tokens.List, 0)
      case 'table':
        return [tableOf(token as Tokens.Table)]
      case 'blockquote':
        return blocks((token as Tokens.Blockquote).tokens)
      case 'code':
        return [new Paragraph({ children: [new TextRun({ text: (token as Tokens.Code).text })] })]
      case 'space':
      case 'hr':
        return []
      default:
        return token.raw.trim()
          ? [new Paragraph({ children: [new TextRun(token.raw.trim())] })]
          : []
    }
  })
}

const numberLevel = (level: number) => ({
  level,
  format: LevelFormat.DECIMAL,
  text: `%${level + 1}.`,
  alignment: AlignmentType.START,
  style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } },
})

/**
 * A plain Word document from the Markdown of an approved deliverable: headings, paragraphs,
 * lists and tables. Made by the code, so the same text always gives the same document.
 */
export function createWordRenderer(): DocumentRenderer {
  return {
    async word(title, markdown) {
      const document = new Document({
        title,
        creator: 'Octo',
        styles: { default: { document: { run: { font: FONT, size: BODY_SIZE } } } },
        numbering: {
          config: [{ reference: NUMBERING, levels: [0, 1, 2].map(numberLevel) }],
        },
        sections: [{ children: blocks(lexer(markdown)) }],
      })
      return new Uint8Array(await Packer.toBuffer(document))
    },
  }
}
