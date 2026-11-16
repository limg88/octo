/** A sentence of Claude on the numbers of the tracker, with the items it names. */
export type CommentSentence = { text: string; ids: string[] }

const ITEM_ID = /#(\d+)/g
const NUMBER = /\d+(?:[.,]\d+)?/g

/** Every number a value holds, wherever it stands: in a figure, in a date, in a name. */
export function numbersIn(value: unknown): Set<number> {
  const found = new Set<number>()
  const visit = (node: unknown): void => {
    if (typeof node === 'number' && Number.isFinite(node)) {
      found.add(node)
      found.add(Math.abs(node))
    } else if (typeof node === 'string') {
      for (const match of node.matchAll(NUMBER)) found.add(Number(match[0].replace(',', '.')))
    } else if (Array.isArray(node)) {
      for (const entry of node) visit(entry)
    } else if (typeof node === 'object' && node !== null) {
      for (const entry of Object.values(node)) visit(entry)
    }
  }
  visit(value)
  return found
}

/**
 * The sentences of a comment the code can stand behind: every item they name is one of the
 * tracker, and every number they say is one of those Claude was given. A sentence with a number
 * of its own, or with an item nobody knows, is left out: Claude comments, it never counts.
 */
export function checkedComment(
  sentences: readonly CommentSentence[],
  given: ReadonlySet<number>,
  knownIds: ReadonlySet<string>,
): CommentSentence[] {
  const kept: CommentSentence[] = []
  for (const sentence of sentences) {
    const text = sentence.text.trim()
    if (text === '') continue
    const named = [...text.matchAll(ITEM_ID)].map((match) => match[1] ?? '')
    const ids = [...new Set([...sentence.ids.map((id) => id.replace(/^#/, '').trim()), ...named])]
    if (ids.some((id) => !knownIds.has(id))) continue
    const figures = [...text.replaceAll(ITEM_ID, ' ').matchAll(NUMBER)].map((match) =>
      Number(match[0].replace(',', '.')),
    )
    if (figures.some((figure) => !given.has(figure))) continue
    kept.push({ text, ids })
  }
  return kept
}
