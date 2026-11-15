const LIST_SEPARATOR = ','

export const listOf = (text: string): string[] =>
  text
    .split(LIST_SEPARATOR)
    .map((item) => item.trim())
    .filter((item) => item !== '')

export const listText = (items: readonly string[]): string => items.join(`${LIST_SEPARATOR} `)
