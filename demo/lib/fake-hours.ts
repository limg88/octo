// Writes synthetic hours into a project folder: the timesheets of last month as the company
// system exports them (kept twice, split and merged, as it happens) and the hours logged on
// the tracker as its time-tracking tool exports them.
// Usage: node demo/lib/fake-hours.ts <project folder>
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const [project] = process.argv.slice(2)
if (!project) throw new Error('usage: fake-hours.ts <project folder>')

import { days, month, PEOPLE, today, WORKING_DAYS } from './hours-data.ts'

const PROJECT_CODE = 'PRJ000101'
const OTHER_CODE = 'PRJ000999'

let id = 5000
const rows: object[] = []
const logged: string[] = ['Issue Key;Work date;Hours;Username;Full name']
for (const [index, day] of days.entries()) {
  for (const person of PEOPLE) {
    if (person.timesheet > 0) {
      id += 1
      rows.push({
        internalid: id,
        employee: person.name,
        timesheetdate: day,
        projectid: PROJECT_CODE,
        duration: person.timesheet,
        // The last two days of the month are still to be approved.
        approvalstatus:
          index >= WORKING_DAYS - 2 && person.name === 'Rossi Mario' ? 'Open' : 'Approved',
      })
    }
    if (person.tracker > 0) {
      const hours = String(person.tracker).replace('.', ',')
      const [d, m, y] = [day.slice(8, 10), day.slice(5, 7), day.slice(0, 4)]
      logged.push(
        `AUR-${100 + index};${d}/${m}/${y};${hours};u${PEOPLE.indexOf(person)};${person.trackerName}`,
      )
    }
  }
}
id += 1
rows.push({
  internalid: id,
  employee: 'Rossi Mario',
  timesheetdate: days[0],
  projectid: OTHER_CODE,
  duration: 8,
  approvalstatus: 'Approved',
})

const meta = { month, extracted_at: today.toISOString() }
const timesheets = join(project, 'dati', 'Timesheets', month)
mkdirSync(timesheets, { recursive: true })
const half = Math.floor(rows.length / 2)
writeFileSync(
  join(timesheets, `netsuite_${month}_A.json`),
  JSON.stringify({ ...meta, rows: rows.slice(0, half) }, null, 1),
)
writeFileSync(
  join(timesheets, `netsuite_${month}_all.json`),
  JSON.stringify({ ...meta, rows }, null, 1),
)
const tracker = join(project, 'dati', 'ore-tracker')
mkdirSync(tracker, { recursive: true })
writeFileSync(join(tracker, `worklog_${month}.csv`), `${logged.join('\n')}\n`)
