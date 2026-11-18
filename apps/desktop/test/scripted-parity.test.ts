// @vitest-environment node
// The scripts of the two deliverables shipped with Octo must give what the sections «Avanzamento»
// and «Allineamento» gave: the same shares, the same cells of the form, the same lists and the
// same file of missing tickets. Each script is run with the interpreter Octo ships, without
// Claude, and compared with the functions of the domain on the same synthetic data.
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  type AlignItem,
  type AlignmentSettings,
  type AlignTicket,
  alignTrackers,
  cleanProgressSettings,
  computeProgress,
  DEFAULT_ALIGNMENT_SETTINGS,
  missingTicketsCsv,
  type ProgressSettings,
  progressFormCells,
} from '@octo/domain'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const resources = fileURLToPath(new URL('../resources/', import.meta.url))
const SYSTEMS: Partial<Record<NodeJS.Platform, string>> = { darwin: 'mac', linux: 'linux' }
const interpreter =
  process.env.OCTO_PYTHON_PATH ??
  join(resources, 'python', `${SYSTEMS[process.platform]}-${process.arch}`, 'bin', 'python3')
// Where the interpreter was not fetched (node apps/desktop/scripts/fetch-python.mjs) there is
// nothing to run the scripts with: as for the tests that need the test database.
const withInterpreter = existsSync(interpreter) ? describe : describe.skip

let root: string
beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'octo-parity-'))
})
afterAll(async () => {
  await rm(root, { recursive: true, force: true })
})

/** A generator with a seed: the same cases at every run, on every computer. */
function seeded(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}
const plain = <T>(value: T): T => JSON.parse(JSON.stringify(value))

let runs = 0
/** Runs a script of a deliverable in a folder of its own, as Octo lays it out, and reads its result. */
async function run(
  slug: string,
  config: unknown,
  parameters: Record<string, string>,
  inputs: Record<string, unknown> = {},
) {
  runs += 1
  const folder = join(root, `${slug}-${runs}`)
  await mkdir(join(folder, 'ingressi'), { recursive: true })
  await cp(join(resources, 'deliverable', slug, 'script.py'), join(folder, 'script.py'))
  await writeFile(join(folder, 'config.json'), JSON.stringify(config))
  await writeFile(join(folder, 'parametri.json'), JSON.stringify(parameters))
  for (const [name, value] of Object.entries(inputs)) {
    await writeFile(join(folder, 'ingressi', `${name}.json`), JSON.stringify(value))
  }
  execFileSync(interpreter, ['script.py'], { cwd: folder, env: { PYTHONDONTWRITEBYTECODE: '1' } })
  const result = JSON.parse(await readFile(join(folder, 'esito.json'), 'utf8'))
  return { folder, result }
}

