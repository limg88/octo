import {
  DEFAULT_FORECAST_SETTINGS,
  DomainError,
  type ForecastSettings,
  type HoursEntry,
  NO_FORECAST_PROJECT,
  NO_SHEET_REGISTRY,
  NO_SOURCES,
  type Project,
  type SheetGrid,
  type SheetPlans,
  type TrackerHours,
  type WarehouseFeedConfig,
} from '@octo/domain'
import { describe, expect, it } from 'vitest'
import {
  createForecastReadings,
  createForecasts,
  createProjectSheets,
  FORECAST_FOLDER,
  type ForecastDeps,
  type ForecastSettingsStore,
  type ProjectFiles,
  type ProjectOrder,
  type SheetWrite,
  type SpreadsheetModel,
} from '../src/index.ts'
import { memorySourceSettings, memoryVault, memoryWriter } from './fakes.ts'

const project: Project = { id: 'p-1', name: 'Aurora', folder: '/progetti/Aurora', addedAt: '' }
const HEADINGS = [
  'Cod. prog. Netsuite',
  'Ordinato',
  'Previsione costi interni',
  'Previsione costi esterni',
  'Previsione ricavi',
  'N. gg/€',
  'Previsionale marginalità giugno',
  'Previsionale marginalità a fine progetto',
  'Importo da fatturare',
  'Note',
]
const grid: SheetGrid = {
  rows: [
    { number: 1, cells: HEADINGS.map((text, index) => ({ ref: `${'ABCDEFGHIJ'[index]}1`, text })) },
    {
      number: 2,
      cells: [
        { ref: 'A2', text: 'P1' },
        { ref: 'B2', text: '1000' },
      ],
    },
  ],
}
const warehouse: WarehouseFeedConfig = {
  since: '2026-01-01',
  targetFolder: '_octo/fonti/NetSuite',
  host: 'dwsi.example.test',
  port: 5432,
  database: 'dwsi',
  user: 'reader',
  ownerEmail: 'pm@example.test',
  projectCodes: ['P1'],
  tls: 'verify_full',
}
const MODEL = new Uint8Array([1, 2, 3])
const FILLED = new Uint8Array([9])
const hours: HoursEntry[] = [
  {
    person: 'Rossi Mario',
    day: '2026-06-03',
    hours: 8,
    project: 'P1',
    approved: true,
    id: '1',
    cost: 200,
  },
]

