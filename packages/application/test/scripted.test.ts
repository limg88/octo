import {
  DomainError,
  type ForecastCell,
  type Project,
  SCRIPTED_FOLDER,
  type SheetGrid,
} from '@octo/domain'
import { describe, expect, it } from 'vitest'
import {
  createScriptedDeliverables,
  type FeedRecord,
  type ScriptedDeps,
  type ScriptRunner,
} from '../src/index.ts'
import { countingIds, memoryWorkFolders } from './fakes.ts'

const project: Project = { id: 'p-1', name: 'Aurora', folder: '/progetti/Aurora', addedAt: '' }
const encode = (text: string) => new TextEncoder().encode(text)
const decode = (bytes: Uint8Array | undefined) => new TextDecoder().decode(bytes)

const manifest = (inputs: object = {}) =>
  JSON.stringify({
    title: 'Modulo di avanzamento',
    about: 'Il modulo del cliente.',
    parameters: [
      { name: 'richiesta', label: 'Numero della richiesta' },
      { name: 'NO', label: 'x' },
    ],
    inputs,
  })
const TEMPLATE = {
  'deliverable.json': manifest(),
  'istruzioni.md': '# Istruzioni',
  'script.py': 'print("ok")',
  'config.json': '{"order":"","positions":[],"requests":[]}',
}
const ALIGNMENT_TEMPLATE = {
  'deliverable.json': JSON.stringify({
    title: 'Allineamento',
    inputs: { voci: { kind: 'tracker', path: '' }, ticket: { kind: 'records', folder: '' } },
  }),
  'script.py': 'print("ok")',
  'config.json': '{"sprint":"","period":"","tags":[]}',
}
const tracker = {
  exported_at: '2026-11-17T08:00:00Z',
  items: [
    { id: 1, title: 'Nostra', created_date: '2026-10-01T08:00:00Z', assigned_to: 'Mario Rossi' },
    { id: 2, title: 'Di altri', created_date: '2026-10-01T08:00:00Z', assigned_to: 'Ugo Neri' },
  ],
}
const tickets: FeedRecord[] = [{ title: '[AZDO 1] Nostra', record: { key: 'AUR-1' } }]

type Options = {
  /** What the script writes in its result when it runs. */
  result?: unknown
  kept?: Record<string, unknown>
  exportPath?: string
  jiraFolder?: string | null
}

function setup(options: Options = {}) {
  // The files of the project, hidden folders included, by their path.
  const disk = new Map<string, Uint8Array>([['Moduli/Richiesta.xlsx', encode('MODELLO')]])
  const work = memoryWorkFolders()
  const ran: Array<{ words?: string; workFolder: string }> = []
  const runner: ScriptRunner = {
    run: async (request) => {
      ran.push({ workFolder: request.workFolder })
      if (options.result !== undefined)
        work.left.set('esito.json', encode(JSON.stringify(options.result)))
      return { said: 'ok' }
    },
    correct: async (request) => {
      ran.push({ workFolder: request.workFolder, words: request.words })
      work.left.set('config.json', encode('{"sprint":"Sprint 29"}'))
      work.left.set(
        'esito.json',
        encode(JSON.stringify({ ok: true, messages: ['fatto'], files: [] })),
      )
      return { summary: 'Ho cambiato lo sprint.' }
    },
  }
  const filled: Array<{ model: string; writes: unknown }> = []
  const unused = async (): Promise<never> => {
    throw new Error('not used')
  }
  const deps: ScriptedDeps = {
    files: {
      withExtensions: unused,
      read: async (_folder, path) => {
        const bytes = disk.get(path)
        if (bytes === undefined) throw new Error('ENOENT')
        return bytes
      },
      readText: async (_folder, path) => (disk.has(path) ? decode(disk.get(path)) : null),
      under: async (_folder, folder) =>
        [...disk.keys()].filter((path) => path.startsWith(`${folder}/`)),
      remove: unused,
    },
    writer: {
      write: unused,
      claim: async () => {},
      writeBytes: async (_folder, path, bytes) => {
        disk.set(path, bytes)
      },
    },
    work,
    runner,
    templates: {
      slugs: async () => ['allineamento', 'avanzamento'],
      files: async (slug) =>
        Object.entries(
          slug === 'avanzamento' ? TEMPLATE : slug === 'allineamento' ? ALIGNMENT_TEMPLATE : {},
        ).map(([name, text]) => ({ name, content: encode(text) })),
    },
    ids: countingIds('run'),
    sheets: {
      read: (): SheetGrid => ({ rows: [] }) as unknown as SheetGrid,
      fill: (bytes, writes) => {
        filled.push({ model: decode(bytes), writes })
        return encode('COMPILATO')
      },
    },
    kept: { read: async (_folder, name) => options.kept?.[name] ?? null },
    exports: {
      readJson: async (_folder, path) => (path === 'dati/tracker.json' ? tracker : null),
      candidates: unused,
    },
    dashboard: {
      load: async () => ({ exportPath: options.exportPath ?? 'dati/tracker.json' }) as never,
    },
    sources: {
      load: async () =>
        ({
          jira:
            options.jiraFolder === null
              ? null
              : { targetFolder: options.jiraFolder ?? '_octo/fonti/Jira' },
        }) as never,
    },
    records: { under: async (_folder, folder) => (folder === '_octo/fonti/Jira' ? tickets : []) },
    team: async () => ({
      people: [
        {
          name: 'Rossi Mario',
          role: '',
          side: 'supplier',
          from: '',
          to: '',
          allocation: null,
          note: '',
          capDays: null,
        },
      ],
      periods: [],
    }),
  }
  const text = (path: string) => decode(disk.get(path))
  return { scripted: createScriptedDeliverables(deps), disk, work, ran, filled, text }
}

