// Writes into a project folder what the monthly forecast needs: the three project codes of the
// project with how each is sold and what was ordered, the daily rates of the people, all but
// one, and the spreadsheet the administration sends (those codes and one of another PM).
// Usage: node demo/lib/fake-forecast.ts <project folder> [hours]
// `hours` also says where the timesheets are, for a demo that starts from this screen.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { forecastModelXlsx } from '../../packages/infrastructure/test/support/forecast-xlsx.ts'
import { month } from './hours-data.ts'

const [project, hours] = process.argv.slice(2)
if (!project) throw new Error('usage: fake-forecast.ts <project folder> [hours]')

const monthName = new Intl.DateTimeFormat('it-IT', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
}).format(new Date(`${month}-01T00:00:00Z`))

const folder = join(project, 'Amministrazione')
mkdirSync(folder, { recursive: true })
writeFileSync(
  join(folder, 'Previsionale avanzamenti.xlsx'),
  forecastModelXlsx(
    [
      {
        client: 'Cliente Aurora',
        code: 'PRJ000101',
        description: 'Sviluppo a giornate',
        ordered: 120000,
      },
      {
        client: 'Cliente Aurora',
        code: 'PRJ000202',
        description: 'Migrazione a corpo',
        ordered: 40000,
      },
      { client: 'Cliente Aurora', code: 'PRJ000303', description: 'Assistenza', ordered: 15000 },
      { client: 'Cliente Altro', code: 'PRJ000404', description: 'Di un altro PM', ordered: 9000 },
    ],
    monthName,
  ),
)

const settings = join(project, '_octo', '.impostazioni')
mkdirSync(settings, { recursive: true })
// Costa Elena is left out: the demo shows what a missing rate does.
writeFileSync(
  join(settings, 'forecast.json'),
  JSON.stringify(
    {
      modelPath: '',
      projects: {
        PRJ000101: { kind: 'time_material', description: 'Sviluppo a giornate', ordered: 120000 },
        PRJ000202: { kind: 'fixed_price', description: 'Migrazione a corpo', ordered: 40000 },
        PRJ000303: { kind: 'fee', description: 'Assistenza', ordered: 15000, feeMonths: 12 },
      },
      hoursPerDay: 8,
      rates: [
        { person: 'Rossi Mario', code: null, ratePerDay: 450 },
        { person: 'Bianchi Anna', code: null, ratePerDay: 400 },
        { person: 'Verdi Luca', code: null, ratePerDay: 380 },
        { person: 'Neri Sara', code: null, ratePerDay: 350 },
      ],
      externals: [],
      months: {},
    },
    null,
    1,
  ),
)
// The codes of the project are the ones «Ore» keeps: the forecast shows those and no other.
const PROJECT_CODES = ['PRJ000101', 'PRJ000202', 'PRJ000303']
const hoursFile = join(settings, 'hours.json')
if (existsSync(hoursFile)) {
  const kept = JSON.parse(readFileSync(hoursFile, 'utf8'))
  writeFileSync(hoursFile, JSON.stringify({ ...kept, projects: PROJECT_CODES }))
} else if (hours) {
  writeFileSync(
    hoursFile,
    JSON.stringify({
      timesheetPath: 'dati/Timesheets',
      worklogPath: `dati/ore-tracker/worklog_${month}.csv`,
      projects: PROJECT_CODES,
    }),
  )
}
