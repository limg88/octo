// Opens the built desktop app on the project of demo 63, with the fake model, and follows its
// steps in the real window: the progress form and the alignment of a sprint as deliverables of
// the project made by a script. The fake Claude runs the scripts for real, with the interpreter
// Octo ships; the form is filled by Octo. Run with `pnpm e2e:script` (it builds first).
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { _electron as electron } from 'playwright'
import { createXlsxModel } from '../packages/infrastructure/src/index.ts'

const root = fileURLToPath(new URL('..', import.meta.url))
const work = `${root}.tmp/e2e-script`
const TIMEOUT_MS = 30_000
const project = `${work}/Aurora`

execFileSync('node', [`${root}apps/desktop/scripts/fetch-python.mjs`])
execFileSync('bash', ['-c', `source "${root}demo/lib/project.sh" && make_demo_project "${work}"`])
for (const fake of ['fake-progress', 'fake-alignment', 'fake-scripted']) {
  execFileSync('node', [`${root}demo/lib/${fake}.ts`, project])
}
const kept = (name) => readFileSync(`${project}/_octo/.impostazioni/${name}`, 'utf8')
const settingsBefore = { progress: kept('progress.json'), alignment: kept('alignment.json') }
const formBefore = readFileSync(`${project}/Moduli/Richiesta stato avanzamento.xlsx`)

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
  const scripted = page.getByRole('region', { name: 'Deliverable del progetto, con script' })
  await scripted.waitFor({ timeout: TIMEOUT_MS })
  // Both travel with the app: each is started in the project, taking over what its section kept.
  for (const _ of [1, 2]) {
    await scripted.getByRole('button', { name: 'Aggiungi al progetto' }).first().click()
  }
  const form = scripted.getByRole('region', { name: 'Modulo di avanzamento' })
  const sprint = scripted.getByRole('region', { name: 'Allineamento dello sprint' })
  await form.waitFor({ timeout: TIMEOUT_MS })
  await sprint.waitFor({ timeout: TIMEOUT_MS })
  const folder = `${project}/_octo/.deliverable`
  const config = (slug) => JSON.parse(readFileSync(`${folder}/${slug}/config.json`, 'utf8'))
  assert.equal(config('avanzamento').order, 'ORD-2026-077')
  assert.equal(config('allineamento').sprint, 'Sprint 28')
  // The settings the sections kept are still there, as they were.
  assert.equal(kept('progress.json'), settingsBefore.progress)
  assert.equal(kept('alignment.json'), settingsBefore.alignment)

  // The progress form of request 1: computed by the script, filled by Octo, kept when told.
  await form.getByLabel(/^Numero della richiesta/).fill('1')
  await form.getByRole('button', { name: 'Esegui' }).click()
  await form
    .getByText(/^Richiesta 1: chiesto fin qui 289540,00 su 340000,00/)
    .waitFor({ timeout: TIMEOUT_MS })
  await form.getByText(/Richiesta stato avanzamento - 1\.xlsx, quote\.csv/).waitFor()
  const filledPath = `${project}/_octo/deliverable/avanzamento/Richiesta stato avanzamento - 1.xlsx`
  assert.ok(!existsSync(filledPath))
  await form.getByRole('button', { name: 'Salva nel progetto' }).click()
  await form
    .getByText('Salvati nel progetto, in _octo/deliverable/avanzamento.')
    .waitFor({ timeout: TIMEOUT_MS })
  // The empty form of the client is untouched; the copy has the shares of the request.
  assert.ok(readFileSync(`${project}/Moduli/Richiesta stato avanzamento.xlsx`).equals(formBefore))
  const cells = new Map(
    createXlsxModel()
      .read(readFileSync(filledPath))
      .rows.flatMap((row) => row.cells.map((cell) => [cell.ref, cell.text])),
  )
  assert.equal(cells.get('D2'), '1')
  assert.equal(cells.get('C4'), 'ORD-2026-077 - pos.00001:00004')
  await page.screenshot({ path: `${work}/avanzamento.png`, fullPage: true })

  // The alignment of the sprint: the missing tickets as a file to import by hand.
  await sprint.getByRole('button', { name: 'Esegui' }).click()
  await sprint.getByText(/^Sprint «Sprint 28»: 6 voci, /).waitFor({ timeout: TIMEOUT_MS })
  await sprint.getByRole('button', { name: 'Salva nel progetto' }).click()
  await sprint
    .getByText('Salvati nel progetto, in _octo/deliverable/allineamento.')
    .waitFor({ timeout: TIMEOUT_MS })
  const missing = readFileSync(
    `${project}/_octo/deliverable/allineamento/mancanti_sprint-28.csv`,
    'utf8',
  )
  assert.match(missing, /^Summary,Issue Type,Priority,Assignee,Description,Sprint\r\n/)
  assert.match(missing, /\[AZDO 105\] Ricerca ordini per cliente,Story,,Mario Rossi,,Sprint 28/)

  // A correction in words is tried in the work folder, and reaches the project when approved.
  await sprint.getByText('Correggi a parole').click()
  await sprint
    .getByLabel('Che cosa cambiare in «Allineamento dello sprint»')
    .fill('sprint=Sprint 27')
  await sprint.getByRole('button', { name: 'Prova la correzione' }).click()
  const proposed = sprint.getByRole('region', { name: 'Correzione proposta' })
  await proposed
    .getByText(/^File cambiati: config\.json, istruzioni\.md\.$/)
    .waitFor({ timeout: TIMEOUT_MS })
  assert.equal(config('allineamento').sprint, 'Sprint 28')
  await proposed.getByRole('button', { name: 'Approva la correzione' }).click()
  await proposed.getByText(/^Correzione approvata/).waitFor({ timeout: TIMEOUT_MS })
  assert.equal(config('allineamento').sprint, 'Sprint 27')
  console.log('e2e script: ok')
} finally {
  await app.close()
}
