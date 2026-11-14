/** An item of the client's tracker, as far as the alignment needs it. */
export type AlignItem = {
  id: string
  title: string
  type: string
  state: string
  sprint: string | null
  period: string | null
  tags: string[]
  assignee: string | null
  description: string
}

/** A ticket of the supplier's own tracker. */
export type AlignTicket = {
  key: string
  title: string
  type: string
  status: string
  /** The sprint it is in now, and every sprint it has been in. */
  sprint: string | null
  sprints: string[]
  assignee: string | null
}

/** States of the two trackers that mean the same thing, under a name of the PM. */
export type StateGroup = { name: string; item: string[]; ticket: string[] }

/** How a project compares the client's tracker with its own, sprint by sprint. */
export type AlignmentSettings = {
  /** The sprint compared, as both trackers call it. */
  sprint: string
  /** The planning period of the client's items; empty: any. */
  period: string
  /** Tags that mark the client's items that are the supplier's; none: all of them. */
  tags: string[]
  /** The export of the client's tracker, a file of the project. Empty: the one the dashboard reads. */
  exportPath: string
  /** The folder of the project where the tickets are kept, one file each. Empty: the Jira feed's. */
  ticketFolder: string
  /** What comes before the id of a client's item in the title of a ticket: `[AZDO 123]`. */
  referencePrefixes: string[]
  stateGroups: StateGroup[]
  /** The type of a client's item and the type its ticket takes. */
  typeMap: Array<{ item: string; ticket: string }>
}

export const DEFAULT_ALIGNMENT_SETTINGS: AlignmentSettings = {
  sprint: '',
  period: '',
  tags: [],
  exportPath: '',
  ticketFolder: '',
  referencePrefixes: ['AZDO', 'ADO'],
  stateGroups: [],
  typeMap: [
    { item: 'User Story', ticket: 'Story' },
    { item: 'Bug', ticket: 'Bug' },
  ],
}

const PREFIX = /^[A-Za-z][A-Za-z0-9_]{0,19}$/

const cleanList = (values: readonly string[]): string[] => [
  ...new Set(values.map((value) => value.trim()).filter((value) => value !== '')),
]

/** Settings as the PM typed them, made tidy. */
export function cleanAlignmentSettings(settings: AlignmentSettings): AlignmentSettings {
  return {
    sprint: settings.sprint.trim(),
    period: settings.period.trim(),
    tags: cleanList(settings.tags),
    exportPath: settings.exportPath.trim(),
    ticketFolder: settings.ticketFolder.trim(),
    referencePrefixes: cleanList(settings.referencePrefixes)
      .filter((prefix) => PREFIX.test(prefix))
      .map((prefix) => prefix.toUpperCase()),
    stateGroups: settings.stateGroups
      .map((group) => ({
        name: group.name.trim(),
        item: cleanList(group.item),
        ticket: cleanList(group.ticket),
      }))
      .filter((group) => group.name !== '' && group.item.length > 0 && group.ticket.length > 0),
    typeMap: settings.typeMap
      .map((pair) => ({ item: pair.item.trim(), ticket: pair.ticket.trim() }))
      .filter((pair) => pair.item !== '' && pair.ticket !== ''),
  }
}
