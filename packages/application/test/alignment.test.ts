import {
  type AlignmentSettings,
  DEFAULT_ALIGNMENT_SETTINGS,
  DEFAULT_DASHBOARD_SETTINGS,
  type JiraFeedConfig,
  NO_SOURCES,
  type Project,
  type ProjectTeam,
} from '@octo/domain'
import { describe, expect, it } from 'vitest'
import {
  ALIGNMENT_FOLDER,
  type AlignmentSettingsStore,
  createAlignments,
  type FeedRecord,
} from '../src/index.ts'
import { memorySourceSettings, memoryWriter } from './fakes.ts'

const project: Project = { id: 'p-1', name: 'Aurora', folder: '/progetti/Aurora', addedAt: '' }
const item = (id: number, title: string, sprint: string) => ({
  id,
  type: 'User Story',
  title,
  state: 'In Progress',
  tags: 'Squadra',
  sprint,
  created_date: '2026-10-01T08:00:00Z',
})
const EXPORT = {
  exported_at: '2026-11-13T08:00:00Z',
  items: [
    item(101, 'Esportazione ordini', 'Aurora\\Sprint 28'),
    item(102, 'Filtro per data', 'Aurora\\Sprint 28'),
    item(201, 'Altro sprint', 'Aurora\\Sprint 2'),
  ],
}
const RECORDS: FeedRecord[] = [
  {
    title: '[AZDO 101] Esportazione ordini',
    record: {
      key: 'AUR-1',
      type: 'Story',
      status: 'In corso',
      sprint: 'Sprint 28',
      sprints: ['Sprint 27', 9, 'Sprint 28'],
      assignee: 'Mario Rossi',
    },
  },
  { title: 'Senza chiave', record: { type: 'Story' } },
  { title: 'Senza altro', record: { key: 'AUR-2' } },
]
const jira: JiraFeedConfig = {
  since: '2026-01-01',
  targetFolder: '_octo/fonti/Jira',
  site: 'contoso',
  email: 'pm@example.test',
  projects: ['AUR'],
}

type Setup = {
  settings?: Partial<AlignmentSettings>
  exportPath?: string
  exported?: unknown
  records?: FeedRecord[]
  jira?: boolean
  team?: ProjectTeam
}

const person = (name: string, side: 'supplier' | 'client') => ({
  name,
  role: '',
  side,
  from: '',
  to: '',
  allocation: null,
  note: '',
})
/** The people of the project: one of the supplier, one of the client. */
const TEAM: ProjectTeam = {
  people: [person('Mario Rossi', 'supplier'), person('Carla Bianchi', 'client')],
  periods: [],
}

function setup(options: Setup = {}) {
  let saved: AlignmentSettings = {
    ...DEFAULT_ALIGNMENT_SETTINGS,
    sprint: 'Sprint 28',
    ...options.settings,
  }
  const settings: AlignmentSettingsStore = {
    load: async () => saved,
    save: async (_folder, next) => {
      saved = next
    },
  }
  const asked: string[] = []
  const read: string[] = []
  const writer = memoryWriter()
  const alignments = createAlignments({
    settings,
    dashboard: {
      load: async () => ({
        ...DEFAULT_DASHBOARD_SETTINGS,
        exportPath: options.exportPath ?? 'dati/tracker.json',
      }),
      save: async () => {},
    },
    exports: {
      readJson: async (_folder, path) => {
        read.push(path)
        return options.exported === undefined ? EXPORT : options.exported
      },
      candidates: async () => ({ exports: [], histories: [] }),
    },
    sources: memorySourceSettings(options.jira === false ? NO_SOURCES : { ...NO_SOURCES, jira }),
    records: {
      under: async (_folder, folder) => {
        asked.push(folder)
        return options.records ?? RECORDS
      },
    },
    writer,
    ...(options.team ? { team: async () => options.team as ProjectTeam } : {}),
  })
  return { alignments, asked, read, written: writer.files }
}

