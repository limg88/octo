import {
  cleanSheetPlans,
  compileLifetime,
  confirmedPlan,
  currentHourlyCosts,
  DomainError,
  forecastCode,
  type HoursEntry,
  isDomainError,
  type Lifetime,
  NO_SHEET_PLAN,
  OCTO_FOLDER,
  type PlanSources,
  type Project,
  type ProjectEconomics,
  personKey,
  planView,
  proposedPlan,
  rateOf,
  romeDateString,
  type SheetPlans,
  settingsWithPlans,
  sheetDataCsv,
  standingOf,
  teamCaps,
  withPlan,
} from '@octo/domain'
import {
  createForecastReadings,
  type ForecastDeps,
  type ForecastReadings,
  MONTH_LENGTH,
} from './forecast.ts'
import type { SheetPlanStore } from './ports.ts'

export type ProjectSheetDeps = ForecastDeps & {
  /** The plans of the project codes: their budget, how they are planned now, what is to bill. */
  plans: SheetPlanStore
}

/** Where Octo writes what it exports of a project code, one folder per code. */
export const SHEET_FOLDER = `${OCTO_FOLDER}/commessa`

export type ProjectSheets = {
  /**
   * Every project code of the project from its start to the month that runs: who worked how
   * much and at what cost, what was invoiced and recognised, the margins today and at the end,
   * and its plan read against what happened.
   */
  list(project: Project): Promise<Lifetime[]>
  /** The plans as the PM wrote them, by project code. */
  plans(project: Project): Promise<SheetPlans>
  savePlans(project: Project, plans: SheetPlans): Promise<SheetPlans>
  /**
   * The plan of a code with a line for everybody known and not planned yet: who has hours on
   * it, who is declared to work on it from outside, its suppliers. Kept only when it adds.
   */
  propose(project: Project, code: string): Promise<SheetPlans>
  /** Confirms the budget of a code today: its costs stop following today's. */
  confirm(project: Project, code: string): Promise<SheetPlans>
  /** Writes the long table of a code as a file a spreadsheet opens; its path in the project. */
  exportData(project: Project, code: string): Promise<{ path: string }>
}

/** The month before a month `YYYY-MM`: the last one whose hours can be complete. */
function monthBefore(month: string): string {
  const [year, at] = month.split('-').map(Number) as [number, number]
  return new Date(Date.UTC(year, at - 2, 1)).toISOString().slice(0, MONTH_LENGTH)
}

/**
 * The sheet of each project code of a project, as the PM keeps it over the whole life of the
 * code. It reads what the monthly forecast reads: pass the same readings to both, so the months
 * of timesheets they miss are asked once.
 */
