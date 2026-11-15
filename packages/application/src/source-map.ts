import {
  FEED_NAMES,
  feedLabel,
  type LiveSource,
  type Project,
  type SourceState,
  TRACKER_SUMMARY_PATH,
} from '@octo/domain'
import type { Feeds } from './feeds.ts'
import { NETSUITE_TIMESHEET_FOLDER, TRACKER_HOURS_FOLDER } from './hours.ts'
import type { HoursSettingsStore, ProjectFiles } from './ports.ts'
import type { Sources } from './sources.ts'

export type SourceMapDeps = {
  sources: Pick<Sources, 'mail'>
  feeds: Pick<Feeds, 'view'>
  hours: HoursSettingsStore
  files: Pick<ProjectFiles, 'readText'>
}

/** What Octo reads directly for a project, to tell who answers and who writes. */
export type SourceMap = (project: Project) => Promise<LiveSource[]>

const SUMMARY_DATE = /^- Dati del tracker al: (\S+)$/m
const FEED_CONTENT: Readonly<Record<(typeof FEED_NAMES)[number], string>> = {
  ado: 'one file per work item, with state, sprint, tags and description',
  jira: 'one file per issue, with status, sprint, assignee and comments',
  dwsi: 'hours, orders, invoices and revenue of the project codes',
}

/** A reading that failed is no news of the system: the date of the last good one is not kept. */
const readAt = (state: SourceState): string | null =>
  state.lastRun && state.lastRun.error === null ? state.lastRun.at : null

export function createSourceMap(deps: SourceMapDeps): SourceMap {
  return async (project) => {
    const live: LiveSource[] = []
    const mail = await deps.sources.mail(project)
    if (mail.config) {
      live.push({
        system: 'Mail',
        path: mail.config.targetFolder,
        what: 'one file per message about the project',
        readAt: readAt(mail.state),
      })
    }
    for (const feed of FEED_NAMES) {
      const view = await deps.feeds.view(project, feed)
      if (!view.config) continue
      live.push({
        system: feedLabel(feed),
        path: view.config.targetFolder,
        what: FEED_CONTENT[feed],
        readAt: readAt(view.state),
      })
    }
    const summary = await deps.files.readText(project.folder, TRACKER_SUMMARY_PATH)
    if (summary !== null) {
      live.push({
        system: 'Client tracker, in numbers',
        path: TRACKER_SUMMARY_PATH,
        what: 'bugs by phase, stories and bugs by sprint and state, counted by the code',
        readAt: SUMMARY_DATE.exec(summary)?.[1] ?? null,
        computed: true,
      })
    }
    const hours = await deps.hours.load(project.folder)
    if (hours.timesheetPath === NETSUITE_TIMESHEET_FOLDER) {
      live.push({
        system: 'NetSuite timesheets',
        path: NETSUITE_TIMESHEET_FOLDER,
        what: 'one file per month: who, day, hours, project code, approval',
        readAt: null,
      })
    }
    if (hours.worklogPath === TRACKER_HOURS_FOLDER) {
      live.push({
        system: 'Jira worklogs',
        path: TRACKER_HOURS_FOLDER,
        what: 'one file per month: who, day, hours, issue',
        readAt: null,
      })
    }
    return live
  }
}
