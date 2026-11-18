// The catalog of deliverables as the app ships it, for the tests that need its kinds.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  CATALOG_INDEX,
  CATALOG_INSTRUCTIONS,
  CATALOG_KIND,
  type DeliverableKind,
  parseCatalogIndex,
  parseCatalogKind,
} from '../../src/index.ts'

// By the folder of this file, not by its address: a test of the interface has no file address.
export const CATALOG_FOLDER = `${join(import.meta.dirname, '..', '..', '..', '..', 'apps', 'desktop', 'resources', 'catalogo')}/`
const read = (...path: string[]): string =>
  readFileSync(`${CATALOG_FOLDER}${path.join('/')}`, 'utf8')

/** The kinds the app ships, in the order of the catalog; a broken one stops the tests. */
export function shippedCatalog(): DeliverableKind[] {
  const ids = parseCatalogIndex(JSON.parse(read(CATALOG_INDEX)))
  if (ids === null) throw new Error('the index of the catalog is not one')
  return ids.map((id) => {
    const parsed = parseCatalogKind(
      id,
      JSON.parse(read(id, CATALOG_KIND)),
      read(id, CATALOG_INSTRUCTIONS),
    )
    if (!parsed.ok) throw new Error(`${id}: ${parsed.why}`)
    return parsed.kind
  })
}

export const DELIVERABLE_CATALOG: readonly DeliverableKind[] = shippedCatalog()
export const deliverableKind = (id: string): DeliverableKind | null =>
  DELIVERABLE_CATALOG.find((kind) => kind.id === id) ?? null
