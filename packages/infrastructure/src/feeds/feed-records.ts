import type { FeedRecords, FeedRows, ProjectFiles } from '@octo/application'
import { parseSyncFile, type SyncFile } from '@octo/connectors'

const MARKDOWN = '.md'

/**
 * Reads back the items a feed wrote in the project: each is a file whose header holds the title
 * and the fields of the item. A file that is something else (the note on the reading, a document)
 * is skipped.
 */
export function createFeedRecords(files: ProjectFiles): FeedRecords & FeedRows {
  async function syncFiles(projectFolder: string, folder: string): Promise<SyncFile[]> {
    const paths = (await files.under(projectFolder, folder)).filter((path) =>
      path.toLowerCase().endsWith(MARKDOWN),
    )
    const found: SyncFile[] = []
    for (const path of paths) {
      const content = await files.readText(projectFolder, path)
      const file = content === null ? null : parseSyncFile(content)
      if (file) found.push(file)
    }
    return found
  }

  return {
    async rows(projectFolder, folder, view) {
      return (await syncFiles(projectFolder, folder)).flatMap((file) =>
        file.type === 'rows' && file.rows.view === view
          ? file.rows.rows.map((row) => row.values)
          : [],
      )
    },
    async under(projectFolder, folder) {
      const records = []
      for (const file of await syncFiles(projectFolder, folder)) {
        if (file.type === 'record') {
          records.push({ title: file.record.title, record: file.record.record })
        }
      }
      return records
    },
  }
}
