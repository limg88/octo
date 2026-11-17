import {
  DEFAULT_ALIGNMENT_SETTINGS,
  DEFAULT_DASHBOARD_SETTINGS,
  DEFAULT_FORECAST_SETTINGS,
  NO_FORECAST_PROJECT,
  NO_SOURCES,
  type Project,
} from '@octo/domain'
import { describe, expect, it } from 'vitest'
import { createProjectShapes } from '../src/index.ts'

const project: Project = { id: 'p-1', name: 'Aurora', folder: '/progetti/Aurora', addedAt: '' }

describe('the shape of a project', () => {
  it('is told from the settings of the project, each read from its folder', async () => {
    const asked: string[] = []
    const from = <T>(value: T) => ({
      load: async (folder: string) => {
        asked.push(folder)
        return value
      },
    })
    const shapes = createProjectShapes({
      sources: from({
        ...NO_SOURCES,
        jira: {
          since: '2026-01-01',
          targetFolder: '_octo/fonti/Jira',
          site: 'demo',
          email: 'pm@example.test',
          projects: ['AUR'],
        },
      }),
      dashboard: from(DEFAULT_DASHBOARD_SETTINGS),
      alignment: from(DEFAULT_ALIGNMENT_SETTINGS),
      forecast: from({
        ...DEFAULT_FORECAST_SETTINGS,
        projects: { P1: { ...NO_FORECAST_PROJECT, kind: 'fixed_price' as const } },
      }),
    })
    // A fixed price with Jira alone: no alignment, and its progress is the one of its invoices.
    expect(await shapes.of(project)).toEqual({ twoTrackers: false, fixedPriceOnly: true })
    expect(asked).toEqual(Array.from({ length: 4 }, () => project.folder))
  })
})
