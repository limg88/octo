// Opens the built desktop app on a synthetic project, as demo 67 does, and follows its steps in
// the real window: a kind of Octo corrected in words, kept only once approved, and given back.
// Run with `pnpm e2e:correggi` (it builds first).
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { _electron as electron } from 'playwright'

const root = fileURLToPath(new URL('..', import.meta.url))
const work = `${root}.tmp/e2e-correggi`
const TIMEOUT_MS = 20_000
const RULE = 'Non mostrare mai le giornate per persona.'
const corrected = `${work}/Aurora/_octo/.tipi/corretti/stima.md`
const shipped = readFileSync(`${root}apps/desktop/resources/catalogo/stima/istruzioni.md`, 'utf8')

execFileSync('bash', ['-c', `source "${root}demo/lib/project.sh" && make_demo_project "${work}"`])

const app = await electron.launch({
  args: [`${root}apps/desktop`],
  env: {
    ...process.env,
    OCTO_DATA_DIR: `${work}/dati`,
    OCTO_CLAUDE_PATH: `${root}demo/lib/fake-claude`,
    OCTO_MAIL_ROOT: `${work}/Mail-assente`,
    OCTO_DEMO_PLAIN_SECRETS: '1',
    OCTO_DEMO_IDENTITY: 'Paola Verdi <pm@example.test>',
  },
})
try {
  const page = await app.firstWindow()
  await page.getByRole('tab', { name: 'Deliverable' }).click()
  const view = page.getByRole('region', { name: 'Deliverable' })
  await view.getByRole('button', { name: /^Stima/ }).click()
  await view.getByText('Come Octo scrive questo tipo').click()
  const propose = view.getByRole('button', { name: 'Proponi la correzione' })
  assert.equal(await propose.isDisabled(), true)

  // A proposal is shown whole and changes nothing.
  await view.getByLabel('Che cosa va cambiato').fill(RULE)
  await propose.click()
  const proposal = view.getByRole('region', { name: 'Istruzioni proposte' })
  await proposal.getByText(`Regola del PM: ${RULE}`, { exact: false }).waitFor({
    timeout: TIMEOUT_MS,
  })
  assert.equal(existsSync(corrected), false)
  await proposal.getByRole('button', { name: 'Scarta' }).click()
  await proposal.waitFor({ state: 'detached' })

  // Approved, it is kept in the project; what travels with the app is not touched.
  await propose.click()
  await proposal.getByRole('button', { name: 'Usa queste istruzioni' }).click()
  await view.getByText(/^Fatto: da ora questo tipo si scrive così/).waitFor({ timeout: TIMEOUT_MS })
  await view.getByText(/^Questo progetto usa istruzioni corrette da te/).waitFor()
  assert.match(readFileSync(corrected, 'utf8'), new RegExp(`Regola del PM: ${RULE}\\n$`))
  assert.equal(
    readFileSync(`${root}apps/desktop/resources/catalogo/stima/istruzioni.md`, 'utf8'),
    shipped,
  )
  await page.screenshot({ path: `${work}/corretto.png`, fullPage: true })

  // The draft is still written, with the totals the code computes.
  await view.getByLabel(/^Che cosa va stimato/).fill('Migrazione ordini')
  await view.getByRole('button', { name: 'Scrivi la bozza' }).click()
  await view.getByText(/Totale 9,0 gg/).waitFor({ timeout: TIMEOUT_MS })

  // And the project goes back to how Octo writes the kind.
  await view.getByRole('button', { name: 'Nuovo deliverable' }).click()
  await view.getByRole('button', { name: /^Stima/ }).click()
  await view.getByText('Come Octo scrive questo tipo').click()
  await view.getByRole('button', { name: 'Torna alle istruzioni di Octo' }).click()
  await view.getByText('Questo tipo è tornato alle istruzioni di Octo.').waitFor({
    timeout: TIMEOUT_MS,
  })
  assert.equal(readFileSync(corrected, 'utf8'), '')
  assert.equal(await view.getByText(/^Questo progetto usa istruzioni corrette/).count(), 0)
  console.log('e2e correggi: ok')
} finally {
  await app.close()
}
