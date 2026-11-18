import {
  APPROVED_FOLDER,
  approvedFileName,
  type CheckedAnswer,
  checkAnswer,
  cleanInputs,
  correctedKindPath,
  DECK_MODEL_PATH,
  type DeckOutline,
  type Deliverable,
  type DeliverableDraft,
  type DeliverableKind,
  DomainError,
  type DraftAnswer,
  deckMarkdown,
  deckProblemText,
  type Evidence,
  fitDeckDraft,
  isDomainError,
  isOwnKind,
  JOBS_FOLDER,
  jobPath,
  KIND_TEMPLATES_FOLDER,
  kindTemplatePath,
  LETTERHEAD_PATH,
  type LiveSource,
  MEETING_META_FILE,
  MEETINGS_FOLDER,
  type ModelSettings,
  mapDeckStrings,
  memoryPageMarkdown,
  memoryPagePath,
  OWN_KINDS_FOLDER,
  type OwnKindInput,
  ownKind,
  ownKindPath,
  type Project,
  parseMeetingMeta,
  projectInstructionsPath,
  REGISTER_PATH,
  registerMarkdown,
  reviewTimeSince,
  romeDateString,
  TEMPLATE_FORMATS,
  type TemplateFormat,
  templateFormatOf,
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
  ShippedCatalog,
} from './ports.ts'

