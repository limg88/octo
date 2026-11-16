import {
  beforeFirstDay,
  cleanMeetingsSource,
  DomainError,
  isDomainError,
  MEETING_META_FILE,
  MEETING_TEXT_FILES,
  MEETINGS_FOLDER,
  MEETINGS_READING_PATH,
  type MeetingCandidate,
  type MeetingInvite,
  type MeetingReading,
  type MeetingsSourceConfig,
  meetingFolderName,
  meetingMeta,
  meetingOwner,
  meetingsReadingNote,
  type Project,
  parseMailDocument,
  parseMeetingMeta,
  projectKeywords,
  type RecordedMeeting,
  type SourceRun,
  type SourceState,
  type StoredMeeting,
  sameExport,
} from '@octo/domain'
import type {
  Clock,
  MeetingExports,
  MemoryWriter,
  ProjectFiles,
  SourceSettings,
  SourceStates,
  WriteOutcome,
} from './ports.ts'

export type MeetingsDeps = {
  settings: SourceSettings
  states: SourceStates
  exports: MeetingExports
  /** The projects of who uses Octo: a meeting is of one of those that read the same folder. */
  projects: () => Promise<Project[]>
  files: Pick<ProjectFiles, 'under' | 'readText' | 'remove'>
  writer: Pick<MemoryWriter, 'write'>
  clock: Clock
}

/** What the Sources page shows for the meetings of a project. */
export type MeetingsSourceView = {
  config: MeetingsSourceConfig | null
  /** The folder Verbale exports to on this computer, when it can be told; null to be chosen. */
  suggestedRoot: string | null
  /** Where the meetings are written, inside the project folder. */
  targetFolder: string
  state: SourceState
}

export type Meetings = {
  view(project: Project): Promise<MeetingsSourceView>
  /** Null switches the meetings of the project off; what was imported stays. */
  save(project: Project, config: MeetingsSourceConfig | null): Promise<MeetingsSourceView>
  /** Brings in the finished meetings that are of the project. One reading per project at a time. */
  sync(project: Project): Promise<SourceRun>
  configured(project: Project): Promise<boolean>
  /** The meetings the project holds, the newest first. */
  imported(project: Project): Promise<StoredMeeting[]>
  /** The finished meetings of the folder that no project could be told for. */
  unassigned(project: Project): Promise<RecordedMeeting[]>
  /** Takes into the project a meeting that had none, because the PM says so. */
  assign(project: Project, meetingId: string): Promise<void>
}

type Complete = Extract<MeetingReading, { status: 'complete' }>
type Skipped = Extract<MeetingReading, { status: 'skipped' }>
type Owned = { reading: Complete; folder: string }
type Scan = { mine: Owned[]; unassigned: Complete[]; skipped: Skipped[] }

/** The invitation that calls a meeting off: its time is no longer of the project. */
const CALENDAR_CANCEL = 'CANCEL'
const SOURCE = 'meetings'

