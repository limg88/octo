// A fake NetSuite warehouse for the forecast of a project sold at a fixed price: the project code
// `PRJ000101`, managed by the PM of the demo, with one sales order whose item is `PROG-CORPO`.
// It also writes what a PM sets once: the NetSuite source with its credential, and where the
// timesheets of the project are.
// Usage: node demo/lib/fake-dwsi-forecast.ts <project folder> <app data folder>
//        (prints the name of its database and keeps running; SIGTERM drops the database)
// It needs the test Postgres: `pnpm db:setup` once.
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { startFakeDwsi } from '../../packages/connectors/test/support/fake-dwsi.ts'
import { month } from './hours-data.ts'

const [project, dataFolder] = process.argv.slice(2)
if (!project || !dataFolder) {
  throw new Error('usage: fake-dwsi-forecast.ts <project folder> <app data folder>')
}

const PROJECT_ID = 'demo-aurora'
const CODE = 'PRJ000101'
const PM = { name: 'Paola Verdi', email: 'pm@example.test' }
const ORDERED = 40000

const fake = await startFakeDwsi()
await fake.exec(`
  INSERT INTO dwsi.base_employee VALUES
    (90, '${PM.name}', '${PM.email}', NULL, '1980-01-01', '+39 009', 50.0000, 'PM');
  UPDATE dwsi.base_project
    SET "name" = 'Assessment WSO2 ESB', projectmanager = '${PM.name}' WHERE projectid = '${CODE}';
  UPDATE dwsi.base_sales_order
    SET item = 'PROG-CORPO', amount = ${ORDERED}, status = 'Pending Billing'
    WHERE projectid = '${CODE}';
`)

const settings = join(project, '_octo', '.impostazioni')
mkdirSync(settings, { recursive: true })
mkdirSync(dataFolder, { recursive: true })
const write = (file: string, value: unknown) => writeFileSync(file, JSON.stringify(value, null, 1))

write(join(settings, 'sources.json'), {
  mail: null,
  dwsi: {
    since: `${month}-01`,
    targetFolder: '_octo/fonti/NetSuite',
    // Any name of a private host: in a demo every warehouse is the one on this computer.
    host: 'netsuite.demo.test',
    port: fake.port,
    database: fake.database,
    user: fake.reader.user,
    ownerEmail: PM.email,
    projectCodes: [CODE],
    // The test Postgres speaks no TLS: a demo on this computer only.
    tls: 'plaintext',
  },
})
write(join(dataFolder, 'secrets.json'), {
  [`${PROJECT_ID}/dwsi`]: Buffer.from(fake.reader.password).toString('base64'),
})
// The timesheets are the files demo/lib/fake-hours.ts wrote; the only code of the project.
write(join(settings, 'hours.json'), {
  timesheetPath: 'dati/Timesheets',
  worklogPath: `dati/ore-tracker/worklog_${month}.csv`,
  projects: [CODE],
})

console.log(fake.database)
// The database lives while the demo runs, and is dropped when the demo ends.
const alive = setInterval(() => {}, 60_000)
process.on('SIGTERM', () => {
  clearInterval(alive)
  void fake.drop().finally(() => process.exit(0))
})
