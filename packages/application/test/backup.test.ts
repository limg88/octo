import type { Backup, Project } from '@octo/domain'
import { backupFileName } from '@octo/domain'
import { describe, expect, it } from 'vitest'
import { type BackupFiles, createBackups } from '../src/index.ts'
import {
  folderProbe,
  memoryFeedIndexes,
  memoryRegistry,
  memorySourceStates,
  steppingClock,
} from './fakes.ts'

const aurora: Project = {
  id: 'p-aurora',
  name: 'Aurora',
  folder: '/vecchio/Aurora',
  addedAt: '2026-11-01T00:00:00.000Z',
}
const boreale: Project = { ...aurora, id: 'p-boreale', name: 'Boreale', folder: '/vecchio/Boreale' }
const MAIL_STATE = { cursor: '2026-11-10T00:00:00.000Z', lastRun: null }
const JIRA_ITEMS = { 'AUR-1': { version: '3', path: '_octo/fonti/Jira/AUR-1.md' } }

function memoryBackupFiles(): BackupFiles & { written: Map<string, Backup> } {
  const written = new Map<string, Backup>()
  return {
    written,
    read: async (file) => written.get(file) as Backup,
    write: async (file, backup) => {
      written.set(file, backup)
    },
  }
}

function computer(projects: Project[], readable: string[], files = memoryBackupFiles()) {
  const registry = memoryRegistry(projects)
  const sourceStates = memorySourceStates()
  const indexes = memoryFeedIndexes()
  const backups = createBackups({
    registry,
    sourceStates,
    indexes,
    folders: folderProbe(readable),
    files,
    clock: steppingClock('2026-11-15T08:00:00.000Z'),
  })
  return { backups, registry, sourceStates, indexes, files }
}

async function oldComputer() {
  const old = computer([aurora, boreale], [aurora.folder, boreale.folder])
  await old.sourceStates.set(aurora.id, 'mail', MAIL_STATE)
  await old.indexes.save(aurora.folder, 'jira', 'AUR', JIRA_ITEMS)
  expect(await old.backups.save('/chiavetta/copia.json')).toBe(2)
  return old
}

describe('backup and restore', () => {
  it('names the file by the day it is made', () => {
    expect(backupFileName(new Date('2026-11-15T08:00:00.000Z'))).toBe('octo-copia-2026-11-15.json')
  })

  it('saves the projects with their readings and no credentials', async () => {
    const old = await oldComputer()

    expect(old.files.written.get('/chiavetta/copia.json')).toEqual({
      format: 'octo-backup',
      version: 1,
      createdAt: '2026-11-15T08:00:00.000Z',
      projects: [
        {
          project: aurora,
          sources: { mail: MAIL_STATE },
          feeds: { jira: { scope: 'AUR', items: JIRA_ITEMS } },
        },
        { project: boreale, sources: {}, feeds: {} },
      ],
    })
  })

  it('restores on a new computer, asking where a moved folder is', async () => {
    const old = await oldComputer()
    const fresh = computer([], [aurora.folder, 'D:\\Progetti\\Boreale'], old.files)

    const opened = await fresh.backups.open('/chiavetta/copia.json')
    expect(opened.toLocate).toEqual([boreale])

    const outcome = await fresh.backups.restore(opened.backup, {
      [boreale.id]: 'D:\\Progetti\\Boreale',
    })

    expect(outcome).toEqual({ restored: ['Aurora', 'Boreale'], alreadyHere: [], skipped: [] })
    expect(await fresh.registry.list()).toEqual([
      aurora,
      { ...boreale, folder: 'D:\\Progetti\\Boreale' },
    ])
    // The readings go on from where they were: nothing is read again from the start.
    expect(await fresh.sourceStates.get(aurora.id, 'mail')).toEqual(MAIL_STATE)
    expect(await fresh.indexes.load(aurora.folder, 'jira')).toEqual({
      scope: 'AUR',
      items: JIRA_ITEMS,
    })
  })

  it('leaves out a project whose folder is not there, and says so', async () => {
    const old = await oldComputer()
    const fresh = computer([], [aurora.folder], old.files)

    const { backup } = await fresh.backups.open('/chiavetta/copia.json')
    const outcome = await fresh.backups.restore(backup, {})

    expect(outcome).toEqual({ restored: ['Aurora'], alreadyHere: [], skipped: ['Boreale'] })
    expect(await fresh.registry.list()).toEqual([aurora])
  })

  it('never touches a project this computer already has', async () => {
    const old = await oldComputer()
    const mine: Project = { ...aurora, id: 'p-mine' }
    const here = computer([mine, boreale], [aurora.folder, boreale.folder], old.files)
    const newer = { cursor: '2026-11-14T00:00:00.000Z', lastRun: null }
    await here.sourceStates.set(mine.id, 'mail', newer)

    const opened = await here.backups.open('/chiavetta/copia.json')
    expect(opened.toLocate).toEqual([])
    const outcome = await here.backups.restore(opened.backup, {})

    // Aurora is here by its folder, Boreale by its id.
    expect(outcome).toEqual({ restored: [], alreadyHere: ['Aurora', 'Boreale'], skipped: [] })
    expect(await here.registry.list()).toEqual([mine, boreale])
    expect(await here.sourceStates.get(mine.id, 'mail')).toEqual(newer)
    expect(await here.sourceStates.get(aurora.id, 'mail')).toEqual({ cursor: null, lastRun: null })
  })
})
