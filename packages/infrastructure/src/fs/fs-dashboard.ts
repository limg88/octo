import { open, readFile, realpath, stat } from 'node:fs/promises'
import { join } from 'node:path'
import type {
  DashboardSettingsStore,
  ExportCandidates,
  ForecastSettingsStore,
  HoursSettingsStore,
  ModelSettingsStore,
  RetiredSheetPlans,
  TeamStore,
  TrackerExports,
} from '@octo/application'
import {
  cleanDashboardSettings,
  cleanForecastSettings,
  cleanHoursSettings,
  cleanModelSettings,
  cleanTeam,
  DEFAULT_DASHBOARD_SETTINGS,
  DEFAULT_FORECAST_SETTINGS,
  DEFAULT_HOURS_SETTINGS,
  DomainError,
  FORECAST_KINDS,
  type ForecastExternal,
  type ForecastExternalRate,
  type ForecastSettings,
  isDomainError,
  NO_DECISIONS,
  NO_FORECAST_PROJECT,
  PHASES,
  PLAN_GROUPS,
  PRIVATE_FOLDER,
  RETIRED_PLANS_FILE,
  TEAM_SIDES,
} from '@octo/domain'
import { z } from 'zod'
import { realPathInside, walkFiles } from './fs-project-files.ts'
import { isMissing, readJsonOr, writeAtomic, writeJson } from './json-file.ts'
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
  ownPeopleOnly: z.boolean().default(false),
  bugTypes: z.array(z.string()).default(DEFAULT_DASHBOARD_SETTINGS.bugTypes),
  storyTypes: z.array(z.string()).default(DEFAULT_DASHBOARD_SETTINGS.storyTypes),
  stuckDays: z.number().default(DEFAULT_DASHBOARD_SETTINGS.stuckDays),
  requirementPeriods: z.array(z.string()).default(DEFAULT_DASHBOARD_SETTINGS.requirementPeriods),
  answerWorkdays: z.number().default(DEFAULT_DASHBOARD_SETTINGS.answerWorkdays),
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
        hours: z.number().optional(),
        // As kept before externals had their cost and rate written once: days, with both.
        days: z.number().optional(),
        costPerDay: z.number().optional(),
        ratePerDay: z.number().optional(),
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
  projects: z
    .record(
      z.string(),
      z.object({
        kind: z.enum(FORECAST_KINDS).default(NO_FORECAST_PROJECT.kind),
        description: z.string().default(''),
        ordered: amount,
        feeMonths: amount,
        startMonth: z.string().nullable().default(null),
        invoiced: amount,
        recognized: amount,
      }),
    )
    .default({}),
  hoursPerDay: z.number().default(DEFAULT_FORECAST_SETTINGS.hoursPerDay),
  rates: z
    .array(
      z.object({
        person: z.string(),
        code: z.string().nullable().default(null),
        ratePerDay: z.number().nullable(),
      }),
    )
    .default([]),
  externals: z
    .array(
      z.object({
        name: z.string(),
        code: z.string(),
        costPerDay: z.number(),
        ratePerDay: z.number(),
      }),
    )
    .default([]),
  hourlyCosts: z.array(z.object({ person: z.string(), costPerHour: z.number() })).default([]),
  months: z.record(z.string(), z.record(z.string(), forecastRowSchema)).default({}),
})

/**
 * The settings as the domain has them, from the file as it is or as it was kept before: a rate
 * without an amount was a cost only and is dropped (costs come from the timesheets now); an
 * external written by days with its cost and rate becomes hours, and its cost and rate are kept
 * once for the project code; a code with costs at budget and no way of selling written was a
 * fixed price, and is kept as one.
 */
function forecastSettingsOf(kept: z.infer<typeof forecastSchema>): ForecastSettings {
  const externals: ForecastExternalRate[] = [...kept.externals]
  const months: ForecastSettings['months'] = {}
  const projects: ForecastSettings['projects'] = { ...kept.projects }
  for (const [month, rows] of Object.entries(kept.months)) {
    months[month] = {}
    for (const [code, row] of Object.entries(rows)) {
      if (row.budgetCosts !== null && projects[code] === undefined) {
        projects[code] = { ...NO_FORECAST_PROJECT, kind: 'fixed_price' }
      }
      const hours: ForecastExternal[] = []
      for (const external of row.externals) {
        const { name, costPerDay, ratePerDay } = external
        hours.push({ name, hours: external.hours ?? (external.days ?? 0) * kept.hoursPerDay })
        const known = externals.some((rate) => rate.name === name && rate.code === code)
        if (costPerDay !== undefined && ratePerDay !== undefined && !known) {
          externals.push({ name, code, costPerDay, ratePerDay })
        }
      }
      months[month][code] = { ...row, externals: hours }
    }
  }
  return {
    modelPath: kept.modelPath,
    projects,
    hoursPerDay: kept.hoursPerDay,
    rates: kept.rates.flatMap((rate) =>
      rate.ratePerDay === null ? [] : [{ ...rate, ratePerDay: rate.ratePerDay }],
    ),
    externals,
    hourlyCosts: kept.hourlyCosts,
    months,
  }
}

