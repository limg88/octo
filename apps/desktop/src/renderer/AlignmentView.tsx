import type { AlignmentChoices, AlignmentFile, AlignmentView as View } from '@octo/application'
import type { AlignedPair, AlignmentSettings, Project } from '@octo/domain'
import { type ReactNode, useEffect, useState } from 'react'
import type { ErrorCode, OctoApi, PathKind } from '../shared/api.ts'
import { type DataColumn, DataTable } from './DataTable.tsx'
import { Failure } from './Failure.tsx'
import { FieldProblems, NotSaved } from './FieldProblems.tsx'
import { KnownList } from './KnownList.tsx'
import { dateText, messages } from './messages.ts'
import { PathField } from './PathField.tsx'
import { listOf, listText } from './progress-text.ts'
import { blankRow, orOneRow, type Row, type RowsColumn, RowsField } from './RowsField.tsx'
import { useSavedNote } from './SavedNote.tsx'
import { Waiting } from './Spinner.tsx'
import type { Section } from './sections.ts'

type AlignmentApi = Pick<
  OctoApi,
  | 'alignmentSettings'
  | 'saveAlignmentSettings'
  | 'alignmentView'
  | 'alignmentChoices'
  | 'exportMissingTickets'
  | 'openEvidence'
  | 'chooseProjectPath'
>

type Props = {
  api: AlignmentApi
  project: Project
  /** Takes the PM to the section where an error is put right. */
  onOpenSection?: (section: Section) => void
}

const text = messages.alignment
const NO_CHOICES: AlignmentChoices = { sprints: [], periods: [], tags: [] }
type GroupKey = 'name' | 'item' | 'ticket'
/** A list of states takes the room there is, and never less than what a few of them need. */
const LIST_WIDTH = 'minmax(160px, 1fr)'
const GROUP_COLUMNS: RowsColumn<GroupKey>[] = [
  { key: 'name', label: text.groupColumns.name, width: '160px' },
  { key: 'item', label: text.groupColumns.item, kind: 'textarea', width: LIST_WIDTH },
  { key: 'ticket', label: text.groupColumns.ticket, kind: 'textarea', width: LIST_WIDTH },
]

