import {
  cleanFeedConfig,
  DomainError,
  FEED_NAMES,
  FEED_NOTE_FILE,
  type FeedChoices,
  type FeedConfig,
  type FeedConfigs,
  type FeedIndex,
  type FeedName,
  type FeedStep,
  feedNote,
  feedScope,
  isDomainError,
  type Project,
  type SourceRun,
  type SourceState,
} from '@octo/domain'
import type {
  Clock,
  FeedIndexes,
  FeedReader,
  MemoryWriter,
  ProjectFiles,
  SecretVault,
  SourceSettings,
  SourceStates,
} from './ports.ts'

export type FeedsDeps = {
  settings: SourceSettings
  states: SourceStates
  indexes: FeedIndexes
  secrets: SecretVault
  reader: FeedReader
  writer: MemoryWriter
  files: ProjectFiles
  clock: Clock
}

/** What the Sources page shows for one feed of a project. */
export type FeedView<Name extends FeedName = FeedName> = {
  feed: Name
  config: FeedConfigs[Name] | null
  suggestedFolder: string
  /** Whether a credential is kept on this computer. It is never shown again. */
  hasSecret: boolean
  state: SourceState
}

export type Feeds = {
  view<Name extends FeedName>(project: Project, feed: Name): Promise<FeedView<Name>>
  /**
   * Checks the configuration against the system and saves it. `secret` null keeps the credential
   * already stored; `config` null switches the feed off and forgets its credential.
   */
  save<Name extends FeedName>(
    project: Project,
    feed: Name,
    config: FeedConfigs[Name] | null,
    secret: string | null,
  ): Promise<FeedView<Name>>
  /**
   * What the credential can see, to pick from while setting the feed up. Nothing is saved. A null
   * secret uses the one already stored.
   */
  choices(
    project: Project,
    feed: FeedName,
    config: FeedConfig,
    secret: string | null,
  ): Promise<FeedChoices>
  /** Reads what changed into the project folder. One reading per project and feed at a time. */
  sync(project: Project, feed: FeedName): Promise<SourceRun>
  /** The feeds configured for a project: those a periodic reading takes. */
  configured(project: Project): Promise<FeedName[]>
}

/** Where the credential of a feed of a project is kept in the vault. */
export const secretKey = (project: Project, feed: FeedName): string => `${project.id}/${feed}`

