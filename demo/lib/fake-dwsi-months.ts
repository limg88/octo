// A fake NetSuite warehouse for a project sold at a fixed price whose work began two months ago:
// the timesheets of both months are in the warehouse, but Octo holds only those of last month,
// as when the PM read in «Ore» the month it proposes. It also writes what a PM sets once.
// Usage: node demo/lib/fake-dwsi-months.ts <project folder> <app data folder> [no-credential|lifetime|estimate|budget|suppliers]
//        (prints the name of its database and keeps running; SIGTERM drops the database)
// `no-credential` leaves the NetSuite source without its password: Octo cannot read by itself.
// `lifetime` adds what the page of the whole life of the code shows: a second person on the
// timesheets and someone without a timesheet, declared by the PM.
// `estimate` is `lifetime` with the hours logged on the tracker: those of the month that runs,
// not yet in NetSuite, and those of who has no timesheet, counted at the cost of an hour.
// `budget` is `estimate` with the caps in days of the people and no costs at budget written:
// Octo proposes them from the caps.
// It needs the test Postgres: `pnpm db:setup` once.
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { startFakeDwsi } from '../../packages/connectors/test/support/fake-dwsi.ts'
import { worklogCsv } from '../../packages/domain/src/index.ts'

const [project, dataFolder, mode] = process.argv.slice(2)
if (!project || !dataFolder) {
  throw new Error(
    'usage: fake-dwsi-months.ts <project folder> <app data folder> [no-credential|lifetime|estimate|budget]',
  )
}

const PROJECT_ID = 'demo-aurora'
const CODE = 'PRJ000101'
const PM = { name: 'Paola Verdi', email: 'pm@example.test' }
const PERSON = 'Rossi Mario'
const ORDERED = 7500
const BUDGET_COSTS = 4000
const COST_PER_HOUR = 25
/** The hours of the month the work began in, and of the month after: the last complete one. */
const FIRST = { id: 9101, hours: 34 }
const LAST = { id: 9102, hours: 21.5 }
/** The advance already invoiced and the revenue recognised, as shares of the order. */
const INVOICED = ORDERED * 0.3
const RECOGNIZED = ORDERED * 0.7
/** Who has no timesheet on the code: a day declared by the PM, at the cost written once. */
const WITHOUT_TIMESHEET = { name: 'Verdi Sara', hours: 8, costPerDay: 560 }
const SECOND_PERSON = 'Bianchi Luca'

const monthsAgo = (count: number): string => {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - count, 1))
    .toISOString()
    .slice(0, 7)
}
const firstMonth = monthsAgo(2)
const lastMonth = monthsAgo(1)
const budget = mode === 'budget'
const estimate = mode === 'estimate' || budget
/** The most days each person is to spend on the project, as it was sold. */
const CAPS: Array<[name: string, days: number]> = [
  ['Rossi Mario', 2],
  ['Bianchi Luca', 8],
  ['Verdi Sara', 1.5],
]
/** `suppliers` is `lifetime` with an order to a supplier, what it delivered and its invoice. */
const suppliers = mode === 'suppliers'
const lifetime = mode === 'lifetime' || estimate || suppliers
const SUPPLIER = { name: 'Studio Blu Srl', order: 'PO-31', ordered: 2000, received: 1200 }
/** Logged on the tracker in the month that runs: NetSuite gets these hours when it closes. */
const RUNNING = { person: 'Luca Bianchi', hours: 4.5 }
const HOURLY_COST = 70
const row = (work: { id: number; hours: number }, day: string, person = PERSON) =>
  `(${work.id}, 'IT', '${person}', '${day}', '${CODE}', 'Analisi', NULL, NULL, NULL, 'OR',
    ${work.hours}, 'Approved', ${COST_PER_HOUR}, ${work.hours * COST_PER_HOUR})`

/** The revenue the ledger recognises in the last month; the rest is of the first. */
const LAST_REVENUE = 2250
const ledgerRow = (month: string, group: string, cost: number, revenue: number, id: number) =>
  `('${CODE}', ${Number(month.slice(0, 4))}, ${Number(month.slice(5))}, '${group}', ${cost},
    ${cost}, ${revenue}, ${revenue}, ${id}, ${cost})`

