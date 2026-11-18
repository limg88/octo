import { link, mkdir, mkdtemp, readFile, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  canFence,
  createClaudeCliRunner,
  createFsWorkFolders,
  createJsonQuestionLog,
  fenceGrant,
  fencePrompt,
  fenceSettings,
} from '../src/index.ts'

const FAKE_CLAUDE = fileURLToPath(new URL('./fake-claude.mjs', import.meta.url))
// The sandbox is of macOS and Linux: on Windows a fenced run is refused before it starts.
const fenced = process.platform === 'win32' ? it.skip : it
let root: string
let project: string
let data: string
let interpreter: string

beforeAll(async () => {
  root = await realpath(await mkdtemp(join(tmpdir(), 'octo-fence-')))
  project = join(root, 'progetto')
  data = join(root, 'dati')
  await mkdir(join(project, 'wiki'), { recursive: true })
  await writeFile(join(project, 'wiki', 'stato.md'), 'riga uno\nriga due\n')
  // Any file stands for the interpreter: the fake never starts it.
  await mkdir(join(root, 'python', 'bin'), { recursive: true })
  interpreter = join(root, 'python', 'bin', 'python3')
  await writeFile(interpreter, '')
})

afterAll(async () => {
  await rm(root, { recursive: true, force: true })
})

const runner = (overrides: { interpreter?: string | null } = {}) =>
  createClaudeCliRunner({
    command: process.execPath,
    prefixArgs: [FAKE_CLAUDE],
    env: { ...process.env },
    interpreter: overrides.interpreter === undefined ? interpreter : overrides.interpreter,
  })
const request = (question: string, workFolder: string) => ({
  projectFolder: project,
  question,
  history: [],
  liveSources: [],
  workFolder,
})

describe('the fence of a run with calculations', () => {
  const fence = { workFolder: '/stato/lavoro/p-1/q-1', interpreter: '/app/python/bin/python3' }

  it('closes the project to writing, the home to reading and the network, and never runs without', () => {
    expect(fenceSettings('/progetti/Aurora', fence)).toEqual({
      sandbox: {
        enabled: true,
        failIfUnavailable: true,
        allowUnsandboxedCommands: false,
        filesystem: {
          denyWrite: ['/progetti/Aurora'],
          allowWrite: ['/stato/lavoro/p-1/q-1'],
          denyRead: ['~/'],
          allowRead: ['/progetti/Aurora', '/stato/lavoro/p-1/q-1', '/app/python'],
        },
        network: { allowedDomains: [] },
      },
    })
  })

  it('grants the file tools on the work folder only, and the interpreter as the only command', () => {
    const grant = fenceGrant('/progetti/Aurora', fence)
    expect(grant.tools).toEqual(['Read', 'Grep', 'Glob', 'Write', 'Edit', 'Bash'])
    // Two slashes: an absolute place, not one of the project.
    expect(grant.allowed).toEqual([
      'Read',
      'Grep',
      'Glob',
      'Edit(//stato/lavoro/p-1/q-1/**)',
      'Bash(/app/python/bin/python3 *)',
    ])
    expect(grant.more.slice(0, 2)).toEqual(['--add-dir', '/stato/lavoro/p-1/q-1'])
    expect(JSON.parse(grant.more[3] ?? '')).toEqual(fenceSettings('/progetti/Aurora', fence))
    expect(grant.more.slice(4)).toEqual(['--permission-prompts', 'none'])
    // The same rule on a path written the way Windows writes it.
    expect(fenceGrant('C:\\p', { ...fence, workFolder: 'C:\\lavoro' }).allowed[3]).toBe(
      'Edit(/C:/lavoro/**)',
    )
  })

  it('tells the run the one way it may compute', () => {
    const told = fencePrompt(fence)
    expect(told).toContain('/app/python/bin/python3 /stato/lavoro/p-1/q-1/<script>.py')
    expect(told).toContain('The project cannot be written')
  })

  it('is possible only with an interpreter, on a system that has a sandbox', () => {
    expect(canFence('/app/python/bin/python3', 'darwin')).toBe(true)
    expect(canFence('/app/python/bin/python3', 'linux')).toBe(true)
    expect(canFence('/app/python/bin/python3', 'win32')).toBe(false)
    expect(canFence(null, 'darwin')).toBe(false)
  })
})

