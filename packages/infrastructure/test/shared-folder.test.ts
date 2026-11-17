import { mkdir, mkdtemp, readdir, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  type JiraFeedConfig,
  NEVER_SHARED,
  NO_SOURCES,
  type Project,
  type Reader,
  type SharedReading,
  STATE_FOLDER,
} from '@octo/domain'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { removeFile, whileHeld, writeAtomic } from '../src/fs/json-file.ts'
import {
  createFsFeedIndexes,
  createFsMeetingExports,
  createFsMemoryWriter,
  createFsProjectFiles,
  createFsSharedReadings,
  createFsSourceSettings,
  createJsonPersonalSources,
  createLegacyFeedIndexes,
  createPersonalFiles,
  createSplitSourceSettings,
} from '../src/index.ts'

let root: string
let count = 0

beforeAll(async () => {
  root = await realpath(await mkdtemp(join(tmpdir(), 'octo-condivisa-')))
})

afterAll(async () => {
  await rm(root, { recursive: true, force: true })
})

async function newFolder(name = 'progetto'): Promise<string> {
  count += 1
  const folder = join(root, `${name}-${count}`)
  await mkdir(folder, { recursive: true })
  return folder
}

const held = (code: string): Error => Object.assign(new Error(code), { code })
const noWait = { wait: async () => {} }

describe('writing while another program holds the file', () => {
  it('tries again until who holds it lets go', async () => {
    const waits: number[] = []
    let attempts = 0
    const result = await whileHeld(
      async () => {
        attempts += 1
        if (attempts < 4) throw held(attempts === 1 ? 'EPERM' : 'EBUSY')
        return 'scritto'
      },
      { wait: async (ms) => void waits.push(ms) },
    )
    expect(result).toBe('scritto')
    expect(waits).toEqual([40, 80, 160])
  })

  it('gives up after a few tries, and at once for any other failure', async () => {
    let attempts = 0
    const always = async (): Promise<never> => {
      attempts += 1
      throw held('EACCES')
    }
    await expect(whileHeld(always, noWait)).rejects.toMatchObject({ code: 'EACCES' })
    expect(attempts).toBe(6)

    attempts = 0
    const missing = async (): Promise<never> => {
      attempts += 1
      throw held('ENOENT')
    }
    await expect(whileHeld(missing, noWait)).rejects.toMatchObject({ code: 'ENOENT' })
    expect(attempts).toBe(1)
    await expect(whileHeld(() => Promise.reject('non è un errore'), noWait)).rejects.toBe(
      'non è un errore',
    )
  })

  it('leaves nothing beside a file it could not write', async () => {
    const folder = await newFolder()
    // A folder where the file should be: the rename is refused.
    await mkdir(join(folder, 'stato.json'))
    await expect(writeAtomic(join(folder, 'stato.json'), '{}', undefined, noWait)).rejects.toThrow()
    expect(await readdir(folder)).toEqual(['stato.json'])

    await writeAtomic(join(folder, 'nuova', 'nota.md'), 'testo')
    expect(await readFile(join(folder, 'nuova', 'nota.md'), 'utf8')).toBe('testo')
    await removeFile(join(folder, 'nuova', 'nota.md'))
    await removeFile(join(folder, 'nuova', 'nota.md'))
    expect(await readdir(join(folder, 'nuova'))).toEqual([])
  })

  it('takes a file another computer already removed as removed', async () => {
    const folder = await newFolder()
    const files = createFsProjectFiles()
    await writeFile(join(folder, 'a.md'), 'x')
    await files.remove(folder, 'a.md')
    await files.remove(folder, 'a.md')
    expect(await readdir(folder)).toEqual([])
  })

  it('takes away the folder its last file leaves empty, and no other', async () => {
    const folder = await newFolder()
    const files = createFsProjectFiles()
    await mkdir(join(folder, 'riunioni', 'daily'), { recursive: true })
    await writeFile(join(folder, 'riunioni', 'daily', 'notes.md'), 'x')
    await writeFile(join(folder, 'riunioni', 'daily', 'transcript.md'), 'y')
    await writeFile(join(folder, 'riunioni', '_lettura.md'), 'z')
    await files.remove(folder, 'riunioni/daily/notes.md')
    // Another file is still there: the folder stays.
    expect(await readdir(join(folder, 'riunioni', 'daily'))).toEqual(['transcript.md'])
    await files.remove(folder, 'riunioni/daily/transcript.md')
    // The folder of the meeting goes with its last file; the one above holds something else.
    expect(await readdir(join(folder, 'riunioni'))).toEqual(['_lettura.md'])
    await files.remove(folder, 'riunioni/_lettura.md')
    expect(await readdir(folder)).toEqual([])
  })
})

