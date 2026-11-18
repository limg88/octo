import { OCTO_FOLDER } from '../extracted-document.ts'
import type { ForecastCell } from '../forecast/compile.ts'
import { DELIVERABLES_FOLDER } from './deliverable.ts'

/**
 * A deliverable of the project made by a script: its instructions, its script and its data are
 * files of the project, which the PM corrects in words and Claude runs inside its fence. The
 * folder is hidden: what it holds are settings, not sources to cite.
 */
export const SCRIPTED_FOLDER = `${OCTO_FOLDER}/.deliverable`
export const SCRIPTED_MANIFEST = 'deliverable.json'
export const SCRIPTED_SCRIPT = 'script.py'
export const SCRIPTED_CONFIG = 'config.json'
export const SCRIPTED_INSTRUCTIONS = 'istruzioni.md'
/** What a correction in words may change: never the manifest, which says what Octo hands over. */
export const SCRIPTED_CORRECTABLE = [SCRIPTED_SCRIPT, SCRIPTED_CONFIG, SCRIPTED_INSTRUCTIONS]
/** What Octo lays in the work folder of a run beside the files of the deliverable. */
export const SCRIPTED_PARAMETERS = 'parametri.json'
export const SCRIPTED_INPUTS = 'ingressi'
export const SCRIPTED_RESULT = 'esito.json'
/** The only folder of a run whose files are a result: what the PM may keep. */
export const SCRIPTED_OUTPUT = 'uscita'

/** Where what the PM keeps of a scripted deliverable goes, one folder per deliverable. */
export const scriptedKeptFolder = (slug: string): string => `${DELIVERABLES_FOLDER}/${slug}`
export const scriptedFolder = (slug: string): string => `${SCRIPTED_FOLDER}/${slug}`

/**
 * What Octo prepares for a script with the readers it already has, so a script never parses a
 * tracker by itself. `tracker`: the items of the client's tracker export (empty path: the one
 * the dashboard reads). `records`: the items a feed wrote in a folder (empty: the Jira feed's).
 */
export type ScriptedInput =
  | { kind: 'tracker'; path: string; ownPeopleOnly: boolean }
  | { kind: 'records'; folder: string }

export type ScriptedParameter = { name: string; label: string }

export type ScriptedManifest = {
  title: string
  about: string
  /** What the PM is asked at every run; each reaches the script as a text, by its name. */
  parameters: ScriptedParameter[]
  inputs: Record<string, ScriptedInput>
}

const NAME = /^[a-z][a-z0-9_-]{0,39}$/
const CELL = /^[A-Z]{1,3}[1-9][0-9]{0,6}$/
const MAX_WRITES = 5000
const MAX_FILES = 50

/** True for a name a deliverable, a parameter or an input may have: it becomes a file name. */
export const isScriptedName = (name: string): boolean => NAME.test(name)

type Json = Record<string, unknown>
const isObject = (value: unknown): value is Json =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const text = (value: unknown): string => (typeof value === 'string' ? value : '')
const texts = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []

function inputOf(value: unknown): ScriptedInput | null {
  if (!isObject(value)) return null
  if (value.kind === 'tracker') {
    return { kind: 'tracker', path: text(value.path), ownPeopleOnly: value.ownPeopleOnly === true }
  }
  return value.kind === 'records' ? { kind: 'records', folder: text(value.folder) } : null
}

/** The manifest of a scripted deliverable as its file says it; null for what is not one. */
export function parseScriptedManifest(value: unknown): ScriptedManifest | null {
  if (!isObject(value) || text(value.title).trim() === '') return null
  const inputs: Record<string, ScriptedInput> = {}
  for (const [name, entry] of Object.entries(isObject(value.inputs) ? value.inputs : {})) {
    const input = inputOf(entry)
    if (input === null || !isScriptedName(name)) return null
    inputs[name] = input
  }
  const parameters = (Array.isArray(value.parameters) ? value.parameters : []).flatMap((entry) =>
    isObject(entry) && isScriptedName(text(entry.name))
      ? [{ name: text(entry.name), label: text(entry.label) || text(entry.name) }]
      : [],
  )
  return { title: text(value.title).trim(), about: text(value.about).trim(), parameters, inputs }
}

