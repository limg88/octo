import {
  cleanForecastSettings,
  compileForecast,
  DomainError,
  FORECAST_MONTH,
  type Forecast,
  type ForecastModel,
  type ForecastSettings,
  type HoursEntry,
  OCTO_FOLDER,
  type Project,
  readForecastModel,
} from '@octo/domain'
import type {
  ForecastSettingsStore,
  MemoryWriter,
  ProjectFiles,
  SheetWrite,
  SpreadsheetModel,
} from './ports.ts'

export type ForecastDeps = {
  settings: ForecastSettingsStore
  files: ProjectFiles
  sheets: SpreadsheetModel
  /** The timesheet rows of a project; null when the PM has not said where they are. */
  timesheet: (project: Project) => Promise<HoursEntry[] | null>
  writer: MemoryWriter
}

/** Where Octo puts the filled models, one folder per month. The model itself is never touched. */
export const FORECAST_FOLDER = `${OCTO_FOLDER}/previsionale`

export type ForecastView = { forecast: Forecast; modelPath: string }
/** The filled copy of the model, as a path from the project folder. */
export type ForecastFile = { path: string }

export type Forecasts = {
  settings(project: Project): Promise<ForecastSettings>
  saveSettings(project: Project, settings: ForecastSettings): Promise<ForecastSettings>
  /** Spreadsheets of the project that look like the model of the administration. */
  candidates(project: Project): Promise<string[]>
  /** What the model would hold for a month, computed and not written. */
  view(project: Project, month: string): Promise<ForecastView>
  /** Writes a filled copy of the model for a month. */
  compile(project: Project, month: string): Promise<ForecastFile>
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
  async function load(
    project: Project,
    month: string,
  ): Promise<{ bytes: Uint8Array; model: ForecastModel; forecast: Forecast; path: string }> {
    if (!FORECAST_MONTH.test(month)) throw new DomainError('forecast_month_invalid')
    const settings = await deps.settings.load(project.folder)
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
    const timesheet = await deps.timesheet(project)
    if (timesheet === null) throw new DomainError('forecast_timesheet_not_set')
    const forecast = compileForecast(reading.model, timesheet, settings, month)
    return { bytes, model: reading.model, forecast, path }
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
      const { forecast, path } = await load(project, month)
      return { forecast, modelPath: path }
    },

    async compile(project, month) {
      const { bytes, model, forecast, path } = await load(project, month)
      const writes: SheetWrite[] = forecast.rows.flatMap((row) =>
        Object.entries(row.cells).map(([column, cell]) => ({
          ref: `${model.columns[column as keyof typeof model.columns]}${row.number}`,
          cell,
        })),
      )
      const filled = deps.sheets.fill(bytes, writes)
      const target = `${FORECAST_FOLDER}/${month}/${fileName(path)}`
      await deps.writer.claim(project.folder)
      await deps.writer.writeBytes(project.folder, target, filled)
      return { path: target }
    },
  }
}
