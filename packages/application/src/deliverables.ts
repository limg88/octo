import {
  APPROVED_FOLDER,
  approvedFileName,
  type CheckedAnswer,
  checkAnswer,
  cleanInputs,
  DELIVERABLE_CATALOG,
  type Deliverable,
  type DeliverableKind,
  DomainError,
  type DraftAnswer,
  deliverableKind,
  type Evidence,
  isDomainError,
  JOBS_FOLDER,
  jobPath,
  type Project,
  projectInstructionsPath,
  REGISTER_PATH,
  registerMarkdown,
  reviewTimeSince,
  withEstimate,
  withoutMarkers,
} from '@octo/domain'
import type {
  AgentProgress,
  Clock,
  DeliverableWriter,
  DocumentRenderer,
  EvidenceReader,
  IdGenerator,
  MemoryWriter,
  ProjectFiles,
} from './ports.ts'

export type DeliverablesDeps = {
  writer: DeliverableWriter
  renderer: DocumentRenderer
  evidence: EvidenceReader
  files: ProjectFiles
  memory: MemoryWriter
  clock: Clock
  ids: IdGenerator
}

export type StartInput = {
  kindId: string
  inputs: Readonly<Record<string, string>>
  onProgress?: (progress: AgentProgress) => void
}

export type ReviseInput = {
  deliverableId: string
  request: string
  onProgress?: (progress: AgentProgress) => void
}

export type Deliverables = {
  /** The kinds of deliverable Octo knows how to write. */
  catalog(): readonly DeliverableKind[]
  /** The deliverables of a project, newest first. */
  list(project: Project): Promise<Deliverable[]>
  get(project: Project, deliverableId: string): Promise<Deliverable>
  /** Writes the first draft, checks its sources and has it read again by the red team. */
  start(project: Project, input: StartInput): Promise<Deliverable>
  /** Writes the draft again with a change the PM asked for in words. */
  revise(project: Project, input: ReviseInput): Promise<Deliverable>
  /** Writes the files of the deliverable and closes it. Only a draft under review is approved. */
  approve(project: Project, deliverableId: string): Promise<Deliverable>
  /** What the PM added, for this project, to how a kind is written. Empty when nothing. */
  instructions(project: Project, kindId: string): Promise<string>
  saveInstructions(project: Project, kindId: string, text: string): Promise<void>
}

const TITLE_FIELDS = ['tema', 'periodo', 'riunione'] as const
const MARKDOWN = 'md'
const WORD = 'docx'

