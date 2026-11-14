import type { Extraction } from '@octo/domain'
import { extractDocx } from './docx.ts'
import { extractPdf } from './pdf.ts'
import { extractPptx } from './pptx.ts'
import { failed } from './result.ts'
import { extractXlsx } from './xlsx.ts'

type Reader = (bytes: Uint8Array) => Extraction | Promise<Extraction>

/** The formats read, by file extension. A macro-enabled file has the layout of the plain one. */
const READERS: Readonly<Record<string, Reader>> = {
  pdf: extractPdf,
  docx: extractDocx,
  docm: extractDocx,
  pptx: extractPptx,
  pptm: extractPptx,
  xlsx: extractXlsx,
  xlsm: extractXlsx,
}

export const EXTRACTABLE_EXTENSIONS: readonly string[] = Object.keys(READERS)

export function extensionOf(fileName: string): string {
  return fileName.includes('.') ? (fileName.split('.').pop() ?? '').toLowerCase() : ''
}

/**
 * Text with locators from the bytes of a file. Pure and deterministic: no I/O, no environment.
 * It never throws: whatever cannot be read becomes a warning in the result (`encrypted`,
 * `unsupported_format`, `no_text`, `truncated`).
 */
export async function extract(bytes: Uint8Array, fileName: string): Promise<Extraction> {
  const reader = READERS[extensionOf(fileName)]
  if (!reader) return failed('unsupported_format')
  try {
    return await reader(bytes)
  } catch {
    return failed('unsupported_format')
  }
}
