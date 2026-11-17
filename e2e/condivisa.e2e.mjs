// Opens the built desktop app twice on one project folder, as two computers that share it, and
// follows the steps of demo 42 in the real windows. Run with `pnpm e2e:condivisa`.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs'
import { fileURLToPath } from 'node:url'
import { _electron as electron } from 'playwright'
import { DEMO_ADO, startDemoAdo } from '../demo/lib/fake-ado.ts'

const root = fileURLToPath(new URL('..', import.meta.url))
const work = `${root}.tmp/e2e-condivisa`
const TIMEOUT_MS = 20_000
const QUESTION = 'Quando consegniamo il modulo ordini?'

execFileSync('bash', ['-c', `source "${root}demo/lib/project.sh" && make_demo_project "${work}"`])
// The second computer: its own data folder, the same project folder under its own id.
mkdirSync(`${work}/dati-pc`, { recursive: true })
writeFileSync(
  `${work}/dati-pc/projects.json`,
  JSON.stringify([
    {
      id: 'demo-aurora-pc',
      name: 'Aurora',
      folder: `${work}/Aurora`,
      addedAt: '2026-11-17T08:00:00.000Z',
    },
  ]),
)

const ado = await startDemoAdo()
const packaged = process.env.OCTO_E2E_EXECUTABLE

const GIOVANNI = { name: 'Giovanni Rossi', computer: 'mac-di-giovanni' }
const GIOVANNA = { name: 'Giovanna Bianchi', computer: 'pc-di-giovanna' }
const computers = {
  mac: { data: `${work}/dati`, mail: 'giovanni@example.test', ...GIOVANNI },
  pc: { data: `${work}/dati-pc`, mail: 'giovanna@example.test', ...GIOVANNA },
}
const readBy = (who) => `Letta da ${who.name} · ${who.computer}`

const launch = ({ data, name, mail, computer }) =>
  electron.launch({
    ...(packaged ? { executablePath: packaged, args: [] } : { args: [`${root}apps/desktop`] }),
    env: {
      ...process.env,
      OCTO_DATA_DIR: data,
      OCTO_CLAUDE_PATH: `${root}demo/lib/fake-claude`,
      OCTO_MAIL_ROOT: `${work}/Mail-assente`,
      OCTO_VERBALE_DIR: `${work}/Verbale-assente`,
      OCTO_DEV_ADO_URL: ado.server.origin,
      OCTO_DEMO_PLAIN_SECRETS: '1',
      // A person already signed in and a computer name: one of each for each window.
      OCTO_DEMO_IDENTITY: `${name} <${mail}>`,
      OCTO_COMPUTER_NAME: computer,
    },
  })

/** What one window is driven by: its page and the row of Azure DevOps in its settings. */
async function windowOf(app) {
  const page = await app.firstWindow()
  await page.getByRole('heading', { name: 'Aurora' }).waitFor({ timeout: TIMEOUT_MS })
  const section = page.getByRole('region', { name: 'Azure DevOps' })
  /** Opens the settings again, so the row shows what the folder says now. */
  const settings = async () => {
    await page.getByRole('tab', { name: 'Chiedi' }).click()
    await page.getByRole('tab', { name: 'Impostazioni' }).click()
  }
  const open = (action) =>
    page.getByRole('button', { name: `${action}: Azure DevOps`, exact: true }).click()
  const save = async () => {
    await section.getByLabel(/^Personal Access Token/).fill(DEMO_ADO.pat)
    await section.getByRole('button', { name: 'Prova e salva' }).click()
    await section.getByText('Collegamento riuscito e salvato.').waitFor({ timeout: TIMEOUT_MS })
  }
  const read = async (outcome) => {
    await section.getByRole('button', { name: 'Leggi ora' }).click()
    await section.getByText(outcome).waitFor({ timeout: TIMEOUT_MS })
  }
  return { page, section, settings, open, save, read }
}

const state = (folder, name) => JSON.parse(readFileSync(`${folder}/_octo/.stato/${name}`, 'utf8'))
const NO_CREDENTIAL = /Su questo computer non c’è la credenziale/
const READ = /Ultima lettura .*: \d+ aggiornati, \d+ invariati/
// Going on from where the other stopped, there is nothing to write again.
const NOTHING_NEW = /Ultima lettura .*: 0 aggiornati, \d+ invariati/

