import type {
  AdoFeedConfig,
  ConfluenceFeedConfig,
  JiraFeedConfig,
  WarehouseFeedConfig,
} from './feeds.ts'
import type { MeetingsSourceConfig } from './meetings/model.ts'
import type { MailSourceConfig } from './sources.ts'

/** What feeds the memory of a project. Lives in the project folder, so it is shared with it. */
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
