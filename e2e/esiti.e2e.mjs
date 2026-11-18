// Opens the built desktop app on the project of demo 68 and follows what the trial from zero
// found broken: a thing of «Adesso» opens under its row; a request to Claude goes on while the PM
// is in another section and is there at the return; «Commessa» reads a year of months and ends.
// Run with `pnpm e2e:esiti` (it builds first; it needs the test Postgres, `pnpm db:setup`).
import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { _electron as electron } from 'playwright'

const root = fileURLToPath(new URL('..', import.meta.url))
const work = `${root}.tmp/e2e-esiti`
const TIMEOUT_MS = 30_000

execFileSync(
  'bash',
  [
    '-c',
    `cd "${root}" && source demo/lib/project.sh && source demo/lib/today-project.sh && OCTO_DEMO_DOUBTFUL_MEETING=1 OCTO_DEMO_MEETING_IN_MINUTES=40 make_today_project "${work}"`,
  ],
  { stdio: 'inherit' },
)
const dwsi = spawn('node', [
  `${root}demo/lib/fake-dwsi-months.ts`,
  `${work}/Aurora`,
  `${work}/dati`,
  'year',
])
await new Promise((resolve, reject) => {
  dwsi.stdout.once('data', resolve)
  dwsi.once('exit', () => reject(new Error('the fake NetSuite did not start: pnpm db:setup')))
})

const app = await electron.launch({
  args: [`${root}apps/desktop`],
  env: {
    ...process.env,
    OCTO_DATA_DIR: `${work}/dati`,
    OCTO_CLAUDE_PATH: `${root}demo/lib/fake-claude`,
    OCTO_MAIL_ROOT: `${work}/Mail`,
    OCTO_DEV_WAREHOUSE_LOOPBACK: '1',
    OCTO_DEMO_PLAIN_SECRETS: '1',
    OCTO_DEMO_IDENTITY: 'Paola Verdi <pm@example.test>',
  },
})
const page = await app.firstWindow()
try {
  const nav = page.getByRole('navigation', { name: 'Progetti' })
  const section = (name) => nav.getByRole('tab', { name })

  // «Commessa», opened at once on a project a year old: it reads the months it misses one by
  // one, says so, and gets to the end.
  await section('Commessa').click()
  const reading = page.getByText(/mese \d+ di \d+…/)
  await reading.first().waitFor({ timeout: TIMEOUT_MS })
  await page.screenshot({ path: `${work}/lettura.png`, fullPage: true })
  await page
    .getByRole('table', { name: 'Ore e costi per persona' })
    .waitFor({ timeout: TIMEOUT_MS })
  await reading.first().waitFor({ state: 'detached', timeout: TIMEOUT_MS })
  assert.equal(await page.getByText(/La lettura dei timesheet si è fermata/).count(), 0)
  assert.equal(await page.getByText(/Timesheet non letti da NetSuite/).count(), 0)

  await section('Oggi').click()
  // «Adesso»: nothing is open at the start; a click opens the thing under its own row.
  await page.getByRole('button', { name: 'Leggi ora' }).click({ timeout: TIMEOUT_MS })
  const first = page.getByRole('list', { name: 'Cose che vengono prima' })
  await first.waitFor({ timeout: TIMEOUT_MS })
  const detail = first.getByRole('region', { name: 'Dettaglio della segnalazione' })
  assert.equal(await detail.count(), 0)
  const row = first.getByRole('button').first()
  await row.click()
  await detail.waitFor()
  assert.equal(await row.getAttribute('aria-pressed'), 'true')
  await page.screenshot({ path: `${work}/adesso.png`, fullPage: true })
  await row.click()
  assert.equal(await detail.count(), 0)

  // I2. A meeting nobody can tell as of the project is not on the agenda: it waits aside, with
  // what Claude said, and enters when the PM says it is of the project.
  const today = page.getByRole('region', { name: 'Oggi' })
  const aside = page.getByText('1 riunione da assegnare')
  await aside.waitFor({ timeout: TIMEOUT_MS })
  assert.equal(await page.getByText('Comitato di direzione').locator('visible=true').count(), 0)
  await aside.click()
  const waiting = page.getByRole('list', { name: 'Riunioni da assegnare' })
  await waiting.getByText('Comitato di direzione').waitFor()
  await waiting.getByText(/Claude: non so dirlo/).waitFor({ timeout: TIMEOUT_MS })
  await page.screenshot({ path: `${work}/da-assegnare.png`, fullPage: true })
  await waiting.getByRole('button', { name: 'È di questo progetto', exact: true }).click()
  await aside.waitFor({ state: 'detached', timeout: TIMEOUT_MS })
  await today.getByText('Comitato di direzione').first().waitFor({ timeout: TIMEOUT_MS })
  // The critical things of the week read as a list; the long words on Claude are behind a click.
  await page
    .getByRole('region', { name: 'Criticità della settimana' })
    .getByRole('list')
    .first()
    .waitFor()
  assert.equal(
    await page
      .getByText(/Che una mail aspetti lo calcola Octo/)
      .locator('visible=true')
      .count(),
    0,
  )
  await page.getByText('Dettagli: che cosa valuta Claude e che cosa calcola Octo').click()
  await page.getByText(/Che una mail aspetti lo calcola Octo/).waitFor()
  await page.screenshot({ path: `${work}/oggi.png`, fullPage: true })

  // A request that takes its time, left behind: the list says where Claude works.
  await section('Chiedi').click()
  await page
    .getByPlaceholder('Chiedi qualcosa su questo progetto…')
    .fill('Quando consegniamo? #attesa')
  await page.getByRole('button', { name: 'Chiedi', exact: true }).click()
  await section('Commessa').click()
  await page.getByRole('table', { name: 'Ore e costi per persona' }).waitFor()
  await section('Chiedi').getByRole('img', { name: 'Claude sta lavorando qui' }).waitFor()

  // Back to «Chiedi»: the answer that came meanwhile is there, and the mark is gone.
  await section('Chiedi')
    .getByRole('img', { name: 'Claude sta lavorando qui' })
    .waitFor({ state: 'detached', timeout: TIMEOUT_MS })
  await section('Chiedi').click()
  await page.getByText('12 dicembre').first().waitFor({ timeout: TIMEOUT_MS })
  await page.screenshot({ path: `${work}/risposta.png`, fullPage: true })
  console.log('e2e esiti: ok')
} catch (error) {
  // What the window showed when a step failed, to look at.
  await page.screenshot({ path: `${work}/errore.png`, fullPage: true }).catch(() => {})
  throw error
} finally {
  await app.close()
  dwsi.kill('SIGTERM')
}
