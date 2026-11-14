// Opens the built desktop app on a synthetic project, with the fake model, and follows the steps
// of demo 01 in the real window. Run with `pnpm e2e` after `pnpm build`.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { _electron as electron } from 'playwright'

const root = fileURLToPath(new URL('..', import.meta.url))
const work = `${root}.tmp/e2e`
const TIMEOUT_MS = 20_000

execFileSync('bash', ['-c', `source "${root}demo/lib/project.sh" && make_demo_project "${work}"`])
const fakeMail = (...extra) =>
  execFileSync('node', [`${root}demo/lib/fake-mail.ts`, `${work}/Mail`, ...extra])
fakeMail()

// OCTO_E2E_EXECUTABLE points the same steps at an installed or packaged app.
const packaged = process.env.OCTO_E2E_EXECUTABLE
const launch = () =>
  electron.launch({
    ...(packaged ? { executablePath: packaged, args: [] } : { args: [`${root}apps/desktop`] }),
    env: {
      ...process.env,
      OCTO_DATA_DIR: `${work}/dati`,
      OCTO_CLAUDE_PATH: `${root}demo/lib/fake-claude`,
      OCTO_MAIL_ROOT: `${work}/Mail`,
    },
  })

let app = await launch()
try {
  let page = await app.firstWindow()
  const ask = async (question) => {
    await page.getByPlaceholder('Chiedi qualcosa su questo progetto…').fill(question)
    await page.getByRole('button', { name: 'Chiedi', exact: true }).click()
  }

  await page.getByRole('heading', { name: 'Aurora' }).waitFor({ timeout: TIMEOUT_MS })
  await page.getByText('Claude 9.9.9 (Fake Claude)').waitFor({ timeout: TIMEOUT_MS })

  await ask('Quando consegniamo il modulo ordini?')
  await page.getByText('1 fonte controllata').waitFor({ timeout: TIMEOUT_MS })
  assert.equal(await page.getByText('Controllata', { exact: true }).count(), 1)

  await ask('E il budget? #inventa')
  await page.getByText('1 punto da controllare').waitFor({ timeout: TIMEOUT_MS })
  await page.getByText('La frase non è nel file').waitFor({ timeout: TIMEOUT_MS })
  await page.screenshot({ path: `${work}/chiedi.png` })

  // Demo 02: the mail of the project enters its folder, once.
  await page.getByRole('tab', { name: 'Fonti' }).click()
  await page.getByText('La posta di questo progetto non è ancora configurata.').waitFor()
  await page.getByLabel('Parole chiave').fill('Aurora')
  await page.getByLabel('Mittenti da escludere').fill('avvisi@monitor.example')
  await page.getByRole('button', { name: 'Salva' }).click()
  await page.getByText('Mai letta.').waitFor({ timeout: TIMEOUT_MS })
  await page.getByRole('button', { name: 'Leggi ora' }).click()
  await page.getByText('2 nuove, 0 già presenti').waitFor({ timeout: TIMEOUT_MS })
  const month = new Date(Date.now() - 30 * 3600 * 1000).toISOString().slice(0, 7)
  const written = readdirSync(`${work}/Aurora/Posta/${month}`)
  assert.equal(written.length, 2)
  const first = readFileSync(`${work}/Aurora/Posta/${month}/${written[0]}`, 'utf8')
  assert.match(first, /oggetto: "Aurora: data del collaudo"/)
  assert.match(first, /spostato a giovedì 17 dicembre 2026/)
  fakeMail('extra')
  await page.getByRole('button', { name: 'Leggi ora' }).click()
  await page.getByText('1 nuove, 2 già presenti').waitFor({ timeout: TIMEOUT_MS })
  await page.screenshot({ path: `${work}/fonti.png` })
  await page.getByRole('tab', { name: 'Chiedi' }).click()

  // The history survives a restart of the app.
  await app.close()
  app = await launch()
  page = await app.firstWindow()
  await page.getByText('1 punto da controllare').waitFor({ timeout: TIMEOUT_MS })
  console.log('e2e: ok')
} finally {
  await app.close()
}
