import {
  type Assignment,
  assignmentOf,
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
  type Identity,
  isConflictCopy,
  isDomainError,
  OCTO_FOLDER,
  type Project,
  type Reader,
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
} from './ports.ts'
import type {
  ReadingCounts,
  ReadingFrom,
  ReadingOptions,
  ReadingResult,
  Readings,
} from './readings.ts'

export type FeedsDeps = {
  settings: SourceSettings
  /** The turns of the readings, between the computers that share the folder of a project. */
  readings: Readings
  indexes: FeedIndexes
  secrets: SecretVault
  reader: FeedReader
  writer: MemoryWriter
  files: ProjectFiles
  clock: Clock
  /** Who uses Octo: the company system is read as that person, not as an address typed by hand. */
  identity?: () => Identity | null
}

/** What the Sources page shows for one feed of a project. */
export type FeedView<Name extends FeedName = FeedName> = {
  feed: Name
  config: FeedConfigs[Name] | null
  suggestedFolder: string
  /** Whether a credential is kept on this computer. It is never shown again. */
  hasSecret: boolean
  /** The last reading: of this computer, or the last good one of whoever shares the folder. */
  state: SourceState
  /** Who made that reading, when it was made from another computer. */
  readBy: Reader | null
  /** Who is reading the feed from another computer right now. */
  readingBy: Reader | null
  /** The address of who is signed in, proposed where a feed asks whose reading it is. */
  suggestedOwner?: string
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
  /**
   * Reads what changed into the project folder, going on from where the last reading stopped,
   * whoever made it. One reading per project and feed at a time, on every computer that shares
   * the folder.
   */
  sync(project: Project, feed: FeedName, options?: ReadingOptions): Promise<SourceRun>
  /** The feeds configured for a project. */
  configured(project: Project): Promise<FeedName[]>
  /**
   * The feeds this computer can read: configured, and with a credential kept here. A periodic
   * reading takes these; the others are read by who has their credential.
   */
  readableHere(project: Project): Promise<FeedName[]>
  /** Where the project stands for who is signed in, by its codes in the company system. */
  assignment(project: Project): Promise<Assignment>
}

/** Where the credential of a feed of a project is kept in the vault. */
export const secretKey = (project: Project, feed: FeedName): string => `${project.id}/${feed}`

/**
 * The settings of the sources as the person signed in reads them: the company system is bound to
 * who uses Octo, also for what reads its configuration without passing through the feeds.
 */
export function settingsOwnedBy(
  settings: SourceSettings,
  identity: () => Identity | null,
): SourceSettings {
  return {
    ...settings,
    async load(projectFolder) {
      const config = await settings.load(projectFolder)
      const person = identity()
      if (config.dwsi === null || person === null) return config
      // Somebody is signed in: the address kept in the project is never used in their place.
      // Without an address of their own, nothing of the company system is theirs.
      return { ...config, dwsi: { ...config.dwsi, ownerEmail: person.email } }
    },
  }
}

