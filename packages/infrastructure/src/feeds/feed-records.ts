import type { FeedRecords, ProjectFiles } from '@octo/application'
import { parseSyncFile } from '@octo/connectors'

const MARKDOWN = '.md'

/**
 * Reads back the items a feed wrote in the project: each is a file whose header holds the title
 * and the fields of the item. A file that is something else (the note on the reading, a document)
 * is skipped.
 */
export function createFeedRecords(files: ProjectFiles): FeedRecords {
  return {
    async under(projectFolder, folder) {
      const paths = (await files.under(projectFolder, folder)).filter((path) =>
        path.toLowerCase().endsWith(MARKDOWN),
      )
      const records = []
      for (const path of paths) {
        const content = await files.readText(projectFolder, path)
        const file = content === null ? null : parseSyncFile(content)
        if (file?.type === 'record') {
          records.push({ title: file.record.title, record: file.record.record })
        }
      }
      return records
    },
  }
}
