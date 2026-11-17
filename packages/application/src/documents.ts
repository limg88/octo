import {
  EXTRACTED_TEXT_FOLDER,
  extractedDocument,
  extractedTextPath,
  isCurrentText,
  type Project,
  type SourceFileStamp,
  type SourceRun,
  sourcePathOf,
} from '@octo/domain'
import type { MemoryWriter, ProjectFiles, TextExtractor } from './ports.ts'
import type { ReadingCounts, ReadingOptions, Readings, ReadingView } from './readings.ts'

export type DocumentsDeps = {
  files: ProjectFiles
  extractor: TextExtractor
  writer: MemoryWriter
  /** The turns of the readings, between the computers that share the folder of a project. */
  readings: Readings
}

export type Documents = {
  /** The last conversion, of this computer or of whoever shares the folder, and who converts now. */
  state(project: Project): Promise<ReadingView>
  /**
   * Writes the text of every Office and PDF file of the project beside it, so the agent can
   * search and quote it. A file already converted and not changed since is left alone; the text
   * of a file that is gone is removed. One conversion per project at a time, on every computer
   * that shares the folder.
   */
  convert(project: Project, options?: ReadingOptions): Promise<SourceRun>
}

/** A larger file is not a document a PM reads: it is left out. */
export const MAX_DOCUMENT_BYTES = 100 * 1024 * 1024

export function createDocuments(deps: DocumentsDeps): Documents {
  async function convertOne(
    project: Project,
    stamp: SourceFileStamp,
  ): Promise<keyof ReadingCounts> {
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

  async function run(project: Project): Promise<ReadingCounts> {
    const all = await deps.files.withExtensions(project.folder, deps.extractor.extensions)
    const stamps = all.filter((stamp) => stamp.size <= MAX_DOCUMENT_BYTES)
    const counts: ReadingCounts = { written: 0, unchanged: 0 }
    for (const stamp of stamps) {
      counts[await convertOne(project, stamp)] += 1
    }
    await removeOrphans(project, new Set(stamps.map((stamp) => stamp.path)))
    return counts
  }

  const convert = (project: Project, options: ReadingOptions = {}): Promise<SourceRun> =>
    deps.readings.run(project, { source: 'documents' }, options, async () => ({
      ...(await run(project)),
      cursor: null,
    }))

  return { state: (project) => deps.readings.view(project, 'documents'), convert }
}
