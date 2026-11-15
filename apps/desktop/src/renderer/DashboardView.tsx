import type {
  DashboardRange,
  ExportCandidates,
  TrackerSnapshotRun,
  DashboardView as View,
} from '@octo/application'
import type { BugRow, DashboardSettings, Project, RequirementRow } from '@octo/domain'
import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import type { ErrorCode, OctoApi } from '../shared/api.ts'
import { BUG_FILTERS, type BugFilter, type DashboardFocus, NO_DASHBOARD_FOCUS } from './context.ts'
import { DashboardSettingsForm } from './DashboardSettingsForm.tsx'
import { presetRange, RANGE_PRESETS, type RangePreset, wholeDays } from './dashboard-range.ts'
import { Failure } from './Failure.tsx'
import { dateText, dateTimeText, messages } from './messages.ts'
import { useSavedNote } from './SavedNote.tsx'
import { BusyButton, Waiting } from './Spinner.tsx'
import { TrendChart } from './TrendChart.tsx'
import { Unlinked } from './Unlinked.tsx'
import { useSelection } from './use-selection.ts'

type DashboardApi = Pick<
  OctoApi,
  | 'dashboardSettings'
  | 'saveDashboardSettings'
  | 'dashboardCandidates'
  | 'dashboardView'
  | 'readTrackerSnapshot'
  | 'chooseProjectPath'
>

type Props = {
  api: DashboardApi
  project: Project
  /** The present moment; a test passes its own. */
  now?: () => Date
  /** Takes the PM to where the systems are linked. */
  onOpenSources?: () => void
  /** Takes a question about a bug to «Chiedi», written and not yet asked. */
  onAsk?: (question: string) => void
  /** Which bugs are listed and which one is in view, kept by who shows the page. */
  focus?: DashboardFocus
  onFocus?: (focus: DashboardFocus) => void
}

const text = messages.dashboard
const DEFAULT_PRESET: RangePreset = 'w8'
const NO_CANDIDATES: ExportCandidates = { exports: [], histories: [] }

