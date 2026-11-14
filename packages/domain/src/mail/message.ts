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
}

/** A mail as the archive of the mail program lists it: where it is filed and when it arrived. */
export interface ArchivedMail {
  /** What the archive calls the message: unique inside it. */
  readonly id: string
  /** The folder it is filed in, as a path: `Posta in arrivo/Clienti`. */
  readonly folder: string
  readonly receivedAt: Date
}
