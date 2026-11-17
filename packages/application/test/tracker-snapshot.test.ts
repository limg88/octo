import {
  type AdoFeedConfig,
  type DashboardSettings,
  DEFAULT_DASHBOARD_SETTINGS,
  type JiraFeedConfig,
  NO_SOURCES,
  type Project,
  TRACKER_HISTORY_PATH,
  TRACKER_PATHS,
  TRACKER_SNAPSHOT_PATH,
  TRACKER_SUMMARY_PATH,
} from '@octo/domain'
import { describe, expect, it } from 'vitest'
import {
  createTrackerSnapshots,
  type DashboardSettingsStore,
  type TrackerSnapshot,
  type TrackerSnapshotReader,
  type TrackerSource,
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
const jiraConfig: JiraFeedConfig = {
  site: 'contoso',
  email: 'pm@example.com',
  projects: ['AUR'],
  since: '2026-11-01',
  targetFolder: 'Fonti/Jira',
}
const SNAPSHOT: TrackerSnapshot = {
  exportedAt: '2026-11-15T07:00:00.000Z',
  items: [
    { id: 1, type: 'Bug' },
    { id: 2, type: 'User Story' },
  ],
  history: { '1': { created: '2026-10-01T08:00:00Z', states: [], tags: [] } },
}

function setup(
  ado: AdoFeedConfig | null = config,
  reader?: TrackerSnapshotReader,
  ownPeople?: string[],
  jira: JiraFeedConfig | null = null,
) {
  let saved: DashboardSettings = {
    ...DEFAULT_DASHBOARD_SETTINGS,
    ownPeopleOnly: ownPeople !== undefined,
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
  const asked: Array<{ source: TrackerSource; secret: string; types: readonly string[] }> = []
  const tracker: TrackerSnapshotReader = reader ?? {
    read: async (given, secret, types) => {
      asked.push({ source: given, secret, types })
      return SNAPSHOT
    },
  }
  const writer = memoryWriter()
  const secrets = memoryVault()
  const clock = { now: new Date('2026-11-15T07:10:00.000Z') }
  const snapshots = createTrackerSnapshots({
    exports: {
      readJson: async (_folder, path) => {
        const written = writer.files.get(path)
        return written === undefined ? null : JSON.parse(written)
      },
    },
    clock: { now: () => clock.now },
    settings,
    sources: memorySourceSettings({ ...NO_SOURCES, ado, jira }),
    secrets,
    tracker,
    writer,
    ...(ownPeople
      ? {
          team: async () => ({
            people: ownPeople.map((name) => ({
              name,
              role: '',
              side: 'supplier' as const,
              from: '',
              to: '',
              allocation: null,
              note: '',
            })),
            periods: [],
          }),
        }
      : {}),
  })
  return {
    snapshots,
    writer,
    secrets,
    asked,
    clock,
    settings: () => saved,
    pointAt: (exportPath: string) => {
      saved = { ...saved, exportPath }
    },
  }
}

describe('reading the tracker for the dashboard', () => {
  it('keeps the whole reading, and counts in its numbers only the supplier’s own people', async () => {
    const bug = (id: number, assigned_to: string) => ({
      id,
      type: 'Bug',
      title: `Bug ${id}`,
      state: 'Active',
      tags: 'Squadra',
      assigned_to,
      created_date: '2026-10-01T08:00:00Z',
    })
    const reader: TrackerSnapshotReader = {
      read: async () => ({
        ...SNAPSHOT,
        items: [bug(1, 'Rossi Mario'), bug(2, 'Bianchi Carla'), bug(3, 'Mario Rossi')],
      }),
    }
    const { snapshots, writer, secrets } = setup(config, reader, ['Mario Rossi'])
    secrets.all.set('p-1/ado', 'pat')
    expect((await snapshots.read(project)).items).toBe(3)
    // The file «Chiedi» reads holds every item; the numbers are of ours alone.
    expect(JSON.parse(writer.files.get(TRACKER_SNAPSHOT_PATH) ?? '').items).toHaveLength(3)
    const summary = writer.files.get(TRACKER_SUMMARY_PATH) ?? ''
    expect(summary).toContain('assegnati alle persone del fornitore')
    expect(summary).toContain('- Bug aperti (in lavorazione o in verifica): 2')
  })

  it('writes the tracker as the export the dashboard reads and points the dashboard at it', async () => {
    const { snapshots, writer, secrets, asked, settings } = setup()
    secrets.all.set('p-1/ado', 'pat')

    expect(await snapshots.read(project)).toEqual({
      tracker: 'ado',
      at: '2026-11-15T07:00:00.000Z',
      items: 2,
      withHistory: 1,
    })

    // The source of «Fonti» and its credential; bugs and stories are read with their history.
    expect(asked).toEqual([
      {
        source: { kind: 'ado', config },
        secret: 'pat',
        types: ['Bug', 'Defect', 'User Story', 'Story'],
      },
    ])
    expect(JSON.parse(writer.files.get(TRACKER_SNAPSHOT_PATH) ?? '')).toEqual({
      exported_at: SNAPSHOT.exportedAt,
      items: SNAPSHOT.items,
    })
    expect(JSON.parse(writer.files.get(TRACKER_HISTORY_PATH) ?? '')).toEqual({
      exported_at: SNAPSHOT.exportedAt,
      bugs: SNAPSHOT.history,
    })
    // The same reading in numbers, counted by the code for the perimeter of the dashboard.
    expect(writer.files.get(TRACKER_SUMMARY_PATH)).toContain(
      '- Dati del tracker al: 2026-11-15T07:00:00.000Z',
    )
    // What the PM had set stays: only the two files change.
    expect(settings()).toMatchObject({
      exportPath: TRACKER_SNAPSHOT_PATH,
      historyPath: TRACKER_HISTORY_PATH,
      tags: ['Squadra'],
    })
  })

  it('reads Jira for a project without Azure DevOps, in files of its own', async () => {
    const { snapshots, writer, secrets, asked, settings } = setup(
      null,
      undefined,
      undefined,
      jiraConfig,
    )
    secrets.all.set('p-1/jira', 'token')

    expect(await snapshots.read(project)).toMatchObject({ tracker: 'jira', items: 2 })

    expect(asked).toEqual([
      {
        source: { kind: 'jira', config: jiraConfig },
        secret: 'token',
        types: ['Bug', 'Defect', 'User Story', 'Story'],
      },
    ])
    expect(JSON.parse(writer.files.get(TRACKER_PATHS.jira.snapshot) ?? '').items).toHaveLength(2)
    expect(writer.files.has(TRACKER_PATHS.jira.history)).toBe(true)
    expect(writer.files.has(TRACKER_SNAPSHOT_PATH)).toBe(false)
    expect(settings()).toMatchObject({
      exportPath: TRACKER_PATHS.jira.snapshot,
      historyPath: TRACKER_PATHS.jira.history,
    })
  })

  it('reads Azure DevOps when the project has both trackers', async () => {
    const { snapshots, secrets, asked } = setup(config, undefined, undefined, jiraConfig)
    secrets.all.set('p-1/ado', 'pat')
    secrets.all.set('p-1/jira', 'token')
    expect(await snapshots.read(project)).toMatchObject({ tracker: 'ado' })
    expect(asked.map(({ source }) => source.kind)).toEqual(['ado'])
  })

  it('needs a tracker source and its credential, and changes nothing without them', async () => {
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

describe('reading the tracker again by itself', () => {
  it('reads when Octo’s own reading is old enough, and not before', async () => {
    const { snapshots, secrets, asked, clock } = setup()
    secrets.all.set('p-1/ado', 'pat')
    // The dashboard is still on an export kept by hand: nothing is read behind the PM's back.
    expect(await snapshots.refresh(project)).toBeNull()
    await snapshots.read(project)
    // Ten minutes after the reading.
    expect(await snapshots.refresh(project)).toBeNull()
    expect(asked).toHaveLength(1)
    clock.now = new Date('2026-11-15T09:00:00.000Z')
    expect(await snapshots.refresh(project)).toMatchObject({ items: 2 })
    expect(asked).toHaveLength(2)
    // A shorter age asked by who opens the page.
    expect(await snapshots.refresh(project, 60 * 1000)).toMatchObject({ items: 2 })
  })

  it('reads when the file does not say when it was written', async () => {
    const { snapshots, secrets, writer, pointAt } = setup()
    secrets.all.set('p-1/ado', 'pat')
    pointAt(TRACKER_SNAPSHOT_PATH)
    expect(await snapshots.refresh(project)).toMatchObject({ items: 2 })
    writer.files.set(TRACKER_SNAPSHOT_PATH, JSON.stringify({ items: [] }))
    expect(await snapshots.refresh(project)).toMatchObject({ items: 2 })
  })

  it('reads Jira again by itself, and leaves alone the reading of a tracker no longer linked', async () => {
    const onJira = setup(null, undefined, undefined, jiraConfig)
    onJira.secrets.all.set('p-1/jira', 'token')
    onJira.pointAt(TRACKER_PATHS.jira.snapshot)
    expect(await onJira.snapshots.refresh(project)).toMatchObject({ tracker: 'jira', items: 2 })
    // The dashboard still shows what was read from Azure DevOps, which the project no longer has.
    onJira.pointAt(TRACKER_SNAPSHOT_PATH)
    expect(await onJira.snapshots.refresh(project)).toBeNull()
  })

  it('does nothing without the source, without its credential, or while a reading runs', async () => {
    const unlinked = setup(null)
    unlinked.pointAt(TRACKER_SNAPSHOT_PATH)
    expect(await unlinked.snapshots.refresh(project)).toBeNull()
    const noSecret = setup()
    noSecret.pointAt(TRACKER_SNAPSHOT_PATH)
    expect(await noSecret.snapshots.refresh(project)).toBeNull()

    let release: () => void = () => {}
    const slow: TrackerSnapshotReader = {
      read: () =>
        new Promise((resolve) => {
          release = () => resolve(SNAPSHOT)
        }),
    }
    const busy = setup(config, slow)
    busy.secrets.all.set('p-1/ado', 'pat')
    busy.pointAt(TRACKER_SNAPSHOT_PATH)
    const first = busy.snapshots.refresh(project)
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(await busy.snapshots.refresh(project)).toBeNull()
    release()
    expect(await first).toMatchObject({ items: 2 })
  })
})
