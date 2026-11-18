// @vitest-environment node
// The scripts of the two deliverables shipped with Octo must give what the sections «Avanzamento»
// and «Allineamento» gave: the same shares, the same cells of the form, the same lists and the
// same file of missing tickets. The sections are gone: what they gave on synthetic data was
// written by their own code, before they left, in `fixtures/scripted-golden.json` (88 orders,
// 80 of them made up with a seed, and two comparisons of a sprint). Each script is run with the
// interpreter Octo ships, without Claude, and compared with it.
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

const resources = fileURLToPath(new URL('../resources/', import.meta.url))
const SYSTEMS: Partial<Record<NodeJS.Platform, string>> = { darwin: 'mac', linux: 'linux' }
const interpreter =
  process.env.OCTO_PYTHON_PATH ??
  join(resources, 'python', `${SYSTEMS[process.platform]}-${process.arch}`, 'bin', 'python3')
// Where the interpreter was not fetched (node apps/desktop/scripts/fetch-python.mjs) there is
// nothing to run the scripts with: as for the tests that need the test database.
const withInterpreter = existsSync(interpreter) ? describe : describe.skip

type Case = { name: string; config: Record<string, unknown>; parameters: Record<string, string> }
type ProgressCase = Case & {
  expected: { ok: false } | { ok: true; computation: unknown; writes: unknown }
}
type AlignmentCase = Case & { expected: { shape: unknown; csv: string; sprint: string } }
const golden: {
  progress: ProgressCase[]
  alignment: AlignmentCase[]
  inputs: Record<string, unknown>
} = JSON.parse(
  readFileSync(fileURLToPath(new URL('./fixtures/scripted-golden.json', import.meta.url)), 'utf8'),
)

let root: string
beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'octo-parity-'))
})
afterAll(async () => {
  await rm(root, { recursive: true, force: true })
})

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
  // From another folder, as when Claude runs it: the script finds its files by itself.
  execFileSync(interpreter, [join(folder, 'script.py')], {
    cwd: root,
    env: { PYTHONDONTWRITEBYTECODE: '1' },
  })
  const result = JSON.parse(await readFile(join(folder, 'esito.json'), 'utf8'))
  return { folder, result }
}

withInterpreter('the progress form as a deliverable of the project', () => {
  it('gives the shares and the cells the section gave, and stops where it stopped', async () => {
    let wentThrough = 0
    for (const entry of golden.progress) {
      const { result } = await run('avanzamento', entry.config, entry.parameters)
      expect(result.ok, entry.name).toBe(entry.expected.ok)
      if (!entry.expected.ok) {
        // What stopped it is said in words, and nothing is to be written in the form.
        expect(result.messages.length, entry.name).toBeGreaterThan(0)
        expect(result.fill, entry.name).toBeUndefined()
        continue
      }
      expect(result.computation, entry.name).toEqual(entry.expected.computation)
      expect(result.fill.writes, entry.name).toEqual(entry.expected.writes)
      expect(result.fill.model, entry.name).toBe(entry.config.modelPath)
      wentThrough += 1
    }
    // Enough of them went all the way for the comparison to mean something.
    expect(wentThrough).toBeGreaterThan(50)
    expect(golden.progress.length - wentThrough).toBeGreaterThan(10)
  }, 120_000)

  it('names the filled form after the request, and writes the shares of every request', async () => {
    const [first] = golden.progress
    if (first === undefined) throw new Error('no case')
    const { folder, result } = await run('avanzamento', first.config, { richiesta: '1' })
    expect(result.fill.output).toBe('uscita/Richiesta stato avanzamento - 1.xlsx')
    expect(result.files).toEqual(['uscita/quote.csv'])
    expect(await readFile(join(folder, 'uscita', 'quote.csv'), 'utf8')).toContain(
      '1;00001;0.0;1.0;1.0',
    )
  })

  it('says what it cannot do instead of filling a form', async () => {
    const [first] = golden.progress
    if (first === undefined) throw new Error('no case')
    expect((await run('avanzamento', first.config, { richiesta: '7' })).result.ok).toBe(false)
    const none = await run('avanzamento', { ...first.config, requests: [] }, {})
    expect(none.result).toMatchObject({ ok: false, files: [] })
    // Without a form the shares are still computed.
    const bare = await run('avanzamento', { ...first.config, modelPath: '' }, {})
    expect(bare.result).toMatchObject({ ok: true, files: ['uscita/quote.csv'] })
    expect(bare.result.fill).toBeUndefined()
  })
})

withInterpreter('the alignment of a sprint as a deliverable of the project', () => {
  type Pair = {
    item: { id: string }
    tickets: Array<{ key: string }>
    via: string
    coherent: unknown
  }
  type Found = {
    total: number
    adds: boolean
    linked: Pair[]
    needsUpdate: Pair[]
    missing: Array<{ id: string }>
    duplicates: Pair[]
    orphans: Array<{ ticket: { key: string }; ids: string[]; reason: string }>
    unreferenced: Array<{ key: string }>
  }
  const keys = (list: Array<{ key: string }>) => list.map((entry) => entry.key)
  /** The lists by what names their entries: enough to say two alignments are the same. */
  const shape = (found: Found) => ({
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
  const slug = (sprint: string) => sprint.toLowerCase().replace(/[^a-z0-9]+/g, '-')

  it('gives the lists and the file of missing tickets the section gave', async () => {
    for (const entry of golden.alignment) {
      const { folder, result } = await run(
        'allineamento',
        entry.config,
        entry.parameters,
        golden.inputs,
      )
      expect(result.ok, entry.name).toBe(true)
      expect(shape(result.alignment), entry.name).toEqual(entry.expected.shape)
      const file = `mancanti_${slug(entry.expected.sprint)}.csv`
      expect(result.files, entry.name).toEqual([`uscita/${file}`, 'uscita/allineamento.md'])
      expect(await readFile(join(folder, 'uscita', file), 'utf8'), entry.name).toBe(
        entry.expected.csv,
      )
      const report = await readFile(join(folder, 'uscita', 'allineamento.md'), 'utf8')
      expect(report, entry.name).toContain(`Senza ticket (${result.alignment.missing.length})`)
    }
    // Something in every list of the first comparison, or it would prove little.
    const first = golden.alignment[0]?.expected.shape as ReturnType<typeof shape>
    for (const list of [first.linked, first.needsUpdate, first.missing, first.orphans]) {
      expect(list.length).toBeGreaterThan(0)
    }
  })

  it('says what it misses instead of comparing nothing', async () => {
    const [first] = golden.alignment
    if (first === undefined) throw new Error('no case')
    const empty = { ...golden.inputs, ticket: [] }
    expect((await run('allineamento', first.config, {}, empty)).result).toMatchObject({ ok: false })
    const unnamed = await run('allineamento', { ...first.config, sprint: '' }, {}, golden.inputs)
    expect(unnamed.result).toMatchObject({ ok: false, files: [] })
  })
})
