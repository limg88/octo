import type {
  DashboardComment,
  DashboardRange,
  ExportCandidates,
  TrackerSnapshotRun,
  DashboardView as View,
} from '@octo/application'
import {
  type DashboardDecisions,
  type DashboardSettings,
  type Project,
  withoutTrackerDecision,
} from '@octo/domain'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ErrorCode, OctoApi } from '../shared/api.ts'
import { DASHBOARD_TABS, type DashboardFocus, NO_DASHBOARD_FOCUS } from './context.ts'
import { DashboardBugs } from './DashboardBugs.tsx'
import { DashboardSettingsForm } from './DashboardSettingsForm.tsx'
import { DashboardSprint } from './DashboardSprint.tsx'
import { DashboardTrend } from './DashboardTrend.tsx'
import { presetRange, RANGE_PRESETS, type RangePreset, wholeDays } from './dashboard-range.ts'
import { Failure } from './Failure.tsx'
import { dateTimeText, messages } from './messages.ts'
import { useSavedNote } from './SavedNote.tsx'
import { BusyButton, Waiting } from './Spinner.tsx'
import { Unlinked } from './Unlinked.tsx'

type DashboardApi = Pick<
  OctoApi,
  | 'dashboardSettings'
  | 'saveDashboardSettings'
  | 'dashboardCandidates'
  | 'dashboardView'
  | 'readTrackerSnapshot'
  | 'refreshTrackerSnapshot'
  | 'chooseProjectPath'
  | 'openTrackerItem'
  | 'commentDashboard'
  | 'draftReminder'
  | 'onSourcesChanged'
>

