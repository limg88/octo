// Opens the built desktop app on the project of demo 68 and follows what the trial from zero
// found broken: a thing of «Adesso» opens under its row; a request to Claude goes on while the PM
// is in another section and is there at the return; «Commessa» reads a year of months and ends.
// Run with `pnpm e2e:esiti` (it builds first; it needs the test Postgres, `pnpm db:setup`).
import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
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

/** Waits until a file of the project says something: the app writes it a moment after a save. */
async function assertFile(path, pattern) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (existsSync(path) && pattern.test(readFileSync(path, 'utf8'))) return
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  assert.fail(`${path} never matched ${pattern}`)
}

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

  // I3. The PM fixes that a person is addressed as «tu»: the email is written so, whatever the
  // kind said before. A finding of the critical reading is corrected alone, in its passage.
  await section('Impostazioni').click()
  await page.getByRole('tab', { name: 'Persone e calendario' }).click()
  const team = page.getByRole('region', { name: 'Persone e calendario' })
  await team.getByRole('button', { name: 'Aggiungi una persona' }).click()
  await team.getByLabel('Nome, persona 4').fill('Carla Bianchi')
  await team.getByLabel('Parte, persona 4').selectOption('client')
  await team.getByLabel('Tu / lei, persona 4').selectOption('tu')
  await team.getByRole('button', { name: 'Salva' }).first().click()
  await assertFile(
    `${work}/Aurora/_octo/progetto/persone-e-calendario.md`,
    /Il PM gli o le dà del tu\./,
  )
  await section('Deliverable').click()
  const drafts = page.getByRole('region', { name: 'Deliverable' })
  await drafts.getByRole('button', { name: /^Email al cliente/ }).click()
  await drafts.getByLabel('A chi scrivi').fill('Carla Bianchi')
  await drafts.getByLabel(/^Di che cosa/).fill('Collaudo #inventa')
  await drafts.getByLabel(/^Che cosa chiedi/).fill('Conferma la data')
  await drafts.getByRole('button', { name: 'Scrivi la bozza' }).click()
  await drafts.getByText('Ciao Carla,').first().waitFor({ timeout: TIMEOUT_MS })
  await drafts.getByText('Il budget non ha una fonte').first().waitFor({ timeout: TIMEOUT_MS })
  // The general change is proposed from the finding; the finding has a change of its own.
  assert.match(
    await drafts.getByLabel('Che cosa vuoi cambiare?').inputValue(),
    /^Correggi i rilievi della rilettura critica:\n- Il budget non ha una fonte$/,
  )
  await page.screenshot({ path: `${work}/rilettura.png`, fullPage: true })
  await drafts.getByRole('button', { name: 'Correggi questo' }).click()
  await drafts.getByLabel(/^Che cosa cambiare in questo passo/).fill('Togli la cifra')
  await drafts.getByRole('button', { name: 'Riscrivi solo questo passo' }).click()
  await drafts.getByText('Può uscire: nessun punto contestabile trovato.').waitFor({
    timeout: TIMEOUT_MS,
  })
  assert.equal(await drafts.getByText(/99\.000/).count(), 0)
  await drafts.getByText('Ciao Carla,').first().waitFor()

  // I4. «Con calcoli» says what it does, right beside the button that asks; a file is attached
  // to the conversation and copied in its folder, and a format Octo does not read is refused.
  // The dialog of the system is answered here in its place.
  await section('Chiedi').click()
  const composer = page.locator('form.composer')
  const choose = (path) =>
    app.evaluate(({ dialog }, chosen) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [chosen] })
    }, path)
  writeFileSync(`${work}/foto.heic`, 'x')
  writeFileSync(`${work}/nota.txt`, 'Da chiarire: ambiente di prova.')
  await choose(`${work}/foto.heic`)
  await composer.getByRole('button', { name: 'Allega…' }).click({ timeout: TIMEOUT_MS })
  await page.getByText(/^Non so leggere questo formato/).waitFor({ timeout: TIMEOUT_MS })
  await choose(`${work}/nota.txt`)
  await composer.getByRole('button', { name: 'Allega…' }).click()
  await page
    .getByRole('list', { name: 'File allegati a questa conversazione' })
    .getByText('nota.txt')
    .waitFor({ timeout: TIMEOUT_MS })
  const chats = `${work}/Aurora/_octo/.lavori/chiedi`
  const [chat] = readdirSync(chats)
  assert.equal(readFileSync(`${chats}/${chat}/nota.txt`, 'utf8'), 'Da chiarire: ambiente di prova.')
  if ((await composer.getByLabel('Con calcoli').count()) > 0) {
    await composer.getByRole('button', { name: 'Che cosa fa «Con calcoli»' }).click()
    await composer.getByText(/Accendilo quando la domanda chiede un numero/).waitFor()
    await page.screenshot({ path: `${work}/chiedi.png`, fullPage: true })
    await composer.getByRole('button', { name: 'Che cosa fa «Con calcoli»' }).click()
  }

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
  await page
    .getByText('12 dicembre')
    .locator('visible=true')
    .first()
    .waitFor({ timeout: TIMEOUT_MS })
  await page.screenshot({ path: `${work}/risposta.png`, fullPage: true })
  // I5. A source is read inside Octo, opened on the sentence quoted, which is marked.
  await page.getByRole('button', { name: 'Apri la fonte' }).locator('visible=true').first().click()
  const reader = page.getByRole('dialog', { name: 'wiki/stato.md' })
  await reader
    .locator('.source-quoted')
    .getByText(/fissata al 12 dicembre 2026/)
    .waitFor({
      timeout: TIMEOUT_MS,
    })
  await reader.getByRole('button', { name: 'Apri con il sistema' }).waitFor()
  await page.screenshot({ path: `${work}/lettore.png`, fullPage: true })
  await reader.getByRole('button', { name: 'Chiudi' }).click()
  // The mark is the octopus that reads a page.
  await page.locator('img.logo').first().waitFor()
  // A column is made wider from the edge of its heading, and stays so.
  await section('Oggi').click()
  const watched = page.getByRole('table', { name: 'Da tenere d’occhio' })
  const edge = watched.getByRole('separator', { name: 'Larghezza della colonna Che cosa' })
  await edge.focus()
  await edge.press('ArrowRight')
  assert.match((await watched.locator('col').first().getAttribute('style')) ?? '', /width: \d+px/)
  // The glossary: Claude proposes a pair, the PM takes it, and it is kept with the settings.
  await section('Impostazioni').click()
  await page.getByRole('tab', { name: 'Persone e calendario' }).click()
  const glossary = page.getByRole('region', { name: 'Glossario: sigle e nomi sentiti male' })
  await glossary.getByRole('button', { name: 'Chiedi a Claude le coppie' }).click()
  await glossary.getByText('«aurora uan» → «Aurora ONE»').waitFor({ timeout: TIMEOUT_MS })
  await glossary.getByRole('button', { name: 'Aggiungi al glossario: aurora uan' }).click()
  await assertFile(`${work}/Aurora/_octo/.impostazioni/glossario.json`, /"right": "Aurora ONE"/)
  await page.screenshot({ path: `${work}/glossario.png`, fullPage: true })
  console.log('e2e esiti: ok')
} catch (error) {
  // What the window showed when a step failed, to look at.
  await page.screenshot({ path: `${work}/errore.png`, fullPage: true }).catch(() => {})
  throw error
} finally {
  await app.close()
  dwsi.kill('SIGTERM')
}
