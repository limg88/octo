import {
  beforeFirstDay,
  cleanMeetingsSource,
  DomainError,
  isDomainError,
  likelierProject,
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
  type ProjectTeam,
  parseMailDocument,
  parseMeetingMeta,
  projectKeywords,
  type Reader,
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
  WriteOutcome,
} from './ports.ts'
import type { ReadingCounts, ReadingKind, ReadingOptions, Readings } from './readings.ts'

/** Verbale exports on one computer: the turn of its meetings is that computer's own. */
const MEETINGS: ReadingKind = { source: 'meetings', ownToComputer: true }

export type MeetingsDeps = {
  settings: SourceSettings
  /** The turns of the readings, between the computers that share the folder of a project. */
  readings: Readings
  exports: MeetingExports
  /** The projects of who uses Octo: a meeting is of one of those that read the same folder. */
  projects: () => Promise<Project[]>
  files: Pick<ProjectFiles, 'under' | 'readText' | 'remove'>
  writer: Pick<MemoryWriter, 'write'>
  clock: Clock
  /** The people of a project: a meeting whose people are of another project is said so. */
  team?: (project: Project) => Promise<ProjectTeam>
  /** What else of a project came from a meeting, to take away with it: its open points. */
  forget?: (project: Project, meeting: { id: string; folder: string }) => Promise<unknown>
}

/** A finished meeting no project could be told for, with the project its people point to. */
export type UnassignedMeeting = RecordedMeeting & {
  /** The name of the other project whose team its participants are of; null when none stands out. */
  elsewhere: string | null
}

/** What the Sources page shows for the meetings of a project. */
export type MeetingsSourceView = {
  config: MeetingsSourceConfig | null
  /** The folder Verbale exports to on this computer, when it can be told; null to be chosen. */
  suggestedRoot: string | null
  /** Where the meetings are written, inside the project folder. */
  targetFolder: string
  /** The last reading: of this computer, or the last good one of whoever shares the folder. */
  state: SourceState
  /** Who made that reading, when it was made from another computer. */
  readBy: Reader | null
  /** Who is writing the meetings of the project from another computer right now. */
  readingBy: Reader | null
  /** Whether the folder of Verbale the project names is one this computer can open. */
  readableHere: boolean
}

export type Meetings = {
  view(project: Project): Promise<MeetingsSourceView>
  /** Null switches the meetings of the project off; what was imported stays. */
  save(project: Project, config: MeetingsSourceConfig | null): Promise<MeetingsSourceView>
  /** Brings in the finished meetings that are of the project. One reading per project at a time. */
  sync(project: Project, options?: ReadingOptions): Promise<SourceRun>
  configured(project: Project): Promise<boolean>
  /**
   * Whether a periodic reading takes the meetings here: configured, and the folder of Verbale is
   * on this computer. Elsewhere the meetings are those another computer brought in.
   */
  readableHere(project: Project): Promise<boolean>
  /** The meetings the project holds, the newest first. */
  imported(project: Project): Promise<StoredMeeting[]>
  /** The finished meetings of the folder that no project could be told for. */
  unassigned(project: Project): Promise<UnassignedMeeting[]>
  /** Takes into the project a meeting that had none, because the PM says so. */
  assign(project: Project, meetingId: string): Promise<void>
  /** The other projects of who uses Octo: where a meeting held here can be moved to. */
  destinations(project: Project): Promise<Array<Pick<Project, 'id' | 'name'>>>
  /**
   * Takes a meeting away from the project, with the open points that came from it: to another
   * project, which holds it from then on, or to none (`null`). The project never takes it again.
   */
  move(project: Project, meetingId: string, targetProjectId: string | null): Promise<void>
}

type Complete = Extract<MeetingReading, { status: 'complete' }>
type Skipped = Extract<MeetingReading, { status: 'skipped' }>
type Owned = { reading: Complete; folder: string }
type Scan = { mine: Owned[]; unassigned: Complete[]; skipped: Skipped[] }

/** The invitation that calls a meeting off: its time is no longer of the project. */
const CALENDAR_CANCEL = 'CANCEL'
const SOURCE = 'meetings'

