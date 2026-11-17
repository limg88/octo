import { describe, expect, it } from 'vitest'
import {
  type Extraction,
  extractedDocument,
  feedScope,
  isConflictCopy,
  isCurrentText,
  type JiraFeedConfig,
  mergeSources,
  NEVER_SHARED,
  NO_SOURCES,
  type Reader,
  readingElsewhere,
  readingTurn,
  type SharedReading,
  type SourceRun,
  type SourcesConfig,
  scopeWithoutAccount,
  shownState,
  splitSources,
  UNCITABLE_FOLDERS,
  type WarehouseFeedConfig,
} from '../src/index.ts'

const giovanni: Reader = { name: 'Giovanni', computer: 'mac-di-giovanni' }
const giovanna: Reader = { name: 'Giovanna', computer: 'pc-di-giovanna' }
const NOW = new Date('2026-11-17T09:00:00.000Z')
const MINUTE = 60 * 1000
const ago = (minutes: number): string => new Date(NOW.getTime() - minutes * MINUTE).toISOString()
const run = (at: string, by?: Reader, error: SourceRun['error'] = null): SourceRun => ({
  at,
  written: 1,
  unchanged: 0,
  error,
  ...(by ? { by } : {}),
})
const shared = (overrides: Partial<SharedReading>): SharedReading => ({
  ...NEVER_SHARED,
  ...overrides,
})

describe('whose turn it is to read a source of a shared folder', () => {
  it('reads what nobody read, and what this computer itself read last', () => {
    expect(readingTurn(NEVER_SHARED, giovanna, NOW, 15 * MINUTE)).toBe('read')
    const mine = shared({ lastRun: run(ago(1), giovanna) })
    expect(readingTurn(mine, giovanna, NOW, 15 * MINUTE)).toBe('read')
    // A reading from before folders were shared names nobody: it stands for no other computer.
    expect(readingTurn(shared({ lastRun: run(ago(1)) }), giovanna, NOW, 15 * MINUTE)).toBe('read')
  })

  it('takes the reading of another computer while it is fresh, unless somebody asks', () => {
    const theirs = shared({ lastRun: run(ago(5), giovanni) })
    expect(readingTurn(theirs, giovanna, NOW, 15 * MINUTE)).toBe('fresh')
    expect(readingTurn(theirs, giovanna, NOW, null)).toBe('read')
    const old = shared({ lastRun: run(ago(20), giovanni) })
    expect(readingTurn(old, giovanna, NOW, 15 * MINUTE)).toBe('read')
  })

  it('waits while another computer reads, until its turn runs out', () => {
    const held = shared({ lease: { by: giovanni, until: ago(-5) } })
    expect(readingTurn(held, giovanna, NOW, null)).toBe('busy_elsewhere')
    expect(readingElsewhere(held, giovanna, NOW)).toEqual(giovanni)
    // The computer that holds the turn is not kept out by itself: it stopped and starts again.
    expect(readingTurn(held, giovanni, NOW, null)).toBe('read')
    const left = shared({ lease: { by: giovanni, until: ago(1) } })
    expect(readingTurn(left, giovanna, NOW, null)).toBe('read')
    expect(readingElsewhere(left, giovanna, NOW)).toBeNull()
  })

  it('is not kept out for ever by a computer whose clock is wrong', () => {
    // Clocks a few minutes apart are the ordinary case: the turn and the reading still stand.
    const ahead = shared({ lease: { by: giovanni, until: ago(-13) } })
    expect(readingTurn(ahead, giovanna, NOW, null)).toBe('busy_elsewhere')
    const justAhead = shared({ lastRun: run(ago(-2), giovanni) })
    expect(readingTurn(justAhead, giovanna, NOW, 15 * MINUTE)).toBe('fresh')
    // A turn or a reading dated far in the future would never run out: it is not believed.
    const endless = shared({ lease: { by: giovanni, until: ago(-60 * 24) } })
    expect(readingTurn(endless, giovanna, NOW, null)).toBe('read')
    expect(readingElsewhere(endless, giovanna, NOW)).toBeNull()
    const future = shared({ lastRun: run(ago(-60 * 24), giovanni) })
    expect(readingTurn(future, giovanna, NOW, 15 * MINUTE)).toBe('read')
  })

  it('shows the newest of what this computer tried and what the folder holds', () => {
    const good = run(ago(10), giovanni)
    const failed = run(ago(2), giovanna, 'feed_credential_refused')
    const folder = shared({ lastRun: good, cursor: '{"at":7}' })
    expect(shownState({ cursor: null, lastRun: null }, folder)).toEqual({
      cursor: '{"at":7}',
      lastRun: good,
    })
    expect(shownState({ cursor: null, lastRun: failed }, folder).lastRun).toEqual(failed)
    const older = run(ago(30), giovanna)
    expect(shownState({ cursor: 'qui', lastRun: older }, folder).lastRun).toEqual(good)
    expect(shownState({ cursor: 'qui', lastRun: older }, NEVER_SHARED)).toEqual({
      cursor: 'qui',
      lastRun: older,
    })
  })

  it('keeps what the folder knows of its readings out of the answers', () => {
    expect(UNCITABLE_FOLDERS).toContain('_octo/.stato')
  })
})

