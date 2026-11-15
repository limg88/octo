import {
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createMeetings, type Meetings } from '@octo/application'
import { MEETINGS_FOLDER, MEETINGS_READING_PATH, NO_SOURCES, type Project } from '@octo/domain'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  createFsMeetingExports,
  createFsMemoryWriter,
  createFsProjectFiles,
  createFsSourceSettings,
  createJsonSourceStates,
} from '../src/index.ts'
import { type FakeExport, publishDestination, writeExport } from './support/verbale-export.ts'

const NOW = new Date('2026-11-14T10:00:00.000Z')
const KICKOFF: FakeExport = {
  id: 'AB12CD34-0000-4000-8000-000000000001',
  title: 'Kickoff Aurora',
  started: '2026-11-10T09:00:00Z',
  duration: 2700,
  speakers: { '1': 'Anna', '2': 'Luca' },
  notes: 'Collaudo spostato al 4 dicembre.',
  passages: ['Il collaudo slitta al 4 dicembre.', 'Va bene, avviso il cliente.'],
}
const LIVE: FakeExport = {
  id: 'BB000000-0000-4000-8000-000000000002',
  title: 'Aurora in corso',
  started: '2026-11-14T09:30:00Z',
  duration: 600,
  state: 'recording',
}
const FUTURE: FakeExport = {
  id: 'CC000000-0000-4000-8000-000000000003',
  title: 'Aurora formato nuovo',
  started: '2026-11-11T09:00:00Z',
  duration: 600,
  schemaVersion: 2,
}
const BROKEN: FakeExport = {
  id: 'DD000000-0000-4000-8000-000000000004',
  title: 'Aurora rotta',
  started: '2026-11-12T09:00:00Z',
  duration: 600,
  manifest: '{"schemaVersion": 1, "id":',
}
const HALF: FakeExport = {
  id: 'EE000000-0000-4000-8000-000000000005',
  title: 'Aurora a meta',
  started: '2026-11-13T09:00:00Z',
  duration: 600,
  manifest: null,
}
const ORPHAN: FakeExport = {
  id: 'FF000000-0000-4000-8000-000000000006',
  title: 'Allineamento settimanale',
  started: '2026-11-13T14:00:00Z',
  duration: 1800,
}

let base: string
let home: string
let root: string
let aurora: Project
let borea: Project
let meetings: Meetings
const files = createFsProjectFiles()
const settings = createFsSourceSettings()
const exportsOf = () => createFsMeetingExports({ home, verbaleFolder: join(base, 'verbale') })

const imported = (project: Project, path: string): Promise<string> =>
  readFile(join(project.folder, MEETINGS_FOLDER, path), 'utf8')

beforeAll(async () => {
  base = await realpath(await mkdtemp(join(tmpdir(), 'octo-verbale-')))
  home = join(base, 'casa')
  root = join(home, 'Verbale')
  aurora = { id: 'p-aurora', name: 'Aurora', folder: join(base, 'Aurora'), addedAt: '' }
  borea = { id: 'p-borea', name: 'Borea', folder: join(base, 'Borea'), addedAt: '' }
  for (const folder of [root, aurora.folder, borea.folder, join(base, 'verbale', 'Sessions')]) {
    await mkdir(folder, { recursive: true })
  }
  // Something of the PM's in the same folder: not an export, never mentioned.
  await mkdir(join(root, 'Vacanze'))
  await writeFile(join(root, 'appunti.txt'), 'non è una riunione')
  for (const meeting of [KICKOFF, LIVE, FUTURE, BROKEN, HALF, ORPHAN]) {
    await writeExport(root, meeting)
  }
  // The same folder, written in two ways: the two projects still read the same one.
  await settings.save(aurora.folder, { ...NO_SOURCES, meetings: { root: '~/Verbale' } })
  await settings.save(borea.folder, { ...NO_SOURCES, meetings: { root: `${root}/` } })
  meetings = createMeetings({
    settings,
    states: createJsonSourceStates(join(base, 'dati')),
    exports: exportsOf(),
    projects: async () => [aurora, borea],
    files,
    writer: createFsMemoryWriter(),
    clock: { now: () => NOW },
  })
})

afterAll(async () => {
  await rm(base, { recursive: true, force: true })
})