/**
 * Rates, and the costs and rates of externals, are kept here, in Octo's settings of the project:
 * a folder that is neither searched nor cited, so they do not end in an answer or a deliverable.
 */
export function createFsForecastSettings(): ForecastSettingsStore {
  const fileOf = (projectFolder: string) =>
    join(projectFolder, PROJECT_SETTINGS_FOLDER, FORECAST_FILE)
  return {
    async load(projectFolder) {
      const parsed = forecastSchema.safeParse(await readJsonOr(fileOf(projectFolder), {}))
      if (!parsed.success) throw new DomainError('forecast_settings_invalid', FORECAST_FILE)
      return cleanForecastSettings(forecastSettingsOf(parsed.data))
    },
    save: (projectFolder, settings) => writeJson(fileOf(projectFolder), settings),
  }
}

const SHEET_PLAN_FILE = 'sheet-plan.json'
const quantities = z.record(z.string(), z.number()).default({})
const sheetPlanSchema = z.record(
  z.string(),
  z.object({
    lines: z
      .array(
        z.object({
          group: z.enum(PLAN_GROUPS),
          name: z.string(),
          unitCost: amount,
          unitPrice: amount,
          budget: quantities,
          forecast: quantities,
          declared: quantities,
        }),
      )
      .default([]),
    confirmedOn: z.string().nullable().default(null),
    milestones: z
      .array(z.object({ salesOrder: z.string(), month: z.string(), amount: z.number() }))
      .default([]),
    declaredProgress: z.record(z.string(), z.number()).default({}),
    registry: z.record(z.string(), z.string()).default({}),
  }),
)

/**
 * The plans of the project codes, in the file Octo kept them in until they left it. The file is
 * only read. What is handed back to the PM is a text with the costs in it, so it goes where
 * the search of the agent does not look.
 */
export function createFsRetiredSheetPlans(): RetiredSheetPlans {
  const exportOf = (projectFolder: string) =>
    join(projectFolder, PRIVATE_FOLDER, RETIRED_PLANS_FILE)
  return {
    async pending(projectFolder) {
      const handedBack = await stat(exportOf(projectFolder)).then(
        () => true,
        () => false,
      )
      if (handedBack) return null
      const file = join(projectFolder, PROJECT_SETTINGS_FOLDER, SHEET_PLAN_FILE)
      // A file nobody can read any more has nothing to hand back: it stays where it is.
      const parsed = sheetPlanSchema.safeParse(await readJsonOr(file, {}).catch(() => null))
      if (!parsed.success || Object.keys(parsed.data).length === 0) return null
      return parsed.data
    },
    handBack: (projectFolder, text) => writeAtomic(exportOf(projectFolder), text),
  }
}

const TEAM_SETTINGS_FILE = 'team.json'
const teamSchema = z.object({
  people: z
    .array(
      z.object({
        name: z.string(),
        role: z.string().default(''),
        side: z.enum(TEAM_SIDES).default('supplier'),
        from: z.string().default(''),
        to: z.string().default(''),
        allocation: z.number().nullable().default(null),
        note: z.string().default(''),
        capDays: z.number().nullable().optional(),
      }),
    )
    .default([]),
  periods: z.array(z.object({ name: z.string(), from: z.string(), to: z.string() })).default([]),
})

export function createFsTeamStore(): TeamStore {
  const fileOf = (projectFolder: string) =>
    join(projectFolder, PROJECT_SETTINGS_FOLDER, TEAM_SETTINGS_FILE)
  return {
    async load(projectFolder) {
      const parsed = teamSchema.safeParse(await readJsonOr(fileOf(projectFolder), {}))
      if (!parsed.success) throw new DomainError('team_invalid', TEAM_SETTINGS_FILE)
      return cleanTeam(parsed.data)
    },
    save: (projectFolder, team) => writeJson(fileOf(projectFolder), team),
  }
}

const MODELS_FILE = 'models.json'

/** The model of each task, kept with Octo's settings of the project. */
export function createFsModelSettings(): ModelSettingsStore {
  const fileOf = (projectFolder: string) =>
    join(projectFolder, PROJECT_SETTINGS_FOLDER, MODELS_FILE)
  return {
    async load(projectFolder) {
      const kept = await readJsonOr(fileOf(projectFolder), {})
      // A file that names a model Octo does not offer falls back on the default, task by task.
      return cleanModelSettings(typeof kept === 'object' && kept !== null ? kept : {})
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
