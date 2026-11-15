import type { HoursCandidates, TrackerHoursRun, HoursView as View } from '@octo/application'
import type { HoursPeriod, HoursRow, HoursSettings, Project } from '@octo/domain'
import { useEffect, useState } from 'react'
import type { ErrorCode, OctoApi } from '../shared/api.ts'
import { Failure } from './Failure.tsx'
import { FieldProblems, NotSaved } from './FieldProblems.tsx'
import { KnownList } from './KnownList.tsx'
import { MonthField } from './MonthField.tsx'
import { dateText, dateTimeText, errorText, messages } from './messages.ts'
import { PathField } from './PathField.tsx'
import { blankRow, orOneRow, type Row, type RowsColumn, RowsField } from './RowsField.tsx'
import { Unlinked } from './Unlinked.tsx'

type HoursApi = Pick<
  OctoApi,
  | 'hoursSettings'
  | 'saveHoursSettings'
  | 'hoursCandidates'
  | 'hoursView'
  | 'readTrackerHours'
  | 'readTimesheets'
  | 'chooseProjectPath'
>

type Props = {
  api: HoursApi
  project: Project
  /** The present moment; a test passes its own. */
  now?: () => Date
  /** Takes the PM to where the systems are linked. */
  onOpenSources?: () => void
}

const text = messages.hours
const NO_CANDIDATES: HoursCandidates = { timesheets: [], worklogs: [] }

const dayOf = (date: Date): string => date.toISOString().slice(0, 10)

/** The whole month before a day: the last one whose hours can be complete. */
export function previousMonth(today: Date): HoursPeriod {
  const first = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1))
  const last = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0))
  return { from: dayOf(first), to: dayOf(last) }
}

/** The first and the last day of a month written `YYYY-MM`. */
export function monthPeriod(month: string): HoursPeriod | null {
  const [year, number] = month.split('-').map(Number)
  if (!year || !number) return null
  return {
    from: dayOf(new Date(Date.UTC(year, number - 1, 1))),
    to: dayOf(new Date(Date.UTC(year, number, 0))),
  }
}