describe('what the folder of a project knows of its readings', () => {
  const giovanni: Reader = { name: 'Giovanni', computer: 'mac-di-giovanni' }
  const reading: SharedReading = {
    cursor: '{"at":3}',
    lastRun: {
      at: '2026-11-17T09:00:00.000Z',
      written: 2,
      unchanged: 7,
      error: null,
      by: giovanni,
    },
    lease: { by: giovanni, until: '2026-11-17T09:10:00.000Z' },
  }

  it('is kept in the folder, one file a source, for every computer that opens it', async () => {
    const folder = await newFolder()
    expect(await createFsSharedReadings().get(folder, 'ado')).toEqual(NEVER_SHARED)

    await createFsSharedReadings().set(folder, 'ado', reading)

    expect(await createFsSharedReadings().get(folder, 'ado')).toEqual(reading)
    expect(await createFsSharedReadings().get(folder, 'jira')).toEqual(NEVER_SHARED)
    expect(await readdir(join(folder, STATE_FOLDER))).toEqual(['ado.json'])
  })

  it('reads a file it cannot understand as a source never read', async () => {
    const folder = await newFolder()
    await mkdir(join(folder, STATE_FOLDER), { recursive: true })
    await writeFile(join(folder, STATE_FOLDER, 'ado.json'), '{"cursor": ')
    await writeFile(join(folder, STATE_FOLDER, 'jira.json'), '{"lastRun": "ieri"}')
    await writeFile(join(folder, STATE_FOLDER, 'ado.indice.json'), 'non è JSON')
    expect(await createFsSharedReadings().get(folder, 'ado')).toEqual(NEVER_SHARED)
    expect(await createFsSharedReadings().get(folder, 'jira')).toEqual(NEVER_SHARED)
    expect(await createFsFeedIndexes().load(folder, 'ado')).toEqual({ scope: null, items: {} })
    // A file written before a field existed is read with what it has.
    await writeFile(join(folder, STATE_FOLDER, 'dwsi.json'), '{"cursor": "x"}')
    expect(await createFsSharedReadings().get(folder, 'dwsi')).toEqual({
      ...NEVER_SHARED,
      cursor: 'x',
    })
  })

  it('keeps what each feed wrote beside it, and out of what the agent searches', async () => {
    const folder = await newFolder()
    const items = { 'AUR-1': { version: '2', path: '_octo/fonti/Jira/aur-1.md' } }
    expect(await createFsFeedIndexes().load(folder, 'jira')).toEqual({ scope: null, items: {} })
    await createFsFeedIndexes().save(folder, 'jira', 'perimetro', items)
    expect(await createFsFeedIndexes().load(folder, 'jira')).toEqual({ scope: 'perimetro', items })

    await createFsMemoryWriter().claim(folder)
    expect(await readFile(join(folder, STATE_FOLDER, '.ignore'), 'utf8')).toBe('*\n')
  })

  it('finds what an earlier Octo kept on the computer, and takes it away once handed over', async () => {
    const data = await newFolder('dati')
    const legacy = createLegacyFeedIndexes(data)
    expect(await legacy.load('p-1', 'ado')).toEqual({ scope: null, items: {} })
    await mkdir(join(data, 'feeds', 'p-1'), { recursive: true })
    await writeFile(join(data, 'feeds', 'p-1', 'ado.json'), '{"scope":"vecchio","items":{}}')
    await writeFile(join(data, 'feeds', 'p-1', 'jira.json'), 'rotto')
    expect(await legacy.load('p-1', 'ado')).toEqual({ scope: 'vecchio', items: {} })
    expect(await legacy.load('p-1', 'jira')).toEqual({ scope: null, items: {} })
    await legacy.remove('p-1', 'ado')
    await legacy.remove('p-1', 'ado')
    expect(await legacy.load('p-1', 'ado')).toEqual({ scope: null, items: {} })
  })
})