/** Bugs and requirements of the project, computed by the app from the tracker export. */
export function DashboardView({
  api,
  project,
  now = () => new Date(),
  onOpenSources,
  onAsk,
  focus: givenFocus,
  onFocus,
}: Props) {
  const [ownFocus, setOwnFocus] = useState<DashboardFocus>(NO_DASHBOARD_FOCUS)
  const focus = givenFocus ?? ownFocus
  const setFocus = (next: DashboardFocus) => {
    setOwnFocus(next)
    onFocus?.(next)
  }
  /** The latest view asked: an older one that comes back later is dropped. */
  const request = useRef(0)
  const [settings, setSettings] = useState<DashboardSettings | null>(null)
  const [candidates, setCandidates] = useState<ExportCandidates>(NO_CANDIDATES)
  const [view, setView] = useState<View | null>(null)
  const [preset, setPreset] = useState<RangePreset>(DEFAULT_PRESET)
  const [range, setRange] = useState<DashboardRange>(() => presetRange('w8', now()))
  const [error, setError] = useState<ErrorCode | null>(null)
  const savedNote = useSavedNote()
  const [loading, setLoading] = useState(false)
  const [reading, setReading] = useState(false)
  const [run, setRun] = useState<TrackerSnapshotRun | null>(null)

  const loadView = useCallback(
    async (wanted: DashboardRange) => {
      request.current += 1
      const mine = request.current
      setLoading(true)
      setError(null)
      const result = await api.dashboardView(project.id, wholeDays(wanted))
      // Another period, or another project, was asked meanwhile: this answer is not shown.
      if (mine !== request.current) return
      setLoading(false)
      if (result.ok) setView(result.value)
      else setError(result.code)
    },
    [api, project.id],
  )

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new project starts from its settings; the range is followed by its own handlers.
  useEffect(() => {
    let current = true
    request.current += 1
    setSettings(null)
    setView(null)
    setError(null)
    setLoading(false)
    setReading(false)
    setRun(null)
    setOwnFocus(NO_DASHBOARD_FOCUS)
    void api.dashboardSettings(project.id).then(async (result) => {
      if (!current) return
      if (!result.ok) return setError(result.code)
      setSettings(result.value)
      if (result.value.exportPath !== '') return loadView(range)
      const found = await api.dashboardCandidates(project.id)
      if (current && found.ok) setCandidates(found.value)
    })
    return () => {
      current = false
      request.current += 1
    }
  }, [api, project.id, loadView])

  async function save(next: DashboardSettings) {
    setError(null)
    savedNote.clear()
    const result = await api.saveDashboardSettings(project.id, next)
    if (!result.ok) return setError(result.code)
    setSettings(result.value)
    savedNote.saved()
    if (result.value.exportPath !== '') await loadView(range)
  }

  /** The export and its history are JSON files of the project. */
  async function chooseFile(): Promise<string | null> {
    setError(null)
    const result = await api.chooseProjectPath(project.id, 'file', ['json'])
    if (result.ok) return result.value
    setError(result.code)
    return null
  }

  /** The reading was asked while Azure DevOps is not linked. */
  const [unlinked, setUnlinked] = useState(false)

  async function readTracker() {
    setReading(true)
    setError(null)
    setRun(null)
    setUnlinked(false)
    const result = await api.readTrackerSnapshot(project.id)
    setReading(false)
    if (!result.ok && result.code === 'source_not_configured') return setUnlinked(true)
    if (!result.ok) return setError(result.code)
    setRun(result.value)
    // The reading points the dashboard at the file it wrote: the settings are read again.
    const saved = await api.dashboardSettings(project.id)
    if (!saved.ok) return setError(saved.code)
    setSettings(saved.value)
    await loadView(range)
  }

  /** How the reading asked from Azure DevOps is going, or how it went. */
  const reader = (
    <>
      {reading && <Waiting>{text.readingTracker}</Waiting>}
      {unlinked && <Unlinked text={text.adoUnlinked} onOpenSources={onOpenSources} />}
      {run && (
        <p className="badge badge-ok">
          {text.trackerRead(run.items, run.withHistory, dateTimeText(run.at))}
        </p>
      )}
    </>
  )
  const readButton = (main: boolean) => (
    <BusyButton
      {...(main ? { className: 'primary' } : {})}
      busy={reading}
      busyLabel={messages.wait.reading}
      onClick={() => void readTracker()}
    >
      {text.readTracker}
    </BusyButton>
  )

  function choosePreset(next: RangePreset) {
    setPreset(next)
    if (next === 'custom') return
    const wanted = presetRange(next, now())
    setRange(wanted)
    void loadView(wanted)
  }

  function changeRange(change: Partial<DashboardRange>) {
    const wanted = { ...range, ...change }
    setRange(wanted)
    if (wanted.from !== '' && wanted.to !== '') void loadView(wanted)
  }

  if (settings === null) {
    return error ? (
      <Failure code={error} />
    ) : (
      <div className="page-wait">
        <Waiting>{text.loading}</Waiting>
      </div>
    )
  }

  const decide = (change: Partial<DashboardSettings['decisions']>) =>
    save({ ...settings, decisions: { ...settings.decisions, ...change } })
  const at = () => now().toISOString()

  if (settings.exportPath === '') {
    return (
      <div className="dashboard">
        {error && <Failure code={error} />}
        {/* The first thing to do: Octo reads the tracker by itself. */}
        <section aria-label={text.trackerTitle}>
          <h3>{text.trackerTitle}</h3>
          <p className="hint">{text.trackerIntro}</p>
          {reader}
          <div className="actions">{readButton(true)}</div>
        </section>
        {/* The other way, for who already keeps an export in the folder: open when one is found. */}
        <details className="dashboard-settings" open={candidates.exports.length > 0 || undefined}>
          <summary>{text.haveExport}</summary>
          <section aria-label={text.setupTitle}>
            <h3>{text.setupTitle}</h3>
            <p className="hint">{text.setupIntro}</p>
            <DashboardSettingsForm
              settings={settings}
              candidates={candidates}
              view={null}
              onSave={save}
              onChooseFile={chooseFile}
            />
          </section>
        </details>
      </div>
    )
  }

  return (
    <div className="dashboard">
      {error && <Failure code={error} />}
      {savedNote.note}
      <details className="dashboard-settings">
        <summary>{text.settings}</summary>
        <DashboardSettingsForm
          settings={settings}
          candidates={candidates}
          view={view}
          onSave={save}
          onChooseFile={chooseFile}
        />
      </details>
      <section className="dashboard-range" aria-label={text.rangeTitle}>
        <fieldset className="chips" aria-label={text.rangeTitle}>
          {RANGE_PRESETS.map((candidate) => (
            <button
              key={candidate}
              type="button"
              className={candidate === preset ? 'chip chip-selected' : 'chip'}
              aria-pressed={candidate === preset}
              onClick={() => choosePreset(candidate)}
            >
              {text.presets[candidate]}
            </button>
          ))}
        </fieldset>
        {preset === 'custom' && (
          <div className="range-fields">
            <label>
              {text.from}
              <input
                type="date"
                value={range.from}
                onChange={(event) => changeRange({ from: event.target.value })}
              />
            </label>
            <label>
              {text.to}
              <input
                type="date"
                value={range.to}
                onChange={(event) => changeRange({ to: event.target.value })}
              />
            </label>
            <label>
              {text.granularity}
              <select
                value={range.granularity}
                onChange={(event) =>
                  changeRange({ granularity: event.target.value === 'month' ? 'month' : 'week' })
                }
              >
                <option value="week">{text.week}</option>
                <option value="month">{text.month}</option>
              </select>
            </label>
          </div>
        )}
      </section>
      {loading && <Waiting>{text.loading}</Waiting>}
      {/* How old the data are, and the way to newer ones, side by side. */}
      <div className="actions">
        {view && (
          <p className={view.age === 'fresh' ? 'badge badge-ok' : 'badge badge-warning'}>
            {view.exportedAt
              ? text.exportedAt(dateTimeText(view.exportedAt))
              : text.exportedUnknown}
            {' · '}
            {text.age[view.age]}
          </p>
        )}
        {readButton(false)}
      </div>
      {reader}
      {view && (
        <>
          <Quality
            view={view}
            stuckDays={settings.stuckDays}
            focus={focus}
            onFocus={setFocus}
            onAsk={onAsk}
            onNote={(id, note) =>
              decide({ notes: [...settings.decisions.notes, { id, at: at(), text: note }] })
            }
          />
          <section aria-label={text.trendTitle}>
            <h3>{text.trendTitle}</h3>
            {view.bugs.trendSource === 'approximate' && (
              <p className="hint">{text.trendApproximate}</p>
            )}
            <TrendChart trend={view.bugs.trend} />
          </section>
          {view.bugs.flow && (
            <section aria-label={text.flowTitle}>
              <h3>{text.flowTitle}</h3>
              <p className="hint">{text.flowIntro}</p>
              <dl className="figures">
                <Figure
                  label={text.toVerify}
                  value={text.days(view.bugs.flow.toVerify.median)}
                  note={text.sample(view.bugs.flow.toVerify.sample)}
                />
                <Figure
                  label={text.toValidated}
                  value={text.days(view.bugs.flow.toValidated.median)}
                  note={text.sample(view.bugs.flow.toValidated.sample)}
                />
                <Figure
                  label={text.toClosed}
                  value={text.days(view.bugs.flow.toClosed.median)}
                  note={text.sample(view.bugs.flow.toClosed.sample)}
                />
              </dl>
            </section>
          )}
          <section aria-label={text.requirementsTitle}>
            <h3>{text.requirementsTitle}</h3>
            {view.requirements.length === 0 ? (
              <p className="hint">{text.noRequirements}</p>
            ) : (
              <RequirementTable
                rows={view.requirements}
                onClear={(id) =>
                  decide({
                    excludedRequirements: [
                      ...settings.decisions.excludedRequirements,
                      { id, at: at() },
                    ],
                  })
                }
                onRemoveSignal={(id, signal) =>
                  decide({
                    removedSignals: [
                      ...settings.decisions.removedSignals,
                      { id, signal, at: at() },
                    ],
                  })
                }
              />
            )}
          </section>
        </>
      )}
    </div>
  )
}

