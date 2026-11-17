import {
  cleanMailSource,
  DomainError,
  folderWanted,
  type MailPreview,
  type MailSourceConfig,
  mailAllowed,
  mailDocument,
  mailWanted,
  type Project,
  parseMailDocument,
  type Reader,
  type SourceRun,
  type SourceState,
  startOfDay,
} from '@octo/domain'
import type {
  Clock,
  MailArchive,
  MemoryWriter,
  ProjectFiles,
  SourceSettings,
  SourceStates,
} from './ports.ts'
import type { ReadingKind, ReadingOptions, Readings } from './readings.ts'

/** The mail is of the archive of one computer: its turn is its own. */
const MAIL: ReadingKind = { source: 'mail', ownToComputer: true }

export type SourcesDeps = {
  settings: SourceSettings
  states: SourceStates
  /** The turns of the readings, between the computers that share the folder of a project. */
  readings: Readings
  archive: MailArchive
  writer: MemoryWriter
  clock: Clock
  /** With the files of the project, an answer to a mail already taken is taken too. */
  files?: Pick<ProjectFiles, 'under' | 'readText'>
}

/** What the Sources page shows for the mail of a project. */
export type MailSourceView = {
  config: MailSourceConfig | null
  /** The folder proposed when the PM configures the mail for the first time. */
  suggestedFolder: string
  /** The last reading: of this computer, or the last good one of whoever shares the folder. */
  state: SourceState
  /** Who made that reading, when it was made from another computer. */
  readBy: Reader | null
  /** Who is writing the mail of the project from another computer right now. */
  readingBy: Reader | null
  /** Whether this computer has a mail program Octo reads. */
  readableHere: boolean
}

export type Sources = {
  mail(project: Project): Promise<MailSourceView>
  saveMail(project: Project, config: MailSourceConfig | null): Promise<MailSourceView>
  /** What these rules would bring in from the archive, without writing anything. */
  previewMail(project: Project, config: MailSourceConfig): Promise<MailPreview>
  /** Reads the new mail into the project folder. One reading per project at a time. */
  syncMail(project: Project, options?: ReadingOptions): Promise<SourceRun>
  /** Whether the mail of the project is configured. */
  hasMail(project: Project): Promise<boolean>
  /** Whether a periodic reading takes the mail here: configured, and this computer has it. */
  mailReadableHere(project: Project): Promise<boolean>
}

/**
 * A mail can reach the archive after later ones (a slow download, a second computer), so each
 * reading goes back this far. What is already written is found unchanged.
 */
/** Subjects shown in a preview: enough to judge the rules, few enough to read. */
export const PREVIEW_SUBJECTS = 5

export const MAIL_OVERLAP_MS = 2 * 24 * 60 * 60 * 1000

export function createSources(deps: SourcesDeps): Sources {
  async function mail(project: Project): Promise<MailSourceView> {
    const config = (await deps.settings.load(project.folder)).mail
    return {
      config,
      suggestedFolder: await deps.settings.suggestMailFolder(project.folder),
      ...(await deps.readings.view(project, 'mail')),
      readableHere: deps.archive.available,
    }
  }

  async function saveMail(
    project: Project,
    config: MailSourceConfig | null,
  ): Promise<MailSourceView> {
    const current = await deps.settings.load(project.folder)
    const cleaned = config ? cleanMailSource(config) : null
    await deps.settings.save(project.folder, { ...current, mail: cleaned })
    // Other rules or another first day select other mail: the next reading starts over.
    const state = await deps.states.get(project.id, 'mail')
    await deps.states.set(project.id, 'mail', { ...state, cursor: null })
    return mail(project)
  }

  /** The ids of the mail the project already holds, to recognise what answers it. */
  async function knownIds(project: Project, config: MailSourceConfig): Promise<Set<string>> {
    const ids = new Set<string>()
    if (!deps.files) return ids
    for (const path of await deps.files.under(project.folder, config.targetFolder)) {
      const content = await deps.files.readText(project.folder, path)
      const mail = content === null ? null : parseMailDocument(path, content)
      if (mail) ids.add(mail.id)
    }
    return ids
  }

  async function read(
    project: Project,
    config: MailSourceConfig,
    from: Date,
    to: Date,
  ): Promise<Pick<SourceRun, 'written' | 'unchanged'>> {
    const seen = new Set<string>()
    const counts = { written: 0, unchanged: 0 }
    const known = await knownIds(project, config)
    for (const archived of await deps.archive.between(from, to)) {
      if (!folderWanted(archived.folder, config)) continue
      const message = await deps.archive.read(archived)
      if (!message) continue
      // An answer in a conversation of the project is of the project, whatever words it uses.
      const answersKnown = [message.inReplyTo, ...(message.references ?? [])].some(
        (id) => id != null && known.has(id),
      )
      if (!mailWanted(message, config) && !(answersKnown && mailAllowed(message, config))) continue
      const document = mailDocument(archived, message, config)
      known.add(document.externalId)
      // A mail filed in several folders (received and sent) is one mail.
      if (seen.has(document.externalId)) continue
      seen.add(document.externalId)
      const path = `${config.targetFolder}/${document.relativePath}`
      counts[await deps.writer.write(project.folder, path, document.content)] += 1
    }
    return counts
  }

  async function syncMail(project: Project, options: ReadingOptions = {}): Promise<SourceRun> {
    const config = (await deps.settings.load(project.folder)).mail
    if (!config) throw new DomainError('source_not_configured', 'mail')
    // A failure leaves the cursor where it was: the next reading tries the same days again.
    return deps.readings.run(project, MAIL, options, async ({ cursor }) => {
      const now = deps.clock.now()
      const since = startOfDay(config.since)
      const resume = cursor ? new Date(Date.parse(cursor) - MAIL_OVERLAP_MS) : since
      const from = resume.getTime() > since.getTime() ? resume : since
      return { ...(await read(project, config, from, now)), cursor: now.toISOString() }
    })
  }

  async function previewMail(_project: Project, raw: MailSourceConfig): Promise<MailPreview> {
    const config = cleanMailSource(raw)
    const seen = new Map<string, string>()
    for (const archived of await deps.archive.between(startOfDay(config.since), deps.clock.now())) {
      if (!folderWanted(archived.folder, config)) continue
      const message = await deps.archive.read(archived)
      if (!message || !mailWanted(message, config)) continue
      const document = mailDocument(archived, message, config)
      seen.set(document.externalId, message.subject)
    }
    // The archive lists oldest first: the last ones are the newest.
    const subjects = [...seen.values()].slice(-PREVIEW_SUBJECTS).reverse()
    return { count: seen.size, subjects }
  }

  return {
    mail,
    saveMail,
    previewMail,
    syncMail,
    hasMail: async (project) => (await deps.settings.load(project.folder)).mail !== null,
    mailReadableHere: async (project) =>
      deps.archive.available && (await deps.settings.load(project.folder)).mail !== null,
  }
}