describe('the sources of a project two people read, each with their own account', () => {
  const jira: JiraFeedConfig = {
    since: '2026-03-01',
    targetFolder: '_octo/fonti/Jira',
    site: 'contoso',
    email: 'giovanni@example.test',
    projects: ['DEEM'],
  }

  it('keeps in the folder what is of the project and with the app what is of each person', async () => {
    const folder = await newFolder()
    const project = (id: string): Project => ({ id, name: 'DEEM', folder, addedAt: '' })
    const settingsOf = (data: string, id: string) =>
      createSplitSourceSettings(
        createFsSourceSettings(),
        createJsonPersonalSources(data, async (asked) => (asked === folder ? project(id) : null)),
      )
    const his = settingsOf(await newFolder('dati-mac'), 'p-mac')
    const hers = settingsOf(await newFolder('dati-pc'), 'p-pc')

    await his.save(folder, {
      ...NO_SOURCES,
      jira,
      meetings: { root: '~/Documents/Verbale', since: null },
    })
    // She finds the source linked, with the account of who linked it until she enters her own.
    expect((await hers.load(folder)).jira).toEqual(jira)

    await hers.save(folder, {
      ...(await hers.load(folder)),
      jira: { ...jira, email: 'giovanna@example.test', projects: ['DEEM', 'OPS'] },
      meetings: { root: 'C:/Verbale', since: null },
    })

    // Hers is hers, his is still his; the wider perimeter is of the project, so of both.
    expect(await hers.load(folder)).toMatchObject({
      jira: { email: 'giovanna@example.test', projects: ['DEEM', 'OPS'] },
      meetings: { root: 'C:/Verbale' },
    })
    expect(await his.load(folder)).toMatchObject({
      jira: { email: 'giovanni@example.test', projects: ['DEEM', 'OPS'] },
      meetings: { root: '~/Documents/Verbale' },
    })
    const inFolder = await readFile(join(folder, '_octo', '.impostazioni', 'sources.json'), 'utf8')
    expect(inFolder).not.toContain('giovanna@example.test')
    expect(inFolder).not.toContain('C:/Verbale')
    expect(await his.suggestFeedFolder(folder, 'jira')).toBe('_octo/fonti/Jira')
  })

  it('reads the folder as it is for a folder that is of no project here', async () => {
    const folder = await newFolder()
    const data = await newFolder('dati')
    const personal = createJsonPersonalSources(data, async () => null)
    const settings = createSplitSourceSettings(createFsSourceSettings(), personal)
    await settings.save(folder, { ...NO_SOURCES, jira })
    expect((await settings.load(folder)).jira).toEqual(jira)
    expect(await readdir(data)).toEqual([])

    // A file of what is personal that cannot be understood changes nothing of the project.
    const known = createJsonPersonalSources(data, async () => ({
      id: 'p-1',
      name: 'DEEM',
      folder,
      addedAt: '',
    }))
    await mkdir(join(data, 'personal-sources'), { recursive: true })
    await writeFile(join(data, 'personal-sources', 'p-1.json'), '{"feeds": 3}')
    expect(await known.load(folder)).toEqual({})
  })
})

describe('what one person keeps of a project, with the app', () => {
  it('is kept by the project, and by the folder for a folder that is of none', async () => {
    const data = await newFolder('dati')
    const folder = await newFolder()
    const here: Project = { id: 'p/1', name: 'DEEM', folder, addedAt: '2026-11-14T08:00:00Z' }
    const listed = createPersonalFiles(data, 'area', async () => here)
    const unlisted = createPersonalFiles(data, 'area', async () => null)

    expect(await listed.folderOf(folder)).toBe(join(data, 'area', 'p%2F1'))
    expect(await listed.fileOf(folder, 'a.json', '_octo/a.json')).toBe(
      join(data, 'area', 'p%2F1', 'a.json'),
    )
    const elsewhere = await unlisted.folderOf(folder)
    expect(elsewhere).toMatch(/area[\\/]folder-[0-9a-f]{16}$/)
    expect(await unlisted.folderOf(`${folder}-altro`)).not.toBe(elsewhere)
    // Nothing of the folder is touched for a folder that is of no project here.
    await mkdir(join(folder, '_octo'))
    await writeFile(join(folder, '_octo', 'a.json'), '{}')
    await unlisted.fileOf(folder, 'a.json', '_octo/a.json')
    expect(await readdir(join(folder, '_octo'))).toEqual(['a.json'])
  })
})

describe('the folder of Verbale on a computer that may not have it', () => {
  it('tells whether this computer can open it', async () => {
    const home = await newFolder('casa')
    await mkdir(join(home, 'Verbale'))
    await writeFile(join(home, 'nota.txt'), 'x')
    const exports = createFsMeetingExports({ home })
    expect(await exports.readable('~/Verbale')).toBe(true)
    expect(await exports.readable(join(home, 'Verbale'))).toBe(true)
    expect(await exports.readable('~/Documents/Verbale')).toBe(false)
    expect(await exports.readable('~/nota.txt')).toBe(false)
  })
})
