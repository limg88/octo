/** Someone a mail names: who wrote it or who it was sent to. */
export interface MailPerson {
  readonly name: string
  readonly email: string
}

/** What a mail says, whatever program keeps it. */
export interface MailMessage {
  /** The `Message-ID` of the mail without its angle brackets, or null when it has none. */
  readonly messageId: string | null
  readonly subject: string
  readonly from: MailPerson | null
  readonly to: readonly MailPerson[]
  readonly cc: readonly MailPerson[]
  readonly sentAt: Date | null
  /** The body as text: the plain part, or the HTML one without its markup. */
  readonly text: string
  /** The names of the files attached; their content is not read. */
  readonly attachments: readonly string[]
  /** The method of a calendar part (`REQUEST`, `REPLY`, `CANCEL`), or null for an ordinary mail. */
  readonly calendarMethod: string | null
  /** The `Message-ID` this mail answers, without its angle brackets; absent or null: none. */
  readonly inReplyTo?: string | null
  /** The `Message-ID`s of the conversation before this mail, oldest first. */
  readonly references?: readonly string[]
  /** The meeting a calendar part invites to; absent or null: none, or one that cannot be read. */
  readonly meeting?: MailMeeting | null
}

/** A meeting as an invitation carries it. */
export interface MailMeeting {
  /** What tells this meeting from any other: a later invitation with the same id replaces it. */
  readonly uid: string
  readonly summary: string
  /** When it starts and ends, as instants. */
  readonly start: string
  readonly end: string | null
  readonly location: string
}

/** A mail as the archive of the mail program lists it: where it is filed and when it arrived. */
export interface ArchivedMail {
  /** What the archive calls the message: unique inside it. */
  readonly id: string
  /** The folder it is filed in, as a path: `Posta in arrivo/Clienti`. */
  readonly folder: string
  readonly receivedAt: Date
}
