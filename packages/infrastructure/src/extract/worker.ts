// Entry of the extraction worker thread: one file in, its text out. Parsing a large workbook
// takes seconds and must not freeze the app, and a parser that hangs is stopped with its thread.
import { parentPort, workerData } from 'node:worker_threads'
import { extract } from './extract.ts'

const { bytes, fileName } = workerData as { bytes: Uint8Array; fileName: string }
parentPort?.postMessage(await extract(bytes, fileName))
