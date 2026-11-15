import {
  type AdoFeedConfig,
  DEFAULT_HOURS_SETTINGS,
  type DomainErrorCode,
  type FeedName,
  type HoursSettings,
  MEETINGS_FOLDER,
  type Project,
  type SourceState,
  TRACKER_SUMMARY_PATH,
} from '@octo/domain'
import { describe, expect, it } from 'vitest'
import {
  createSourceMap,
  type FeedView,
  NETSUITE_TIMESHEET_FOLDER,
  TRACKER_HOURS_FOLDER,
} from '../src/index.ts'

const project: Project = { id: 'p-1', name: 'Aurora', folder: '/progetti/Aurora', addedAt: '' }
const NEVER: SourceState = { cursor: null, lastRun: null }
const read = (at: string, error: DomainErrorCode | null = null): SourceState => ({
  cursor: null,
  lastRun: { at, written: 1, unchanged: 0, error },
})
const ado: AdoFeedConfig = {
  organization: 'contoso',
  project: 'Aurora',
  areas: [],
  since: '2026-03-01',
  targetFolder: '_octo/fonti/ADO',
}

function mapWith(options: {
  mail?: boolean
  meetings?: SourceState
  feeds?: Partial<Record<FeedName, SourceState>>
  summary?: string | null
  hours?: Partial<HoursSettings>
}) {
  return createSourceMap({
    sources: {
      mail: async () => ({
        config: options.mail
          ? {
              keywords: [],
              folders: [],
              excludeSenders: [],
              since: '2026-03-01',
              targetFolder: '_octo/posta',
              keepQuoted: false,
            }
          : null,
        suggestedFolder: '_octo/posta',
        state: read('2026-11-15T07:00:00.000Z'),
      }),
    },
    meetings: {
      view: async () => ({
        config: options.meetings ? { root: '~/Verbale' } : null,
        suggestedRoot: null,
        targetFolder: MEETINGS_FOLDER,
        state: options.meetings ?? NEVER,
      }),
    },
    feeds: {
      view: async (_project, feed) =>
        ({
          feed,
          config: options.feeds?.[feed] ? { ...ado, targetFolder: `_octo/fonti/${feed}` } : null,
          suggestedFolder: '',
          hasSecret: true,
          state: options.feeds?.[feed] ?? NEVER,
        }) as unknown as FeedView<typeof feed>,
    },
    hours: {
      load: async () => ({ ...DEFAULT_HOURS_SETTINGS, ...options.hours }),
      save: async () => {},
    },
    files: {
      readText: async (_folder, path) =>
        path === TRACKER_SUMMARY_PATH ? (options.summary ?? null) : null,
    },
  })
}

describe('what Octo reads directly for a project', () => {
  it('is empty when nothing is connected', async () => {
    expect(await mapWith({})(project)).toEqual([])
  })

  it('lists each connected system with where it is and when it was read', async () => {
    const live = await mapWith({
      mail: true,
      feeds: {
        ado: read('2026-11-15T10:06:54.804Z'),
        // The last reading failed: no reading time is claimed.
        jira: read('2026-11-15T09:00:00.000Z', 'feed_unreachable'),
      },
      summary: '# Riepilogo\n\n- Dati del tracker al: 2026-11-15T08:06:33Z\n',
      hours: { timesheetPath: NETSUITE_TIMESHEET_FOLDER, worklogPath: TRACKER_HOURS_FOLDER },
    })(project)

    expect(live.map((source) => [source.system, source.path, source.readAt])).toEqual([
      ['Mail', '_octo/posta', '2026-11-15T07:00:00.000Z'],
      ['Azure DevOps', '_octo/fonti/ado', '2026-11-15T10:06:54.804Z'],
      ['Jira', '_octo/fonti/jira', null],
      ['Client tracker, in numbers', TRACKER_SUMMARY_PATH, '2026-11-15T08:06:33Z'],
      ['NetSuite timesheets', NETSUITE_TIMESHEET_FOLDER, null],
      ['Jira worklogs', TRACKER_HOURS_FOLDER, null],
    ])
    expect(live.filter((source) => source.computed).map((source) => source.path)).toEqual([
      TRACKER_SUMMARY_PATH,
    ])
  })

  it('names the meetings recorded with Verbale, with the time of their last good reading', async () => {
    const live = await mapWith({ meetings: read('2026-11-15T11:00:00.000Z') })(project)
    expect(live.map((source) => [source.system, source.path, source.readAt])).toEqual([
      ['Meetings recorded with Verbale', MEETINGS_FOLDER, '2026-11-15T11:00:00.000Z'],
    ])
  })

  it('leaves out hours kept in files the PM pointed at, and a summary without its date has none', async () => {
    const live = await mapWith({ summary: 'testo', hours: { timesheetPath: 'raw/Timesheets' } })(
      project,
    )
    expect(live).toEqual([expect.objectContaining({ path: TRACKER_SUMMARY_PATH, readAt: null })])
  })
})
