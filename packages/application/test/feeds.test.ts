import {
  type AdoFeedConfig,
  DomainError,
  type FeedStep,
  NO_SOURCES,
  type Project,
} from '@octo/domain'
import { describe, expect, it } from 'vitest'
import { createFeeds } from '../src/index.ts'
import {
  memoryFeedIndexes,
  memorySourceSettings,
  memorySourceStates,
  memoryVault,
  memoryWriter,
  removerOf,
  scriptedFeed,
} from './fakes.ts'

const project: Project = { id: 'p-1', name: 'Aurora', folder: '/progetti/Aurora', addedAt: '' }
const NOW = new Date('2026-11-14T10:00:00.000Z')
const config: AdoFeedConfig = {
  organization: 'contoso',
  project: 'Aurora',
  areas: [],
  since: '2026-11-01',
  targetFolder: 'Fonti/ADO',
}
const file = (id: string, version: string, name = id) => ({
  externalId: id,
  version,
  relativePath: `${name}.md`,
  content: `# ${id} v${version}\n`,
})
const step = (overrides: Partial<FeedStep>): FeedStep => ({
  files: [],
  removed: [],
  cursor: null,
  dataAsOf: null,
  ...overrides,
})

function setup(
  script: { steps?: FeedStep[]; fails?: Error },
  initial: AdoFeedConfig | null = config,
) {
  const writer = memoryWriter()
  const secrets = memoryVault()
  const reader = scriptedFeed(script)
  const states = memorySourceStates()
  const feeds = createFeeds({
    settings: memorySourceSettings({ ...NO_SOURCES, ado: initial }),
    states,
    indexes: memoryFeedIndexes(),
    secrets,
    reader,
    writer,
    files: removerOf(writer.files),
    clock: { now: () => NOW },
  })
  return { feeds, writer, secrets, reader, states, script }
}

describe('configuring a feed', () => {
  it('saves nothing until the system accepts the credential', async () => {
    const refused = setup({ fails: new DomainError('feed_credential_refused') }, null)
    await expect(refused.feeds.save(project, 'ado', config, 'pat')).rejects.toMatchObject({
      code: 'feed_credential_refused',
    })
    expect(refused.secrets.all.size).toBe(0)
    expect((await refused.feeds.view(project, 'ado')).config).toBeNull()

    const { feeds, secrets, reader } = setup({}, null)
    const view = await feeds.save(project, 'ado', { ...config, organization: ' contoso ' }, ' pat ')
    expect(view).toMatchObject({ hasSecret: true, config: { organization: 'contoso' } })
    expect(secrets.all.get('p-1/ado')).toBe('pat')
    expect(reader.checks).toEqual([{ feed: 'ado', secret: 'pat' }])
    expect(await feeds.configured(project)).toEqual(['ado'])
  })

  it('keeps the stored credential when none is typed, and asks for one when none is stored', async () => {
    const { feeds, secrets, reader } = setup({})
    await expect(feeds.save(project, 'ado', config, null)).rejects.toMatchObject({
      code: 'secret_missing',
    })
    secrets.all.set('p-1/ado', 'vecchio')
    await feeds.save(project, 'ado', { ...config, areas: ['Team A'] }, '')
    expect(reader.checks.at(-1)).toEqual({ feed: 'ado', secret: 'vecchio' })
  })

  it('refuses a configuration that is not valid and can switch the feed off', async () => {
    const { feeds, secrets } = setup({})
    secrets.all.set('p-1/ado', 'pat')
    await expect(
      feeds.save(project, 'ado', { ...config, project: ' ' }, null),
    ).rejects.toMatchObject({
      code: 'source_config_invalid',
    })

    const off = await feeds.save(project, 'ado', null, null)
    expect(off).toMatchObject({ config: null, hasSecret: false, suggestedFolder: 'Fonti/ado' })
    expect(await feeds.configured(project)).toEqual([])
  })
})

