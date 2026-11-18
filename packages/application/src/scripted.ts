import {
  assignedToOwnPeople,
  convertedScripted,
  DomainError,
  isScriptedName,
  type Project,
  type ProjectTeam,
  parseScriptedManifest,
  parseScriptedResult,
  parseTrackerExport,
  SCRIPTED_CONFIG,
  SCRIPTED_CORRECTABLE,
  SCRIPTED_FOLDER,
  SCRIPTED_INPUTS,
  SCRIPTED_KEPT_SETTINGS,
  SCRIPTED_MANIFEST,
  SCRIPTED_OUTPUT,
  SCRIPTED_PARAMETERS,
  SCRIPTED_RESULT,
  type ScriptedInput,
  type ScriptedManifest,
  type ScriptedParameter,
  scriptedFolder,
  scriptedKeptFolder,
} from '@octo/domain'
import type {
  AgentProgress,
  DashboardSettingsStore,
  FeedRecords,
  IdGenerator,
  KeptSettings,
  MemoryWriter,
  ProjectFiles,
  ScriptedTemplates,
  ScriptRunner,
  SourceSettings,
  SpreadsheetModel,
  TrackerExports,
  WorkFolders,
} from './ports.ts'

export type ScriptedDeps = {
  files: ProjectFiles
  writer: MemoryWriter
  work: WorkFolders
  runner: ScriptRunner
  templates: ScriptedTemplates
  ids: IdGenerator
  sheets: SpreadsheetModel
  /** What the sections that became deliverables kept: read once, to start from it. */
  kept: KeptSettings
  exports: TrackerExports
  dashboard: Pick<DashboardSettingsStore, 'load'>
  sources: Pick<SourceSettings, 'load'>
  records: FeedRecords
  team?: (project: Project) => Promise<ProjectTeam>
}

/** A deliverable with a script, as the PM chooses it: of the project, or one the app ships. */
export type ScriptedSummary = {
  slug: string
  title: string
  about: string
  parameters: ScriptedParameter[]
  /** False for one the app ships and the project does not have yet. */
  installed: boolean
}

/** What a run of a script gave: what it said, and the files the PM may keep. */
export type ScriptedRun = {
  runId: string
  ok: boolean
  messages: string[]
  /** The files of the output folder of the run, by name. */
  files: string[]
}
/** A correction asked in words, tried in the work folder and not yet in the project. */
export type ScriptedCorrection = ScriptedRun & {
  summary: string
  /** The files of the deliverable the correction changed. */
  changed: string[]
}
export type ScriptedKept = { folder: string; files: string[] }

export type RunOptions = {
  model?: string | null
  onProgress?: (progress: AgentProgress) => void
  signal?: AbortSignal
}

export type ScriptedDeliverables = {
  /** Those of the project, then those the app ships that the project does not have. */
  list(project: Project): Promise<ScriptedSummary[]>
  /**
   * Starts in the project a deliverable the app ships. Where a section kept its settings
   * (`progress.json`, `alignment.json`) they become its configuration; the files stay.
   */
  install(project: Project, slug: string): Promise<ScriptedSummary[]>
  run(
    project: Project,
    slug: string,
    parameters: Record<string, string>,
    options?: RunOptions,
  ): Promise<ScriptedRun>
  /** Copies into the project the files a run gave: only then are they of the project. */
  keep(project: Project, slug: string, runId: string): Promise<ScriptedKept>
  correct(
    project: Project,
    slug: string,
    words: string,
    options?: RunOptions,
  ): Promise<ScriptedCorrection>
  /** Writes in the project the files a correction changed: from then every run uses them. */
  approve(project: Project, slug: string, runId: string): Promise<void>
}

const decoder = new TextDecoder()
const encoder = new TextEncoder()
const json = (value: unknown): Uint8Array => encoder.encode(JSON.stringify(value, null, 1))
const MAX_WORDS = 4000

/** A place inside the project: never an absolute path, never one that climbs out. */
function checkedPath(path: string): string {
  const parts = path.split(/[\\/]/)
  if (path.startsWith('/') || /^[a-z]:/i.test(path) || parts.includes('..')) {
    throw new DomainError('scripted_invalid', path)
  }
  return parts.filter((part) => part !== '' && part !== '.').join('/')
}

