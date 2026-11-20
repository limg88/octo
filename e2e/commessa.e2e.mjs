// Opens the built desktop app on the project of demo 60, with a fake NetSuite already linked,
// and follows its steps in the real window: the summary of a project code with how far it is
// as the company's system tells it, and the hours and the forecast of the month as its parts.
// Run with `pnpm e2e:commessa` (it builds first; it needs the test Postgres, `pnpm db:setup`).
import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { _electron as electron } from 'playwright'

const root = fileURLToPath(new URL('..', import.meta.url))
const work = `${root}.tmp/e2e-commessa`
const TIMEOUT_MS = 20_000
const CODE = 'PRJ000101'

execFileSync('bash', ['-c', `source "${root}demo/lib/project.sh" && make_demo_project "${work}"`])
const dwsi = spawn('node', [
  `${root}demo/lib/fake-dwsi-months.ts`,
  `${work}/Aurora`,
  `${work}/dati`,
  'summary',
])
await new Promise((resolve, reject) => {
  dwsi.stdout.once('data', resolve)
  dwsi.once('exit', () => reject(new Error('the fake NetSuite did not start: pnpm db:setup')))
})
const settingsFolder = `${work}/Aurora/_octo/.impostazioni`
const planBefore = readFileSync(`${settingsFolder}/sheet-plan.json`, 'utf8')

const app = await electron.launch({
  args: [`${root}apps/desktop`],
  env: {
    ...process.env,
    OCTO_DATA_DIR: `${work}/dati`,
    OCTO_CLAUDE_PATH: `${root}demo/lib/fake-claude`,
    OCTO_MAIL_ROOT: `${work}/Mail-assente`,
    OCTO_DEV_WAREHOUSE_LOOPBACK: '1',
    OCTO_DEMO_PLAIN_SECRETS: '1',
    OCTO_DEMO_IDENTITY: 'Paola Verdi <pm@example.test>',
  },
})
try {
  const page = await app.firstWindow()
  const nav = page.getByRole('navigation', { name: 'Progetti' })
  const section = (name) => nav.getByRole('tab', { name, exact: true })
  const part = (name) =>
    page
      .getByRole('tablist', { name: 'Schede della commessa' })
      .getByRole('tab', { name, exact: true })
  const figure = (name) => page.locator('.figure', { has: page.getByText(name, { exact: true }) })

  // «Ore» and «Previsionale» are no longer sections: the list names «Commessa» only.
  await section('Commessa').waitFor({ timeout: TIMEOUT_MS })
  assert.equal(await section('Ore').count(), 0)
  assert.equal(await section('Previsionale').count(), 0)
  await section('Commessa').click()
  assert.deepEqual(
    await page
      .getByRole('tablist', { name: 'Schede della commessa' })
      .getByRole('tab')
      .allInnerTexts(),
    ['Sintesi', 'Fatturazione', 'Ore', 'Previsionale'],
  )

  // The figures of the code, with how far it is as NetSuite tells it and the day of the figure.
  await page
    .getByRole('table', { name: 'Ore e costi per persona' })
    .waitFor({ timeout: TIMEOUT_MS })
  await figure('Ordinato').getByText('7.500,00').waitFor()
  // What Octo computes differs from what NetSuite booked: said in the band, to be checked.
  await figure('Scostamento da NetSuite').getByText('Da verificare').waitFor()
  const progress = page
    .getByRole('table', { name: 'Ordine, ricavi e da regolare' })
    .getByRole('row', { name: /^Avanzamento/ })
  await progress.getByText('62%').waitFor()
  await progress.getByText(/da NetSuite, al 28\/\d\d\/\d{4}$/).waitFor()
  await page.getByRole('button', { name: 'Copia i dati per un report' }).waitFor()
  await page.screenshot({ path: `${work}/sintesi.png`, fullPage: true })

  // The plan the sheet kept left Octo: handed back as a text, its file untouched, its rate kept.
  const handedBack = `${work}/Aurora/_octo/.riservato/commessa/piano-esportato.md`
  assert.ok(existsSync(handedBack))
  const text = readFileSync(handedBack, 'utf8')
  assert.match(text, /\| Risorse interne \| Bianchi Luca \| — \| 60 \|/)
  assert.match(text, /\| SO-17 \| \d{4}-\d\d \| 2250 \|/)
  assert.equal(readFileSync(`${settingsFolder}/sheet-plan.json`, 'utf8'), planBefore)
  const forecast = JSON.parse(readFileSync(`${settingsFolder}/forecast.json`, 'utf8'))
  assert.deepEqual(forecast.rates, [{ person: 'Bianchi Luca', code: CODE, ratePerDay: 480 }])
  // Budget, months and the plan of the invoices are not in the page any more.
  for (const gone of ['Budget', 'Mesi']) assert.equal(await part(gone).count(), 0)

  await part('Fatturazione').click()
  await page.getByRole('table', { name: 'Fatture al cliente per ordine di vendita' }).waitFor()
  await page.getByRole('table', { name: 'Ordini a fornitore' }).waitFor()
  assert.equal(await page.getByText('Piano di fatturazione').count(), 0)

  // The hours and the forecast of the month are parts of the page; the list stays on «Commessa».
  await part('Ore').click()
  await page
    .getByRole('button', { name: 'Leggi i timesheet da NetSuite' })
    .waitFor({ timeout: TIMEOUT_MS })
  assert.equal(await section('Commessa').getAttribute('aria-selected'), 'true')
  await part('Previsionale').click()
  await page.getByText('Impostazioni del previsionale').first().waitFor({ timeout: TIMEOUT_MS })
  await page.getByText('Impostazioni del previsionale').first().click()
  await page.getByText('Tariffe e costi che NetSuite non dice').click()
  const rates = page.getByRole('region', { name: 'Tariffe al giorno' })
  assert.equal(await rates.getByLabel('Persona, riga 1').inputValue(), 'Bianchi Luca')
  assert.equal(await rates.getByLabel('Tariffa al giorno, riga 1').inputValue(), '480')
  await page.screenshot({ path: `${work}/previsionale.png`, fullPage: true })
  console.log('e2e commessa: ok')
} finally {
  await app.close()
  dwsi.kill('SIGTERM')
}
