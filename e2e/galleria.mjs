// Photographs every section of the built app, in the light and in the dark theme, on the
// synthetic projects of the demos: the pictures a review of the interface starts from.
// Run with `pnpm galleria`: it runs `pnpm e2e` first, which leaves the project it reads filled.
import { execFileSync, spawn } from 'node:child_process'
import { mkdirSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { _electron as electron } from 'playwright'

const root = fileURLToPath(new URL('..', import.meta.url))
const filled = `${root}.tmp/e2e`
const today = `${root}.tmp/galleria-oggi`
const sheet = `${root}.tmp/galleria-commessa`
const out = `${root}docs/claude-design/schermate`
const WINDOW = { width: 1280, height: 860 }
const TIMEOUT_MS = 30_000
const SETTLE_MS = 400
const THEMES = ['chiaro', 'scuro']
const THEME_LABELS = { chiaro: 'Tema chiaro', scuro: 'Tema scuro' }

const slug = (text) =>
  text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

const launch = (work, dataFolder, extra) =>
  electron.launch({
    args: [`${root}apps/desktop`],
    env: {
      ...process.env,
      OCTO_DATA_DIR: dataFolder,
      OCTO_CLAUDE_PATH: `${root}demo/lib/fake-claude`,
      OCTO_MAIL_ROOT: `${work}/Mail`,
      OCTO_DEMO_PLAIN_SECRETS: '1',
      OCTO_DEMO_IDENTITY: 'Paola Verdi <pm@example.test>',
      ...extra,
    },
  })

async function open(work, dataFolder, extra = {}) {
  const app = await launch(work, dataFolder, extra)
  const page = await app.firstWindow()
  await page.setViewportSize(WINDOW)
  const nav = page.getByRole('navigation', { name: 'Progetti' })
  await nav.getByRole('tab').first().waitFor({ timeout: TIMEOUT_MS })
  return { app, page, nav }
}

let counter = 0
/** One picture of the whole page, in both themes, named by where it was taken. */
async function shoot(page, name) {
  counter += 1
  const number = String(counter).padStart(2, '0')
  await page
    .locator('.spinner')
    .and(page.locator(':visible'))
    .first()
    .waitFor({ state: 'hidden', timeout: TIMEOUT_MS })
    .catch(() => console.log(`  ${name}: still reading when photographed`))
  await page.setViewportSize({ ...WINDOW, height: WINDOW.height + (await hiddenHeight(page)) })
  for (const theme of THEMES) {
    await page.getByRole('button', { name: THEME_LABELS[theme] }).click()
    await page.waitForTimeout(SETTLE_MS)
    await page.screenshot({ path: `${out}/${theme}/${number}-${slug(name)}.png` })
  }
  await page.setViewportSize(WINDOW)
  console.log(`${number} ${name}`)
}

/** How much of the page in sight is below the window: the most a part of it has to be scrolled. */
const hiddenHeight = (page) =>
  page.evaluate(() => {
    let most = 0
    for (const element of document.querySelectorAll('*')) {
      if (!element.checkVisibility()) continue
      const scrolls = /auto|scroll/.test(getComputedStyle(element).overflowY)
      if (scrolls) most = Math.max(most, element.scrollHeight - element.clientHeight)
    }
    return most
  })

/** The tabs inside the section in sight: its own parts, not the sections of the project. */
const innerTabs = (page) =>
  page.locator('.section-view:not([hidden]) [role="tab"]').and(page.locator(':visible'))

async function shootSection(page, nav, section, before, state = '') {
  const tab = nav.getByRole('tab', { name: section, exact: true })
  if ((await tab.count()) === 0) return
  await tab.click()
  await page.waitForTimeout(SETTLE_MS)
  if (before) await before(page).catch((error) => console.log(`  ${section}: ${error.message}`))
  await shoot(page, `${section} ${state}`)
  if (state) return
  const names = await innerTabs(page).allTextContents()
  for (const name of names.slice(1)) {
    await innerTabs(page).filter({ hasText: name }).first().click()
    await page.waitForTimeout(SETTLE_MS)
    await shoot(page, `${section} ${name}`)
  }
}

rmSync(out, { recursive: true, force: true })
for (const theme of THEMES) mkdirSync(`${out}/${theme}`, { recursive: true })

// «Oggi» is full only on its own project: a day with mail, meetings and things that wait.
execFileSync(
  'bash',
  [
    '-c',
    `cd "${root}" && source demo/lib/project.sh && source demo/lib/today-project.sh && OCTO_DEMO_DOUBTFUL_MEETING=1 OCTO_DEMO_MEETING_IN_MINUTES=40 make_today_project "${today}"`,
  ],
  { stdio: 'inherit' },
)
const day = await open(today, `${today}/dati`)
try {
  await shootSection(day.page, day.nav, 'Oggi', async (page) => {
    await page.getByRole('button', { name: 'Leggi ora' }).click({ timeout: TIMEOUT_MS })
    await page
      .getByRole('list', { name: 'Cose che vengono prima' })
      .waitFor({ timeout: TIMEOUT_MS })
  })
} finally {
  await day.app.close()
}

// «Commessa» reads orders, invoices and timesheets from NetSuite: here from the fake one, which
// needs the test Postgres (`pnpm db:setup`).
execFileSync('bash', ['-c', `source "${root}demo/lib/project.sh" && make_demo_project "${sheet}"`])
const warehouse = spawn('node', [
  `${root}demo/lib/fake-dwsi-months.ts`,
  `${sheet}/Aurora`,
  `${sheet}/dati`,
  'summary',
])
await new Promise((resolve, reject) => {
  warehouse.stdout.once('data', resolve)
  warehouse.once('exit', () => reject(new Error('the fake NetSuite did not start: pnpm db:setup')))
})
const month = await open(sheet, `${sheet}/dati`, { OCTO_DEV_WAREHOUSE_LOOPBACK: '1' })
try {
  await shootSection(month.page, month.nav, 'Commessa')
} finally {
  await month.app.close()
  warehouse.kill()
}

// Every other section, on the project the end-to-end run filled.
const deliverables = (page) => page.getByRole('navigation', { name: 'Deliverable' })
const work = await open(filled, `${filled}/dati-nuovo`)
try {
  await shootSection(work.page, work.nav, 'Chiedi', undefined, 'nuova chat')
  await shootSection(
    work.page,
    work.nav,
    'Chiedi',
    (page) => page.locator('.ask-chat').first().click({ timeout: TIMEOUT_MS }),
    'risposta con fonti',
  )
  await shootSection(work.page, work.nav, 'Deliverable', undefined, 'catalogo')
  await shootSection(
    work.page,
    work.nav,
    'Deliverable',
    (page) => deliverables(page).getByText('Approvato').first().click({ timeout: TIMEOUT_MS }),
    'documento approvato',
  )
  await shootSection(
    work.page,
    work.nav,
    'Deliverable',
    (page) => deliverables(page).getByText('Da rivedere').first().click({ timeout: TIMEOUT_MS }),
    'documento da rivedere',
  )
  await shootSection(
    work.page,
    work.nav,
    'Deliverable',
    (page) => deliverables(page).getByRole('button', { name: 'Registro' }).click(),
    'registro',
  )
  await shootSection(work.page, work.nav, 'Cruscotto')
  await shootSection(work.page, work.nav, 'Impostazioni')
} finally {
  await work.app.close()
}
console.log(`galleria: ${counter} schermate per tema in ${out}`)