const fake = await startFakeDwsi()
await fake.exec(`
  INSERT INTO dwsi.base_employee VALUES
    (90, '${PM.name}', '${PM.email}', NULL, '1980-01-01', '+39 009', 50.0000, 'PM');
  UPDATE dwsi.base_project
    SET "name" = 'Assessment Aurora', projectmanager = '${PM.name}' WHERE projectid = '${CODE}';
  UPDATE dwsi.base_sales_order
    SET item = 'PROG-CORPO', amount = ${ORDERED}, status = 'Pending Billing',
        salesorderdate = '${firstMonth}-01', invoiced = ${INVOICED / ORDERED}
    WHERE projectid = '${CODE}';
  UPDATE dwsi.base_backlog
    SET amount = ${ORDERED}, amountbilled = ${INVOICED}, amountrecognized = ${RECOGNIZED}
    WHERE projectid = '${CODE}';
  -- The invoice of the advance and the ledger of the two months tell the same as the backlog.
  UPDATE dwsi.base_invoice
    SET amount = ${INVOICED}, invoicedate = '${firstMonth}-20', item = 'PROG-CORPO'
    WHERE projectid = '${CODE}';
  DELETE FROM dwsi.base_project_revenue WHERE projectid = '${CODE}';
  INSERT INTO dwsi.base_project_revenue VALUES
    ${ledgerRow(firstMonth, 'Labor (TS)', FIRST.hours * COST_PER_HOUR, RECOGNIZED - LAST_REVENUE, 901)},
    ${ledgerRow(lastMonth, 'Labor (TS)', LAST.hours * COST_PER_HOUR, LAST_REVENUE, 902)}
    ${suppliers ? `, ${ledgerRow(lastMonth, 'Service', SUPPLIER.received, 0, 903)}` : ''};
  ${
    suppliers
      ? `INSERT INTO dwsi.base_purchase_order VALUES
           ('${SUPPLIER.order}', 1, '${firstMonth}-10', 'Pending Bill', '${SUPPLIER.name}',
            'SERVPRO', 5, ${SUPPLIER.ordered}, 0, '${CODE}', 'F', NULL, NULL);
         INSERT INTO dwsi.base_item_receipt VALUES
           (7001, 1, 31, '${SUPPLIER.order}', '${lastMonth}-28', '${SUPPLIER.name}', 'SERVPRO',
            'Consulenza', 3, 400, ${SUPPLIER.received}, '${CODE}');
         INSERT INTO dwsi.base_invoice_po VALUES
           ('FF-12', 1, 'Open', '${lastMonth}-30', '${SUPPLIER.name}', 'SERVPRO',
            ${-SUPPLIER.received}, '${CODE}', '${SUPPLIER.order}', 'Bill', NULL);`
      : ''
  }
  DELETE FROM dwsi.base_timesheet WHERE projectid = '${CODE}';
  INSERT INTO dwsi.base_timesheet VALUES
    ${row(FIRST, `${firstMonth}-15`)},
    ${row(LAST, `${lastMonth}-06`, lifetime ? SECOND_PERSON : PERSON)};
`)

const write = (file: string, value: unknown) => {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(value, null, 1))
}
const settings = join(project, '_octo', '.impostazioni')

write(join(settings, 'sources.json'), {
  mail: null,
  dwsi: {
    since: `${firstMonth}-01`,
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
write(
  join(dataFolder, 'secrets.json'),
  mode === 'no-credential'
    ? {}
    : { [`${PROJECT_ID}/dwsi`]: Buffer.from(fake.reader.password).toString('base64') },
)
// What Octo holds: last month only, read from the company's system after the month ended.
const header = { exported_at: new Date().toISOString(), source: 'NetSuite' }
write(join(project, '_octo', 'ore', 'netsuite', `timesheet_${lastMonth}.json`), {
  ...header,
  rows: [
    {
      internalid: LAST.id,
      employee: lifetime ? SECOND_PERSON : PERSON,
      timesheetdate: `${lastMonth}-06`,
      projectid: CODE,
      duration: LAST.hours,
      approvalstatus: 'Approved',
    },
  ],
})
write(join(project, '_octo', '.riservato', 'costi', `timesheet_${lastMonth}.json`), {
  ...header,
  rows: [{ internalid: LAST.id, laborcost_new: LAST.hours * COST_PER_HOUR }],
})
const thisMonth = monthsAgo(0)
if (estimate) {
  // The hours of the tracker as «Ore» keeps them after reading Jira: one file per month.
  const logged = [
    {
      issue: 'AUR-1',
      person: 'Sara Verdi',
      day: `${lastMonth}-20`,
      hours: WITHOUT_TIMESHEET.hours,
    },
    { issue: 'AUR-3', person: RUNNING.person, day: `${thisMonth}-01`, hours: RUNNING.hours },
  ]
  for (const month of [lastMonth, thisMonth]) {
    const file = join(project, '_octo', 'ore', 'jira', `worklog_${month}.csv`)
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, worklogCsv(logged.filter((entry) => entry.day.startsWith(month))))
  }
}
write(join(settings, 'hours.json'), {
  timesheetPath: '_octo/ore/netsuite',
  worklogPath: estimate ? '_octo/ore/jira' : '',
  projects: [CODE],
})
write(join(settings, 'forecast.json'), {
  projects: {
    [CODE]: {
      kind: 'fixed_price',
      description: 'Assessment Aurora',
      ordered: ORDERED,
      feeMonths: null,
      startMonth: firstMonth,
    },
  },
  hourlyCosts: estimate ? [{ person: WITHOUT_TIMESHEET.name, costPerHour: HOURLY_COST }] : [],
  externals:
    lifetime && !estimate
      ? [
          {
            name: WITHOUT_TIMESHEET.name,
            code: CODE,
            costPerDay: WITHOUT_TIMESHEET.costPerDay,
            ratePerDay: 0,
          },
        ]
      : [],
  months: {
    [lastMonth]: {
      [CODE]: {
        ...(budget ? {} : { budgetCosts: BUDGET_COSTS }),
        externals:
          lifetime && !estimate
            ? [{ name: WITHOUT_TIMESHEET.name, hours: WITHOUT_TIMESHEET.hours }]
            : [],
      },
    },
  },
})

if (budget) {
  write(join(settings, 'team.json'), {
    people: CAPS.map(([name, capDays]) => ({ name, role: 'Team', side: 'supplier', capDays })),
    periods: [],
  })
}

console.log(fake.database)
// The database lives while the demo runs, and is dropped when the demo ends.
const alive = setInterval(() => {}, 60_000)
process.on('SIGTERM', () => {
  clearInterval(alive)
  void fake.drop().finally(() => process.exit(0))
})