export function createMeetings(deps: MeetingsDeps): Meetings {
  const running = new Set<string>()

  const configOf = async (project: Project): Promise<MeetingsSourceConfig | null> =>
    (await deps.settings.load(project.folder)).meetings

  async function view(project: Project): Promise<MeetingsSourceView> {
    const config = await configOf(project)
    return {
      config,
      suggestedRoot: config ? null : await deps.exports.defaultRoot(),
      targetFolder: MEETINGS_FOLDER,
      state: await deps.states.get(project.id, SOURCE),
    }
  }

  async function imported(project: Project): Promise<StoredMeeting[]> {
    const found: StoredMeeting[] = []
    for (const path of await deps.files.under(project.folder, MEETINGS_FOLDER)) {
      if (!path.endsWith(`/${MEETING_META_FILE}`)) continue
      const content = await deps.files.readText(project.folder, path)
      const meeting = content === null ? null : parseMeetingMeta(path, content)
      if (meeting) found.push(meeting)
    }
    return found.sort((a, b) => b.started.localeCompare(a.started))
  }

  /**
   * The projects that read the same folder of Verbale, this one first. A project whose folder
   * cannot be read now takes no part: it neither claims a meeting nor holds one.
   */
  const sameRoot = (a: string, b: string): boolean =>
    deps.exports.portable(a) === deps.exports.portable(b)

  async function sharing(project: Project, root: string): Promise<Project[]> {
    const others: Project[] = []
    for (const other of await deps.projects()) {
      if (other.id === project.id) continue
      const config = await configOf(other).catch(() => null)
      if (config && sameRoot(config.root, root)) others.push(other)
    }
    return [project, ...others]
  }

  async function candidateOf(project: Project): Promise<MeetingCandidate> {
    const mail = (await deps.settings.load(project.folder)).mail
    const invites: MeetingInvite[] = []
    for (const path of mail ? await deps.files.under(project.folder, mail.targetFolder) : []) {
      const content = await deps.files.readText(project.folder, path)
      const stored = content === null ? null : parseMailDocument(path, content)
      if (stored?.meeting && stored.invite !== CALENDAR_CANCEL) {
        const { uid, start, end } = stored.meeting
        invites.push({ uid, start, end })
      }
    }
    return {
      projectId: project.id,
      invites,
      keywords: projectKeywords(project.name, mail?.keywords ?? []),
    }
  }

  /** Every folder of the export root, told apart: of this project, of none, or left out. */
  async function scan(project: Project, config: MeetingsSourceConfig): Promise<Scan> {
    const readings = await deps.exports.list(config.root)
    const projects = await sharing(project, config.root)
    // A meeting a project already holds stays there, whatever the rules would say today.
    const holders = new Map<string, { projectId: string; folder: string }>()
    for (const holder of projects) {
      for (const meeting of await imported(holder)) {
        holders.set(meeting.id, { projectId: holder.id, folder: meeting.folder })
      }
    }
    let candidates: MeetingCandidate[] | null = null
    const found: Scan = { mine: [], unassigned: [], skipped: [] }
    for (const reading of readings) {
      if (reading.status === 'skipped') {
        if (!beforeFirstDay(reading, config.since)) found.skipped.push(reading)
        continue
      }
      const holder = holders.get(reading.meeting.id)
      // From before the first day taken: left alone, unless the project already holds it.
      if (!holder && beforeFirstDay(reading, config.since)) continue
      let owner = holder?.projectId ?? null
      if (!holder) {
        candidates ??= await Promise.all(projects.map(candidateOf))
        const notes = (await deps.exports.read(config.root, reading.folder, 'notes.md')) ?? ''
        owner = meetingOwner(reading.meeting, notes, candidates)
      }
      if (owner === null) found.unassigned.push(reading)
      if (owner !== project.id) continue
      const folder = holder?.folder ?? `${MEETINGS_FOLDER}/${meetingFolderName(reading.meeting)}`
      found.mine.push({ reading, folder })
    }
    return found
  }

  /**
   * Writes the text files of a meeting and its `_meta.md`; a file no longer exported goes.
   * Nothing is written when Verbale exported the meeting again while its files were being read:
   * they could be half of one export and half of the other.
   */
  async function importOne(
    project: Project,
    config: MeetingsSourceConfig,
    { reading, folder }: Owned,
  ): Promise<WriteOutcome | 'changing'> {
    const texts = new Map<(typeof MEETING_TEXT_FILES)[number], string>()
    for (const name of MEETING_TEXT_FILES) {
      const text = await deps.exports.read(config.root, reading.folder, name)
      if (text !== null) texts.set(name, text)
    }
    const after = await deps.exports.reading(config.root, reading.folder)
    if (after === null || !sameExport(reading.meeting, after)) return 'changing'
    const outcomes: WriteOutcome[] = []
    for (const name of MEETING_TEXT_FILES) {
      const path = `${folder}/${name}`
      const text = texts.get(name)
      if (text !== undefined) {
        outcomes.push(await deps.writer.write(project.folder, path, text))
      } else if ((await deps.files.readText(project.folder, path)) !== null) {
        await deps.files.remove(project.folder, path)
        outcomes.push('written')
      }
    }
    const meta = meetingMeta(reading.meeting, reading.folder, [...texts.keys()])
    outcomes.push(await deps.writer.write(project.folder, `${folder}/${MEETING_META_FILE}`, meta))
    return outcomes.includes('written') ? 'written' : 'unchanged'
  }

  async function read(
    project: Project,
    config: MeetingsSourceConfig,
  ): Promise<Pick<SourceRun, 'written' | 'unchanged'>> {
    const found = await scan(project, config)
    const counts = { written: 0, unchanged: 0 }
    const changing: Skipped[] = []
    for (const owned of found.mine) {
      const outcome = await importOne(project, config, owned)
      if (outcome === 'changing') {
        const { folder } = owned.reading
        changing.push({ folder, status: 'skipped', reason: 'changing', detail: '' })
      } else counts[outcome] += 1
    }
    const skipped = [...found.skipped, ...changing]
    const note = meetingsReadingNote(config.root, skipped, found.unassigned)
    await deps.writer.write(project.folder, MEETINGS_READING_PATH, note)
    return counts
  }

  async function sync(project: Project): Promise<SourceRun> {
    const config = await configOf(project)
    if (!config) throw new DomainError('source_not_configured', SOURCE)
    if (running.has(project.id)) throw new DomainError('source_busy', SOURCE)
    running.add(project.id)
    const at = deps.clock.now().toISOString()
    try {
      const run: SourceRun = { at, ...(await read(project, config)), error: null }
      await deps.states.set(project.id, SOURCE, { cursor: at, lastRun: run })
      return run
    } catch (error) {
      if (!isDomainError(error)) throw error
      const run: SourceRun = { at, written: 0, unchanged: 0, error: error.code }
      await deps.states.set(project.id, SOURCE, { cursor: null, lastRun: run })
      return run
    } finally {
      running.delete(project.id)
    }
  }

  return {
    view,
    sync,
    imported,

    async save(project, config) {
      const current = await deps.settings.load(project.folder)
      const meetings = config
        ? { ...cleanMeetingsSource(config), root: deps.exports.portable(config.root.trim()) }
        : null
      await deps.settings.save(project.folder, { ...current, meetings })
      return view(project)
    },

    configured: async (project) => (await configOf(project)) !== null,

    async unassigned(project) {
      const config = await configOf(project)
      if (!config) return []
      try {
        return (await scan(project, config)).unassigned.map((reading) => reading.meeting)
      } catch (error) {
        // A folder that cannot be read now is said by the source itself, not here.
        if (!isDomainError(error)) throw error
        return []
      }
    },

    async assign(project, meetingId) {
      const config = await configOf(project)
      if (!config) throw new DomainError('source_not_configured', SOURCE)
      const { unassigned } = await scan(project, config)
      const reading = unassigned.find((candidate) => candidate.meeting.id === meetingId)
      if (!reading) throw new DomainError('meeting_not_found', meetingId)
      const folder = `${MEETINGS_FOLDER}/${meetingFolderName(reading.meeting)}`
      const outcome = await importOne(project, config, { reading, folder })
      // Exported again this very moment: the PM tries again, nothing was written.
      if (outcome === 'changing') throw new DomainError('source_busy', SOURCE)
    },
  }
}
