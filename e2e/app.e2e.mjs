// Opens the built desktop app on a synthetic project, with the fake model, and follows the steps
// of demo 01 in the real window. Run with `pnpm e2e` after `pnpm build`.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { _electron as electron } from 'playwright'
import { DEMO_ADO, extraItem, startDemoAdo } from '../demo/lib/fake-ado.ts'

const root = fileURLToPath(new URL('..', import.meta.url))
const work = `${root}.tmp/e2e`
const TIMEOUT_MS = 20_000

execFileSync('bash', ['-c', `source "${root}demo/lib/project.sh" && make_demo_project "${work}"`])
const fakeMail = (...extra) =>
  execFileSync('node', [`${root}demo/lib/fake-mail.ts`, `${work}/Mail`, ...extra])
fakeMail()
const fakeDocuments = (...extra) =>
  execFileSync('node', [`${root}demo/lib/fake-documents.ts`, `${work}/Aurora`, ...extra])
fakeDocuments()

const ado = await startDemoAdo()

// OCTO_E2E_EXECUTABLE points the same steps at an installed or packaged app.
const packaged = process.env.OCTO_E2E_EXECUTABLE
/** Waits, a bounded time, for something the app does on disk. */
async function assertEventually(check) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (check()) return
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  assert.fail('the app did not get there in time')
}

const launch = () =>
  electron.launch({
    ...(packaged ? { executablePath: packaged, args: [] } : { args: [`${root}apps/desktop`] }),
    env: {
      ...process.env,
      OCTO_DATA_DIR: `${work}/dati`,
      OCTO_CLAUDE_PATH: `${root}demo/lib/fake-claude`,
      OCTO_MAIL_ROOT: `${work}/Mail`,
      OCTO_DEV_ADO_URL: ado.server.origin,
      OCTO_DEMO_PLAIN_SECRETS: '1',
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
  const mail = page.getByRole('region', { name: 'Posta' })
  await mail.getByText('La posta di questo progetto non è ancora configurata.').waitFor()
  await mail.getByLabel('Parole chiave').fill('Aurora')
  await mail.getByLabel('Mittenti da escludere').fill('avvisi@monitor.example')
  await mail.getByRole('button', { name: 'Salva', exact: true }).click()
  await mail.getByText('Mai letta.').waitFor({ timeout: TIMEOUT_MS })
  await mail.getByRole('button', { name: 'Leggi ora' }).click()
  await mail.getByText('2 nuove, 0 già presenti').waitFor({ timeout: TIMEOUT_MS })
  const month = new Date(Date.now() - 30 * 3600 * 1000).toISOString().slice(0, 7)
  const written = readdirSync(`${work}/Aurora/Posta/${month}`)
  assert.equal(written.length, 2)
  const first = readFileSync(`${work}/Aurora/Posta/${month}/${written[0]}`, 'utf8')
  assert.match(first, /oggetto: "Aurora: data del collaudo"/)
  assert.match(first, /spostato a giovedì 17 dicembre 2026/)
  fakeMail('extra')
  await mail.getByRole('button', { name: 'Leggi ora' }).click()
  await mail.getByText('1 nuove, 2 già presenti').waitFor({ timeout: TIMEOUT_MS })

  // Demo 03: Office files of the project become text beside them, again only when they change.
  const convertNow = async (outcome) => {
    const button = page.getByRole('button', { name: 'Converti ora' })
    await button.click()
    await page.getByText(outcome).waitFor({ timeout: TIMEOUT_MS })
  }
  await convertNow(/Ultima conversione .*: (2 aggiornati, 0|0 aggiornati, 2) già pronti/)
  const sheet = readFileSync(`${work}/Aurora/_octo/testo/Documenti/Scenari.xlsx.md`, 'utf8')
  assert.match(sheet, /## Foglio Giornate\n\nScenario base \| 120/)
  fakeDocuments('changed')
  await convertNow('1 aggiornati, 1 già pronti')
  const offer = readFileSync(`${work}/Aurora/_octo/testo/Documenti/Offerta Aurora.docx.md`, 'utf8')
  assert.match(offer, /canone annuo di manutenzione è di 15\.000 euro/)

  // Demo 04: a system of record read with the PM's token into files of the project.
  const adoSection = page.getByRole('region', { name: 'Azure DevOps' })
  const linkAdo = async (token) => {
    await adoSection.getByLabel('Organizzazione').fill(DEMO_ADO.organization)
    await adoSection.getByLabel('Progetto', { exact: true }).fill(DEMO_ADO.project)
    await adoSection.getByLabel(/^Personal Access Token/).fill(token)
    await adoSection.getByRole('button', { name: 'Prova e salva' }).click()
  }
  await adoSection.getByText('Non collegato.').waitFor({ timeout: TIMEOUT_MS })
  await linkAdo('sbagliato')
  await adoSection.getByText(/ha rifiutato la credenziale/).waitFor({ timeout: TIMEOUT_MS })
  await linkAdo(DEMO_ADO.pat)
  await adoSection.getByText('Collegamento riuscito e salvato.').waitFor({ timeout: TIMEOUT_MS })
  assert.doesNotMatch(readFileSync(`${work}/Aurora/.octo/sources.json`, 'utf8'), /demo-pat/)
  await adoSection.getByRole('button', { name: 'Leggi ora' }).click()
  await adoSection
    .getByText(/Ultima lettura .* aggiornati, 0 invariati/)
    .waitFor({ timeout: TIMEOUT_MS })
  const workItems = () =>
    readdirSync(`${work}/Aurora/Fonti/ADO`).filter((name) => /^\d+-[0-9a-f]{8}\.md$/.test(name))
  assert.deepEqual(
    workItems().map((name) => name.split('-')[0]),
    ['101', '102', '103'],
  )
  assert.match(
    readFileSync(`${work}/Aurora/Fonti/ADO/_lettura.md`, 'utf8'),
    /fonte: "Azure DevOps"/,
  )
  ado.options.items.push(extraItem())
  await adoSection.getByRole('button', { name: 'Leggi ora' }).click()
  await assertEventually(() => workItems().length === 4)
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
  ado.server.close()
}
