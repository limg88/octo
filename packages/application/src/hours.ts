import {
  cleanHoursSettings,
  DomainError,
  type HoursEntry,
  type HoursPeriod,
  type HoursSettings,
  monthsOf,
  NO_TEAM,
  OCTO_FOLDER,
  type Project,
  type ProjectTeam,
  parseTimesheetExport,
  parseWorklogExport,
  peopleAway,
  type Reconciliation,
  reconcileHours,
  worklogCsv,
} from '@octo/domain'
import { secretKey } from './feeds.ts'
import type {
  Clock,
  HoursSettingsStore,
  MemoryWriter,
  ProjectFiles,
  SecretVault,
  SourceSettings,
  TimesheetReader,
  TrackerHoursReader,
} from './ports.ts'

export type HoursDeps = {
  settings: HoursSettingsStore
  files: ProjectFiles
  /** Where the tracker of the project and its credential are set: the same the feeds use. */
  sources: SourceSettings
  secrets: SecretVault
  tracker: TrackerHoursReader
  timesheets: TimesheetReader
  writer: MemoryWriter
  clock: Clock
  /** The people of the project with the days they are on it; without it, everyone always is. */
  team?: (project: Project) => Promise<ProjectTeam>
}

/** What a reading of the hours from the tracker brought. */
export type TrackerHoursRun = { at: string; entries: number; months: string[]; folder: string }

/** Where Octo keeps the hours it read from the tracker, one file per month. */
export const TRACKER_HOURS_FOLDER = `${OCTO_FOLDER}/ore/jira`
/** Where Octo keeps the timesheets it read from the company's system, one file per month. */
export const NETSUITE_TIMESHEET_FOLDER = `${OCTO_FOLDER}/ore/netsuite`
const timesheetFile = (month: string): string =>
  `${NETSUITE_TIMESHEET_FOLDER}/timesheet_${month}.json`
/** Months read in one go at most: a longer period is asked in pieces. */
export const MAX_MONTHS_READ = 12
const TIMESHEET_SOURCE = 'NetSuite'
const worklogFile = (month: string): string => `${TRACKER_HOURS_FOLDER}/worklog_${month}.csv`

/** Where the hours of a project seem to be kept, to propose to the PM. */
export type HoursCandidates = { timesheets: string[]; worklogs: string[] }

export type HoursView = {
  period: HoursPeriod
  reconciliation: Reconciliation
  /** What was read, so the PM knows what the numbers stand on. */
  sources: {
    timesheetFiles: number
    worklogFiles: number
    /** Files found in the places set that are not exports that can be read. */
    unreadable: string[]
    /** The last day with hours on each side, in the period; null when there are none. */
    lastTimesheetDay: string | null
    lastWorklogDay: string | null
  }
  /** Every project code the timesheets of the period carry, to choose which are of this project. */
  projectCodes: string[]
}

export type Hours = {
  settings(project: Project): Promise<HoursSettings>
  saveSettings(project: Project, settings: HoursSettings): Promise<HoursSettings>
  candidates(project: Project): Promise<HoursCandidates>
  view(project: Project, period: HoursPeriod): Promise<HoursView>
  /**
   * Reads from the tracker the hours of every month the period touches and keeps them in the
   * project as exports, whole months so a file is never partial. From then on the comparison
   * reads those. One reading per project at a time.
   */
  readFromTracker(project: Project, period: HoursPeriod): Promise<TrackerHoursRun>
  /**
   * Reads the timesheets of the whole months of the period from the NetSuite source, writes them
   * in the project one file per month and points the comparison at them.
   */
  readTimesheets(project: Project, period: HoursPeriod): Promise<TrackerHoursRun>
  /**
   * Every row of the timesheets of the project, each one once; null when the PM has not said
   * where they are. For what else is computed from the same hours.
   */
  timesheet(project: Project): Promise<HoursEntry[] | null>
}

const TIMESHEET_EXTENSION = 'json'
const WORKLOG_EXTENSION = 'csv'
const DAY = /^\d{4}-\d{2}-\d{2}$/
const TIMESHEET_NAME = /timesheet|netsuite/i
const WORKLOG_NAME = /worklog|tempo|ore|hours/i
const TIMESHEET_FOLDER_NAME = /timesheet/i
const MAX_CANDIDATES = 10

const extensionOf = (path: string): string => (path.split('.').pop() ?? '').toLowerCase()
const folderOf = (path: string): string => path.split('/').slice(0, -1).join('/')