describe('what of a source is of the project and what is of who reads it', () => {
  const jira: JiraFeedConfig = {
    since: '2026-03-01',
    targetFolder: '_octo/fonti/Jira',
    site: 'contoso',
    email: 'giovanni@example.test',
    projects: ['AUR'],
  }
  const dwsi: WarehouseFeedConfig = {
    since: '2026-03-01',
    targetFolder: '_octo/fonti/NetSuite',
    host: 'dw.example.test',
    port: 5432,
    database: 'dwsi',
    user: 'giovanni',
    ownerEmail: 'giovanni@example.test',
    projectCodes: ['PRJ000123'],
    tls: 'verify_full',
  }

  it('reads the same perimeter with the account of either person', () => {
    const hers = { ...jira, email: 'giovanna@example.test' }
    expect(feedScope('jira', hers)).toBe(feedScope('jira', jira))
    expect(feedScope('jira', { ...jira, projects: ['AUR', 'BOR'] })).not.toBe(
      feedScope('jira', jira),
    )
    const herWarehouse = { ...dwsi, user: 'giovanna', ownerEmail: 'giovanna@example.test' }
    expect(feedScope('dwsi', herWarehouse)).toBe(feedScope('dwsi', dwsi))
    expect(feedScope('dwsi', { ...dwsi, projectCodes: ['PRJ000999'] })).not.toBe(
      feedScope('dwsi', dwsi),
    )
  })

  it('recognises the perimeter an earlier Octo wrote with the account in it', () => {
    const { targetFolder: _folder, ...settings } = jira
    const what = { ...settings, fields: 2 }
    const before = JSON.stringify(what, Object.keys(what).sort())
    expect(before).toContain('giovanni@example.test')
    expect(scopeWithoutAccount('jira', before)).toBe(feedScope('jira', jira))
    expect(scopeWithoutAccount('jira', 'non è JSON')).toBeNull()
    expect(scopeWithoutAccount('jira', '[1]')).toBeNull()
  })

  it('keeps the account and the folder of Verbale of each person apart from the folder', () => {
    const first: SourcesConfig = {
      ...NO_SOURCES,
      jira,
      meetings: { root: '~/Documents/Verbale', since: null },
    }
    // The first to link a source: the folder takes the whole configuration.
    const linked = splitSources(first, NO_SOURCES)
    expect(linked.shared).toEqual(first)
    expect(linked.personal).toEqual({
      feeds: { jira: { email: 'giovanni@example.test' } },
      meetings: { root: '~/Documents/Verbale' },
    })

    // The second saves her own account and a wider perimeter: only the perimeter changes there.
    const hers: SourcesConfig = {
      ...first,
      jira: { ...jira, email: 'giovanna@example.test', projects: ['AUR', 'BOR'] },
      meetings: { root: 'C:/Verbale', since: '2026-11-01' },
    }
    const saved = splitSources(hers, linked.shared)
    expect(saved.shared.jira).toEqual({ ...jira, projects: ['AUR', 'BOR'] })
    expect(saved.shared.meetings).toEqual({ root: '~/Documents/Verbale', since: '2026-11-01' })
    expect(saved.personal.feeds?.jira).toEqual({ email: 'giovanna@example.test' })

    // Each reads the folder with what is theirs; who kept nothing reads what the folder names.
    expect(mergeSources(saved.shared, saved.personal)).toEqual(hers)
    expect(mergeSources(saved.shared, {}).jira?.email).toBe('giovanni@example.test')
    expect(mergeSources(NO_SOURCES, saved.personal)).toEqual(NO_SOURCES)
  })
})