/** The client's tracker and the supplier's own, compared sprint by sprint. */
export function AlignmentView({ api, project, onOpenSection }: Props) {
  const [settings, setSettings] = useState<AlignmentSettings | null>(null)
  const [view, setView] = useState<View | null>(null)
  const [error, setError] = useState<ErrorCode | null>(null)
  const savedNote = useSavedNote()
  const [file, setFile] = useState<AlignmentFile | null>(null)
  const [choices, setChoices] = useState<AlignmentChoices>(NO_CHOICES)

  /** What there is to choose among is read again whenever the export may have changed. */
  async function loadChoices() {
    const result = await api.alignmentChoices(project.id)
    setChoices(result.ok ? result.value : NO_CHOICES)
  }

  async function loadView() {
    setFile(null)
    const result = await api.alignmentView(project.id)
    if (result.ok) setView(result.value)
    else {
      setView(null)
      setError(result.code)
    }
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new project starts from its settings.
  useEffect(() => {
    setSettings(null)
    setView(null)
    setError(null)
    setFile(null)
    void api.alignmentSettings(project.id).then(async (result) => {
      if (!result.ok) return setError(result.code)
      setSettings(result.value)
      void loadChoices()
      if (result.value.sprint !== '') await loadView()
    })
  }, [api, project.id])

  async function save(next: AlignmentSettings) {
    setError(null)
    savedNote.clear()
    const result = await api.saveAlignmentSettings(project.id, next)
    if (!result.ok) return setError(result.code)
    setSettings(result.value)
    savedNote.saved()
    void loadChoices()
    if (result.value.sprint !== '') await loadView()
  }

  async function exportMissing() {
    setError(null)
    const result = await api.exportMissingTickets(project.id)
    if (result.ok) setFile(result.value)
    else setError(result.code)
  }

  if (settings === null) {
    return error ? (
      <Failure code={error} onOpen={onOpenSection} />
    ) : (
      <div className="page-wait">
        <Waiting>{text.loading}</Waiting>
      </div>
    )
  }
  /** The export is a JSON file of the project, the tickets a folder of it. */
  async function choose(what: PathKind): Promise<string | null> {
    setError(null)
    const result = await api.chooseProjectPath(project.id, what, what === 'file' ? ['json'] : [])
    if (result.ok) return result.value
    setError(result.code)
    return null
  }
  const form = (
    <SettingsForm settings={settings} choices={choices} onSave={save} onChoose={choose} />
  )

  return (
    <div className="dashboard">
      {error && <Failure code={error} onOpen={onOpenSection} />}
      {savedNote.note}
      {view ? (
        <details className="dashboard-settings">
          <summary>{text.settings}</summary>
          <p className="hint">{text.intro}</p>
          {form}
        </details>
      ) : (
        <section aria-label={text.settings}>
          <h3>{text.settings}</h3>
          <p className="hint">{text.intro}</p>
          {form}
        </section>
      )}
      {/* The sprint is what changes every time: chosen here, without opening the settings. */}
      {view && choices.sprints.length > 0 && (
        <div className="range-fields">
          <label>
            {text.sprintNow}
            <select
              value={settings.sprint}
              onChange={(event) => void save({ ...settings, sprint: event.target.value })}
            >
              {withCurrent(choices.sprints, settings.sprint).map((sprint) => (
                <option key={sprint} value={sprint}>
                  {sprint}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}
      {view && (
        <Result
          view={view}
          file={file}
          onExport={() => void exportMissing()}
          onOpen={(path) => void api.openEvidence(project.id, path)}
        />
      )}
    </div>
  )
}

/** What a cell shows: plain words, or something drawn together with the words it stands for. */
type ListCell = string | { show: ReactNode; words: string }
type ListRow = { key: string; cells: ListCell[] }

const shownOf = (cell: ListCell | undefined): ReactNode =>
  typeof cell === 'object' ? cell.show : (cell ?? '')
const wordsOf = (cell: ListCell | undefined): string =>
  typeof cell === 'object' ? cell.words : (cell ?? '')

/** Widths of the columns that hold a short code, so that titles get the room. */
const ID_WIDTH = '80px'
const TICKET_WIDTH = '140px'
const STATE_WIDTH = '150px'
const PAIR_WIDTHS = [ID_WIDTH, undefined, TICKET_WIDTH, '220px', '110px']

function coherenceWords(value: boolean | null): string {
  if (value === null) return text.coherent.unknown
  return value ? text.coherent.yes : text.coherent.no
}

function List({
  title,
  intro,
  columns,
  widths = [],
  rows,
  folded = false,
  children,
}: {
  title: string
  intro?: string
  columns: string[]
  /** A CSS width for each column, in order; a column without one shares the room left. */
  widths?: ReadonlyArray<string | undefined>
  rows: ListRow[]
  /** A list read for reference, not acted upon: one line that opens. */
  folded?: boolean
  children?: ReactNode
}) {
  const table = (
    <DataTable
      label={title}
      columns={columns.map(
        (label, at): DataColumn<ListRow> => ({
          key: String(at),
          label,
          width: widths[at],
          cell: (row) => shownOf(row.cells[at]),
          sort: (row) => wordsOf(row.cells[at]),
          text: (row) => wordsOf(row.cells[at]),
        }),
      )}
      rows={rows}
      rowKey={(row) => row.key}
    />
  )
  if (folded) {
    return (
      <details className="request">
        <summary>
          <strong>
            {title} ({rows.length})
          </strong>
        </summary>
        <section aria-label={title}>{table}</section>
      </details>
    )
  }
  return (
    <section aria-label={title}>
      <h3>
        {title} ({rows.length})
      </h3>
      {intro && rows.length > 0 && <p className="hint">{intro}</p>}
      {children}
      {rows.length === 0 ? <p className="hint">{text.none}</p> : table}
    </section>
  )
}

const keysOf = (pair: AlignedPair): string => pair.tickets.map((ticket) => ticket.key).join(', ')
const statesOf = (pair: AlignedPair): string =>
  `${pair.item.state} → ${pair.tickets.map((ticket) => ticket.status).join(', ')}`

function Coherence({ value }: { value: boolean | null }) {
  if (value === null) return <span>{text.coherent.unknown}</span>
  return (
    <span className={value ? 'status status-ok' : 'status status-warning'}>
      {value ? text.coherent.yes : text.coherent.no}
    </span>
  )
}

function Result({
  view,
  file,
  onExport,
  onOpen,
}: {
  view: View
  file: AlignmentFile | null
  onExport: () => void
  onOpen: (path: string) => void
}) {
  const { alignment } = view
  const pairRow = (pair: AlignedPair, extra: ListCell[] = []): ListRow => ({
    key: pair.item.id,
    cells: [
      pair.item.id,
      pair.item.title,
      keysOf(pair),
      statesOf(pair),
      { show: <Coherence value={pair.coherent} />, words: coherenceWords(pair.coherent) },
      ...extra,
    ],
  })
  const pairColumns = [
    text.columnItem,
    text.columnTitle,
    text.columnTicket,
    text.columnStates,
    text.columnCoherent,
  ]
  /** The lists of things to look at that hold nothing: said in one line, not one each. */
  const quiet = [
    ...(alignment.duplicates.length === 0 ? [text.duplicatesTitle] : []),
    ...(alignment.orphans.length === 0 ? [text.orphansTitle] : []),
    ...(alignment.suggestions.length === 0 ? [text.suggestionsTitle] : []),
  ]
  return (
    <>
      <p>
        {text.summary(
          alignment.total,
          alignment.linked.length,
          alignment.needsUpdate.length,
          alignment.missing.length,
        )}
      </p>
      {view.stateMismatches.length > 0 && (
        <details className="warning alignment-mismatches">
          <summary>{text.stateMismatchSummary(view.stateMismatches.length)}</summary>
          <ul>
            {view.stateMismatches.map((mismatch) => (
              <li key={`${mismatch.group} ${mismatch.state}`}>
                {text.stateMismatch(
                  mismatch.state,
                  mismatch.group,
                  text.phaseNames[mismatch.dashboardPhase],
                )}
              </li>
            ))}
          </ul>
          <p>{text.stateMismatchHelp}</p>
        </details>
      )}
      {alignment.adds ? (
        <p className="badge badge-ok">{text.adds}</p>
      ) : (
        <p className="warning" role="alert">
          {text.doesNotAdd}
        </p>
      )}
      <p className="hint">
        {text.data(view.exportedAt ? dateText(view.exportedAt) : text.noDate, view.tickets)}
      </p>
      <List
        title={text.missingTitle}
        columns={[text.columnItem, text.columnTitle, text.columnType, text.columnState]}
        widths={[ID_WIDTH, undefined, STATE_WIDTH, STATE_WIDTH]}
        rows={alignment.missing.map((item) => ({
          key: item.id,
          cells: [item.id, item.title, item.type, item.state],
        }))}
      >
        {alignment.missing.length > 0 && (
          <div className="actions">
            <button type="button" className="primary" onClick={onExport}>
              {text.exportMissing}
            </button>
          </div>
        )}
        {file && (
          <p className="badge badge-ok">
            {text.exported(file.rows, file.path)}{' '}
            <button type="button" className="quiet" onClick={() => onOpen(file.path)}>
              {text.open}
            </button>
          </p>
        )}
      </List>
      <List
        title={text.needsUpdateTitle}
        columns={[...pairColumns, text.columnTicketSprint]}
        widths={[...PAIR_WIDTHS, STATE_WIDTH]}
        rows={alignment.needsUpdate.map((pair) =>
          pairRow(pair, [pair.tickets.map((ticket) => ticket.sprint ?? text.noSprint).join(', ')]),
        )}
      />
      {alignment.duplicates.length > 0 && (
        <List
          title={text.duplicatesTitle}
          columns={[text.columnItem, text.columnTitle, text.columnTicket]}
          widths={[ID_WIDTH, undefined, '260px']}
          rows={alignment.duplicates.map((pair) => ({
            key: pair.item.id,
            cells: [pair.item.id, pair.item.title, keysOf(pair)],
          }))}
        />
      )}
      {alignment.orphans.length > 0 && (
        <List
          title={text.orphansTitle}
          columns={[text.columnTicket, text.columnTitle, text.columnIds, text.columnReason]}
          widths={[TICKET_WIDTH, undefined, STATE_WIDTH, '220px']}
          rows={alignment.orphans.map((orphan) => ({
            key: orphan.ticket.key,
            cells: [
              orphan.ticket.key,
              orphan.ticket.title,
              orphan.ids.join(', '),
              text.reason[orphan.reason],
            ],
          }))}
        />
      )}
      {alignment.suggestions.length > 0 && (
        <List
          title={text.suggestionsTitle}
          intro={text.suggestionsIntro}
          columns={[text.columnItem, text.columnTitle, text.columnTicket, text.columnScore]}
          widths={[ID_WIDTH, undefined, undefined, STATE_WIDTH]}
          rows={alignment.suggestions.map((suggestion) => ({
            key: suggestion.item.id,
            cells: [
              suggestion.item.id,
              suggestion.item.title,
              `${suggestion.ticket.key} · ${suggestion.ticket.title}`,
              `${Math.round(suggestion.score * 100)}% (${text.confidence[suggestion.confidence]})`,
            ],
          }))}
        />
      )}
      {quiet.length > 0 && <p className="hint">{text.nothingIn(quiet.join(', '))}</p>}
      <List
        folded
        title={text.linkedTitle}
        columns={pairColumns}
        widths={PAIR_WIDTHS}
        rows={alignment.linked.map((pair) => pairRow(pair))}
      />
      <List
        folded
        title={text.unreferencedTitle}
        columns={[text.columnTicket, text.columnTitle, text.columnState]}
        widths={[TICKET_WIDTH, undefined, STATE_WIDTH]}
        rows={alignment.unreferenced.map((ticket) => ({
          key: ticket.key,
          cells: [ticket.key, ticket.title, ticket.status],
        }))}
      />
    </>
  )
}

/** The fields of the form that hold one typed value. */
type TextField = Exclude<keyof Draft, 'stateGroups' | 'tags' | 'ownPeopleOnly'>

/** The known values, with the one in use kept among them even when it is no longer known. */
const withCurrent = (known: readonly string[], current: string): string[] =>
  current === '' || known.includes(current) ? [...known] : [current, ...known]

type Draft = {
  sprint: string
  period: string
  tags: string[]
  ownPeopleOnly: boolean
  exportPath: string
  ticketFolder: string
  referencePrefixes: string
  stateGroups: Row<GroupKey>[]
}

const draftOf = (settings: AlignmentSettings): Draft => ({
  sprint: settings.sprint,
  period: settings.period,
  tags: settings.tags,
  ownPeopleOnly: settings.ownPeopleOnly,
  exportPath: settings.exportPath,
  ticketFolder: settings.ticketFolder,
  referencePrefixes: listText(settings.referencePrefixes),
  stateGroups: orOneRow(
    settings.stateGroups.map((group) => ({
      name: group.name,
      item: listText(group.item),
      ticket: listText(group.ticket),
    })),
    GROUP_COLUMNS,
  ),
})

function SettingsForm({
  settings,
  choices,
  onSave,
  onChoose,
}: {
  settings: AlignmentSettings
  /** What the client's export holds to choose from; empty lists while it is not known. */
  choices: AlignmentChoices
  onSave: (settings: AlignmentSettings) => Promise<void>
  onChoose: (what: PathKind) => Promise<string | null>
}) {
  const [draft, setDraft] = useState<Draft>(() => draftOf(settings))
  const [unread, setUnread] = useState<string[]>([])
  useEffect(() => setDraft(draftOf(settings)), [settings])
  const set = (name: TextField, value: string) =>
    setDraft((current) => ({ ...current, [name]: value }))
  const input = (name: TextField, label: string) => (
    <label>
      {label}
      <input type="text" value={draft[name]} onChange={(event) => set(name, event.target.value)} />
    </label>
  )
  return (
    <form
      className="settings-form"
      onSubmit={(event) => {
        event.preventDefault()
        const groups = draft.stateGroups
          .filter((row) => !blankRow(row))
          .map((row) => ({
            name: row.name.trim(),
            item: listOf(row.item),
            ticket: listOf(row.ticket),
          }))
        const wrong = draft.stateGroups.flatMap((row, index) =>
          blankRow(row) ||
          (row.name.trim() !== '' && listOf(row.item).length > 0 && listOf(row.ticket).length > 0)
            ? []
            : [text.groupWrong(index + 1)],
        )
        setUnread(wrong)
        if (wrong.length > 0) return
        void onSave({
          ...settings,
          sprint: draft.sprint,
          period: draft.period,
          tags: draft.tags,
          ownPeopleOnly: draft.ownPeopleOnly,
          exportPath: draft.exportPath,
          ticketFolder: draft.ticketFolder,
          referencePrefixes: listOf(draft.referencePrefixes),
          stateGroups: groups,
        })
      }}
    >
      {choices.sprints.length > 0 ? (
        <label>
          {text.sprint}
          <select value={draft.sprint} onChange={(event) => set('sprint', event.target.value)}>
            <option value="">{text.sprintChoose}</option>
            {withCurrent(choices.sprints, draft.sprint).map((sprint) => (
              <option key={sprint} value={sprint}>
                {sprint}
              </option>
            ))}
          </select>
        </label>
      ) : (
        input('sprint', text.sprint)
      )}
      {choices.periods.length > 0 ? (
        <label>
          {text.period}
          <select value={draft.period} onChange={(event) => set('period', event.target.value)}>
            <option value="">{text.periodAny}</option>
            {withCurrent(choices.periods, draft.period).map((period) => (
              <option key={period} value={period}>
                {period}
              </option>
            ))}
          </select>
        </label>
      ) : (
        input('period', text.period)
      )}
      <KnownList
        label={text.tags}
        known={choices.tags}
        chosen={draft.tags}
        onChange={(tags) => setDraft((current) => ({ ...current, tags }))}
        foldOptions
      />
      <label className="check">
        <input
          type="checkbox"
          checked={draft.ownPeopleOnly}
          onChange={(event) =>
            setDraft((current) => ({ ...current, ownPeopleOnly: event.target.checked }))
          }
        />
        {messages.ownPeopleOnly.label}
      </label>
      <p className="hint">{messages.ownPeopleOnly.hint}</p>
      {input('referencePrefixes', text.referencePrefixes)}
      <h4>{text.stateGroups}</h4>
      <p className="hint">{text.stateGroupsHint}</p>
      <RowsField
        label={text.stateGroups}
        columns={GROUP_COLUMNS}
        rows={draft.stateGroups}
        onChange={(stateGroups) => setDraft((current) => ({ ...current, stateGroups }))}
        addLabel={text.addGroup}
        cellLabel={(column, row) => text.groupCell(text.groupColumns[column], row)}
        removeLabel={text.removeGroup}
      />
      <FieldProblems lines={unread} />
      <PathField
        label={text.exportPath}
        value={draft.exportPath}
        onChange={(exportPath) => setDraft((current) => ({ ...current, exportPath }))}
        onChoose={() => onChoose('file')}
      />
      <PathField
        label={text.ticketFolder}
        value={draft.ticketFolder}
        onChange={(ticketFolder) => setDraft((current) => ({ ...current, ticketFolder }))}
        onChoose={() => onChoose('folder')}
      />
      <div className="actions">
        <button type="submit" disabled={draft.sprint.trim() === ''}>
          {text.save}
        </button>
        {draft.sprint.trim() === '' && <span className="hint">{text.saveNeeds}</span>}
        {unread.length > 0 && <NotSaved text={messages.notSaved} />}
      </div>
    </form>
  )
}
