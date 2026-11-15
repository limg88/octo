/** Hours a person logged on a day, wherever they were logged. */
export type HoursEntry = {
  person: string
  /** `YYYY-MM-DD`. */
  day: string
  hours: number
  /** The project code of the timesheet system; null where the source has none. */
  project: string | null
  /** False for hours still to be approved: they never enter a comparison. */
  approved: boolean
  /** The id the source gives the row, when it has one: the same row in two files counts once. */
  id: string | null
  /**
   * What the row cost the company, as the timesheet system wrote it; absent or null where the
   * source does not say.
   */
  cost?: number | null
}

/** How a project compares the hours of its timesheets with those logged on its tracker. */
export type HoursSettings = {
  /** A file or a folder of timesheet exports inside the project folder. */
  timesheetPath: string
  /** A file or a folder of exports of the hours logged on the tracker. */
  worklogPath: string
  /** Timesheet project codes that belong to this project; none: all of them. */
  projects: string[]
  /** A difference above this share of the timesheet hours is shown as an outlier. */
  thresholdPct: number
  /** Days after this one are not complete yet: left out of the comparison. Empty: none. */
  cutoff: string
  /** People who do not log on the tracker: their missing hours are expected. */
  noWorklogExpected: string[]
  /** People with no timesheet here (external consultants): expected as well. */
  noTimesheetExpected: string[]
  /** A name as the tracker writes it, and the same person as the timesheets write it. */
  aliases: Array<{ worklog: string; timesheet: string }>
}

export const DEFAULT_HOURS_SETTINGS: HoursSettings = {
  timesheetPath: '',
  worklogPath: '',
  projects: [],
  thresholdPct: 20,
  cutoff: '',
  noWorklogExpected: [],
  noTimesheetExpected: [],
  aliases: [],
}

const MARKS = /[̀-ͯ]/g
const NOT_A_LETTER = /[^a-z ]+/g

/**
 * A person whatever the order and the spelling of the name: `Rossi, Mario`, `MARIO ROSSI` and
 * `mario.rossi` are one. Codes and numbers around the name do not count.
 */
export function personKey(name: string): string {
  return name
    .normalize('NFD')
    .replace(MARKS, '')
    .toLowerCase()
    .replace(/[._,;-]+/g, ' ')
    .replace(NOT_A_LETTER, ' ')
    .split(/\s+/)
    .filter((part) => part !== '')
    .sort()
    .join(' ')
}

const MIN_THRESHOLD = 0
const MAX_THRESHOLD = 1000
const DAY = /^\d{4}-\d{2}-\d{2}$/

const cleanList = (values: readonly string[]): string[] => [
  ...new Set(values.map((value) => value.trim()).filter((value) => value !== '')),
]

/** Settings as the PM typed them, made tidy. */
export function cleanHoursSettings(settings: HoursSettings): HoursSettings {
  const threshold = Number.isFinite(settings.thresholdPct)
    ? Math.min(MAX_THRESHOLD, Math.max(MIN_THRESHOLD, settings.thresholdPct))
    : DEFAULT_HOURS_SETTINGS.thresholdPct
  return {
    timesheetPath: settings.timesheetPath.trim(),
    worklogPath: settings.worklogPath.trim(),
    projects: cleanList(settings.projects),
    thresholdPct: threshold,
    cutoff: DAY.test(settings.cutoff.trim()) ? settings.cutoff.trim() : '',
    noWorklogExpected: cleanList(settings.noWorklogExpected),
    noTimesheetExpected: cleanList(settings.noTimesheetExpected),
    aliases: settings.aliases
      .map((alias) => ({ worklog: alias.worklog.trim(), timesheet: alias.timesheet.trim() }))
      .filter((alias) => personKey(alias.worklog) !== '' && personKey(alias.timesheet) !== ''),
  }
}