describe('the copies a sync client leaves beside the files of a feed', () => {
  const held = new Set(['_octo/fonti/ADO/bug-12-1a2b.md', '_octo/fonti/ADO/_lettura.md'])

  it('tells a copy from a file of the feed', () => {
    expect(isConflictCopy('_octo/fonti/ADO/bug-12-1a2b-PC-DI-GIOVANNA.md', held)).toBe(true)
    expect(isConflictCopy('_octo/fonti/ADO/bug-12-1a2b (copia in conflitto).md', held)).toBe(true)
    expect(isConflictCopy('_octo/fonti/ADO/_lettura-mac-di-giovanni-2.md', held)).toBe(true)
  })

  it('leaves alone what the feed holds and what is not a copy of it', () => {
    expect(isConflictCopy('_octo/fonti/ADO/bug-12-1a2b.md', held)).toBe(false)
    expect(isConflictCopy('_octo/fonti/ADO/bug-13-9f8e.md', held)).toBe(false)
    expect(isConflictCopy('_octo/fonti/ADO/bug-12-1a2b-PC.txt', held)).toBe(false)
    expect(isConflictCopy('_octo/fonti/Jira/bug-12-1a2b-PC.md', held)).toBe(false)
    expect(isConflictCopy('_octo/fonti/ADO/senza-estensione', held)).toBe(false)
  })
})

describe('a text already converted, on a computer that got the file as a copy', () => {
  const extraction: Extraction = {
    extractor: 'docx-1',
    warnings: [],
    chunks: [],
    truncated: false,
    metadataDate: null,
  }
  const stamp = { path: 'SOW/Offerta.docx', size: 1200, modifiedAt: '2026-11-10T08:00:00.123Z' }
  const text = extractedDocument(stamp, extraction)

  it('is current when the copy lost only the fraction of the second', () => {
    expect(isCurrentText(text, stamp, 'docx-1')).toBe(true)
    expect(
      isCurrentText(text, { ...stamp, modifiedAt: '2026-11-10T08:00:00.000Z' }, 'docx-1'),
    ).toBe(true)
    expect(
      isCurrentText(text, { ...stamp, modifiedAt: '2026-11-10T08:00:01.000Z' }, 'docx-1'),
    ).toBe(true)
  })

  it('is not when the file was written again, or is another file', () => {
    expect(
      isCurrentText(text, { ...stamp, modifiedAt: '2026-11-10T08:00:00.456Z' }, 'docx-1'),
    ).toBe(false)
    expect(
      isCurrentText(text, { ...stamp, modifiedAt: '2026-11-10T08:00:02.000Z' }, 'docx-1'),
    ).toBe(false)
    expect(isCurrentText(text, { ...stamp, size: 1201 }, 'docx-1')).toBe(false)
    expect(isCurrentText(text, stamp, 'docx-2')).toBe(false)
    expect(isCurrentText(text, { ...stamp, path: 'SOW/Altra.docx' }, 'docx-1')).toBe(false)
    expect(isCurrentText('# senza intestazione', stamp, 'docx-1')).toBe(false)
    expect(
      isCurrentText(text.replace('"2026-11-10T08:00:00.123Z"', '"ieri"'), stamp, 'docx-1'),
    ).toBe(false)
  })
})
