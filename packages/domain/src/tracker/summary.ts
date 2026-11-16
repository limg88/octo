import { OCTO_FOLDER } from '../extracted-document.ts'
import {
  type DashboardSettings,
  inScope,
  isOfType,
  PHASES,
  type Phase,
  phaseOf,
  type TrackerItem,
} from './model.ts'

/** Where the counts of the tracker, computed by the code, are kept as a text answers may cite. */
export const TRACKER_SUMMARY_PATH = `${OCTO_FOLDER}/cruscotto/riepilogo.md`

const NO_SPRINT = '(nessuno)'
const PHASE_LABEL: Readonly<Record<Phase, string>> = {
  work: 'in lavorazione',
  verify: 'in verifica',
  validated: 'validati, in attesa di rilascio',
  closed: 'chiusi',
}

const numeric = (a: string, b: string): number => a.localeCompare(b, 'it', { numeric: true })

/** The counts of one kind of item, sprint by sprint and state by state, as rows of a table. */
function bySprint(items: readonly TrackerItem[]): string[] {
  const counts = new Map<string, Map<string, number>>()
  for (const item of items) {
    const sprint = item.sprint ?? NO_SPRINT
    const states = counts.get(sprint) ?? new Map<string, number>()
    states.set(item.state, (states.get(item.state) ?? 0) + 1)
    counts.set(sprint, states)
  }
  return [...counts.entries()]
    .sort(([a], [b]) => numeric(b, a))
    .map(([sprint, states]) => {
      const total = [...states.values()].reduce((sum, count) => sum + count, 0)
      const detail = [...states.entries()]
        .sort(([a], [b]) => numeric(a, b))
        .map(([state, count]) => `${state}: ${count}`)
        .join('; ')
      return `| ${sprint} | ${total} | ${detail} |`
    })
}

/** Tags with fewer items than this are left out: a slip of the pen, not a team. */
const MIN_TAG_ITEMS = 5

/**
 * The whole tracker tag by tag, whatever the perimeter: how many items, open bugs and stories each
 * tag has. It answers «how many of ours» even before the perimeter of the dashboard is set.
 */
function byTag(items: readonly TrackerItem[], settings: DashboardSettings): string[] {
  const tags = new Map<string, { items: number; openBugs: number; stories: number }>()
  for (const item of items) {
    const bug = isOfType(item, settings.bugTypes)
    const open = bug && phaseOf(item.state, settings) !== 'closed'
    for (const tag of new Set(item.tags)) {
      const counted = tags.get(tag) ?? { items: 0, openBugs: 0, stories: 0 }
      counted.items += 1
      if (open) counted.openBugs += 1
      if (isOfType(item, settings.storyTypes)) counted.stories += 1
      tags.set(tag, counted)
    }
  }
  return [...tags.entries()]
    .filter(([, counted]) => counted.items >= MIN_TAG_ITEMS)
    .sort(([a, x], [b, y]) => y.items - x.items || numeric(a, b))
    .map(([tag, c]) => `| ${tag} | ${c.items} | ${c.openBugs} | ${c.stories} |`)
}

const table = (rows: readonly string[]): string[] =>
  rows.length === 0
    ? ['Nessuno.', '']
    : ['| Sprint | Totale | Per stato |', '|---|---|---|', ...rows, '']

const tagTable = (rows: readonly string[]): string[] =>
  rows.length === 0
    ? ['Nessun tag.', '']
    : ['| Tag | Elementi | Bug aperti | Storie |', '|---|---|---|---|', ...rows, '']

/**
 * The tracker in numbers, as a text of the project: what is in scope, the bugs by phase, and
 * stories and bugs by sprint and state. Every number is counted by the code from the reading of
 * the tracker, so a report cites it instead of counting, and says how old it is.
 */
export function trackerSummary(
  data: { exportedAt: string | null; items: readonly TrackerItem[] },
  settings: DashboardSettings,
): string {
  const scoped = data.items.filter((item) => inScope(item.tags, settings))
  const bugs = scoped.filter((item) => isOfType(item, settings.bugTypes))
  const stories = scoped.filter((item) => isOfType(item, settings.storyTypes))
  const phases = new Map<Phase, number>()
  for (const bug of bugs) {
    const phase = phaseOf(bug.state, settings)
    phases.set(phase, (phases.get(phase) ?? 0) + 1)
  }
  const open = bugs.length - (phases.get('closed') ?? 0)
  const tagged =
    settings.tags.length > 0 ? `elementi con tag ${settings.tags.join(', ')}` : 'tutti gli elementi'
  const perimeter = settings.ownPeopleOnly
    ? `${tagged}, assegnati alle persone del fornitore`
    : tagged
  return [
    '# Tracker del cliente: riepilogo in numeri',
    '',
    'Scritto da Octo contando la lettura del tracker: i numeri non sono stime. Si aggiorna a ogni lettura del tracker e quando cambiano le impostazioni del cruscotto.',
    '',
    `- Dati del tracker al: ${data.exportedAt ?? 'data non dichiarata'}`,
    `- Perimetro: ${perimeter}`,
    `- Elementi nel perimetro: ${scoped.length}`,
    '',
    '## Bug',
    '',
    `- Bug nel perimetro: ${bugs.length}`,
    `- Bug aperti: ${open}`,
    ...PHASES.map((phase) => `- Bug ${PHASE_LABEL[phase]}: ${phases.get(phase) ?? 0}`),
    '',
    '### Bug per sprint e stato',
    '',
    ...table(bySprint(bugs)),
    '## Storie',
    '',
    `- Storie nel perimetro: ${stories.length}`,
    '',
    '### Storie per sprint e stato',
    '',
    ...table(bySprint(stories)),
    '## Tutto il tracker, tag per tag',
    '',
    'Qualunque sia il perimetro: quanti elementi, bug aperti e storie porta ogni tag.',
    '',
    ...tagTable(byTag(data.items, settings)),
  ].join('\n')
}
