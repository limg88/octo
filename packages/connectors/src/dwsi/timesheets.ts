import { DWSI_SCHEMA, DWSI_VIEWS, type DwsiView, MAX_TEXT_CHARACTERS } from './views.ts'

/** The days to read, both included, `YYYY-MM-DD`. */
export interface TimesheetPeriod {
  from: string
  to: string
}

/**
 * One row of hours as the reconciliation and the forecast need it: who, which day, how long, on
 * which project, whether it is approved and what the row cost. Never the notes or anything else
 * personal. The cost is for the forecast only: who receives it keeps it apart from what is read.
 */
export interface DwsiTimesheetRow {
  /** As the warehouse writes it: the id is too wide for a number. */
  internalid: string | number | null
  projectid: string
  employee: string | null
  timesheetdate: string | null
  /** Hours, as the warehouse writes a decimal: a text such as `7.5000`. */
  duration: string | number | null
  approvalstatus: string | null
  /** What the row cost, as the warehouse writes a decimal. */
  laborcost_new: string | number | null
}

const WANTED = [
  'internalid',
  'projectid',
  'employee',
  'timesheetdate',
  'duration',
  'approvalstatus',
  'laborcost_new',
]
const DAY = /^\d{4}-\d{2}-\d{2}$/

const whole = DWSI_VIEWS.find((view) => view.category === 'timesheet') as DwsiView

/** The timesheet view narrowed to the columns of a row of hours. */
export const TIMESHEET_HOURS_VIEW: DwsiView = {
  ...whole,
  columns: whole.columns.filter((column) => WANTED.includes(column.name)),
  people: ['employee'],
}

export function checkedTimesheetPeriod(period: TimesheetPeriod): TimesheetPeriod {
  const valid =
    DAY.test(period.from) &&
    DAY.test(period.to) &&
    period.from <= period.to &&
    !Number.isNaN(Date.parse(period.from)) &&
    !Number.isNaN(Date.parse(period.to))
  if (!valid) throw new TypeError('a period of days')
  return period
}

/**
 * The fixed query of the hours of one project over a period: the declared columns, by day and
 * id, one row too many. Project and days are parameters, never pieces of the query.
 */
export function timesheetHoursQuery(limit: number): string {
  const columns = TIMESHEET_HOURS_VIEW.columns.map((column) =>
    column.type === 'character varying'
      ? `left(t."${column.name}", ${MAX_TEXT_CHARACTERS}) AS "${column.name}"`
      : `t."${column.name}"`,
  )
  return (
    `SELECT ${columns.join(', ')} FROM ${DWSI_SCHEMA}."${TIMESHEET_HOURS_VIEW.name}" AS t ` +
    `WHERE t."projectid" = $1 AND t."timesheetdate" >= $2::date AND t."timesheetdate" <= $3::date ` +
    `ORDER BY t."timesheetdate" NULLS LAST, t."internalid" NULLS LAST LIMIT ${limit + 1}`
  )
}
