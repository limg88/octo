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

/** Who worked, the hours a day on the timesheet and on the tracker, and the name the tracker uses. */
export const PEOPLE: Array<{
  name: string
  timesheet: number
  tracker: number
  trackerName: string
}> = [
  { name: 'Rossi Mario', timesheet: 8, tracker: 8, trackerName: 'Mario Rossi' },
  { name: 'Bianchi Anna', timesheet: 8, tracker: 4, trackerName: 'Anna Bianchi' },
  { name: 'Verdi Luca', timesheet: 8, tracker: 7.5, trackerName: 'luca.verdi' },
  { name: 'Neri Sara', timesheet: 4, tracker: 0, trackerName: '' },
  { name: '', timesheet: 0, tracker: 6, trackerName: 'Ugo Gialli' },
  { name: 'Costa Elena', timesheet: 6, tracker: 6, trackerName: 'E. Costa' },
]