export function createScriptedDeliverables(deps: ScriptedDeps): ScriptedDeliverables {
  const parsed = (bytes: Uint8Array): unknown => {
    try {
      return JSON.parse(decoder.decode(bytes))
    } catch {
      return null
    }
  }

  async function manifestOf(project: Project, slug: string): Promise<ScriptedManifest> {
    if (!isScriptedName(slug)) throw new DomainError('scripted_not_found', slug)
    const text = await deps.files.readText(
      project.folder,
      `${scriptedFolder(slug)}/${SCRIPTED_MANIFEST}`,
    )
    if (text === null) throw new DomainError('scripted_not_found', slug)
    const manifest = parseScriptedManifest(parsed(encoder.encode(text)))
    if (manifest === null) throw new DomainError('scripted_invalid', slug)
    return manifest
  }

  /** The slugs of the deliverables the project has: the folders that hold a manifest. */
  async function installed(project: Project): Promise<string[]> {
    const paths = await deps.files.under(project.folder, SCRIPTED_FOLDER).catch(() => [])
    return paths
      .filter((path) => path.endsWith(`/${SCRIPTED_MANIFEST}`))
      .map((path) => path.slice(SCRIPTED_FOLDER.length + 1, -SCRIPTED_MANIFEST.length - 1))
      .filter(isScriptedName)
      .sort()
  }

  async function list(project: Project): Promise<ScriptedSummary[]> {
    const own = await installed(project)
    const summaries: ScriptedSummary[] = []
    for (const slug of own) {
      const manifest = await manifestOf(project, slug).catch(() => null)
      if (manifest) summaries.push({ slug, ...manifest, installed: true })
    }
    for (const slug of (await deps.templates.slugs()).filter((name) => !own.includes(name))) {
      const file = (await deps.templates.files(slug)).find(
        (entry) => entry.name === SCRIPTED_MANIFEST,
      )
      const manifest = file ? parseScriptedManifest(parsed(file.content)) : null
      if (manifest) summaries.push({ slug, ...manifest, installed: false })
    }
    return summaries.map(({ slug, title, about, parameters, installed: has }) => ({
      slug,
      title,
      about,
      parameters,
      installed: has,
    }))
  }

  /** What Octo hands a script: read with the readers the dashboard and the feeds use. */
  async function inputOf(project: Project, name: string, input: ScriptedInput): Promise<unknown> {
    if (input.kind === 'records') {
      const folder = input.folder || (await deps.sources.load(project.folder)).jira?.targetFolder
      if (!folder) throw new DomainError('scripted_input_missing', name)
      return deps.records.under(project.folder, checkedPath(folder))
    }
    const path = input.path || (await deps.dashboard.load(project.folder)).exportPath
    if (path === '') throw new DomainError('scripted_input_missing', name)
    const raw = await deps.exports.readJson(project.folder, checkedPath(path))
    const exported = raw === null ? null : parseTrackerExport(raw)
    if (exported === null) throw new DomainError('scripted_input_missing', name)
    const items =
      input.ownPeopleOnly && deps.team
        ? assignedToOwnPeople(exported.items, await deps.team(project))
        : exported.items
    return { exportedAt: exported.exportedAt, items }
  }

  /** A work folder with the deliverable as the project has it, and what it is to be given. */
  async function laidOut(
    project: Project,
    slug: string,
    parameters: Record<string, string>,
  ): Promise<{ runId: string; workFolder: string }> {
    const manifest = await manifestOf(project, slug)
    const runId = deps.ids.next()
    const workFolder = await deps.work.create(project.id, runId)
    const put = (name: string, content: Uint8Array) =>
      deps.work.write(project.id, runId, name, content)
    for (const name of SCRIPTED_CORRECTABLE) {
      const path = `${scriptedFolder(slug)}/${name}`
      const text = await deps.files.readText(project.folder, path)
      if (text !== null) await put(name, encoder.encode(text))
    }
    const asked = Object.fromEntries(
      manifest.parameters.map(({ name }) => [name, (parameters[name] ?? '').trim()]),
    )
    await put(SCRIPTED_PARAMETERS, json(asked))
    for (const [name, input] of Object.entries(manifest.inputs)) {
      await put(`${SCRIPTED_INPUTS}/${name}.json`, json(await inputOf(project, name, input)))
    }
    return { runId, workFolder }
  }

  /** What the script left: its result read and checked, the model filled by Octo when asked. */
  async function outcome(project: Project, runId: string): Promise<ScriptedRun> {
    const left = await deps.work.read(project.id, runId, SCRIPTED_RESULT).catch(() => null)
    const result = left === null ? null : parseScriptedResult(parsed(left))
    if (result === null) throw new DomainError('scripted_result_invalid')
    if (result.ok && result.fill !== null) {
      const model = checkedPath(result.fill.model)
      let bytes: Uint8Array
      try {
        bytes = await deps.files.read(project.folder, model)
      } catch {
        throw new DomainError('scripted_model_missing', model)
      }
      // The form is somebody else's: only Octo writes in it, cell by cell, and keeps the rest.
      const filled = deps.sheets.fill(bytes, result.fill.writes)
      await deps.work.write(project.id, runId, result.fill.output, filled)
    }
    const files = (await deps.work.files(project.id, runId))
      .filter((name) => name.startsWith(`${SCRIPTED_OUTPUT}/`))
      .map((name) => name.slice(SCRIPTED_OUTPUT.length + 1))
    return { runId, ok: result.ok, messages: result.messages, files: result.ok ? files : [] }
  }

  return {
    list,

    async install(project, slug) {
      const files = isScriptedName(slug) ? await deps.templates.files(slug) : []
      if (files.length === 0) throw new DomainError('scripted_not_found', slug)
      if ((await installed(project)).includes(slug)) return list(project)
      const keptFile = SCRIPTED_KEPT_SETTINGS[slug]
      const kept = keptFile ? await deps.kept.read(project.folder, keptFile) : null
      const converted = kept === null ? null : convertedScripted(slug, kept)
      await deps.writer.claim(project.folder)
      for (const file of files) {
        let content = file.content
        if (file.name === SCRIPTED_MANIFEST && converted?.inputs) {
          content = json({ ...(parsed(file.content) as object), inputs: converted.inputs })
        }
        // What the section kept is written over what the app ships: a setting it never wrote
        // keeps the value the script expects.
        if (file.name === SCRIPTED_CONFIG && converted) {
          content = json({ ...(parsed(file.content) as object), ...(converted.config as object) })
        }
        const path = `${scriptedFolder(slug)}/${file.name}`
        await deps.writer.writeBytes(project.folder, path, content)
      }
      return list(project)
    },

    async run(project, slug, parameters, options = {}) {
      const { runId, workFolder } = await laidOut(project, slug, parameters)
      await deps.runner.run({ projectFolder: project.folder, workFolder, ...options })
      return outcome(project, runId)
    },

    async keep(project, slug, runId) {
      if (!isScriptedName(slug)) throw new DomainError('scripted_not_found', slug)
      const names = (await deps.work.files(project.id, runId)).filter((name) =>
        name.startsWith(`${SCRIPTED_OUTPUT}/`),
      )
      if (names.length === 0) throw new DomainError('work_not_found')
      const folder = scriptedKeptFolder(slug)
      await deps.writer.claim(project.folder)
      const files: string[] = []
      for (const name of names) {
        const path = `${folder}/${name.slice(SCRIPTED_OUTPUT.length + 1)}`
        await deps.writer.writeBytes(
          project.folder,
          path,
          await deps.work.read(project.id, runId, name),
        )
        files.push(path)
      }
      return { folder, files }
    },

    async correct(project, slug, words, options = {}) {
      const asked = words.trim().slice(0, MAX_WORDS)
      if (asked === '') throw new DomainError('request_empty')
      const { runId, workFolder } = await laidOut(project, slug, {})
      const before = new Map<string, string>()
      for (const name of SCRIPTED_CORRECTABLE) {
        const bytes = await deps.work.read(project.id, runId, name).catch(() => null)
        if (bytes !== null) before.set(name, decoder.decode(bytes))
      }
      const { summary } = await deps.runner.correct({
        projectFolder: project.folder,
        workFolder,
        words: asked,
        ...options,
      })
      const changed: string[] = []
      for (const name of SCRIPTED_CORRECTABLE) {
        const bytes = await deps.work.read(project.id, runId, name).catch(() => null)
        if (bytes !== null && decoder.decode(bytes) !== before.get(name)) changed.push(name)
      }
      return { ...(await outcome(project, runId)), summary, changed }
    },

    async approve(project, slug, runId) {
      await manifestOf(project, slug)
      await deps.writer.claim(project.folder)
      for (const name of SCRIPTED_CORRECTABLE) {
        const bytes = await deps.work.read(project.id, runId, name).catch(() => null)
        if (bytes === null) continue
        await deps.writer.writeBytes(project.folder, `${scriptedFolder(slug)}/${name}`, bytes)
      }
    },
  }
}
