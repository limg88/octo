import { describe, expect, it } from 'vitest'
import {
  DEFAULT_ALIGNMENT_SETTINGS,
  DEFAULT_DASHBOARD_SETTINGS,
  DEFAULT_FORECAST_SETTINGS,
  NO_FORECAST_PROJECT,
  NO_SOURCES,
  projectShapeOf,
  TRACKER_PATHS,
} from '../src/index.ts'

const jira = {
  since: '2026-01-01',
  targetFolder: 'f',
  site: 'demo',
  email: 'pm@example.test',
  projects: ['AUR'],
}
const ado = { since: '2026-01-01', targetFolder: 'f', organization: 'o', project: 'p', areas: [] }
const shape = (
  sources: Partial<typeof NO_SOURCES> = {},
  exportPath = '',
  sprint = '',
  kinds: Array<'time_material' | 'fixed_price' | 'fee'> = [],
) =>
  projectShapeOf(
    { ...NO_SOURCES, ...sources },
    { ...DEFAULT_DASHBOARD_SETTINGS, exportPath },
    { ...DEFAULT_ALIGNMENT_SETTINGS, sprint },
    {
      ...DEFAULT_FORECAST_SETTINGS,
      projects: Object.fromEntries(
        kinds.map((kind, index) => [`P${index}`, { ...NO_FORECAST_PROJECT, kind }]),
      ),
    },
  )

describe('what a project is like', () => {
  it('has two trackers to align when Jira stands beside a tracker of the client', () => {
    expect(shape({ jira, ado }).twoTrackers).toBe(true)
    // The client's tracker as a file kept by hand, beside the supplier's Jira.
    expect(shape({ jira }, 'dati/export.json').twoTrackers).toBe(true)
    // Jira alone, even when the dashboard is read from it: nothing to compare it with.
    expect(shape({ jira }).twoTrackers).toBe(false)
    expect(shape({ jira }, TRACKER_PATHS.jira.snapshot).twoTrackers).toBe(false)
    // No Jira: no tickets of the supplier.
    expect(shape({ ado }, TRACKER_PATHS.ado.snapshot).twoTrackers).toBe(false)
    expect(shape().twoTrackers).toBe(false)
    // A project that already uses the alignment keeps it, whatever its sources say now.
    expect(shape({}, '', 'Sprint 28').twoTrackers).toBe(true)
  })

  it('is sold at a fixed price only when every code of it is', () => {
    expect(shape({}, '', '', ['fixed_price']).fixedPriceOnly).toBe(true)
    expect(shape({}, '', '', ['fixed_price', 'fixed_price']).fixedPriceOnly).toBe(true)
    expect(shape({}, '', '', ['fixed_price', 'time_material']).fixedPriceOnly).toBe(false)
    expect(shape({}, '', '', ['fee']).fixedPriceOnly).toBe(false)
    // No code known yet: nothing says how it is sold.
    expect(shape().fixedPriceOnly).toBe(false)
  })
})