describe('the alignment of two trackers', () => {
  it('compares the export the dashboard reads with the tickets of the Jira feed', async () => {
    const { alignments, asked } = setup()
    const view = await alignments.view(project)
    expect(asked).toEqual(['_octo/fonti/Jira'])
    expect(view.exportedAt).toBe('2026-11-13T08:00:00Z')
    expect(view.tickets).toBe(2)
    expect(view.alignment.total).toBe(2)
    expect(view.alignment.linked[0]?.tickets[0]).toEqual({
      key: 'AUR-1',
      title: '[AZDO 101] Esportazione ordini',
      type: 'Story',
      status: 'In corso',
      sprint: 'Sprint 28',
      sprints: ['Sprint 27', 'Sprint 28'],
      assignee: 'Mario Rossi',
    })
    expect(view.alignment.missing.map((entry) => entry.id)).toEqual(['102'])
  })

  it('compares only the items of the supplier’s own people, when the PM asks so', async () => {
    const exported = {
      ...EXPORT,
      items: [
        { ...item(101, 'Esportazione ordini', 'Aurora\\Sprint 28'), assigned_to: 'Rossi Mario' },
        { ...item(102, 'Filtro per data', 'Aurora\\Sprint 28'), assigned_to: 'Bianchi Carla' },
      ],
    }
    const own = setup({ settings: { ownPeopleOnly: true }, exported, team: TEAM })
    const view = await own.alignments.view(project)
    expect(view.alignment.total).toBe(1)
    expect(view.alignment.missing).toEqual([])

    const all = setup({ exported, team: TEAM })
    expect((await all.alignments.view(project)).alignment.total).toBe(2)
  })

  it('offers the sprints, periods and tags of the export before anything is compared', async () => {
    // No sprint chosen yet, no ticket read: the choices come from the export alone.
    const { alignments, asked } = setup({ settings: { sprint: '' }, records: [] })
    expect(await alignments.choices(project)).toEqual({
      sprints: ['Sprint 2', 'Sprint 28'],
      periods: [],
      tags: ['Squadra'],
    })
    expect(asked).toEqual([])
    const nothing = { sprints: [], periods: [], tags: [] }
    for (const options of [{ exportPath: '' }, { exported: null }, { exported: { altro: 1 } }]) {
      expect(await setup(options).alignments.choices(project)).toEqual(nothing)
    }
  })

  it('reads the export and the tickets from where the PM says, when they say', async () => {
    const own = { ticketFolder: 'ticket/esportati', exportPath: 'dati/sprint.json' }
    const { alignments, asked, read } = setup({ settings: own, jira: false, exportPath: '' })
    await alignments.view(project)
    expect(asked).toEqual(['ticket/esportati'])
    expect(read).toEqual(['dati/sprint.json'])
    const usual = setup()
    await usual.alignments.view(project)
    expect(usual.read).toEqual(['dati/tracker.json'])
  })

  it('writes the missing items as an import file named after the sprint', async () => {
    const { alignments, written } = setup()
    const file = await alignments.exportMissing(project)
    expect(file).toEqual({ path: `${ALIGNMENT_FOLDER}/mancanti_sprint-28.csv`, rows: 1 })
    expect(written.get(file.path)).toContain('[AZDO 102] Filtro per data,Story,,,,Sprint 28')
  })

  it('saves tidy settings and refuses a folder outside the project', async () => {
    const { alignments } = setup()
    const clean = await alignments.saveSettings(project, {
      ...DEFAULT_ALIGNMENT_SETTINGS,
      sprint: ' Sprint 29 ',
      ticketFolder: './ticket//jira/',
    })
    expect(clean).toMatchObject({ sprint: 'Sprint 29', ticketFolder: 'ticket/jira' })
    expect(await alignments.settings(project)).toEqual(clean)
    for (const ticketFolder of ['/etc', 'C:\\ticket', '../fuori']) {
      await expect(
        alignments.saveSettings(project, { ...DEFAULT_ALIGNMENT_SETTINGS, ticketFolder }),
      ).rejects.toThrow('alignment_settings_invalid')
    }
    await expect(
      alignments.saveSettings(project, { ...DEFAULT_ALIGNMENT_SETTINGS, exportPath: '../x.json' }),
    ).rejects.toThrow('alignment_settings_invalid')
  })

  it('says what is missing before comparing', async () => {
    const failing = (options: Setup) => setup(options).alignments.view(project)
    await expect(failing({ settings: { sprint: '' } })).rejects.toThrow('alignment_sprint_not_set')
    await expect(failing({ exportPath: '' })).rejects.toThrow('alignment_items_missing')
    await expect(failing({ exported: null })).rejects.toThrow('tracker_export_missing')
    await expect(failing({ exported: { rows: [] } })).rejects.toThrow('tracker_export_unreadable')
    await expect(failing({ jira: false })).rejects.toThrow('alignment_tickets_missing')
    await expect(failing({ records: [] })).rejects.toThrow('alignment_tickets_missing')
    await expect(setup({ records: [] }).alignments.exportMissing(project)).rejects.toThrow(
      'alignment_tickets_missing',
    )
  })
})
