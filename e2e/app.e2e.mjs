// Opens the built desktop app on a synthetic project, with the fake model, and follows the steps
// of demo 01 in the real window. Run with `pnpm e2e` after `pnpm build`.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, renameSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { _electron as electron } from 'playwright'
import { DEMO_ADO, extraItem, startDemoAdo } from '../demo/lib/fake-ado.ts'
import { DEMO_JIRA, startDemoJira } from '../demo/lib/fake-jira.ts'
import { readDeckOutline } from '../packages/infrastructure/src/office/deck-model.ts'

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
execFileSync('node', [`${root}demo/lib/fake-hours.ts`, `${work}/Aurora`])

const ado = await startDemoAdo()
const jira = await startDemoJira()

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

const launch = (dataFolder = `${work}/dati`) =>
  electron.launch({
    ...(packaged ? { executablePath: packaged, args: [] } : { args: [`${root}apps/desktop`] }),
    env: {
      ...process.env,
      OCTO_DATA_DIR: dataFolder,
      OCTO_CLAUDE_PATH: `${root}demo/lib/fake-claude`,
      OCTO_MAIL_ROOT: `${work}/Mail`,
      OCTO_DEV_ADO_URL: ado.server.origin,
      OCTO_DEV_JIRA_URL: jira.server.origin,
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
  // The list of the projects opens from the name of the one in use.
  const openProjects = () => page.locator('.switcher-button').click()
  const manageProjects = async () => {
    await openProjects()
    await page.getByRole('menuitem', { name: 'Gestisci i progetti…' }).click()
  }

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
  // The code points at the amount by itself: the text goes to the client.
  await work06
    .getByRole('region', { name: 'Cifre da controllare prima che esca' })
    .getByText('99.000 euro', { exact: true })
    .waitFor()
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

  // Demo 08: timesheet hours against tracker hours, from the exports in the project folder.
  await page.getByRole('tab', { name: 'Ore' }).click()
  const setup08 = page.getByRole('region', { name: 'Da dove leggo le ore' })
  await setup08.waitFor({ timeout: TIMEOUT_MS })
  await page.waitForFunction(
    () => document.querySelector('.settings-form input')?.value === 'dati/Timesheets',
  )
  await setup08.getByLabel(/^Codici di progetto/).fill('PRJ000101')
  await setup08.getByRole('button', { name: 'Salva' }).click()
  await page.getByText('Quadratura: 664 ore approvate, tutte nel confronto').waitFor({
    timeout: TIMEOUT_MS,
  })
  const hoursRow = (person) => page.locator('table.data tbody tr', { hasText: person })
  await hoursRow('Bianchi Anna').getByText('Da guardare').waitFor()
  await page.getByText('16 ore di timesheet non ancora approvate').waitFor()
  await page.getByText(/8 ore sul codice PRJ000999/).waitFor()
  await page.getByRole('button', { name: 'È atteso: Neri Sara' }).click()
  await hoursRow('Neri Sara').getByText('Atteso').waitFor({ timeout: TIMEOUT_MS })
  await page.getByText('Impostazioni delle ore').click()
  await page.getByLabel(/^Stessa persona, nomi diversi/).fill('E. Costa = Costa Elena')
  await page.locator('.dashboard-settings').getByRole('button', { name: 'Salva' }).click()
  await hoursRow('Costa Elena').getByText('Torna').waitFor({ timeout: TIMEOUT_MS })
  assert.equal(await hoursRow('E. Costa').count(), 0)
  await page.screenshot({ path: `${work}/ore.png` })
  // The same hours read from Jira itself, with the token of its feed.
  await page.getByRole('tab', { name: 'Fonti' }).click()
  const jiraSection = page.getByRole('region', { name: 'Jira', exact: true })
  await jiraSection.getByLabel(/^Sito/).fill(DEMO_JIRA.site)
  await jiraSection.getByLabel('La tua email su Jira').fill(DEMO_JIRA.email)
  await jiraSection.getByLabel(/^API token/).fill(DEMO_JIRA.token)
  await jiraSection.getByLabel(/^Progetti/).fill(DEMO_JIRA.key)
  await jiraSection.getByRole('button', { name: 'Prova e salva' }).click()
  await jiraSection.getByText('Collegamento riuscito e salvato.').waitFor({ timeout: TIMEOUT_MS })
  await page.getByRole('tab', { name: 'Ore' }).click()
  await page.getByText('Quadratura: 664 ore approvate, tutte nel confronto').waitFor({
    timeout: TIMEOUT_MS,
  })
  // Without the NetSuite source the timesheets cannot be read from it, and the app says why.
  await page.getByRole('button', { name: 'Leggi i timesheet da NetSuite' }).click()
  await page
    .getByText(/^NetSuite non è collegato a questo progetto/)
    .waitFor({ timeout: TIMEOUT_MS })
  await page.getByRole('button', { name: 'Leggi le ore da Jira' }).click()
  await page.getByText(/^Lette 100 registrazioni di ore/).waitFor({ timeout: TIMEOUT_MS })
  const fromJira = readdirSync(`${work}/Aurora/_octo/ore/jira`)
  assert.equal(fromJira.length, 1)
  assert.match(fromJira[0], /^worklog_\d{4}-\d{2}\.csv$/)
  await page.locator('table.data tfoot').getByText('630').waitFor({ timeout: TIMEOUT_MS })
  await hoursRow('Costa Elena').getByText('Torna').waitFor()
  assert.ok(!jira.server.received.some((request) => request.method !== 'GET'))

  // Demo 09: the monthly forecast filled on the spreadsheet of the administration.
  execFileSync('node', [`${root}demo/lib/fake-forecast.ts`, `${work}/Aurora`])
  const modelFile = `${work}/Aurora/Amministrazione/Previsionale avanzamenti.xlsx`
  const modelBefore = readFileSync(modelFile)
  await page.getByRole('tab', { name: 'Previsionale' }).click()
  const setup09 = page.getByRole('region', { name: 'Il modello dell’amministrazione' })
  await setup09.waitFor({ timeout: TIMEOUT_MS })
  await page.waitForFunction(
    () =>
      document.querySelector('.settings-form input')?.value ===
      'Amministrazione/Previsionale avanzamenti.xlsx',
  )
  await setup09.getByRole('button', { name: 'Salva' }).click()
  const forecastRow = (code) => page.locator('table.data tbody tr', { hasText: code })
  // The costs come from the rows of the timesheets: nobody typed them.
  await forecastRow('PRJ000101').getByText('16.010,00').waitFor({ timeout: TIMEOUT_MS })
  await forecastRow('PRJ000101').getByText('27.200,00').waitFor()
  await forecastRow('PRJ000303').getByText('nessuna attività nel mese').waitFor()
  await page.getByText(/manca la tariffa al giorno di Costa Elena \(120 ore/).waitFor()
  await page.getByText(/^16 ore del mese non ancora approvate/).waitFor()
  await page.getByText(/codici che il modello non elenca: PRJ000999/).waitFor()
  await page.getByText('Impostazioni del previsionale').click()
  const rates = page.getByLabel(/^Tariffe al giorno/)
  await rates.fill(`${await rates.inputValue()}\nCosta Elena; 400`)
  await page.getByLabel(/^Esterni senza timesheet/).fill('Studio Blu; PRJ000202; 300; 500')
  await page.locator('.dashboard-settings').getByRole('button', { name: 'Salva' }).click()
  await forecastRow('PRJ000101').getByText('33.200,00').waitFor({ timeout: TIMEOUT_MS })
  await forecastRow('PRJ000101').getByText('51,78%').waitFor()
  await page.getByText('Dati del mese per PRJ000202').click()
  const inputs202 = page.getByRole('form', { name: 'Dati del mese per PRJ000202' })
  await inputs202.getByLabel(/^Ore degli esterni nel mese/).fill('Studio Blu; 40')
  await inputs202.getByLabel(/^A corpo/).fill('20000')
  await inputs202.getByRole('button', { name: 'Salva i dati del mese' }).click()
  await forecastRow('PRJ000202').getByText('7,5%', { exact: true }).waitFor({ timeout: TIMEOUT_MS })
  await forecastRow('PRJ000202').getByText('3.000,00').waitFor()
  await page.getByRole('button', { name: 'Compila il modello' }).click()
  await page
    .getByText(/^Modello compilato in _octo\/previsionale\//)
    .waitFor({ timeout: TIMEOUT_MS })
  const compiledFolder = `${work}/Aurora/_octo/previsionale`
  const [compiledMonth] = readdirSync(compiledFolder)
  const compiled = readFileSync(`${compiledFolder}/${compiledMonth}/Previsionale avanzamenti.xlsx`)
  assert.ok(compiled.length > 0 && !compiled.equals(modelBefore))
  assert.ok(readFileSync(modelFile).equals(modelBefore))
  await page.screenshot({ path: `${work}/previsionale.png` })

  // Demo 10: progress requests on the form of the client.
  execFileSync('node', [`${root}demo/lib/fake-progress.ts`, `${work}/Aurora`])
  const formFile = `${work}/Aurora/Moduli/Richiesta stato avanzamento.xlsx`
  const formBefore = readFileSync(formFile)
  await page.getByRole('tab', { name: 'Avanzamento' }).click()
  // The form of the client and the map of its cells were set once: only the order is to type.
  const setup10 = page.getByRole('form', { name: 'Impostazioni dell’ordine e del modulo' })
  await setup10.waitFor({ timeout: TIMEOUT_MS })
  await setup10.getByLabel(/^Numero dell’ordine/).fill('ORD-2026-077')
  await setup10.getByLabel(/^Totale dell’ordine/).fill('340.000')
  const positions10 = [
    ['00001', '100.000'],
    ['00002', '60.000'],
    ['00003', '142.000'],
    ['00004', '38.000'],
  ]
  for (const [index, [code, amount]] of positions10.entries()) {
    if (index > 0) await setup10.getByRole('button', { name: 'Aggiungi una posizione' }).click()
    await setup10.getByLabel(`Codice della posizione ${index + 1}`).fill(code)
    await setup10.getByLabel(`Importo della posizione ${index + 1}`).fill(amount)
  }
  await setup10.getByText('Le posizioni sommano 340.000,00.').waitFor()
  await setup10.getByRole('button', { name: 'Salva', exact: true }).click()
  const newRequest10 = async (n) => {
    await page.getByRole('button', { name: 'Nuova richiesta' }).click()
    return page.getByRole('form', { name: `Nuova richiesta (la numero ${n})` })
  }
  const request10 = (n) => page.getByRole('region', { name: `Richiesta ${n}`, exact: true })
  const first10 = await newRequest10(1)
  await first10.getByLabel('Dal', { exact: true }).fill('2026-03-01')
  await first10.getByLabel('Al', { exact: true }).fill('2026-03-31')
  await first10.getByLabel('Importo della richiesta').fill('289.540')
  await first10.getByLabel('Fattura di riferimento').fill('Fattura n. 101 del 31/03/2026')
  // The shares are shown while the request is typed, before anything is saved.
  await first10.getByText('91,23%').first().waitFor({ timeout: TIMEOUT_MS })
  await page.screenshot({ path: `${work}/avanzamento-richiesta.png` })
  await first10.getByRole('button', { name: 'Salva e compila il modulo' }).click()
  await page
    .getByText(/^Modulo compilato in _octo\/avanzamento\/Richiesta stato avanzamento - 1\.xlsx/)
    .waitFor({ timeout: TIMEOUT_MS })
  const second10 = await newRequest10(2)
  assert.equal(await second10.getByLabel('Dal', { exact: true }).inputValue(), '2026-03-31')
  await second10.getByLabel('Al', { exact: true }).fill('2026-04-30')
  await second10.getByRole('button', { name: 'Tutto ciò che resta: 50.460,00' }).click()
  await second10.getByLabel('Fattura di riferimento').fill('Fattura da emettere il 30/04/2026')
  await second10.getByText(/^Raggiunge il totale dell’ordine/).waitFor()
  await second10.getByRole('button', { name: 'Salva senza compilare' }).click()
  await request10(2)
    .getByText(/^Raggiunge il totale dell’ordine/)
    .waitFor({ timeout: TIMEOUT_MS })
  await request10(2).getByText('8,77%').waitFor()
  const filledForm = readFileSync(
    `${work}/Aurora/_octo/avanzamento/Richiesta stato avanzamento - 1.xlsx`,
  )
  assert.ok(filledForm.length > 0 && !filledForm.equals(formBefore))
  assert.ok(readFileSync(formFile).equals(formBefore))
  await page.screenshot({ path: `${work}/avanzamento.png` })

  // Demo 11: an approved status report as slides on the deck of the PM.
  execFileSync('node', [`${root}demo/lib/fake-deck.ts`, `${work}/Aurora`, 'chosen'])
  await page.getByRole('tab', { name: 'Deliverable' }).click()
  const work11 = page.getByRole('region', { name: 'Deliverable' })
  await work11.getByRole('button', { name: 'Nuovo deliverable' }).click()
  await work11
    .getByText('Impostato: lo stato di avanzamento approvato esce anche come presentazione.')
    .waitFor({ timeout: TIMEOUT_MS })
  await work11.getByRole('button', { name: /Stato di avanzamento/ }).click()
  await work11.getByLabel(/^Periodo/).fill('Sprint 28')
  await work11.getByRole('button', { name: 'Scrivi la bozza' }).click()
  await work11.getByText('1 fonte controllata').waitFor({ timeout: TIMEOUT_MS })
  // The draft is the slides of the model, updated: what the PM reviews is slide by slide.
  await work11
    .getByRole('heading', { name: 'Slide 2 — Aurora - Avanzamento — PI7' })
    .waitFor({ timeout: TIMEOUT_MS })
  await work11
    .getByText(/Slide 3 del modello|Rischi del periodo: nessuna fonte/)
    .first()
    .waitFor()
  await page.screenshot({ path: `${work}/presentazione-bozza.png` })
  await work11.getByRole('button', { name: 'Approva', exact: true }).click()
  await assertEventually(() =>
    readdirSync(`${work}/Aurora/_octo/deliverable/approvati`).some((name) =>
      /stato-avanzamento.*\.pptx$/.test(name),
    ),
  )
  const approved11 = `${work}/Aurora/_octo/deliverable/approvati`
  const deck11 = readDeckOutline(
    new Uint8Array(
      readFileSync(
        `${approved11}/${readdirSync(approved11).find((name) => /stato-avanzamento.*\.pptx$/.test(name))}`,
      ),
    ),
  )
  // The same slides as the model, less the one the period has nothing for; no source marker left.
  assert.equal(deck11.slides.length, 3)
  assert.equal(deck11.slides[1].texts[0].text, 'Aurora - Avanzamento — PI7')
  assert.deepEqual(deck11.slides[1].tables[0].sample, [
    ['Modulo ordini: consegna fissata al 12 dicembre 2026', 'In corso', ''],
  ])
  assert.equal(deck11.slides[2].texts[0].text, 'GRAZIE')
  await page.screenshot({ path: `${work}/presentazione.png` })

  // Demo 12: the six kinds of text added to the catalog.
  await work11.getByRole('button', { name: 'Nuovo deliverable' }).click()
  for (const kind of [
    'Analisi funzionale da riunione',
    'Voce di backlog',
    'Modifiche da applicare al tracker',
    'Scenari di test',
    'Technical proposal',
  ]) {
    await work11.getByRole('button', { name: new RegExp(`^${kind}`) }).waitFor()
  }
  await work11.getByRole('button', { name: /^Note di rilascio/ }).click()
  await work11.getByLabel(/^Quale rilascio/).fill('2.4 di novembre')
  await work11.getByRole('button', { name: 'Scrivi la bozza' }).click()
  await work11.getByText('Problemi noti').waitFor({ timeout: TIMEOUT_MS })
  await work11.getByText('Elenco delle voci chiuse per questo rilascio').waitFor()
  await work11
    .getByText('Nessun dato interno (giornate, costi, tariffe, codici commessa)')
    .waitFor()
  await page.screenshot({ path: `${work}/tipi-di-testo.png` })

  // Demo 13: the client's tracker against the supplier's tickets, sprint by sprint.
  execFileSync('node', [`${root}demo/lib/fake-alignment.ts`, `${work}/Aurora`])
  await page.getByRole('tab', { name: 'Allineamento' }).click()
  const setup13 = page.getByRole('region', { name: 'Che cosa confronto' })
  await setup13.waitFor({ timeout: TIMEOUT_MS })
  await setup13.getByLabel(/^Sprint, come/).fill('Sprint 28')
  await setup13.getByLabel(/^Tag delle voci/).fill('Squadra')
  await setup13.getByRole('button', { name: 'Salva' }).click()
  await page
    .getByText(
      '6 voci del cliente nello sprint: 3 con il ticket nello sprint, 1 con il ticket altrove, 2 senza ticket.',
    )
    .waitFor({ timeout: TIMEOUT_MS })
  await page.getByText('Quadratura: ogni voce è in una sola delle tre liste.').waitFor()
  const list13 = (name) => page.getByRole('region', { name, exact: true })
  await list13('Ticket da spostare nello sprint').getByText('Sprint 27', { exact: true }).waitFor()
  await list13('Voci con più di un ticket').getByText('AUR-4, AUR-5').waitFor()
  await list13('Ticket che nominano una voce che non c’è')
    .getByText('999', { exact: true })
    .waitFor()
  await list13('Forse sono la stessa cosa')
    .getByText(/^AUR-6 · /)
    .waitFor()
  await page.getByText('Che cosa confronto').click()
  await page
    .getByLabel(/^Stati che vogliono dire/)
    .fill(
      'da fare: New = Da completare\nin corso: In Progress = In corso\nchiuso: Closed = Completata',
    )
  await page.locator('.dashboard-settings').getByRole('button', { name: 'Salva' }).click()
  await list13('Collegate').getByText('Diversi', { exact: true }).waitFor({ timeout: TIMEOUT_MS })
  await page.getByRole('button', { name: 'Scrivi il file di import dei ticket mancanti' }).click()
  await page
    .getByText(/^Scritto _octo\/allineamento\/mancanti_sprint-28\.csv con 2 ticket/)
    .waitFor({
      timeout: TIMEOUT_MS,
    })
  const importFile = readFileSync(
    `${work}/Aurora/_octo/allineamento/mancanti_sprint-28.csv`,
    'utf8',
  )
  assert.match(importFile, /\[AZDO 105\] Ricerca ordini per cliente,Story,,Mario Rossi,,Sprint 28/)
  assert.match(importFile, /Il listino arriva in Excel\.\nUna riga per articolo/)
  await page.screenshot({ path: `${work}/allineamento.png` })

  // Demo 14: people and calendar of the project, and their effect on the hours.
  await page.getByRole('tab', { name: 'Fonti' }).click()
  const team14 = page.getByRole('region', { name: 'Persone e calendario' })
  await team14
    .getByLabel(/^Persone:/)
    .fill(
      'Neri Sara; analista; nostra; ; 31/01/2026\nCarla Bianchi; referente; cliente; ; ; dare del lei, prima la richiesta',
    )
  await team14.getByLabel(/^Calendario:/).fill('Sprint 28; 26/10/2026; 13/11/2026')
  await team14.getByRole('button', { name: 'Salva persone e calendario' }).click()
  await team14.getByText('Salvate 2 persone e 1 periodi.').waitFor({ timeout: TIMEOUT_MS })
  const teamText = readFileSync(`${work}/Aurora/_octo/progetto/persone-e-calendario.md`, 'utf8')
  assert.match(teamText, /\*\*Carla Bianchi\*\*, referente/)
  assert.match(teamText, /\| Sprint 28 \| 26\/10\/2026 \| 13\/11\/2026 \|/)
  assert.equal(
    JSON.parse(readFileSync(`${work}/Aurora/_octo/.impostazioni/team.json`, 'utf8')).people[0].to,
    '2026-01-31',
  )

  await page.getByRole('tab', { name: 'Chiedi' }).click()
  // A ready question fills the composer and waits for the PM.
  await page
    .getByRole('group', { name: 'Domande pronte' })
    .getByRole('button', { name: 'Blocchi e rischi' })
    .click()
  assert.match(
    await page.getByLabel('Chiedi qualcosa su questo progetto…').inputValue(),
    /^Quali sono oggi i blocchi e i rischi aperti/,
  )

  // The history survives a restart of the app.
  await app.close()
  app = await launch()
  page = await app.firstWindow()
  await page.getByText('1 punto da controllare').waitFor({ timeout: TIMEOUT_MS })

  // Demo 17: the model that answers is chosen for the project and written beside the answer.
  await page.getByText('modello claude-fake-default').first().waitFor({ timeout: TIMEOUT_MS })
  await page.getByRole('tab', { name: 'Fonti' }).click()
  const models17 = page.getByRole('region', { name: 'Modelli' })
  await models17.getByLabel('Risposte in «Chiedi»').selectOption('sonnet')
  await models17.getByRole('button', { name: 'Salva i modelli' }).click()
  await models17.getByText(/^Modelli salvati/).waitFor({ timeout: TIMEOUT_MS })
  assert.deepEqual(
    JSON.parse(readFileSync(`${work}/Aurora/_octo/.impostazioni/models.json`, 'utf8')),
    { ask: 'sonnet', write: null, review: null },
  )
  await page.getByRole('tab', { name: 'Chiedi' }).click()
  await ask('Quando consegniamo il modulo ordini?')
  await page.getByText('modello claude-sonnet-fake').waitFor({ timeout: TIMEOUT_MS })

  // Demo 16: the dashboard from Azure DevOps as it is now, read with the token of the source.
  await page.getByRole('tab', { name: 'Cruscotto' }).click()
  await page.locator('.dashboard-settings summary').click()
  await page.getByRole('button', { name: 'Leggi da Azure DevOps' }).click()
  await page.getByText(/Letti \d work item, 1 con la cronologia/).waitFor({ timeout: TIMEOUT_MS })
  await page.getByText('su 1 bug nel perimetro').waitFor({ timeout: TIMEOUT_MS })
  await page.getByText(/Dati aggiornati/).waitFor({ timeout: TIMEOUT_MS })
  await page.getByText('in attesa del test del cliente').waitFor({ timeout: TIMEOUT_MS })
  const snapshot16 = JSON.parse(
    readFileSync(`${work}/Aurora/_octo/cruscotto/azure-devops.json`, 'utf8'),
  )
  assert.equal(snapshot16.items.find((entry) => entry.id === 103).state, 'Ready for Test')
  const history16 = JSON.parse(
    readFileSync(`${work}/Aurora/_octo/cruscotto/azure-devops-cronologia.json`, 'utf8'),
  )
  assert.deepEqual(
    history16.bugs['103'].states.map(([, state]) => state),
    ['New', 'Active', 'Ready for Test'],
  )
  assert.equal(
    JSON.parse(readFileSync(`${work}/Aurora/_octo/.impostazioni/dashboard.json`, 'utf8'))
      .exportPath,
    '_octo/cruscotto/azure-devops.json',
  )
  // The same reading in numbers, as a text a report can cite.
  const summary16 = readFileSync(`${work}/Aurora/_octo/cruscotto/riepilogo.md`, 'utf8')
  assert.match(summary16, /- Perimetro: elementi con tag Squadra/)
  assert.match(summary16, /- Bug aperti: 1/)
  await page.screenshot({ path: `${work}/cruscotto-da-ado.png` })
  await page.getByRole('tab', { name: 'Chiedi' }).click()

  // Demo 15: a backup on this computer, restored on a new one where the folder is elsewhere.
  // The dialogs are the system's: here they answer by themselves.
  const backupFile = `${work}/chiavetta/octo-copia.json`
  await app.evaluate(({ dialog }, filePath) => {
    dialog.showSaveDialog = async () => ({ canceled: false, filePath })
  }, backupFile)
  await manageProjects()
  await page.getByRole('button', { name: 'Copia di sicurezza' }).click()
  await page.getByText(/1 progetto\. Le credenziali non ci sono/).waitFor({ timeout: TIMEOUT_MS })
  const backupText = readFileSync(backupFile, 'utf8')
  assert.equal(JSON.parse(backupText).projects[0].project.name, 'Aurora')
  assert.ok(JSON.parse(backupText).projects[0].sources.mail.cursor)
  assert.doesNotMatch(backupText, new RegExp(`${DEMO_JIRA.token}|${DEMO_ADO.pat}`))
  await app.close()

  const movedFolder = `${work}/Aurora sul nuovo computer`
  renameSync(`${work}/Aurora`, movedFolder)
  app = await launch(`${work}/dati-nuovo`)
  page = await app.firstWindow()
  await page.getByRole('heading', { name: 'Nessun progetto' }).waitFor({ timeout: TIMEOUT_MS })
  await app.evaluate(
    ({ dialog }, { file, folder }) => {
      dialog.showOpenDialog = async (_window, options) => ({
        canceled: false,
        filePaths: [options.properties.includes('openDirectory') ? folder : file],
      })
    },
    { file: backupFile, folder: movedFolder },
  )
  await manageProjects()
  await page.getByRole('button', { name: 'Ripristina' }).click()
  await page.getByText('Ripristinati: Aurora.').waitFor({ timeout: TIMEOUT_MS })
  await page.getByText(/Rimetti le credenziali/).waitFor({ timeout: TIMEOUT_MS })
  await page.getByRole('heading', { name: 'Aurora' }).waitFor({ timeout: TIMEOUT_MS })
  // The questions came with the folder, the readings with the backup.
  await page.getByText('1 punto da controllare').waitFor({ timeout: TIMEOUT_MS })
  const readings = (dataFolder) =>
    JSON.parse(readFileSync(`${work}/${dataFolder}/feeds/demo-aurora/ado.json`, 'utf8'))
  assert.deepEqual(readings('dati-nuovo'), readings('dati'))
  assert.equal(
    JSON.parse(readFileSync(`${work}/dati-nuovo/projects.json`, 'utf8'))[0].folder,
    movedFolder,
  )
  await page.screenshot({ path: `${work}/ripristino.png` })

  // Demo 18: a project leaves the list only after a confirmation and comes back as it was.
  await page.getByRole('button', { name: 'Chiudi' }).click()
  await page.getByText('Ripristinati: Aurora.').waitFor({ state: 'detached' })
  const listed = (file) => JSON.parse(readFileSync(`${work}/dati-nuovo/${file}`, 'utf8'))
  const mailState = () => readFileSync(`${work}/dati-nuovo/sources/demo-aurora.json`, 'utf8')
  const readingsBefore = mailState()
  const takeOff = async () => {
    await manageProjects()
    await page.getByRole('button', { name: 'Togli Aurora da Octo' }).click()
    const confirm = page.getByRole('dialog', { name: 'Togliere «Aurora» da Octo?' })
    await confirm
      .getByText(/credenziali e il punto a cui sono arrivate le letture restano/)
      .waitFor()
    return confirm
  }
  let confirm18 = await takeOff()
  await confirm18.getByRole('button', { name: 'Annulla' }).click()
  assert.equal(listed('projects.json').length, 1)
  await page
    .getByRole('dialog', { name: 'I tuoi progetti' })
    .getByRole('button', { name: 'Chiudi' })
    .first()
    .click()
  confirm18 = await takeOff()
  await page.screenshot({ path: `${work}/progetti-conferma.png` })
  await confirm18.getByRole('button', { name: 'Togli', exact: true }).click()
  await page.getByText('«Aurora» non è più in elenco.').waitFor({ timeout: TIMEOUT_MS })
  await page.getByRole('heading', { name: 'Nessun progetto' }).waitFor({ timeout: TIMEOUT_MS })
  assert.deepEqual(listed('projects.json'), [])
  assert.equal(listed('projects-set-aside.json')[0].id, 'demo-aurora')
  await page.getByRole('button', { name: 'Rimettilo in elenco' }).click()
  await page.getByRole('heading', { name: 'Aurora' }).waitFor({ timeout: TIMEOUT_MS })
  assert.equal(mailState(), readingsBefore)
  assert.deepEqual(listed('projects-set-aside.json'), [])

  // Taken off again, it comes back from its folder as the same project.
  confirm18 = await takeOff()
  await confirm18.getByRole('button', { name: 'Togli', exact: true }).click()
  await page.getByText('«Aurora» non è più in elenco.').waitFor({ timeout: TIMEOUT_MS })
  await openProjects()
  await page.screenshot({ path: `${work}/progetti-elenco.png` })
  await page.getByRole('menuitem', { name: 'Aggiungi un progetto…' }).click()
  await page.screenshot({ path: `${work}/progetti-aggiungi.png` })
  await page.getByRole('button', { name: 'Scegli la cartella…' }).click()
  await page.getByRole('heading', { name: 'Aurora' }).waitFor({ timeout: TIMEOUT_MS })
  assert.equal(listed('projects.json')[0].id, 'demo-aurora')
  assert.equal(mailState(), readingsBefore)
  await page
    .getByRole('region', { name: 'Posta' })
    .getByText(/^Ultima lettura/)
    .waitFor()
  await openProjects()
  await page.screenshot({ path: `${work}/progetti.png` })
  await page.keyboard.press('Escape')

  // Demo 20: a line that is not understood is told under its field, and nothing is saved.
  const team20 = page.getByRole('region', { name: 'Persone e calendario' })
  const teamFile = () => readFileSync(`${movedFolder}/_octo/.impostazioni/team.json`, 'utf8')
  const teamBefore = teamFile()
  await team20.getByLabel(/^Persone:/).fill('Mario Rossi; sviluppatore; boh')
  await team20.getByLabel(/^Calendario:/).fill('Sprint 1; ieri; domani')
  await team20.getByRole('button', { name: 'Salva persone e calendario' }).click()
  await team20
    .getByText('Riga 1, «Mario Rossi; sviluppatore; boh»: la parte è «nostra» oppure «cliente».')
    .waitFor({ timeout: TIMEOUT_MS })
  await team20.getByText(/Riga 1, «Sprint 1; ieri; domani»: c’è una data che non esiste/).waitFor()
  await team20.getByText(/^Non ho salvato/).waitFor()
  assert.equal(teamFile(), teamBefore)
  await team20.getByRole('button', { name: 'Salva persone e calendario' }).scrollIntoViewIfNeeded()
  await page.screenshot({ path: `${work}/righe.png` })

  await page.getByRole('tab', { name: 'Avanzamento' }).click()
  await page.getByRole('button', { name: 'Impostazioni', exact: true }).click()
  const setup20 = page.getByRole('form', { name: 'Impostazioni dell’ordine e del modulo' })
  await setup20.getByLabel('Importo della posizione 2').fill('mille')
  await setup20.getByLabel('Cella della riga 1').fill('Numero')
  await setup20.getByRole('button', { name: 'Salva', exact: true }).click()
  await setup20.getByText(/^Posizione 2: servono un codice e un importo/).waitFor()
  await setup20.getByText(/^Riga 1: una cella si scrive con lettere e numero/).waitFor()
  await page.screenshot({ path: `${work}/righe-avanzamento.png` })
  await setup20.getByRole('button', { name: 'Chiudi' }).click()
  // The shares shown are still those of the order as it was saved.
  await page.getByRole('region', { name: 'Richiesta 2' }).getByText('00004').waitFor()

  // A reading asked from a system that is not linked names it and leads to the sources.
  await page.getByRole('tab', { name: 'Ore' }).click()
  await page.getByRole('button', { name: 'Leggi i timesheet da NetSuite' }).click()
  await page
    .getByText(/^NetSuite non è collegato a questo progetto/)
    .waitFor({ timeout: TIMEOUT_MS })
  await page.getByRole('button', { name: 'Apri «Fonti»' }).click()
  await page.getByRole('region', { name: 'Avvio del progetto' }).waitFor({ timeout: TIMEOUT_MS })
  console.log('e2e: ok')
} finally {
  await app.close()
  ado.server.close()
  jira.server.close()
}