export function createFeeds(deps: FeedsDeps): Feeds {
  /** The address of who is signed in; null only when nobody is, never when they have none. */
  const ownerEmail = (): string | null => deps.identity?.()?.email ?? null

  /**
   * The configuration as the person signed in: the reading of the company system is bound to
   * who uses Octo, whatever address the configuration was saved with.
   */
  function owned<Config extends FeedConfig>(feed: FeedName, config: Config): Config {
    const email = ownerEmail()
    return feed === 'dwsi' && email !== null ? { ...config, ownerEmail: email } : config
  }

  async function view<Name extends FeedName>(
    project: Project,
    feed: Name,
  ): Promise<FeedView<Name>> {
    const sources = await deps.settings.load(project.folder)
    const stored = sources[feed] as FeedConfigs[Name] | null
    return {
      feed,
      config: stored === null ? null : owned(feed, stored),
      suggestedOwner: ownerEmail() ?? '',
      suggestedFolder: await deps.settings.suggestFeedFolder(project.folder, feed),
      hasSecret: (await deps.secrets.get(secretKey(project, feed))) !== null,
      ...(await deps.readings.view(project, feed)),
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
    const cleaned = cleanFeedConfig(feed, owned(feed, config))
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
    counts: ReadingCounts,
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

  /**
   * Removes the copies a sync client left in the folder of the feed when two computers wrote the
   * same file at once. Only inside Octo's own folder: elsewhere a file may be the PM's.
   */
  async function removeConflictCopies(
    project: Project,
    folder: string,
    items: FeedIndex,
  ): Promise<void> {
    if (!folder.startsWith(`${OCTO_FOLDER}/`)) return
    const held = new Set(Object.values(items).map((item) => item.path))
    held.add(`${folder}/${FEED_NOTE_FILE}`)
    for (const path of await deps.files.under(project.folder, folder)) {
      if (isConflictCopy(path, held)) await deps.files.remove(project.folder, path)
    }
  }

  async function read(
    project: Project,
    feed: FeedName,
    config: FeedConfig,
    from: ReadingFrom,
  ): Promise<ReadingResult> {
    const secret = await deps.secrets.get(secretKey(project, feed))
    if (!secret) throw new DomainError('secret_missing', feed)
    const scope = feedScope(feed, config)
    const index = await deps.indexes.load(project.folder, feed)
    const sameScope = index.scope === scope
    if (!sameScope) await clear(project, index.items)
    const items: FeedIndex = sameScope ? { ...index.items } : {}
    let cursor: unknown = sameScope && from.cursor ? JSON.parse(from.cursor) : null
    let dataAsOf: Date | null = null
    const counts: ReadingCounts = { written: 0, unchanged: 0 }
    const signal = new AbortController().signal
    for await (const step of deps.reader.read(feed, config, secret, cursor, signal)) {
      await apply(project, config.targetFolder, step, items, counts)
      cursor = step.cursor
      dataAsOf = step.dataAsOf ?? dataAsOf
      // Saved at every step: a reading that stops half way goes on from here.
      await deps.indexes.save(project.folder, feed, scope, items)
      await from.checkpoint(JSON.stringify(cursor))
    }
    const note = feedNote(feed, {
      readAt: deps.clock.now(),
      dataAsOf,
      items: Object.keys(items).length,
    })
    await deps.writer.write(project.folder, `${config.targetFolder}/${FEED_NOTE_FILE}`, note)
    await removeConflictCopies(project, config.targetFolder, items)
    return { ...counts, cursor: cursor === null ? null : JSON.stringify(cursor) }
  }

  async function sync(
    project: Project,
    feed: FeedName,
    options: ReadingOptions = {},
  ): Promise<SourceRun> {
    const stored = (await deps.settings.load(project.folder))[feed]
    if (!stored) throw new DomainError('source_not_configured', feed)
    const config = owned(feed, stored)
    return deps.readings.run(project, { source: feed }, options, (from) =>
      read(project, feed, config, from),
    )
  }

  async function configured(project: Project): Promise<FeedName[]> {
    const sources = await deps.settings.load(project.folder)
    return FEED_NAMES.filter((feed) => sources[feed] !== null)
  }

  async function readableHere(project: Project): Promise<FeedName[]> {
    const here: FeedName[] = []
    for (const feed of await configured(project)) {
      if ((await deps.secrets.get(secretKey(project, feed))) !== null) here.push(feed)
    }
    return here
  }

  async function choices(
    project: Project,
    feed: FeedName,
    config: FeedConfig,
    secret: string | null,
  ): Promise<FeedChoices> {
    const credential = secret?.trim() || (await deps.secrets.get(secretKey(project, feed)))
    if (!credential) throw new DomainError('secret_missing', feed)
    return deps.reader.choices(feed, owned(feed, config), credential)
  }

  /**
   * Whether the project is of who is signed in, by its project codes in the company system. When
   * the system is not set up, has no credential here or cannot be reached, nothing can be said.
   */
  async function assignment(project: Project): Promise<Assignment> {
    const stored = (await deps.settings.load(project.folder)).dwsi
    const secret = await deps.secrets.get(secretKey(project, 'dwsi'))
    if (stored === null || secret === null) return 'unknown'
    try {
      const mine = await deps.reader.choices('dwsi', owned('dwsi', stored), secret)
      return assignmentOf(
        stored.projectCodes,
        mine.projects.map((choice) => choice.value),
      )
    } catch (error) {
      if (!isDomainError(error)) throw error
      return 'unknown'
    }
  }

  return { view, save, choices, sync, configured, readableHere, assignment }
}
