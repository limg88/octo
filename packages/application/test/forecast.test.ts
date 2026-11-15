import {
  DEFAULT_FORECAST_SETTINGS,
  type ForecastSettings,
  type HoursEntry,
  type Project,
  type SheetGrid,
} from '@octo/domain'
import { describe, expect, it } from 'vitest'
import {
  createForecasts,
  FORECAST_FOLDER,
  type ForecastSettingsStore,
  type ProjectFiles,
  type SheetWrite,
  type SpreadsheetModel,
} from '../src/index.ts'
import { memoryWriter } from './fakes.ts'

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
  options: { sheet?: SheetGrid; timesheet?: HoursEntry[] | null } = {},
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

  it('shows the month without writing anything', async () => {
    const { forecasts, written } = setup(configured)
    const view = await forecasts.view(project, '2026-06')
    expect(view.modelPath).toBe(configured.modelPath)
    expect(view.forecast.rows[0]?.values).toMatchObject({ internalCosts: 200, revenue: 400 })
    expect(written.size).toBe(0)
  })

  it('writes a filled copy under the folder of the month and never the model', async () => {
    const { forecasts, filled, written } = setup(configured)
    const file = await forecasts.compile(project, '2026-06')
    expect(file.path).toBe(`${FORECAST_FOLDER}/2026-06/Previsionale giugno.xlsx`)
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
  })

  it('says what is missing before computing', async () => {
    await expect(setup().forecasts.view(project, '2026-06')).rejects.toThrow(
      'forecast_model_not_set',
    )
    await expect(setup(configured).forecasts.view(project, 'giugno')).rejects.toThrow(
      'forecast_month_invalid',
    )
    await expect(
      setup({ modelPath: 'altro.xlsx' }).forecasts.view(project, '2026-06'),
    ).rejects.toThrow('forecast_model_missing')
    await expect(
      setup(configured, { sheet: { rows: [] } }).forecasts.compile(project, '2026-06'),
    ).rejects.toThrow('forecast_model_invalid')
    await expect(
      setup(configured, { timesheet: null }).forecasts.view(project, '2026-06'),
    ).rejects.toThrow('forecast_timesheet_not_set')
  })
})
