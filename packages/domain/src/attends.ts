const normalizedName = (name: string): string[] =>
  name
    .replace(/<[^<>]*>/g, ' ')
    .toLowerCase()
    .split(/[^\p{L}]+/u)
    .filter((word) => word.length > 1)

/** Whether a person is among those a meeting invites: every word of the name is in one of them. */
export function attends(owner: string, attendees: readonly string[]): boolean {
  const words = normalizedName(owner)
  if (words.length === 0) return false
  return attendees.some((attendee) => {
    const invited = new Set(normalizedName(attendee))
    return words.every((word) => invited.has(word))
  })
}
