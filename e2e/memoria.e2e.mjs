// Opens the built desktop app on the project of demo 65, with the fake model, and follows its
// steps in the real window: a page of the memory of the project is written, enters the memory
// only when approved, and is cited by the next answer. Run with `pnpm e2e:memoria` (it builds first).
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { _electron as electron } from 'playwright'

const root = fileURLToPath(new URL('..', import.meta.url))
const work = `${root}.tmp/e2e-memoria`
const TIMEOUT_MS = 20_000
const page65 = `${work}/Aurora/_octo/progetto/memoria/fatti-correnti.md`

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
  await page.getByRole('tab', { name: 'Deliverable' }).click()
  // The pages of the memory stand apart in the catalog, under what they are for.
  const memory = page.getByRole('region', { name: 'Memoria del progetto' })
  for (const title of ['decisioni e regole del PM', 'cronologia del progetto']) {
    await memory.getByText(title, { exact: true }).waitFor({ timeout: TIMEOUT_MS })
  }
  await page
    .getByRole('button', { name: /Memoria: fatti correnti/ })
    .first()
    .click()
  await page.getByLabel(/^Aggiornata fino a/).fill('17 novembre 2026')
  await page.getByRole('button', { name: 'Scrivi la bozza' }).click()
  await page
    .getByText(/La consegna del modulo ordini è fissata al 12 dicembre 2026/)
    .first()
    .waitFor({ timeout: TIMEOUT_MS })
  // A draft is not memory: the page is written only when the PM approves.
  assert.ok(!existsSync(page65))
  await page.getByRole('button', { name: 'Approva', exact: true }).click()
  await page
    .getByText(/fatti-correnti\.md/)
    .first()
    .waitFor({ timeout: TIMEOUT_MS })
  const kept = readFileSync(page65, 'utf8')
  assert.match(kept, /^# Memoria: fatti correnti\n/)
  assert.match(kept, /approvata dal PM il \d{4}-\d\d-\d\d/)
  assert.match(kept, /## Fonti\n\n- `wiki\/stato\.md`\n$/)
  assert.doesNotMatch(kept, /\[\d+\]/)

  // The next answer reads the memory first, and cites the page and its source.
  await page.getByRole('tab', { name: 'Chiedi' }).click()
  await page.getByLabel('Chiedi qualcosa su questo progetto…').fill('A che punto siamo?')
  await page.getByRole('button', { name: 'Chiedi', exact: true }).click()
  await page.getByText(/secondo la memoria del progetto/).waitFor({ timeout: TIMEOUT_MS })
  await page
    .getByRole('button', { name: /fatti-correnti/ })
    .first()
    .waitFor({ timeout: TIMEOUT_MS })
  assert.equal(await page.getByText('frase non trovata').count(), 0)
  await page.screenshot({ path: `${work}/memoria.png`, fullPage: true })
  console.log('e2e memoria: ok')
} finally {
  await app.close()
}
