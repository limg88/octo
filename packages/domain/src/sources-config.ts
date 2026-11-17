import {
  type AdoFeedConfig,
  type ConfluenceFeedConfig,
  FEED_NAMES,
  type FeedName,
  type JiraFeedConfig,
  PERSONAL_FEED_FIELDS,
  type WarehouseFeedConfig,
} from './feeds.ts'
import type { MeetingsSourceConfig } from './meetings/model.ts'
import type { MailSourceConfig } from './sources.ts'

/**
 * What feeds the memory of a project, as one person reads it. What is of the project lives in
 * its folder and is shared with it; what is of the person is in `PersonalSources`.
 */
export type SourcesConfig = {
  mail: MailSourceConfig | null
  meetings: MeetingsSourceConfig | null
  ado: AdoFeedConfig | null
  jira: JiraFeedConfig | null
  confluence: ConfluenceFeedConfig | null
  dwsi: WarehouseFeedConfig | null
}

export const NO_SOURCES: SourcesConfig = {
  mail: null,
  meetings: null,
  ado: null,
  jira: null,
  confluence: null,
  dwsi: null,
}

/**
 * What of the sources of a project is of who reads them on a computer, not of the project: the
 * account each system is entered with, and where Verbale exports on that computer. Kept with
 * the app, never in the folder: two people share a project without sharing these.
 */
export type PersonalSources = {
  meetings?: { root: string } | undefined
  feeds?: { readonly [Name in FeedName]?: Readonly<Record<string, string>> | undefined } | undefined
}

export const NO_PERSONAL_SOURCES: PersonalSources = {}

type Fields = Record<string, unknown>

const personalOf = (feed: FeedName, config: Fields): Record<string, string> =>
  Object.fromEntries(
    PERSONAL_FEED_FIELDS[feed]
      .map((field): [string, unknown] => [field, config[field]])
      .filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  )

/** The sources as this person reads them: what the folder says, with what is theirs in its place. */
export function mergeSources(shared: SourcesConfig, personal: PersonalSources): SourcesConfig {
  const merged: Record<string, unknown> = { ...shared }
  for (const feed of FEED_NAMES) {
    const config = shared[feed]
    if (config !== null) merged[feed] = { ...config, ...personal.feeds?.[feed] }
  }
  if (shared.meetings !== null && personal.meetings) {
    merged.meetings = { ...shared.meetings, root: personal.meetings.root }
  }
  return merged as SourcesConfig
}

/**
 * The sources a person saved, told apart: what goes in the folder and what stays theirs. The
 * folder keeps the account and the export folder it already names, those of who linked the
 * source first, so an Octo that reads only the folder still finds a whole configuration.
 */
export function splitSources(
  config: SourcesConfig,
  sharedBefore: SourcesConfig,
): { shared: SourcesConfig; personal: PersonalSources } {
  const shared: Record<string, unknown> = { ...config }
  const feeds: Record<string, Record<string, string>> = {}
  for (const feed of FEED_NAMES) {
    const mine = config[feed] as Fields | null
    if (mine === null) continue
    const before = sharedBefore[feed] as Fields | null
    feeds[feed] = personalOf(feed, mine)
    shared[feed] = { ...mine, ...(before === null ? {} : personalOf(feed, before)) }
  }
  const personal: PersonalSources = { feeds }
  if (config.meetings !== null) {
    personal.meetings = { root: config.meetings.root }
    const root = sharedBefore.meetings?.root ?? config.meetings.root
    shared.meetings = { ...config.meetings, root }
  }
  return { shared: shared as SourcesConfig, personal }
}
