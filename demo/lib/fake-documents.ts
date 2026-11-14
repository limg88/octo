// Writes two synthetic Office files into a project folder: an offer in Word and a sheet of
// scenarios in Excel. Usage: node demo/lib/fake-documents.ts <project folder> [changed]
// `changed` rewrites the offer with a different fee, as if someone had edited it.
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { docx, xlsx } from '../../packages/infrastructure/test/support/files.ts'

const [project, changed] = process.argv.slice(2)
if (!project) throw new Error('usage: fake-documents.ts <project folder> [changed]')

const fee = changed ? '15.000' : '12.000'
const cell = (ref: string, text: string) =>
  `<c r="${ref}" t="inlineStr"><is><t>${text}</t></is></c>`
const row = (n: number, label: string, days: number) =>
  `<row r="${n}">${cell(`A${n}`, label)}<c r="B${n}"><v>${days}</v></c></row>`

const folder = join(project, 'Documenti')
mkdirSync(folder, { recursive: true })
writeFileSync(
  join(folder, 'Offerta Aurora.docx'),
  docx([
    'Offerta per il progetto Aurora',
    `Il canone annuo di manutenzione è di ${fee} euro.`,
    'La fatturazione avviene a fine di ogni trimestre.',
  ]),
)
if (!changed) {
  writeFileSync(
    join(folder, 'Scenari.xlsx'),
    xlsx([
      {
        name: 'Giornate',
        rows: row(1, 'Scenario base', 120) + row(2, 'Scenario esteso', 185),
      },
    ]),
  )
}
console.log(`documenti in ${folder}${changed ? ' (offerta modificata)' : ''}`)
