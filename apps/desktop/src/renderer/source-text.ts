/** The sources read inside Octo: texts. A document of another kind is handed to the system. */
const READABLE = /\.(md|markdown|txt)$/i
export const readableHere = (path: string): boolean => READABLE.test(path)

const FRONT_MATTER = /^---\n[\s\S]*?\n---\n?/
const FENCE = /^(```|~~~)/gm
/** How much of a quote is looked for when the whole of it spans more than one block. */
const QUOTE_START = 40

/** A piece of a text file as it is shown: its header as it is written, the rest as markdown. */
export type SourceBlock = { text: string; kind: 'header' | 'text' }

/**
 * A text cut where a reader would: its header first, then a block for each paragraph, list or
 * table. A fenced block with empty lines inside stays whole.
 */
export function sourceBlocks(text: string): SourceBlock[] {
  const unix = text.replaceAll('\r\n', '\n')
  const header = FRONT_MATTER.exec(unix)?.[0] ?? ''
  const blocks: SourceBlock[] = header === '' ? [] : [{ text: header.trim(), kind: 'header' }]
  let open = ''
  for (const part of unix.slice(header.length).split(/\n{2,}/)) {
    const joined = open === '' ? part : `${open}\n\n${part}`
    const fences = joined.match(FENCE)?.length ?? 0
    if (fences % 2 === 1) {
      open = joined
      continue
    }
    open = ''
    if (joined.trim() !== '') blocks.push({ text: joined, kind: 'text' })
  }
  if (open.trim() !== '') blocks.push({ text: open, kind: 'text' })
  return blocks
}

/** Letters and digits only, so that marks of markdown and line breaks do not hide a sentence. */
const plain = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()

/** The block a quoted sentence is in, or where it starts; -1 when the text does not hold it. */
export function quotedBlock(blocks: readonly SourceBlock[], quote: string): number {
  const sought = plain(quote)
  if (sought === '') return -1
  const whole = blocks.findIndex((block) => plain(block.text).includes(sought))
  if (whole >= 0 || sought.length <= QUOTE_START) return whole
  const start = sought.slice(0, QUOTE_START)
  return blocks.findIndex((block) => plain(block.text).includes(start))
}
