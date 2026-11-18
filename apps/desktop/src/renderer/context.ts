import { type BugQuery, type CheckedAnswer, NO_BUG_QUERY, type TodayKind } from '@octo/domain'

/** Which bugs the dashboard lists: the open ones, a part of them, or the validated ones. */
export const BUG_FILTERS = ['open', 'work', 'verify', 'stuck', 'validated'] as const
export type BugFilter = (typeof BUG_FILTERS)[number]

/** The parts the dashboard is read in. */
export const DASHBOARD_TABS = ['sprint', 'bugs', 'trend', 'activities'] as const
export type DashboardTab = (typeof DASHBOARD_TABS)[number]

/** What the PM was looking at in the dashboard, kept while they go to another section and back. */
export type DashboardFocus = {
  tab: DashboardTab
  filter: BugFilter
  bugId: string | null
  /** The filters of the list of bugs beyond the count chosen. */
  query: BugQuery
}
/** The page opens on the bugs: they are there whatever the tracker says of sprints. */
export const NO_DASHBOARD_FOCUS: DashboardFocus = {
  tab: 'bugs',
  filter: 'open',
  bugId: null,
  query: NO_BUG_QUERY,
}

/** The signals of the day by where they come from, for the filters of the page. */
export const TODAY_GROUPS = [
  'mail',
  'tracker',
  'numbers',
  'work',
  'calendar',
  'risks',
  'sources',
] as const
export type TodayGroup = (typeof TODAY_GROUPS)[number]

export const GROUP_OF: Readonly<Record<TodayKind, TodayGroup>> = {
  mail_reply: 'mail',
  mail_follow: 'mail',
  mail_waiting: 'mail',
  tracker_old: 'tracker',
  bugs_stuck: 'tracker',
  requirements: 'tracker',
  hours: 'numbers',
  forecast: 'numbers',
  month_due: 'numbers',
  draft: 'work',
  calendar: 'calendar',
  meeting: 'calendar',
  meeting_unassigned: 'calendar',
  risk: 'risks',
  risk_candidates: 'risks',
  source: 'sources',
}

/** What the PM was looking at in the page of the day. */
export type TodayFocus = { group: TodayGroup | 'all'; key: string | null }
export const NO_TODAY_FOCUS: TodayFocus = { group: 'all', key: null }

/** An answer handed to the deliverables: the question, what was answered and its sources. */
export type Handoff = { question: string; answer: CheckedAnswer }
