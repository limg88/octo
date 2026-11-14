import type { AdoFeedConfig, JiraFeedConfig, WarehouseFeedConfig } from './feeds.ts'
import type { MailSourceConfig } from './sources.ts'

/** What feeds the memory of a project. Lives in the project folder, so it is shared with it. */
export type SourcesConfig = {
  mail: MailSourceConfig | null
  ado: AdoFeedConfig | null
  jira: JiraFeedConfig | null
  dwsi: WarehouseFeedConfig | null
}

export const NO_SOURCES: SourcesConfig = { mail: null, ado: null, jira: null, dwsi: null }
