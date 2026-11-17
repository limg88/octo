/** Runs `work` on every entry, a few at a time, and stops at the first failure. */
export async function inPool<T>(
  entries: readonly T[],
  size: number,
  work: (entry: T) => Promise<void>,
): Promise<void> {
  let next = 0
  const worker = async (): Promise<void> => {
    while (next < entries.length) {
      const entry = entries[next] as T
      next += 1
      await work(entry)
    }
  }
  await Promise.all(Array.from({ length: Math.min(size, entries.length) }, worker))
}
