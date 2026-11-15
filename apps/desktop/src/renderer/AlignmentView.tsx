import type { AlignmentFile, AlignmentView as View } from '@octo/application'
import type { AlignedPair, AlignmentSettings, Project, StateGroup } from '@octo/domain'
import { type ReactNode, useEffect, useState } from 'react'
import type { ErrorCode, OctoApi } from '../shared/api.ts'
import { LineProblems } from './LineProblems.tsx'
import { type LineProblem, type Lines, readLines } from './lines.ts'
import { dateText, errorText, messages } from './messages.ts'
import { listOf, listText } from './progress-text.ts'

type AlignmentApi = Pick<
  OctoApi,
  | 'alignmentSettings'
  | 'saveAlignmentSettings'
  | 'alignmentView'
  | 'exportMissingTickets'
  | 'openEvidence'
>

type Props = { api: AlignmentApi; project: Project }

const text = messages.alignment
const GROUP_NAME_SEPARATOR = ':'
const GROUP_SIDES_SEPARATOR = '='

/** `name: client states = ticket states`, one group per line. */
export function stateGroupsOf(typed: string): Lines<StateGroup> {
  return readLines(typed, (line) => {
    const at = line.indexOf(GROUP_NAME_SEPARATOR)
    const [item = '', ticket = '', ...rest] = line.slice(at + 1).split(GROUP_SIDES_SEPARATOR)
    const group = { name: line.slice(0, at).trim(), item: listOf(item), ticket: listOf(ticket) }
    const whole = at > 0 && rest.length === 0 && group.item.length > 0 && group.ticket.length > 0
    return whole ? { value: group } : { reason: 'shape' }
  })
}

export const stateGroupLines = (groups: readonly StateGroup[]): string =>
  groups
    .map(
      (group) =>
        `${group.name}${GROUP_NAME_SEPARATOR} ${listText(group.item)} ${GROUP_SIDES_SEPARATOR} ${listText(group.ticket)}`,
    )
    .join('\n')

/** The client's tracker and the supplier's own, compared sprint by sprint. */
export function AlignmentView({ api, project }: Props) {
  const [settings, setSettings] = useState<AlignmentSettings | null>(null)
  const [view, setView] = useState<View | null>(null)
  const [error, setError] = useState<ErrorCode | null>(null)
  const [file, setFile] = useState<AlignmentFile | null>(null)

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
      if (result.value.sprint !== '') await loadView()
    })
  }, [api, project.id])

  async function save(next: AlignmentSettings) {
    setError(null)
    const result = await api.saveAlignmentSettings(project.id, next)
    if (!result.ok) return setError(result.code)
    setSettings(result.value)
    if (result.value.sprint !== '') await loadView()
  }

  async function exportMissing() {
    setError(null)
    const result = await api.exportMissingTickets(project.id)
    if (result.ok) setFile(result.value)
    else setError(result.code)
  }

  if (settings === null) {
    return error ? <Failure code={error} /> : <p className="progress">{text.loading}</p>
  }
  const form = <SettingsForm settings={settings} sprints={view?.sprints ?? []} onSave={save} />

  return (
    <div className="dashboard">
      {error && <Failure code={error} />}
      <p className="hint">{text.intro}</p>
      {view && (
        <Result
          view={view}
          file={file}
          onExport={() => void exportMissing()}
          onOpen={(path) => void api.openEvidence(project.id, path)}
        />
      )}
      {view ? (
        <details className="dashboard-settings">
          <summary>{text.settings}</summary>
          {form}
        </details>
      ) : (
        <section aria-label={text.settings}>
          <h3>{text.settings}</h3>
          {form}
        </section>
      )}
    </div>
  )
}

function Failure({ code }: { code: ErrorCode }) {
  return (
    <p className="warning" role="alert">
      {errorText(code)}
    </p>
  )
}