function Figure({ label, value, note }: { label: string; value: string | number; note?: string }) {
  return (
    <div className="figure">
      <dt>{label}</dt>
      <dd>
        {value}
        {note && <span className="figure-note">{note}</span>}
      </dd>
    </div>
  )
}

/** The rows a filter lists: the open bugs, a part of them, or the validated ones. */
function rowsOf(view: View, filter: BugFilter): BugRow[] {
  const { open, validated } = view.bugs
  if (filter === 'validated') return validated
  if (filter === 'stuck') return open.filter((row) => row.stuck)
  if (filter === 'open') return open
  return open.filter((row) => row.phase === filter)
}

const TAG = /<[^>]+>/g
/** A comment of the tracker as plain words: its markup is not shown. */
const plain = (value: string): string => value.replace(TAG, ' ').replace(/\s+/g, ' ').trim()

type QualityProps = {
  view: View
  stuckDays: number
  focus: DashboardFocus
  onFocus: (focus: DashboardFocus) => void
  onAsk: ((question: string) => void) | undefined
  onNote: (id: string, note: string) => void
}

/**
 * The bugs of the project: each count opens its own list, and the bug in view shows beside it
 * what was last said about it. Every count is the number of rows its list holds.
 */
function Quality({ view, stuckDays, focus, onFocus, onAsk, onNote }: QualityProps) {
  const rows = rowsOf(view, focus.filter)
  const selectedId = useSelection(
    rows.map((row) => row.id),
    focus.bugId,
  )
  const selected = rows.find((row) => row.id === selectedId) ?? null
  const count = (filter: BugFilter) => rowsOf(view, filter).length
  const labels: Record<BugFilter, string> = {
    open: text.open,
    work: text.work,
    verify: text.verify,
    stuck: text.stuck(stuckDays),
    validated: text.validated,
  }
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
              onClick={() => onFocus({ filter, bugId: focus.bugId })}
            >
              <span className="metric-value">{count(filter)}</span>
              <span className="metric-label">
                {part && <span className="metric-part">{text.ofWhich} </span>}
                {labels[filter]}
              </span>
              {filter === 'open' && (
                <span className="metric-part">{text.total(view.bugs.total)}</span>
              )}
            </button>
          )
        })}
      </fieldset>
      <p className="hint">
        {text.relation(count('open'), count('stuck'), count('validated'), stuckDays)}
      </p>
      <div className="split">
        <div className="split-list">
          {rows.length === 0 ? (
            <p className="hint">{focus.filter === 'open' ? text.noOpen : text.noneInFilter}</p>
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
                    onClick={() => onFocus({ filter: focus.filter, bugId: row.id })}
                  >
                    <span className="entry-meta">
                      <span className="mono">#{row.id}</span>
                      <span>{row.assignee ?? text.unassigned}</span>
                      <span>{row.state}</span>
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
            <BugDetail key={selected.id} row={selected} onAsk={onAsk} onNote={onNote} />
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
}: {
  row: BugRow
  onAsk: ((question: string) => void) | undefined
  onNote: (id: string, note: string) => void
}) {
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
          {row.severity && ` · ${text.severity}: ${row.severity}`}
          {row.environment && ` · ${text.environment}: ${row.environment}`}
        </p>
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
          </div>
        )}
      </div>
    </>
  )
}

