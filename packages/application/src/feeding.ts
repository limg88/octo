import { type FeedName, isDomainError, type Project, type SourceRun } from '@octo/domain'
import type { Documents } from './documents.ts'
import type { Feeds } from './feeds.ts'
import type { Meetings } from './meetings.ts'
import type { MemoryWriter, SourceName } from './ports.ts'
import type { Sources } from './sources.ts'

export type FeedingDeps = {
  writer: Pick<MemoryWriter, 'claim'>
  sources: Sources
  meetings: Pick<Meetings, 'configured' | 'sync'>
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
   * Feeds the memory of a project from everything set up for it, one source after the other:
   * the mail, the meetings (after the mail: its invitations tell whose a meeting is), the
   * systems, then the documents (last, so what the others brought is converted
   * too). A source that fails does not stop the others.
   */
  fill(project: Project, onStep?: (step: FeedingStep) => void): Promise<FeedingStep[]>
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
  ): Promise<FeedingStep[]> {
    await deps.writer.claim(project.folder)
    const { mail, meetings, feeds } = await status(project)
    const plan: Array<[SourceName, () => Promise<SourceRun>]> = [
      ...(mail
        ? [['mail', () => deps.sources.syncMail(project)] as [SourceName, () => Promise<SourceRun>]]
        : []),
      ...(meetings
        ? [
            ['meetings', () => deps.meetings.sync(project)] as [
              SourceName,
              () => Promise<SourceRun>,
            ],
          ]
        : []),
      ...feeds.map((feed): [SourceName, () => Promise<SourceRun>] => [
        feed,
        () => deps.feeds.sync(project, feed),
      ]),
      ['documents', () => deps.documents.convert(project)],
    ]
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
