// Opens the built desktop app on a synthetic project, with the fake model, and follows the steps
// of demo 01 in the real window. Run with `pnpm e2e` after `pnpm build`.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, renameSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { _electron as electron } from 'playwright'
import { DEMO_ADO, extraItem, startDemoAdo } from '../demo/lib/fake-ado.ts'
import { DEMO_CONFLUENCE, startDemoConfluence } from '../demo/lib/fake-confluence.ts'
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
const confluence = await startDemoConfluence()

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
      OCTO_DEV_CONFLUENCE_URL: confluence.server.origin,
      OCTO_DEMO_PLAIN_SECRETS: '1',
      // A person already signed in: the sign-in itself is shown by its own demo.
      OCTO_DEMO_IDENTITY: 'Paola Verdi <pm@example.test>',
    },
  })

let app = await launch()
try {
  let page = await app.firstWindow()
  /**
   * «Chiedi» opens on a new conversation: this opens, among those already had, the one that
   * shows the text given.
   */
  const openChatWith = async (text) => {
    const chats = page.getByRole('navigation', { name: 'Conversazioni' }).locator('.ask-chat')
    await chats.first().waitFor({ timeout: TIMEOUT_MS })
    for (let at = 0; at < (await chats.count()); at += 1) {
      await chats.nth(at).click()
      if ((await page.getByText(text).count()) > 0) return
    }
    assert.fail(`no conversation shows «${text}»`)
  }
  const ask = async (question) => {
    await page.getByPlaceholder('Chiedi qualcosa su questo progetto…').fill(question)
    await page.getByRole('button', { name: 'Chiedi', exact: true }).click()
  }

  await page.getByRole('heading', { name: 'Aurora' }).waitFor({ timeout: TIMEOUT_MS })
  await page.getByText('Claude 9.9.9 (Fake Claude)').waitFor({ timeout: TIMEOUT_MS })
  // Demo 21: the sections are in the sidebar, grouped, and the arrows move among them.
  const nav21 = (group) => page.getByRole('tablist', { name: group }).getByRole('tab')
  assert.deepEqual(await nav21('Lavoro').allInnerTexts(), ['Chiedi', 'Deliverable', 'Cruscotto'])
  // «Ore» and «Previsionale» are parts of «Commessa», the summary of the money of the project.
  assert.deepEqual(await nav21('Ogni mese').allInnerTexts(), ['Commessa'])
  // A source is read from its row when closed, from its form when open (demo 56).
  const READ_NOW = /^(Leggi ora|Leggi con le impostazioni salvate)$/
  const openSheetPart = async (name) => {
    await page.getByRole('tab', { name: 'Commessa', exact: true }).click()
    await page
      .getByRole('tablist', { name: 'Schede della commessa' })
      .getByRole('tab', { name, exact: true })
      .click()
  }
  assert.deepEqual(await nav21('Progetto').allInnerTexts(), ['Impostazioni'])
  // Demo 23: Octo opens on the page of the day, the first section, for who is signed in.
  assert.deepEqual(await nav21('Ogni giorno').allInnerTexts(), ['Oggi'])
  await page.getByRole('region', { name: 'Oggi' }).waitFor({ timeout: TIMEOUT_MS })
  await page.getByText('Sei Paola Verdi').waitFor()
  await page.getByRole('tab', { name: 'Oggi' }).focus()
  await page.keyboard.press('ArrowUp')
  await page.getByRole('region', { name: 'Avvio del progetto' }).waitFor({ timeout: TIMEOUT_MS })
  await page.keyboard.press('ArrowDown')
  await page.getByRole('region', { name: 'Oggi' }).waitFor({ timeout: TIMEOUT_MS })
  await page.getByRole('tab', { name: 'Chiedi' }).click()
  await page.getByPlaceholder('Chiedi qualcosa su questo progetto…').waitFor()
  // The list of the projects opens from the name of the one in use.
  const openProjects = () => page.locator('.switcher-button').click()
  const manageProjects = async () => {
    await openProjects()
    await page.getByRole('menuitem', { name: 'Gestisci i progetti…' }).click()
  }

  await ask('Quando consegniamo il modulo ordini?')
  await page.getByText('1 citazione riscontrata nel file').waitFor({ timeout: TIMEOUT_MS })
  // Demo 24: the source of the citation is beside the answer, with what the check found.
  const source24 = page.getByRole('complementary', { name: 'Fonte citata' })
  await source24.getByText('Frase riscontrata nel file', { exact: true }).waitFor()
  await source24.getByText('«', { exact: false }).first().waitFor()
  assert.equal(
    await page.getByRole('button', { name: 'Fonte 1', exact: true }).getAttribute('aria-pressed'),
    'true',
  )

  await ask('E il budget? #inventa')
  await page.getByText('1 punto da controllare').waitFor({ timeout: TIMEOUT_MS })
  await page.getByText('La frase non è nel file').waitFor({ timeout: TIMEOUT_MS })
  await page.screenshot({ path: `${work}/chiedi.png` })
  // Demo 24: an answer starts a deliverable, and its question and sources go with it.
  await page
    .getByRole('button', { name: 'Prepara un deliverable da questa risposta' })
    .first()
    .click()
  const context24 = page.getByRole('region', { name: 'Contesto dalla risposta' })
  await context24.getByText('Dalla domanda: «Quando consegniamo il modulo ordini?»').waitFor()
  await page.getByRole('button', { name: /Email al cliente/ }).click()
  await page.waitForFunction(() =>
    [...document.querySelectorAll('.deliverables textarea')].some((field) =>
      field.value.startsWith('Domanda: Quando consegniamo il modulo ordini?'),
    ),
  )
  await context24.getByRole('button', { name: 'Togli il contesto' }).click()
  await context24.waitFor({ state: 'detached' })

  // Demo 02: the mail of the project enters its folder, once.
  await page.getByRole('tab', { name: 'Impostazioni' }).click()
  // Demo 05: the guide shows what is still to link, and the mail starts from the project's name.
  const guide = page.getByRole('region', { name: 'Avvio del progetto' })
  await guide.getByText(/^Niente è ancora collegato/).waitFor({ timeout: TIMEOUT_MS })
  // Every source is one row with its state: it opens to be linked.
  const openSource = (action, source) =>
    page.getByRole('button', { name: `${action}: ${source}`, exact: true }).click()
  const mail = page.getByRole('region', { name: 'Posta' })
  await mail.getByText('La posta di questo progetto non è ancora configurata.').waitFor()
  await openSource('Collega', 'Posta')
  assert.equal(await mail.getByLabel('Parole chiave').inputValue(), 'Aurora')
  await mail.getByRole('button', { name: 'Anteprima' }).click()
  await mail.getByText('3 mail entrerebbero con queste regole.').waitFor({ timeout: TIMEOUT_MS })
  await mail.getByText('[FIRING] Aurora - disco pieno').waitFor({ timeout: TIMEOUT_MS })
  await mail.getByText('La posta di questo progetto non è ancora configurata.').waitFor()
  await mail.getByLabel('Parole chiave').fill('Aurora')
  await mail.getByLabel('Mittenti da escludere').fill('avvisi@monitor.example')
  await mail.getByRole('button', { name: 'Salva', exact: true }).click()
  await mail.getByText('Mai letta.').waitFor({ timeout: TIMEOUT_MS })
  await guide.getByText(/^1 su 6 collegati/).waitFor({ timeout: TIMEOUT_MS })
  await mail.getByRole('button', { name: READ_NOW }).click()
  // The periodic reading may have run just before the click: either way two mails are there.
  await mail.getByText(/(2 nuove, 0|0 nuove, 2) già presenti/).waitFor({ timeout: TIMEOUT_MS })
  const month = new Date(Date.now() - 30 * 3600 * 1000).toISOString().slice(0, 7)
  const written = readdirSync(`${work}/Aurora/_octo/posta/${month}`)
  assert.equal(written.length, 2)
  const first = readFileSync(`${work}/Aurora/_octo/posta/${month}/${written[0]}`, 'utf8')
  assert.match(first, /oggetto: "Aurora: data del collaudo"/)
  assert.match(first, /spostato a giovedì 17 dicembre 2026/)
  fakeMail('extra')
  await mail.getByRole('button', { name: READ_NOW }).click()
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
  await openSource('Collega', 'Azure DevOps')
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
  await adoSection.getByRole('button', { name: 'Prova e salva' }).scrollIntoViewIfNeeded()
  await page.screenshot({ path: `${work}/fonti-sistema.png` })
  // The small guide beside the token opens on request.
  await adoSection.getByRole('button', { name: 'Come ottengo il token?' }).click()
  await adoSection
    .getByRole('note')
    .getByText(/spunta solo «Work Items: Read»/)
    .waitFor()
  // The colours of the icon change with a short transition: the picture is taken after it.
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${work}/fonti-token.png` })
  await page.keyboard.press('Escape')
  await saveAdo()
  await adoSection.getByText('Collegamento riuscito e salvato.').waitFor({ timeout: TIMEOUT_MS })
  assert.doesNotMatch(
    readFileSync(`${work}/Aurora/_octo/.impostazioni/sources.json`, 'utf8'),
    /demo-pat/,
  )
  await adoSection.getByRole('button', { name: READ_NOW }).click()
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
  await adoSection.getByRole('button', { name: READ_NOW }).click()
  await assertEventually(() => workItems().length === 4)

  // Demo 05: one button reads everything that is linked.
  await guide.getByText(/^2 su 6 collegati/).waitFor({ timeout: TIMEOUT_MS })
  await guide.getByRole('button', { name: 'Leggi tutte le fonti' }).click()
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
  await work06.getByText('1 citazione riscontrata nel file').waitFor({ timeout: TIMEOUT_MS })
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
    page.locator('.metric', { hasText: label }).first().locator('.metric-value').innerText()
  assert.equal(await figure('Bug aperti'), '15')
  assert.equal(await figure('In verifica'), '5')
  assert.equal(await figure('Fermi da oltre 30 giorni'), '11')
  // Demo 34: the dashboard is read in three parts; the period on top holds for all of them.
  const part = (name) => page.locator('.dashboard-tabs').getByRole('tab', { name, exact: true })
  await part('Andamento').click()
  const trendRows = page.locator('.trend tbody tr')
  assert.equal(await trendRows.count(), 8)
  await page.getByRole('button', { name: '12 mesi' }).click()
  await assertEventuallyAsync(async () => (await trendRows.count()) === 12)
  await page.screenshot({ path: `${work}/cruscotto-andamento.png` })
  await part('Bug').click()
  await page.screenshot({ path: `${work}/cruscotto.png` })
  const open07 = page.getByRole('region', { name: 'Qualità: i bug del perimetro' })
  // Demo 24: a count opens its list, with as many rows as it counts, and a bug shows its detail.
  await open07.getByRole('button', { name: /Fermi da oltre 30 giorni/ }).click()
  assert.equal(await open07.locator('.entry').count(), 11)
  await open07.getByRole('button', { name: /Validati, in attesa di rilascio/ }).click()
  assert.equal(await open07.locator('.entry').count(), Number(await figure('Validati')))
  await open07.getByRole('button', { name: /Bug aperti/ }).click()
  assert.equal(await open07.locator('.entry').count(), 15)
  await open07
    .getByRole('region', { name: 'Dettaglio del bug' })
    .getByText(/gg nello stato/)
    .waitFor()
  await open07.getByRole('button', { name: 'Scrivi una nota' }).first().click()
  await open07.getByRole('textbox').fill('Sentito il cliente: dati entro venerdì')
  await open07.getByRole('button', { name: 'Salva la nota' }).click()
  await open07.getByText(/Nota tua/).waitFor({ timeout: TIMEOUT_MS })
  // Demo 34: a row of a split is a filter of the list, and the filters come off together.
  const firstSplit = open07.locator('.breakdown-row').first()
  const splitCount = Number(await firstSplit.locator('.breakdown-count').innerText())
  await firstSplit.click()
  await assertEventuallyAsync(async () => (await open07.locator('.entry').count()) === splitCount)
  await open07.getByRole('button', { name: 'Togli i filtri' }).click()
  await assertEventuallyAsync(async () => (await open07.locator('.entry').count()) === 15)
  await part('Sprint').click()
  const requirements07 = page.getByRole('region', { name: 'Requisiti poco chiari' })
  await requirements07.getByText(/ancora da definire con il cliente/).waitFor()
  assert.equal(await requirements07.locator('tbody tr').count(), 4)
  await requirements07.getByRole('button', { name: 'È chiaro' }).last().click()
  await assertEventuallyAsync(async () => (await requirements07.locator('tbody tr').count()) === 3)
  // Demo 34: a decision can be undone right after, and is listed with the way to take it back.
  await page.getByRole('button', { name: 'Annulla', exact: true }).click()
  await assertEventuallyAsync(async () => (await requirements07.locator('tbody tr').count()) === 4)
  await requirements07.getByRole('button', { name: 'È chiaro' }).last().click()
  await assertEventuallyAsync(async () => (await requirements07.locator('tbody tr').count()) === 3)
  await page.screenshot({ path: `${work}/cruscotto-sprint.png` })
  await part('Bug').click()
  const decisions = JSON.parse(
    readFileSync(`${work}/Aurora/_octo/.impostazioni/dashboard.json`, 'utf8'),
  ).decisions
  assert.equal(decisions.notes.length, 1)
  assert.deepEqual(
    decisions.excludedRequirements.map((entry) => entry.id),
    ['2006'],
  )

  // Demo 08: timesheet hours against tracker hours, from the exports in the project folder.
  await openSheetPart('Ore')
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
  // Rows with a field for each value: no separators to remember.
  const cell = (scope, label) => scope.getByLabel(label, { exact: true })
  await cell(page, 'Nome sul tracker, riga 1').fill('E. Costa')
  await cell(page, 'Nome nel timesheet, riga 1').fill('Costa Elena')
  // Codes and people found in the period are there to tick.
  const hoursSettings = page.locator('.dashboard-settings')
  await hoursSettings.getByRole('checkbox', { name: 'PRJ000999', exact: true }).waitFor()
  await hoursSettings
    .getByRole('group', { name: /^Persone che non segnano/ })
    .scrollIntoViewIfNeeded()
  await page.screenshot({ path: `${work}/ore-impostazioni.png` })
  await page.locator('.dashboard-settings').getByRole('button', { name: 'Salva' }).click()
  await hoursRow('Costa Elena').getByText('Torna').waitFor({ timeout: TIMEOUT_MS })
  assert.equal(await hoursRow('E. Costa').count(), 0)
  await page.screenshot({ path: `${work}/ore.png` })
  // The same hours read from Jira itself, with the token of its feed.
  await page.getByRole('tab', { name: 'Impostazioni' }).click()
  const jiraSection = page.getByRole('region', { name: 'Jira', exact: true })
  await openSource('Collega', 'Jira')
  await jiraSection.getByLabel(/^Sito/).fill(DEMO_JIRA.site)
  await jiraSection.getByLabel('La tua email su Atlassian').fill(DEMO_JIRA.email)
  await jiraSection.getByLabel(/^API token/).fill(DEMO_JIRA.token)
  await jiraSection.getByLabel(/^Progetti/).fill(DEMO_JIRA.key)
  await jiraSection.getByRole('button', { name: 'Prova e salva' }).click()
  await jiraSection.getByText('Collegamento riuscito e salvato.').waitFor({ timeout: TIMEOUT_MS })
  // Confluence is a source like the others: same account as Jira, its spaces picked from a search.
  const wiki = page.getByRole('region', { name: 'Confluence', exact: true })
  await openSource('Collega', 'Confluence')
  await wiki.getByLabel(/^Sito/).fill(DEMO_CONFLUENCE.site)
  await wiki.getByLabel('La tua email su Atlassian').fill(DEMO_CONFLUENCE.email)
  await wiki.getByLabel(/^API token/).fill(DEMO_CONFLUENCE.token)
  await wiki.getByRole('button', { name: 'Cerca gli spazi' }).click()
  await wiki.getByRole('button', { name: 'Aurora (AUR)', exact: true }).click()
  assert.equal(await wiki.getByLabel(/^Spazi/).inputValue(), DEMO_CONFLUENCE.space)
  await wiki.getByRole('button', { name: 'Prova e salva' }).click()
  await wiki.getByText('Collegamento riuscito e salvato.').waitFor({ timeout: TIMEOUT_MS })
  await wiki.getByRole('button', { name: READ_NOW }).click()
  await wiki
    .getByText(/Ultima lettura .* aggiornati, \d+ invariati/)
    .waitFor({ timeout: TIMEOUT_MS })
  const wikiPages = readdirSync(`${work}/Aurora/_octo/fonti/Confluence`).filter(
    (name) => !name.startsWith('_'),
  )
  assert.equal(wikiPages.length, 2)
  const wikiDecisions = wikiPages.find((name) => name.includes('decisioni-di-progetto'))
  assert.match(
    readFileSync(`${work}/Aurora/_octo/fonti/Confluence/${wikiDecisions}`, 'utf8'),
    /collaudo del modulo ordini è confermato per il 17 dicembre 2026/,
  )
  await page.screenshot({ path: `${work}/confluence.png` })
  await openSheetPart('Ore')
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

  // Demo 09 and 41: the monthly forecast of the project codes of the project, computed with no
  // spreadsheet; the one of the administration is filled only on their rows.
  execFileSync('node', [`${root}demo/lib/fake-forecast.ts`, `${work}/Aurora`])
  const modelFile = `${work}/Aurora/Amministrazione/Previsionale avanzamenti.xlsx`
  const modelBefore = readFileSync(modelFile)
  await openSheetPart('Previsionale')
  const forecastRow = (code) => page.locator('table.data tbody tr', { hasText: code })
  // The costs come from the rows of the timesheets: nobody typed them.
  await forecastRow('PRJ000101').getByText('16.010,00').waitFor({ timeout: TIMEOUT_MS })
  await forecastRow('PRJ000101').getByText('27.200,00').waitFor()
  // How a row was computed is said under it, across the table, when the row is opened.
  await page.getByRole('button', { name: 'Calcolo e dettagli, PRJ000303', exact: true }).click()
  await page
    .locator('table.data tbody tr:has-text("PRJ000303") + tr.row-details')
    .getByText('canone: ordinato in 12 rate mensili')
    .waitFor()
  // A fee is the order in equal monthly parts; a code of another PM is not shown.
  await forecastRow('PRJ000303').getByText('1.250,00').waitFor()
  assert.equal(await forecastRow('PRJ000404').count(), 0)
  await page.getByText(/manca la tariffa al giorno di Costa Elena \(120 ore/).waitFor()
  await page.getByText(/^16 ore del mese non ancora approvate/).waitFor()
  await page.getByText(/codici che non sono di questo progetto: PRJ000999/).waitFor()
  // The rate that is missing is typed where it is said to be missing.
  const elena = 'Costa Elena su PRJ000101'
  await page.getByLabel(`Tariffa al giorno, ${elena}`, { exact: true }).fill('400')
  await page.getByRole('button', { name: `Salva: ${elena}`, exact: true }).click()
  await forecastRow('PRJ000101').getByText('33.200,00').waitFor({ timeout: TIMEOUT_MS })
  await forecastRow('PRJ000101').getByText('51,78%').waitFor()
  // What the PM adds for a code is typed in its row; the rest opens under it. One save for all.
  await page.getByRole('button', { name: 'Calcolo e dettagli, PRJ000202', exact: true }).click()
  const inputs202 = page.getByRole('group', { name: 'Dati del mese per PRJ000202' })
  await cell(inputs202, 'Nome, riga 1').fill('Studio Blu')
  await cell(inputs202, 'Ore, riga 1').fill('40')
  await inputs202.getByLabel(/^Costi totali a budget/).fill('20000')
  await page.getByRole('button', { name: 'Salva i dati del mese' }).click()
  // What the external costs and is sold for is typed where it is said to be missing.
  const blu = 'Studio Blu su PRJ000202'
  await page.getByLabel(`Costo al giorno, ${blu}`, { exact: true }).fill('300')
  await page.getByLabel(`Tariffa al giorno, ${blu}`, { exact: true }).fill('500')
  await page.getByRole('button', { name: `Salva: ${blu}`, exact: true }).click()
  await forecastRow('PRJ000202').getByText('7,5%', { exact: true }).waitFor({ timeout: TIMEOUT_MS })
  await forecastRow('PRJ000202').getByText('3.000,00').waitFor()
  // The model of the administration found in the folder is proposed: saving the settings takes it.
  await page.getByText('Impostazioni del previsionale').first().click()
  await page
    .locator('.dashboard-settings > form')
    .getByRole('button', { name: 'Salva', exact: true })
    .click()
  await page.getByRole('button', { name: 'Compila il modello Excel' }).click()
  await page
    .getByText(/^Modello compilato in _octo\/previsionale\//)
    .waitFor({ timeout: TIMEOUT_MS })
  const compiledFolder = `${work}/Aurora/_octo/previsionale`
  const [compiledMonth] = readdirSync(compiledFolder)
  const compiled = readFileSync(`${compiledFolder}/${compiledMonth}/Previsionale avanzamenti.xlsx`)
  assert.ok(compiled.length > 0 && !compiled.equals(modelBefore))
  assert.ok(readFileSync(modelFile).equals(modelBefore))
  await page.screenshot({ path: `${work}/previsionale.png` })

  // Demo 57: the sheet of a project code over its whole life is a section of its own.
  await openSheetPart('Sintesi')
  await page.getByRole('region', { name: 'Ordine', exact: true }).waitFor({ timeout: TIMEOUT_MS })
  // How far the code is comes with what says so: here no system was read, so it is not told.
  await page.getByText('Avanzamento', { exact: true }).first().waitFor()
  await page.getByRole('region', { name: 'Costi e margine', exact: true }).waitFor()
  await page.getByRole('table', { name: 'Ore e costi per persona' }).waitFor()
  await page.getByText('Documento interno: costi e margini non vanno al cliente.').waitFor()
  await page.screenshot({ path: `${work}/commessa.png`, fullPage: true })

  // Demo 11: an approved status report as slides on the deck of the PM.
  execFileSync('node', [`${root}demo/lib/fake-deck.ts`, `${work}/Aurora`, 'chosen'])
  await page.getByRole('tab', { name: 'Deliverable' }).click()
  const work11 = page.getByRole('region', { name: 'Deliverable' })
  await work11.getByRole('button', { name: 'Nuovo deliverable' }).click()
  // The deck of the project is not shown among the kinds: a template belongs to a kind, and
  // the one chosen for the whole project before still serves the kinds that are shown.
  await work11.getByRole('button', { name: 'Crea un tipo tuo' }).waitFor({ timeout: TIMEOUT_MS })
  assert.equal(await work11.getByText('Modello delle presentazioni').count(), 0)
  await work11.getByRole('button', { name: /Stato di avanzamento/ }).click()
  await work11.getByLabel(/^Periodo/).fill('Sprint 28')
  await work11.getByRole('button', { name: 'Scrivi la bozza' }).click()
  await work11.getByText('1 citazione riscontrata nel file').waitFor({ timeout: TIMEOUT_MS })
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

  // Demo 14: people and calendar of the project, and their effect on the hours.
  await page.getByRole('tab', { name: 'Impostazioni' }).click()
  await page.getByRole('tab', { name: 'Persone e calendario' }).click()
  const team14 = page.getByRole('region', { name: 'Persone e calendario' })
  await cell(team14, 'Nome, persona 1').fill('Neri Sara')
  await cell(team14, 'Ruolo, persona 1').fill('analista')
  await cell(team14, 'Al, persona 1').fill('2026-01-31')
  await cell(team14, 'Allocazione %, persona 1').fill('50')
  await team14.getByRole('button', { name: 'Aggiungi una persona' }).click()
  await cell(team14, 'Nome, persona 2').fill('Carla Bianchi')
  await cell(team14, 'Ruolo, persona 2').fill('referente')
  await cell(team14, 'Parte, persona 2').selectOption('client')
  await cell(team14, 'Come scrivergli, persona 2').fill('dare del lei, prima la richiesta')
  await cell(team14, 'Periodo, periodo 1').fill('Sprint 28')
  await cell(team14, 'Dal, periodo 1').fill('2026-10-26')
  await cell(team14, 'Al, periodo 1').fill('2026-11-13')
  await team14.getByRole('button', { name: 'Salva persone e calendario' }).click()
  await team14.getByText('Salvati: 2 persone e 1 periodo.').waitFor({ timeout: TIMEOUT_MS })
  const teamText = readFileSync(`${work}/Aurora/_octo/progetto/persone-e-calendario.md`, 'utf8')
  assert.match(teamText, /\*\*Carla Bianchi\*\*, referente/)
  assert.match(teamText, /\*\*Neri Sara\*\*, analista, al 50% del suo tempo/)
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
  await page.getByRole('tab', { name: 'Chiedi' }).click()
  await openChatWith('1 punto da controllare')

  // Demo 17: the model that answers is chosen for the project and written beside the answer.
  await page.getByText('modello claude-fake-default').first().waitFor({ timeout: TIMEOUT_MS })
  await page.getByRole('tab', { name: 'Impostazioni' }).click()
  await page.getByRole('tab', { name: 'Avanzate' }).click()
  const models17 = page.getByRole('region', { name: 'Quale Claude lavora' })
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
  await page.getByText(/Lette \d voci, \d con la cronologia/).waitFor({ timeout: TIMEOUT_MS })
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
  assert.match(summary16, /- Bug aperti \(in lavorazione o in verifica\): 1/)
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
  // The questions came with the backup; what the feeds wrote, and where they go on from, with
  // the folder: neither computer keeps any of it.
  await page.getByRole('tab', { name: 'Chiedi' }).click()
  await openChatWith('1 punto da controllare')
  const heldByAdo = JSON.parse(readFileSync(`${movedFolder}/_octo/.stato/ado.indice.json`, 'utf8'))
  assert.ok(Object.keys(heldByAdo.items).length > 0)
  assert.equal(existsSync(`${work}/dati-nuovo/feeds`), false)
  assert.equal(existsSync(`${work}/dati/feeds`), false)
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

  // Demo 20: a row that lacks something is told under its table, and nothing is saved.
  await page.getByRole('tab', { name: 'Persone e calendario' }).click()
  const team20 = page.getByRole('region', { name: 'Persone e calendario' })
  const teamFile = () => readFileSync(`${movedFolder}/_octo/.impostazioni/team.json`, 'utf8')
  const teamBefore = teamFile()
  await cell(team20, 'Nome, persona 1').fill('')
  await cell(team20, 'Al, periodo 1').fill('')
  await team20.getByRole('button', { name: 'Salva persone e calendario' }).click()
  await team20.getByText('Persona 1: manca il nome.').waitFor({ timeout: TIMEOUT_MS })
  await team20.getByText('Periodo 1: servono il nome e le due date.').waitFor()
  await team20.getByText(/^Non ho salvato/).waitFor()
  assert.equal(teamFile(), teamBefore)
  await team20.getByRole('button', { name: 'Salva persone e calendario' }).scrollIntoViewIfNeeded()
  await page.screenshot({ path: `${work}/righe.png` })

  // A reading asked from a system that is not linked names it and leads to the sources.
  await openSheetPart('Ore')
  await page.getByRole('button', { name: 'Leggi i timesheet da NetSuite' }).click()
  await page
    .getByText(/^NetSuite non è collegato a questo progetto/)
    .waitFor({ timeout: TIMEOUT_MS })
  await page.getByRole('button', { name: 'Apri «Impostazioni»' }).click()
  await page.getByRole('region', { name: 'Avvio del progetto' }).waitFor({ timeout: TIMEOUT_MS })
  console.log('e2e: ok')
} catch (error) {
  // What the window showed when a step failed, to see which step no longer follows the app.
  const [failed] = app.windows()
  await failed?.screenshot({ path: `${work}/errore.png`, fullPage: true }).catch(() => {})
  throw error
} finally {
  await app.close()
  ado.server.close()
  jira.server.close()
  confluence.server.close()
}
