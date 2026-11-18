// Completes, in a project that already has the synthetic data of demos 10 and 13, the settings
// the sections «Avanzamento» and «Allineamento» kept: an order with its positions and two
// requests, a sprint with its tags and groups of states. As a project that used the two sections
// has them when they become deliverables with a script (demo 63).
// Usage: node demo/lib/fake-scripted.ts <project folder>   (after fake-progress and fake-alignment)
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const [project] = process.argv.slice(2)
if (!project) throw new Error('usage: fake-scripted.ts <project folder>')

const settings = join(project, '_octo', '.impostazioni')
const merge = (name: string, more: object) => {
  const file = join(settings, name)
  writeFileSync(
    file,
    JSON.stringify({ ...JSON.parse(readFileSync(file, 'utf8')), ...more }, null, 1),
  )
}

merge('progress.json', {
  order: 'ORD-2026-077',
  salesOrders: [],
  total: 340000,
  positions: [
    { code: '00001', amount: 100000 },
    { code: '00002', amount: 60000 },
    { code: '00003', amount: 142000 },
    { code: '00004', amount: 38000 },
  ],
  requests: [
    {
      n: 1,
      from: '2026-03-01',
      to: '2026-03-31',
      amount: 289540,
      note: 'Fattura n. 101 del 31/03/2026',
      positions: [],
    },
    {
      n: 2,
      from: '2026-03-31',
      to: '2026-04-30',
      amount: 50460,
      note: 'Fattura da emettere il 30/04/2026',
      positions: [],
    },
  ],
})
merge('alignment.json', {
  sprint: 'Sprint 28',
  period: 'PI7',
  tags: ['Squadra'],
  ownPeopleOnly: false,
  referencePrefixes: ['AZDO', 'ADO'],
  stateGroups: [
    { name: 'In corso', item: ['In Progress'], ticket: ['In corso'] },
    { name: 'Chiuso', item: ['Closed'], ticket: ['Completata'] },
  ],
  typeMap: [
    { item: 'User Story', ticket: 'Story' },
    { item: 'Bug', ticket: 'Bug' },
  ],
})
