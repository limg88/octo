// Writes into a project folder what a progress request needs: the empty form of the client and
// the map that says which cell takes what, set once. The order and the requests are typed in
// the demo. Usage: node demo/lib/fake-progress.ts <project folder>
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  PROGRESS_FORM_TABLE,
  progressFormXlsx,
} from '../../packages/infrastructure/test/support/progress-form-xlsx.ts'

const [project] = process.argv.slice(2)
if (!project) throw new Error('usage: fake-progress.ts <project folder>')

const MODEL = 'Moduli/Richiesta stato avanzamento.xlsx'
const SUPPLIER = 'Fornitore Demo S.p.A.'

mkdirSync(join(project, 'Moduli'), { recursive: true })
writeFileSync(join(project, MODEL), progressFormXlsx())

const settings = join(project, '_octo', '.impostazioni')
mkdirSync(settings, { recursive: true })
writeFileSync(
  join(settings, 'progress.json'),
  JSON.stringify(
    {
      modelPath: MODEL,
      form: {
        fields: [
          { ref: 'D2', text: '{n}' },
          { ref: 'A4', text: SUPPLIER },
          { ref: 'C4', text: '{ordine} - pos.{posizioni}' },
          { ref: 'B7', text: 'AL : {al_precedente}' },
          { ref: 'C7', text: 'AL : {al}' },
          { ref: 'A16', text: '{al}' },
          { ref: 'C16', text: SUPPLIER },
          { ref: 'A19', text: '{nota}' },
        ],
        table: { ...PROGRESS_FORM_TABLE, position: 'A', previous: 'B', current: 'C', period: 'D' },
      },
    },
    null,
    1,
  ),
)
