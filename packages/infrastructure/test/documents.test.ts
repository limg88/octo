import { mkdir, mkdtemp, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createDocuments } from '@octo/application'
import { extractedTextPath, type Project } from '@octo/domain'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  createFsMemoryWriter,
  createFsProjectFiles,
  createWorkerTextExtractor,
} from '../src/index.ts'
import { docx, xlsx } from './support/files.ts'
import { fsReadings, PAOLA_AT_HER_MAC } from './support/readings.ts'

const WORKER = new URL('../src/extract/worker.ts', import.meta.url)
const NOW = new Date('2026-11-14T10:00:00.000Z')
const SHEET_ROWS =
  '<row r="1"><c r="A1" t="inlineStr"><is><t>Giornate</t></is></c><c r="B1"><v>120</v></c></row>'

let root: string
let folder: string
let project: Project
const files = createFsProjectFiles()

beforeAll(async () => {
  root = await realpath(await mkdtemp(join(tmpdir(), 'octo-docs-')))
  folder = join(root, 'progetto')
  project = { id: 'p-1', name: 'Aurora', folder, addedAt: '' }
  await mkdir(join(folder, 'raw', 'SOW'), { recursive: true })
  await mkdir(join(folder, '.git'))
  await mkdir(join(folder, 'node_modules'))
  await mkdir(join(root, 'fuori'))
  await writeFile(join(folder, 'raw', 'SOW', 'Offerta.docx'), docx(['Il canone è di 12.000 euro.']))
  await writeFile(join(folder, 'raw', 'SOW', '~$Offerta.docx'), 'aperto in Word')
  await writeFile(join(folder, 'raw', 'Scenari.XLSX'), xlsx([{ name: 'PI7', rows: SHEET_ROWS }]))
  await writeFile(join(folder, 'raw', 'note.md'), '# Note')
  await writeFile(join(folder, '.git', 'vecchio.docx'), 'x')
  await writeFile(join(folder, 'node_modules', 'altro.docx'), 'x')
  await writeFile(join(root, 'fuori', 'segreto.docx'), 'x')
  await symlink(join(root, 'fuori'), join(folder, 'link'))
})

afterAll(async () => {
  await rm(root, { recursive: true, force: true })
})

function documents(timeoutMs?: number) {
  return createDocuments({
    files,
    extractor: createWorkerTextExtractor(WORKER, timeoutMs),
    writer: createFsMemoryWriter(),
    readings: fsReadings(join(root, 'dati'), { now: () => NOW }),
  })
}

describe('files of a project to convert', () => {
  it('lists Office files by extension, outside hidden folders, links and lock files', async () => {
    const stamps = await files.withExtensions(folder, ['docx', 'xlsx'])
    expect(stamps.map((stamp) => stamp.path)).toEqual(['raw/Scenari.XLSX', 'raw/SOW/Offerta.docx'])
    expect(stamps[0]?.size).toBeGreaterThan(0)
  })

  it('reads and removes inside the project only', async () => {
    const refused = { code: 'source_config_invalid' }
    await expect(files.read(folder, '../fuori/segreto.docx')).rejects.toMatchObject(refused)
    await expect(files.read(folder, 'link/segreto.docx')).rejects.toMatchObject(refused)
    await expect(files.remove(folder, 'link/segreto.docx')).rejects.toMatchObject(refused)
    expect(await files.readText(folder, 'raw/note.md')).toBe('# Note')
    expect(await files.readText(folder, 'raw/assente.md')).toBeNull()
    expect(await files.under(folder, 'assente')).toEqual([])
  })
})

describe('converting the documents of a project', () => {
  it('writes the text of each file once, and again only when the file changes', async () => {
    const first = await documents().convert(project)
    expect(first).toEqual({
      at: NOW.toISOString(),
      written: 2,
      unchanged: 0,
      error: null,
      by: PAOLA_AT_HER_MAC,
    })

    const word = await files.readText(folder, extractedTextPath('raw/SOW/Offerta.docx'))
    expect(word).toContain('origine: "raw/SOW/Offerta.docx"')
    expect(word).toContain('Il canone è di 12.000 euro.')
    const sheet = await files.readText(folder, extractedTextPath('raw/Scenari.XLSX'))
    expect(sheet).toContain('## Foglio PI7\n\nGiornate | 120')

    expect(await documents().convert(project)).toMatchObject({ written: 0, unchanged: 2 })

    await writeFile(
      join(folder, 'raw', 'SOW', 'Offerta.docx'),
      docx(['Il canone è di 15.000 euro.']),
    )
    expect(await documents().convert(project)).toMatchObject({ written: 1, unchanged: 1 })
    expect(await files.readText(folder, extractedTextPath('raw/SOW/Offerta.docx'))).toContain(
      '15.000',
    )
    expect((await documents().state(project)).state.lastRun?.written).toBe(1)
  })

  it('removes the text of a file that is gone', async () => {
    await rm(join(folder, 'raw', 'Scenari.XLSX'))
    await documents().convert(project)
    expect(await files.under(folder, '_octo/testo')).toEqual([
      '_octo/testo/raw/SOW/Offerta.docx.md',
    ])
  })

  it('says so in the text when a file cannot be read or takes too long', async () => {
    await writeFile(join(folder, 'raw', 'rotto.docx'), 'non è un file di Word')
    await documents().convert(project)
    expect(await files.readText(folder, extractedTextPath('raw/rotto.docx'))).toContain(
      'avvisi: "unsupported_format"',
    )

    await writeFile(join(folder, 'raw', 'lento.docx'), docx(['x']))
    await documents(1).convert(project)
    expect(await files.readText(folder, extractedTextPath('raw/lento.docx'))).toContain(
      'avvisi: "timeout"',
    )
  })

  it('refuses a second conversion of the same project while one is running', async () => {
    const service = documents()
    const first = service.convert(project)
    await expect(service.convert(project)).rejects.toMatchObject({ code: 'source_busy' })
    await first
  })
})
