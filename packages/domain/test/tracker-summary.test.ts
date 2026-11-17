import { describe, expect, it } from 'vitest'
import {
  DEFAULT_DASHBOARD_SETTINGS,
  parseTrackerExport,
  TRACKER_SUMMARY_PATH,
  trackerSummary,
} from '../src/index.ts'

const item = (
  id: number,
  type: string,
  state: string,
  sprint: string | null,
  tags = ['Squadra'],
) => ({
  id,
  type,
  title: `Voce ${id}`,
  state,
  tags,
  sprint,
  created_date: '2026-10-01T08:00:00Z',
})

const data = parseTrackerExport({
  exported_at: '2026-11-15T08:06:33Z',
  items: [
    item(1, 'Bug', '04 - In Progress', 'Sprint 28'),
    item(2, 'Bug', '06 - Ready for Test', 'Sprint 28'),
    item(3, 'Bug', '12b - Closed', 'Sprint 27'),
    item(4, 'Bug', '12b - Closed', 'Sprint 9'),
    item(5, 'Bug', '02 - To Do', 'Sprint 28', ['Altri']),
    item(6, 'User Story', 'Demo', 'Sprint 27'),
    item(7, 'User Story', 'Demo', 'Sprint 27'),
    item(8, 'User Story', 'Closed', 'Sprint 27'),
    item(9, 'User Story', 'To Do', null),
    item(10, 'Task', 'Done', 'Sprint 27'),
  ],
})
if (!data) throw new Error('not an export')

describe('the tracker in numbers', () => {
  it('counts what is in scope: bugs by phase, stories and bugs by sprint and state', () => {
    const text = trackerSummary(data, { ...DEFAULT_DASHBOARD_SETTINGS, tags: ['Squadra'] })
    expect(text).toContain('- Dati del tracker al: 2026-11-15T08:06:33Z')
    expect(text).toContain('- Perimetro: elementi con tag Squadra')
    expect(text).toContain('- Elementi nel perimetro: 9')
    expect(text).toContain('- Bug nel perimetro: 4')
    expect(text).toContain('- Bug aperti (in lavorazione o in verifica): 2')
    expect(text).toContain('- Bug in lavorazione: 1')
    expect(text).toContain('- Bug in verifica: 1')
    expect(text).toContain('- Bug chiusi: 2')
    expect(text).toContain('- Storie nel perimetro: 4')
    // Newest sprint first, by its number and not by its letters; no sprint last.
    const bugRows = text.slice(text.indexOf('### Bug per sprint'), text.indexOf('## Storie'))
    expect(bugRows.match(/^\| Sprint \d+/gm)).toEqual(['| Sprint 28', '| Sprint 27', '| Sprint 9'])
    expect(text).toContain('| Sprint 28 | 2 | 04 - In Progress: 1; 06 - Ready for Test: 1 |')
    expect(text).toContain('| Sprint 27 | 3 | Closed: 1; Demo: 2 |')
    expect(text).toContain('| (nessuno) | 1 | To Do: 1 |')
    // Tag by tag over the whole tracker, whatever the perimeter; a tag of one item is left out.
    expect(text).toContain('| Squadra | 9 | 2 | 4 |')
    expect(text).not.toContain('| Altri |')
    expect(TRACKER_SUMMARY_PATH).toBe('_octo/cruscotto/riepilogo.md')
  })

  it('counts as open the bugs in work and in verification, not those validated', () => {
    const WORK = 14
    const VERIFY = 3
    const VALIDATED = 49
    const bugs = (count: number, state: string, from: number) =>
      Array.from({ length: count }, (_, index) => item(from + index, 'Bug', state, 'Sprint 29'))
    const reading = parseTrackerExport({
      exported_at: '2026-11-17T08:00:00Z',
      items: [
        ...bugs(WORK, '04 - In Progress', 1),
        ...bugs(VERIFY, '06 - Ready for Test', 100),
        ...bugs(VALIDATED, '10 - Validated', 200),
      ],
    })
    if (!reading) throw new Error('not an export')
    const text = trackerSummary(reading, DEFAULT_DASHBOARD_SETTINGS)
    expect(text).toContain('- Bug nel perimetro: 66')
    expect(text).toContain('- Bug aperti (in lavorazione o in verifica): 17')
    expect(text).not.toContain('aperti (in lavorazione o in verifica): 66')
    expect(text).toContain('- Bug validati, in attesa di rilascio: 49')
    // The same rule tag by tag: items, open bugs, stories.
    expect(text).toContain('| Squadra | 66 | 17 | 0 |')
  })

  it('says so when the whole tracker is the perimeter, the date is unknown or nothing is there', () => {
    const empty = trackerSummary({ exportedAt: null, items: [] }, DEFAULT_DASHBOARD_SETTINGS)
    expect(empty).toContain('- Dati del tracker al: data non dichiarata')
    expect(empty).toContain('- Perimetro: tutti gli elementi')
    expect(empty.match(/^Nessuno\.$/gm)).toHaveLength(2)
    expect(empty).toContain('Nessun tag.')
    expect(trackerSummary(data, DEFAULT_DASHBOARD_SETTINGS)).toContain('- Bug nel perimetro: 5')
    // A Jira may be the supplier's own register: it is called by its name.
    const title = (tracker?: 'ado' | 'jira') =>
      trackerSummary(data, DEFAULT_DASHBOARD_SETTINGS, tracker).split('\n')[0]
    expect(title()).toBe('# Tracker del cliente: riepilogo in numeri')
    expect(title('ado')).toBe('# Tracker del cliente: riepilogo in numeri')
    expect(title('jira')).toBe('# Tracker (Jira): riepilogo in numeri')
  })
})
