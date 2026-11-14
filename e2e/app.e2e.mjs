// Opens the built desktop app on a synthetic project, with the fake model, and follows the steps
// of demo 01 in the real window. Run with `pnpm e2e` after `pnpm build`.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
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
execFileSync('node', [`${root}demo/lib/fake-tracker.ts`, `${work}/Aurora`])

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

async function assertEventuallyAsync(check) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (await check()) return
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
  // Demo 05: the guide shows what is still to link, and the mail starts from the project's name.
  const guide = page.getByRole('region', { name: 'Avvio del progetto' })
  const guideStep = (text) => guide.getByRole('listitem').filter({ hasText: text })
  await guideStep('Posta').getByText('da fare').waitFor({ timeout: TIMEOUT_MS })
  await guideStep('Azure DevOps').getByText('da fare').waitFor({ timeout: TIMEOUT_MS })
  const mail = page.getByRole('region', { name: 'Posta' })
  assert.equal(await mail.getByLabel('Parole chiave').inputValue(), 'Aurora')
  await mail.getByRole('button', { name: 'Anteprima' }).click()
  await mail.getByText('3 mail entrerebbero con queste regole.').waitFor({ timeout: TIMEOUT_MS })
  await mail.getByText('[FIRING] Aurora - disco pieno').waitFor({ timeout: TIMEOUT_MS })
  await mail.getByText('La posta di questo progetto non è ancora configurata.').waitFor()
  await mail.getByLabel('Parole chiave').fill('Aurora')
  await mail.getByLabel('Mittenti da escludere').fill('avvisi@monitor.example')
  await mail.getByRole('button', { name: 'Salva', exact: true }).click()
  await mail.getByText('Mai letta.').waitFor({ timeout: TIMEOUT_MS })
  await guideStep('Posta').getByText('fatto').waitFor({ timeout: TIMEOUT_MS })
  await mail.getByRole('button', { name: 'Leggi ora' }).click()
  // The periodic reading may have run just before the click: either way two mails are there.
  await mail.getByText(/(2 nuove, 0|0 nuove, 2) già presenti/).waitFor({ timeout: TIMEOUT_MS })
  const month = new Date(Date.now() - 30 * 3600 * 1000).toISOString().slice(0, 7)
  const written = readdirSync(`${work}/Aurora/_octo/posta/${month}`)
  assert.equal(written.length, 2)
  const first = readFileSync(`${work}/Aurora/_octo/posta/${month}/${written[0]}`, 'utf8')
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
  const adoProject = adoSection.getByLabel('Progetto', { exact: true })
  const adoToken = adoSection.getByLabel(/^Personal Access Token/)
  const searchAdo = () => adoSection.getByRole('button', { name: 'Cerca progetti e aree' }).click()
  const saveAdo = () => adoSection.getByRole('button', { name: 'Prova e salva' }).click()
  await adoSection.getByText('Non collegato.').waitFor({ timeout: TIMEOUT_MS })
  await adoSection.getByLabel('Organizzazione').fill(DEMO_ADO.organization)
  await adoProject.fill(DEMO_ADO.project)
  await adoToken.fill('sbagliato')
  await saveAdo()
  await adoSection.getByText(/ha rifiutato la credenziale/).waitFor({ timeout: TIMEOUT_MS })
  // The project and its area are picked from what the token sees, not typed.
  await adoProject.fill('')
  await adoToken.fill(DEMO_ADO.pat)
  await searchAdo()
  await adoSection.getByRole('button', { name: DEMO_ADO.project, exact: true }).click()
  assert.equal(await adoProject.inputValue(), DEMO_ADO.project)
  await searchAdo()
  await adoSection
    .getByRole('button', { name: 'Team A', exact: true })
    .waitFor({ timeout: TIMEOUT_MS })
  await saveAdo()
  await adoSection.getByText('Collegamento riuscito e salvato.').waitFor({ timeout: TIMEOUT_MS })
  assert.doesNotMatch(
    readFileSync(`${work}/Aurora/_octo/.impostazioni/sources.json`, 'utf8'),
    /demo-pat/,
  )
  await adoSection.getByRole('button', { name: 'Leggi ora' }).click()
  await adoSection
    .getByText(/Ultima lettura .* aggiornati, \d+ invariati/)
    .waitFor({ timeout: TIMEOUT_MS })
  const workItems = () =>
    readdirSync(`${work}/Aurora/_octo/fonti/ADO`).filter((name) =>
      /^\d+-[0-9a-f]{8}\.md$/.test(name),
    )
  assert.deepEqual(
    workItems().map((name) => name.split('-')[0]),
    ['101', '102', '103'],
  )
  assert.match(
    readFileSync(`${work}/Aurora/_octo/fonti/ADO/_lettura.md`, 'utf8'),
    /fonte: "Azure DevOps"/,
  )
  ado.options.items.push(extraItem())
  await adoSection.getByRole('button', { name: 'Leggi ora' }).click()
  await assertEventually(() => workItems().length === 4)

  // Demo 05: one button reads everything that is linked.
  await guideStep('Azure DevOps').getByText('fatto').waitFor({ timeout: TIMEOUT_MS })
  await guide.getByRole('button', { name: 'Riempi la memoria ora' }).click()
  await guide.getByText('Fatto. Ora puoi fare domande').waitFor({ timeout: TIMEOUT_MS })
  for (const source of ['Posta', 'Azure DevOps', 'Documenti']) {
    await guide.getByText(new RegExp(`^${source}: \\d+ nuovi o aggiornati`)).waitFor()
  }
  await page.screenshot({ path: `${work}/guida.png`, fullPage: true })
  await page.screenshot({ path: `${work}/fonti.png` })

  // Demo 06: a deliverable from the PM's request to the approved Word file.
  await page.getByRole('tab', { name: 'Deliverable' }).click()
  const work06 = page.getByRole('region', { name: 'Deliverable' })
  await work06.getByRole('button', { name: /Email al cliente/ }).click()
  await work06.getByLabel('A chi scrivi').fill('Carla Bianchi')
  await work06.getByLabel(/^Di che cosa/).fill('Data di consegna')
  await work06.getByLabel(/^Che cosa chiedi/).fill('Conferma della data')
  await work06.getByRole('button', { name: 'Scrivi la bozza' }).click()
  await work06.getByText('1 fonte controllata').waitFor({ timeout: TIMEOUT_MS })
  await work06.getByText('Può uscire: nessun punto contestabile trovato.').waitFor()
  await work06.getByLabel('Che cosa vuoi cambiare?').fill('Aggiungi il budget #inventa')
  await work06.getByRole('button', { name: 'Chiedi modifica' }).click()
  await work06.getByText('Da correggere prima di farlo uscire.').waitFor({ timeout: TIMEOUT_MS })
  await work06.getByText('Il budget non ha una fonte').waitFor()
  await work06.getByText(/2 giri/).waitFor()
  await page.screenshot({ path: `${work}/deliverable.png` })
  await work06.getByRole('button', { name: 'Approva' }).click()
  await work06.getByText('File pronti').waitFor({ timeout: TIMEOUT_MS })
  const approvedFiles = readdirSync(`${work}/Aurora/_octo/deliverable/approvati`).sort()
  assert.equal(approvedFiles.length, 2)
  assert.match(approvedFiles[0], /_email-cliente_data-di-consegna\.docx$/)
  const approvedText = readFileSync(
    `${work}/Aurora/_octo/deliverable/approvati/${approvedFiles[1]}`,
    'utf8',
  )
  assert.match(approvedText, /La consegna è il 12 dicembre\./)
  assert.doesNotMatch(approvedText, /\[\d\]/)

  // An estimate: the writer gives the lines, the code the totals. Then the register.
  await work06.getByRole('button', { name: 'Nuovo deliverable' }).click()
  await work06.getByRole('button', { name: /^Stima/ }).click()
  await work06.getByLabel(/^Che cosa va stimato/).fill('Migrazione ordini')
  await work06.getByRole('button', { name: 'Scrivi la bozza' }).click()
  await work06.getByText(/Totale 9,0 gg/).waitFor({ timeout: TIMEOUT_MS })
  await work06.getByText(/Esclusa dai totali — W-03/).waitFor()
  // The numbers are a real table, not lines of pipes.
  await work06.getByRole('columnheader', { name: 'Fase' }).first().waitFor()
  await page.screenshot({ path: `${work}/stima.png` })
  // A kind the PM describes in words enters the catalog of the project.
  await work06.getByRole('button', { name: 'Nuovo deliverable' }).click()
  await work06.getByRole('button', { name: 'Crea un tipo tuo' }).click()
  await work06.getByLabel('Come si chiama').fill('Nota di rilascio')
  await work06
    .getByLabel(/^Come va scritto/)
    .fill('Scrivi le novità come le legge chi usa il prodotto.')
  await work06.getByRole('button', { name: 'Salva nel catalogo' }).click()
  await work06.getByText(/Per il cliente · Tuo/).waitFor({ timeout: TIMEOUT_MS })
  assert.ok(existsSync(`${work}/Aurora/_octo/.tipi/proprio-nota-di-rilascio.json`))
  await work06.getByRole('button', { name: 'Registro' }).click()
  await work06.getByRole('cell', { name: 'Data di consegna' }).waitFor()
  await work06.getByText(/^Approvati: 1 ·/).waitFor()
  const register = readFileSync(`${work}/Aurora/_octo/deliverable/registro.md`, 'utf8')
  assert.match(register, /\| Email al cliente \| Data di consegna \| approvato \|/)

  // Demo 07: the dashboard is computed from the tracker export found in the project folder.
  await page.getByRole('tab', { name: 'Cruscotto' }).click()
  const setup07 = page.getByRole('region', { name: 'Da dove leggo bug e requisiti' })
  await assert.doesNotReject(setup07.waitFor({ timeout: TIMEOUT_MS }))
  await page.waitForFunction(
    () => document.querySelector('.settings-form input')?.value === 'dati/tracker/export.json',
  )
  await setup07.getByLabel(/^Solo gli elementi con questi tag/).fill('Squadra')
  await setup07.getByRole('button', { name: 'Salva' }).click()
  await page.getByText(/Dati aggiornati/).waitFor({ timeout: TIMEOUT_MS })
  await page.getByText('su 30 bug nel perimetro').waitFor()
  const figure = async (label) =>
    (await page.locator('.figure', { hasText: label }).first().locator('dd').innerText()).split(
      '\n',
    )[0]
  assert.equal(await figure('Bug aperti'), '15')
  assert.equal(await figure('In verifica'), '5')
  assert.equal(await figure('Fermi da oltre 30 giorni'), '11')
  const trendRows = page.locator('.trend tbody tr')
  assert.equal(await trendRows.count(), 8)
  await page.getByRole('button', { name: '12 mesi' }).click()
  await assertEventuallyAsync(async () => (await trendRows.count()) === 12)
  await page.screenshot({ path: `${work}/cruscotto.png` })
  const open07 = page.getByRole('region', { name: 'Bug aperti' })
  await open07.getByRole('button', { name: 'Scrivi una nota' }).first().click()
  await open07.getByRole('textbox').fill('Sentito il cliente: dati entro venerdì')
  await open07.getByRole('button', { name: 'Salva la nota' }).click()
  await open07.getByText(/Nota tua/).waitFor({ timeout: TIMEOUT_MS })
  const requirements07 = page.getByRole('region', { name: 'Requisiti poco chiari' })
  await requirements07.getByText(/ancora da definire con il cliente/).waitFor()
  assert.equal(await requirements07.locator('tbody tr').count(), 4)
  await requirements07.getByRole('button', { name: 'È chiaro' }).last().click()
  await assertEventuallyAsync(async () => (await requirements07.locator('tbody tr').count()) === 3)
  const decisions = JSON.parse(
    readFileSync(`${work}/Aurora/_octo/.impostazioni/dashboard.json`, 'utf8'),
  ).decisions
  assert.equal(decisions.notes.length, 1)
  assert.deepEqual(
    decisions.excludedRequirements.map((entry) => entry.id),
    ['2006'],
  )

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
