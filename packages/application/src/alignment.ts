import {
  type AlignItem,
  type Alignment,
  type AlignmentSettings,
  type AlignTicket,
  alignTrackers,
  cleanAlignmentSettings,
  DomainError,
  missingTicketsCsv,
  OCTO_FOLDER,
  type Project,
  parseTrackerExport,
} from '@octo/domain'
import type {
  AlignmentSettingsStore,
  DashboardSettingsStore,
  FeedRecord,
  FeedRecords,
  MemoryWriter,
  SourceSettings,
  TrackerExports,
} from './ports.ts'

export type AlignmentDeps = {
  settings: AlignmentSettingsStore
  /** Where the export of the client's tracker is, unless the PM says otherwise: the dashboard's. */
  dashboard: DashboardSettingsStore
  exports: TrackerExports
  /** Where the supplier's tickets are, unless the PM says otherwise: the Jira feed's folder. */
  sources: SourceSettings
  records: FeedRecords
  writer: MemoryWriter
}

/** Where Octo writes the import files of the missing tickets. */
export const ALIGNMENT_FOLDER = `${OCTO_FOLDER}/allineamento`

export type AlignmentView = {
  alignment: Alignment
  /** When the client's tracker was read; null when the export does not say. */
  exportedAt: string | null
  /** How many tickets were read, in any sprint. */
  tickets: number
}
/** What the client's tracker holds to choose from, known before anything is compared. */
export type AlignmentChoices = { sprints: string[]; periods: string[]; tags: string[] }
const NO_CHOICES: AlignmentChoices = { sprints: [], periods: [], tags: [] }
/** The import file of the missing tickets, as a path from the project folder. */
export type AlignmentFile = { path: string; rows: number }

export type Alignments = {
  settings(project: Project): Promise<AlignmentSettings>
  saveSettings(project: Project, settings: AlignmentSettings): Promise<AlignmentSettings>
  /** The sprints, periods and tags of the client's export; empty lists while there is none. */
  choices(project: Project): Promise<AlignmentChoices>
  view(project: Project): Promise<AlignmentView>
  /** Writes the missing items of the sprint as a file the supplier's tracker imports. */
  exportMissing(project: Project): Promise<AlignmentFile>
}

/** A place inside the project: never an absolute path, never one that climbs out. */
function checkedPath(path: string): string {
  const parts = path.split(/[\\/]/)
  if (path.startsWith('/') || /^[a-z]:/i.test(path) || parts.includes('..')) {
    throw new DomainError('alignment_settings_invalid', path)
  }
  return parts.filter((part) => part !== '' && part !== '.').join('/')
}

const text = (value: unknown): string | null =>
  typeof value === 'string' && value !== '' ? value : null

/** A ticket from what the feed wrote of it; null for an item that is not a ticket. */
function ticketOf({ title, record }: FeedRecord): AlignTicket | null {
  const key = text(record.key)
  if (key === null) return null
  const sprints = Array.isArray(record.sprints)
    ? record.sprints.filter((sprint): sprint is string => typeof sprint === 'string')
    : []
  return {
    key,
    title,
    type: text(record.type) ?? '',
    status: text(record.status) ?? '',
    sprint: text(record.sprint),
    sprints,
    assignee: text(record.assignee),
  }
}

const sprintName = (sprint: string): string => sprint.split(/[\\/]/).pop() ?? sprint
const fileSlug = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')

/** Names as a person reads them in a list: `Sprint 9` before `Sprint 10`. */
const inOrder = (names: Iterable<string>): string[] =>
  [...new Set(names)].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))

export function createAlignments(deps: AlignmentDeps): Alignments {
  /** The export named for the alignment, or the one the dashboard reads. */
  const exportPathOf = async (project: Project, settings: AlignmentSettings): Promise<string> =>
    settings.exportPath || (await deps.dashboard.load(project.folder)).exportPath

  async function load(project: Project) {
    const settings = await deps.settings.load(project.folder)
    if (settings.sprint === '') throw new DomainError('alignment_sprint_not_set')
    const exportPath = await exportPathOf(project, settings)
    if (exportPath === '') throw new DomainError('alignment_items_missing')
    const raw = await deps.exports.readJson(project.folder, exportPath)
    if (raw === null) throw new DomainError('tracker_export_missing', exportPath)
    const parsed = parseTrackerExport(raw)
    if (parsed === null) throw new DomainError('tracker_export_unreadable', exportPath)
    const folder =
      settings.ticketFolder || (await deps.sources.load(project.folder)).jira?.targetFolder || ''
    if (folder === '') throw new DomainError('alignment_tickets_missing')
    const tickets = (await deps.records.under(project.folder, checkedPath(folder))).flatMap(
      (record) => {
        const ticket = ticketOf(record)
        return ticket ? [ticket] : []
      },
    )
    if (tickets.length === 0) throw new DomainError('alignment_tickets_missing', folder)
    const items: AlignItem[] = parsed.items
    return { settings, parsed, items, tickets }
  }

  return {
    settings: (project) => deps.settings.load(project.folder),

    async saveSettings(project, settings) {
      const clean = cleanAlignmentSettings(settings)
      const saved = {
        ...clean,
        exportPath: checkedPath(clean.exportPath),
        ticketFolder: checkedPath(clean.ticketFolder),
      }
      await deps.settings.save(project.folder, saved)
      return saved
    },

    async choices(project) {
      const settings = await deps.settings.load(project.folder)
      const exportPath = await exportPathOf(project, settings)
      if (exportPath === '') return NO_CHOICES
      const raw = await deps.exports.readJson(project.folder, exportPath)
      const parsed = raw === null ? null : parseTrackerExport(raw)
      if (parsed === null) return NO_CHOICES
      const items: AlignItem[] = parsed.items
      return {
        sprints: inOrder(items.flatMap((item) => (item.sprint ? [sprintName(item.sprint)] : []))),
        periods: inOrder(items.flatMap((item) => (item.period ? [item.period] : []))),
        tags: inOrder(items.flatMap((item) => item.tags)),
      }
    },

    async view(project) {
      const { settings, parsed, items, tickets } = await load(project)
      return {
        alignment: alignTrackers(items, tickets, settings),
        exportedAt: parsed.exportedAt,
        tickets: tickets.length,
      }
    },

    async exportMissing(project) {
      const { settings, items, tickets } = await load(project)
      const { missing } = alignTrackers(items, tickets, settings)
      const path = `${ALIGNMENT_FOLDER}/mancanti_${fileSlug(settings.sprint)}.csv`
      await deps.writer.claim(project.folder)
      await deps.writer.write(project.folder, path, missingTicketsCsv(missing, settings))
      return { path, rows: missing.length }
    },
  }
}
