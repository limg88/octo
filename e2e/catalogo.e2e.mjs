// Opens the built desktop app on a copy of the catalog of deliverables, as demo 64 does, and
// follows its steps in the real window: the ten kinds read from files, a kind corrected in its
// file, a broken file that stops the whole catalog. Run with `pnpm e2e:catalogo` (it builds first).
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { cpSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { _electron as electron } from 'playwright'

const root = fileURLToPath(new URL('..', import.meta.url))
const work = `${root}.tmp/e2e-catalogo`
const TIMEOUT_MS = 20_000
const TITLES = [
  'Email al cliente',
  'Stato di avanzamento',
  'Verbale di riunione',
  'Stima',
  'Analisi funzionale da riunione',
  'Storia con criteri di accettazione',
  'Modifiche da applicare al tracker',
  'Scenari di test',
  'Note di rilascio',
  'Technical proposal',
]

execFileSync('bash', ['-c', `source "${root}demo/lib/project.sh" && make_demo_project "${work}"`])
cpSync(`${root}apps/desktop/resources/catalogo`, `${work}/catalogo`, { recursive: true })
const kindFile = `${work}/catalogo/verbale/tipo.json`
const change = (from, to) =>
  writeFileSync(kindFile, readFileSync(kindFile, 'utf8').replace(from, to))

/** Opens Octo on «Deliverable», lets the caller look, and closes it. */
async function opened(look) {
  const app = await electron.launch({
    args: [`${root}apps/desktop`],
    env: {
      ...process.env,
      OCTO_DATA_DIR: `${work}/dati`,
      OCTO_CATALOG_DIR: `${work}/catalogo`,
      OCTO_CLAUDE_PATH: `${root}demo/lib/fake-claude`,
      OCTO_MAIL_ROOT: `${work}/Mail-assente`,
      OCTO_DEMO_PLAIN_SECRETS: '1',
      OCTO_DEMO_IDENTITY: 'Paola Verdi <pm@example.test>',
    },
  })
  try {
    const page = await app.firstWindow()
    await page.getByRole('tab', { name: 'Deliverable' }).click()
    await look(page)
  } finally {
    await app.close()
  }
}

await opened(async (page) => {
  for (const title of TITLES) {
    await page.getByText(title, { exact: true }).first().waitFor({ timeout: TIMEOUT_MS })
  }
})
change('"title": "Verbale di riunione"', '"title": "Verbale della riunione"')
await opened(async (page) => {
  await page
    .getByText('Verbale della riunione', { exact: true })
    .first()
    .waitFor({ timeout: TIMEOUT_MS })
})
change('"audience": "internal"', '"audience": "tutti"')
await opened(async (page) => {
  await page
    .getByText(/^Il catalogo dei deliverable di Octo non è leggibile/)
    .first()
    .waitFor({ timeout: TIMEOUT_MS })
  assert.equal(await page.getByText('Email al cliente', { exact: true }).count(), 0)
})
console.log('e2e catalogo: ok')