export function createMeetings(deps: MeetingsDeps): Meetings {
  const configOf = async (project: Project): Promise<MeetingsSourceConfig | null> =>
    (await deps.settings.load(project.folder)).meetings

  async function readableHere(project: Project): Promise<boolean> {
    const config = await configOf(project)
    return config !== null && (await deps.exports.readable(config.root))
  }

  async function view(project: Project): Promise<MeetingsSourceView> {
    const config = await configOf(project)
    return {
      config,
      suggestedRoot: config ? null : await deps.exports.defaultRoot(),
      targetFolder: MEETINGS_FOLDER,
      ...(await deps.readings.view(project, SOURCE)),
      readableHere: config === null || (await deps.exports.readable(config.root)),
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

  type Sharing = { project: Project; released: ReadonlySet<string> }

  async function sharing(project: Project, own: MeetingsSourceConfig): Promise<Sharing[]> {
    const others: Sharing[] = []
    for (const other of await deps.projects()) {
      if (other.id === project.id) continue
      const config = await configOf(other).catch(() => null)
      if (config && sameRoot(config.root, own.root)) {
        others.push({ project: other, released: new Set(config.released) })
      }
    }
    return [{ project, released: new Set(own.released) }, ...others]
  }

  async function candidateOf(project: Project): Promise<MeetingCandidate> {
    const mail = (await deps.settings.load(project.folder)).mail
    const invites: MeetingInvite[] = []
    for (const path of mail ? await deps.files.under(project.folder, mail.targetFolder) : []) {
      const content = await deps.files.readText(project.folder, path)
      const stored = content === null ? null : parseMailDocument(path, content)
      if (stored?.meeting && stored.invite !== CALENDAR_CANCEL) {
        const { uid, start, end, recurrence, excluded } = stored.meeting
        invites.push({ uid, start, end, recurrence, excluded })
      }
    }
    return {
      projectId: project.id,
      invites,
      keywords: projectKeywords(project.name, mail?.keywords ?? []),
    }
  }

  /** The people of this project and of the others, as their teams name the supplier's and the client's. */
  async function teamsOf(
    project: Project,
  ): Promise<Array<{ id: string; name: string; people: string[] }>> {
    if (!deps.team) return []
    const teams = []
    for (const other of await deps.projects()) {
      const team = await deps.team(other.id === project.id ? project : other).catch(() => null)
      teams.push({
        id: other.id,
        name: other.name,
        people: team?.people.map((person) => person.name) ?? [],
      })
    }
    return teams
  }

  /** Writes among the settings of a project that a meeting is, or is no longer, taken away from it. */
  async function release(project: Project, meetingId: string, away: boolean): Promise<void> {
    const current = await deps.settings.load(project.folder)
    if (!current.meetings) return
    const before = current.meetings.released ?? []
    if (before.includes(meetingId) === away) return
    const released = away ? [...before, meetingId] : before.filter((id) => id !== meetingId)
    const meetings = cleanMeetingsSource({ ...current.meetings, released })
    await deps.settings.save(project.folder, { ...current, meetings })
  }

  /** Every folder of the export root, told apart: of this project, of none, or left out. */
  async function scan(project: Project, config: MeetingsSourceConfig): Promise<Scan> {
    const readings = await deps.exports.list(config.root)
    const shared = await sharing(project, config)
    const projects = shared.map((entry) => entry.project)
    const released = new Map(shared.map((entry) => [entry.project.id, entry.released]))
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
        // A project that gave the meeting away takes no part in telling whose it is.
        const willing = candidates.filter(
          (candidate) => !released.get(candidate.projectId)?.has(reading.meeting.id),
        )
        owner = meetingOwner(reading.meeting, notes, willing)
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

  async function read(project: Project, config: MeetingsSourceConfig): Promise<ReadingCounts> {
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

  async function sync(project: Project, options: ReadingOptions = {}): Promise<SourceRun> {
    const config = await configOf(project)
    if (!config) throw new DomainError('source_not_configured', SOURCE)
    return deps.readings.run(project, MEETINGS, options, async () => ({
      ...(await read(project, config)),
      cursor: deps.clock.now().toISOString(),
    }))
  }

  return {
    view,
    sync,
    imported,

    async save(project, config) {
      const current = await deps.settings.load(project.folder)
      // What the PM took away stays taken away when the folder or the first day change.
      const released = config?.released ?? current.meetings?.released
      const meetings = config
        ? {
            ...cleanMeetingsSource({ ...config, released }),
            root: deps.exports.portable(config.root.trim()),
          }
        : null
      await deps.settings.save(project.folder, { ...current, meetings })
      return view(project)
    },

    configured: async (project) => (await configOf(project)) !== null,
    readableHere,

    async unassigned(project) {
      const config = await configOf(project)
      if (!config) return []
      try {
        const { unassigned } = await scan(project, config)
        if (unassigned.length === 0) return []
        const teams = await teamsOf(project)
        return unassigned.map(({ meeting }) => {
          const likelier = likelierProject(
            meeting.participants,
            project.id,
            teams.map(({ id, people }) => ({ projectId: id, people })),
          )
          return {
            ...meeting,
            elsewhere: teams.find((team) => team.id === likelier)?.name ?? null,
          }
        })
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
      // A meeting once taken away and now wanted back is of the project again.
      if (config.released?.includes(meetingId)) await release(project, meetingId, false)
    },

    async destinations(project) {
      return (await deps.projects())
        .filter((other) => other.id !== project.id)
        .map(({ id, name }) => ({ id, name }))
    },

    async move(project, meetingId, targetProjectId) {
      const meeting = (await imported(project)).find((held) => held.id === meetingId)
      if (!meeting) throw new DomainError('meeting_not_found', meetingId)
      const target =
        targetProjectId === null
          ? null
          : (await deps.projects()).find((other) => other.id === targetProjectId)
      if (target === undefined || target?.id === project.id) {
        throw new DomainError('meeting_not_found', targetProjectId ?? meetingId)
      }
      const paths = await deps.files.under(project.folder, meeting.folder)
      if (target) {
        // Written there first: a failure half way leaves the meeting where it was.
        for (const path of paths) {
          const text = await deps.files.readText(project.folder, path)
          if (text !== null) await deps.writer.write(target.folder, path, text)
        }
        await release(target, meetingId, false)
      }
      // Said before the files go: the next reading must not take the meeting back.
      await release(project, meetingId, true)
      for (const path of paths) await deps.files.remove(project.folder, path)
      await deps.forget?.(project, { id: meeting.id, folder: meeting.folder })
    },
  }
}
