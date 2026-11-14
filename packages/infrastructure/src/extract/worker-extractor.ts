import { Worker } from 'node:worker_threads'
import type { TextExtractor } from '@octo/application'
import type { Extraction } from '@octo/domain'
import { EXTRACTABLE_EXTENSIONS } from './extract.ts'
import { EXTRACTOR } from './limits.ts'
import { failed } from './result.ts'

/** A file whose text is not out by then is given up: its text says `timeout`. */
export const EXTRACTION_TIMEOUT_MS = 60_000

/**
 * Extracts in a worker thread started for each file. `workerFile` is the built (or source) file
 * of `worker.ts`: the app passes the one it ships.
 */
export function createWorkerTextExtractor(
  workerFile: string | URL,
  timeoutMs = EXTRACTION_TIMEOUT_MS,
): TextExtractor {
  return {
    extensions: EXTRACTABLE_EXTENSIONS,
    version: EXTRACTOR,
    extract(bytes, fileName): Promise<Extraction> {
      return new Promise((resolve) => {
        const worker = new Worker(workerFile, { workerData: { bytes, fileName } })
        const settle = (extraction: Extraction) => {
          clearTimeout(timer)
          void worker.terminate()
          resolve(extraction)
        }
        const timer = setTimeout(() => settle(failed('timeout')), timeoutMs)
        worker.once('message', (extraction: Extraction) => settle(revived(extraction)))
        worker.once('error', () => settle(failed('extraction_failed')))
      })
    },
  }
}

/** Dates cross the thread as dates, but a worker built apart may hand them over as text. */
function revived(extraction: Extraction): Extraction {
  const date = (value: Date | string | null | undefined): Date | null =>
    value ? new Date(value) : null
  return { ...extraction, metadataDate: date(extraction.metadataDate) }
}