function setup(
  initial: Partial<ForecastSettings> = {},
  options: {
    sheet?: SheetGrid
    timesheet?: HoursEntry[] | null
    codes?: string[]
    orders?: ProjectOrder[]
    /** The plans of the project codes, as kept. */
    plans?: SheetPlans
    linked?: boolean
    secret?: boolean
    /** The months of timesheets held whole, and what a reading of the missing ones does. */
    readMonths?: string[] | null
    readTimesheets?: (period: { from: string; to: string }) => Promise<void>
    today?: string
    /** The hours logged on the tracker, or how reading them fails. */
    worklog?: TrackerHours[] | Error
    /** The caps in days of the people of the project, by name. */
    caps?: Record<string, number>
  } = {},
) {
  let saved: ForecastSettings = { ...DEFAULT_FORECAST_SETTINGS, ...initial }
  const settings: ForecastSettingsStore = {
    load: async () => saved,
    save: async (_folder, next) => {
      saved = next
    },
  }
  const unused = async (): Promise<never> => {
    throw new Error('not used')
  }
  const files: ProjectFiles = {
    withExtensions: async (_folder, extensions) =>
      ['amministrazione/Previsionale giugno.xlsx', 'note/elenco.xlsx', 'a/Forecast.xlsx']
        .filter((path) => extensions.some((extension) => path.endsWith(`.${extension}`)))
        .map((path) => ({ path, size: 1, modifiedAt: '' })),
    read: async (_folder, path) => {
      if (path !== 'amministrazione/Previsionale giugno.xlsx') throw new Error('ENOENT')
      return MODEL
    },
    readText: unused,
    under: unused,
    remove: unused,
  }
  const filled: SheetWrite[][] = []
  const sheets: SpreadsheetModel = {
    read: () => options.sheet ?? grid,
    fill: (_bytes, writes) => {
      filled.push([...writes])
      return FILLED
    },
  }
  const secrets = memoryVault()
  if (options.secret !== false) void secrets.set('p-1/dwsi', 'token')
  const written = new Map<string, Uint8Array>()
  const writer = {
    ...memoryWriter(),
    writeBytes: async (_folder: string, path: string, bytes: Uint8Array) => {
      written.set(path, bytes)
    },
  }
  let plans: SheetPlans = options.plans ?? {}
  const deps: ForecastDeps = {
    sheetPlans: async () => plans,
    settings,
    files,
    sheets,
    timesheet: async () => (options.timesheet === undefined ? hours : options.timesheet),
    codes: async () => options.codes ?? [],
    sources: memorySourceSettings(
      options.linked === false ? NO_SOURCES : { ...NO_SOURCES, dwsi: warehouse },
    ),
    secrets,
    orders: { read: async () => options.orders ?? [] },
    writer,
    ...(options.readMonths === undefined
      ? {}
      : { readMonths: async () => options.readMonths ?? null }),
    ...(options.readTimesheets === undefined
      ? {}
      : { readTimesheets: async (_project, period) => options.readTimesheets?.(period) }),
    ...(options.today === undefined
      ? {}
      : { clock: { now: () => new Date(`${options.today}T10:00:00.000Z`) } }),
    ...(options.caps === undefined
      ? {}
      : {
          team: async () => ({
            people: Object.entries(options.caps ?? {}).map(([name, capDays]) => ({
              name,
              role: '',
              side: 'supplier' as const,
              from: '',
              to: '',
              allocation: null,
              note: '',
              capDays,
            })),
            periods: [],
          }),
        }),
    ...(options.worklog === undefined
      ? {}
      : {
          worklog: async () => {
            if (options.worklog instanceof Error) throw options.worklog
            return options.worklog ?? []
          },
        }),
  }
  // One reading for both, as the app wires them.
  const readings = createForecastReadings(deps)
  const forecasts = createForecasts(deps, readings)
  const projectSheets = createProjectSheets(
    {
      ...deps,
      plans: {
        load: async () => plans,
        save: async (_folder, next) => {
          plans = next
        },
      },
    },
    readings,
  )
  return { forecasts, projectSheets, filled, written, saved: () => saved, plans: () => plans }
}

const configured = {
  modelPath: 'amministrazione/Previsionale giugno.xlsx',
  rates: [{ person: 'Rossi Mario', code: null, ratePerDay: 400 }],
}

