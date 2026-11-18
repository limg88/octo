// Opens the built desktop app on the project of demo 62, with the fake model, and follows its
// steps in the real window: a question answered with calculations, its table with the source,
// its files kept in the project only when the PM says so.
// Run with `pnpm e2e:recinto` (it builds first). The fence itself is tried by `pnpm test:recinto`.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { _electron as electron } from 'playwright'

const root = fileURLToPath(new URL('..', import.meta.url))
const work = `${root}.tmp/e2e-recinto`
const TIMEOUT_MS = 20_000

execFileSync('node', [`${root}apps/desktop/scripts/fetch-python.mjs`])
execFileSync('bash', ['-c', `source "${root}demo/lib/project.sh" && make_demo_project "${work}"`])

const app = await electron.launch({
  args: [`${root}apps/desktop`],
  env: {
    ...process.env,
    OCTO_DATA_DIR: `${work}/dati`,
    OCTO_CLAUDE_PATH: `${root}demo/lib/fake-claude`,
    OCTO_MAIL_ROOT: `${work}/Mail-assente`,
    OCTO_DEMO_PLAIN_SECRETS: '1',
    OCTO_DEMO_IDENTITY: 'Paola Verdi <pm@example.test>',
  },
})
try {
  const page = await app.firstWindow()
  await page.getByRole('tab', { name: 'Chiedi' }).click()
  // A question asked as always is answered as always: nothing is computed.
  const field = page.getByLabel('Chiedi qualcosa su questo progetto…')
  await page.getByRole('checkbox', { name: 'Con calcoli' }).check({ timeout: TIMEOUT_MS })
  await field.fill('Quante righe ha il file di stato?')
  await page.getByRole('button', { name: 'Chiedi', exact: true }).click()
  const table = page.getByRole('table', { name: 'Righe del file di stato' })
  await table.waitFor({ timeout: TIMEOUT_MS })
  const computed = page.getByRole('region', { name: 'Righe del file di stato' })
  await computed.getByText('Calcolata da:').waitFor()
  await computed.getByRole('button', { name: 'wiki/stato.md' }).waitFor()
  await computed.getByText('Per intero nel file righe.csv.').waitFor()
  // The run wrote among the state of the app, never in the project.
  assert.ok(!existsSync(`${work}/Aurora/_octo/analisi`))
  const [run] = readdirSync(`${work}/dati/lavoro/demo-aurora`)
  assert.ok(existsSync(`${work}/dati/lavoro/demo-aurora/${run}/righe.csv`))
  await page.screenshot({ path: `${work}/calcolo.png`, fullPage: true })

  // Kept only when the PM says so: then Octo copies the files into the project.
  await page.getByRole('button', { name: 'Salva i file nel progetto' }).click()
  await page
    .getByText(/^File salvati nel progetto, in _octo\/analisi\//)
    .waitFor({ timeout: TIMEOUT_MS })
  const [kept] = readdirSync(`${work}/Aurora/_octo/analisi`)
  assert.match(
    readFileSync(`${work}/Aurora/_octo/analisi/${kept}/righe.csv`, 'utf8'),
    /^righe\n\d+\n$/,
  )
  assert.ok(existsSync(`${work}/Aurora/_octo/analisi/${kept}/dettaglio/calcolo.py`))
  console.log('e2e recinto: ok')
} finally {
  await app.close()
}
