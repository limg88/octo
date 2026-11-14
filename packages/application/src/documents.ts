import {
  DomainError,
  EXTRACTED_TEXT_FOLDER,
  extractedDocument,
  extractedTextPath,
  isCurrentText,
  isDomainError,
  type Project,
  type SourceFileStamp,
  type SourceRun,
  type SourceState,
  sourcePathOf,
} from '@octo/domain'
import type { Clock, MemoryWriter, ProjectFiles, SourceStates, TextExtractor } from './ports.ts'

export type DocumentsDeps = {
  files: ProjectFiles
  extractor: TextExtractor
  writer: MemoryWriter
  states: SourceStates
  clock: Clock
}

export type Documents = {
  state(project: Project): Promise<SourceState>
  /**
   * Writes the text of every Office and PDF file of the project beside it, so the agent can
   * search and quote it. A file already converted and not changed since is left alone; the text
   * of a file that is gone is removed. One conversion per project at a time.
   */
  convert(project: Project): Promise<SourceRun>
}

/** A larger file is not a document a PM reads: it is left out. */
export const MAX_DOCUMENT_BYTES = 100 * 1024 * 1024

export function createDocuments(deps: DocumentsDeps): Documents {
  const running = new Set<string>()

  async function convertOne(project: Project, stamp: SourceFileStamp): Promise<keyof Counts> {
    const target = extractedTextPath(stamp.path)
    const existing = await deps.files.readText(project.folder, target)
    if (existing !== null && isCurrentText(existing, stamp, deps.extractor.version)) {
      return 'unchanged'
    }
    const bytes = await deps.files.read(project.folder, stamp.path)
    const extraction = await deps.extractor.extract(bytes, stamp.path)
    await deps.writer.write(project.folder, target, extractedDocument(stamp, extraction))
    return 'written'
  }

  async function removeOrphans(project: Project, sources: ReadonlySet<string>): Promise<void> {
    for (const textPath of await deps.files.under(project.folder, EXTRACTED_TEXT_FOLDER)) {
      const source = sourcePathOf(textPath)
      if (source !== null && !sources.has(source)) {
        await deps.files.remove(project.folder, textPath)
      }
    }
  }

  async function run(project: Project): Promise<Counts> {
    const all = await deps.files.withExtensions(project.folder, deps.extractor.extensions)
    const stamps = all.filter((stamp) => stamp.size <= MAX_DOCUMENT_BYTES)
    const counts: Counts = { written: 0, unchanged: 0 }
    for (const stamp of stamps) {
      counts[await convertOne(project, stamp)] += 1
    }
    await removeOrphans(project, new Set(stamps.map((stamp) => stamp.path)))
    return counts
  }

  async function convert(project: Project): Promise<SourceRun> {
    if (running.has(project.id)) throw new DomainError('source_busy', 'documents')
    running.add(project.id)
    const at = deps.clock.now().toISOString()
    try {
      const outcome: SourceRun = { at, ...(await run(project)), error: null }
      await deps.states.set(project.id, 'documents', { cursor: at, lastRun: outcome })
      return outcome
    } catch (error) {
      if (!isDomainError(error)) throw error
      const outcome: SourceRun = { at, written: 0, unchanged: 0, error: error.code }
      await deps.states.set(project.id, 'documents', { cursor: null, lastRun: outcome })
      return outcome
    } finally {
      running.delete(project.id)
    }
  }

  return { state: (project) => deps.states.get(project.id, 'documents'), convert }
}

type Counts = Pick<SourceRun, 'written' | 'unchanged'>
