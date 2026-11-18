import type { CheckedCitation } from '../answer.ts'
import { OCTO_FOLDER } from '../extracted-document.ts'

/**
 * The curated memory of a project: a few pages Claude writes and keeps up to date from the
 * sources, and the PM approves like any deliverable. No page enters without that approval.
 * Answers and deliverables read them first, as a guide to what the sources say.
 */
export const MEMORY_FOLDER = `${OCTO_FOLDER}/progetto/memoria`
const PAGE = /^[a-z][a-z0-9-]{0,39}$/

/** True for a name a page of the memory may have: it is the name of its file. */
export const isMemoryPage = (page: string): boolean => PAGE.test(page)
export const memoryPagePath = (page: string): string => `${MEMORY_FOLDER}/${page}.md`

const DAY_LENGTH = 10

/**
 * A page of the memory as it is kept: its title, when the PM approved it, the text without the
 * markers, and the files it was written from, so who reads it can go and check. A source the
 * code did not find is said to be so: a page never looks more certain than it is.
 */
export function memoryPageMarkdown(
  title: string,
  text: string,
  citations: readonly CheckedCitation[],
  approvedAt: string,
): string {
  const paths = [...new Set(citations.map((citation) => citation.path))].sort()
  const unverified = new Set(
    citations.filter((citation) => citation.status !== 'verified').map((citation) => citation.path),
  )
  const sources =
    paths.length === 0
      ? ['Nessuna fonte citata: da prendere come non verificata.']
      : paths.map((path) => `- \`${path}\`${unverified.has(path) ? ' (fonte non verificata)' : ''}`)
  return [
    `# ${title}`,
    '',
    `Pagina di memoria del progetto, scritta da Claude e approvata dal PM il ${approvedAt.slice(0, DAY_LENGTH)}. È una guida: per un numero o una data vale la fonte.`,
    '',
    text.trim(),
    '',
    '## Fonti',
    '',
    ...sources,
    '',
  ].join('\n')
}
