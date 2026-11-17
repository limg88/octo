import type { Reminder, DashboardView as View } from '@octo/application'
import {
  activeFacets,
  BUG_FACETS,
  BUG_ORDERS,
  type BugCounts,
  type BugFacet,
  type BugOrder,
  type BugQuery,
  type BugRow,
  bugBreakdowns,
  filterBugs,
  isFiltered,
  isTelling,
  NO_BUG_QUERY,
  NOT_STATED,
} from '@octo/domain'
import { type FormEvent, useState } from 'react'
import type { Result } from '../shared/api.ts'
import { BUG_FILTERS, type BugFilter, type DashboardFocus } from './context.ts'
import { OpenItem, plain, useSeverityName } from './DashboardParts.tsx'
import { Waiting } from './DashboardWaiting.tsx'
import { dateText, messages } from './messages.ts'
import { useSelection } from './use-selection.ts'

const text = messages.dashboard

/** The rows a count lists: the open bugs, a part of them, or the validated ones. */
function rowsOf(view: View, filter: BugFilter): BugRow[] {
  const { open, validated } = view.bugs
  if (filter === 'validated') return validated
  if (filter === 'stuck') return open.filter((row) => row.stuck)
  if (filter === 'open') return open
  return open.filter((row) => row.phase === filter)
}

const BEFORE: Record<BugFilter, keyof BugCounts> = {
  open: 'open',
  work: 'work',
  verify: 'verify',
  stuck: 'stuck',
  validated: 'validated',
}

const valueName = (value: string): string => (value === NOT_STATED ? text.notStated : value)

type Props = {
  view: View
  stuckDays: number
  answerWorkdays: number
  focus: DashboardFocus
  onFocus: (focus: DashboardFocus) => void
  canAsk: boolean
  onAsk: ((question: string) => void) | undefined
  onNote: (id: string, note: string) => void
  onOpenItem: ((id: string) => void) | undefined
  onReminder: (id: string) => Promise<Result<Reminder>>
}

/**
 * The bugs of the project: each count opens its own list, the list is split by severity,
 * environment and person, and every split is a filter. Every count is the number of rows its
 * list holds before the filters; the list says how many of them the filters leave.
 */
