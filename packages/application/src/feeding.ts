import { type FeedName, isDomainError, type Project, type SourceRun } from '@octo/domain'
import type { Documents } from './documents.ts'
import type { Feeds } from './feeds.ts'
import type { Meetings } from './meetings.ts'
import type { MemoryWriter, SourceName } from './ports.ts'
import type { ReadingOptions } from './readings.ts'
import type { Sources } from './sources.ts'

export type FeedingDeps = {
  writer: Pick<MemoryWriter, 'claim'>
  sources: Sources
  meetings: Pick<Meetings, 'configured' | 'readableHere' | 'sync'>
  feeds: Feeds
  documents: Documents
}

/** What one source did in a filling, or the code of why it could not start. */
export type FeedingStep = {
  source: SourceName
  run: SourceRun | null
  error: string | null
}

/** Which sources of a project are set up: what the guided setup shows as done or to do. */
export type FeedingStatus = {
  mail: boolean
  meetings: boolean
  feeds: FeedName[]
}

export type Feeding = {
  status(project: Project): Promise<FeedingStatus>
  /**
   * Feeds the memory of a project from everything this computer can read of what is set up for
   * it, one source after the other: the mail, the meetings (after the mail: its invitations tell
   * whose a meeting is), the systems, then the documents (last, so what the others brought is
   * converted too). A source that fails does not stop the others. A source this computer cannot
   * read (no mail program, no folder of Verbale, no credential kept here) is left to who can:
   * what they read is already in the folder. With `maxAgeMs`, what another computer read less
   * than that long ago is not read again.
   */
  fill(
    project: Project,
    onStep?: (step: FeedingStep) => void,
    options?: ReadingOptions,
  ): Promise<FeedingStep[]>
}

export function createFeeding(deps: FeedingDeps): Feeding {
  async function status(project: Project): Promise<FeedingStatus> {
    return {
      mail: await deps.sources.hasMail(project),
      meetings: await deps.meetings.configured(project),
      feeds: await deps.feeds.configured(project),
    }
  }

  async function step(source: SourceName, read: () => Promise<SourceRun>): Promise<FeedingStep> {
    try {
      return { source, run: await read(), error: null }
    } catch (error) {
      // Already running, or a configuration no longer valid: said, not thrown.
      if (!isDomainError(error)) throw error
      return { source, run: null, error: error.code }
    }
  }

  async function fill(
    project: Project,
    onStep: (step: FeedingStep) => void = () => {},
    options: ReadingOptions = {},
  ): Promise<FeedingStep[]> {
    await deps.writer.claim(project.folder)
    const plan: Array<[SourceName, () => Promise<SourceRun>]> = []
    if (await deps.sources.mailReadableHere(project)) {
      plan.push(['mail', () => deps.sources.syncMail(project, options)])
    }
    if (await deps.meetings.readableHere(project)) {
      plan.push(['meetings', () => deps.meetings.sync(project, options)])
    }
    for (const feed of await deps.feeds.readableHere(project)) {
      plan.push([feed, () => deps.feeds.sync(project, feed, options)])
    }
    plan.push(['documents', () => deps.documents.convert(project, options)])
    const done: FeedingStep[] = []
    for (const [source, read] of plan) {
      const outcome = await step(source, read)
      done.push(outcome)
      onStep(outcome)
    }
    return done
  }

  return { status, fill }
}
