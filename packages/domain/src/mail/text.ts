const HIDDEN = /<(head|style|script|title)\b[^>]*>[\s\S]*?<\/\1\s*>/gi
const COMMENT = /<!--[\s\S]*?-->/g
const LINE_BREAK = /<br\b[^>]*>/gi
const BLOCK_END = /<\/(p|div|tr|h[1-6]|table|blockquote|ul|ol)\s*>/gi
const LIST_ITEM = /<li\b[^>]*>/gi
const CELL_END = /<\/(td|th)\s*>/gi
const TAG = /<[^>]+>/g
const ENTITY = /&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi
const HEX_PREFIX_LENGTH = 2

const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  agrave: 'à',
  egrave: 'è',
  eacute: 'é',
  igrave: 'ì',
  ograve: 'ò',
  ugrave: 'ù',
  Agrave: 'À',
  Egrave: 'È',
  Eacute: 'É',
  euro: '€',
  laquo: '«',
  raquo: '»',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  bull: '•',
  deg: '°',
  copy: '©',
  reg: '®',
}

function decodeEntity(whole: string, name: string): string {
  if (name.startsWith('#')) {
    const hex = name[1]?.toLowerCase() === 'x'
    const code = Number.parseInt(name.slice(hex ? HEX_PREFIX_LENGTH : 1), hex ? 16 : 10)
    return Number.isInteger(code) && code > 0 && code <= 0x10ffff
      ? String.fromCodePoint(code)
      : whole
  }
  return NAMED_ENTITIES[name] ?? NAMED_ENTITIES[name.toLowerCase()] ?? whole
}

/** Blank lines squeezed to one, spaces to one, nothing left at the ends of a line. */
export function tidyText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t ]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** The text a reader of an HTML mail sees: no markup, no styles, one line per block. */
export function htmlToText(html: string): string {
  const text = html
    .replace(HIDDEN, '')
    .replace(COMMENT, '')
    .replace(/\s+/g, ' ')
    .replace(LINE_BREAK, '\n')
    .replace(LIST_ITEM, '\n- ')
    .replace(CELL_END, ' ')
    .replace(BLOCK_END, '\n')
    .replace(TAG, '')
    .replace(ENTITY, decodeEntity)
  return tidyText(text)
}