describe('reading a feed', () => {
  it('writes each item once, moves what is renamed and removes what is gone', async () => {
    const { feeds, writer, secrets, reader, script } = setup({
      steps: [
        step({ files: [file('1', 'a'), file('2', 'a')], cursor: { at: 1 } }),
        step({
          files: [file('3', 'a')],
          cursor: { at: 2 },
          dataAsOf: new Date('2026-11-14T09:00:00Z'),
        }),
      ],
    })
    secrets.all.set('p-1/ado', 'pat')

    expect(await feeds.sync(project, 'ado')).toEqual({
      at: NOW.toISOString(),
      written: 3,
      unchanged: 0,
      error: null,
    })
    expect(reader.cursors).toEqual([null])
    expect(writer.files.get('Fonti/ADO/_lettura.md')).toContain(
      'dati-aggiornati-al: "2026-11-14T09:00:00.000Z"',
    )
    expect(writer.files.get('Fonti/ADO/_lettura.md')).toContain('elementi: 3')

    script.steps = [
      step({
        files: [file('1', 'a'), file('2', 'b', 'due-rinominato')],
        removed: ['3', '99'],
        cursor: { at: 3 },
      }),
    ]
    expect(await feeds.sync(project, 'ado')).toMatchObject({ written: 1, unchanged: 1 })
    expect(reader.cursors).toEqual([null, { at: 2 }])
    expect([...writer.files.keys()].sort()).toEqual([
      'Fonti/ADO/1.md',
      'Fonti/ADO/_lettura.md',
      'Fonti/ADO/due-rinominato.md',
    ])
    expect(writer.files.get('Fonti/ADO/_lettura.md')).toContain(
      'dati-aggiornati-al: "non dichiarato dal sistema"',
    )
  })

  it('starts over, removing its files, when what it reads changes', async () => {
    const { feeds, writer, secrets, reader, script } = setup({
      steps: [step({ files: [file('1', 'a')], cursor: 7 })],
    })
    secrets.all.set('p-1/ado', 'pat')
    await feeds.sync(project, 'ado')

    await feeds.save(project, 'ado', { ...config, areas: ['Team B'] }, null)
    script.steps = [step({ files: [file('8', 'a')], cursor: 9 })]
    await feeds.sync(project, 'ado')

    expect(reader.cursors).toEqual([null, null])
    expect(writer.files.has('Fonti/ADO/1.md')).toBe(false)
    expect(writer.files.has('Fonti/ADO/8.md')).toBe(true)
  })

  it('keeps what a reading wrote before it failed, and goes on from there', async () => {
    const { feeds, writer, secrets, reader, script, states } = setup({
      steps: [step({ files: [file('1', 'a')], cursor: { at: 1 } })],
      fails: new DomainError('feed_unreachable'),
    })
    secrets.all.set('p-1/ado', 'pat')

    expect(await feeds.sync(project, 'ado')).toMatchObject({
      written: 0,
      error: 'feed_unreachable',
    })
    expect(writer.files.has('Fonti/ADO/1.md')).toBe(true)
    expect(states.all().get('p-1/ado')?.cursor).toBe('{"at":1}')

    delete script.fails
    script.steps = []
    expect(await feeds.sync(project, 'ado')).toMatchObject({ error: null })
    expect(reader.cursors).toEqual([null, { at: 1 }])
  })

  it('needs a configuration and a credential, and runs one reading at a time', async () => {
    const none = setup({}, null)
    await expect(none.feeds.sync(project, 'ado')).rejects.toMatchObject({
      code: 'source_not_configured',
    })

    const { feeds, secrets } = setup({})
    expect(await feeds.sync(project, 'ado')).toMatchObject({ error: 'secret_missing' })
    secrets.all.set('p-1/ado', 'pat')
    const first = feeds.sync(project, 'ado')
    await expect(feeds.sync(project, 'ado')).rejects.toMatchObject({ code: 'source_busy' })
    await first

    const broken = setup({ fails: new Error('disk full') })
    broken.secrets.all.set('p-1/ado', 'pat')
    await expect(broken.feeds.sync(project, 'ado')).rejects.toThrow('disk full')
  })
})

describe('choosing instead of typing', () => {
  it('lists what the credential sees, with the typed secret or the stored one', async () => {
    const { feeds, secrets, reader } = setup({}, null)
    await expect(feeds.choices(project, 'ado', config, null)).rejects.toMatchObject({
      code: 'secret_missing',
    })

    expect(await feeds.choices(project, 'ado', config, ' pat ')).toEqual({
      projects: [{ value: 'Aurora', label: 'Aurora' }],
      areas: [],
    })
    secrets.all.set('p-1/ado', 'salvato')
    await feeds.choices(project, 'ado', config, null)
    expect(reader.checks.map((check) => check.secret)).toEqual(['pat', 'salvato'])
    expect(secrets.all.get('p-1/ado')).toBe('salvato')
  })
})
