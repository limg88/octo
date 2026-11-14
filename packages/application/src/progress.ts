import {
  cleanProgressSettings,
  computeProgress,
  DomainError,
  isDomainError,
  OCTO_FOLDER,
  type ProgressComputation,
  type ProgressSettings,
  type ProgressWarning,
  type Project,
  progressFormCells,
  progressWarnings,
} from '@octo/domain'
import type {
  MemoryWriter,
  ProgressSettingsStore,
  ProjectFiles,
  SpreadsheetModel,
} from './ports.ts'

export type ProgressDeps = {
  settings: ProgressSettingsStore
  files: ProjectFiles
  sheets: SpreadsheetModel
  writer: MemoryWriter
}

/** Where Octo puts the filled forms. The empty form is never touched. */
export const PROGRESS_FOLDER = `${OCTO_FOLDER}/avanzamento`

export type ProgressView = { computation: ProgressComputation; warnings: ProgressWarning[] }
/** A filled form, as a path from the project folder. */
export type ProgressFile = { n: number; path: string }

export type Progress = {
  settings(project: Project): Promise<ProgressSettings>
  saveSettings(project: Project, settings: ProgressSettings): Promise<ProgressSettings>
  /** Spreadsheets of the project that look like the form of the client. */
  candidates(project: Project): Promise<string[]>
  /** The share of each position after each request, computed and not written. */
  view(project: Project): Promise<ProgressView>
  /** Writes the form of one request. */
  compile(project: Project, n: number): Promise<ProgressFile>
}

const MODEL_EXTENSION = 'xlsx'
const MODEL_NAME = /sal\b|stato.*avanzamento|richiesta|modulo/i
const MAX_CANDIDATES = 10

/** A place inside the project: never an absolute path, never one that climbs out. */
function checkedPath(path: string): string {
  const parts = path.split(/[\\/]/)
  if (path.startsWith('/') || /^[a-z]:/i.test(path) || parts.includes('..')) {
    throw new DomainError('progress_settings_invalid', path)
  }
  return parts.filter((part) => part !== '' && part !== '.').join('/')
}

/** `Moduli/Richiesta.xlsx` and request 2 give `Richiesta - 2.xlsx`. */
function fileName(modelPath: string, n: number): string {
  const name = modelPath.split('/').pop() ?? modelPath
  return `${name.replace(/\.[^.]+$/, '')} - ${n}.${MODEL_EXTENSION}`
}

export function createProgress(deps: ProgressDeps): Progress {
  return {
    settings: (project) => deps.settings.load(project.folder),

    async saveSettings(project, settings) {
      const clean = cleanProgressSettings(settings)
      const saved = { ...clean, modelPath: checkedPath(clean.modelPath) }
      await deps.settings.save(project.folder, saved)
      return saved
    },

    async candidates(project) {
      const stamps = await deps.files.withExtensions(project.folder, [MODEL_EXTENSION])
      return stamps
        .map((stamp) => stamp.path)
        .filter((path) => MODEL_NAME.test(path))
        .sort()
        .slice(0, MAX_CANDIDATES)
    },

    async view(project) {
      const settings = await deps.settings.load(project.folder)
      return {
        computation: computeProgress(settings.positions, settings.requests),
        warnings: progressWarnings(settings),
      }
    },

    async compile(project, n) {
      const settings = await deps.settings.load(project.folder)
      if (settings.modelPath === '') throw new DomainError('progress_model_not_set')
      const computation = computeProgress(settings.positions, settings.requests)
      if (!computation.ok) throw new DomainError('progress_not_computable')
      const index = computation.steps.findIndex((step) => step.request.n === n)
      const step = computation.steps[index]
      if (step === undefined) throw new DomainError('progress_request_missing', String(n))
      const previousTo = computation.steps[index - 1]?.request.to ?? step.request.from
      const cells = progressFormCells(settings, step, previousTo)
      if (!cells.ok) throw new DomainError('progress_not_computable', cells.problem.kind)
      const path = checkedPath(settings.modelPath)
      let bytes: Uint8Array
      try {
        bytes = await deps.files.read(project.folder, path)
      } catch {
        throw new DomainError('progress_model_missing', path)
      }
      let filled: Uint8Array
      try {
        filled = deps.sheets.fill(bytes, cells.writes)
      } catch (error) {
        // Not a spreadsheet, or the map names a row the form does not have.
        if (isDomainError(error)) throw new DomainError('progress_model_invalid')
        throw error
      }
      const target = `${PROGRESS_FOLDER}/${fileName(path, n)}`
      await deps.writer.claim(project.folder)
      await deps.writer.writeBytes(project.folder, target, filled)
      return { n, path: target }
    },
  }
}
