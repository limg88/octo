// Writes into a project folder what the monthly forecast needs: the spreadsheet the administration
// sends (three project codes, one line each) and the daily costs and rates of the people, all but
// one. Usage: node demo/lib/fake-forecast.ts <project folder> [hours]
// `hours` also says where the timesheets are, for a demo that starts from this screen.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
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
    ],
    monthName,
  ),
)

const settings = join(project, '_octo', '.impostazioni')
mkdirSync(settings, { recursive: true })
// Costa Elena is left out: the demo shows what a missing cost does.
writeFileSync(
  join(settings, 'forecast.json'),
  JSON.stringify(
    {
      modelPath: '',
      hoursPerDay: 8,
      rates: [
        { person: 'Rossi Mario', costPerDay: 220, ratePerDay: 450 },
        { person: 'Bianchi Anna', costPerDay: 200, ratePerDay: 400 },
        { person: 'Verdi Luca', costPerDay: 180, ratePerDay: 380 },
        { person: 'Neri Sara', costPerDay: 160, ratePerDay: 350 },
      ],
      months: {},
    },
    null,
    1,
  ),
)
if (hours && !existsSync(join(settings, 'hours.json'))) {
  writeFileSync(
    join(settings, 'hours.json'),
    JSON.stringify({
      timesheetPath: 'dati/Timesheets',
      worklogPath: `dati/ore-tracker/worklog_${month}.csv`,
      projects: ['PRJ000101'],
    }),
  )
}
