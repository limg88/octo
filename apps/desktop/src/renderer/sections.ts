import { messages } from './messages.ts'

/** The places of a project the PM moves among. */
export const SECTIONS = [
  'today',
  'ask',
  'deliverables',
  'dashboard',
  'hours',
  'forecast',
  'progress',
  'alignment',
  'sources',
] as const
export type Section = (typeof SECTIONS)[number]

export const SECTION_LABELS: Readonly<Record<Section, string>> = {
  today: messages.todayTab,
  ask: messages.ask,
  deliverables: messages.deliverablesTab,
  dashboard: messages.dashboardTab,
  hours: messages.hoursTab,
  forecast: messages.forecastTab,
  progress: messages.progressTab,
  alignment: messages.alignmentTab,
  sources: messages.sourcesTab,
}

/** The sections by how often they are used: daily work first, what is set once last. */
export const SECTION_GROUPS: ReadonlyArray<{ title: string; sections: readonly Section[] }> = [
  { title: messages.nav.daily, sections: ['today'] },
  { title: messages.nav.work, sections: ['ask', 'deliverables', 'dashboard'] },
  { title: messages.nav.monthly, sections: ['hours', 'forecast', 'progress'] },
  { title: messages.nav.sprint, sections: ['alignment'] },
  { title: messages.nav.project, sections: ['sources'] },
]