describe('the meetings Verbale exported, read from its folder', () => {
  it('brings the finished meeting of the project in: its texts and a description, nothing else', async () => {
    const run = await meetings.sync(aurora)

    expect(run).toEqual({ at: NOW.toISOString(), written: 1, unchanged: 0, error: null })
    const folder = '2026-11-10_kickoff-aurora_ab12cd34'
    expect((await readdir(join(aurora.folder, MEETINGS_FOLDER, folder))).sort()).toEqual([
      '_meta.md',
      'markers.json',
      'notes.md',
      'transcript.md',
    ])
    // The anchors of the transcript are kept: a citation points at a passage.
    expect(await imported(aurora, `${folder}/transcript.md`)).toContain('<a id="segment-2"></a>')
    const meta = await imported(aurora, `${folder}/_meta.md`)
    expect(meta).toContain('- Durata: 45 minuti')
    expect(meta).toContain('- Partecipanti: Anna, Luca')
    expect(meta).toContain('2026-11-10_090000_Kickoff_Aurora_AB12CD34')
    expect(await meetings.imported(aurora)).toMatchObject([
      { title: 'Kickoff Aurora', folder: `${MEETINGS_FOLDER}/${folder}`, minutes: 45 },
    ])
  })

  it('writes down what it left out and why, and what has no project', async () => {
    const note = await readFile(join(aurora.folder, MEETINGS_READING_PATH), 'utf8')

    expect(note).toContain('Aurora_in_corso_BB000000`: riunione non completa (recording)')
    expect(note).toContain(
      'Aurora_formato_nuovo_CC000000`: versione del formato non supportata (2)',
    )
    expect(note).toContain('Aurora_rotta_DD000000`: `meeting.json` non si legge')
    expect(note).toContain('Aurora_a_meta_EE000000`: esportazione non conclusa')
    expect(note).toContain('«Allineamento settimanale» del 2026-11-13')
    expect(note).not.toContain('Vacanze')
    // Named «Aurora» in their titles, and still not taken: they are not finished exports.
    expect(await meetings.imported(aurora)).toHaveLength(1)
  })

  it('finds everything unchanged at the next reading, and nothing for the other project', async () => {
    expect(await meetings.sync(aurora)).toMatchObject({ written: 0, unchanged: 1 })
    expect(await meetings.sync(borea)).toMatchObject({ written: 0, unchanged: 0, error: null })
    expect(await meetings.imported(borea)).toEqual([])
  })

  it('writes again a meeting exported again: corrections, a new title, a report', async () => {
    await writeExport(root, {
      ...KICKOFF,
      title: 'Kickoff Aurora',
      passages: ['Il collaudo slitta al 9 dicembre.'],
      report: '# Riepilogo\n\nCollaudo il 9 dicembre.',
      speakers: { '1': 'Anna', '2': 'Luca', '3': 'Marta' },
    })

    expect(await meetings.sync(aurora)).toMatchObject({ written: 1, unchanged: 0 })
    const folder = '2026-11-10_kickoff-aurora_ab12cd34'
    expect(await imported(aurora, `${folder}/transcript.md`)).toContain('9 dicembre')
    expect(await imported(aurora, `${folder}/report.md`)).toContain('Collaudo il 9 dicembre')
    expect(await imported(aurora, `${folder}/_meta.md`)).toContain('Anna, Luca, Marta')
    expect(await imported(aurora, `${folder}/_meta.md`)).toContain('`report.md`')
    expect(await readdir(join(aurora.folder, MEETINGS_FOLDER))).toEqual([folder, '_lettura.md'])
  })

  it('takes away a text the export no longer has', async () => {
    const folder = '2026-11-10_kickoff-aurora_ab12cd34'
    await rm(join(root, '2026-11-10_090000_Kickoff_Aurora_AB12CD34', 'report.md'))

    expect(await meetings.sync(aurora)).toMatchObject({ written: 1 })
    expect(await readdir(join(aurora.folder, MEETINGS_FOLDER, folder))).not.toContain('report.md')
  })

  it('keeps a meeting without a project waiting in both, until the PM gives it to one', async () => {
    const waiting = (await meetings.unassigned(borea)).map((meeting) => meeting.title)
    expect(waiting).toEqual(['Allineamento settimanale'])
    expect(await meetings.unassigned(aurora)).toHaveLength(1)

    await meetings.assign(borea, ORPHAN.id.toLowerCase())

    expect(await meetings.unassigned(aurora)).toEqual([])
    expect(await meetings.unassigned(borea)).toEqual([])
    const folder = '2026-11-13_allineamento-settimanale_ff000000'
    expect(await imported(borea, `${folder}/transcript.md`)).toContain('Buongiorno')
    // From now on it is of that project: its reading keeps it up to date, the other leaves it.
    expect(await meetings.sync(borea)).toMatchObject({ written: 0, unchanged: 1 })
    expect(await meetings.sync(aurora)).toMatchObject({ written: 0, unchanged: 1 })
    await expect(meetings.assign(aurora, ORPHAN.id.toLowerCase())).rejects.toThrow(
      'meeting_not_found',
    )
  })

  it('gives a meeting to the project whose mail holds its invitation', async () => {
    const invited: FakeExport = {
      id: '11000000-0000-4000-8000-000000000007',
      title: 'Punto della settimana',
      started: '2026-11-14T08:00:00Z',
      duration: 1800,
    }
    await writeExport(root, invited)
    const mailOf = (keyword: string) => ({
      since: '2026-11-01',
      keywords: [keyword],
      folders: [],
      excludeSenders: [],
      keepQuoted: false,
      targetFolder: '_octo/posta',
    })
    const linked = { ...NO_SOURCES, meetings: { root: '~/Verbale' } }
    await settings.save(borea.folder, { ...linked, mail: mailOf('Borea') })
    await settings.save(aurora.folder, { ...linked, mail: mailOf('Aurora') })
    const mail = (id: string, method: string, start: string, end: string) =>
      [
        '---',
        'tipo: "email"',
        `id: "${id}"`,
        'data: "2026-11-12T10:00:00.000Z"',
        'oggetto: "Invito"',
        `invito: "${method}"`,
        'riunione: "Punto"',
        `riunione-id: "uid-${id}"`,
        `riunione-inizio: "${start}"`,
        `riunione-fine: "${end}"`,
        'riunione-luogo: ""',
        '---',
        '',
      ].join('\n')
    const posta = join(borea.folder, '_octo', 'posta', '2026-11')
    await mkdir(posta, { recursive: true })
    await writeFile(
      join(posta, 'invito.md'),
      mail('a', 'REQUEST', '2026-11-14T08:00:00.000Z', '2026-11-14T08:30:00.000Z'),
    )
    // A meeting called off in the other project claims nothing.
    const annullata = join(aurora.folder, '_octo', 'posta', '2026-11')
    await mkdir(annullata, { recursive: true })
    await writeFile(
      join(annullata, 'annullata.md'),
      mail('b', 'CANCEL', '2026-11-14T08:00:00.000Z', '2026-11-14T08:30:00.000Z'),
    )

    expect(await meetings.sync(aurora)).toMatchObject({ written: 0, unchanged: 1 })
    expect(await meetings.sync(borea)).toMatchObject({ written: 1, unchanged: 1 })
    expect((await meetings.imported(borea)).map((meeting) => meeting.title)).toEqual([
      'Punto della settimana',
      'Allineamento settimanale',
    ])
  })

  it('says that the folder cannot be opened, and keeps what it had', async () => {
    await settings.save(aurora.folder, { ...NO_SOURCES, meetings: { root: '~/Sparita' } })

    expect(await meetings.sync(aurora)).toMatchObject({ error: 'meetings_root_unreadable' })
    expect((await meetings.view(aurora)).state.lastRun?.error).toBe('meetings_root_unreadable')
    expect(await meetings.unassigned(aurora)).toEqual([])
    expect(await meetings.imported(aurora)).toHaveLength(1)
  })
})

