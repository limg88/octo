// Demo 53, the part read in the terminal: two small corrections that have no page of their own
// in a synthetic project. Nothing is written.

import { messages } from '../../apps/desktop/src/renderer/messages.ts'
import { stateMismatches } from '../../packages/domain/src/index.ts'

const text = messages.dashboard
console.log('1. Mediane dell’andamento, con la virgola decimale:')
console.log(`   ${text.days(14.7)} · ${text.flowBefore(9.5)}`)

const groups = [{ name: 'Chiuso', item: ['Closed', 'Demo'], ticket: ['Done'] }]
const [mismatch] = stateMismatches({ stateGroups: groups }, { phases: {} })
if (!mismatch) throw new Error('the state «Demo» should be read in two ways')
console.log(
  '\n2. Stato «Demo»: chiuso per l’allineamento, in verifica per il cruscotto. Avviso in «Allineamento»:',
)
console.log(
  `   ${messages.alignment.stateMismatch(mismatch.state, mismatch.group, messages.alignment.phaseNames[mismatch.dashboardPhase])}`,
)
const agreed = stateMismatches({ stateGroups: groups }, { phases: { Demo: 'closed' } })
console.log(`\n   Dopo aver detto al cruscotto che «Demo» è chiuso: ${agreed.length} avvisi.`)
