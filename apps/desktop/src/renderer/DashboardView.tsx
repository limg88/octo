import type {
  DashboardRange,
  ExportCandidates,
  TrackerSnapshotRun,
  DashboardView as View,
} from '@octo/application'
import type { BugRow, DashboardSettings, Project, RequirementRow } from '@octo/domain'
import { useCallback, useEffect, useState } from 'react'
import type { ErrorCode, OctoApi } from '../shared/api.ts'
import { DashboardSettingsForm } from './DashboardSettingsForm.tsx'
import { presetRange, RANGE_PRESETS, type RangePreset, wholeDays } from './dashboard-range.ts'
import { Failure } from './Failure.tsx'
import { dateText, dateTimeText, messages } from './messages.ts'
import { useSavedNote } from './SavedNote.tsx'
import { TrendChart } from './TrendChart.tsx'
import { Unlinked } from './Unlinked.tsx'

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
}

const text = messages.dashboard
const DEFAULT_PRESET: RangePreset = 'w8'
const NO_CANDIDATES: ExportCandidates = { exports: [], histories: [] }

/** Bugs and requirements of the project, computed by the app from the tracker export. */
export function DashboardView({ api, project, now = () => new Date(), onOpenSources }: Props) {
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
      setLoading(true)
      setError(null)
      const result = await api.dashboardView(project.id, wholeDays(wanted))
      setLoading(false)
      if (result.ok) setView(result.value)
      else setError(result.code)
    },
    [api, project.id],
  )

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new project starts from its settings; the range is followed by its own handlers.
  useEffect(() => {
    setSettings(null)
    setView(null)
    setError(null)
    void api.dashboardSettings(project.id).then(async (result) => {
      if (!result.ok) return setError(result.code)
      setSettings(result.value)
      if (result.value.exportPath !== '') return loadView(range)
      const found = await api.dashboardCandidates(project.id)
      if (found.ok) setCandidates(found.value)
    })
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
      {reading && (
        <p className="progress" role="status">
          {text.readingTracker}
        </p>
      )}
      {unlinked && <Unlinked text={text.adoUnlinked} onOpenSources={onOpenSources} />}
      {run && (
        <p className="badge badge-ok">
          {text.trackerRead(run.items, run.withHistory, dateTimeText(run.at))}
        </p>
      )}
    </>
  )
  const readButton = (main: boolean) => (
    <button
      type="button"
      className={main ? 'primary' : undefined}
      disabled={reading}
      onClick={() => void readTracker()}
    >
      {text.readTracker}
    </button>
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
    return error ? <Failure code={error} /> : <p className="progress">{text.loading}</p>
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
      {loading && !view && <p className="progress">{text.loading}</p>}
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
          <Figures view={view} stuckDays={settings.stuckDays} />
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
          <section aria-label={text.openTitle}>
            <h3>{text.openTitle}</h3>
            {view.bugs.open.length === 0 ? (
              <p className="hint">{text.noOpen}</p>
            ) : (
              <BugTable
                rows={view.bugs.open}
                onNote={(id, note) =>
                  decide({ notes: [...settings.decisions.notes, { id, at: at(), text: note }] })
                }
              />
            )}
          </section>
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

function Figures({ view, stuckDays }: { view: View; stuckDays: number }) {
  const { bugs } = view
  return (
    <dl className="figures">
      <Figure label={text.open} value={bugs.open.length} note={text.total(bugs.total)} />
      <Figure label={text.work} value={bugs.byPhase.work} />
      <Figure label={text.verify} value={bugs.byPhase.verify} />
      <Figure label={text.validated} value={bugs.byPhase.validated} />
      <Figure label={text.stuck(stuckDays)} value={bugs.stuck} />
    </dl>
  )
}

function BugTable({
  rows,
  onNote,
}: {
  rows: BugRow[]
  onNote: (id: string, note: string) => void
}) {
  const [editing, setEditing] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  return (
    <table className="data">
      <thead>
        <tr>
          <th>{text.columnId}</th>
          <th>{text.columnTitle}</th>
          <th>{text.columnState}</th>
          <th>{text.columnAssignee}</th>
          <th className="number">{text.columnDays}</th>
          <th>{text.columnNote}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <td>{row.id}</td>
            <td>{row.title}</td>
            <td>
              {row.state}
              <span className="cell-note">{text.phase[row.phase]}</span>
            </td>
            <td>{row.assignee ?? text.unassigned}</td>
            <td className="number">
              {row.daysInState ?? '—'}
              {row.stuck && <span className="status status-warning">{text.stuckBadge}</span>}
            </td>
            <td>
              {editing === row.id ? (
                <form
                  className="note-form"
                  onSubmit={(event) => {
                    event.preventDefault()
                    if (draft.trim() !== '') onNote(row.id, draft)
                    setEditing(null)
                  }}
                >
                  <textarea
                    aria-label={text.noteLabel(row.id)}
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                  />
                  <button type="submit">{text.saveNote}</button>
                  <button type="button" className="quiet" onClick={() => setEditing(null)}>
                    {text.cancel}
                  </button>
                </form>
              ) : (
                <>
                  <NoteOrComment row={row} />
                  <button
                    type="button"
                    className="quiet"
                    onClick={() => {
                      setDraft(row.note?.text ?? '')
                      setEditing(row.id)
                    }}
                  >
                    {text.addNote}
                  </button>
                </>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

const COMMENT_CHARS = 220
const TAG = /<[^>]+>/g
const short = (value: string): string => {
  const plain = value.replace(TAG, ' ').replace(/\s+/g, ' ').trim()
  return plain.length > COMMENT_CHARS ? `${plain.slice(0, COMMENT_CHARS)}…` : plain
}

function NoteOrComment({ row }: { row: BugRow }) {
  if (row.note) {
    return (
      <p className="cell-text">
        <strong>{text.yourNote}</strong> ({dateText(row.note.at)}): {row.note.text}
      </p>
    )
  }
  if (!row.lastComment) return null
  return (
    <p className="cell-text">
      <strong>{row.lastComment.by}</strong>: {short(row.lastComment.text)}
    </p>
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