describe('the monthly forecast', () => {
  it('proposes the spreadsheets that look like the model', async () => {
    const { forecasts } = setup()
    expect(await forecasts.candidates(project)).toEqual([
      'a/Forecast.xlsx',
      'amministrazione/Previsionale giugno.xlsx',
    ])
  })

  it('saves tidy settings and refuses a model outside the project', async () => {
    const { forecasts, saved } = setup()
    const clean = await forecasts.saveSettings(project, {
      ...DEFAULT_FORECAST_SETTINGS,
      modelPath: ' ./amministrazione//Previsionale giugno.xlsx ',
      hoursPerDay: -1,
    })
    expect(clean.modelPath).toBe('amministrazione/Previsionale giugno.xlsx')
    expect(saved().hoursPerDay).toBe(8)
    expect(await forecasts.settings(project)).toEqual(clean)
    for (const modelPath of ['/etc/model.xlsx', 'C:\\model.xlsx', '../fuori.xlsx']) {
      await expect(
        forecasts.saveSettings(project, { ...DEFAULT_FORECAST_SETTINGS, modelPath }),
      ).rejects.toThrow('forecast_settings_invalid')
    }
  })

  it('shows the month of the codes of the project, with no model and without writing', async () => {
    const { forecasts, written } = setup({ rates: configured.rates })
    const view = await forecasts.view(project, '2026-06')
    expect(view.modelPath).toBe('')
    expect(view.forecast.rows.map((row) => row.code)).toEqual(['P1'])
    expect(view.forecast.rows[0]?.values).toMatchObject({ internalCosts: 200, revenue: 400 })
    expect(written.size).toBe(0)
  })

  it('keeps to the codes said to be of the project, whatever the timesheets carry', async () => {
    const other = { ...hours[0], project: 'P9', id: '2' } as HoursEntry
    const options = { timesheet: [...hours, other] }
    const all = await setup({}, options).forecasts.view(project, '2026-06')
    expect(all.forecast.rows.map((row) => row.code)).toEqual(['P1', 'P9'])
    const chosen = await setup({}, { ...options, codes: [' p9 ', 'P5'] }).forecasts.view(
      project,
      '2026-06',
    )
    expect(chosen.forecast.rows.map((row) => row.code)).toEqual(['P5', 'P9'])
    expect(chosen.forecast.otherCodes).toEqual(['P1'])
  })

  it('writes a filled copy under the folder of the month and never the model', async () => {
    const { forecasts, filled, written } = setup(configured, { codes: ['P1', 'P7'] })
    const file = await forecasts.compile(project, '2026-06')
    expect(file).toEqual({
      path: `${FORECAST_FOLDER}/2026-06/Previsionale giugno.xlsx`,
      notInModel: ['P7'],
    })
    expect(written.get(file.path)).toBe(FILLED)
    expect([...written.keys()]).toEqual([file.path])
    expect(filled[0]?.map((write) => write.ref).sort()).toEqual([
      'C2',
      'D2',
      'E2',
      'F2',
      'G2',
      'H2',
      'I2',
      'J2',
    ])
    expect(filled[0]?.find((write) => write.ref === 'C2')?.cell).toEqual({
      kind: 'formula',
      formula: '200',
      value: 200,
    })
    // The formulas name the cells of the row the model keeps the code at.
    expect(filled[0]?.find((write) => write.ref === 'G2')?.cell).toMatchObject({
      formula: 'IFERROR((E2-C2-D2)/E2,"")',
    })
  })

  it('reads name and ordered amount from the company system, keeping how a code is sold', async () => {
    const { forecasts, saved } = setup(
      { projects: { P1: { ...NO_FORECAST_PROJECT, kind: 'fee', feeMonths: 12 } } },
      {
        orders: [
          // The orders say «by the day», but the PM already said how this code is sold.
          {
            code: 'p1',
            description: 'Canone 2026',
            ordered: 22500,
            kind: 'time_material',
            startMonth: '2026-02',
            invoiced: 6750,
            recognized: 15750,
          },
          {
            code: 'P2',
            description: 'Senza ordini',
            ordered: null,
            kind: null,
            startMonth: null,
            invoiced: null,
            recognized: null,
          },
        ],
      },
    )
    const run = await forecasts.readOrders(project)
    expect(run.codes).toEqual(['P1', 'P2'])
    expect(saved().projects).toEqual({
      P1: {
        kind: 'fee',
        description: 'Canone 2026',
        ordered: 22500,
        feeMonths: 12,
        startMonth: '2026-02',
        // What was invoiced and recognised is taken at every reading, as the ordered amount is.
        invoiced: 6750,
        recognized: 15750,
      },
      P2: { ...NO_FORECAST_PROJECT, description: 'Senza ordini' },
    })
    expect(run.settings).toEqual(saved())
    const view = await forecasts.view(project, '2026-06')
    expect(view.forecast.rows[0]?.values.revenue).toBe(1875)
  })

  it('takes how a code is sold from its orders the first time it reads the code', async () => {
    const { forecasts, saved } = setup(
      {},
      {
        codes: ['P1'],
        orders: [
          {
            code: 'P1',
            description: 'Assessment',
            ordered: 7500,
            kind: 'fixed_price',
            startMonth: '2026-04',
            invoiced: null,
            recognized: null,
          },
        ],
      },
    )
    await forecasts.readOrders(project)
    expect(saved().projects).toEqual({
      P1: {
        kind: 'fixed_price',
        description: 'Assessment',
        ordered: 7500,
        feeMonths: null,
        startMonth: '2026-04',
        invoiced: null,
        recognized: null,
      },
    })
    // Sold at a fixed price, with nothing more written: it asks the costs at budget, no rate.
    const { forecast } = await forecasts.view(project, '2026-06')
    expect(forecast.rows[0]).toMatchObject({ code: 'P1', revenueKind: 'fixed_price' })
    expect(forecast.gaps.map((gap) => gap.kind)).toEqual(['no_budget_costs', 'no_total_costs'])

    // The PM corrects it, and a later reading leaves it as corrected.
    await forecasts.saveSettings(project, {
      ...saved(),
      projects: { P1: { ...(saved().projects.P1 ?? NO_FORECAST_PROJECT), kind: 'time_material' } },
    })
    await forecasts.readOrders(project)
    expect(saved().projects.P1?.kind).toBe('time_material')
  })

  it('reads by itself the months of timesheets a fixed price misses, and says so when it cannot', async () => {
    const worked = (id: string, day: string, hoursWorked: number, cost: number): HoursEntry => ({
      person: 'Rossi Mario',
      day,
      hours: hoursWorked,
      project: 'P1',
      approved: true,
      id,
      cost,
    })
    const september = worked('9', '2026-09-15', 34, 850)
    const october = worked('10', '2026-10-06', 21.5, 537.5)
    const fixed: Partial<ForecastSettings> = {
      projects: {
        P1: { ...NO_FORECAST_PROJECT, kind: 'fixed_price', ordered: 7500, startMonth: '2026-09' },
      },
      months: {
        '2026-10': {
          P1: {
            externals: [],
            toInvoice: null,
            revenue: null,
            budgetCosts: 4000,
            totalCosts: null,
            totalCostsBeforeMonth: false,
            note: '',
          },
        },
      },
    }
    const asked: Array<{ from: string; to: string }> = []
    const options: NonNullable<Parameters<typeof setup>[1]> = {
      codes: ['P1'],
      timesheet: [october],
      readMonths: ['2026-10'],
      today: '2026-11-17',
      readTimesheets: async (period) => {
        asked.push(period)
        options.timesheet = [september, october]
        options.readMonths = ['2026-09', '2026-10']
      },
    }
    const { forecast } = await setup(fixed, options).forecasts.view(project, '2026-10')
    // September was asked to the company's system, a whole month, and its costs count.
    expect(asked).toEqual([{ from: '2026-09-01', to: '2026-09-30' }])
    expect(forecast.unreadMonths).toEqual([])
    expect(forecast.rows[0]?.values.quantity).toBeCloseTo(0.346875)

    // Two openings of the page at once make one reading, and both see what it brought.
    asked.length = 0
    options.timesheet = [october]
    options.readMonths = ['2026-10']
    const twice = setup(fixed, options).forecasts
    const both = await Promise.all([twice.view(project, '2026-10'), twice.view(project, '2026-10')])
    expect(asked).toHaveLength(1)
    expect(both.map((view) => view.forecast.unreadMonths)).toEqual([[], []])

    // No credential here: the forecast is the one of the months on disk, and it says what misses.
    const failing = setup(fixed, {
      codes: ['P1'],
      timesheet: [october],
      readMonths: ['2026-10'],
      today: '2026-11-17',
      readTimesheets: async () => {
        throw new DomainError('secret_missing')
      },
    })
    const partial = (await failing.forecasts.view(project, '2026-10')).forecast
    expect(partial.unreadMonths).toEqual(['2026-09'])
    expect(partial.rows[0]?.values.quantity).toBeCloseTo(0.134375)
    expect(partial.gaps).toContainEqual({ kind: 'unread_months', code: 'P1', months: ['2026-09'] })

    // Nobody to ask: the same warning. A failure that is not of the source is not swallowed.
    const alone = setup(fixed, { codes: ['P1'], timesheet: [october], readMonths: ['2026-10'] })
    expect((await alone.forecasts.view(project, '2026-10')).forecast.unreadMonths).toEqual([
      '2026-09',
    ])
    const broken = setup(fixed, {
      codes: ['P1'],
      timesheet: [october],
      readMonths: [],
      readTimesheets: async () => {
        throw new Error('disk full')
      },
    })
    await expect(broken.forecasts.view(project, '2026-10')).rejects.toThrow('disk full')
  })

  it('asks no timesheets of the months to come, and a long stretch a year at a time', async () => {
    const asked: Array<{ from: string; to: string }> = []
    const since = (startMonth: string): Partial<ForecastSettings> => ({
      projects: { P1: { ...NO_FORECAST_PROJECT, kind: 'fixed_price', startMonth } },
    })
    const options = {
      codes: ['P1'],
      timesheet: [],
      today: '2026-11-17',
      readTimesheets: async (period: { from: string; to: string }) => {
        asked.push(period)
      },
    }
    const ahead = setup(since('2026-09'), {
      ...options,
      readMonths: ['2026-09', '2026-10', '2026-11'],
    })
    expect((await ahead.forecasts.view(project, '2026-12')).forecast.unreadMonths).toEqual([])
    expect(asked).toEqual([])

    const long = setup(since('2025-01'), { ...options, readMonths: [] })
    await long.forecasts.view(project, '2026-03')
    expect(asked).toEqual([
      { from: '2025-01-01', to: '2025-12-31' },
      { from: '2026-01-01', to: '2026-03-31' },
    ])
    // Files kept by hand: nothing can be said to miss, nothing is asked.
    asked.length = 0
    const byHand = setup(since('2025-01'), { ...options, readMonths: null })
    expect((await byHand.forecasts.view(project, '2026-03')).forecast.unreadMonths).toEqual([])
    expect(asked).toEqual([])
  })

  it('tells a code over its whole life, reading by itself the months it misses', async () => {
    const worked = (
      id: string,
      person: string,
      day: string,
      h: number,
      cost: number,
    ): HoursEntry => ({
      person,
      day,
      hours: h,
      project: 'P1',
      approved: true,
      id,
      cost,
    })
    const september = worked('9', 'Rossi Mario', '2026-09-15', 34, 1700)
    const october = worked('10', 'Bianchi Luca', '2026-10-06', 21.5, 990)
    const fixed: Partial<ForecastSettings> = {
      projects: {
        P1: {
          ...NO_FORECAST_PROJECT,
          kind: 'fixed_price',
          ordered: 7500,
          startMonth: '2026-09',
          invoiced: 2250,
          recognized: 5250,
        },
      },
    }
    const asked: Array<{ from: string; to: string }> = []
    const options: NonNullable<Parameters<typeof setup>[1]> = {
      codes: ['p1 ', 'P1'],
      timesheet: [october],
      readMonths: ['2026-10', '2026-11'],
      today: '2026-11-17',
      readTimesheets: async (period) => {
        asked.push(period)
        options.timesheet = [september, october]
        options.readMonths = ['2026-09', '2026-10', '2026-11']
      },
    }
    const [lifetime, ...others] = await setup(fixed, options).projectSheets.list(project)
    expect(others).toEqual([])
    expect(asked).toEqual([{ from: '2026-09-01', to: '2026-09-30' }])
    expect(lifetime).toMatchObject({
      code: 'P1',
      through: '2026-11',
      hours: 55.5,
      costs: 2690,
      invoiced: 2250,
      recognized: 5250,
      unreadMonths: [],
    })
    expect(lifetime?.lines.map((line) => line.person)).toEqual(['Bianchi Luca', 'Rossi Mario'])

    // Opened while the month is being read: it waits for that reading, then asks what it lacks.
    asked.length = 0
    const read = new Set(['2026-10'])
    const busy: NonNullable<Parameters<typeof setup>[1]> = {
      codes: ['P1'],
      timesheet: [september, october],
      readMonths: [...read],
      today: '2026-11-17',
      readTimesheets: async (period) => {
        asked.push(period)
        read.add(period.from.slice(0, 7))
        busy.readMonths = [...read]
      },
      // What NetSuite says today of the invoices and of the revenue replaces what was kept.
      orders: [
        {
          code: 'P1',
          description: 'Assessment',
          ordered: 7500,
          kind: 'fixed_price',
          startMonth: '2026-08',
          invoiced: 7500,
          recognized: 6000,
        },
      ],
    }
    const together = setup(fixed, busy)
    const [month, lives] = await Promise.all([
      together.forecasts.view(project, '2026-10'),
      together.projectSheets.list(project),
    ])
    expect(asked).toEqual([
      { from: '2026-09-01', to: '2026-09-30' },
      { from: '2026-11-01', to: '2026-11-30' },
    ])
    expect(month.forecast.unreadMonths).toEqual([])
    expect(lives[0]).toMatchObject({ unreadMonths: [], invoiced: 7500, recognized: 6000 })

    // NetSuite cannot be asked: the life of the code is told with what is there, and says so.
    const alone = setup(fixed, { codes: ['P1'], timesheet: [october], readMonths: ['2026-10'] })
    const [partial] = await alone.projectSheets.list(project)
    expect(partial?.unreadMonths).toContain('2026-09')
    expect(partial?.costs).toBe(990)
    const unlinked = setup(fixed, { codes: ['P1'], timesheet: [october], linked: false })
    expect((await unlinked.projectSheets.list(project))[0]).toMatchObject({ invoiced: 2250 })
    await expect(
      setup(fixed, { timesheet: null }).projectSheets.list(project),
    ).rejects.toMatchObject({ code: 'forecast_timesheet_not_set' })
  })

  it('counts the hours of the tracker only when the project has one code they can be of', async () => {
    const october: HoursEntry = {
      person: 'Bianchi Luca',
      day: '2026-10-06',
      hours: 10,
      project: 'P1',
      approved: true,
      id: '1',
      cost: 460,
    }
    const worklog: TrackerHours[] = [
      { issue: 'AUR-3', person: 'Luca Bianchi', day: '2026-11-03', hours: 4.5 },
      { issue: 'AUR-1', person: 'Sara Verdi', day: '2026-10-20', hours: 5 },
    ]
    const settings: Partial<ForecastSettings> = {
      projects: { P1: { ...NO_FORECAST_PROJECT, kind: 'fixed_price', ordered: 7500 } },
      hourlyCosts: [{ person: 'Verdi Sara', costPerHour: 70 }],
    }
    const one = setup(settings, {
      codes: ['P1'],
      timesheet: [october],
      worklog,
      today: '2026-11-17',
    })
    const [life] = await one.projectSheets.list(project)
    expect(life?.lines.map((line) => [line.person, line.source, line.cost])).toEqual([
      ['Bianchi Luca', 'timesheet', 460],
      ['Sara Verdi', 'no_timesheet', 350],
      ['Bianchi Luca', 'estimate', 207],
    ])
    const month = await one.forecasts.view(project, '2026-10')
    expect(month.forecast.rows[0]?.values.externalCosts).toBe(350)

    // The caps of the people propose the costs at budget: 8 days of Luca at 46 an hour.
    const capped = setup(settings, {
      codes: ['P1'],
      timesheet: [october],
      caps: { 'Luca Bianchi': 8, 'Ugo Neri': 3 },
    })
    expect((await capped.projectSheets.list(project))[0]?.proposedBudget).toEqual({
      costs: 2944,
      people: [{ person: 'Luca Bianchi', days: 8, costPerHour: 46 }],
      withoutCost: ['Ugo Neri'],
    })
    const cappedTwo = setup(settings, {
      codes: ['P1', 'P2'],
      timesheet: [october],
      caps: { 'Luca Bianchi': 8 },
    })
    expect((await cappedTwo.projectSheets.list(project))[0]?.proposedBudget).toBeNull()

    // Two codes: the tracker does not say which the hours are of, and they are of neither.
    const two = setup(settings, {
      codes: ['P1', 'P2'],
      timesheet: [october],
      worklog,
      today: '2026-11-17',
    })
    const lives = await two.projectSheets.list(project)
    expect(lives.flatMap((entry) => entry.lines.map((line) => line.source))).toEqual(['timesheet'])
    // Hours that cannot be read leave the forecast as the timesheets tell it.
    const failing = setup(settings, {
      codes: ['P1'],
      timesheet: [october],
      worklog: new DomainError('hours_settings_invalid'),
      today: '2026-11-17',
    })
    expect((await failing.projectSheets.list(project))[0]?.estimatedHours).toBe(0)
    const broken = setup(settings, {
      codes: ['P1'],
      timesheet: [october],
      worklog: new Error('disk'),
    })
    await expect(broken.forecasts.view(project, '2026-10')).rejects.toThrow('disk')
  })

  it('says what is missing before computing', async () => {
    await expect(setup().forecasts.compile(project, '2026-06')).rejects.toThrow(
      'forecast_model_not_set',
    )
    await expect(setup(configured).forecasts.view(project, 'giugno')).rejects.toThrow(
      'forecast_month_invalid',
    )
    await expect(
      setup({ modelPath: 'altro.xlsx' }).forecasts.compile(project, '2026-06'),
    ).rejects.toThrow('forecast_model_missing')
    await expect(
      setup(configured, { sheet: { rows: [] } }).forecasts.compile(project, '2026-06'),
    ).rejects.toThrow('forecast_model_invalid')
    await expect(
      setup(configured, { timesheet: null }).forecasts.view(project, '2026-06'),
    ).rejects.toThrow('forecast_timesheet_not_set')
    await expect(setup({}, { linked: false }).forecasts.readOrders(project)).rejects.toThrow(
      'source_not_configured',
    )
    await expect(setup({}, { secret: false }).forecasts.readOrders(project)).rejects.toThrow(
      'secret_missing',
    )
  })
})