/** A spreadsheet of the project to fill with what the script computed: Octo writes the cells. */
export type ScriptedFill = {
  /** The empty model, a path from the project folder. */
  model: string
  /** The filled copy, a file of the output folder of the run. */
  output: string
  writes: Array<{ ref: string; cell: ForecastCell }>
}

/** What a script tells Octo when it ends: whether it went well, what to say, what it wrote. */
export type ScriptedResult = {
  ok: boolean
  messages: string[]
  /** Files of the output folder of the run, as `uscita/<name>`. */
  files: string[]
  fill: ScriptedFill | null
}

/** A file a run may hand over: inside its output folder, never climbing out of it. */
const isOutput = (path: string): boolean =>
  path.startsWith(`${SCRIPTED_OUTPUT}/`) &&
  !path.split('/').some((part) => part === '..' || part === '' || part === '.')

function cellOf(value: unknown): ForecastCell | null {
  if (!isObject(value)) return null
  if (value.kind === 'empty') return { kind: 'empty' }
  if (value.kind === 'text' && typeof value.value === 'string') {
    return { kind: 'text', value: value.value }
  }
  if (value.kind === 'number' && typeof value.value === 'number' && Number.isFinite(value.value)) {
    return {
      kind: 'number',
      value: value.value,
      ...(value.percent === true ? { percent: true } : {}),
    }
  }
  return null
}

function fillOf(value: unknown): ScriptedFill | null {
  if (!isObject(value) || !Array.isArray(value.writes) || value.writes.length > MAX_WRITES) {
    return null
  }
  const writes = value.writes.flatMap((entry) => {
    const cell = isObject(entry) ? cellOf(entry.cell) : null
    const ref = isObject(entry) ? text(entry.ref) : ''
    return cell !== null && CELL.test(ref) ? [{ ref, cell }] : []
  })
  const [model, output] = [text(value.model), text(value.output)]
  const whole = writes.length === value.writes.length && model !== '' && isOutput(output)
  return whole ? { model, output, writes } : null
}

/**
 * The result of a script as its file says it; null for what is not one. A file named outside
 * the output folder, a cell that is not one, a value that is not what a cell holds make the
 * whole result unreadable: nothing of it is used.
 */
export function parseScriptedResult(value: unknown): ScriptedResult | null {
  if (!isObject(value) || typeof value.ok !== 'boolean') return null
  const files = texts(value.files)
  if (files.length > MAX_FILES || !files.every(isOutput)) return null
  const fill = value.fill === undefined || value.fill === null ? null : fillOf(value.fill)
  if (fill === null && value.fill !== undefined && value.fill !== null) return null
  return { ok: value.ok, messages: texts(value.messages), files, fill }
}

/** The settings a section kept, as the configuration of the deliverable that takes its place. */
export type ConvertedScripted = { config: unknown; inputs: Record<string, ScriptedInput> | null }

/**
 * What «Avanzamento» kept in `progress.json` is the configuration of the progress form as it
 * is. What «Allineamento» kept in `alignment.json` is split: where the two trackers are read
 * from goes to the inputs Octo prepares, the rest to the configuration of the script.
 */
export function convertedScripted(slug: string, kept: unknown): ConvertedScripted | null {
  if (!isObject(kept)) return null
  if (slug === 'avanzamento') return { config: kept, inputs: null }
  if (slug !== 'allineamento') return null
  const { exportPath, ticketFolder, ownPeopleOnly, ...config } = kept
  return {
    config,
    inputs: {
      voci: { kind: 'tracker', path: text(exportPath), ownPeopleOnly: ownPeopleOnly === true },
      ticket: { kind: 'records', folder: text(ticketFolder) },
    },
  }
}

/** The file of the settings a section kept, by the deliverable that takes its place. */
export const SCRIPTED_KEPT_SETTINGS: Readonly<Record<string, string>> = {
  avanzamento: 'progress.json',
  allineamento: 'alignment.json',
}
