// A fake Azure DevOps on this computer, with synthetic work items of the demo project «Aurora».
// Usage: node demo/lib/fake-ado.ts            (prints its address and keeps running)
// The token it accepts is `demo-pat`.
import { startFakeAdo, workItem } from '../../packages/connectors/test/support/fake-ado.ts'

export const DEMO_ADO = {
  organization: 'contoso',
  project: 'Aurora',
  pat: 'demo-pat',
}

const DAY_MS = 24 * 60 * 60 * 1000
const daysAgo = (days: number): string => new Date(Date.now() - days * DAY_MS).toISOString()
const item = (id: number, days: number, title: string, state: string, type = 'User Story') =>
  workItem(id, {
    area: DEMO_ADO.project,
    iteration: `${DEMO_ADO.project}\\Sprint 1`,
    changedAt: daysAgo(days),
    title,
    state,
    type,
  })

export async function startDemoAdo() {
  return startFakeAdo({
    organization: DEMO_ADO.organization,
    projectId: '6ce954b1-ce1f-45d1-b94d-e6bf2464ba2c',
    projectName: DEMO_ADO.project,
    pat: DEMO_ADO.pat,
    areas: [{ name: 'Team A' }],
    iterations: [{ name: 'Sprint 1' }],
    items: [
      item(101, 6, 'Modulo ordini: invio conferma via mail', 'Active'),
      item(102, 5, 'Modulo ordini: export in PDF', 'Blocked'),
      item(103, 3, 'Errore nel calcolo dell’IVA', 'New', 'Bug'),
    ],
  })
}

/** One more work item, as if someone had opened it meanwhile. */
export const extraItem = () => item(104, 0, 'Collaudo: checklist di accettazione', 'New')

if (import.meta.main) {
  const fake = await startDemoAdo()
  console.log(fake.server.origin)
  process.on('SIGTERM', () => {
    fake.server.close()
    process.exit(0)
  })
}