withInterpreter('the progress form as a deliverable of the project', () => {
  const base: ProgressSettings = cleanProgressSettings({
    modelPath: 'Moduli/Richiesta stato avanzamento.xlsx',
    order: 'ORD-2026-077',
    salesOrders: [],
    total: 340000,
    positions: [
      { code: '00001', amount: 100000 },
      { code: '00002', amount: 60000 },
      { code: '00003', amount: 142000 },
      { code: '00004', amount: 38000 },
    ],
    requests: [
      {
        n: 1,
        from: '2026-03-01',
        to: '2026-03-31',
        amount: 289540,
        note: 'Fattura 101',
        positions: [],
      },
      { n: 2, from: '2026-03-31', to: '2026-04-30', amount: 50460, note: '', positions: [] },
    ],
    form: {
      fields: [
        { ref: 'B2', text: '{n}' },
        { ref: 'B3', text: 'Ordine {ordine}, posizioni {posizioni}' },
        { ref: 'B4', text: 'Dal {dal} al {al} (precedente al {al_precedente})' },
        { ref: 'B5', text: '{nota} {sconosciuto}' },
      ],
      table: { firstRow: 10, rows: 6, position: 'A', previous: 'B', current: 'C', period: 'D' },
    },
  })

  /** What the section wrote in the form for a request, as the domain computes it. */
  function expected(settings: ProgressSettings, n: number) {
    const computation = computeProgress(settings.positions, settings.requests)
    if (!computation.ok) return { computation, writes: null }
    const at = computation.steps.findIndex((step) => step.request.n === n)
    const step = computation.steps[at]
    if (step === undefined) return { computation, writes: null }
    const previousTo = computation.steps[at - 1]?.request.to ?? step.request.from
    const cells = progressFormCells(settings, step, previousTo)
    return { computation, writes: cells.ok ? cells.writes : null }
  }

  it('gives the shares and the cells the section gave, request by request', async () => {
    for (const n of [1, 2]) {
      const { result } = await run('avanzamento', base, { richiesta: String(n) })
      const { computation, writes } = expected(base, n)
      expect(result.ok).toBe(true)
      expect(result.computation).toEqual(plain(computation))
      expect(result.fill).toEqual({
        model: 'Moduli/Richiesta stato avanzamento.xlsx',
        output: `uscita/Richiesta stato avanzamento - ${n}.xlsx`,
        writes: plain(writes),
      })
    }
    // With no request named it is the last one.
    const last = await run('avanzamento', base, {})
    expect(last.result.fill.writes).toEqual(plain(expected(base, 2).writes))
    expect(await readFile(join(last.folder, 'uscita', 'quote.csv'), 'utf8')).toContain(
      '1;00001;0.0;1.0;1.0',
    )
  })

  it('stops where the section stopped, and says why', async () => {
    const over = { ...base, requests: [{ ...base.requests[0], amount: 340000.5, n: 1 }] }
    const unknown = { ...base, requests: [{ ...base.requests[0], positions: ['00009'], n: 1 }] }
    const tight = { ...base, requests: [{ ...base.requests[0], positions: ['00004'], n: 1 }] }
    const crowded = { ...base, form: { ...base.form, table: { ...base.form.table, rows: 2 } } }
    for (const settings of [over, unknown, tight, { ...base, positions: [] }]) {
      const { result } = await run('avanzamento', settings, {})
      expect(result.ok).toBe(false)
      expect(computeProgress(settings.positions, settings.requests as never).ok).toBe(false)
      expect(result.messages).toHaveLength(1)
      expect(result.fill).toBeUndefined()
    }
    expect((await run('avanzamento', crowded, {})).result.ok).toBe(false)
    expect((await run('avanzamento', base, { richiesta: '7' })).result.ok).toBe(false)
    expect((await run('avanzamento', { ...base, requests: [] }, {})).result.ok).toBe(false)
    // Without a form the shares are still computed.
    const bare = await run('avanzamento', { ...base, modelPath: '' }, {})
    expect(bare.result).toMatchObject({ ok: true, files: ['uscita/quote.csv'] })
    expect(bare.result.fill).toBeUndefined()
  })

  it('rounds as the section did on two hundred orders made up with a seed', async () => {
    const random = seeded(20261118)
    const amount = (most: number) => Math.round(random() * most * 100) / 100 + 0.01
    let compared = 0
    for (let scenario = 0; scenario < 200; scenario += 1) {
      const positions = Array.from({ length: 1 + Math.floor(random() * 6) }, (_, index) => ({
        code: String(index + 1).padStart(5, '0'),
        amount: amount(90000),
      }))
      const total = positions.reduce((sum, position) => sum + position.amount, 0)
      const count = 1 + Math.floor(random() * 5)
      const requests = Array.from({ length: count }, (_, index) => {
        const named = random() < 0.3
        const last = index === count - 1 && random() < 0.4
        return {
          n: index + 1,
          from: '2026-01-01',
          to: '2026-01-31',
          // The last one sometimes asks all that is left, to the cent; some ask too much.
          amount: last ? 0 : amount((total / count) * 1.15),
          note: `Fattura ${index + 1}`,
          positions: named ? [positions[Math.floor(random() * positions.length)]?.code ?? ''] : [],
        }
      })
      const asked = requests.slice(0, -1).reduce((sum, request) => sum + request.amount, 0)
      const closing = requests.at(-1)
      if (closing && closing.amount === 0) closing.amount = Math.max(0.01, total - asked)
      const settings = cleanProgressSettings({ ...base, total: null, positions, requests })
      const { result } = await run('avanzamento', settings, {})
      const { computation, writes } = expected(settings, settings.requests.length)
      expect(result.ok, `scenario ${scenario}`).toBe(computation.ok)
      if (!computation.ok) continue
      expect(result.computation, `scenario ${scenario}`).toEqual(plain(computation))
      expect(result.fill.writes, `scenario ${scenario}`).toEqual(plain(writes))
      compared += 1
    }
    // Enough of them went all the way for the comparison to mean something.
    expect(compared).toBeGreaterThan(60)
  }, 120_000)
})

