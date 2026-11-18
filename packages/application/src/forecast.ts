import {
  cleanForecastSettings,
  compileForecast,
  DomainError,
  type DomainErrorCode,
  FORECAST_MONTH,
  type Forecast,
  type ForecastCell,
  type ForecastSettings,
  type ForecastWorklog,
  forecastCode,
  forecastFormulaAt,
  forecastMonthsBetween,
  type HoursEntry,
  type HoursPeriod,
  isDomainError,
  monthsOf,
  NO_FORECAST_PROJECT,
  NO_FORECAST_WORKLOG,
  OCTO_FOLDER,
  type Project,
  type ProjectEconomics,
  type ProjectTeam,
  readForecastModel,
  romeDateString,
  type TrackerHours,
} from '@octo/domain'
import { secretKey } from './feeds.ts'
import type {
  Clock,
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
  /**
   * The months whose timesheets are held whole; null when it cannot be told. Without it nothing
   * is said about the months that were not read.
   */
  readMonths?: (project: Project) => Promise<string[] | null>
  /** Reads from the company's system the timesheets of the whole months of a period. */
  readTimesheets?: (project: Project, period: HoursPeriod) => Promise<unknown>
  /** Today: the months still to come have no timesheets to read. */
  clock?: Clock
  /** The hours logged on the tracker of the project, item by item. */
  worklog?: (project: Project) => Promise<TrackerHours[]>
  /** The people of the project: their caps propose the costs at budget. */
  team?: (project: Project) => Promise<ProjectTeam>
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
/** The same, with the money of each code as the company's system books it: never kept. */
export type ForecastOrdersRead = ForecastOrdersRun & {
  economics: Record<string, ProjectEconomics>
}

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
   * keeps them in the settings. How a code is sold is taken from its sales orders the first
   * time the code is read; afterwards it stays as the PM set it.
   */
  readOrders(project: Project): Promise<ForecastOrdersRun>
}

/** The characters of a month in a day written `YYYY-MM-DD`. */
export const MONTH_LENGTH = 7

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

/** How far a reading of the months that miss got, or why it stopped. */
export type CatchUpStep =
  | { kind: 'month'; month: string; done: number; total: number }
  | { kind: 'missed'; code: DomainErrorCode }

/**
 * What the monthly forecast and the sheet of a project code both read: the codes of the project,
 * the months of timesheets held, the hours of the tracker, the orders of the company's system.
 */
export type ForecastReadings = {
  codesOf(project: Project, timesheet: readonly HoursEntry[]): Promise<string[]>
  monthsRead(project: Project, month: string): Promise<string[] | null>
  /**
   * Reads the months of timesheets that miss, one at a time, telling each as it starts. True when
   * at least one was read: what was read is kept, so the next reading goes on from there.
   */
  readMissing(
    project: Project,
    months: readonly string[],
    tell?: (step: CatchUpStep) => void,
  ): Promise<boolean>
  worklogOf(project: Project, codes: readonly string[]): Promise<ForecastWorklog>
  readOrders(project: Project): Promise<ForecastOrdersRead>
}

