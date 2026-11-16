import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  createClaudeTrackerAdvisor,
  createFsDashboardSettings,
  MAX_COMMENT_SENTENCES,
} from '../src/index.ts'

const here = fileURLToPath(new URL('.', import.meta.url))

function setup() {
  const folder = mkdtempSync(join(tmpdir(), 'octo-advisor-'))
  writeFileSync(join(folder, 'CLAUDE.md'), 'Scrivi sempre al cliente dando del lei.')
  const advisor = createClaudeTrackerAdvisor({
    command: process.execPath,
    prefixArgs: [join(here, 'fake-claude.mjs')],
    env: {},
  })
  return { folder, advisor }
}

const figures = (atPeriodStart: { open: number } | null) => ({
  bugs: {
    now: { open: 12 },
    atPeriodStart,
    stuckLongest: [{ id: '101', daysInState: 45 }],
  },
})

describe('Claude beside the dashboard', () => {
  it('comments the numbers it is given, a few sentences at most', async () => {
    const { folder, advisor } = setup()
    const sentences = await advisor.comment({
      projectFolder: folder,
      figures: figures({ open: 9 }),
    })
    expect(sentences.length).toBeLessThanOrEqual(MAX_COMMENT_SENTENCES)
    expect(sentences[0]).toEqual({
      text: "I bug aperti sono 12, erano 9 all'inizio del periodo.",
      ids: [],
    })
    expect(sentences[1]?.ids).toEqual(['101'])
    const without = await advisor.comment({ projectFolder: folder, figures: figures(null) })
    expect(without[0]?.text).toBe('I bug aperti sono 12.')
  })

  it('drafts a reminder that quotes the question, signed when the author is known', async () => {
    const { folder, advisor } = setup()
    const item = {
      id: '7',
      type: 'story' as const,
      title: 'Esportazione',
      state: 'Active',
      assignee: 'Carla Bianchi',
      askedBy: 'Mario Rossi',
      askedAt: '2026-06-22T09:00:00Z',
      workdays: 6,
      question: 'Quale formato serve per la data?',
    }
    const signed = await advisor.reminder({ projectFolder: folder, item, from: 'Paola Verdi' })
    expect(signed.to).toBe('Carla Bianchi')
    expect(signed.text).toContain('«Quale formato serve per la data?»')
    expect(signed.text).toContain('Grazie, Paola Verdi')
    const unsigned = await advisor.reminder({
      projectFolder: folder,
      item: { ...item, assignee: null },
      from: null,
    })
    expect(unsigned.to).toBeNull()
    expect(unsigned.text.endsWith('Grazie')).toBe(true)
  })
})

describe('the settings of the dashboard kept in the project', () => {
  it('give the working days a question may wait also to a file written before they existed', async () => {
    const folder = mkdtempSync(join(tmpdir(), 'octo-dashboard-'))
    const store = createFsDashboardSettings()
    const loaded = await store.load(folder)
    expect(loaded.answerWorkdays).toBe(2)
    await store.save(folder, { ...loaded, answerWorkdays: 5 })
    expect((await store.load(folder)).answerWorkdays).toBe(5)
  })
})