describe('the plan of a project code', () => {
  const worked: HoursEntry[] = [
    {
      person: 'Rossi Mario',
      day: '2026-09-10',
      hours: 32,
      project: 'P1',
      approved: true,
      id: '1',
      cost: 800,
    },
    {
      person: 'Rossi Mario',
      day: '2026-10-05',
      hours: 48,
      project: 'P1',
      approved: true,
      id: '2',
      cost: 1440,
    },
    {
      person: 'Bianchi Luca',
      day: '2026-10-06',
      hours: 4,
      project: 'P1',
      approved: true,
      id: '3',
      cost: 160,
    },
    {
      person: 'Neri Ugo',
      day: '2026-10-06',
      hours: 4,
      project: 'P9',
      approved: true,
      id: '4',
      cost: 160,
    },
  ]
  const order: ProjectOrder = {
    code: 'P1',
    description: 'Aurora',
    ordered: 10000,
    kind: 'time_material',
    startMonth: '2026-09',
    invoiced: null,
    recognized: null,
    economics: {
      standardCosts: [{ person: 'Mario Rossi', costPerHour: 35 }],
      ledger: [],
      invoices: [],
      purchases: [
        { order: 'PO-1', vendor: 'Studio Blu', day: '2026-09-01', amount: 2000 },
        { order: 'PO-2', vendor: 'Verdi Sara', day: '2026-09-01', amount: 500 },
      ],
      receipts: [],
      vendorInvoices: [],
    },
  }
  const settings: Partial<ForecastSettings> = {
    rates: [{ person: 'Rossi Mario', code: null, ratePerDay: 480 }],
    externals: [
      { name: 'Verdi Sara', code: 'P1', costPerDay: 400, ratePerDay: 560 },
      { name: 'Altri', code: 'P9', costPerDay: 1, ratePerDay: 1 },
    ],
  }
  const options = { codes: ['P1'], timesheet: worked, orders: [order], today: '2026-11-17' }

  it('is proposed from who is known, kept, confirmed at the costs of today and read against the months', async () => {
    const app = setup(settings, options)
    expect(await app.projectSheets.plans(project)).toEqual({})
    const proposed = await app.projectSheets.propose(project, ' p1 ')
    expect(
      proposed.P1?.lines.map((line) => [line.group, line.name, line.unitCost, line.unitPrice]),
    ).toEqual([
      ['internal', 'Bianchi Luca', null, null],
      // 480 a day over 8 hours.
      ['internal', 'Rossi Mario', null, 60],
      // Declared from outside on this code, at 400 and 560 a day; then the suppliers with an order.
      ['external', 'Verdi Sara', 50, 70],
      ['external', 'Studio Blu', null, null],
    ])
    // Asked again it adds nothing.
    expect(await app.projectSheets.propose(project, 'P1')).toEqual(proposed)
    const typed = {
      P1: {
        ...(proposed.P1 as NonNullable<typeof proposed.P1>),
        lines: (proposed.P1?.lines ?? []).map((line) =>
          line.name === 'Rossi Mario'
            ? { ...line, budget: { '2026-09': 40, '2026-11': 40 } }
            : line,
        ),
      },
    }
    expect(await app.projectSheets.savePlans(project, typed)).toEqual(typed)
    expect(app.plans()).toEqual(typed)

    const [sheet] = await app.projectSheets.list(project)
    // The month that runs is not a fact yet: the plan is read up to October.
    expect(sheet?.plan).toMatchObject({ through: '2026-10', confirmedOn: null })
    const mario = sheet?.plan?.lines.find((line) => line.name === 'Rossi Mario')
    // What an hour costs today is what the company's system says: 35, not the 25 or 30 of the rows.
    expect(mario).toMatchObject({
      unitCost: 35,
      current: { '2026-09': 32, '2026-10': 48, '2026-11': 40 },
    })
    expect(sheet?.budgetCosts).toBe(80 * 35)
    // So far 80 hours at 35 and 4 at 40; 40 more hours planned for November.
    expect(sheet?.costs).toBe(80 * 35 + 160)
    expect(sheet?.expectedCosts).toBe(80 * 35 + 160 + 40 * 35)
    expect(sheet?.marginAtEnd).toBeCloseTo((10000 - 4360) / 10000)

    const confirmed = await app.projectSheets.confirm(project, 'P1')
    expect(confirmed.P1?.confirmedOn).toBe('2026-11-17')
    expect(confirmed.P1?.lines.map((line) => line.unitCost)).toEqual([40, 35, 50, null])
  })

  it('writes the long table of a code as a file, and refuses a code that is not of the project', async () => {
    const app = setup(settings, {
      ...options,
      plans: {
        P1: {
          lines: [
            {
              group: 'internal',
              name: 'Rossi Mario',
              unitCost: 30,
              unitPrice: 60,
              budget: { '2026-09': 40 },
              forecast: {},
              declared: {},
            },
          ],
          confirmedOn: null,
          milestones: [],
          declaredProgress: {},
          registry: NO_SHEET_REGISTRY,
        },
      },
    })
    expect(await app.projectSheets.exportData(project, 'P1')).toEqual({
      path: '_octo/commessa/P1/Dati 2026-11-17.csv',
    })
    const file = new TextDecoder().decode(app.written.get('_octo/commessa/P1/Dati 2026-11-17.csv'))
    expect(file.split('\n')[1]).toMatch(/^P1;2026;2026-10;BUDGET;Ricavi;0,00;.*;2400,00$/)
    for (const call of [
      () => app.projectSheets.exportData(project, 'P9'),
      () => app.projectSheets.propose(project, 'P9'),
      () => app.projectSheets.confirm(project, 'P9'),
    ]) {
      await expect(call()).rejects.toMatchObject({ code: 'sheet_code_unknown' })
    }
    // With the company's system out of reach the plan still starts from the timesheets.
    const alone = setup(settings, { ...options, linked: false })
    expect(
      (await alone.projectSheets.propose(project, 'P1')).P1?.lines.map((line) => line.name),
    ).toEqual(['Bianchi Luca', 'Rossi Mario', 'Verdi Sara'])
    await expect(
      setup(settings, { ...options, timesheet: null }).projectSheets.propose(project, 'P1'),
    ).rejects.toMatchObject({ code: 'forecast_timesheet_not_set' })
  })

  it('prices the month of its code: a rate written in the budget is the rate of the forecast', async () => {
    const june: HoursEntry[] = [
      {
        person: 'Rossi Mario',
        day: '2026-06-03',
        hours: 16,
        project: 'P1',
        approved: true,
        id: '1',
        cost: 400,
      },
    ]
    const bare = setup({}, { codes: ['P1'], timesheet: june })
    const before = await bare.forecasts.view(project, '2026-06')
    expect(before.forecast.gaps).toContainEqual(expect.objectContaining({ kind: 'no_rate' }))
    const planned = setup(
      {},
      {
        codes: ['P1'],
        timesheet: june,
        plans: {
          P1: {
            lines: [
              {
                group: 'internal',
                name: 'Mario Rossi',
                unitCost: null,
                unitPrice: 60,
                budget: {},
                forecast: {},
                declared: {},
              },
            ],
            confirmedOn: null,
            milestones: [],
            declaredProgress: {},
            registry: NO_SHEET_REGISTRY,
          },
        },
      },
    )
    const after = await planned.forecasts.view(project, '2026-06')
    // Two days at 480: no rate is missing any more, and nothing was written in the settings.
    expect(after.forecast.rows[0]?.values.revenue).toBe(960)
    expect(after.forecast.gaps.filter((gap) => gap.kind === 'no_rate')).toEqual([])
    expect((await planned.forecasts.settings(project)).rates).toEqual([])
  })
})