describe('the folder of Verbale as this computer tells it', () => {
  it('reads a manifest again only when its file changed', async () => {
    const exports = exportsOf()
    const first = await exports.list(root)
    const again = await exports.list('~/Verbale')
    expect(again).toEqual(first)
    expect(again.find((reading) => reading.status === 'complete')).toBe(
      first.find((reading) => reading.status === 'complete'),
    )
  })

  it('reads only plain files of an export: no link, no path leading elsewhere', async () => {
    const exports = exportsOf()
    const folder = '2026-11-10_090000_Kickoff_Aurora_AB12CD34'
    await writeFile(join(base, 'segreto.md'), 'fuori dalla cartella')
    await symlink(join(base, 'segreto.md'), join(root, folder, 'report.md'))

    expect(await exports.read(root, folder, 'report.md')).toBeNull()
    expect(await exports.read(root, folder, 'manca.md')).toBeNull()
    expect(await exports.read(root, folder, 'notes.md')).toContain('4 dicembre')
    await expect(exports.read(root, '..', 'segreto.md')).rejects.toThrow('source_config_invalid')
    await expect(exports.read(root, folder, 'audio/x.wav')).rejects.toThrow('source_config_invalid')
    await expect(exports.list(join(root, folder, 'notes.md'))).rejects.toThrow(
      'meetings_root_unreadable',
    )
  })

  it('proposes the folder Verbale last exported to, when its sessions name one that exists', async () => {
    const sessions = join(base, 'verbale', 'Sessions')
    const session = async (name: string, content: string) => {
      await mkdir(join(sessions, name), { recursive: true })
      await writeFile(join(sessions, name, 'meeting.json'), content)
    }
    expect(await exportsOf().defaultRoot()).toBeNull()

    await session('vecchia', JSON.stringify({ destination: join(base, 'non-esiste') }))
    await session('rotta', '{')
    await session('vuota', JSON.stringify({ destination: '' }))
    await mkdir(join(sessions, 'senza-manifest'))
    expect(await exportsOf().defaultRoot()).toBeNull()

    await session('buona', JSON.stringify({ destination: root }))
    expect(await exportsOf().defaultRoot()).toBe('~/Verbale')
    await session('fuori', JSON.stringify({ destination: base }))
    expect(await exportsOf().defaultRoot()).toBe(base)
    expect(await createFsMeetingExports({ home: join(base, 'nessuno') }).defaultRoot()).toBeNull()
  })
})