describe('a run with calculations', () => {
  fenced(
    'computes in the work folder with the fence up, and answers with a table and its source',
    async () => {
      const work = createFsWorkFolders(data)
      const folder = await work.create('p-1', 'q-1')
      const steps: string[] = []
      const draft = await runner().compute({
        ...request('Quante righe ha lo stato? #recinto', folder),
        onProgress: (step) => steps.push(step.kind),
      })
      expect(draft.tables).toEqual([
        {
          title: 'Righe del file di stato',
          columns: ['file', 'righe'],
          rows: [['wiki/stato.md', '3']],
          sources: ['wiki/stato.md'],
          file: 'righe.csv',
        },
      ])
      // The sandbox is on, cannot be left, and nobody is asked for a permission.
      expect(draft.missing).toEqual(['fence:true', 'prompts:none'])
      expect(steps).toContain('computing')
      expect(await work.files('p-1', 'q-1')).toEqual(['dettaglio/calcolo.py', 'righe.csv'])
      expect(new TextDecoder().decode(await work.read('p-1', 'q-1', 'righe.csv'))).toBe(
        'righe\n3\n',
      )
      expect((await runner().status()).available).toBe(true)
    },
  )

  fenced('refuses to go on when the sandbox does not start', async () => {
    const folder = await createFsWorkFolders(data).create('p-1', 'q-2')
    await expect(runner().compute(request('#sandbox', folder))).rejects.toMatchObject({
      code: 'fence_unavailable',
    })
  })

  it('refuses without an interpreter, and with one that is not where it should be', async () => {
    const folder = await createFsWorkFolders(data).create('p-1', 'q-3')
    await expect(
      runner({ interpreter: null }).compute(request('Quante righe?', folder)),
    ).rejects.toMatchObject({ code: 'fence_interpreter_missing' })
    if (process.platform === 'win32') return
    await expect(
      runner({ interpreter: join(root, 'assente', 'bin', 'python3') }).compute(
        request('Quante righe?', folder),
      ),
    ).rejects.toMatchObject({ code: 'fence_interpreter_missing' })
  })

  it('says whether it can compute on this computer', async () => {
    const status = await runner().status()
    expect(status).toMatchObject({ available: true, computes: process.platform !== 'win32' })
    expect(await runner({ interpreter: null }).status()).toMatchObject({ computes: false })
  })
})

describe('the work folders of the app', () => {
  it('are one per run, emptied when made again, outside every project', async () => {
    const work = createFsWorkFolders(data)
    const folder = await work.create('p-9', 'q-1')
    expect(folder).toBe(join(data, 'lavoro', 'p-9', 'q-1'))
    await writeFile(join(folder, 'vecchio.csv'), 'x')
    expect(await work.files('p-9', 'q-1')).toEqual(['vecchio.csv'])
    await work.create('p-9', 'q-1')
    expect(await work.files('p-9', 'q-1')).toEqual([])
    expect(await work.files('p-9', 'mai-fatta')).toEqual([])
  })

  it('give back only the files a run left, never what a link or a name points to elsewhere', async () => {
    const work = createFsWorkFolders(data)
    const folder = await work.create('p-9', 'q-2')
    await writeFile(join(root, 'segreto.txt'), 'fuori')
    await writeFile(join(folder, 'dentro.txt'), 'dentro')
    await symlink(join(root, 'segreto.txt'), join(folder, 'link.txt')).catch(() => undefined)
    expect(await work.files('p-9', 'q-2')).toEqual(['dentro.txt'])
    expect(new TextDecoder().decode(await work.read('p-9', 'q-2', 'dentro.txt'))).toBe('dentro')
    // A folder that is a link, and a second name for a file outside: neither is a file of the run.
    await symlink(root, join(folder, 'via')).catch(() => undefined)
    await link(join(root, 'segreto.txt'), join(folder, 'doppio.txt')).catch(() => undefined)
    for (const name of [
      '../../../segreto.txt',
      'assente.txt',
      'link.txt',
      'via/segreto.txt',
      'doppio.txt',
    ]) {
      await expect(work.read('p-9', 'q-2', name)).rejects.toMatchObject({ code: 'work_not_found' })
    }
    // Octo writes in the folder of a run too, and never through what a run left as a link.
    await work.write('p-9', 'q-2', 'uscita/modulo.xlsx', new TextEncoder().encode('ok'))
    expect(await work.files('p-9', 'q-2')).toContain('uscita/modulo.xlsx')
    for (const name of ['via/scritto.txt', 'link.txt', '../fuori.txt']) {
      await expect(
        work.write('p-9', 'q-2', name, new TextEncoder().encode('no')),
      ).rejects.toMatchObject({ code: 'work_not_found' })
    }
    expect(await readFile(join(root, 'segreto.txt'), 'utf8')).toBe('fuori')
    await expect(work.create('../fuori', 'q-1')).rejects.toMatchObject({ code: 'work_not_found' })
    await expect(work.files('p-9', 'a/b')).rejects.toMatchObject({ code: 'work_not_found' })
  })
})

describe('the questions kept with the app', () => {
  it('keep a question again in the place of the one with its id, with its tables and its files', async () => {
    const folder = join(root, 'progetto')
    const log = createJsonQuestionLog(join(root, 'domande'), async () => ({
      id: 'p-1',
      name: 'Aurora',
      folder,
      addedAt: '',
    }))
    const record = {
      id: 'q-1',
      projectId: 'p-1',
      question: 'Quanto resta?',
      askedAt: '2026-11-18T09:00:00.000Z',
      durationMs: 10,
      answer: {
        text: 'Ecco.',
        citations: [],
        missing: [],
        markersWithoutCitation: [],
        tables: [
          {
            title: 'Totali',
            columns: ['voce'],
            rows: [['1']],
            sources: [{ path: 'a.csv', found: true }],
            file: 'totali.csv',
            fileWritten: true,
          },
        ],
      },
      error: null,
      work: { files: ['totali.csv'], keptIn: null },
    }
    await log.append(folder, record)
    await log.append(folder, { ...record, id: 'q-2' })
    const kept = {
      ...record,
      work: { files: ['totali.csv'], keptIn: '_octo/analisi/2026-11-18-q-1' },
    }
    await log.append(folder, kept)
    expect(await log.list(folder)).toEqual([kept, { ...record, id: 'q-2' }])
    expect(await readFile(join(folder, 'wiki', 'stato.md'), 'utf8')).toContain('riga uno')
  })
})
