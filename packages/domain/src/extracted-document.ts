import type { Extraction, Locator, TextChunk } from './extraction.ts'

/** Where the text of the Office and PDF files of a project is kept, inside the project folder. */
/**
 * Octo's own folder inside a project: everything Octo writes lives under it, so nothing of the
 * PM's is ever touched and a versioned project can leave the whole folder out.
 */
export const OCTO_FOLDER = '_octo'
export const EXTRACTED_TEXT_FOLDER = `${OCTO_FOLDER}/testo`
const TEXT_SUFFIX = '.md'

/** A file of the project as it is now: enough to tell whether its text is still current. */
export type SourceFileStamp = {
  /** Path inside the project folder, with `/` on every system. */
  path: string
  size: number
  modifiedAt: string
}

export const extractedTextPath = (sourcePath: string): string =>
  `${EXTRACTED_TEXT_FOLDER}/${sourcePath}${TEXT_SUFFIX}`

/** The file a text was extracted from, or null when the path is not one of the extracted texts. */
export function sourcePathOf(textPath: string): string | null {
  const prefix = `${EXTRACTED_TEXT_FOLDER}/`
  if (!textPath.startsWith(prefix) || !textPath.endsWith(TEXT_SUFFIX)) return null
  return textPath.slice(prefix.length, -TEXT_SUFFIX.length)
}

const quoted = (value: string): string => JSON.stringify(value)

function stampLines(stamp: SourceFileStamp, extractor: string): string[] {
  return [
    `origine: ${quoted(stamp.path)}`,
    `origine-modificata: ${quoted(stamp.modifiedAt)}`,
    `origine-dimensione: ${stamp.size}`,
    `estrattore: ${quoted(extractor)}`,
  ]
}

/** Whether a text already written was made from this very file by this extractor. */
export function isCurrentText(text: string, stamp: SourceFileStamp, extractor: string): boolean {
  return text.includes(`${stampLines(stamp, extractor).join('\n')}\n`)
}

function headingOf(locator: Locator): string | null {
  switch (locator.kind) {
    case 'page':
      return `Pagina ${locator.page}`
    case 'slide':
      return `Slide ${locator.slide}`
    case 'cell':
      return `Foglio ${locator.sheet}`
    default:
      return null
  }
}

function body(chunks: readonly TextChunk[]): string[] {
  const lines: string[] = []
  let current: string | null = null
  for (const chunk of chunks) {
    const heading = headingOf(chunk.locator)
    if (heading !== null && heading !== current) {
      lines.push(`## ${heading}`, '')
      current = heading
    }
    lines.push(chunk.text, '')
  }
  return lines
}

/**
 * The text of an Office or PDF file as a Markdown file the agent can search and quote: a header
 * that names the original and when it was read, then the text under its pages, slides or sheets.
 */
export function extractedDocument(stamp: SourceFileStamp, extraction: Extraction): string {
  const name = stamp.path.split('/').at(-1) ?? stamp.path
  return [
    '---',
    'tipo: "testo-estratto"',
    ...stampLines(stamp, extraction.extractor),
    `avvisi: ${quoted(extraction.warnings.join(', '))}`,
    '---',
    '',
    `# ${name}`,
    '',
    `Testo estratto da \`${stamp.path}\`: per il contenuto vale questo file, l'originale non è leggibile come testo.`,
    '',
    ...body(extraction.chunks),
  ].join('\n')
}