describe('the export of a Verbale that says more', () => {
  let newer: string
  let exports: ReturnType<typeof exportsOf>
  const WEEKLY: FakeExport = {
    id: '22000000-0000-4000-8000-000000000008',
    title: 'Punto',
    started: '2026-11-09T09:00:00Z',
    duration: 900,
    revision: 1,
    speakers: { '1': 'Anna' },
  }
  const folderOf = '2026-11-09_090000_Punto_22000000'

  beforeAll(async () => {
    newer = join(home, 'Nuovo')
    await mkdir(newer, { recursive: true })
    exports = exportsOf()
  })

  it('reads the summary in place of the manifest, which only has to be there', async () => {
    // A manifest no reader of the known fields could use: what is read is the summary.
    await writeExport(newer, { ...WEEKLY, manifest: '{"schemaVersion": 1, "segments": []}' })

    expect(await exports.list(newer)).toMatchObject([
      {
        folder: folderOf,
        status: 'complete',
        meeting: { title: 'Punto', exportRevision: 1, participants: ['Anna'] },
      },
    ])
  })

  it('goes back to the manifest when the summary cannot be used', async () => {
    const listed = { ...WEEKLY, participants: [{ name: 'Anna', email: 'anna@cliente.example' }] }
    await writeExport(newer, { ...listed, revision: 2, summary: '{"schemaVersion": 1,' })

    const [reading] = await exports.list(newer)
    expect(reading).toMatchObject({
      status: 'complete',
      meeting: { exportRevision: 2, participants: ['Anna <anna@cliente.example>'] },
    })
  })

  it('takes a summary without its manifest for an export that is not finished', async () => {
    await writeExport(newer, { ...WEEKLY, revision: 3, manifest: null })

    expect(await exports.list(newer)).toMatchObject([{ status: 'skipped', reason: 'no_manifest' }])
    expect(await exports.reading(newer, folderOf)).toMatchObject({ reason: 'no_manifest' })
  })

  it('tells, reading a folder again, that the meeting was exported again meanwhile', async () => {
    await writeExport(newer, { ...WEEKLY, revision: 4 })
    const [before] = await exports.list(newer)
    await writeExport(newer, { ...WEEKLY, revision: 5 })

    const after = await exports.reading('~/Nuovo', folderOf)
    expect(before).toMatchObject({ meeting: { exportRevision: 4 } })
    expect(after).toMatchObject({ meeting: { exportRevision: 5 } })
    expect(await exports.reading(newer, 'Vacanze')).toBeNull()
    await expect(exports.reading(newer, '../Verbale')).rejects.toThrow('source_config_invalid')
  })

  it('proposes the folder Verbale says it exports to, before looking at its sessions', async () => {
    const verbale = join(base, 'verbale')
    // The sessions name another folder: what Verbale says now comes first.
    await publishDestination(verbale, newer)
    expect(await exportsOf().defaultRoot()).toBe('~/Nuovo')

    await publishDestination(verbale, join(base, 'non-esiste'))
    expect(await exportsOf().defaultRoot()).toBe(base)
    await writeFile(
      join(verbale, 'export.json'),
      JSON.stringify({ schemaVersion: 2, destination: newer }),
    )
    expect(await exportsOf().defaultRoot()).toBe(base)
    await writeFile(join(verbale, 'export.json'), JSON.stringify({ schemaVersion: 1 }))
    expect(await exportsOf().defaultRoot()).toBe(base)
    await rm(join(verbale, 'export.json'))
  })
})

describe('the meetings among the sources kept in the project folder', () => {
  it('are saved with the other sources and read back; a root that is not a folder is refused', async () => {
    const view = await meetings.save(borea, { root: ` ${root}/ ` })
    expect(view.config).toEqual({ root: '~/Verbale' })
    expect(view.suggestedRoot).toBeNull()
    expect((await settings.load(borea.folder)).meetings).toEqual({ root: '~/Verbale' })
    expect((await meetings.save(borea, { root: join(base, 'altrove') })).config).toEqual({
      root: join(base, 'altrove'),
    })
    expect(exportsOf().portable(home)).toBe('~')
    await expect(meetings.save(borea, { root: 'Verbale' })).rejects.toThrow('source_config_invalid')

    expect((await meetings.save(borea, null)).config).toBeNull()
    expect(await meetings.configured(borea)).toBe(false)
    expect((await meetings.view(borea)).suggestedRoot).toBe(base)
  })
})