type Props = {
  api: DashboardApi
  project: Project
  /** The present moment; a test passes its own. */
  now?: () => Date
  /** Whether Claude can be asked on this computer: for the comment and for the reminders. */
  canAsk?: boolean
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
/** How long a decision just taken can be undone with one click. */
const UNDO_MS = 8000

/**
 * The sprint, the bugs and their trend, computed by the app from the tracker export and read in
 * three parts. The period chosen on top holds for all of them.
 */
export function DashboardView({
  api,
  project,
  now = () => new Date(),
  canAsk = false,
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
  /** The sprint the PM chose in place of the running one. */
  const sprint = useRef<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [comment, setComment] = useState<DashboardComment | null>(null)
  const [commenting, setCommenting] = useState(false)
  const [commentError, setCommentError] = useState<ErrorCode | null>(null)
  /** The decisions as they were before the last one, while it can still be undone. */
  const [undo, setUndo] = useState<DashboardDecisions | null>(null)
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const loadView = useCallback(
    async (wanted: DashboardRange) => {
      request.current += 1
      const mine = request.current
      setLoading(true)
      setError(null)
      const result = await api.dashboardView(project.id, wholeDays(wanted), sprint.current)
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
    sprint.current = null
    setComment(null)
    setCommentError(null)
    setUndo(null)
    void api.dashboardSettings(project.id).then(async (result) => {
      if (!current) return
      if (!result.ok) return setError(result.code)
      setSettings(result.value)
      if (result.value.exportPath === '') {
        const found = await api.dashboardCandidates(project.id)
        if (current && found.ok) setCandidates(found.value)
        return
      }
      await loadView(range)
      // What is shown is shown at once; a reading older than a day is asked again meanwhile.
      setRefreshing(true)
      const fresh = await api.refreshTrackerSnapshot(project.id)
      if (!current) return
      setRefreshing(false)
      if (!fresh.ok) return setError(fresh.code)
      if (fresh.value === null) return
      setRun(fresh.value)
      await loadView(range)
    })
    return () => {
      current = false
      request.current += 1
    }
  }, [api, project.id, loadView])

  // A periodic reading may have read the tracker again: the page follows it.
  const shownRange = useRef(range)
  shownRange.current = range
  const configured = settings !== null && settings.exportPath !== ''
  useEffect(() => {
    if (!configured) return
    return api.onSourcesChanged((projectId) => {
      if (projectId === project.id) void loadView(shownRange.current)
    })
  }, [api, project.id, configured, loadView])

  useEffect(
    () => () => {
      if (undoTimer.current) clearTimeout(undoTimer.current)
    },
    [],
  )

  /** Saves the settings; a decision on an item says so by itself, with the way back. */
  async function save(next: DashboardSettings, decision = false): Promise<boolean> {
    setError(null)
    savedNote.clear()
    const result = await api.saveDashboardSettings(project.id, next)
    if (!result.ok) {
      setError(result.code)
      return false
    }
    setSettings(result.value)
    if (!decision) savedNote.saved()
    if (result.value.exportPath !== '') await loadView(range)
    return true
  }

  async function askComment() {
    setCommenting(true)
    setCommentError(null)
    const result = await api.commentDashboard(project.id, wholeDays(range))
    setCommenting(false)
    if (result.ok) setComment(result.value)
    else setCommentError(result.code)
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

  /** Keeps a decision on an item, and for a while the way to take it back. */
  async function decideAs(decisions: DashboardDecisions, undoable = true) {
    const before = settings?.decisions
    if (!settings || !before) return
    if (undoTimer.current) clearTimeout(undoTimer.current)
    setUndo(null)
    if (!(await save({ ...settings, decisions }, true)) || !undoable) return
    setUndo(before)
    undoTimer.current = setTimeout(() => setUndo(null), UNDO_MS)
  }
  const decide = (change: Partial<DashboardDecisions>) =>
    decideAs({ ...settings.decisions, ...change })
  const at = () => now().toISOString()
  const openItem = (id: string) =>
    void api.openTrackerItem(project.id, id).then((result) => {
      if (!result.ok) setError(result.code)
    })

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
              onSave={async (next) => void (await save(next))}
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
      <details className="dashboard-settings">
        <summary>{text.settings}</summary>
        <DashboardSettingsForm
          settings={settings}
          candidates={candidates}
          view={view}
          onSave={async (next) => void (await save(next))}
          onChooseFile={chooseFile}
        />
      </details>
      {refreshing && view && view.age !== 'fresh' && <Waiting>{text.refreshing}</Waiting>}
      {undo && (
        <p className="badge badge-ok saved-note" role="status">
          {text.decided}{' '}
          <button type="button" className="quiet" onClick={() => void decideAs(undo, false)}>
            {text.undo}
          </button>
        </p>
      )}
      {view && (
        <>
          <div className="dashboard-tabs" role="tablist" aria-label={text.tabsLabel}>
            {DASHBOARD_TABS.map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={focus.tab === tab}
                className={focus.tab === tab ? 'tab tab-selected' : 'tab'}
                onClick={() => setFocus({ ...focus, tab })}
              >
                {text.tabs[tab]}
              </button>
            ))}
          </div>
          {focus.tab === 'bugs' && (
            <DashboardBugs
              view={view}
              stuckDays={settings.stuckDays}
              answerWorkdays={settings.answerWorkdays}
              focus={focus}
              onFocus={setFocus}
              canAsk={canAsk}
              onAsk={onAsk}
              onNote={(id, note) =>
                void decide({ notes: [...settings.decisions.notes, { id, at: at(), text: note }] })
              }
              onOpenItem={view.linked ? openItem : undefined}
              onReminder={(id) => api.draftReminder(project.id, id)}
            />
          )}
          {focus.tab === 'sprint' && (
            <DashboardSprint
              view={view}
              periodsByHand={settings.requirementPeriods.length > 0}
              onSprint={(name) => {
                sprint.current = name === '' ? null : name
                void loadView(range)
              }}
              onClear={(id) =>
                void decide({
                  excludedRequirements: [
                    ...settings.decisions.excludedRequirements,
                    { id, at: at() },
                  ],
                })
              }
              onRemoveSignal={(id, signal) =>
                void decide({
                  removedSignals: [...settings.decisions.removedSignals, { id, signal, at: at() }],
                })
              }
              onRestore={(row) => void decideAs(withoutTrackerDecision(settings.decisions, row))}
              onOpenItem={view.linked ? openItem : undefined}
            />
          )}
          {focus.tab === 'trend' && (
            <DashboardTrend
              view={view}
              range={wholeDays(range)}
              comment={comment}
              commenting={commenting}
              commentError={commentError}
              canAsk={canAsk}
              onComment={() => void askComment()}
              onOpenItem={view.linked ? openItem : undefined}
            />
          )}
        </>
      )}
    </div>
  )
}
