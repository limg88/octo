import type { Extraction, Locator, TextChunk } from './extraction.ts'

/** Where the text of the Office and PDF files of a project is kept, inside the project folder. */
/**
 * Octo's own folder inside a project: everything Octo writes lives under it, so nothing of the
 * PM's is ever touched and a versioned project can leave the whole folder out.
 */
export const OCTO_FOLDER = '_octo'
/**
 * What Octo keeps for its own computations and must never reach an answer or a deliverable:
 * costs of people, above all. Nothing in here is searched or may be cited.
 */
export const PRIVATE_FOLDER = `${OCTO_FOLDER}/.riservato`
/** Octo's settings of a project: not a source either. */
export const SETTINGS_FOLDER = `${OCTO_FOLDER}/.impostazioni`
/**
 * What the folder knows of its own readings: who read each source last, from where the next
 * reading goes on, what each system left in the project. Shared by every computer that opens the
 * folder, and not a source.
 */
export const STATE_FOLDER = `${OCTO_FOLDER}/.stato`
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

const SECOND_MS = 1000

/**
 * Whether two dates of a file are the same date: equal, or one of them is the other as a folder
 * kept in step between computers gives it to a copy, to the whole second and without the
 * fraction the first disk kept. Two dates that both keep their fraction are two writings.
 */
function sameModified(written: number, now: number): boolean {
  if (written === now) return true
  const toTheSecond = written % SECOND_MS === 0 || now % SECOND_MS === 0
  return toTheSecond && Math.abs(written - now) < SECOND_MS
}

const MODIFIED_LINE = /^origine-modificata: (".*")$/m

/** The date a text says its original had; null when the text does not say one. */
function modifiedIn(text: string): number | null {
  const line = MODIFIED_LINE.exec(text)?.[1]
  if (line === undefined) return null
  try {
    const at = Date.parse(String(JSON.parse(line)))
    return Number.isNaN(at) ? null : at
  } catch {
    return null
  }
}

/**
 * Whether a text already written was made from this very file by this extractor: the same path,
 * the same size, the same extractor, and a date that is the same but for what a copy loses.
 */
export function isCurrentText(text: string, stamp: SourceFileStamp, extractor: string): boolean {
  const [path, , size, by] = stampLines(stamp, extractor)
  const written = modifiedIn(text)
  if (written === null) return false
  const sameFile = [path, size, by].every((line) => text.includes(`${line}\n`))
  return sameFile && sameModified(written, Date.parse(stamp.modifiedAt))
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
