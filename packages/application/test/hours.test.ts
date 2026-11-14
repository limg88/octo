import { DEFAULT_HOURS_SETTINGS, type HoursSettings, type Project } from '@octo/domain'
import { describe, expect, it } from 'vitest'
import { createHours, type HoursSettingsStore, type ProjectFiles } from '../src/index.ts'

const project: Project = { id: 'p-1', name: 'Aurora', folder: '/progetti/Aurora', addedAt: '' }
const JUNE = { from: '2026-06-01', to: '2026-06-30' }
const row = (id: number, employee: string, day: string, duration: number) => ({
  internalid: id,
  employee,
  timesheetdate: day,
  projectid: 'P1',
  duration,
  approvalstatus: 'Approved',
})
const FILES: Record<string, string> = {
  'ore/Timesheets/2026-06/netsuite_2026-06_A.json': JSON.stringify({
    rows: [row(1, 'Rossi Mario', '2026-06-03', 8), row(2, 'Rossi Mario', '2026-06-04', 8)],
  }),
  'ore/Timesheets/2026-06/netsuite_2026-06_all.json': JSON.stringify({
    rows: [row(1, 'Rossi Mario', '2026-06-03', 8), row(3, 'Bianchi Anna', '2026-06-10', 4)],
  }),
  'ore/Timesheets/2026-06/summary.md': 'not an export',
  'ore/Timesheets/broken.json': '{',
  'ore/jira/worklog-giugno.csv': 'Full name;Work date;Hours\nMario Rossi;2026-06-03;15\n',
  'ore/jira/altro.csv': 'a;b\n1;2\n',
  'note/elenco.json': '[]',
}

function setup(initial: Partial<HoursSettings> = {}) {
  let saved: HoursSettings = { ...DEFAULT_HOURS_SETTINGS, ...initial }
  const settings: HoursSettingsStore = {
    load: async () => saved,
    save: async (_folder, next) => {
      saved = next
    },
  }
  const unused = async (): Promise<never> => {
    throw new Error('not used')
  }
  const files: ProjectFiles = {
    withExtensions: async (_folder, extensions) =>
      Object.keys(FILES)
        .filter((path) => extensions.includes(path.split('.').pop() ?? ''))
        .map((path) => ({ path, size: 1, modifiedAt: '' })),
    read: unused,
    readText: async (_folder, path) => FILES[path] ?? null,
    under: async (_folder, folder) =>
      Object.keys(FILES).filter((path) => path.startsWith(`${folder}/`)),
    remove: unused,
  }
  return createHours({ settings, files })
}

describe('hours', () => {
  it('reads every export under the folders set, each row once, and compares', async () => {
    const hours = setup({ timesheetPath: 'ore/Timesheets', worklogPath: 'ore/jira/' })
    const view = await hours.view(project, JUNE)
    expect(
      view.reconciliation.rows.map((r) => [r.person, r.timesheetHours, r.worklogHours, r.status]),
    ).toEqual([
      ['Bianchi Anna', 4, 0, 'no_worklog'],
      ['Rossi Mario', 16, 15, 'ok'],
    ])
    expect(view.sources).toEqual({
      timesheetFiles: 3,
      worklogFiles: 2,
      unreadable: ['ore/Timesheets/broken.json', 'ore/jira/altro.csv'],
      lastTimesheetDay: '2026-06-10',
      lastWorklogDay: '2026-06-03',
    })
    expect(view.projectCodes).toEqual(['P1'])
    expect(view.reconciliation.tieOut.ok).toBe(true)
  })

  it('reads a single file as well', async () => {
    const hours = setup({
      timesheetPath: 'ore/Timesheets/2026-06/netsuite_2026-06_A.json',
      worklogPath: 'ore/jira/worklog-giugno.csv',
    })
    const view = await hours.view(project, JUNE)
    expect(view.sources).toMatchObject({ timesheetFiles: 1, worklogFiles: 1, unreadable: [] })
    expect(view.reconciliation.totals).toEqual({
      timesheetHours: 16,
      worklogHours: 15,
      deltaPct: 6.3,
    })
  })

  it('says what is missing by a code', async () => {
    await expect(setup().view(project, JUNE)).rejects.toMatchObject({
      code: 'hours_sources_not_set',
    })
    await expect(
      setup({ timesheetPath: 'vuota', worklogPath: 'ore/jira' }).view(project, JUNE),
    ).rejects.toMatchObject({ code: 'hours_timesheet_missing' })
    await expect(
      setup({ timesheetPath: 'ore/Timesheets', worklogPath: 'vuota' }).view(project, JUNE),
    ).rejects.toMatchObject({ code: 'hours_worklog_missing' })
    const ready = setup({ timesheetPath: 'ore/Timesheets', worklogPath: 'ore/jira' })
    for (const period of [
      { from: 'June', to: '2026-06-30' },
      { from: '2026-06-01', to: '30/06/2026' },
      { from: '2026-07-01', to: '2026-06-30' },
    ]) {
      await expect(ready.view(project, period)).rejects.toMatchObject({
        code: 'hours_period_invalid',
      })
    }
  })

  it('never looks outside the project folder', async () => {
    const hours = setup()
    for (const path of ['../altrove', '/etc', 'C:\\dati', 'ore/../../x']) {
      await expect(
        hours.saveSettings(project, { ...DEFAULT_HOURS_SETTINGS, timesheetPath: path }),
      ).rejects.toMatchObject({ code: 'hours_settings_invalid' })
    }
    await expect(
      setup({ timesheetPath: '../x', worklogPath: 'ore/jira' }).view(project, JUNE),
    ).rejects.toMatchObject({ code: 'hours_settings_invalid' })
  })

  it('saves tidy settings and proposes where the hours seem to be', async () => {
    const hours = setup()
    const saved = await hours.saveSettings(project, {
      ...DEFAULT_HOURS_SETTINGS,
      timesheetPath: ' ore/Timesheets ',
      worklogPath: './ore/jira',
    })
    expect(saved.timesheetPath).toBe('ore/Timesheets')
    expect(await hours.settings(project)).toEqual(saved)
    expect(await hours.candidates(project)).toEqual({
      timesheets: ['ore/Timesheets'],
      worklogs: ['ore/jira/altro.csv', 'ore/jira/worklog-giugno.csv'],
    })
  })
})