export function createFeeds(deps: FeedsDeps): Feeds {
  const running = new Set<string>()

  async function view<Name extends FeedName>(
    project: Project,
    feed: Name,
  ): Promise<FeedView<Name>> {
    const sources = await deps.settings.load(project.folder)
    return {
      feed,
      config: sources[feed] as FeedConfigs[Name] | null,
      suggestedFolder: await deps.settings.suggestFeedFolder(project.folder, feed),
      hasSecret: (await deps.secrets.get(secretKey(project, feed))) !== null,
      state: await deps.states.get(project.id, feed),
    }
  }

  async function save<Name extends FeedName>(
    project: Project,
    feed: Name,
    config: FeedConfigs[Name] | null,
    secret: string | null,
  ): Promise<FeedView<Name>> {
    const key = secretKey(project, feed)
    const sources = await deps.settings.load(project.folder)
    if (config === null) {
      await deps.settings.save(project.folder, { ...sources, [feed]: null })
      await deps.secrets.remove(key)
      return view(project, feed)
    }
    const cleaned = cleanFeedConfig(feed, config)
    const credential = secret?.trim() || (await deps.secrets.get(key))
    if (!credential) throw new DomainError('secret_missing', feed)
    // Nothing is saved until the system accepts the credential for what was named.
    await deps.reader.check(feed, cleaned, credential)
    await deps.secrets.set(key, credential)
    await deps.settings.save(project.folder, { ...sources, [feed]: cleaned })
    return view(project, feed)
  }

  /** Removes every file of the feed: its perimeter changed, or it starts over. */
  async function clear(project: Project, items: FeedIndex): Promise<void> {
    for (const item of Object.values(items)) {
      await deps.files.remove(project.folder, item.path)
    }
  }

  async function apply(
    project: Project,
    folder: string,
    step: FeedStep,
    items: FeedIndex,
    counts: Counts,
  ): Promise<void> {
    for (const file of step.files) {
      const path = `${folder}/${file.relativePath}`
      const before = items[file.externalId]
      if (before?.version === file.version && before.path === path) {
        counts.unchanged += 1
        continue
      }
      if (before && before.path !== path) await deps.files.remove(project.folder, before.path)
      await deps.writer.write(project.folder, path, file.content)
      items[file.externalId] = { version: file.version, path }
      counts.written += 1
    }
    for (const id of step.removed) {
      const before = items[id]
      if (!before) continue
      await deps.files.remove(project.folder, before.path)
      delete items[id]
    }
  }

  async function read(project: Project, feed: FeedName, config: FeedConfig): Promise<Counts> {
    const secret = await deps.secrets.get(secretKey(project, feed))
    if (!secret) throw new DomainError('secret_missing', feed)
    const scope = feedScope(config)
    const index = await deps.indexes.load(project.id, feed)
    const state = await deps.states.get(project.id, feed)
    const sameScope = index.scope === scope
    if (!sameScope) await clear(project, index.items)
    const items: FeedIndex = sameScope ? { ...index.items } : {}
    let cursor: unknown = sameScope && state.cursor ? JSON.parse(state.cursor) : null
    let dataAsOf: Date | null = null
    const counts: Counts = { written: 0, unchanged: 0 }
    const signal = new AbortController().signal
    for await (const step of deps.reader.read(feed, config, secret, cursor, signal)) {
      await apply(project, config.targetFolder, step, items, counts)
      cursor = step.cursor
      dataAsOf = step.dataAsOf ?? dataAsOf
      // Saved at every step: a reading that stops half way goes on from here.
      await deps.indexes.save(project.id, feed, scope, items)
      await deps.states.set(project.id, feed, { ...state, cursor: JSON.stringify(cursor) })
    }
    const note = feedNote(feed, {
      readAt: deps.clock.now(),
      dataAsOf,
      items: Object.keys(items).length,
    })
    await deps.writer.write(project.folder, `${config.targetFolder}/${FEED_NOTE_FILE}`, note)
    return counts
  }

  async function sync(project: Project, feed: FeedName): Promise<SourceRun> {
    const config = (await deps.settings.load(project.folder))[feed]
    if (!config) throw new DomainError('source_not_configured', feed)
    const lock = secretKey(project, feed)
    if (running.has(lock)) throw new DomainError('source_busy', feed)
    running.add(lock)
    const at = deps.clock.now().toISOString()
    try {
      const run: SourceRun = { at, ...(await read(project, feed, config)), error: null }
      const state = await deps.states.get(project.id, feed)
      await deps.states.set(project.id, feed, { ...state, lastRun: run })
      return run
    } catch (error) {
      if (!isDomainError(error)) throw error
      const run: SourceRun = { at, written: 0, unchanged: 0, error: error.code }
      const state = await deps.states.get(project.id, feed)
      await deps.states.set(project.id, feed, { ...state, lastRun: run })
      return run
    } finally {
      running.delete(lock)
    }
  }

  async function configured(project: Project): Promise<FeedName[]> {
    const sources = await deps.settings.load(project.folder)
    return FEED_NAMES.filter((feed) => sources[feed] !== null)
  }

  async function choices(
    project: Project,
    feed: FeedName,
    config: FeedConfig,
    secret: string | null,
  ): Promise<FeedChoices> {
    const credential = secret?.trim() || (await deps.secrets.get(secretKey(project, feed)))
    if (!credential) throw new DomainError('secret_missing', feed)
    return deps.reader.choices(feed, config, credential)
  }

  return { view, save, choices, sync, configured }
}

type Counts = Pick<SourceRun, 'written' | 'unchanged'>