/** Timesheet hours against the hours logged on the tracker, computed by the app. */
export function HoursView({ api, project, now = () => new Date(), onOpenSources }: Props) {
  const [settings, setSettings] = useState<HoursSettings | null>(null)
  const [candidates, setCandidates] = useState<HoursCandidates>(NO_CANDIDATES)
  const [view, setView] = useState<View | null>(null)
  const [period, setPeriod] = useState<HoursPeriod>(() => previousMonth(now()))
  const [error, setError] = useState<ErrorCode | null>(null)
  const [reading, setReading] = useState(false)
  const [run, setRun] = useState<TrackerHoursRun | null>(null)
  const [readingTimesheets, setReadingTimesheets] = useState(false)
  const [timesheetRun, setTimesheetRun] = useState<TrackerHoursRun | null>(null)
  /** The system a reading asked for and that is not linked yet. */
  const [unlinked, setUnlinked] = useState<'netsuite' | 'jira' | null>(null)

  const ready = (candidate: HoursSettings) =>
    candidate.timesheetPath !== '' && candidate.worklogPath !== ''

  async function loadView(wanted: HoursPeriod) {
    setError(null)
    const result = await api.hoursView(project.id, wanted)
    if (result.ok) setView(result.value)
    else {
      setView(null)
      setError(result.code)
    }
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new project starts from its settings; the period is followed by its own handlers.
  useEffect(() => {
    setSettings(null)
    setView(null)
    setError(null)
    void api.hoursSettings(project.id).then(async (result) => {
      if (!result.ok) return setError(result.code)
      setSettings(result.value)
      if (ready(result.value)) return loadView(period)
      const found = await api.hoursCandidates(project.id)
      if (found.ok) setCandidates(found.value)
    })
  }, [api, project.id])

  async function save(next: HoursSettings) {
    setError(null)
    const result = await api.saveHoursSettings(project.id, next)
    if (!result.ok) return setError(result.code)
    setSettings(result.value)
    if (ready(result.value)) await loadView(period)
  }

  async function readTimesheets() {
    setReadingTimesheets(true)
    setError(null)
    setTimesheetRun(null)
    setUnlinked(null)
    const result = await api.readTimesheets(project.id, period)
    setReadingTimesheets(false)
    if (!result.ok && result.code === 'source_not_configured') return setUnlinked('netsuite')
    if (!result.ok) return setError(result.code)
    setTimesheetRun(result.value)
    // The reading points the comparison at the timesheets it wrote: the settings are read again.
    const saved = await api.hoursSettings(project.id)
    if (!saved.ok) return setError(saved.code)
    setSettings(saved.value)
    if (ready(saved.value)) await loadView(period)
  }

  const timesheets = (
    <section aria-label={text.timesheetsTitle}>
      <h3>{text.timesheetsTitle}</h3>
      <p className="hint">{text.timesheetsIntro}</p>
      {readingTimesheets && (
        <p className="progress" role="status">
          {text.readingTimesheets}
        </p>
      )}
      {unlinked === 'netsuite' && (
        <Unlinked text={text.netsuiteUnlinked} onOpenSources={onOpenSources} />
      )}
      {timesheetRun && (
        <p className="badge badge-ok">
          {text.timesheetsRead(
            timesheetRun.entries,
            timesheetRun.months.join(', '),
            dateTimeText(timesheetRun.at),
          )}
        </p>
      )}
      <div className="actions">
        <button type="button" disabled={readingTimesheets} onClick={() => void readTimesheets()}>
          {text.readTimesheets}
        </button>
      </div>
    </section>
  )

  async function readTracker() {
    setReading(true)
    setError(null)
    setRun(null)
    setUnlinked(null)
    const result = await api.readTrackerHours(project.id, period)
    setReading(false)
    if (!result.ok && result.code === 'source_not_configured') return setUnlinked('jira')
    if (!result.ok) return setError(result.code)
    setRun(result.value)
    // The reading points the comparison at the hours it wrote: the settings are read again.
    const saved = await api.hoursSettings(project.id)
    if (!saved.ok) return setError(saved.code)
    setSettings(saved.value)
    if (ready(saved.value)) await loadView(period)
  }

  const tracker = (
    <section aria-label={text.trackerTitle}>
      <h3>{text.trackerTitle}</h3>
      <p className="hint">{text.trackerIntro}</p>
      {reading && (
        <p className="progress" role="status">
          {text.readingTracker}
        </p>
      )}
      {unlinked === 'jira' && <Unlinked text={text.jiraUnlinked} onOpenSources={onOpenSources} />}
      {run && (
        <p className="badge badge-ok">
          {text.trackerRead(run.entries, run.months.join(', '), dateTimeText(run.at))}
        </p>
      )}
      <div className="actions">
        <button type="button" disabled={reading} onClick={() => void readTracker()}>
          {text.readTracker}
        </button>
      </div>
    </section>
  )

  /** The exports are kept in a folder of the project: chosen from the dialog of the system. */
  async function chooseFolder(): Promise<string | null> {
    setError(null)
    const result = await api.chooseProjectPath(project.id, 'folder', [])
    if (result.ok) return result.value
    setError(result.code)
    return null
  }

  function changePeriod(next: HoursPeriod) {
    setPeriod(next)
    if (next.from !== '' && next.to !== '') void loadView(next)
  }

  if (settings === null) {
    return error ? <Failure code={error} /> : <p className="progress">{text.loading}</p>
  }

  if (!ready(settings)) {
    return (
      <div className="dashboard">
        {error && <Failure code={error} />}
        <section aria-label={text.setupTitle}>
          <h3>{text.setupTitle}</h3>
          <p className="hint">{text.setupIntro}</p>
          <SettingsForm
            settings={settings}
            candidates={candidates}
            codes={[]}
            people={[]}
            onSave={save}
            onChooseFolder={chooseFolder}
          />
        </section>
        {timesheets}
        {tracker}
      </div>
    )
  }

  const expect = (row: HoursRow) =>
    save(
      row.status === 'no_worklog'
        ? { ...settings, noWorklogExpected: [...settings.noWorklogExpected, row.person] }
        : { ...settings, noTimesheetExpected: [...settings.noTimesheetExpected, row.person] },
    )

  return (
    <div className="dashboard">
      {error && <Failure code={error} />}
      <details className="dashboard-settings">
        <summary>{text.settings}</summary>
        <SettingsForm
          settings={settings}
          candidates={candidates}
          codes={view?.projectCodes ?? []}
          people={view?.reconciliation.rows.map((row) => row.person) ?? []}
          onSave={save}
          onChooseFolder={chooseFolder}
        />
      </details>
      <div className="range-fields">
        <MonthField
          label={text.month}
          value={period.from.slice(0, 7) === period.to.slice(0, 7) ? period.from.slice(0, 7) : ''}
          onChange={(value) => {
            const month = monthPeriod(value)
            if (month) changePeriod(month)
          }}
        />
        <label>
          {text.from}
          <input
            type="date"
            value={period.from}
            onChange={(event) => changePeriod({ ...period, from: event.target.value })}
          />
        </label>
        <label>
          {text.to}
          <input
            type="date"
            value={period.to}
            onChange={(event) => changePeriod({ ...period, to: event.target.value })}
          />
        </label>
      </div>
      {view && <Comparison view={view} onExpect={expect} />}
      {timesheets}
      {tracker}
    </div>
  )
}

function Comparison({ view, onExpect }: { view: View; onExpect: (row: HoursRow) => void }) {
  const { rows, totals, tieOut, excluded } = view.reconciliation
  const { sources } = view
  const day = (value: string | null) => (value ? dateText(value) : text.noDay)
  const left = [
    excluded.notApprovedHours > 0 && text.notApproved(text.amount(excluded.notApprovedHours)),
    (excluded.partialTimesheetHours > 0 || excluded.partialWorklogHours > 0) &&
      text.partial(
        text.amount(excluded.partialTimesheetHours),
        text.amount(excluded.partialWorklogHours),
      ),
    ...excluded.otherProjects.map((other) =>
      text.otherProject(other.project, text.amount(other.hours)),
    ),
    ...sources.unreadable.map(text.unreadable),
  ].filter((line): line is string => typeof line === 'string')
  return (
    <>
      {tieOut.ok ? (
        <p className="badge badge-ok">{text.tieOutOk(text.amount(tieOut.approvedHours))}</p>
      ) : (
        <p className="warning" role="alert">
          {text.tieOutFailed(text.amount(tieOut.approvedHours), text.amount(tieOut.accountedHours))}
        </p>
      )}
      {view.reconciliation.possibleDuplicates.map((twin) => (
        <p key={twin.projects.join()} className="warning" role="alert">
          {text.possibleDuplicate(text.amount(twin.hours), twin.projects[0], twin.projects[1])}
        </p>
      ))}
      <p className="hint">
        {text.sources(sources.timesheetFiles, sources.worklogFiles)}.{' '}
        {text.lastDays(day(sources.lastTimesheetDay), day(sources.lastWorklogDay))}.
      </p>
      {rows.length === 0 ? (
        <p className="hint">{text.noRows}</p>
      ) : (
        <table className="data">
          <thead>
            <tr>
              <th>{text.columnPerson}</th>
              <th className="number">{text.columnTimesheet}</th>
              <th className="number">{text.columnWorklog}</th>
              <th className="number">{text.columnDelta}</th>
              <th>{text.columnStatus}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.person}>
                <td>{row.person}</td>
                <td className="number">{text.amount(row.timesheetHours)}</td>
                <td className="number">{text.amount(row.worklogHours)}</td>
                <td className="number">{text.pct(row.deltaPct)}</td>
                <td>
                  <span
                    className={
                      row.status === 'ok' || row.status === 'expected'
                        ? 'status status-ok'
                        : 'status status-warning'
                    }
                  >
                    {text.status[row.status]}
                  </span>
                  {(row.status === 'no_worklog' || row.status === 'no_timesheet') && (
                    <button
                      type="button"
                      className="quiet"
                      title={text.markExpectedHint}
                      aria-label={`${text.markExpected}: ${row.person}`}
                      onClick={() => onExpect(row)}
                    >
                      {text.markExpected}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th>{text.total}</th>
              <th className="number">{text.amount(totals.timesheetHours)}</th>
              <th className="number">{text.amount(totals.worklogHours)}</th>
              <th className="number">{text.pct(totals.deltaPct)}</th>
              <th />
            </tr>
          </tfoot>
        </table>
      )}
      <section aria-label={text.excludedTitle}>
        <h3>{text.excludedTitle}</h3>
        {left.length === 0 ? (
          <p className="hint">{text.nothingExcluded}</p>
        ) : (
          <ul className="missing">
            {left.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}

type AliasKey = 'worklog' | 'timesheet'
const ALIAS_COLUMNS: RowsColumn<AliasKey>[] = [
  { key: 'worklog', label: text.aliasColumns.worklog },
  { key: 'timesheet', label: text.aliasColumns.timesheet },
]

/** The fields of the form that hold one typed value. */
type TextField = 'thresholdPct' | 'cutoff'

type Draft = {
  timesheetPath: string
  worklogPath: string
  projects: string[]
  thresholdPct: string
  cutoff: string
  noWorklogExpected: string[]
  noTimesheetExpected: string[]
  aliases: Row<AliasKey>[]
}

const draftOf = (settings: HoursSettings): Draft => ({
  timesheetPath: settings.timesheetPath,
  worklogPath: settings.worklogPath,
  projects: settings.projects,
  thresholdPct: String(settings.thresholdPct),
  cutoff: settings.cutoff,
  noWorklogExpected: settings.noWorklogExpected,
  noTimesheetExpected: settings.noTimesheetExpected,
  aliases: orOneRow([...settings.aliases], ALIAS_COLUMNS),
})

function SettingsForm({
  settings,
  candidates,
  codes,
  people,
  onSave,
  onChooseFolder,
}: {
  settings: HoursSettings
  candidates: HoursCandidates
  codes: string[]
  /** The names found on either side: proposed where a name is typed. */
  people: string[]
  onSave: (settings: HoursSettings) => Promise<void>
  onChooseFolder: () => Promise<string | null>
}) {
  const [draft, setDraft] = useState<Draft>(() => draftOf(settings))
  const [unread, setUnread] = useState<string[]>([])
  useEffect(() => setDraft(draftOf(settings)), [settings])
  // The only place found is proposed without asking.
  useEffect(() => {
    setDraft((current) => ({
      ...current,
      timesheetPath:
        current.timesheetPath ||
        (candidates.timesheets.length === 1 ? (candidates.timesheets[0] ?? '') : ''),
      worklogPath:
        current.worklogPath ||
        (candidates.worklogs.length === 1 ? (candidates.worklogs[0] ?? '') : ''),
    }))
  }, [candidates])

  const field = (name: TextField, label: string, type: 'number' | 'date') => (
    <label>
      {label}
      <input
        type={type}
        value={draft[name]}
        onChange={(event) => {
          const { value } = event.target
          setDraft((current) => ({ ...current, [name]: value }))
        }}
      />
    </label>
  )

  return (
    <form
      className="settings-form"
      onSubmit={(event) => {
        event.preventDefault()
        const wrong = draft.aliases.flatMap((row, index) =>
          blankRow(row) || (row.worklog.trim() !== '' && row.timesheet.trim() !== '')
            ? []
            : [text.aliasWrong(index + 1)],
        )
        setUnread(wrong)
        if (wrong.length > 0) return
        void onSave({
          timesheetPath: draft.timesheetPath,
          worklogPath: draft.worklogPath,
          projects: draft.projects,
          thresholdPct: Number(draft.thresholdPct),
          cutoff: draft.cutoff,
          noWorklogExpected: draft.noWorklogExpected,
          noTimesheetExpected: draft.noTimesheetExpected,
          aliases: draft.aliases
            .filter((row) => !blankRow(row))
            .map((row) => ({ worklog: row.worklog.trim(), timesheet: row.timesheet.trim() })),
        })
      }}
    >
      <PathField
        label={text.timesheetPath}
        value={draft.timesheetPath}
        candidates={candidates.timesheets}
        onChange={(timesheetPath) => setDraft((current) => ({ ...current, timesheetPath }))}
        onChoose={onChooseFolder}
      />
      <PathField
        label={text.worklogPath}
        value={draft.worklogPath}
        candidates={candidates.worklogs}
        onChange={(worklogPath) => setDraft((current) => ({ ...current, worklogPath }))}
        onChoose={onChooseFolder}
      />
      <p className="hint">{text.worklogHint}</p>
      <KnownList
        label={text.projects}
        known={codes}
        chosen={draft.projects}
        onChange={(projects) => setDraft((current) => ({ ...current, projects }))}
      />
      {field('thresholdPct', text.threshold, 'number')}
      {field('cutoff', text.cutoff, 'date')}
      <KnownList
        label={text.noWorklogExpected}
        known={people}
        chosen={draft.noWorklogExpected}
        onChange={(noWorklogExpected) => setDraft((current) => ({ ...current, noWorklogExpected }))}
      />
      <KnownList
        label={text.noTimesheetExpected}
        known={people}
        chosen={draft.noTimesheetExpected}
        onChange={(noTimesheetExpected) =>
          setDraft((current) => ({ ...current, noTimesheetExpected }))
        }
      />
      <h4>{text.aliases}</h4>
      <RowsField
        label={text.aliases}
        columns={ALIAS_COLUMNS.map((column) => ({ ...column, suggestions: people }))}
        rows={draft.aliases}
        onChange={(aliases) => setDraft((current) => ({ ...current, aliases }))}
        addLabel={text.addAlias}
        cellLabel={(column, row) => text.aliasCell(text.aliasColumns[column], row)}
        removeLabel={text.removeAlias}
      />
      <FieldProblems lines={unread} />
      <div className="actions">
        <button
          type="submit"
          disabled={draft.timesheetPath.trim() === '' || draft.worklogPath.trim() === ''}
        >
          {text.save}
        </button>
        {(draft.timesheetPath.trim() === '' || draft.worklogPath.trim() === '') && (
          <span className="hint">{text.saveNeeds}</span>
        )}
        {unread.length > 0 && <NotSaved text={messages.notSaved} />}
      </div>
    </form>
  )
}
