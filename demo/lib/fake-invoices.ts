// Writes into a project folder what the company system would have said of an order: the invoices
// of two sales orders, as the feed of NetSuite writes the rows of its view, and an order of the
// client with four positions, of which two are billed. Which sales order is the order of the
// client is said in the demo.
// Usage: node demo/lib/fake-invoices.ts <project folder>
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { renderSyncFile } from '../../packages/connectors/src/folder/sync-file.ts'

const [project] = process.argv.slice(2)
if (!project) throw new Error('usage: fake-invoices.ts <project folder>')

const FOLDER = '_octo/fonti/NetSuite'
const VIEW = 'v_invoice_all'
const now = new Date()

const line = (
  invoiceid: string,
  amount: number,
  salesorder: string,
  invoicedate: string,
  status = 'Open',
) => ({
  key: `${invoiceid}|1`,
  values: {
    projectid: 'PRJ000101',
    invoiceid,
    lineid: 1,
    status,
    invoicedate,
    item: 'SERVPRO',
    amount,
    annocompetenza: 2026,
    salesorder,
    type: 'Invoice',
  },
})

mkdirSync(join(project, FOLDER, 'v-invoice-all'), { recursive: true })
writeFileSync(
  join(project, FOLDER, 'v-invoice-all', 'prj-prj000101.md'),
  renderSyncFile({
    system: 'dwsi',
    type: 'rows',
    body: `# ${VIEW} — prj:PRJ000101\n`,
    rows: {
      view: VIEW,
      perimeter: 'prj:PRJ000101',
      extractedAt: now,
      sourceSyncedAt: now,
      rows: [
        line('2026/01530', 42130, 'SO2026_5320', '2026-09-30'),
        line('2026/01797', 63190, 'SO2026_5320', '2026-10-31'),
        line('2026/00582', 9900, 'SO2026_4697', '2026-03-31', 'Paid In Full'),
      ],
    },
  }),
)

// The source is linked: Octo knows where the company system is written.
const settings = join(project, '_octo', '.impostazioni')
mkdirSync(settings, { recursive: true })
const sourcesFile = join(settings, 'sources.json')
let sources: Record<string, unknown> = {}
try {
  sources = JSON.parse(readFileSync(sourcesFile, 'utf8'))
} catch {
  sources = {}
}
writeFileSync(
  sourcesFile,
  JSON.stringify(
    {
      ...sources,
      dwsi: {
        since: '2026-01-01',
        targetFolder: FOLDER,
        host: 'dwsi.example.test',
        port: 5432,
        database: 'dwsi',
        user: 'pm',
        ownerEmail: 'pm@example.test',
        tls: 'verify_full',
        projectCodes: ['PRJ000101'],
      },
    },
    null,
    1,
  ),
)

// The order of the client, already typed: four positions, nothing asked through Octo yet.
const progressFile = join(settings, 'progress.json')
const progress = JSON.parse(readFileSync(progressFile, 'utf8'))
writeFileSync(
  progressFile,
  JSON.stringify(
    {
      ...progress,
      order: 'ING01526',
      total: 231700,
      positions: [
        { code: '00001', amount: 42130 },
        { code: '00002', amount: 63190 },
        { code: '00003', amount: 63190 },
        { code: '00004', amount: 63190 },
      ],
      requests: [],
    },
    null,
    1,
  ),
)
