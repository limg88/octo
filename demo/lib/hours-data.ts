// The synthetic hours of the demos: who worked last month, on the timesheet and on the tracker.
export const today = new Date()
const first = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1))
export const month = first.toISOString().slice(0, 7)
export const WORKING_DAYS = 20
export const days: string[] = []
for (
  const day = new Date(first);
  days.length < WORKING_DAYS;
  day.setUTCDate(day.getUTCDate() + 1)
) {
  if (day.getUTCDay() !== 0 && day.getUTCDay() !== 6) days.push(day.toISOString().slice(0, 10))
}

/**
 * Who worked, the hours a day on the timesheet and on the tracker, the name the tracker uses and
 * what a day of theirs costs, which the company system writes on every row of timesheet.
 */
export const PEOPLE: Array<{
  name: string
  timesheet: number
  tracker: number
  trackerName: string
  costPerDay: number
}> = [
  { name: 'Rossi Mario', timesheet: 8, tracker: 8, trackerName: 'Mario Rossi', costPerDay: 220 },
  { name: 'Bianchi Anna', timesheet: 8, tracker: 4, trackerName: 'Anna Bianchi', costPerDay: 200 },
  { name: 'Verdi Luca', timesheet: 8, tracker: 7.5, trackerName: 'luca.verdi', costPerDay: 180 },
  { name: 'Neri Sara', timesheet: 4, tracker: 0, trackerName: '', costPerDay: 160 },
  { name: '', timesheet: 0, tracker: 6, trackerName: 'Ugo Gialli', costPerDay: 0 },
  { name: 'Costa Elena', timesheet: 6, tracker: 6, trackerName: 'E. Costa', costPerDay: 190 },
]
