import type { DeliverableField, DeliverableKind } from './deliverable.ts'
import { ESTIMATE_PLACEHOLDER } from './pert.ts'

/**
 * The kinds of deliverable that ship with Octo are files, one folder per kind: what the kind is
 * (`tipo.json`) and how it is written (`istruzioni.md`). An index names them in the order the
 * catalog shows them. Text that is data can be corrected without a new version of the code; what
 * the code guarantees is that a kind which is not whole never reaches a writer.
 */
export const CATALOG_INDEX = 'indice.json'
export const CATALOG_KIND = 'tipo.json'
export const CATALOG_INSTRUCTIONS = 'istruzioni.md'

const KIND_ID = /^[a-z][a-z0-9-]{0,39}$/
const FIELD_KINDS: ReadonlyArray<DeliverableField['kind']> = ['text', 'long', 'date', 'meeting']
/** Instructions shorter than this are a stub, not the rules of a craft. */
const MIN_INSTRUCTIONS = 200

type Json = Record<string, unknown>
const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const words = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

/** The ids the index of the catalog names, in its order; null for what is not an index. */
export function parseCatalogIndex(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length === 0) return null
  const ids = value.filter((id): id is string => typeof id === 'string' && KIND_ID.test(id))
  return ids.length === value.length && new Set(ids).size === ids.length ? ids : null
}

function fieldOf(value: unknown): DeliverableField | null {
  if (!isObject(value)) return null
  const [key, label, hint] = [words(value.key), words(value.label), words(value.hint)]
  const kind = FIELD_KINDS.find((known) => known === value.kind)
  if (key === '' || label === '' || kind === undefined || typeof value.required !== 'boolean') {
    return null
  }
  return { key, label, kind, required: value.required, ...(hint === '' ? {} : { hint }) }
}

/**
 * A kind of the catalog from its two files. What is wrong with it is said in a word, so the
 * start of the app can name the file to put right; a kind is never mended by guessing.
 */
export function parseCatalogKind(
  id: string,
  kind: unknown,
  instructions: string,
): { ok: true; kind: DeliverableKind } | { ok: false; why: string } {
  const broken = (why: string) => ({ ok: false as const, why })
  if (!isObject(kind)) return broken(CATALOG_KIND)
  const [title, summary] = [words(kind.title), words(kind.summary)]
  if (title === '' || summary === '') return broken('title')
  if (kind.audience !== 'client' && kind.audience !== 'internal') return broken('audience')
  const fields = Array.isArray(kind.fields) ? kind.fields.map(fieldOf) : []
  const whole = fields.filter((field): field is DeliverableField => field !== null)
  const keys = new Set(whole.map((field) => field.key))
  if (whole.length === 0 || whole.length !== fields.length || keys.size !== whole.length) {
    return broken('fields')
  }
  const checklist = Array.isArray(kind.checklist) ? kind.checklist.map(words) : []
  if (checklist.length === 0 || checklist.includes('')) return broken('checklist')
  if (kind.calculation !== undefined && kind.calculation !== 'pert') return broken('calculation')
  if (kind.deck !== undefined && kind.deck !== true) return broken('deck')
  if (instructions.trim().length < MIN_INSTRUCTIONS) return broken(CATALOG_INSTRUCTIONS)
  // An estimate tells the writer where the code puts its figures: without, they would be lost.
  if (kind.calculation === 'pert' && !instructions.includes(ESTIMATE_PLACEHOLDER)) {
    return broken(CATALOG_INSTRUCTIONS)
  }
  return {
    ok: true,
    kind: {
      id,
      title,
      summary,
      audience: kind.audience,
      fields: whole,
      instructions,
      checklist,
      ...(kind.calculation === 'pert' ? { calculation: 'pert' as const } : {}),
      ...(kind.deck === true ? { deck: true as const } : {}),
    },
  }
}
