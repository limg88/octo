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
/** How long before its last change a work item of the demo was opened. */
const CREATED_DAYS_BEFORE = 40
const daysAgo = (days: number): string => new Date(Date.now() - days * DAY_MS).toISOString()
const item = (id: number, days: number, title: string, state: string, type = 'User Story') =>
  workItem(id, {
    area: DEMO_ADO.project,
    iteration: `${DEMO_ADO.project}\\Sprint 1`,
    changedAt: daysAgo(days),
    createdAt: daysAgo(days + CREATED_DAYS_BEFORE),
    title,
    state,
    type,
  })

/** A bug of the team with what it went through and what was said about it. */
function openBug() {
  const bug = item(103, 3, 'Errore nel calcolo dell’IVA', 'Ready for Test', 'Bug')
  bug.fields['System.Tags'] = 'Squadra'
  bug.fields['System.CommentCount'] = 1
  const change = (days: number, fields: Record<string, unknown>) => ({
    fields: { 'System.ChangedDate': { newValue: daysAgo(days) }, ...fields },
  })
  bug.updates = [
    change(3 + CREATED_DAYS_BEFORE, {
      'System.CreatedDate': { newValue: daysAgo(3 + CREATED_DAYS_BEFORE) },
      'System.State': { newValue: 'New' },
      'System.Tags': { newValue: 'Squadra' },
    }),
    change(20, { 'System.State': { newValue: 'Active' } }),
    change(3, { 'System.State': { newValue: 'Ready for Test' } }),
  ]
  bug.comments = [
    {
      createdBy: { displayName: 'Mario Rossi' },
      createdDate: daysAgo(3),
      text: '<div>Corretto: in attesa del test del cliente</div>',
    },
  ]
  return bug
}

export async function startDemoAdo() {
  const fake = await startFakeAdo({
    organization: DEMO_ADO.organization,
    projectId: '6ce954b1-ce1f-45d1-b94d-e6bf2464ba2c',
    projectName: DEMO_ADO.project,
    pat: DEMO_ADO.pat,
    areas: [{ name: 'Team A' }],
    iterations: [{ name: 'Sprint 1' }],
    items: [
      item(101, 6, 'Modulo ordini: invio conferma via mail', 'Active'),
      item(102, 5, 'Modulo ordini: export in PDF', 'Blocked'),
      openBug(),
    ],
  })
  // As the real one does, it answers as of now.
  fake.asOf = new Date()
  return fake
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
