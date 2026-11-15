import {
  type AdoFeedConfig,
  type DashboardSettings,
  DEFAULT_DASHBOARD_SETTINGS,
  NO_SOURCES,
  type Project,
  TRACKER_HISTORY_PATH,
  TRACKER_SNAPSHOT_PATH,
} from '@octo/domain'
import { describe, expect, it } from 'vitest'
import {
  createTrackerSnapshots,
  type DashboardSettingsStore,
  type TrackerSnapshot,
  type TrackerSnapshotReader,
} from '../src/index.ts'
import { memorySourceSettings, memoryVault, memoryWriter } from './fakes.ts'

const project: Project = { id: 'p-1', name: 'Aurora', folder: '/progetti/Aurora', addedAt: '' }
const config: AdoFeedConfig = {
  organization: 'contoso',
  project: 'Aurora',
  areas: ['Team A'],
  since: '2026-11-01',
  targetFolder: 'Fonti/ADO',
}
const SNAPSHOT: TrackerSnapshot = {
  exportedAt: '2026-11-15T07:00:00.000Z',
  items: [
    { id: 1, type: 'Bug' },
    { id: 2, type: 'User Story' },
  ],
  history: { '1': { created: '2026-10-01T08:00:00Z', states: [], tags: [] } },
}

function setup(ado: AdoFeedConfig | null = config, reader?: TrackerSnapshotReader) {
  let saved: DashboardSettings = {
    ...DEFAULT_DASHBOARD_SETTINGS,
    exportPath: 'raw/vecchio.json',
    tags: ['Squadra'],
    bugTypes: ['Bug', 'Defect'],
  }
  const settings: DashboardSettingsStore = {
    load: async () => saved,
    save: async (_folder, next) => {
      saved = next
    },
  }
  const asked: Array<{ config: AdoFeedConfig; secret: string; types: readonly string[] }> = []
  const tracker: TrackerSnapshotReader = reader ?? {
    read: async (given, secret, types) => {
      asked.push({ config: given, secret, types })
      return SNAPSHOT
    },
  }
  const writer = memoryWriter()
  const secrets = memoryVault()
  const snapshots = createTrackerSnapshots({
    settings,
    sources: memorySourceSettings({ ...NO_SOURCES, ado }),
    secrets,
    tracker,
    writer,
  })
  return { snapshots, writer, secrets, asked, settings: () => saved }
}

describe('reading the tracker for the dashboard', () => {
  it('writes the tracker as the export the dashboard reads and points the dashboard at it', async () => {
    const { snapshots, writer, secrets, asked, settings } = setup()
    secrets.all.set('p-1/ado', 'pat')

    expect(await snapshots.read(project)).toEqual({
      at: '2026-11-15T07:00:00.000Z',
      items: 2,
      withHistory: 1,
    })

    // The source of «Fonti» and its credential, and the bug types of the dashboard.
    expect(asked).toEqual([{ config, secret: 'pat', types: ['Bug', 'Defect'] }])
    expect(JSON.parse(writer.files.get(TRACKER_SNAPSHOT_PATH) ?? '')).toEqual({
      exported_at: SNAPSHOT.exportedAt,
      items: SNAPSHOT.items,
    })
    expect(JSON.parse(writer.files.get(TRACKER_HISTORY_PATH) ?? '')).toEqual({
      exported_at: SNAPSHOT.exportedAt,
      bugs: SNAPSHOT.history,
    })
    // What the PM had set stays: only the two files change.
    expect(settings()).toMatchObject({
      exportPath: TRACKER_SNAPSHOT_PATH,
      historyPath: TRACKER_HISTORY_PATH,
      tags: ['Squadra'],
    })
  })

  it('needs the Azure DevOps source and its credential, and changes nothing without them', async () => {
    const none = setup(null)
    await expect(none.snapshots.read(project)).rejects.toMatchObject({
      code: 'source_not_configured',
    })
    const noSecret = setup()
    await expect(noSecret.snapshots.read(project)).rejects.toMatchObject({ code: 'secret_missing' })
    expect(noSecret.writer.files.size).toBe(0)
    expect(noSecret.settings().exportPath).toBe('raw/vecchio.json')
  })

  it('keeps the file it had when the tracker fails, and runs one reading at a time', async () => {
    let release: (snapshot: TrackerSnapshot) => void = () => {}
    let fail = false
    const { snapshots, secrets, writer, settings } = setup(config, {
      read: () => {
        if (fail) return Promise.reject(new Error('unreachable'))
        return new Promise((resolve) => {
          release = resolve
        })
      },
    })
    secrets.all.set('p-1/ado', 'pat')

    const first = snapshots.read(project)
    await expect(snapshots.read(project)).rejects.toMatchObject({ code: 'source_busy' })
    await new Promise((resolve) => setTimeout(resolve, 0))
    release(SNAPSHOT)
    await first

    fail = true
    const before = writer.files.get(TRACKER_SNAPSHOT_PATH)
    await expect(snapshots.read(project)).rejects.toThrow('unreachable')
    expect(writer.files.get(TRACKER_SNAPSHOT_PATH)).toBe(before)
    expect(settings().exportPath).toBe(TRACKER_SNAPSHOT_PATH)
  })
})
