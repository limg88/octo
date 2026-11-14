// Writes into a project folder a presentation of a past period, as a PM would have it: cover,
// two slides of content, a closing slide. With `chosen` it is also set as the deck of the
// project, as if the PM had picked it in the app.
// Usage: node demo/lib/fake-deck.ts <project folder> [chosen]
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { deckPptx } from '../../packages/infrastructure/test/support/deck-pptx.ts'

const [project, chosen] = process.argv.slice(2)
if (!project) throw new Error('usage: fake-deck.ts <project folder> [chosen]')

const deck = deckPptx()
mkdirSync(join(project, 'Presentazioni'), { recursive: true })
writeFileSync(join(project, 'Presentazioni', 'Stato avanzamento - periodo scorso.pptx'), deck)
if (chosen) {
  const models = join(project, '_octo', '.modelli')
  mkdirSync(models, { recursive: true })
  writeFileSync(join(models, 'presentazione.pptx'), deck)
}