export function createDeliverables(deps: DeliverablesDeps): Deliverables {
  const running = new Set<string>()

  function kindOf(kindId: string): DeliverableKind {
    const kind = deliverableKind(kindId)
    if (!kind) throw new DomainError('deliverable_kind_unknown', kindId)
    return kind
  }

  const save = (project: Project, deliverable: Deliverable): Promise<unknown> =>
    deps.memory.write(project.folder, jobPath(deliverable.id), JSON.stringify(deliverable, null, 2))

  async function get(project: Project, deliverableId: string): Promise<Deliverable> {
    const text = await deps.files.readText(project.folder, jobPath(deliverableId))
    if (text === null) throw new DomainError('deliverable_not_found', deliverableId)
    return JSON.parse(text) as Deliverable
  }

  async function list(project: Project): Promise<Deliverable[]> {
    const paths = await deps.files.under(project.folder, JOBS_FOLDER)
    const all: Deliverable[] = []
    for (const path of paths.filter((candidate) => candidate.endsWith('.json'))) {
      const text = await deps.files.readText(project.folder, path)
      if (text !== null) all.push(JSON.parse(text) as Deliverable)
    }
    return all.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  async function instructions(project: Project, kindId: string): Promise<string> {
    const path = projectInstructionsPath(kindOf(kindId).id)
    return (await deps.files.readText(project.folder, path)) ?? ''
  }

  async function check(project: Project, draft: DraftAnswer): Promise<CheckedAnswer> {
    const paths = [...new Set(draft.citations.map((citation) => citation.path))]
    const entries = await Promise.all(
      paths.map(
        async (path): Promise<[string, Evidence]> => [
          path,
          await deps.evidence.read(project.folder, path),
        ],
      ),
    )
    return checkAnswer(draft, new Map(entries))
  }

  /** One writing: the draft, its sources checked, the red team on the text the reader gets. */
  async function write(
    project: Project,
    deliverable: Deliverable,
    request: string | null,
    onProgress: ((progress: AgentProgress) => void) | undefined,
  ): Promise<Deliverable> {
    if (running.has(deliverable.id)) throw new DomainError('deliverable_busy')
    running.add(deliverable.id)
    const kind = kindOf(deliverable.kindId)
    const startedAt = deps.clock.now()
    const previous = deliverable.written
    try {
      const written = await deps.writer.draft({
        projectFolder: project.folder,
        kind,
        projectInstructions: (await instructions(project, kind.id)) || null,
        inputs: deliverable.inputs,
        revision: previous && request ? { draft: previous, request } : null,
        ...(onProgress ? { onProgress } : {}),
      })
      // Numbers only the code may compute are put in the text before anything is checked.
      const text = kind.calculation ? withEstimate(written.text, written.wbs ?? []) : written.text
      const checked = await check(project, { ...written, text })
      const redTeam = await deps.writer.redTeam({
        projectFolder: project.folder,
        kind,
        text: withoutMarkers(checked.text),
      })
      const readyAt = deps.clock.now()
      return {
        ...deliverable,
        status: 'review',
        draft: checked,
        written,
        redTeam,
        readyAt: readyAt.toISOString(),
        rounds: [...deliverable.rounds, roundOf(startedAt, readyAt, request, null)],
      }
    } catch (error) {
      if (!isDomainError(error)) throw error
      const failedAt = deps.clock.now()
      return {
        ...deliverable,
        // A change that failed leaves the draft the PM was reviewing as it was.
        status: previous ? 'review' : 'failed',
        readyAt: previous ? failedAt.toISOString() : null,
        rounds: [...deliverable.rounds, roundOf(startedAt, failedAt, request, error.code)],
      }
    } finally {
      running.delete(deliverable.id)
    }
  }

  async function start(project: Project, input: StartInput): Promise<Deliverable> {
    const kind = kindOf(input.kindId)
    const inputs = cleanInputs(kind, input.inputs)
    await deps.memory.claim(project.folder)
    const title = TITLE_FIELDS.map((key) => inputs[key]).find(Boolean) ?? kind.title
    const created: Deliverable = {
      id: deps.ids.next(),
      projectId: project.id,
      kindId: kind.id,
      title,
      inputs,
      status: 'writing',
      createdAt: deps.clock.now().toISOString(),
      rounds: [],
      draft: null,
      written: null,
      redTeam: null,
      readyAt: null,
      reviewMs: 0,
      approvedAt: null,
      files: [],
    }
    await save(project, created)
    const written = await write(project, created, null, input.onProgress)
    await save(project, written)
    return written
  }

  async function revise(project: Project, input: ReviseInput): Promise<Deliverable> {
    const request = input.request.trim()
    if (request.length === 0) throw new DomainError('request_empty')
    const current = await get(project, input.deliverableId)
    if (current.status !== 'review' || !current.draft) {
      throw new DomainError('deliverable_not_ready', current.status)
    }
    const reviewed: Deliverable = {
      ...current,
      status: 'writing',
      reviewMs: current.reviewMs + reviewTimeSince(current.readyAt, deps.clock.now()),
    }
    await save(project, reviewed)
    const written = await write(project, reviewed, request, input.onProgress)
    await save(project, written)
    return written
  }

  async function approve(project: Project, deliverableId: string): Promise<Deliverable> {
    const current = await get(project, deliverableId)
    if (current.status !== 'review' || !current.draft) {
      throw new DomainError('deliverable_not_ready', current.status)
    }
    const now = deps.clock.now()
    const approved: Deliverable = {
      ...current,
      status: 'approved',
      approvedAt: now.toISOString(),
      reviewMs: current.reviewMs + reviewTimeSince(current.readyAt, now),
    }
    // What leaves is the text without the markers of the sources: those are for the PM.
    const text = withoutMarkers(current.draft.text)
    const markdown = `${APPROVED_FOLDER}/${approvedFileName(approved, MARKDOWN)}`
    const word = `${APPROVED_FOLDER}/${approvedFileName(approved, WORD)}`
    await deps.memory.write(project.folder, markdown, `${text.trimEnd()}\n`)
    await deps.memory.writeBytes(
      project.folder,
      word,
      await deps.renderer.word(approved.title, text),
    )
    const done = { ...approved, files: [markdown, word] }
    await save(project, done)
    await deps.memory.write(
      project.folder,
      REGISTER_PATH,
      registerMarkdown(await list(project), DELIVERABLE_CATALOG),
    )
    return done
  }

  return {
    catalog: () => DELIVERABLE_CATALOG,
    list,
    get,
    start,
    revise,
    approve,
    instructions,
    saveInstructions: async (project, kindId, text) => {
      const path = projectInstructionsPath(kindOf(kindId).id)
      await deps.memory.claim(project.folder)
      await deps.memory.write(project.folder, path, text.trim() ? `${text.trim()}\n` : '')
    },
  }
}

function roundOf(
  startedAt: Date,
  endedAt: Date,
  request: string | null,
  error: Deliverable['rounds'][number]['error'],
): Deliverable['rounds'][number] {
  return {
    at: startedAt.toISOString(),
    request,
    durationMs: endedAt.getTime() - startedAt.getTime(),
    error,
  }
}
