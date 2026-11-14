// Opens the built desktop app on a synthetic project, with the fake model, and follows the steps
// of demo 01 in the real window. Run with `pnpm e2e` after `pnpm build`.
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { _electron as electron } from 'playwright'

const root = fileURLToPath(new URL('..', import.meta.url))
const work = `${root}.tmp/e2e`
const TIMEOUT_MS = 20_000

execFileSync('bash', ['-c', `source "${root}demo/lib/project.sh" && make_demo_project "${work}"`])

// OCTO_E2E_EXECUTABLE points the same steps at an installed or packaged app.
const packaged = process.env.OCTO_E2E_EXECUTABLE
const launch = () =>
  electron.launch({
    ...(packaged ? { executablePath: packaged, args: [] } : { args: [`${root}apps/desktop`] }),
    env: {
      ...process.env,
      OCTO_DATA_DIR: `${work}/dati`,
      OCTO_CLAUDE_PATH: `${root}demo/lib/fake-claude`,
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

  // The history survives a restart of the app.
  await app.close()
  app = await launch()
  page = await app.firstWindow()
  await page.getByText('1 punto da controllare').waitFor({ timeout: TIMEOUT_MS })
  console.log('e2e: ok')
} finally {
  await app.close()
}
