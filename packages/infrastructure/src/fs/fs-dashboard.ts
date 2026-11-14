import { open, readFile, realpath, stat } from 'node:fs/promises'
import { join } from 'node:path'
import type {
  DashboardSettingsStore,
  ExportCandidates,
  ForecastSettingsStore,
  HoursSettingsStore,
  ProgressSettingsStore,
  TrackerExports,
} from '@octo/application'
import {
  cleanDashboardSettings,
  cleanForecastSettings,
  cleanHoursSettings,
  cleanProgressSettings,
  DEFAULT_DASHBOARD_SETTINGS,
  DEFAULT_FORECAST_SETTINGS,
  DEFAULT_HOURS_SETTINGS,
  DEFAULT_PROGRESS_SETTINGS,
  DomainError,
  isDomainError,
  NO_DECISIONS,
  PHASES,
} from '@octo/domain'
import { z } from 'zod'
import { realPathInside, walkFiles } from './fs-project-files.ts'
import { isMissing, readJsonOr, writeJson } from './json-file.ts'
import { PROJECT_SETTINGS_FOLDER } from './project-files.ts'

const DASHBOARD_FILE = 'dashboard.json'
const JSON_EXTENSION = '.json'
/** How much of a file is read to tell what it is: the keys an export starts with are there. */
const HEAD_BYTES = 2048
/** A smaller JSON file is a setting or a note, not a tracker export. */
const MIN_EXPORT_BYTES = 1024
const MAX_CANDIDATES = 20
const EXPORT_MARK = /"items"\s*:|"item_count"\s*:/
const HISTORY_MARK = /"bugs"\s*:/

// A file written before a setting existed simply does not name it.
const settingsSchema = z.object({
  exportPath: z.string().default(DEFAULT_DASHBOARD_SETTINGS.exportPath),
  historyPath: z.string().default(DEFAULT_DASHBOARD_SETTINGS.historyPath),
  tags: z.array(z.string()).default(DEFAULT_DASHBOARD_SETTINGS.tags),
  bugTypes: z.array(z.string()).default(DEFAULT_DASHBOARD_SETTINGS.bugTypes),
  storyTypes: z.array(z.string()).default(DEFAULT_DASHBOARD_SETTINGS.storyTypes),
  stuckDays: z.number().default(DEFAULT_DASHBOARD_SETTINGS.stuckDays),
  requirementPeriods: z.array(z.string()).default(DEFAULT_DASHBOARD_SETTINGS.requirementPeriods),
  phases: z.record(z.string(), z.enum(PHASES)).default(DEFAULT_DASHBOARD_SETTINGS.phases),
  handoverStates: z.array(z.string()).default(DEFAULT_DASHBOARD_SETTINGS.handoverStates),
  decisions: z
    .object({
      excludedRequirements: z.array(z.object({ id: z.string(), at: z.string() })).default([]),
      removedSignals: z
        .array(z.object({ id: z.string(), signal: z.string(), at: z.string() }))
        .default([]),
      notes: z.array(z.object({ id: z.string(), at: z.string(), text: z.string() })).default([]),
    })
    .default(NO_DECISIONS),
})

export function createFsDashboardSettings(): DashboardSettingsStore {
  const fileOf = (projectFolder: string) =>
    join(projectFolder, PROJECT_SETTINGS_FOLDER, DASHBOARD_FILE)
  return {
    async load(projectFolder) {
      const parsed = settingsSchema.safeParse(await readJsonOr(fileOf(projectFolder), {}))
      if (!parsed.success) throw new DomainError('dashboard_settings_invalid', DASHBOARD_FILE)
      return cleanDashboardSettings(parsed.data)
    },
    save: (projectFolder, settings) => writeJson(fileOf(projectFolder), settings),
  }
}

const HOURS_FILE = 'hours.json'
const hoursSchema = z.object({
  timesheetPath: z.string().default(DEFAULT_HOURS_SETTINGS.timesheetPath),
  worklogPath: z.string().default(DEFAULT_HOURS_SETTINGS.worklogPath),
  projects: z.array(z.string()).default(DEFAULT_HOURS_SETTINGS.projects),
  thresholdPct: z.number().default(DEFAULT_HOURS_SETTINGS.thresholdPct),
  cutoff: z.string().default(DEFAULT_HOURS_SETTINGS.cutoff),
  noWorklogExpected: z.array(z.string()).default(DEFAULT_HOURS_SETTINGS.noWorklogExpected),
  noTimesheetExpected: z.array(z.string()).default(DEFAULT_HOURS_SETTINGS.noTimesheetExpected),
  aliases: z
    .array(z.object({ worklog: z.string(), timesheet: z.string() }))
    .default(DEFAULT_HOURS_SETTINGS.aliases),
})

export function createFsHoursSettings(): HoursSettingsStore {
  const fileOf = (projectFolder: string) => join(projectFolder, PROJECT_SETTINGS_FOLDER, HOURS_FILE)
  return {
    async load(projectFolder) {
      const parsed = hoursSchema.safeParse(await readJsonOr(fileOf(projectFolder), {}))
      if (!parsed.success) throw new DomainError('hours_settings_invalid', HOURS_FILE)
      return cleanHoursSettings(parsed.data)
    },
    save: (projectFolder, settings) => writeJson(fileOf(projectFolder), settings),
  }
}

