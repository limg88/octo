import { messages } from './messages.ts'

/**
 * The places of a project the PM moves among. «Ore» and «Previsionale» are places, reached from
 * a signal or an error, and parts of «Commessa»: the list of the sections does not name them.
 */
export const SECTIONS = [
  'today',
  'ask',
  'deliverables',
  'dashboard',
  'hours',
  'sheet',
  'forecast',
  'sources',
] as const
export type Section = (typeof SECTIONS)[number]

const SHEET_PLACES: readonly Section[] = ['hours', 'forecast']
/** The section of the list a place is in. */
export const listedSection = (place: Section): Section =>
  SHEET_PLACES.includes(place) ? 'sheet' : place
/** The sections the list names, in its order. */
export const LISTED_SECTIONS = SECTIONS.filter((section) => !SHEET_PLACES.includes(section))

export const SECTION_LABELS: Readonly<Record<Section, string>> = {
  today: messages.todayTab,
  ask: messages.ask,
  deliverables: messages.deliverablesTab,
  dashboard: messages.dashboardTab,
  hours: messages.hoursTab,
  sheet: messages.sheetTab,
  forecast: messages.forecastTab,
  sources: messages.sourcesTab,
}

/** The sections by how often they are used: daily work first, what is set once last. */
export const SECTION_GROUPS: ReadonlyArray<{ title: string; sections: readonly Section[] }> = [
  { title: messages.nav.daily, sections: ['today'] },
  { title: messages.nav.work, sections: ['ask', 'deliverables', 'dashboard'] },
  { title: messages.nav.monthly, sections: ['sheet'] },
  { title: messages.nav.project, sections: ['sources'] },
]