export function createProjectSheets(
  deps: ProjectSheetDeps,
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

  async function timesheetOf(project: Project): Promise<HoursEntry[]> {
    const timesheet = await deps.timesheet(project)
    if (timesheet === null) throw new DomainError('forecast_timesheet_not_set')
    return timesheet
  }

  async function list(project: Project): Promise<Lifetime[]> {
    const month = today().slice(0, MONTH_LENGTH)
    // What was invoiced and recognised changes month by month: asked again, without a word.
    const economics = await economicsOf(project)
    const written = await deps.settings.load(project.folder)
    const plans = await deps.plans.load(project.folder)
    // What a plan says an hour costs or is sold for is what every figure of its code uses.
    const settings = settingsWithPlans(written, plans)
    const all = async (): Promise<Lifetime[]> => {
      const timesheet = await timesheetOf(project)
      const chosen = await readings.codesOf(project, timesheet)
      const codes = [...new Set(chosen.map(forecastCode))].sort()
      const months = await readings.monthsRead(project, month)
      const worklog = await readings.worklogOf(project, codes)
      // The caps are of the project: they are of a code only when it is the only one.
      const team = codes.length === 1 && deps.team ? await deps.team(project) : null
      const caps = team ? teamCaps(team) : []
      return codes.map((code) => {
        const read = economics[code] ?? null
        const life = compileLifetime(code, timesheet, settings, month, months, worklog, caps, read)
        // The month that runs is not a fact yet: the plan is read up to the one before.
        const view = planView(
          plans[code] ?? NO_SHEET_PLAN,
          code,
          timesheet,
          currentHourlyCosts(timesheet, month, read),
          monthBefore(month),
          settings.hoursPerDay,
          standingOf(written, code),
        )
        return withPlan(life, view)
      })
    }
    const first = await all()
    const unread = [...new Set(first.flatMap((sheet) => sheet.unreadMonths))].sort()
    return unread.length > 0 && (await readings.readMissing(project, unread)) ? all() : first
  }

  async function savePlans(project: Project, plans: SheetPlans): Promise<SheetPlans> {
    const clean = cleanSheetPlans(plans)
    await deps.plans.save(project.folder, clean)
    return clean
  }

  /** The code among those of the project, as they are written; refused when it is not one. */
  async function checkedCode(project: Project, asked: string): Promise<string> {
    const code = forecastCode(asked)
    const codes = (await readings.codesOf(project, await timesheetOf(project))).map(forecastCode)
    if (!codes.includes(code)) throw new DomainError('sheet_code_unknown', code)
    return code
  }

  return {
    list,
    plans: (project) => deps.plans.load(project.folder),
    savePlans,

    async propose(project, asked) {
      const code = await checkedCode(project, asked)
      const timesheet = await timesheetOf(project)
      const settings = await deps.settings.load(project.folder)
      const economics = (await economicsOf(project))[code]
      const perHour = (perDay: number): number => perDay / settings.hoursPerDay
      const declared = settings.externals.filter((external) => forecastCode(external.code) === code)
      const named = new Set(declared.map((external) => external.name.toLowerCase()))
      const vendors = [...new Set((economics?.purchases ?? []).map((line) => line.vendor))]
        .filter((vendor) => vendor !== '' && !named.has(vendor.toLowerCase()))
        .sort((a, b) => a.localeCompare(b, 'it'))
      const people = new Map<string, string>()
      for (const entry of timesheet) {
        if (entry.approved && entry.project === code && !people.has(personKey(entry.person))) {
          people.set(personKey(entry.person), entry.person)
        }
      }
      const sources: PlanSources = {
        people: [...people.values()],
        priceOfAnHour: (person) => {
          const rate = rateOf(settings.rates, person, code)
          return rate === null ? null : perHour(rate.ratePerDay)
        },
        externals: [
          ...declared.map((external) => ({
            name: external.name,
            unitCost: perHour(external.costPerDay),
            // A rate of nothing is no rate: the line earns nothing until the PM says what.
            unitPrice: external.ratePerDay > 0 ? perHour(external.ratePerDay) : null,
          })),
          ...vendors.map((name) => ({ name, unitCost: null, unitPrice: null })),
        ],
      }
      const plans = await deps.plans.load(project.folder)
      return savePlans(project, {
        ...plans,
        [code]: proposedPlan(plans[code] ?? NO_SHEET_PLAN, sources),
      })
    },

    async confirm(project, asked) {
      const code = await checkedCode(project, asked)
      const timesheet = await timesheetOf(project)
      const economics = (await economicsOf(project))[code] ?? null
      const month = today().slice(0, MONTH_LENGTH)
      const plans = await deps.plans.load(project.folder)
      const costs = currentHourlyCosts(timesheet, month, economics)
      return savePlans(project, {
        ...plans,
        [code]: confirmedPlan(plans[code] ?? NO_SHEET_PLAN, costs, today()),
      })
    },

    async exportData(project, asked) {
      const code = await checkedCode(project, asked)
      const sheet = (await list(project)).find((entry) => entry.code === code)
      if (sheet?.plan === null || sheet?.plan === undefined) {
        throw new DomainError('sheet_code_unknown', code)
      }
      const path = `${SHEET_FOLDER}/${code}/Dati ${today()}.csv`
      await deps.writer.claim(project.folder)
      await deps.writer.writeBytes(
        project.folder,
        path,
        new TextEncoder().encode(sheetDataCsv(code, sheet.plan)),
      )
      return { path }
    },
  }
}