function RequirementTable({
  rows,
  onClear,
  onRemoveSignal,
}: {
  rows: RequirementRow[]
  onClear: (id: string) => void
  onRemoveSignal: (id: string, signal: string) => void
}) {
  return (
    <table className="data">
      <thead>
        <tr>
          <th>{text.columnId}</th>
          <th>{text.columnTitle}</th>
          <th>{text.columnState}</th>
          <th>{text.columnPeriod}</th>
          <th>{text.columnSignals}</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <td>{row.id}</td>
            <td>
              {row.title}
              {row.unclear && <p className="cell-text">«…{row.unclear.context}…»</p>}
            </td>
            <td>{row.state}</td>
            <td>{row.period ?? '—'}</td>
            <td>
              <ul className="signals">
                {row.signals.map((signal) => (
                  <li key={signal}>
                    <span className="status status-warning">
                      {signal} · {text.signals[signal]}
                    </span>
                    <button
                      type="button"
                      className="quiet"
                      onClick={() => onRemoveSignal(row.id, signal)}
                    >
                      {text.removeSignal(signal)}
                    </button>
                  </li>
                ))}
              </ul>
            </td>
            <td>
              <button
                type="button"
                className="no-wrap"
                title={text.markClearHint}
                onClick={() => onClear(row.id)}
              >
                {text.markClear}
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
