import {
  DEFAULT_PROGRESS_SETTINGS,
  DomainError,
  type ProgressSettings,
  type Project,
} from '@octo/domain'
import { describe, expect, it } from 'vitest'
import {
  createProgress,
  PROGRESS_FOLDER,
  type ProgressSettingsStore,
  type ProjectFiles,
  type SheetWrite,
  type SpreadsheetModel,
} from '../src/index.ts'
import { memoryWriter } from './fakes.ts'

const project: Project = { id: 'p-1', name: 'Aurora', folder: '/progetti/Aurora', addedAt: '' }
const MODEL = new Uint8Array([1])
const FILLED = new Uint8Array([9])
const configured: ProgressSettings = {
  modelPath: 'Moduli/Richiesta SAL.xlsx',
  order: 'ORD-77',
  total: 1000,
  positions: [
    { code: '1', amount: 600 },
    { code: '2', amount: 400 },
  ],
  requests: [
    { n: 1, from: '2026-03-01', to: '2026-03-31', amount: 700, note: 'Fattura 1', positions: [] },
    { n: 2, from: '2026-03-31', to: '2026-04-30', amount: 300, note: 'Fattura 2', positions: [] },
  ],
  form: {
    fields: [{ ref: 'B13', text: '{al_precedente}' }],
    table: { firstRow: 14, rows: 2, position: 'A', previous: 'B', current: 'C', period: 'D' },
  },
}

function setup(initial: ProgressSettings = configured, fill?: () => never) {
  let saved = initial
  const settings: ProgressSettingsStore = {
    load: async () => saved,
    save: async (_folder, next) => {
      saved = next
    },
  }
  const unused = async (): Promise<never> => {
    throw new Error('not used')
  }
  const files: ProjectFiles = {
    withExtensions: async () =>
      ['Moduli/Richiesta SAL.xlsx', 'Moduli/Elenco.xlsx', 'a/Stato di avanzamento.xlsx'].map(
        (path) => ({ path, size: 1, modifiedAt: '' }),
      ),
    read: async (_folder, path) => {
      if (path !== configured.modelPath) throw new Error('ENOENT')
      return MODEL
    },
    readText: unused,
    under: unused,
    remove: unused,
  }
  const filled: SheetWrite[][] = []
  const sheets: SpreadsheetModel = {
    read: () => ({ rows: [] }),
    fill: (_bytes, writes) => {
      fill?.()
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
  return { progress: createProgress({ settings, files, sheets, writer }), filled, written }
}

describe('progress requests', () => {
  it('proposes the spreadsheets that look like the form', async () => {
    expect(await setup().progress.candidates(project)).toEqual([
      'Moduli/Richiesta SAL.xlsx',
      'a/Stato di avanzamento.xlsx',
    ])
  })

  it('saves tidy settings and refuses a form outside the project', async () => {
    const { progress } = setup(DEFAULT_PROGRESS_SETTINGS)
    const clean = await progress.saveSettings(project, {
      ...configured,
      modelPath: ' ./Moduli/Richiesta SAL.xlsx ',
      requests: configured.requests.map((request) => ({ ...request, n: 9 })),
    })
    expect(clean.modelPath).toBe('Moduli/Richiesta SAL.xlsx')
    expect(clean.requests.map((request) => request.n)).toEqual([1, 2])
    expect(await progress.settings(project)).toEqual(clean)
    for (const modelPath of ['/etc/m.xlsx', 'C:\\m.xlsx', '../m.xlsx']) {
      await expect(progress.saveSettings(project, { ...configured, modelPath })).rejects.toThrow(
        'progress_settings_invalid',
      )
    }
  })

  it('shows the shares and the warnings without writing', async () => {
    const { progress, written } = setup({ ...configured, total: 900 })
    const view = await progress.view(project)
    expect(view.computation.ok && view.computation.steps.map((step) => step.current)).toEqual([
      [1, 0.25],
      [1, 1],
    ])
    expect(view.warnings).toEqual([{ kind: 'total_differs', declared: 900, positions: 1000 }])
    expect(written.size).toBe(0)
  })

  it('writes the form of a request beside the others and never the empty form', async () => {
    const { progress, filled, written } = setup()
    const second = await progress.compile(project, 2)
    expect(second).toEqual({ n: 2, path: `${PROGRESS_FOLDER}/Richiesta SAL - 2.xlsx` })
    expect(written.get(second.path)).toBe(FILLED)
    const at = (ref: string) => filled[0]?.find((write) => write.ref === ref)?.cell
    expect(at('B13')).toEqual({ kind: 'text', value: '31/03/2026' })
    expect(at('C15')).toEqual({ kind: 'number', value: 1, percent: true })
    expect(at('B15')).toEqual({ kind: 'number', value: 0.25, percent: true })
    // The first request has no one before: its own start is the date of what came before.
    await progress.compile(project, 1)
    expect(filled[1]?.find((write) => write.ref === 'B13')?.cell).toEqual({
      kind: 'text',
      value: '01/03/2026',
    })
    expect([...written.keys()]).toHaveLength(2)
  })

  it('says why a form cannot be written', async () => {
    const failing = (settings: ProgressSettings, n = 1, fill?: () => never) =>
      setup(settings, fill).progress.compile(project, n)
    await expect(failing({ ...configured, modelPath: '' })).rejects.toThrow(
      'progress_model_not_set',
    )
    await expect(failing({ ...configured, positions: [] })).rejects.toThrow(
      'progress_not_computable',
    )
    await expect(failing(configured, 3)).rejects.toThrow('progress_request_missing')
    const small = { ...configured.form, table: { ...configured.form.table, rows: 1 } }
    await expect(
      failing({ ...configured, form: small as ProgressSettings['form'] }),
    ).rejects.toThrow('progress_not_computable: too_many_positions')
    await expect(failing({ ...configured, modelPath: 'altro.xlsx' })).rejects.toThrow(
      'progress_model_missing',
    )
    await expect(
      failing(configured, 1, () => {
        throw new DomainError('forecast_model_invalid')
      }),
    ).rejects.toThrow('progress_model_invalid')
    await expect(
      failing(configured, 1, () => {
        throw new Error('disk')
      }),
    ).rejects.toThrow('disk')
  })
})
