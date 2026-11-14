import { mkdir, mkdtemp, realpath, rm, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DEFAULT_DASHBOARD_SETTINGS, DEFAULT_HOURS_SETTINGS } from '@octo/domain'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  createFsDashboardSettings,
  createFsHoursSettings,
  createFsTrackerExports,
} from '../src/index.ts'

let root: string
let folder: string

const padding = 'x'.repeat(2000)
const exported = (title: string) =>
  JSON.stringify({
    exported_at: '2026-06-28T08:00:00Z',
    item_count: 1,
    items: [{ id: 1, title, padding }],
  })

beforeAll(async () => {
  root = await realpath(await mkdtemp(join(tmpdir(), 'octo-dashboard-')))
  folder = join(root, 'progetto')
  await mkdir(join(folder, 'data', 'tracker'), { recursive: true })
  await mkdir(join(folder, '.hidden'))
  await writeFile(join(folder, 'data', 'tracker', 'latest.json'), exported('first'))
  await writeFile(
    join(folder, 'data', 'tracker', 'history.json'),
    JSON.stringify({ bugs: { '1': {} }, padding }),
  )
  await writeFile(join(folder, 'data', 'small.json'), '{"items":[]}')
  await writeFile(join(folder, 'data', 'other.json'), JSON.stringify({ padding }))
  await writeFile(join(folder, 'data', 'broken.json'), '{"items": [')
  await writeFile(join(folder, '.hidden', 'export.json'), exported('hidden'))
  await writeFile(join(root, 'outside.json'), exported('outside'))
})

afterAll(() => rm(root, { recursive: true, force: true }))

describe('tracker exports on disk', () => {
  it('reads a JSON file of the project and reads it again only when it changed', async () => {
    const exports = createFsTrackerExports()
    const path = 'data/tracker/latest.json'
    const first = await exports.readJson(folder, path)
    expect(first).toMatchObject({ items: [{ title: 'first' }] })
    expect(await exports.readJson(folder, path)).toBe(first)
    await writeFile(join(folder, path), exported('second, longer'))
    await utimes(join(folder, path), new Date(), new Date(Date.now() + 5000))
    expect(await exports.readJson(folder, path)).toMatchObject({
      items: [{ title: 'second, longer' }],
    })
  })

  it('answers null for a missing file and refuses what is not JSON or is outside', async () => {
    const exports = createFsTrackerExports()
    expect(await exports.readJson(folder, 'data/gone.json')).toBeNull()
    await expect(exports.readJson(folder, 'data/broken.json')).rejects.toMatchObject({
      code: 'tracker_export_unreadable',
    })
    await expect(exports.readJson(folder, '../outside.json')).rejects.toMatchObject({
      code: 'tracker_export_unreadable',
    })
  })

  it('proposes the files that look like an export or like a history', async () => {
    expect(await createFsTrackerExports().candidates(folder)).toEqual({
      exports: ['data/tracker/latest.json'],
      histories: ['data/tracker/history.json'],
    })
  })
})

describe('dashboard settings on disk', () => {
  it('starts from the defaults and keeps what is saved under the folder of Octo', async () => {
    const store = createFsDashboardSettings()
    expect(await store.load(folder)).toEqual(DEFAULT_DASHBOARD_SETTINGS)
    const settings = {
      ...DEFAULT_DASHBOARD_SETTINGS,
      exportPath: 'data/tracker/latest.json',
      tags: ['Team'],
      phases: { Odd: 'closed' as const },
    }
    await store.save(folder, settings)
    expect(await store.load(folder)).toEqual(settings)
  })

  it('reads a file written before a setting existed, and refuses a damaged one', async () => {
    const store = createFsDashboardSettings()
    const file = join(folder, '_octo', '.impostazioni', 'dashboard.json')
    await writeFile(file, JSON.stringify({ exportPath: 'a.json' }))
    expect(await store.load(folder)).toEqual({
      ...DEFAULT_DASHBOARD_SETTINGS,
      exportPath: 'a.json',
    })
    await writeFile(file, JSON.stringify({ stuckDays: 'many' }))
    await expect(store.load(folder)).rejects.toMatchObject({ code: 'dashboard_settings_invalid' })
  })
})

describe('hours settings on disk', () => {
  it('starts from the defaults, keeps what is saved and refuses a damaged file', async () => {
    const store = createFsHoursSettings()
    expect(await store.load(folder)).toEqual(DEFAULT_HOURS_SETTINGS)
    const settings = {
      ...DEFAULT_HOURS_SETTINGS,
      timesheetPath: 'ore/Timesheets',
      aliases: [{ worklog: 'u1', timesheet: 'Rossi Mario' }],
    }
    await store.save(folder, settings)
    expect(await store.load(folder)).toEqual(settings)
    await writeFile(join(folder, '_octo', '.impostazioni', 'hours.json'), '{"thresholdPct":"x"}')
    await expect(store.load(folder)).rejects.toMatchObject({ code: 'hours_settings_invalid' })
  })
})