export function DashboardBugs({
  view,
  stuckDays,
  answerWorkdays,
  focus,
  onFocus,
  canAsk,
  onAsk,
  onNote,
  onOpenItem,
  onReminder,
}: Props) {
  const severityName = useSeverityName()
  const facetName = (facet: BugFacet): string =>
    facet === 'severity' ? severityName : text.facetNames[facet]
  const counted = rowsOf(view, focus.filter)
  const rows = filterBugs(counted, focus.query)
  const breakdowns = bugBreakdowns(counted)
  const selectedId = useSelection(
    rows.map((row) => row.id),
    focus.bugId,
  )
  const selected = rows.find((row) => row.id === selectedId) ?? null
  const count = (filter: BugFilter) => rowsOf(view, filter).length
  const ask = (query: Partial<BugQuery>) =>
    onFocus({ ...focus, query: { ...focus.query, ...query } })
  const labels: Record<BugFilter, string> = {
    open: text.open,
    work: text.work,
    verify: text.verify,
    stuck: text.stuck(stuckDays),
    validated: text.validated,
  }
  const { before } = view.bugs
  // A field no bug states is not a split; it stays while it is the filter set.
  const facets = BUG_FACETS.filter(
    (facet) => isTelling(breakdowns[facet]) || focus.query[facet] !== null,
  )
  return (
    <section className="quality" aria-label={text.qualityTitle}>
      <h3>{text.qualityTitle}</h3>
      <fieldset className="metrics" aria-label={text.filterLabel}>
        {BUG_FILTERS.map((filter) => {
          const part = filter === 'work' || filter === 'verify' || filter === 'stuck'
          return (
            <button
              key={filter}
              type="button"
              className={focus.filter === filter ? 'metric metric-selected' : 'metric'}
              aria-pressed={focus.filter === filter}
              onClick={() => onFocus({ ...focus, filter })}
            >
              <span className="metric-value">{count(filter)}</span>
              <span className="metric-label">
                {part && <span className="metric-part">{text.ofWhich} </span>}
                {labels[filter]}
              </span>
              {filter === 'open' && (
                <span className="metric-part">{text.total(view.bugs.total)}</span>
              )}
              {before && (
                <span className="metric-part metric-delta">
                  {text.sinceStart(count(filter) - before[BEFORE[filter]])}
                </span>
              )}
            </button>
          )
        })}
      </fieldset>
      <p className="hint">
        {text.relation(count('open'), count('stuck'), count('validated'), stuckDays)}
        {!before && ` ${text.noHistoryDelta}`}
      </p>
      <Waiting
        view={view}
        answerWorkdays={answerWorkdays}
        canAsk={canAsk}
        onOpenItem={onOpenItem}
        onReminder={onReminder}
      />
      {facets.length > 0 && (
        <fieldset className="breakdowns" aria-label={text.breakdownsLabel}>
          {facets.map((facet) => (
            <div key={facet} className="breakdown">
              <h4>{text.facets[facet]}</h4>
              <ul>
                {breakdowns[facet].map((entry) => {
                  const chosen = focus.query[facet] === entry.value
                  return (
                    <li key={entry.value}>
                      <button
                        type="button"
                        className={chosen ? 'breakdown-row breakdown-chosen' : 'breakdown-row'}
                        aria-pressed={chosen}
                        aria-label={text.filterBy(facetName(facet), valueName(entry.value))}
                        onClick={() => ask({ [facet]: chosen ? null : entry.value })}
                      >
                        <span className="breakdown-value">{valueName(entry.value)}</span>
                        <span className="breakdown-count">{entry.count}</span>
                        <span className="breakdown-stuck">{text.ofWhichStuck(entry.stuck)}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </fieldset>
      )}
      <div className="bug-filters">
        <label className="bug-filter">
          {text.search}
          <input
            type="search"
            value={focus.query.text}
            onChange={(event) => ask({ text: event.target.value })}
          />
        </label>
        <label className="bug-filter">
          {text.order}
          <select
            value={focus.query.order}
            onChange={(event) => ask({ order: event.target.value as BugOrder })}
          >
            {BUG_ORDERS.map((order) => (
              <option key={order} value={order}>
                {order === 'severity' ? severityName : text.orders[order]}
              </option>
            ))}
          </select>
        </label>
        {isFiltered(focus.query) && (
          <div className="active-filters">
            <span className="hint">
              {text.activeFilters}: {text.shown(rows.length, counted.length)}
            </span>
            {activeFacets(focus.query).map((facet: BugFacet) => {
              const name = `${facetName(facet)}: ${valueName(focus.query[facet] ?? NOT_STATED)}`
              return (
                <button
                  key={facet}
                  type="button"
                  className="chip chip-selected"
                  aria-label={text.removeFilter(name)}
                  onClick={() => ask({ [facet]: null })}
                >
                  {name} ×
                </button>
              )
            })}
            <button
              type="button"
              className="quiet"
              onClick={() => ask({ ...NO_BUG_QUERY, order: focus.query.order })}
            >
              {text.clearFilters}
            </button>
          </div>
        )}
      </div>
      <div className="split">
        <div className="split-list">
          {rows.length === 0 ? (
            <p className="hint">
              {focus.filter === 'open' && !isFiltered(focus.query)
                ? text.noOpen
                : text.noneInFilter}
            </p>
          ) : (
            <ul
              className="entries entries-scroll"
              aria-label={`${text.bugList}: ${labels[focus.filter]}`}
            >
              {rows.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    className={row.id === selectedId ? 'entry entry-selected' : 'entry'}
                    aria-pressed={row.id === selectedId}
                    onClick={() => onFocus({ ...focus, bugId: row.id })}
                  >
                    <span className="entry-meta">
                      <span className="mono">#{row.id}</span>
                      <span>{row.assignee ?? text.unassigned}</span>
                      <span>{row.state}</span>
                      {row.severity && <span>{row.severity}</span>}
                      <span className={row.stuck ? 'pill pill-warning' : 'pill'}>
                        {text.days(row.daysInState)}
                        {row.stuck && ` · ${text.stuckBadge}`}
                      </span>
                    </span>
                    <strong className="entry-title">{row.title}</strong>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <section className="panel split-detail" aria-label={text.bugDetail}>
          {selected ? (
            <BugDetail
              key={selected.id}
              row={selected}
              onAsk={onAsk}
              onNote={onNote}
              onOpenItem={onOpenItem}
            />
          ) : (
            <p className="hint panel-body">{messages.detail.none}</p>
          )}
        </section>
      </div>
    </section>
  )
}

function BugDetail({
  row,
  onAsk,
  onNote,
  onOpenItem,
}: {
  row: BugRow
  onAsk: ((question: string) => void) | undefined
  onNote: (id: string, note: string) => void
  onOpenItem: ((id: string) => void) | undefined
}) {
  const severityName = useSeverityName()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (draft.trim() !== '') onNote(row.id, draft)
    setEditing(false)
  }
  return (
    <>
      <div className="panel-head">
        <span className="eyebrow">{text.bugDetail}</span>
        <span className="pill pill-source mono">#{row.id}</span>
      </div>
      <div className="panel-body">
        <h4 className="detail-title">{row.title}</h4>
        <p>
          {row.assignee ?? text.unassigned} · {row.state}{' '}
          <span className="cell-note">{text.phase[row.phase]}</span>
        </p>
        <p className="hint">
          {text.inState(row.daysInState)}
          {row.stuck && <span className="status status-warning">{text.stuckBadge}</span>}
          {' · '}
          {text.created} {dateText(row.createdAt)}
          {row.severity && ` · ${severityName}: ${row.severity}`}
          {row.environment && ` · ${text.environment}: ${row.environment}`}
        </p>
        {editing ? (
          <form className="note-form" onSubmit={submit}>
            <textarea
              aria-label={text.noteLabel(row.id)}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
            <button type="submit">{text.saveNote}</button>
            <button type="button" className="quiet" onClick={() => setEditing(false)}>
              {text.cancel}
            </button>
          </form>
        ) : (
          <div className="actions">
            {onAsk && (
              <button
                type="button"
                className="primary"
                onClick={() => onAsk(text.askSeed(row.id, row.title, row.state, row.daysInState))}
              >
                {text.askAbout}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setDraft(row.note?.text ?? '')
                setEditing(true)
              }}
            >
              {text.addNote}
            </button>
            <OpenItem id={row.id} onOpen={onOpenItem} />
          </div>
        )}
        {row.note && (
          <div className="box">
            <strong>{text.noteOf(dateText(row.note.at))}</strong>
            <p className="quote">{row.note.text}</p>
          </div>
        )}
        {row.lastComment ? (
          <div className="box box-source">
            <strong>{text.lastComment(row.lastComment.by, dateText(row.lastComment.at))}</strong>
            <p className="quote">{plain(row.lastComment.text)}</p>
          </div>
        ) : (
          !row.note && <p className="hint">{text.noComment}</p>
        )}
      </div>
    </>
  )
}