/** A place inside the project: never an absolute path, never one that climbs out. */
function checkedPath(path: string): string {
  const parts = path.split(/[\\/]/)
  if (path.startsWith('/') || /^[a-z]:/i.test(path) || parts.includes('..')) {
    throw new DomainError('hours_settings_invalid', path)
  }
  return parts.filter((part) => part !== '' && part !== '.').join('/')
}

/** The folder that holds every month of timesheets, when the path names one; else the file's own. */
function timesheetRoot(path: string): string {
  const parts = folderOf(path).split('/')
  const index = parts.findIndex((part) => TIMESHEET_FOLDER_NAME.test(part))
  return index < 0 ? folderOf(path) : parts.slice(0, index + 1).join('/')
}

const lastDay = (entries: readonly HoursEntry[], period: HoursPeriod): string | null =>
  entries
    .filter((entry) => entry.day >= period.from && entry.day <= period.to)
    .reduce<string | null>(
      (last, entry) => (last === null || entry.day > last ? entry.day : last),
      null,
    )

const validPeriod = (period: HoursPeriod): boolean =>
  DAY.test(period.from) && DAY.test(period.to) && period.from <= period.to

export function createHours(deps: HoursDeps): Hours {
  const reading = new Map<string, AbortController>()

  /** The files of a place: the file itself, or those with the extension under the folder. */
  async function filesAt(project: Project, place: string, extension: string): Promise<string[]> {
    const path = checkedPath(place)
    if (extensionOf(path) === extension) return [path]
    const found = await deps.files.under(project.folder, path)
    return found.filter((file) => extensionOf(file) === extension)
  }

  async function read<T>(
    project: Project,
    paths: readonly string[],
    parse: (content: string) => T[] | null,
    unreadable: string[],
  ): Promise<T[]> {
    const entries: T[] = []
    for (const path of paths) {
      const content = await deps.files.readText(project.folder, path)
      const parsed = content === null ? null : parse(content)
      if (parsed === null) unreadable.push(path)
      else entries.push(...parsed)
    }
    return entries
  }

  async function timesheetRows(
    project: Project,
    files: readonly string[],
    unreadable: string[],
  ): Promise<HoursEntry[]> {
    const json = (content: string): HoursEntry[] | null => {
      try {
        return parseTimesheetExport(JSON.parse(content))
      } catch {
        return null
      }
    }
    const rows = await read(project, files, json, unreadable)
    // A month is often kept twice, split and merged: a row with the same id counts once.
    const seen = new Set<string>()
    return rows.filter((row) => {
      if (row.id === null) return true
      if (seen.has(row.id)) return false
      seen.add(row.id)
      return true
    })
  }

  return {
    settings: (project) => deps.settings.load(project.folder),

    async timesheet(project) {
      const settings = await deps.settings.load(project.folder)
      if (settings.timesheetPath === '') return null
      const files = await filesAt(project, settings.timesheetPath, TIMESHEET_EXTENSION)
      return timesheetRows(project, files, [])
    },

    async saveSettings(project, settings) {
      const clean = cleanHoursSettings(settings)
      checkedPath(clean.timesheetPath)
      checkedPath(clean.worklogPath)
      await deps.settings.save(project.folder, clean)
      return clean
    },

    async candidates(project) {
      const stamps = await deps.files.withExtensions(project.folder, [
        TIMESHEET_EXTENSION,
        WORKLOG_EXTENSION,
      ])
      const named = (extension: string, name: RegExp) =>
        stamps
          .map((stamp) => stamp.path)
          .filter((path) => extensionOf(path) === extension && name.test(path))
      const distinct = (paths: string[]) => [...new Set(paths)].sort().slice(0, MAX_CANDIDATES)
      return {
        timesheets: distinct(named(TIMESHEET_EXTENSION, TIMESHEET_NAME).map(timesheetRoot)),
        worklogs: distinct(named(WORKLOG_EXTENSION, WORKLOG_NAME)),
      }
    },

    async view(project, period) {
      if (!validPeriod(period)) throw new DomainError('hours_period_invalid')
      const settings = await deps.settings.load(project.folder)
      if (settings.timesheetPath === '' || settings.worklogPath === '') {
        throw new DomainError('hours_sources_not_set')
      }
      const timesheetFiles = await filesAt(project, settings.timesheetPath, TIMESHEET_EXTENSION)
      if (timesheetFiles.length === 0) throw new DomainError('hours_timesheet_missing')
      const worklogFiles = await filesAt(project, settings.worklogPath, WORKLOG_EXTENSION)
      if (worklogFiles.length === 0) throw new DomainError('hours_worklog_missing')

      const unreadable: string[] = []
      const timesheet = await timesheetRows(project, timesheetFiles, unreadable)
      const worklog = await read(project, worklogFiles, parseWorklogExport, unreadable)
      // Who left before the period or joined after it is expected to have no hours in it.
      const away = peopleAway((await deps.team?.(project)) ?? NO_TEAM, period.from, period.to)
      const withAway = {
        ...settings,
        noWorklogExpected: [...settings.noWorklogExpected, ...away],
        noTimesheetExpected: [...settings.noTimesheetExpected, ...away],
      }
      const codes = new Set<string>()
      for (const row of timesheet) {
        if (row.project !== null && row.day >= period.from && row.day <= period.to) {
          codes.add(row.project)
        }
      }
      return {
        period,
        reconciliation: reconcileHours(timesheet, worklog, withAway, period),
        sources: {
          timesheetFiles: timesheetFiles.length,
          worklogFiles: worklogFiles.length,
          unreadable,
          lastTimesheetDay: lastDay(timesheet, period),
          lastWorklogDay: lastDay(worklog, period),
        },
        projectCodes: [...codes].sort(),
      }
    },

    async readFromTracker(project, period) {
      if (!validPeriod(period)) throw new DomainError('hours_period_invalid')
      const months = monthsOf(period)
      if (months.length === 0 || months.length > MAX_MONTHS_READ) {
        throw new DomainError('hours_period_invalid')
      }
      const config = (await deps.sources.load(project.folder)).jira
      if (config === null) throw new DomainError('source_not_configured')
      const secret = await deps.secrets.get(secretKey(project, 'jira'))
      if (secret === null) throw new DomainError('secret_missing')
      if (reading.has(project.id)) throw new DomainError('source_busy')
      const abort = new AbortController()
      reading.set(project.id, abort)
      try {
        const whole = { from: months[0]?.from ?? period.from, to: months.at(-1)?.to ?? period.to }
        const entries = await deps.tracker.read(config, secret, whole, abort.signal)
        await deps.writer.claim(project.folder)
        for (const { month } of months) {
          const ofMonth = entries.filter((entry) => entry.day.startsWith(month))
          await deps.writer.write(project.folder, worklogFile(month), worklogCsv(ofMonth))
        }
        const settings = await deps.settings.load(project.folder)
        if (settings.worklogPath !== TRACKER_HOURS_FOLDER) {
          await deps.settings.save(project.folder, {
            ...settings,
            worklogPath: TRACKER_HOURS_FOLDER,
          })
        }
        return {
          at: deps.clock.now().toISOString(),
          entries: entries.length,
          months: months.map(({ month }) => month),
          folder: TRACKER_HOURS_FOLDER,
        }
      } finally {
        reading.delete(project.id)
      }
    },

    async readTimesheets(project, period) {
      if (!validPeriod(period)) throw new DomainError('hours_period_invalid')
      const months = monthsOf(period)
      if (months.length === 0 || months.length > MAX_MONTHS_READ) {
        throw new DomainError('hours_period_invalid')
      }
      const config = (await deps.sources.load(project.folder)).dwsi
      if (config === null) throw new DomainError('source_not_configured')
      const secret = await deps.secrets.get(secretKey(project, 'dwsi'))
      if (secret === null) throw new DomainError('secret_missing')
      if (reading.has(project.id)) throw new DomainError('source_busy')
      const abort = new AbortController()
      reading.set(project.id, abort)
      try {
        const whole = { from: months[0]?.from ?? period.from, to: months.at(-1)?.to ?? period.to }
        const rows = await deps.timesheets.read(config, secret, whole, abort.signal)
        const at = deps.clock.now().toISOString()
        await deps.writer.claim(project.folder)
        for (const { month } of months) {
          const ofMonth = rows.filter((row) => String(row.timesheetdate ?? '').startsWith(month))
          const content = { exported_at: at, source: TIMESHEET_SOURCE, rows: ofMonth }
          await deps.writer.write(
            project.folder,
            timesheetFile(month),
            `${JSON.stringify(content, null, 1)}\n`,
          )
        }
        const settings = await deps.settings.load(project.folder)
        if (settings.timesheetPath !== NETSUITE_TIMESHEET_FOLDER) {
          await deps.settings.save(project.folder, {
            ...settings,
            timesheetPath: NETSUITE_TIMESHEET_FOLDER,
          })
        }
        return {
          at,
          entries: rows.length,
          months: months.map(({ month }) => month),
          folder: NETSUITE_TIMESHEET_FOLDER,
        }
      } finally {
        reading.delete(project.id)
      }
    },
  }
}
