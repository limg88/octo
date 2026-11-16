// Opens the built desktop app on the project of demos 34 and 35, with a fake Azure DevOps already
// linked and the fake model, and follows their steps in the real window.
// Run with `pnpm e2e:cruscotto` (it builds first).
import assert from 'node:assert/strict'
import { execFileSync, spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { _electron as electron } from 'playwright'

const root = fileURLToPath(new URL('..', import.meta.url))
const work = `${root}.tmp/e2e-cruscotto`
const TIMEOUT_MS = 20_000
/** The sources are read this often, so that the periodic reading is seen without waiting. */
const SYNC_SECONDS = 5

execFileSync('bash', ['-c', `source "${root}demo/lib/project.sh" && make_demo_project "${work}"`])
const ado = spawn('node', [
  `${root}demo/lib/fake-ado-cruscotto.ts`,
  `${work}/Aurora`,
  `${work}/dati`,
])
const adoUrl = await new Promise((resolve, reject) => {
  ado.stdout.once('data', (chunk) => resolve(String(chunk).trim()))
  ado.once('exit', () => reject(new Error('the fake Azure DevOps did not start')))
})

async function eventually(check) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (await check()) return
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  assert.fail('the app did not get there in time')
}

const app = await electron.launch({
  args: [`${root}apps/desktop`],
  env: {
    ...process.env,
    OCTO_DATA_DIR: `${work}/dati`,
    OCTO_CLAUDE_PATH: `${root}demo/lib/fake-claude`,
    OCTO_MAIL_ROOT: `${work}/Mail-assente`,
    OCTO_DEV_ADO_URL: adoUrl,
    OCTO_DEMO_PLAIN_SECRETS: '1',
    OCTO_DEMO_IDENTITY: 'Paola Verdi <pm@example.test>',
    OCTO_DEV_SYNC_SECONDS: String(SYNC_SECONDS),
  },
})
try {
  const page = await app.firstWindow()
  // A link to the tracker would open the system's browser: the test only notes where it leads.
  await app.evaluate(({ shell }) => {
    globalThis.opened = []
    shell.openExternal = async (url) => {
      globalThis.opened.push(url)
    }
  })
  await page.getByRole('tab', { name: 'Cruscotto' }).click()
  await page.getByRole('button', { name: 'Leggi da Azure DevOps' }).click()
  await page.getByText(/Lette 23 voci, 23 con la cronologia/).waitFor({ timeout: TIMEOUT_MS })
  const part = (name) => page.locator('.dashboard-tabs').getByRole('tab', { name, exact: true })
  const metric = (label) => page.locator('.metric', { hasText: label }).first()
  const value = async (label) => metric(label).locator('.metric-value').innerText()

  // Demo 34: the bugs in numbers, each compared with the start of the period.
  const bugs = page.getByRole('region', { name: 'Qualità: i bug del perimetro' })
  await bugs.waitFor({ timeout: TIMEOUT_MS })
  assert.equal(await value('Bug aperti'), '5')
  assert.match(await metric('Bug aperti').innerText(), /\+3 da inizio periodo/)
  assert.equal(await value('Fermi da oltre 30 giorni'), '2')
  // A row of a split is a filter; two of them add up; the search narrows by words.
  await bugs.getByRole('button', { name: 'Solo persona: Mario Rossi' }).click()
  await eventually(async () => (await bugs.locator('.entry').count()) === 2)
  await bugs.getByText('Filtri: 2 di 5').waitFor()
  await bugs.getByRole('button', { name: 'Solo gravità: 1 - Critical' }).click()
  await eventually(async () => (await bugs.locator('.entry').count()) === 1)
  await bugs.getByRole('button', { name: 'Togli i filtri' }).click()
  await bugs.getByLabel('Cerca per id o titolo').fill('pdf')
  await eventually(async () => (await bugs.locator('.entry').count()) === 1)
  await bugs.getByLabel('Cerca per id o titolo').fill('')
  // No bug read from Azure DevOps states its environment: that split is not shown.
  assert.equal(await bugs.getByText('Per ambiente').count(), 0)
  await bugs.locator('.entry', { hasText: 'Errore nel calcolo' }).click()
  await bugs
    .getByRole('region', { name: 'Dettaglio del bug' })
    .getByRole('button', { name: 'Apri su Azure DevOps' })
    .click()
  await eventually(async () => (await app.evaluate(() => globalThis.opened.length)) === 1)
  assert.deepEqual(await app.evaluate(() => globalThis.opened), [
    'https://dev.azure.com/contoso/Aurora/_workitems/edit/301',
  ])
  await page.screenshot({ path: `${work}/bug.png`, fullPage: true })

  // Demo 35: what waits for an answer, and the reminder Claude drafts on request.
  await bugs.getByText('Da sollecitare: 2').waitFor()
  const waiting = bugs.locator('.chase-item')
  assert.equal(await waiting.count(), 2)
  await bugs.getByLabel('Solo in attesa del cliente').uncheck()
  await eventually(async () => (await waiting.count()) === 3)
  await bugs.getByLabel('Solo in attesa del cliente').check()
  const pdf = waiting.filter({ hasText: 'Modulo ordini: export in PDF' })
  await pdf.getByText(/Quale formato serve per la data nel PDF/).waitFor()
  await pdf.getByRole('button', { name: 'Prepara il sollecito' }).click()
  await pdf.getByText('Sollecito per Carla Neri').waitFor({ timeout: TIMEOUT_MS })
  await pdf.getByText(/Grazie, Paola Verdi/).waitFor()
  await page.screenshot({ path: `${work}/solleciti.png`, fullPage: true })

  // Demo 34: the sprint by stage, what is at risk while it ends, the sprints side by side.
  await part('Sprint').click()
  const stories = page.getByRole('region', { name: 'Storie dello sprint' })
  await stories.getByText('Lo sprint è agli ultimi giorni').waitFor()
  assert.equal(await stories.locator('select').inputValue(), 'Sprint 28')
  assert.equal(await value('Storie'), '5')
  assert.equal(await value('Chiuse'), '2')
  await stories.getByText('A rischio: 2 storie non sono ancora in verifica').waitFor()
  const compared = page.getByRole('region', { name: 'Sprint a confronto' })
  const sprint27 = compared.locator('tbody tr', { hasText: 'Sprint 27' }).locator('td')
  assert.deepEqual((await sprint27.allInnerTexts()).slice(1), ['4', '3', '2', '1', '2'])
  // Only the stories of the sprint that comes next are asked whether they are clear.
  const requirements = page.getByRole('region', { name: 'Requisiti poco chiari' })
  await requirements.getByText('Controllo solo le storie del prossimo sprint: Sprint 29.').waitFor()
  assert.equal(await requirements.locator('tbody tr').count(), 2)
  await requirements.getByRole('button', { name: 'È chiaro' }).first().click()
  await eventually(async () => (await requirements.locator('tbody tr').count()) === 1)
  await page.getByRole('button', { name: 'Annulla', exact: true }).click()
  await eventually(async () => (await requirements.locator('tbody tr').count()) === 2)
  await requirements.getByRole('button', { name: 'È chiaro' }).first().click()
  await eventually(async () => (await requirements.locator('tbody tr').count()) === 1)
  const decisions = page.getByRole('region', { name: 'Decisioni prese' })
  await decisions.getByText('Decisioni prese: 1').click()
  await decisions.getByRole('button', { name: 'Ripristina' }).click()
  await eventually(async () => (await requirements.locator('tbody tr').count()) === 2)
  // Another sprint, when the PM chooses it.
  await stories.locator('select').selectOption('Sprint 27')
  await eventually(async () => (await value('Storie')) === '4')
  await page.screenshot({ path: `${work}/sprint.png`, fullPage: true })

  // Demo 35: Claude comments the numbers; what it says with a number of its own is thrown away.
  await part('Andamento').click()
  const comment = page.getByRole('region', { name: 'Che cosa dice Claude dei numeri' })
  await comment.getByRole('button', { name: 'Commenta il periodo' }).click()
  await comment.getByText(/I bug aperti sono 5, erano 2/).waitFor({ timeout: TIMEOUT_MS })
  await comment.getByText(/Il bug #301 è fermo da 45 giorni/).waitFor()
  await comment.getByText(/1 frase tolta/).waitFor()
  assert.equal(await comment.getByText(/73 per cento/).count(), 0)
  await page.getByRole('button', { name: '3 mesi' }).click()
  await comment.getByText(/I dati o il periodo sono cambiati/).waitFor({ timeout: TIMEOUT_MS })
  await page.screenshot({ path: `${work}/andamento.png`, fullPage: true })

  // Demo 35: somebody opens a bug on the tracker; the periodic reading brings it to the page.
  await part('Bug').click()
  ado.kill('SIGUSR1')
  await eventually(async () => (await value('Bug aperti')) === '6')
  await bugs.getByText('Pagamento rifiutato senza messaggio').first().waitFor()
  const snapshot = JSON.parse(
    readFileSync(`${work}/Aurora/_octo/cruscotto/azure-devops.json`, 'utf8'),
  )
  assert.ok(snapshot.items.some((entry) => entry.id === 399))
  console.log('e2e cruscotto: ok')
} finally {
  await app.close()
  ado.kill('SIGTERM')
}