export type DeliverablesDeps = {
  /** The kinds that travel with the app. */
  shipped: ShippedCatalog
  writer: DeliverableWriter
  renderer: DocumentRenderer
  evidence: EvidenceReader
  files: ProjectFiles
  memory: MemoryWriter
  clock: Clock
  ids: IdGenerator
  /** The models the PM chose for the project; without, the default of Claude Code. */
  models?: (project: Project) => Promise<ModelSettings>
  /** What Octo reads directly for the project, told to the writer of every draft. */
  liveSources?: (project: Project) => Promise<LiveSource[]>
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

/** How a kind would be written after a correction: shown to the PM, kept only if approved. */
export type KindCorrection = {
  id: string
  kindId: string
  instructions: string
  /** What changed, in a few words of the one who wrote it. */
  summary: string
}

const MAX_CORRECTION_WORDS = 4000
/** The corrections proposed and not approved yet that are remembered: the oldest is forgotten. */
const MAX_PENDING_CORRECTIONS = 20

export type Deliverables = {
  /** The kinds Octo ships with, then the ones the PM defined for this project. */
  catalog(project: Project): Promise<DeliverableKind[]>
  /** Keeps a kind the PM defined in words; one with the same title is replaced. */
  saveKind(project: Project, input: OwnKindInput): Promise<DeliverableKind>
  /** Forgets a kind the PM defined. The ones Octo ships with cannot be removed. */
  removeKind(project: Project, kindId: string): Promise<void>
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
  /**
   * Has Claude write again how a kind of Octo is written, as the PM asks in words. Nothing
   * changes until the PM approves what is shown.
   */
  correctKind(project: Project, kindId: string, words: string): Promise<KindCorrection>
  /** Keeps in the project the instructions a correction proposed, as the PM was shown them. */
  approveKindCorrection(project: Project, kindId: string, correctionId: string): Promise<void>
  /** Goes back to the instructions the kind travels with. */
  restoreKind(project: Project, kindId: string): Promise<void>
  /** The formats each kind has a template in, for the kinds that have one. */
  templates(project: Project): Promise<Record<string, TemplateFormat[]>>
  /**
   * Keeps a file as the template of a kind in its format; null takes it away. A Word template
   * gives the kind its sections and its paper, a presentation the slides to fill.
   */
  setKindTemplate(
    project: Project,
    kindId: string,
    format: TemplateFormat,
    bytes: Uint8Array | null,
  ): Promise<void>
  /** Whether the project has a letterhead its Word files are written on. */
  hasLetterhead(project: Project): Promise<boolean>
  /** Keeps a Word document as the letterhead of the project; null goes back to plain files. */
  setLetterhead(project: Project, bytes: Uint8Array | null): Promise<void>
  /** Whether the project has a deck its slides are written on. */
  hasDeckModel(project: Project): Promise<boolean>
  /** Keeps a presentation as the deck of the project; null: no slides are written. */
  setDeckModel(project: Project, bytes: Uint8Array | null): Promise<void>
}

const TITLE_FIELDS = ['tema', 'periodo', 'riunione'] as const
const MARKDOWN = 'md'
const WORD = 'docx'
const DECK = 'pptx'

export function createDeliverables(deps: DeliverablesDeps): Deliverables {
  const running = new Set<string>()

  async function ownKinds(project: Project): Promise<DeliverableKind[]> {
    const paths = await deps.files.under(project.folder, OWN_KINDS_FOLDER)
    const kinds: DeliverableKind[] = []
    for (const path of paths.filter((candidate) => candidate.endsWith('.json'))) {
      const text = await deps.files.readText(project.folder, path)
      if (text !== null) kinds.push(JSON.parse(text) as DeliverableKind)
    }
    return kinds.sort((a, b) => a.title.localeCompare(b.title))
  }

  /** A kind of Octo as this project writes it: with the instructions its PM corrected, if any. */
  async function asCorrected(project: Project, kind: DeliverableKind): Promise<DeliverableKind> {
    const text = await deps.files.readText(project.folder, correctedKindPath(kind.id))
    const instructions = text?.trim() ?? ''
    return instructions === '' ? kind : { ...kind, instructions, corrected: true }
  }

  const catalog = async (project: Project): Promise<DeliverableKind[]> => [
    ...(await Promise.all((await deps.shipped.kinds()).map((kind) => asCorrected(project, kind)))),
    ...(await ownKinds(project)),
  ]

  /** What each correction proposed, as the PM was shown it: an approval writes this and no more. */
  const corrections = new Map<string, KindCorrection>()

  /** A kind of Octo: the ones the PM defined are changed in their own form, not corrected. */
  async function shippedKind(project: Project, kindId: string): Promise<DeliverableKind> {
    const kind = await kindOf(project, kindId)
    if (isOwnKind(kind.id)) throw new DomainError('deliverable_kind_unknown', kindId)
    return kind
  }

  async function writeCorrected(project: Project, kindId: string, text: string): Promise<void> {
    await deps.memory.claim(project.folder)
    await deps.memory.write(project.folder, correctedKindPath(kindId), text)
  }

  async function kindOf(project: Project, kindId: string): Promise<DeliverableKind> {
    const kind = (await catalog(project)).find((candidate) => candidate.id === kindId)
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
    const path = projectInstructionsPath((await kindOf(project, kindId)).id)
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

  /**
   * A draft written as slides, made to fit the outline of the model: its text is the slides as a
   * person reads them, and what the code had to mend is told among what is missing.
   */
  function onOutline(
    title: string,
    outline: DeckOutline,
    draft: DeliverableDraft,
  ): DeliverableDraft {
    const { deck, problems } = fitDeckDraft(outline, draft.deck ?? { slides: [] })
    return {
      ...draft,
      deck,
      text: deckMarkdown(title, outline, deck),
      missing: [...draft.missing, ...problems.map(deckProblemText)],
    }
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
    const kind = await kindOf(project, deliverable.kindId)
    const startedAt = deps.clock.now()
    const previous = deliverable.written
    try {
      const chosen = await deps.models?.(project)
      const models: NonNullable<Deliverable['models']> = { write: null, review: null }
      // With a model deck the draft is its slides for the period: the outline is the structure.
      const deckModel = await deckModelOf(project, kind)
      const outline = deckModel
        ? await deps.renderer.deckOutline(await deps.files.read(project.folder, deckModel))
        : null
      // A Word template of the kind gives the draft its sections, when it is not written as slides.
      const wordTemplate = outline ? null : await templateOf(project, kind.id, 'docx')
      const sections = wordTemplate
        ? await deps.renderer.wordOutline(await deps.files.read(project.folder, wordTemplate))
        : []
      const given = await deps.writer.draft({
        projectFolder: project.folder,
        kind,
        ...(outline ? { deckOutline: outline } : {}),
        ...(sections.length > 0 ? { sectionOutline: sections } : {}),
        model: chosen?.write ?? null,
        liveSources: (await deps.liveSources?.(project)) ?? [],
        onModel: (used) => {
          models.write = used
        },
        projectInstructions: (await instructions(project, kind.id)) || null,
        inputs: deliverable.inputs,
        revision: previous && request ? { draft: previous, request } : null,
        ...(onProgress ? { onProgress } : {}),
      })
      const written = outline && given.deck ? onOutline(deliverable.title, outline, given) : given
      // Numbers only the code may compute are put in the text before anything is checked.
      const text = kind.calculation ? withEstimate(written.text, written.wbs ?? []) : written.text
      const checked = await check(project, { ...written, text })
      const redTeam = await deps.writer.redTeam({
        projectFolder: project.folder,
        kind,
        text: withoutMarkers(checked.text),
        model: chosen?.review ?? null,
        onModel: (used) => {
          models.review = used
        },
      })
      const readyAt = deps.clock.now()
      return {
        ...deliverable,
        status: 'review',
        draft: checked,
        written,
        redTeam,
        models,
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

  /** The title and the day of the imported meeting the PM chose; null when none was chosen. */
  async function meetingTitle(
    project: Project,
    kind: DeliverableKind,
    inputs: Readonly<Record<string, string>>,
  ): Promise<string | null> {
    for (const field of kind.fields) {
      const folder = inputs[field.key] ?? ''
      if (field.kind !== 'meeting' || !folder.startsWith(`${MEETINGS_FOLDER}/`)) continue
      const path = `${folder}/${MEETING_META_FILE}`
      const meta = await deps.files.readText(project.folder, path)
      const meeting = meta === null ? null : parseMeetingMeta(path, meta)
      if (meeting) return `${meeting.title} · ${romeDateString(new Date(meeting.started))}`
    }
    return null
  }

  async function start(project: Project, input: StartInput): Promise<Deliverable> {
    const kind = await kindOf(project, input.kindId)
    const inputs = cleanInputs(kind, input.inputs)
    await deps.memory.claim(project.folder)
    const title =
      (await meetingTitle(project, kind, inputs)) ??
      TITLE_FIELDS.map((key) => inputs[key]).find(Boolean) ??
      kind.title
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
    const kind = await kindOf(project, approved.kindId)
    // The paper of the kind comes before the paper of the project.
    const paper =
      (await templateOf(project, kind.id, 'docx')) ??
      ((await hasLetterhead(project)) ? LETTERHEAD_PATH : null)
    const letterhead = paper ? await deps.files.read(project.folder, paper) : undefined
    await deps.memory.writeBytes(
      project.folder,
      word,
      await deps.renderer.word(approved.title, text, letterhead),
    )
    const files = [markdown, word]
    const deckModel = await deckModelOf(project, kind)
    if (deckModel) {
      const deck = `${APPROVED_FOLDER}/${approvedFileName(approved, DECK)}`
      const model = await deps.files.read(project.folder, deckModel)
      const slides = current.written?.deck
      await deps.memory.writeBytes(
        project.folder,
        deck,
        // Written on the outline of the model: its slides are filled. Else one slide per section.
        slides
          ? await deps.renderer.fillDeck(model, mapDeckStrings(slides, withoutMarkers))
          : await deps.renderer.deck(approved.title, text, model),
      )
      files.push(deck)
    }
    if (kind.memoryPage !== undefined) {
      // Only now, approved, the page is memory: answers and drafts read it first from here on.
      const page = memoryPagePath(kind.memoryPage)
      const citations = current.draft.citations
      const kept = memoryPageMarkdown(kind.title, text, citations, approved.approvedAt ?? '')
      await deps.memory.write(project.folder, page, kept)
      files.push(page)
    }
    const done = { ...approved, files }
    await save(project, done)
    await deps.memory.write(
      project.folder,
      REGISTER_PATH,
      registerMarkdown(await list(project), await catalog(project)),
    )
    return done
  }

  async function hasModel(project: Project, path: string): Promise<boolean> {
    const folder = path.slice(0, path.lastIndexOf('/'))
    return (await deps.files.under(project.folder, folder)).includes(path)
  }
  const hasLetterhead = (project: Project) => hasModel(project, LETTERHEAD_PATH)
  const hasDeckModel = (project: Project) => hasModel(project, DECK_MODEL_PATH)

  /** The template of a kind in a format, as a path of the project; null when it has none. */
  async function templateOf(
    project: Project,
    kindId: string,
    format: TemplateFormat,
  ): Promise<string | null> {
    const path = kindTemplatePath(kindId, format)
    return (await hasModel(project, path)) ? path : null
  }

  /**
   * The presentation a kind is written on: its own, else the one of the project when the kind is
   * one that is shown to an audience. Null: the kind is not written as slides.
   */
  async function deckModelOf(project: Project, kind: DeliverableKind): Promise<string | null> {
    const own = await templateOf(project, kind.id, 'pptx')
    if (own) return own
    return kind.deck && (await hasDeckModel(project)) ? DECK_MODEL_PATH : null
  }

  async function templates(project: Project): Promise<Record<string, TemplateFormat[]>> {
    const found: Record<string, TemplateFormat[]> = {}
    for (const path of await deps.files.under(project.folder, KIND_TEMPLATES_FOLDER)) {
      const name = path.slice(path.lastIndexOf('/') + 1)
      const format = templateFormatOf(name)
      if (format === null) continue
      const kindId = name.slice(0, -(format.length + 1))
      found[kindId] = [...(found[kindId] ?? []), format].sort()
    }
    return found
  }

  async function setKindTemplate(
    project: Project,
    kindId: string,
    format: TemplateFormat,
    bytes: Uint8Array | null,
  ): Promise<void> {
    const path = kindTemplatePath((await kindOf(project, kindId)).id, format)
    if (bytes === null) return deps.files.remove(project.folder, path)
    if (format === 'docx') await deps.renderer.checkLetterhead(bytes)
    else await deps.renderer.checkDeckModel(bytes)
    await deps.memory.claim(project.folder)
    await deps.memory.writeBytes(project.folder, path, bytes)
  }

  async function setDeckModel(project: Project, bytes: Uint8Array | null): Promise<void> {
    if (bytes === null) return deps.files.remove(project.folder, DECK_MODEL_PATH)
    await deps.renderer.checkDeckModel(bytes)
    await deps.memory.claim(project.folder)
    await deps.memory.writeBytes(project.folder, DECK_MODEL_PATH, bytes)
  }

  async function setLetterhead(project: Project, bytes: Uint8Array | null): Promise<void> {
    if (bytes === null) return deps.files.remove(project.folder, LETTERHEAD_PATH)
    await deps.renderer.checkLetterhead(bytes)
    await deps.memory.claim(project.folder)
    await deps.memory.writeBytes(project.folder, LETTERHEAD_PATH, bytes)
  }

  return {
    catalog,
    saveKind: async (project, input) => {
      const kind = ownKind(input)
      await deps.memory.claim(project.folder)
      await deps.memory.write(project.folder, ownKindPath(kind.id), JSON.stringify(kind, null, 2))
      return kind
    },
    removeKind: async (project, kindId) => {
      if (!isOwnKind(kindId)) throw new DomainError('deliverable_kind_unknown', kindId)
      // The templates of a kind go with it: another kind of the same name starts without.
      for (const format of TEMPLATE_FORMATS) {
        if (await templateOf(project, kindId, format)) {
          await deps.files.remove(project.folder, kindTemplatePath(kindId, format))
        }
      }
      await deps.files.remove(project.folder, ownKindPath(kindId))
    },
    list,
    get,
    start,
    revise,
    approve,
    instructions,
    templates,
    setKindTemplate,
    hasLetterhead,
    setLetterhead,
    hasDeckModel,
    setDeckModel,
    async correctKind(project, kindId, words) {
      const asked = words.trim().slice(0, MAX_CORRECTION_WORDS)
      if (asked === '') throw new DomainError('request_empty')
      const kind = await shippedKind(project, kindId)
      const chosen = await deps.models?.(project)
      const draft = await deps.writer.correctKind({
        projectFolder: project.folder,
        kind,
        words: asked,
        model: chosen?.write ?? null,
      })
      const instructions = draft.instructions.trim()
      if (instructions === '') throw new DomainError('agent_output_invalid')
      const id = deps.ids.next()
      const correction = { id, kindId, instructions, summary: draft.summary.trim() }
      corrections.set(correction.id, correction)
      if (corrections.size > MAX_PENDING_CORRECTIONS)
        corrections.delete(corrections.keys().next().value as string)
      return correction
    },
    async approveKindCorrection(project, kindId, correctionId) {
      await shippedKind(project, kindId)
      const correction = corrections.get(correctionId)
      if (correction === undefined || correction.kindId !== kindId)
        throw new DomainError('work_not_found')
      await writeCorrected(project, kindId, `${correction.instructions}\n`)
      corrections.delete(correctionId)
    },
    async restoreKind(project, kindId) {
      await writeCorrected(project, (await shippedKind(project, kindId)).id, '')
    },
    saveInstructions: async (project, kindId, text) => {
      const path = projectInstructionsPath((await kindOf(project, kindId)).id)
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
