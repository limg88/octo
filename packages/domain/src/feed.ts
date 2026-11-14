// Types of what a connector hands over: documents, tracker records and rows of system views.
// Ported from octobrief-new (domain/source.ts, classification.ts, document.ts).

/** A document a source delivers is never larger than this. */
export const MAX_DOCUMENT_BYTES = 50 * 1024 * 1024
export const FILE_NAME_MAX_LENGTH = 255

export const AUDIENCES = ['internal', 'client'] as const
export type Audience = (typeof AUDIENCES)[number]

export const DOCUMENT_KINDS = [
  'status_report',
  'meeting_minutes',
  'transcript',
  'contract',
  'contract_deliverables',
  'purchase_order',
  'invoice',
  'timesheet',
  'backlog_export',
  'economics_export',
  'presentation',
  'email',
  'generic',
] as const
export type DocumentKind = (typeof DOCUMENT_KINDS)[number]

/** Fed by a feeder on the PM's computer, which presents the token of the source. */
export const PUSH_SOURCE_KINDS = ['m365', 'dwsi', 'files'] as const
/** Read by the worker with a sealed credential. */
export const PULL_SOURCE_KINDS = ['jira', 'ado'] as const
export const SOURCE_KINDS = [...PUSH_SOURCE_KINDS, ...PULL_SOURCE_KINDS] as const
export type PushSourceKind = (typeof PUSH_SOURCE_KINDS)[number]
export type PullSourceKind = (typeof PULL_SOURCE_KINDS)[number]
export type SourceKind = (typeof SOURCE_KINDS)[number]

/** Most things one delivery of a feeder or one batch of a connector carries. */
export const MAX_ITEMS_PER_DELIVERY = 100
export const MAX_ROWS_PER_DELIVERY = 20_000
export const MAX_ITEM_BYTES = MAX_DOCUMENT_BYTES

/** A person an item names: hidden from every model. */
export interface ItemPerson {
  readonly displayName: string
  readonly email?: string | undefined
  /** A name chosen outside the organization (an external sender, a guest). */
  readonly untrusted?: boolean | undefined
}

/** An item of a source that becomes a document of the project. */
export interface ExternalDocument {
  readonly externalId: string
  /** The version in the source system: an item is stored again only when it changes. */
  readonly version: string
  readonly title: string
  readonly mediaType: string
  readonly bytes: Uint8Array
  /** When the source system says the item was made or changed. */
  readonly originAt: Date | null
  readonly url: string | null
  /** When the file the item was read from last changed, for a file that has no other date. */
  readonly fileModifiedAt?: Date | undefined
  /** The kind the source declares for a document made from the system's data. */
  readonly systemKind?: string | undefined
  readonly people: readonly ItemPerson[]
}

/** A structured item of a tracker: kept as data, not as a document. */
export interface ExternalRecord {
  readonly externalId: string
  readonly version: string
  readonly title: string
  readonly record: Readonly<Record<string, unknown>>
  readonly originAt: Date | null
  readonly url: string | null
  readonly people: readonly ItemPerson[]
}

/** Rows of one view of a system of record for one perimeter. */
export interface ExternalRows {
  readonly view: string
  readonly perimeter: string
  readonly rows: ReadonlyArray<{ key: string; values: Readonly<Record<string, unknown>> }>
  readonly extractedAt: Date
  readonly sourceSyncedAt: Date | null
}

/** What one delivery brings. */
export interface Delivery {
  readonly documents: readonly ExternalDocument[]
  readonly records: readonly ExternalRecord[]
  readonly rows: readonly ExternalRows[]
  /** External ids of items the source says are gone. */
  readonly removed: readonly string[]
  readonly dataAsOf: Date | null
}

const EXTENSIONS: Readonly<Record<string, string>> = {
  'text/plain': '.txt',
  'text/markdown': '.md',
  'text/csv': '.csv',
  'text/vtt': '.vtt',
  'application/json': '.json',
  'application/pdf': '.pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
}

/** Characters a file name never holds: separators and control characters. */
const UNSAFE = /[\\/:*?"<>|\p{Cc}]+/gu

/**
 * The file name of an item of a source: its title made safe, with the extension of its media
 * type when the title has none. An empty title gives the external id.
 */
export function itemFileName(title: string, mediaType: string, externalId: string): string {
  const extension = EXTENSIONS[mediaType.split(';')[0]?.trim().toLowerCase() ?? ''] ?? ''
  const clean = (text: string) =>
    text.normalize('NFC').replace(UNSAFE, ' ').replace(/\s+/gu, ' ').trim()
  const base = clean(title) || clean(externalId) || 'item'
  const named = extension !== '' && base.toLowerCase().endsWith(extension) ? base : base + extension
  if (named.length <= FILE_NAME_MAX_LENGTH) return named
  return base.slice(0, FILE_NAME_MAX_LENGTH - extension.length).trimEnd() + extension
}
