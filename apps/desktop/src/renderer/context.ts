import type { CheckedAnswer, TodayKind } from '@octo/domain'

/** Which bugs the dashboard lists: the open ones, a part of them, or the validated ones. */
export const BUG_FILTERS = ['open', 'work', 'verify', 'stuck', 'validated'] as const
export type BugFilter = (typeof BUG_FILTERS)[number]

/** What the PM was looking at in the dashboard, kept while they go to another section and back. */
export type DashboardFocus = { filter: BugFilter; bugId: string | null }
export const NO_DASHBOARD_FOCUS: DashboardFocus = { filter: 'open', bugId: null }

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
  mail_waiting: 'mail',
  tracker_old: 'tracker',
  bugs_stuck: 'tracker',
  requirements: 'tracker',
  alignment: 'tracker',
  hours: 'numbers',
  forecast: 'numbers',
  month_due: 'numbers',
  draft: 'work',
  calendar: 'calendar',
  meeting: 'calendar',
  risk: 'risks',
  risk_candidates: 'risks',
  source: 'sources',
}

/** What the PM was looking at in the page of the day. */
export type TodayFocus = { group: TodayGroup | 'all'; key: string | null }
export const NO_TODAY_FOCUS: TodayFocus = { group: 'all', key: null }

/** An answer handed to the deliverables: the question, what was answered and its sources. */
export type Handoff = { question: string; answer: CheckedAnswer }
