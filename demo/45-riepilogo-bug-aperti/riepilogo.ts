// Demo 45: the summary of the tracker counts as open the bugs in work and in verification only,
// as the «Bug» tab of the dashboard does. Synthetic tracker: 14 in work, 3 in verification,
// 49 validated and waiting for their release.
import {
  DEFAULT_DASHBOARD_SETTINGS,
  isOpenPhase,
  parseTrackerExport,
  phaseOf,
  trackerSummary,
} from '../../packages/domain/src/index.ts'

const GROUPS: ReadonlyArray<{ state: string; count: number }> = [
  { state: '04 - In Progress', count: 14 },
  { state: '06 - Ready for Test', count: 3 },
  { state: '10 - Validated', count: 49 },
]

let id = 0
const items = GROUPS.flatMap(({ state, count }) =>
  Array.from({ length: count }, () => {
    id += 1
    return {
      id,
      type: 'Bug',
      title: `Bug ${id}`,
      state,
      tags: ['Aurora'],
      sprint: 'Sprint 29',
      created_date: '2026-10-01T08:00:00Z',
    }
  }),
)
const data = parseTrackerExport({ exported_at: new Date().toISOString(), items })
if (!data) throw new Error('not a tracker export')

const summary = trackerSummary(data, DEFAULT_DASHBOARD_SETTINGS)
const shown = summary
  .split('\n')
  .filter(
    (line) => line.startsWith('- Bug') || line.startsWith('| Aurora') || line.startsWith('| Tag'),
  )
const dashboardOpen = data.items.filter((item) =>
  isOpenPhase(phaseOf(item.state, DEFAULT_DASHBOARD_SETTINGS)),
).length

console.log('Riepilogo del cruscotto (_octo/cruscotto/riepilogo.md), righe sui bug:\n')
console.log(shown.join('\n'))
console.log(`\nScheda «Bug» del cruscotto, aperti: ${dashboardOpen}`)
const line = `- Bug aperti (in lavorazione o in verifica): ${dashboardOpen}`
if (!summary.includes(line)) {
  console.error('\nERRORE: il riepilogo e il cruscotto non danno lo stesso numero di bug aperti.')
  process.exit(1)
}
console.log('OK: riepilogo e cruscotto danno lo stesso numero.')
