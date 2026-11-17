// A project that sells days and has just moved to a new project code: the same people worked last
// month on the old code and on the new one, which has no rate yet. The settings also hold data of
// last month on a code that is no longer of the project.
// Usage: node demo/lib/fake-forecast-new-code.ts <project folder> [worklog]
// `worklog` adds the hours logged on the tracker in the month that runs, under a user name:
// the comparison of the hours shows the person by name and surname all the same.
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { worklogCsv } from '../../packages/domain/src/index.ts'
import { month } from './hours-data.ts'

const [project, withWorklog] = process.argv.slice(2)
if (!project) throw new Error('usage: fake-forecast-new-code.ts <project folder> [worklog]')

const OLD = 'PRJ000606'
const NEW = 'PRJ000707'
const GONE = 'PRJ000505'
const HOURS_PER_DAY = 8
/** Who worked last month: days on the old code, days on the new one, the rate on the old one. */
const PEOPLE: Array<{
  name: string
  old: number
  next: number
  rate: number | null
  cost: number
}> = [
  { name: 'Rossi Mario', old: 10, next: 5, rate: 400, cost: 220 },
  { name: 'Bianchi Anna', old: 8, next: 5, rate: 420, cost: 200 },
  { name: 'Verdi Luca', old: 0, next: 4, rate: 480, cost: 240 },
  // New on the project: no rate on any code.
  { name: 'Neri Sara', old: 0, next: 5, rate: null, cost: 160 },
]

let id = 0
const rows = PEOPLE.flatMap((person) =>
  // The days on the new code come after those on the old one: never the same day on both.
  [
    [OLD, person.old, 0],
    [NEW, person.next, person.old],
  ].flatMap(([code, days, after]) =>
    Array.from({ length: Number(days) }, (_, day) => {
      id += 1
      return {
        internalid: id,
        employee: person.name,
        timesheetdate: `${month}-${String(Number(after) + day + 1).padStart(2, '0')}`,
        projectid: code,
        duration: HOURS_PER_DAY,
        approvalstatus: 'Approved',
        laborcost_new: person.cost,
      }
    }),
  ),
)

const write = (file: string, value: unknown) => {
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(value, null, 1))
}
const settings = join(project, '_octo', '.impostazioni')
write(join(project, 'dati', 'Timesheets', `timesheet_${month}.json`), { rows })
const thisMonth = new Date().toISOString().slice(0, 7)
if (withWorklog) {
  const file = join(project, '_octo', 'ore', 'jira', `worklog_${thisMonth}.csv`)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(
    file,
    worklogCsv([
      { issue: 'AUR-7', person: 'mario.rossi', day: `${thisMonth}-01`, hours: 6 },
      { issue: 'AUR-7', person: 'ugo.gialli', day: `${thisMonth}-01`, hours: 2 },
    ]),
  )
}
write(join(settings, 'hours.json'), {
  timesheetPath: 'dati/Timesheets',
  worklogPath: withWorklog ? '_octo/ore/jira' : '',
  projects: [OLD, NEW],
})
write(join(settings, 'forecast.json'), {
  modelPath: '',
  projects: {
    [OLD]: { kind: 'time_material', description: 'Aurora PI6', ordered: 120000 },
    [NEW]: { kind: 'time_material', description: 'Aurora PI7', ordered: 90000 },
  },
  hoursPerDay: HOURS_PER_DAY,
  // The rates are written code by code: the old code has them, the new one has none.
  rates: PEOPLE.flatMap((person) =>
    person.rate === null ? [] : [{ person: person.name, code: OLD, ratePerDay: person.rate }],
  ),
  externals: [{ name: 'Studio Blu', code: GONE, costPerDay: 300, ratePerDay: 500 }],
  months: {
    // Written when the code was still of the project: nobody counts these hours any more.
    [month]: { [GONE]: { externals: [{ name: 'Studio Blu', hours: 174 }] } },
  },
})
