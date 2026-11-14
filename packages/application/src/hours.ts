import {
  cleanHoursSettings,
  DomainError,
  type HoursEntry,
  type HoursPeriod,
  type HoursSettings,
  type Project,
  parseTimesheetExport,
  parseWorklogExport,
  type Reconciliation,
  reconcileHours,
} from '@octo/domain'
import type { HoursSettingsStore, ProjectFiles } from './ports.ts'

export type HoursDeps = {
  settings: HoursSettingsStore
  files: ProjectFiles
}

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
}

const TIMESHEET_EXTENSION = 'json'
const WORKLOG_EXTENSION = 'csv'
const DAY = /^\d{4}-\d{2}-\d{2}$/
const TIMESHEET_NAME = /timesheet|netsuite/i
const WORKLOG_NAME = /worklog|tempo|ore|hours/i
const TIMESHEET_FOLDER = /timesheet/i
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
  const index = parts.findIndex((part) => TIMESHEET_FOLDER.test(part))
  return index < 0 ? folderOf(path) : parts.slice(0, index + 1).join('/')
}

const lastDay = (entries: readonly HoursEntry[], period: HoursPeriod): string | null =>
  entries
    .filter((entry) => entry.day >= period.from && entry.day <= period.to)
    .reduce<string | null>(
      (last, entry) => (last === null || entry.day > last ? entry.day : last),
      null,
    )

export function createHours(deps: HoursDeps): Hours {
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

  return {
    settings: (project) => deps.settings.load(project.folder),

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
      if (!DAY.test(period.from) || !DAY.test(period.to) || period.from > period.to) {
        throw new DomainError('hours_period_invalid')
      }
      const settings = await deps.settings.load(project.folder)
      if (settings.timesheetPath === '' || settings.worklogPath === '') {
        throw new DomainError('hours_sources_not_set')
      }
      const timesheetFiles = await filesAt(project, settings.timesheetPath, TIMESHEET_EXTENSION)
      if (timesheetFiles.length === 0) throw new DomainError('hours_timesheet_missing')
      const worklogFiles = await filesAt(project, settings.worklogPath, WORKLOG_EXTENSION)
      if (worklogFiles.length === 0) throw new DomainError('hours_worklog_missing')

      const unreadable: string[] = []
      const json = (content: string): HoursEntry[] | null => {
        try {
          return parseTimesheetExport(JSON.parse(content))
        } catch {
          return null
        }
      }
      const rows = await read(project, timesheetFiles, json, unreadable)
      // A month is often kept twice, split and merged: a row with the same id counts once.
      const seen = new Set<string>()
      const timesheet = rows.filter((row) => {
        if (row.id === null) return true
        if (seen.has(row.id)) return false
        seen.add(row.id)
        return true
      })
      const worklog = await read(project, worklogFiles, parseWorklogExport, unreadable)
      const codes = new Set<string>()
      for (const row of timesheet) {
        if (row.project !== null && row.day >= period.from && row.day <= period.to) {
          codes.add(row.project)
        }
      }
      return {
        period,
        reconciliation: reconcileHours(timesheet, worklog, settings, period),
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
  }
}
