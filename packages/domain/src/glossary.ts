/**
 * A word as a transcript writes it when it heard it badly, and the form it has in the project:
 * an acronym, the name of a product or of a person.
 */
export type GlossaryEntry = { heard: string; right: string }

/** The glossary of a project: the pairs the PM approved, and those Claude proposes. */
export type Glossary = { entries: GlossaryEntry[]; proposed: GlossaryEntry[] }

export const NO_GLOSSARY: Glossary = { entries: [], proposed: [] }
/** Where it is kept, with the settings of the project. */
export const GLOSSARY_FILE = 'glossario.json'
export const MAX_GLOSSARY_ENTRIES = 300
export const MAX_GLOSSARY_WORD = 80

const keyOf = (heard: string): string => heard.trim().toLocaleLowerCase('it')

/** The pairs made tidy: one for each word heard, none that changes nothing. */
function cleanEntries(entries: readonly GlossaryEntry[]): GlossaryEntry[] {
  const kept = new Map<string, GlossaryEntry>()
  for (const entry of entries) {
    const heard = entry.heard.trim().slice(0, MAX_GLOSSARY_WORD)
    const right = entry.right.trim().slice(0, MAX_GLOSSARY_WORD)
    if (heard === '' || right === '' || heard === right) continue
    kept.set(keyOf(heard), { heard, right })
  }
  return [...kept.values()].slice(0, MAX_GLOSSARY_ENTRIES)
}

/** A glossary as it is kept: what is approved is no longer proposed. */
export function cleanGlossary(glossary: Glossary): Glossary {
  const entries = cleanEntries(glossary.entries)
  const approved = new Set(entries.map((entry) => keyOf(entry.heard)))
  return {
    entries,
    proposed: cleanEntries(glossary.proposed).filter((entry) => !approved.has(keyOf(entry.heard))),
  }
}

const SPECIAL = /[.*+?^${}()|[\]\\]/g
const LETTER = '[\\p{L}\\p{N}]'

/**
 * A text with every word heard badly written in its right form. Whole words only, whatever
 * their case: «deem» inside «redeem» is left alone. The longer forms are put right first.
 */
export function applyGlossary(text: string, entries: readonly GlossaryEntry[]): string {
  const ordered = [...entries].sort((a, b) => b.heard.length - a.heard.length)
  return ordered.reduce((corrected, entry) => {
    const heard = entry.heard.trim().replace(SPECIAL, '\\$&')
    if (heard === '') return corrected
    const whole = new RegExp(`(?<!${LETTER})${heard}(?!${LETTER})`, 'giu')
    return corrected.replace(whole, () => entry.right)
  }, text)
}
