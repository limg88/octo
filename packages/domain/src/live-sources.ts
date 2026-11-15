/**
 * Something Octo reads directly from a system and keeps in the project: where it is, what it
 * holds and when it was last read. It is the freshest data of that system the project has.
 */
export type LiveSource = {
  /** The system, as people call it. */
  system: string
  /** The folder or the file, inside the project folder. */
  path: string
  what: string
  /** When the system was last read; null when never, or when the last reading failed. */
  readAt: string | null
  /** True for numbers the code computed: to be cited as they are, never counted again. */
  computed?: boolean
}