/** One for a composition: the months it catches up with are asked once, whoever asks. */
export function createForecastReadings(deps: ForecastDeps): ForecastReadings {
  async function codesOf(project: Project, timesheet: readonly HoursEntry[]): Promise<string[]> {
    const chosen = (await deps.codes(project)).map(forecastCode).filter((code) => code !== '')
    if (chosen.length > 0) return chosen
    return timesheet.flatMap((entry) => (entry.project === null ? [] : [entry.project]))
  }

  /** The months held whole, with those still to come: nobody can have read them, none misses. */
  async function monthsRead(project: Project, month: string): Promise<string[] | null> {
    const read = (await deps.readMonths?.(project)) ?? null
    if (read === null || deps.clock === undefined) return read
    const current = romeDateString(deps.clock.now()).slice(0, MONTH_LENGTH)
    return [...read, ...forecastMonthsBetween(current, month).slice(1)]
  }

  /**
   * Reads the months of timesheets the forecast misses, without a word: a system that is not
   * linked or does not answer changes nothing, and the forecast keeps saying what it misses.
   */
  const catchingUp = new Map<
    string,
    { months: ReadonlySet<string>; done: Promise<boolean>; tells: Set<(step: CatchUpStep) => void> }
  >()

  /**
   * One reading per project at a time: who asks while it runs is told its steps too, waits for
   * it, and asks again only for the months it did not cover.
   */
  async function readMissing(
    project: Project,
    months: readonly string[],
    tell?: (step: CatchUpStep) => void,
  ): Promise<boolean> {
    const running = catchingUp.get(project.id)
    if (running) {
      if (tell) running.tells.add(tell)
      const read = await running.done
      const left = months.filter((month) => !running.months.has(month))
      return left.length === 0 ? read : readMissing(project, left, tell)
    }
    const tells = new Set(tell ? [tell] : [])
    const done = readMonths(project, months, (step) => {
      for (const each of tells) each(step)
    }).finally(() => catchingUp.delete(project.id))
    catchingUp.set(project.id, { months: new Set(months), done, tells })
    return done
  }

  /** A month at a time: each is kept as it comes, so a reading that stops lost only its month. */
  async function readMonths(
    project: Project,
    months: readonly string[],
    tell: (step: CatchUpStep) => void,
  ): Promise<boolean> {
    if (deps.readTimesheets === undefined) return false
    let done = 0
    try {
      for (const month of months) {
        tell({ kind: 'month', month, done, total: months.length })
        const [whole] = monthsOf({ from: `${month}-01`, to: `${month}-01` })
        if (whole !== undefined) {
          await deps.readTimesheets(project, { from: whole.from, to: whole.to })
        }
        done += 1
      }
    } catch (error) {
      if (!isDomainError(error)) throw error
      tell({ kind: 'missed', code: error.code })
    }
    return done > 0
  }

  /**
   * The hours of the tracker, told of the only code of the project: a tracker names no code, so
   * with more codes than one its hours are of none.
   */
  async function worklogOf(project: Project, codes: readonly string[]): Promise<ForecastWorklog> {
    const distinct = [...new Set(codes.map(forecastCode))].filter((code) => code !== '')
    const [only] = distinct
    if (deps.worklog === undefined || distinct.length !== 1 || only === undefined) {
      return NO_FORECAST_WORKLOG
    }
    const entries = await deps.worklog(project).catch((error: unknown) => {
      if (!isDomainError(error)) throw error
      return []
    })
    return { entries, code: only }
  }

  async function readOrders(project: Project): Promise<ForecastOrdersRead> {
    const config = (await deps.sources.load(project.folder)).dwsi
    if (config === null) throw new DomainError('source_not_configured')
    const secret = await deps.secrets.get(secretKey(project, 'dwsi'))
    if (secret === null) throw new DomainError('secret_missing')
    const orders = await deps.orders.read(config, secret, new AbortController().signal)
    const settings = await deps.settings.load(project.folder)
    const projects = { ...settings.projects }
    const economics: Record<string, ProjectEconomics> = {}
    for (const order of orders) {
      const code = forecastCode(order.code)
      if (order.economics) economics[code] = order.economics
      // A code never read before is sold as its orders say; a known one as the PM left it.
      const known = projects[code] ?? {
        ...NO_FORECAST_PROJECT,
        kind: order.kind ?? NO_FORECAST_PROJECT.kind,
      }
      projects[code] = {
        ...known,
        description: order.description,
        ordered: order.ordered,
        // The start the PM wrote stays; else the work is taken to begin with the first order.
        startMonth: known.startMonth ?? order.startMonth,
        invoiced: order.invoiced,
        recognized: order.recognized,
      }
    }
    const saved = cleanForecastSettings({ ...settings, projects })
    await deps.settings.save(project.folder, saved)
    const codes = orders.map((order) => forecastCode(order.code)).sort()
    return { settings: saved, codes, economics }
  }

  return { codesOf, monthsRead, readMissing, worklogOf, readOrders }
}

export function createForecasts(
  deps: ForecastDeps,
  readings: ForecastReadings = createForecastReadings(deps),
): Forecasts {
  const { codesOf, monthsRead, readMissing, worklogOf, readOrders } = readings

  async function compiled(project: Project, month: string, settings: ForecastSettings) {
    const timesheet = await deps.timesheet(project)
    if (timesheet === null) throw new DomainError('forecast_timesheet_not_set')
    const codes = await codesOf(project, timesheet)
    const read = await monthsRead(project, month)
    const worklog = await worklogOf(project, codes)
    return compileForecast(codes, timesheet, settings, month, undefined, read, worklog)
  }

  async function load(
    project: Project,
    month: string,
  ): Promise<{ forecast: Forecast; settings: ForecastSettings }> {
    if (!FORECAST_MONTH.test(month)) throw new DomainError('forecast_month_invalid')
    const settings = await deps.settings.load(project.folder)
    const forecast = await compiled(project, month, settings)
    if (forecast.unreadMonths.length === 0) return { forecast, settings }
    const caughtUp = await readMissing(project, forecast.unreadMonths)
    return { forecast: caughtUp ? await compiled(project, month, settings) : forecast, settings }
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

    // The money of the codes is of the sheet: the forecast keeps what it saved, and no more.
    async readOrders(project) {
      const { settings, codes } = await readOrders(project)
      return { settings, codes }
    },
  }
}