const FORECAST_FILE = 'forecast.json'
const amount = z.number().nullable().default(null)
const forecastRowSchema = z.object({
  externals: z
    .array(
      z.object({
        name: z.string(),
        days: z.number(),
        costPerDay: z.number(),
        ratePerDay: z.number(),
      }),
    )
    .default([]),
  toInvoice: amount,
  revenue: amount,
  budgetCosts: amount,
  totalCosts: amount,
  totalCostsBeforeMonth: z.boolean().default(false),
  note: z.string().default(''),
})
const forecastSchema = z.object({
  modelPath: z.string().default(DEFAULT_FORECAST_SETTINGS.modelPath),
  hoursPerDay: z.number().default(DEFAULT_FORECAST_SETTINGS.hoursPerDay),
  rates: z
    .array(
      z.object({ person: z.string(), costPerDay: z.number(), ratePerDay: z.number().nullable() }),
    )
    .default([]),
  months: z.record(z.string(), z.record(z.string(), forecastRowSchema)).default({}),
})

/**
 * Daily costs and rates are kept here, in Octo's hidden settings of the project: the agent's
 * search does not look inside hidden folders, so they do not end in an answer or a deliverable.
 */
export function createFsForecastSettings(): ForecastSettingsStore {
  const fileOf = (projectFolder: string) =>
    join(projectFolder, PROJECT_SETTINGS_FOLDER, FORECAST_FILE)
  return {
    async load(projectFolder) {
      const parsed = forecastSchema.safeParse(await readJsonOr(fileOf(projectFolder), {}))
      if (!parsed.success) throw new DomainError('forecast_settings_invalid', FORECAST_FILE)
      return cleanForecastSettings(parsed.data)
    },
    save: (projectFolder, settings) => writeJson(fileOf(projectFolder), settings),
  }
}

const PROGRESS_FILE = 'progress.json'
const progressSchema = z.object({
  modelPath: z.string().default(DEFAULT_PROGRESS_SETTINGS.modelPath),
  order: z.string().default(DEFAULT_PROGRESS_SETTINGS.order),
  total: z.number().nullable().default(DEFAULT_PROGRESS_SETTINGS.total),
  positions: z.array(z.object({ code: z.string(), amount: z.number() })).default([]),
  requests: z
    .array(
      z.object({
        n: z.number(),
        from: z.string(),
        to: z.string(),
        amount: z.number(),
        note: z.string().default(''),
        positions: z.array(z.string()).default([]),
      }),
    )
    .default([]),
  form: z
    .object({
      fields: z.array(z.object({ ref: z.string(), text: z.string() })).default([]),
      table: z
        .object({
          firstRow: z.number(),
          rows: z.number(),
          position: z.string(),
          previous: z.string(),
          current: z.string(),
          period: z.string(),
        })
        .nullable()
        .default(null),
    })
    .default(DEFAULT_PROGRESS_SETTINGS.form),
})

export function createFsProgressSettings(): ProgressSettingsStore {
  const fileOf = (projectFolder: string) =>
    join(projectFolder, PROJECT_SETTINGS_FOLDER, PROGRESS_FILE)
  return {
    async load(projectFolder) {
      const parsed = progressSchema.safeParse(await readJsonOr(fileOf(projectFolder), {}))
      if (!parsed.success) throw new DomainError('progress_settings_invalid', PROGRESS_FILE)
      return cleanProgressSettings(parsed.data)
    },
    save: (projectFolder, settings) => writeJson(fileOf(projectFolder), settings),
  }
}

async function headOf(file: string): Promise<string> {
  const handle = await open(file, 'r')
  try {
    const { buffer, bytesRead } = await handle.read(Buffer.alloc(HEAD_BYTES), 0, HEAD_BYTES, 0)
    return buffer.subarray(0, bytesRead).toString('utf8')
  } finally {
    await handle.close()
  }
}

type Parsed = { size: number; modifiedMs: number; value: unknown }

/**
 * Reads tracker exports from the project folder. An export is tens of megabytes and the dashboard
 * asks for it at every change of range: what was parsed is kept until the file changes.
 */
export function createFsTrackerExports(): TrackerExports {
  const parsed = new Map<string, Parsed>()

  return {
    async readJson(projectFolder, relativePath) {
      try {
        const file = await realPathInside(projectFolder, relativePath)
        const info = await stat(file)
        const known = parsed.get(file)
        if (known && known.size === info.size && known.modifiedMs === info.mtimeMs) {
          return known.value
        }
        const value: unknown = JSON.parse(await readFile(file, 'utf8'))
        parsed.set(file, { size: info.size, modifiedMs: info.mtimeMs, value })
        return value
      } catch (error) {
        if (isMissing(error)) return null
        if (isDomainError(error) || error instanceof SyntaxError) {
          throw new DomainError('tracker_export_unreadable', relativePath)
        }
        throw error
      }
    },

    async candidates(projectFolder): Promise<ExportCandidates> {
      const root = await realpath(projectFolder)
      const found: ExportCandidates = { exports: [], histories: [] }
      for (const path of await walkFiles(root, '', true)) {
        if (!path.toLowerCase().endsWith(JSON_EXTENSION)) continue
        const file = join(root, path)
        if ((await stat(file)).size < MIN_EXPORT_BYTES) continue
        const head = await headOf(file)
        if (EXPORT_MARK.test(head)) found.exports.push(path)
        else if (HISTORY_MARK.test(head)) found.histories.push(path)
      }
      const firstFew = (paths: string[]) => paths.sort().slice(0, MAX_CANDIDATES)
      return { exports: firstFew(found.exports), histories: firstFew(found.histories) }
    },
  }
}
