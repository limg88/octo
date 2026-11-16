import {
  DEFAULT_FORECAST_SETTINGS,
  type ForecastSettings,
  type HoursEntry,
  NO_FORECAST_PROJECT,
  NO_SOURCES,
  type Project,
  type SheetGrid,
  type WarehouseFeedConfig,
} from '@octo/domain'
import { describe, expect, it } from 'vitest'
import {
  createForecasts,
  FORECAST_FOLDER,
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
    linked?: boolean
    secret?: boolean
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
  const forecasts = createForecasts({
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
  })
  return { forecasts, filled, written, saved: () => saved }
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
          { code: 'p1', description: 'Canone 2026', ordered: 22500 },
          { code: 'P2', description: 'Senza ordini', ordered: null },
        ],
      },
    )
    const run = await forecasts.readOrders(project)
    expect(run.codes).toEqual(['P1', 'P2'])
    expect(saved().projects).toEqual({
      P1: { kind: 'fee', description: 'Canone 2026', ordered: 22500, feeMonths: 12 },
      P2: { ...NO_FORECAST_PROJECT, description: 'Senza ordini' },
    })
    expect(run.settings).toEqual(saved())
    const view = await forecasts.view(project, '2026-06')
    expect(view.forecast.rows[0]?.values.revenue).toBe(1875)
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
