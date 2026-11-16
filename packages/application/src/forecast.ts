import {
  cleanForecastSettings,
  compileForecast,
  DomainError,
  FORECAST_MONTH,
  type Forecast,
  type ForecastCell,
  type ForecastSettings,
  forecastCode,
  forecastFormulaAt,
  type HoursEntry,
  NO_FORECAST_PROJECT,
  OCTO_FOLDER,
  type Project,
  readForecastModel,
} from '@octo/domain'
import { secretKey } from './feeds.ts'
import type {
  ForecastSettingsStore,
  MemoryWriter,
  ProjectFiles,
  ProjectOrdersReader,
  SecretVault,
  SheetWrite,
  SourceSettings,
  SpreadsheetModel,
} from './ports.ts'

export type ForecastDeps = {
  settings: ForecastSettingsStore
  files: ProjectFiles
  sheets: SpreadsheetModel
  /** The timesheet rows of a project; null when the PM has not said where they are. */
  timesheet: (project: Project) => Promise<HoursEntry[] | null>
  /** The project codes the PM said are of the project; none: every code of its timesheets. */
  codes: (project: Project) => Promise<string[]>
  /** Where the company's system and its credential are set: the same the feeds use. */
  sources: SourceSettings
  secrets: SecretVault
  orders: ProjectOrdersReader
  writer: MemoryWriter
}

/** Where Octo puts the filled models, one folder per month. The model itself is never touched. */
export const FORECAST_FOLDER = `${OCTO_FOLDER}/previsionale`

export type ForecastView = { forecast: Forecast; modelPath: string }
/**
 * The filled copy of the model, as a path from the project folder, with the codes of the
 * project the model has no row for.
 */
export type ForecastFile = { path: string; notInModel: string[] }
/** What a reading of the orders brought: the settings with them, and the codes it found. */
export type ForecastOrdersRun = { settings: ForecastSettings; codes: string[] }

export type Forecasts = {
  settings(project: Project): Promise<ForecastSettings>
  saveSettings(project: Project, settings: ForecastSettings): Promise<ForecastSettings>
  /** Spreadsheets of the project that look like the model of the administration. */
  candidates(project: Project): Promise<string[]>
  /** The forecast of a month for the project codes of the project, computed and not written. */
  view(project: Project, month: string): Promise<ForecastView>
  /** Writes a copy of the model with the rows of the project codes filled for a month. */
  compile(project: Project, month: string): Promise<ForecastFile>
  /**
   * Reads from the company's system the name and the ordered amount of the project codes and
   * keeps them in the settings; how each code is sold stays as the PM set it.
   */
  readOrders(project: Project): Promise<ForecastOrdersRun>
}

const MODEL_EXTENSION = 'xlsx'
const MODEL_NAME = /previsional|avanzament|forecast/i
const MAX_CANDIDATES = 10

/** A place inside the project: never an absolute path, never one that climbs out. */
function checkedPath(path: string): string {
  const parts = path.split(/[\\/]/)
  if (path.startsWith('/') || /^[a-z]:/i.test(path) || parts.includes('..')) {
    throw new DomainError('forecast_settings_invalid', path)
  }
  return parts.filter((part) => part !== '' && part !== '.').join('/')
}

const fileName = (path: string): string => path.split('/').pop() ?? path

export function createForecasts(deps: ForecastDeps): Forecasts {
  async function codesOf(project: Project, timesheet: readonly HoursEntry[]): Promise<string[]> {
    const chosen = (await deps.codes(project)).map(forecastCode).filter((code) => code !== '')
    if (chosen.length > 0) return chosen
    return timesheet.flatMap((entry) => (entry.project === null ? [] : [entry.project]))
  }

  async function load(
    project: Project,
    month: string,
  ): Promise<{ forecast: Forecast; settings: ForecastSettings }> {
    if (!FORECAST_MONTH.test(month)) throw new DomainError('forecast_month_invalid')
    const settings = await deps.settings.load(project.folder)
    const timesheet = await deps.timesheet(project)
    if (timesheet === null) throw new DomainError('forecast_timesheet_not_set')
    const codes = await codesOf(project, timesheet)
    return { forecast: compileForecast(codes, timesheet, settings, month), settings }
  }

  return {
    settings: (project) => deps.settings.load(project.folder),

    async saveSettings(project, settings) {
      const clean = cleanForecastSettings(settings)
      const saved = { ...clean, modelPath: checkedPath(clean.modelPath) }
      await deps.settings.save(project.folder, saved)
      return saved
    },

    async candidates(project) {
      const stamps = await deps.files.withExtensions(project.folder, [MODEL_EXTENSION])
      return stamps
        .map((stamp) => stamp.path)
        .filter((path) => MODEL_NAME.test(path))
        .sort()
        .slice(0, MAX_CANDIDATES)
    },

    async view(project, month) {
      const { forecast, settings } = await load(project, month)
      return { forecast, modelPath: settings.modelPath }
    },

    async compile(project, month) {
      const { forecast, settings } = await load(project, month)
      if (settings.modelPath === '') throw new DomainError('forecast_model_not_set')
      const path = checkedPath(settings.modelPath)
      let bytes: Uint8Array
      try {
        bytes = await deps.files.read(project.folder, path)
      } catch {
        throw new DomainError('forecast_model_missing', path)
      }
      const reading = readForecastModel(deps.sheets.read(bytes))
      if (!reading.ok) throw new DomainError('forecast_model_invalid', reading.missing.join(', '))
      const { columns, rows: lines } = reading.model
      const placed = (cell: ForecastCell, row: number): ForecastCell =>
        cell.kind === 'formula'
          ? { ...cell, formula: forecastFormulaAt(cell.formula, columns, row) }
          : cell
      const writes: SheetWrite[] = []
      const notInModel: string[] = []
      for (const row of forecast.rows) {
        // A code the model lists on more rows (one per order) is filled on the first only.
        const line = lines.find((candidate) => candidate.code === row.code)
        if (line === undefined) {
          notInModel.push(row.code)
          continue
        }
        for (const [column, cell] of Object.entries(row.cells)) {
          const ref = `${columns[column as keyof typeof columns]}${line.number}`
          writes.push({ ref, cell: placed(cell, line.number) })
        }
      }
      const filled = deps.sheets.fill(bytes, writes)
      const target = `${FORECAST_FOLDER}/${month}/${fileName(path)}`
      await deps.writer.claim(project.folder)
      await deps.writer.writeBytes(project.folder, target, filled)
      return { path: target, notInModel }
    },

    async readOrders(project) {
      const config = (await deps.sources.load(project.folder)).dwsi
      if (config === null) throw new DomainError('source_not_configured')
      const secret = await deps.secrets.get(secretKey(project, 'dwsi'))
      if (secret === null) throw new DomainError('secret_missing')
      const orders = await deps.orders.read(config, secret, new AbortController().signal)
      const settings = await deps.settings.load(project.folder)
      const projects = { ...settings.projects }
      for (const order of orders) {
        const code = forecastCode(order.code)
        projects[code] = {
          ...(projects[code] ?? NO_FORECAST_PROJECT),
          description: order.description,
          ordered: order.ordered,
        }
      }
      const saved = cleanForecastSettings({ ...settings, projects })
      await deps.settings.save(project.folder, saved)
      return { settings: saved, codes: orders.map((order) => forecastCode(order.code)).sort() }
    },
  }
}