withInterpreter('the alignment of a sprint as a deliverable of the project', () => {
  const settings: AlignmentSettings = {
    ...DEFAULT_ALIGNMENT_SETTINGS,
    sprint: 'Sprint 28',
    period: 'PI7',
    tags: ['Squadra'],
    stateGroups: [
      { name: 'In corso', item: ['In Progress'], ticket: ['In corso'] },
      { name: 'Chiuso', item: ['Closed'], ticket: ['Completata'] },
    ],
  }
  const item = (id: string, title: string, more: Partial<AlignItem> = {}): AlignItem => ({
    id,
    title,
    type: 'User Story',
    state: 'In Progress',
    sprint: 'Aurora\\Sprint 28',
    period: 'PI7',
    tags: ['Squadra'],
    assignee: 'Mario Rossi',
    description: '',
    ...more,
  })
  const ticket = (key: string, title: string, more: Partial<AlignTicket> = {}): AlignTicket => ({
    key,
    title,
    type: 'Story',
    status: 'In corso',
    sprint: 'sprint  28',
    sprints: ['Sprint 28'],
    assignee: null,
    ...more,
  })
  const items = [
    item('101', 'Esportazione degli ordini in Excel'),
    item('102', 'Filtro per data', { tags: ['Squadra', 'aur-7'] }),
    item('103', 'Stampa della conferma', { state: 'Closed' }),
    item('104', 'Notifica via mail, con "virgolette"'),
    item('105', 'Ricerca ordini', { type: 'Bug', assignee: null }),
    item('106', 'Importazione del listino', {
      description:
        '<p>Il listino arriva in Excel.</p><ul><li>Una riga &amp; un articolo</li></ul>\n\n\n\nFine',
    }),
    item('201', 'Di un altro sprint', { sprint: 'Aurora\\Sprint 27' }),
    item('202', 'Di un’altra squadra', { tags: ['Altri'] }),
    item('203', 'Di un altro periodo', { period: 'PI6' }),
  ]
  const tickets = [
    ticket('AUR-1', '[AZDO 101] Esportazione degli ordini'),
    ticket('AUR-2', '[azdo-101, 103] Due voci in un ticket'),
    ticket('AUR-7', 'Filtro per data', { sprint: 'Sprint 27' }),
    ticket('AUR-8', '[ADO: 104] Notifica', { sprint: null, status: 'Completata' }),
    ticket('AUR-9', 'Senza riferimento'),
    ticket('AUR-10', '[AZDO 999] Voce che non esiste'),
    ticket('AUR-11', '[AZDO 201] Voce di un altro sprint'),
    ticket('AUR-12', '[AZDO 106] In un altro sprint', { sprint: 'Sprint 30' }),
  ]
  /** The tickets as a feed of Octo keeps them, with something that is not a ticket among them. */
  const records = [
    ...tickets.map(({ key, title, ...record }) => ({ title, record: { key, ...record } })),
    { title: 'Una nota', record: { note: true } },
  ]
  const keys = (list: Array<{ key: string }>) => list.map((entry) => entry.key)
  /** The lists by what names their entries: enough to say two alignments are the same. */
  const shape = (found: ReturnType<typeof alignTrackers>) => ({
    total: found.total,
    adds: found.adds,
    linked: found.linked.map((pair) => [pair.item.id, keys(pair.tickets), pair.via, pair.coherent]),
    needsUpdate: found.needsUpdate.map((pair) => [
      pair.item.id,
      keys(pair.tickets),
      pair.via,
      pair.coherent,
    ]),
    missing: found.missing.map((entry) => entry.id),
    duplicates: found.duplicates.map((pair) => pair.item.id),
    orphans: found.orphans.map((orphan) => [orphan.ticket.key, orphan.ids, orphan.reason]),
    unreferenced: keys(found.unreferenced),
  })

  it('gives the lists and the file of missing tickets the section gave', async () => {
    const inputs = { voci: { exportedAt: '2026-11-17T08:00:00Z', items }, ticket: records }
    const { folder, result } = await run('allineamento', settings, {}, inputs)
    const found = alignTrackers(items, tickets, settings)
    expect(result.ok).toBe(true)
    expect(shape(result.alignment)).toEqual(plain(shape(found)))
    // Something in every list, or the comparison would prove little.
    expect(found.linked.length * found.needsUpdate.length * found.missing.length).toBeGreaterThan(0)
    expect(
      found.orphans.length * found.unreferenced.length * found.duplicates.length,
    ).toBeGreaterThan(0)
    expect(result.files).toEqual(['uscita/mancanti_sprint-28.csv', 'uscita/allineamento.md'])
    expect(await readFile(join(folder, 'uscita', 'mancanti_sprint-28.csv'), 'utf8')).toBe(
      missingTicketsCsv(found.missing, settings),
    )
    const report = await readFile(join(folder, 'uscita', 'allineamento.md'), 'utf8')
    expect(report).toContain(`Senza ticket (${found.missing.length})`)
  })

  it('follows the sprint asked for the run, with no tags, no period and no prefixes', async () => {
    const loose = { ...settings, period: '', tags: [], referencePrefixes: [], typeMap: [] }
    const inputs = { voci: { exportedAt: null, items }, ticket: records }
    const { folder, result } = await run('allineamento', loose, { sprint: 'Sprint 27' }, inputs)
    const asked = { ...loose, sprint: 'Sprint 27' }
    const found = alignTrackers(items, tickets, asked)
    expect(shape(result.alignment)).toEqual(plain(shape(found)))
    expect(await readFile(join(folder, 'uscita', 'mancanti_sprint-27.csv'), 'utf8')).toBe(
      missingTicketsCsv(found.missing, asked),
    )
  })

  it('says what it misses instead of comparing nothing', async () => {
    const inputs = { voci: { exportedAt: null, items }, ticket: [] }
    expect((await run('allineamento', settings, {}, inputs)).result).toMatchObject({ ok: false })
    const unnamed = await run('allineamento', { ...settings, sprint: '' }, {}, inputs)
    expect(unnamed.result).toMatchObject({ ok: false, files: [] })
  })
})
