// A fake Confluence on this computer, with the space «Aurora» and a few pages of the project.
// Usage: node demo/lib/fake-confluence.ts       (prints its address and keeps running)
// The account it accepts is the one of the fake Jira: `pm@example.test` with `demo-token`.
import { startFakeConfluence } from '../../packages/connectors/test/support/fake-confluence.ts'

export const DEMO_CONFLUENCE = {
  site: 'demo',
  email: 'pm@example.test',
  token: 'demo-token',
  space: 'AUR',
}
const AURORA = { id: '100', key: DEMO_CONFLUENCE.space, name: 'Aurora' }
const ARCHIVE = { id: '200', key: 'ARC', name: 'Archivio' }
const DAY_MS = 24 * 60 * 60 * 1000
/** Pages changed in the last days, so that a first day of thirty days ago finds them. */
const daysAgo = (days: number): string => new Date(Date.now() - days * DAY_MS).toISOString()

export function startDemoConfluence() {
  return startFakeConfluence({
    email: DEMO_CONFLUENCE.email,
    token: DEMO_CONFLUENCE.token,
    spaces: [AURORA, ARCHIVE],
    pages: [
      {
        id: '1',
        spaceId: AURORA.id,
        title: 'Decisioni di progetto',
        changedAt: daysAgo(6),
        version: 4,
        paragraphs: [
          'Il collaudo del modulo ordini è confermato per il 17 dicembre 2026.',
          'La migrazione dei dati storici è rinviata alla fase 2, su richiesta del cliente.',
        ],
      },
      {
        id: '2',
        spaceId: AURORA.id,
        title: 'Glossario del cliente',
        changedAt: daysAgo(3),
        version: 2,
        paragraphs: ['«Conferma d’ordine»: il documento che il cliente stampa dopo ogni ordine.'],
      },
      {
        id: '3',
        spaceId: ARCHIVE.id,
        title: 'Progetto dell’anno scorso',
        changedAt: daysAgo(2),
        version: 1,
        paragraphs: ['Non riguarda Aurora: lo spazio non è fra quelli scelti.'],
      },
    ],
  })
}

if (import.meta.main) {
  const fake = await startDemoConfluence()
  console.log(fake.server.origin)
  process.on('SIGTERM', () => {
    fake.server.close()
    process.exit(0)
  })
}