function List({
  title,
  intro,
  columns,
  rows,
  children,
}: {
  title: string
  intro?: string
  columns: string[]
  rows: Array<{ key: string; cells: ReactNode[] }>
  children?: ReactNode
}) {
  return (
    <section aria-label={title}>
      <h3>
        {title} ({rows.length})
      </h3>
      {intro && rows.length > 0 && <p className="hint">{intro}</p>}
      {rows.length === 0 ? (
        <p className="hint">{text.none}</p>
      ) : (
        <table className="data">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key}>
                {row.cells.map((cell, at) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: a cell is its column.
                  <td key={at}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {children}
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
  const pairRow = (pair: AlignedPair, extra: ReactNode[] = []) => ({
    key: pair.item.id,
    cells: [
      pair.item.id,
      pair.item.title,
      keysOf(pair),
      statesOf(pair),
      <Coherence key="coherence" value={pair.coherent} />,
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
        rows={alignment.needsUpdate.map((pair) =>
          pairRow(pair, [pair.tickets.map((ticket) => ticket.sprint ?? text.noSprint).join(', ')]),
        )}
      />
      <List
        title={text.linkedTitle}
        columns={pairColumns}
        rows={alignment.linked.map((pair) => pairRow(pair))}
      />
      <List
        title={text.duplicatesTitle}
        columns={[text.columnItem, text.columnTitle, text.columnTicket]}
        rows={alignment.duplicates.map((pair) => ({
          key: pair.item.id,
          cells: [pair.item.id, pair.item.title, keysOf(pair)],
        }))}
      />
      <List
        title={text.orphansTitle}
        columns={[text.columnTicket, text.columnTitle, text.columnIds, text.columnReason]}
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
      <List
        title={text.suggestionsTitle}
        intro={text.suggestionsIntro}
        columns={[text.columnItem, text.columnTitle, text.columnTicket, text.columnScore]}
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
      <List
        title={text.unreferencedTitle}
        columns={[text.columnTicket, text.columnTitle, text.columnState]}
        rows={alignment.unreferenced.map((ticket) => ({
          key: ticket.key,
          cells: [ticket.key, ticket.title, ticket.status],
        }))}
      />
    </>
  )
}

type Draft = {
  sprint: string
  period: string
  tags: string
  exportPath: string
  ticketFolder: string
  referencePrefixes: string
  stateGroups: string
}

const draftOf = (settings: AlignmentSettings): Draft => ({
  sprint: settings.sprint,
  period: settings.period,
  tags: listText(settings.tags),
  exportPath: settings.exportPath,
  ticketFolder: settings.ticketFolder,
  referencePrefixes: listText(settings.referencePrefixes),
  stateGroups: stateGroupLines(settings.stateGroups),
})

function SettingsForm({
  settings,
  sprints,
  onSave,
}: {
  settings: AlignmentSettings
  sprints: string[]
  onSave: (settings: AlignmentSettings) => Promise<void>
}) {
  const [draft, setDraft] = useState<Draft>(() => draftOf(settings))
  const [unread, setUnread] = useState<LineProblem[]>([])
  useEffect(() => setDraft(draftOf(settings)), [settings])
  const set = (name: keyof Draft, value: string) =>
    setDraft((current) => ({ ...current, [name]: value }))
  const input = (name: keyof Draft, label: string, options: string[] = []) => (
    <label>
      {label}
      <input
        type="text"
        list={options.length > 0 ? `alignment-${name}` : undefined}
        value={draft[name]}
        onChange={(event) => set(name, event.target.value)}
      />
      {options.length > 0 && (
        <datalist id={`alignment-${name}`}>
          {options.map((option) => (
            <option key={option} value={option} />
          ))}
        </datalist>
      )}
    </label>
  )
  return (
    <form
      className="settings-form"
      onSubmit={(event) => {
        event.preventDefault()
        const stateGroups = stateGroupsOf(draft.stateGroups)
        setUnread(stateGroups.problems)
        if (stateGroups.problems.length > 0) return
        void onSave({
          ...settings,
          sprint: draft.sprint,
          period: draft.period,
          tags: listOf(draft.tags),
          exportPath: draft.exportPath,
          ticketFolder: draft.ticketFolder,
          referencePrefixes: listOf(draft.referencePrefixes),
          stateGroups: stateGroups.values,
        })
      }}
    >
      {input('sprint', text.sprint, sprints)}
      {input('period', text.period)}
      {input('tags', text.tags)}
      {input('referencePrefixes', text.referencePrefixes)}
      <label>
        {text.stateGroups}
        <textarea
          value={draft.stateGroups}
          onChange={(event) => set('stateGroups', event.target.value)}
        />
      </label>
      <LineProblems problems={unread} shape={text.shapes.stateGroups} />
      <p className="hint">{text.stateGroupsHint}</p>
      {input('exportPath', text.exportPath)}
      {input('ticketFolder', text.ticketFolder)}
      <div className="actions">
        <button type="submit" disabled={draft.sprint.trim() === ''}>
          {text.save}
        </button>
        {draft.sprint.trim() === '' && <span className="hint">{text.saveNeeds}</span>}
        {unread.length > 0 && (
          <span className="field-problems" role="status">
            {messages.lines.notSaved}
          </span>
        )}
      </div>
    </form>
  )
}
