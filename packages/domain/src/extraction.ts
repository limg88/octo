/** Where a piece of extracted text sits in the original document. */
export type Locator =
  | { kind: 'page'; page: number }
  | { kind: 'paragraph'; index: number }
  | { kind: 'slide'; slide: number }
  | { kind: 'cell'; sheet: string; ref: string }
  | { kind: 'line'; from: number; to: number }

export interface TextChunk {
  locator: Locator
  text: string
}

/** Things that can go wrong while extracting; they are recorded, never thrown. */
export type ExtractionWarning =
  | 'no_text'
  | 'encrypted'
  | 'truncated'
  | 'unsupported_format'
  | 'timeout'
  | 'extraction_failed'

export interface Extraction {
  /** Name and version of the extractor: chunks of different versions are never mixed. */
  extractor: string
  chunks: TextChunk[]
  truncated: boolean
  /** Date found in the document metadata, if any (never taken from the free text). */
  metadataDate: Date | null
  /**
   * The creation date the document metadata gives (an Office file's `dcterms:created`), when the
   * format has one: the day a transcript was saved, read before the date the file was changed.
   */
  createdDate?: Date | null
  warnings: ExtractionWarning[]
}

/** Stable string identifying a place in a document, e.g. `page:3` or `cell:Budget!B7`. */
export function locatorKey(locator: Locator): string {
  switch (locator.kind) {
    case 'page':
      return `page:${locator.page}`
    case 'paragraph':
      return `paragraph:${locator.index}`
    case 'slide':
      return `slide:${locator.slide}`
    case 'cell':
      return `cell:${locator.sheet}!${locator.ref}`
    case 'line':
      return `line:${locator.from}-${locator.to}`
  }
}
