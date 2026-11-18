import {
  compileLifetime,
  DomainError,
  forecastCode,
  isDomainError,
  type Lifetime,
  type Project,
  type ProjectEconomics,
  romeDateString,
  teamCaps,
} from '@octo/domain'
import {
  createForecastReadings,
  type ForecastDeps,
  type ForecastReadings,
  MONTH_LENGTH,
} from './forecast.ts'

export type ProjectSheets = {
  /**
   * Every project code of the project from its start to the month that runs: who worked how
   * much and at what cost, what was invoiced and recognised, how far it is, the margins today
   * and at the end. Octo shows it: the sheet of the administration is where it is kept.
   */
  list(project: Project): Promise<Lifetime[]>
}

/**
 * The summary of each project code of a project over its whole life. It reads what the monthly
 * forecast reads: pass the same readings to both, so the months of timesheets they miss are
 * asked once.
 */
export function createProjectSheets(
  deps: ForecastDeps,
  readings: ForecastReadings = createForecastReadings(deps),
): ProjectSheets {
  const today = (): string => romeDateString((deps.clock ?? { now: () => new Date() }).now())

  /** What the company's system says of the money of the codes; none when it cannot be asked. */
  async function economicsOf(project: Project): Promise<Record<string, ProjectEconomics>> {
    try {
      return (await readings.readOrders(project)).economics
    } catch (error) {
      if (!isDomainError(error)) throw error
      return {}
    }
  }

  async function list(project: Project): Promise<Lifetime[]> {
    const month = today().slice(0, MONTH_LENGTH)
    // What was invoiced and recognised changes month by month: asked again, without a word.
    const economics = await economicsOf(project)
    const settings = await deps.settings.load(project.folder)
    const all = async (): Promise<Lifetime[]> => {
      const timesheet = await deps.timesheet(project)
      if (timesheet === null) throw new DomainError('forecast_timesheet_not_set')
      const chosen = await readings.codesOf(project, timesheet)
      const codes = [...new Set(chosen.map(forecastCode))].sort()
      const months = await readings.monthsRead(project, month)
      const worklog = await readings.worklogOf(project, codes)
      // The caps are of the project: they are of a code only when it is the only one.
      const team = codes.length === 1 && deps.team ? await deps.team(project) : null
      const caps = team ? teamCaps(team) : []
      return codes.map((code) =>
        compileLifetime(
          code,
          timesheet,
          settings,
          month,
          months,
          worklog,
          caps,
          economics[code] ?? null,
        ),
      )
    }
    const first = await all()
    const unread = [...new Set(first.flatMap((sheet) => sheet.unreadMonths))].sort()
    return unread.length > 0 && (await readings.readMissing(project, unread)) ? all() : first
  }

  return { list }
}
