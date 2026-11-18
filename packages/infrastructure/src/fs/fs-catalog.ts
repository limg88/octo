import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { ShippedCatalog } from '@octo/application'
import {
  CATALOG_INDEX,
  CATALOG_INSTRUCTIONS,
  CATALOG_KIND,
  type DeliverableKind,
  DomainError,
  parseCatalogIndex,
  parseCatalogKind,
} from '@octo/domain'

/**
 * The kinds of deliverable that travel with the app, read once from their folder: an index and,
 * for each kind, what it is and how it is written. A file that is missing or wrong stops the
 * whole catalog with the name of what to put right: half a catalog is never offered.
 */
export function createFsShippedCatalog(folder: string): ShippedCatalog {
  let read: Promise<DeliverableKind[]> | null = null

  async function file(...path: string[]): Promise<string> {
    try {
      return await readFile(join(folder, ...path), 'utf8')
    } catch {
      throw new DomainError('catalog_invalid', path.join('/'))
    }
  }
  const json = (text: string, name: string): unknown => {
    try {
      return JSON.parse(text)
    } catch {
      throw new DomainError('catalog_invalid', name)
    }
  }

  async function load(): Promise<DeliverableKind[]> {
    const ids = parseCatalogIndex(json(await file(CATALOG_INDEX), CATALOG_INDEX))
    if (ids === null) throw new DomainError('catalog_invalid', CATALOG_INDEX)
    const kinds: DeliverableKind[] = []
    for (const id of ids) {
      const kind = json(await file(id, CATALOG_KIND), `${id}/${CATALOG_KIND}`)
      const parsed = parseCatalogKind(id, kind, await file(id, CATALOG_INSTRUCTIONS))
      if (!parsed.ok) throw new DomainError('catalog_invalid', `${id}: ${parsed.why}`)
      kinds.push(parsed.kind)
    }
    return kinds
  }

  return {
    kinds() {
      read ??= load()
      // A catalog that could not be read is read again the next time: the file may be put right.
      read.catch(() => {
        read = null
      })
      return read
    },
  }
}
