// Opens the built desktop app on the two projects of demo 61 and follows its steps in the real
// window: a recorded meeting enters by itself the only project all its known people are of.
// Run with `pnpm e2e:riunioni` (it builds first).
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { _electron as electron } from 'playwright'

const root = fileURLToPath(new URL('..', import.meta.url))
const work = `${root}.tmp/e2e-riunioni`
const TIMEOUT_MS = 20_000

execFileSync('bash', ['-c', `source "${root}demo/lib/project.sh" && make_demo_project "${work}"`])
execFileSync('node', [`${root}demo/lib/fake-moved-meetings.ts`, work])
/** The folders of the meetings a project holds, by the title in their name. */
const held = (project) =>
  readdirSync(`${work}/${project}/_octo/riunioni`, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)

const app = await electron.launch({
  args: [`${root}apps/desktop`],
  env: {
    ...process.env,
    OCTO_DATA_DIR: `${work}/dati`,
    OCTO_CLAUDE_PATH: `${root}demo/lib/fake-claude`,
    OCTO_MAIL_ROOT: `${work}/Mail-assente`,
    OCTO_VERBALE_DIR: `${work}/VerbaleDati`,
    OCTO_DEMO_PLAIN_SECRETS: '1',
    OCTO_DEMO_IDENTITY: 'Paola Verdi <pm@example.test>',
  },
})
try {
  const page = await app.firstWindow()
  await page.getByRole('heading', { name: 'Aurora' }).waitFor({ timeout: TIMEOUT_MS })
  // On Aurora: the meeting with people of both projects waits; the daily of Aurora does not.
  // It is not a signal of the page: it waits in the list of the meetings to assign.
  await page.getByText(/^\d+ riunion[ei] da assegnare$/).click({ timeout: TIMEOUT_MS })
  const aside = page.getByRole('list', { name: 'Riunioni da assegnare' })
  await aside.getByText('Allineamento ambienti').waitFor({ timeout: TIMEOUT_MS })
  assert.equal(await aside.getByText('Daily Standup Fornitori').count(), 0)
  // The reading of the meetings brings the daily into Aurora, and nothing else.
  await page.getByRole('tab', { name: 'Impostazioni' }).click()
  const meetings = page.getByRole('region', { name: 'Riunioni (Verbale)' })
  await meetings.getByRole('button', { name: 'Leggi ora' }).click()
  // The periodic reading may have run just before the click: either way the reading is told.
  await meetings.getByText(/^Ultima lettura .*(1 nuove o aggiornate|1 invariate)/).waitFor({
    timeout: TIMEOUT_MS,
  })
  const inAurora = held('Aurora')
  assert.equal(inAurora.length, 1)
  assert.match(inAurora[0], /daily-standup-fornitori/i)
  assert.ok(!held('Boreale').some((name) => /fornitori|allineamento/i.test(name)))
  await page.screenshot({ path: `${work}/riunioni.png`, fullPage: true })
  console.log('e2e riunioni: ok')
} finally {
  await app.close()
}
