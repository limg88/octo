import {
  applyClosing,
  type ClosingVerdict,
  checkCitation,
  checkUnrecorded,
  type DayMeeting,
  type LiveSource,
  type MEETING_TEXT_FILES,
  type ModelSettings,
  meetingEnd,
  type OpenPointRegister,
  type Project,
  type ProposedPoint,
  type RiskSource,
  recordedDuring,
  romeDateString,
  type StoredMeeting,
} from '@octo/domain'
import type { Meetings } from './meetings.ts'
import type { OpenPoints } from './open-points.ts'
import type { AgentProgress, Clock, EvidenceReader, MeetingReader, ProjectFiles } from './ports.ts'

export type DayClosingDeps = {
  points: Pick<OpenPoints, 'register' | 'keep'>
  meetings: Pick<Meetings, 'imported'>
  files: Pick<ProjectFiles, 'readText'>
  reader: Pick<MeetingReader, 'closing'>
  evidence: EvidenceReader
  clock: Clock
  models?: (project: Project) => Promise<ModelSettings>
  liveSources?: (project: Project) => Promise<LiveSource[]>
  /** The name of who uses Octo, when it is known. */
  pm?: () => string | null
}

export type CloseDayInput = {
  /** The meetings of the calendar of the days being closed: the recordings are told by them. */
  held: readonly DayMeeting[]
  onProgress?: (progress: AgentProgress) => void
  signal?: AbortSignal
}

/** What the page is told of the closing of the day. */
export type ClosingState = {
  register: OpenPointRegister
  /** The recorded meetings Claude has not read yet, by their id, the oldest first. */
  unread: string[]
}

export type DayClosing = {
  /**
   * Without Claude: asks the PM about the points whose meeting was held and not recorded, and
   * tells which recordings wait to be read.
   */
  look(project: Project, held: readonly DayMeeting[]): Promise<ClosingState>
  /**
   * Asks Claude what the recorded meetings not yet read say of the open points, and which
   * points they open. The code checks every quote before anything is closed or opened.
   */
  close(project: Project, input: CloseDayInput): Promise<OpenPointRegister>
}

const DAY_MS = 24 * 60 * 60 * 1000
/** A recording older than this is not read to close the day: it is of another week. */
export const CLOSING_WINDOW_DAYS = 7
/** Recordings read in one run at most, the latest ones. */
export const MAX_MEETINGS_PER_CLOSING = 8
/** The files of a meeting Claude is given, the shortest first: the transcript is the last resort. */
export const MEETING_FILES_TO_READ = [
  'report.md',
  'notes.md',
  'transcript.md',
] as const satisfies ReadonlyArray<(typeof MEETING_TEXT_FILES)[number]>
const DAY = /^\d{4}-\d{2}-\d{2}$/

/**
 * The closing of the day: what the meetings of the day did to the open points. Claude reads,
 * the code checks, and a point is never closed on words that are not in a file of the meeting.
 */
export function createDayClosing(deps: DayClosingDeps): DayClosing {
  async function unreadOf(project: Project, register: OpenPointRegister) {
    const since = deps.clock.now().getTime() - CLOSING_WINDOW_DAYS * DAY_MS
    const read = new Set(register.readMeetings)
    const recorded = await deps.meetings.imported(project)
    const unread = recorded
      .filter((meeting) => Date.parse(meeting.started) >= since && !read.has(meeting.id))
      .sort((a, b) => a.started.localeCompare(b.started))
      .slice(-MAX_MEETINGS_PER_CLOSING)
    return { recorded, unread }
  }

  /** The register with the questions on the meetings held and not recorded, kept when it changed. */
  async function asked(
    project: Project,
    register: OpenPointRegister,
    held: readonly DayMeeting[],
    recorded: readonly StoredMeeting[],
  ): Promise<OpenPointRegister> {
    const now = deps.clock.now().getTime()
    const over = held.filter((meeting) => meetingEnd(meeting) <= now)
    const next = checkUnrecorded(register, over, recorded, romeDateString)
    return next === register ? register : deps.points.keep(project, next)
  }

  async function filesOf(project: Project, meeting: StoredMeeting): Promise<string[]> {
    const files: string[] = []
    for (const name of MEETING_FILES_TO_READ) {
      const path = `${meeting.folder}/${name}`
      if ((await deps.files.readText(project.folder, path)) !== null) files.push(path)
    }
    return files
  }

  return {
    async look(project, held) {
      const register = await deps.points.register(project)
      const { recorded, unread } = await unreadOf(project, register)
      return {
        register: await asked(project, register, held, recorded),
        unread: unread.map((meeting) => meeting.id),
      }
    },

    async close(project, input) {
      const register = await deps.points.register(project)
      const { recorded, unread } = await unreadOf(project, register)
      if (unread.length === 0) return asked(project, register, input.held, recorded)
      const byFile = new Map<string, StoredMeeting>()
      const meetings = []
      for (const meeting of unread) {
        const files = await filesOf(project, meeting)
        for (const file of files) byFile.set(file, meeting)
        meetings.push({ title: meeting.title, started: meeting.started, files })
      }
      let model: string | null = null
      const proposed = await deps.reader.closing({
        projectFolder: project.folder,
        day: romeDateString(deps.clock.now()),
        points: register.points
          .filter((point) => point.state === 'open')
          .map(({ id, title, owner, due }) => ({ id, title, owner, due })),
        meetings,
        pm: deps.pm?.() ?? null,
        model: (await deps.models?.(project))?.ask ?? null,
        liveSources: (await deps.liveSources?.(project)) ?? [],
        onModel: (used) => {
          model = used
        },
        ...(input.onProgress ? { onProgress: input.onProgress } : {}),
        ...(input.signal ? { signal: input.signal } : {}),
      })
      /** The words Claude gives count only when they are in a file of a meeting it was given. */
      const sourceOf = async (path: string, quote: string): Promise<RiskSource> => {
        const citation = { n: 1, path, quote }
        const found = byFile.has(path)
          ? checkCitation(citation, await deps.evidence.read(project.folder, path))
          : null
        return { path, quote, verified: found?.status === 'verified' }
      }
      const verdicts: ClosingVerdict[] = []
      for (const verdict of proposed.verdicts) {
        verdicts.push({
          id: verdict.id,
          outcome: verdict.outcome,
          said: verdict.said,
          source: await sourceOf(verdict.path, verdict.quote),
          meeting: byFile.get(verdict.path)?.title ?? null,
        })
      }
      const points: ProposedPoint[] = []
      for (const point of proposed.points) {
        const recording = byFile.get(point.path)
        const series = recording
          ? input.held.find((meeting) => recordedDuring(meeting, recording))
          : undefined
        points.push({
          title: point.title,
          owner: point.owner,
          due: point.due !== null && DAY.test(point.due) ? point.due : null,
          source: await sourceOf(point.path, point.quote),
          meeting: series?.uid ?? null,
        })
      }
      const now = deps.clock.now()
      const closed = applyClosing(register, {
        day: romeDateString(now),
        at: now.toISOString(),
        model,
        read: unread.map((meeting) => meeting.id),
        verdicts,
        points,
      })
      await deps.points.keep(project, closed)
      return asked(project, closed, input.held, recorded)
    },
  }
}