let macApp = await launch(computers.mac)
let pcApp = await launch(computers.pc)
try {
  const folder = `${work}/Aurora`
  const mac = await windowOf(macApp)
  const pc = await windowOf(pcApp)

  // Giovanni links Azure DevOps and reads it.
  await mac.settings()
  await mac.open('Collega')
  await mac.section.getByLabel('Organizzazione').fill(DEMO_ADO.organization)
  await mac.section.getByLabel('Progetto', { exact: true }).fill(DEMO_ADO.project)
  await mac.save()
  await mac.read(READ)
  assert.equal(await mac.section.getByText(/^Letta da /).count(), 0)

  // The state of the reading is in the folder, with who read; nothing of it stays with the app.
  const kept = readdirSync(`${folder}/_octo/.stato`)
  assert.ok(kept.includes('ado.json') && kept.includes('ado.indice.json'), kept.join(', '))
  assert.deepEqual(state(folder, 'ado.json').lastRun.by, GIOVANNI)
  assert.equal(state(folder, 'ado.json').lease, null)
  const held = Object.keys(state(folder, 'ado.indice.json').items).length
  assert.ok(held >= 3, `${held} items in the index`)
  assert.equal(existsSync(`${work}/dati/feeds`), false)

  // Giovanna finds it read, by him, and no error for the credential she does not have.
  await pc.settings()
  await pc.section.getByText(readBy(GIOVANNI)).waitFor({ timeout: TIMEOUT_MS })
  await pc.section.getByText(READ).waitFor()
  await pc.section.getByText(NO_CREDENTIAL).waitFor()
  await pc.page.screenshot({ path: `${work}/letta-da-un-altro.png` })

  // Her question is hers: kept with her app, not in the folder, and not shown to him.
  await pc.page.getByRole('tab', { name: 'Chiedi' }).click()
  await pc.page.getByPlaceholder('Chiedi qualcosa su questo progetto…').fill(QUESTION)
  await pc.page.getByRole('button', { name: 'Chiedi', exact: true }).click()
  await pc.page.getByText('1 citazione riscontrata nel file').waitFor({ timeout: TIMEOUT_MS })
  const hers = readFileSync(`${work}/dati-pc/questions/demo-aurora-pc/domande.json`, 'utf8')
  assert.match(hers, /modulo ordini/)
  assert.equal(existsSync(`${folder}/_octo/.cronologia/domande.json`), false)
  assert.equal(existsSync(`${work}/dati/questions/demo-aurora/domande.json`), false)
  await mac.page.getByRole('tab', { name: 'Chiedi' }).click()
  assert.equal(await mac.page.getByText(QUESTION).count(), 0)

  // With her own credential she goes on from where he stopped: nothing is written again.
  await pc.settings()
  await pc.open('Modifica')
  await pc.save()
  await pc.read(NOTHING_NEW)
  assert.equal(await pc.section.getByText(NO_CREDENTIAL).count(), 0)
  assert.equal(await pc.section.getByText(/^Letta da /).count(), 0)
  assert.deepEqual(state(folder, 'ado.json').lastRun.by, GIOVANNA)
  const items = readdirSync(`${folder}/_octo/fonti/ADO`).filter((name) =>
    /^\d+-[0-9a-f]{8}\.md$/.test(name),
  )
  assert.equal(items.length, 3)
  assert.equal(Object.keys(state(folder, 'ado.indice.json').items).length, held)

  // He sees her reading.
  await mac.settings()
  await mac.section.getByText(readBy(GIOVANNA)).waitFor({ timeout: TIMEOUT_MS })
  await mac.page.screenshot({ path: `${work}/letta-da-giovanna.png` })

  // The folder is moved: told where it is, the project is the same, credential and readings too.
  await macApp.close()
  await pcApp.close()
  pcApp = null
  const movedFolder = `${work}/OneDrive/Aurora`
  mkdirSync(`${work}/OneDrive`, { recursive: true })
  renameSync(folder, movedFolder)
  macApp = await launch(computers.mac)
  const page = await macApp.firstWindow()
  await macApp.evaluate(({ dialog }, chosen) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [chosen] })
  }, movedFolder)
  await page.getByRole('heading', { name: 'Aurora' }).waitFor({ timeout: TIMEOUT_MS })
  await page.locator('.switcher-button').click()
  await page.getByRole('menuitem', { name: 'Gestisci i progetti…' }).click()
  await page.getByRole('button', { name: 'Cambia la cartella di Aurora' }).click()
  await page
    .getByRole('dialog', { name: 'I tuoi progetti' })
    .getByText(movedFolder)
    .waitFor({ timeout: TIMEOUT_MS })
  await page.screenshot({ path: `${work}/cartella-cambiata.png` })
  const listed = JSON.parse(readFileSync(`${work}/dati/projects.json`, 'utf8'))[0]
  assert.equal(listed.id, 'demo-aurora')
  assert.equal(listed.folder, movedFolder)
  await page.keyboard.press('Escape')
  const again = await windowOf(macApp)
  await again.settings()
  await again.section.getByText(readBy(GIOVANNA)).waitFor({ timeout: TIMEOUT_MS })
  await again.read(NOTHING_NEW)
  assert.deepEqual(state(movedFolder, 'ado.json').lastRun.by, GIOVANNI)

  console.log('ok: two computers on one folder, as in demo 42')
} finally {
  await macApp.close().catch(() => {})
  await pcApp?.close().catch(() => {})
  ado.server.close()
}
