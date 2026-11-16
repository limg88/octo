const DAY_MS = 24 * 60 * 60 * 1000
const SATURDAY = 6
const SUNDAY = 0

/** The first instant of a day written `YYYY-MM-DD`, in UTC. */
export const utcDay = (day: string): Date => new Date(`${day}T00:00:00.000Z`)

const isWorkday = (date: Date): boolean =>
  date.getUTCDay() !== SATURDAY && date.getUTCDay() !== SUNDAY

/** Working days from a day (excluded) to another (included); 0 when the second is not later. */
export function workdaysBetween(from: string, to: string): number {
  let count = 0
  for (let at = utcDay(from).getTime() + DAY_MS; at <= utcDay(to).getTime(); at += DAY_MS) {
    if (isWorkday(new Date(at))) count += 1
  }
  return count
}

/** Days before the end of a sprint in which what is not ready for it is due. */
export const SPRINT_ENDING_WORKDAYS = 2
