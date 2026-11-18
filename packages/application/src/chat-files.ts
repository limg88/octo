import {
  type ChatAttachment,
  chatFilesFolder,
  DomainError,
  extractedDocument,
  PLAIN_ATTACHMENTS,
  type Project,
} from '@octo/domain'
import { MAX_DOCUMENT_BYTES } from './documents.ts'
import type { Clock, MemoryWriter, ProjectFiles, TextExtractor } from './ports.ts'

export type ChatFilesDeps = {
  files: Pick<ProjectFiles, 'under'>
  /** The readers of documents Octo already has: an attachment is read by them, or refused. */
  extractor: TextExtractor
  writer: MemoryWriter
  clock: Clock
}

/** A file the PM chose on the computer, as it is handed to Octo. */
export type ChosenFile = { name: string; bytes: Uint8Array }

export type ChatFiles = {
  /**
   * Copies a file into the folder of a conversation and makes it readable for who answers: a
   * text as it is, a document through its text. A format Octo does not read is refused.
   */
  attach(project: Project, conversationId: string, file: ChosenFile): Promise<ChatAttachment>
  /** What the PM attached to a conversation, by name. */
  of(project: Project, conversationId: string): Promise<ChatAttachment[]>
}

/** The suffix of the text of a document, beside the document itself. */
const TEXT_SUFFIX = '.md'
const extensionOf = (name: string): string => (name.split('.').pop() ?? '').toLowerCase()
/** The name of a file alone, whatever the system wrote before it. */
const baseName = (name: string): string => (name.split(/[\\/]/).pop() ?? '').trim()

export function createChatFiles(deps: ChatFilesDeps): ChatFiles {
  const plain = (name: string): boolean => PLAIN_ATTACHMENTS.includes(extensionOf(name))
  const document = (name: string): boolean => deps.extractor.extensions.includes(extensionOf(name))

  return {
    async attach(project, conversationId, file) {
      const name = baseName(file.name)
      if (name === '' || !(plain(name) || document(name))) {
        throw new DomainError('attachment_unsupported', extensionOf(name))
      }
      if (file.bytes.length > MAX_DOCUMENT_BYTES) throw new DomainError('attachment_too_large')
      const path = `${chatFilesFolder(conversationId)}/${name}`
      await deps.writer.claim(project.folder)
      await deps.writer.writeBytes(project.folder, path, file.bytes)
      if (plain(name)) return { name, path }
      const stamp = { path, size: file.bytes.length, modifiedAt: deps.clock.now().toISOString() }
      const text = extractedDocument(stamp, await deps.extractor.extract(file.bytes, name))
      await deps.writer.write(project.folder, `${path}${TEXT_SUFFIX}`, text)
      return { name, path: `${path}${TEXT_SUFFIX}` }
    },

    async of(project, conversationId) {
      const folder = chatFilesFolder(conversationId)
      const paths = await deps.files.under(project.folder, folder)
      const known = new Set(paths)
      return paths.flatMap((path): ChatAttachment[] => {
        const name = path.slice(folder.length + 1)
        // The text of a document is how it is read: it is not an attachment of its own.
        if (name.endsWith(TEXT_SUFFIX) && known.has(path.slice(0, -TEXT_SUFFIX.length))) return []
        return [{ name, path: document(name) ? `${path}${TEXT_SUFFIX}` : path }]
      })
    },
  }
}