const cell: ForecastCell = { kind: 'number', value: 0.5, percent: true }
const FILL = {
  ok: true,
  messages: ['Richiesta 2'],
  files: ['uscita/quote.csv'],
  fill: {
    model: 'Moduli/Richiesta.xlsx',
    output: 'uscita/Richiesta - 2.xlsx',
    writes: [{ ref: 'B2', cell }],
  },
}

describe('the deliverables with a script', () => {
  it('lists those the app ships, and starts one in the project from them, once', async () => {
    const { scripted, disk, text } = setup()
    expect(await scripted.list(project)).toEqual([
      { slug: 'allineamento', title: 'Allineamento', about: '', parameters: [], installed: false },
      {
        slug: 'avanzamento',
        title: 'Modulo di avanzamento',
        about: 'Il modulo del cliente.',
        // A parameter whose name could not be a file name is not asked.
        parameters: [{ name: 'richiesta', label: 'Numero della richiesta' }],
        installed: false,
      },
    ])
    const after = await scripted.install(project, 'avanzamento')
    expect(after.map((entry) => [entry.slug, entry.installed])).toEqual([
      ['avanzamento', true],
      ['allineamento', false],
    ])
    expect(text(`${SCRIPTED_FOLDER}/avanzamento/script.py`)).toBe('print("ok")')
    // No settings were kept by a section: the configuration is the one the app ships.
    expect(JSON.parse(text(`${SCRIPTED_FOLDER}/avanzamento/config.json`)).requests).toEqual([])
    // Started again it changes nothing: what the PM corrected is not written over.
    disk.set(`${SCRIPTED_FOLDER}/avanzamento/script.py`, encode('print("corretto")'))
    await scripted.install(project, 'avanzamento')
    expect(text(`${SCRIPTED_FOLDER}/avanzamento/script.py`)).toBe('print("corretto")')
    for (const slug of ['sconosciuto', '../fuori']) {
      await expect(scripted.install(project, slug)).rejects.toMatchObject({
        code: 'scripted_not_found',
      })
    }
  })

  it('takes over what the two sections kept as the configuration of their deliverables', async () => {
    const progress = { order: 'ORD-1', positions: [{ code: '00001', amount: 100 }] }
    const alignment = {
      sprint: 'Sprint 28',
      tags: ['Squadra'],
      exportPath: 'dati/tracker.json',
      ticketFolder: '',
      ownPeopleOnly: true,
    }
    const { scripted, text } = setup({
      kept: { 'progress.json': progress, 'alignment.json': alignment },
    })
    await scripted.install(project, 'avanzamento')
    await scripted.install(project, 'allineamento')
    // A setting the section never wrote keeps the value the script expects.
    expect(JSON.parse(text(`${SCRIPTED_FOLDER}/avanzamento/config.json`))).toEqual({
      ...progress,
      requests: [],
    })
    // Where the trackers are read from goes to what Octo prepares; the rest to the script.
    expect(JSON.parse(text(`${SCRIPTED_FOLDER}/allineamento/config.json`))).toEqual({
      sprint: 'Sprint 28',
      period: '',
      tags: ['Squadra'],
    })
    expect(JSON.parse(text(`${SCRIPTED_FOLDER}/allineamento/deliverable.json`)).inputs).toEqual({
      voci: { kind: 'tracker', path: 'dati/tracker.json', ownPeopleOnly: true },
      ticket: { kind: 'records', folder: '' },
    })
    // Settings that are not an object are no settings.
    const odd = setup({ kept: { 'progress.json': ['x'] } })
    await odd.scripted.install(project, 'avanzamento')
    expect(JSON.parse(odd.text(`${SCRIPTED_FOLDER}/avanzamento/config.json`)).order).toBe('')
  })

  it('runs the script in a work folder, fills the form itself, and keeps the files when told', async () => {
    const { scripted, work, ran, filled, disk, text } = setup({ result: FILL })
    await scripted.install(project, 'avanzamento')
    disk.set(`${SCRIPTED_FOLDER}/avanzamento/config.json`, encode('{"order":"ORD-1"}'))
    const run = await scripted.run(project, 'avanzamento', { richiesta: ' 2 ', altro: 'x' })
    expect(ran).toEqual([{ workFolder: '/lavoro/p-1/run-1' }])
    // The deliverable as the project has it, and what was asked for this run.
    expect(decode(work.left.get('script.py'))).toBe('print("ok")')
    expect(decode(work.left.get('config.json'))).toBe('{"order":"ORD-1"}')
    expect(JSON.parse(decode(work.left.get('parametri.json')))).toEqual({ richiesta: '2' })
    // The form is filled by Octo from the cells the script named, into the work folder.
    expect(filled).toEqual([{ model: 'MODELLO', writes: [{ ref: 'B2', cell }] }])
    work.left.set('uscita/quote.csv', encode('n;quota'))
    expect(run).toEqual({
      runId: 'run-1',
      ok: true,
      messages: ['Richiesta 2'],
      files: ['Richiesta - 2.xlsx'],
    })
    expect(disk.has('_octo/deliverable/avanzamento/Richiesta - 2.xlsx')).toBe(false)

    const kept = await scripted.keep(project, 'avanzamento', 'run-1')
    expect(kept).toEqual({
      folder: '_octo/deliverable/avanzamento',
      files: [
        '_octo/deliverable/avanzamento/Richiesta - 2.xlsx',
        '_octo/deliverable/avanzamento/quote.csv',
      ],
    })
    expect(text('_octo/deliverable/avanzamento/Richiesta - 2.xlsx')).toBe('COMPILATO')
    await expect(scripted.keep(project, '../x', 'run-1')).rejects.toMatchObject({
      code: 'scripted_not_found',
    })
  })

  it('hands the script the items and the tickets Octo reads, own people only when asked', async () => {
    const result = { ok: true, messages: [], files: [] }
    const { scripted, work, disk } = setup({ result })
    await scripted.install(project, 'allineamento')
    await scripted.run(project, 'allineamento', {})
    expect(JSON.parse(decode(work.left.get('ingressi/voci.json')))).toMatchObject({
      exportedAt: '2026-11-17T08:00:00Z',
      items: [{ id: '1' }, { id: '2' }],
    })
    expect(JSON.parse(decode(work.left.get('ingressi/ticket.json')))).toEqual(tickets)
    const own = JSON.parse(decode(disk.get(`${SCRIPTED_FOLDER}/allineamento/deliverable.json`)))
    own.inputs.voci.ownPeopleOnly = true
    disk.set(`${SCRIPTED_FOLDER}/allineamento/deliverable.json`, encode(JSON.stringify(own)))
    await scripted.run(project, 'allineamento', {})
    const items = JSON.parse(decode(work.left.get('ingressi/voci.json'))).items
    expect(items.map((item: { id: string }) => item.id)).toEqual(['1'])
    // With nothing to read an input from the run does not start.
    for (const missing of [
      { exportPath: '' },
      { exportPath: 'assente.json' },
      { jiraFolder: null },
    ]) {
      const bare = setup({ result, ...missing })
      await bare.scripted.install(project, 'allineamento')
      await expect(bare.scripted.run(project, 'allineamento', {})).rejects.toMatchObject({
        code: 'scripted_input_missing',
      })
      expect(bare.ran).toEqual([])
    }
  })

  it('uses nothing of a result that is not one, and says when the form is not there', async () => {
    for (const result of [
      undefined,
      'testo',
      { ok: true, messages: [], files: ['../fuori.csv'] },
      { ok: true, messages: [], files: [], fill: { ...FILL.fill, output: 'altrove/x.xlsx' } },
      {
        ok: true,
        messages: [],
        files: [],
        fill: { ...FILL.fill, writes: [{ ref: 'B2', cell: { kind: 'formula' } }] },
      },
    ]) {
      const { scripted, filled } = setup({ result })
      await scripted.install(project, 'avanzamento')
      await expect(scripted.run(project, 'avanzamento', {})).rejects.toMatchObject({
        code: 'scripted_result_invalid',
      })
      expect(filled).toEqual([])
    }
    const gone = setup({
      result: { ...FILL, fill: { ...FILL.fill, model: 'Moduli/Assente.xlsx' } },
    })
    await gone.scripted.install(project, 'avanzamento')
    await expect(gone.scripted.run(project, 'avanzamento', {})).rejects.toMatchObject({
      code: 'scripted_model_missing',
    })
    // A script that says it failed gives its words and no file, and nothing is filled.
    const failed = setup({ result: { ...FILL, ok: false, messages: ['Supera il totale.'] } })
    await failed.scripted.install(project, 'avanzamento')
    expect(await failed.scripted.run(project, 'avanzamento', {})).toMatchObject({
      ok: false,
      messages: ['Supera il totale.'],
      files: [],
    })
    expect(failed.filled).toEqual([])
    await expect(setup().scripted.run(project, 'avanzamento', {})).rejects.toBeInstanceOf(
      DomainError,
    )
    await expect(failed.scripted.keep(project, 'avanzamento', 'run-9')).rejects.toMatchObject({
      code: 'work_not_found',
    })
  })

  it('corrects in words in the work folder, and writes in the project only what the PM approves', async () => {
    const { scripted, ran, text, disk } = setup()
    await scripted.install(project, 'avanzamento')
    disk.set(`${SCRIPTED_FOLDER}/avanzamento/config.json`, encode('{"sprint":"Sprint 28"}'))
    await expect(scripted.correct(project, 'avanzamento', '   ')).rejects.toMatchObject({
      code: 'request_empty',
    })
    const correction = await scripted.correct(project, 'avanzamento', ' Passa allo sprint 29 ')
    expect(ran).toEqual([{ workFolder: '/lavoro/p-1/run-1', words: 'Passa allo sprint 29' }])
    expect(correction).toEqual({
      runId: 'run-1',
      ok: true,
      messages: ['fatto'],
      files: [],
      summary: 'Ho cambiato lo sprint.',
      changed: ['config.json'],
    })
    // Not in the project yet.
    expect(text(`${SCRIPTED_FOLDER}/avanzamento/config.json`)).toBe('{"sprint":"Sprint 28"}')
    await scripted.approve(project, 'avanzamento', 'run-1')
    expect(text(`${SCRIPTED_FOLDER}/avanzamento/config.json`)).toBe('{"sprint":"Sprint 29"}')
    expect(text(`${SCRIPTED_FOLDER}/avanzamento/script.py`)).toBe('print("ok")')
    await expect(scripted.approve(project, 'allineamento', 'run-1')).rejects.toMatchObject({
      code: 'scripted_not_found',
    })
    // A manifest that is not one is told, not run.
    disk.set(
      `${SCRIPTED_FOLDER}/avanzamento/deliverable.json`,
      encode('{"inputs":{"x":{"kind":"altro"}},"title":"T"}'),
    )
    await expect(scripted.run(project, 'avanzamento', {})).rejects.toMatchObject({
      code: 'scripted_invalid',
    })
    expect(
      (await scripted.list(project)).some(
        (entry) => entry.slug === 'avanzamento' && entry.installed,
      ),
    ).toBe(false)
  })
})
