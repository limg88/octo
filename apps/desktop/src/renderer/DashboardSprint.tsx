import type { DashboardView as View } from '@octo/application'
import {
  type DecisionRow,
  type RequirementRow,
  SPRINT_STAGES,
  type SprintComparisonRow,
  type SprintRow,
  type SprintStage,
  sameSprint,
} from '@octo/domain'
import { useState } from 'react'
import { Figure, OpenItem, useHasPeriods, useOpenInTracker } from './DashboardParts.tsx'
import { type DataColumn, DataTable } from './DataTable.tsx'
import { dateText, messages } from './messages.ts'

const text = messages.dashboard

type Props = {
  view: View
  /** Whether the periods to check were chosen by hand in the settings. */
  periodsByHand: boolean
  onSprint: (sprint: string) => void
  onClear: (id: string) => void
  onRemoveSignal: (id: string, signal: string) => void
  onRestore: (row: DecisionRow) => void
  onOpenItem: ((id: string) => void) | undefined
}

type StageFilter = SprintStage | 'all'

const orDash = (value: number | null): string | number => value ?? '—'

/**
 * The sprint: where its stories stand, its bugs, what will not make it while it ends, the last
 * sprints side by side, and the requirements of the next one that are not clear yet.
 */
export function DashboardSprint({
  view,
  periodsByHand,
  onSprint,
  onClear,
  onRemoveSignal,
  onRestore,
  onOpenItem,
}: Props) {
  const [stage, setStage] = useState<StageFilter>('all')
  const { sprint } = view
  const stories = sprint?.stories.filter((row) => stage === 'all' || row.stage === stage) ?? []
  const running = (name: string) =>
    view.currentSprint !== null && sameSprint(name, view.currentSprint)
  return (
    <>
      <section aria-label={text.storiesTitle}>
        <h3>{text.storiesTitle}</h3>
        {view.sprints.length === 0 ? (
          <p className="hint">{text.noSprintAtAll}</p>
        ) : (
          <div className="actions">
            <label>
              {text.sprintLabel}{' '}
              <select value={sprint?.name ?? ''} onChange={(event) => onSprint(event.target.value)}>
                {sprint === null && <option value="">—</option>}
                {view.sprints.map((name) => (
                  <option key={name} value={name}>
                    {running(name) ? `${name} (${text.sprintRunning})` : name}
                  </option>
                ))}
              </select>
            </label>
            {sprint?.from && sprint.to && (
              <span className="hint">
                {text.sprintDates(dateText(sprint.from), dateText(sprint.to))}
              </span>
            )}
            {sprint?.ending && <span className="badge badge-warning">{text.sprintEnding}</span>}
          </div>
        )}
        {view.sprints.length > 0 && sprint === null && <p className="hint">{text.noSprint}</p>}
        {sprint && sprint.to === null && <p className="hint">{text.sprintNoDates}</p>}
        {sprint && (
          <>
            <fieldset className="metrics" aria-label={text.stageFilter}>
              {(['all', ...SPRINT_STAGES] as const).map((candidate) => (
                <button
                  key={candidate}
                  type="button"
                  className={stage === candidate ? 'metric metric-selected' : 'metric'}
                  aria-pressed={stage === candidate}
                  onClick={() => setStage(candidate)}
                >
                  <span className="metric-value">
                    {candidate === 'all' ? sprint.stories.length : sprint.byStage[candidate]}
                  </span>
                  <span className="metric-label">{text.stages[candidate]}</span>
                </button>
              ))}
            </fieldset>
            {sprint.atRisk.length > 0 && (
              <div className="box box-warning">
                <strong>{text.riskTitle(sprint.atRisk.length)}</strong>
                <SprintTable
                  label={text.riskTitle(sprint.atRisk.length)}
                  rows={sprint.atRisk}
                  onOpenItem={onOpenItem}
                />
              </div>
            )}
            {stories.length === 0 ? (
              <p className="hint">{text.noStories}</p>
            ) : (
              <SprintTable label={text.storiesTitle} rows={stories} onOpenItem={onOpenItem} />
            )}
          </>
        )}
      </section>
      {sprint && (
        <section aria-label={text.sprintBugsTitle}>
          <h3>{text.sprintBugsTitle}</h3>
          <dl className="figures">
            <Figure label={text.sprintBugsOpen} value={sprint.bugsOpen} />
            <Figure label={text.sprintBugsClosed} value={sprint.bugsClosed} />
          </dl>
          {sprint.bugs.length > 0 && (
            <details className="dashboard-fold">
              <summary className="fold-title">{text.showSprintBugs(sprint.bugs.length)}</summary>
              <SprintTable
                label={text.sprintBugsTitle}
                rows={sprint.bugs}
                onOpenItem={onOpenItem}
              />
            </details>
          )}
        </section>
      )}
      {view.comparison.length > 0 && (
        <section aria-label={text.comparisonTitle}>
          <h3>{text.comparisonTitle}</h3>
          <p className="hint">{text.comparisonIntro}</p>
          <ComparisonTable rows={view.comparison} />
          {view.comparison.some((row) => row.doneInTime === null || row.bugsEntered === null) && (
            <p className="hint">{text.comparisonUnknown}</p>
          )}
        </section>
      )}
      <section aria-label={text.requirementsTitle}>
        <h3>{text.requirementsTitle}</h3>
        <p className="hint">{text.requirementsScope(view.upcomingSprint, periodsByHand)}</p>
        {view.requirements.length === 0 ? (
          <p className="hint">{text.noRequirements}</p>
        ) : (
          <RequirementTable
            rows={view.requirements}
            onClear={onClear}
            onRemoveSignal={onRemoveSignal}
            onOpenItem={onOpenItem}
          />
        )}
      </section>
      <section aria-label={text.decisionsLabel}>
        <details className="dashboard-fold">
          <summary className="fold-title">{text.decisionsTitle(view.decisions.length)}</summary>
          {view.decisions.length === 0 ? (
            <p className="hint">{text.decisionsNone}</p>
          ) : (
            <DecisionTable rows={view.decisions} onRestore={onRestore} />
          )}
        </details>
      </section>
    </>
  )
}

function SprintTable({
  label,
  rows,
  onOpenItem,
}: {
  label: string
  rows: readonly SprintRow[]
  onOpenItem: ((id: string) => void) | undefined
}) {
  const openLabel = useOpenInTracker()
  const columns: DataColumn<SprintRow>[] = [
    {
      key: 'id',
      label: text.columnId,
      width: '70px',
      cell: (row) => row.id,
      sort: (row) => row.id,
      text: (row) => row.id,
    },
    {
      key: 'title',
      label: text.columnTitle,
      cell: (row) => row.title,
      sort: (row) => row.title,
      text: (row) => row.title,
    },
    {
      key: 'state',
      label: text.columnState,
      width: '150px',
      cell: (row) => row.state,
      sort: (row) => row.state,
      text: (row) => row.state,
    },
    {
      key: 'assignee',
      label: text.columnAssignee,
      width: '150px',
      cell: (row) => row.assignee ?? text.unassigned,
      sort: (row) => row.assignee,
      text: (row) => row.assignee ?? '',
    },
    {
      key: 'days',
      label: text.columnDays,
      kind: 'number',
      width: '110px',
      cell: (row) => text.days(row.daysInState),
      sort: (row) => row.daysInState,
    },
    ...(onOpenItem
      ? [
          {
            key: 'open',
            label: '',
            name: openLabel,
            kind: 'actions' as const,
            width: '170px',
            cell: (row: SprintRow) => <OpenItem id={row.id} onOpen={onOpenItem} />,
          },
        ]
      : []),
  ]
  return <DataTable label={label} columns={columns} rows={rows} rowKey={(row) => row.id} />
}

function ComparisonTable({ rows }: { rows: readonly SprintComparisonRow[] }) {
  const names = text.comparisonColumns
  const number = (
    key: string,
    label: string,
    value: (row: SprintComparisonRow) => number | null,
  ): DataColumn<SprintComparisonRow> => ({
    key,
    label,
    kind: 'number',
    width: '130px',
    cell: (row) => orDash(value(row)),
    sort: value,
  })
  const columns: DataColumn<SprintComparisonRow>[] = [
    {
      key: 'sprint',
      label: names.sprint,
      cell: (row) => (
        <>
          {row.name}
          {row.from && row.to && (
            <p className="cell-text">{text.sprintDates(dateText(row.from), dateText(row.to))}</p>
          )}
        </>
      ),
      text: (row) => row.name,
    },
    number('stories', names.stories, (row) => row.stories),
    number('done', names.done, (row) => row.done),
    number('inTime', names.inTime, (row) => row.doneInTime),
    number('open', names.open, (row) => row.open),
    number('bugs', names.bugs, (row) => row.bugsEntered),
  ]
  return (
    <DataTable
      label={text.comparisonTitle}
      columns={columns}
      rows={rows}
      rowKey={(row) => row.name}
    />
  )
}

function RequirementTable({
  rows,
  onClear,
  onRemoveSignal,
  onOpenItem,
}: {
  rows: RequirementRow[]
  onClear: (id: string) => void
  onRemoveSignal: (id: string, signal: string) => void
  onOpenItem: ((id: string) => void) | undefined
}) {
  const hasPeriods = useHasPeriods()
  const allColumns: DataColumn<RequirementRow>[] = [
    {
      key: 'id',
      label: text.columnId,
      width: '70px',
      cell: (row) => row.id,
      sort: (row) => row.id,
      text: (row) => row.id,
    },
    {
      key: 'title',
      label: text.columnTitle,
      cell: (row) => (
        <>
          {row.title}
          {row.unclear && <p className="cell-text">«…{row.unclear.context}…»</p>}
          {row.note && (
            <p className="cell-text">
              {text.noteOf(dateText(row.note.at))}: {row.note.text}
            </p>
          )}
        </>
      ),
      sort: (row) => row.title,
      text: (row) => row.title,
    },
    {
      key: 'state',
      label: text.columnState,
      width: '110px',
      cell: (row) => row.state,
      sort: (row) => row.state,
      text: (row) => row.state,
    },
    {
      key: 'period',
      label: text.columnPeriod,
      width: '90px',
      cell: (row) => row.period ?? '—',
      sort: (row) => row.period,
      text: (row) => row.period ?? '',
    },
    {
      key: 'signals',
      label: text.columnSignals,
      width: '250px',
      cell: (row) => (
        <ul className="signals">
          {row.signals.map((signal) => (
            <li key={signal} className="signal status-warning">
              <span title={signal}>{text.signals[signal]}</span>
              <button
                type="button"
                className="signal-remove"
                aria-label={text.removeSignal(text.signals[signal] ?? signal)}
                title={text.removeSignal(text.signals[signal] ?? signal)}
                onClick={() => onRemoveSignal(row.id, signal)}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ),
      sort: (row) => row.signals.length,
      text: (row) => row.signals.map((signal) => `${signal} ${text.signals[signal]}`).join(' '),
    },
    {
      key: 'clear',
      label: '',
      name: text.markClear,
      kind: 'actions',
      width: onOpenItem ? '240px' : '100px',
      cell: (row) => (
        <>
          <button type="button" title={text.markClearHint} onClick={() => onClear(row.id)}>
            {text.markClear}
          </button>
          <OpenItem id={row.id} onOpen={onOpenItem} />
        </>
      ),
    },
  ]
  // A tracker without planning periods has no column for them: it would be empty on every row.
  const columns = allColumns.filter((column) => hasPeriods || column.key !== 'period')
  return (
    <DataTable label={text.columnSignals} columns={columns} rows={rows} rowKey={(row) => row.id} />
  )
}

const decisionKey = (row: DecisionRow): string => `${row.kind} ${row.id} ${row.signal ?? ''}`

function DecisionTable({
  rows,
  onRestore,
}: {
  rows: readonly DecisionRow[]
  onRestore: (row: DecisionRow) => void
}) {
  const names = text.decisionColumns
  const columns: DataColumn<DecisionRow>[] = [
    {
      key: 'item',
      label: names.item,
      cell: (row) => (
        <>
          <span className="mono">#{row.id}</span> {row.title ?? text.itemGone}
        </>
      ),
      sort: (row) => row.id,
      text: (row) => `${row.id} ${row.title ?? ''}`,
    },
    {
      key: 'decision',
      label: names.decision,
      cell: (row) => (
        <>
          {text.decisionKinds[row.kind]}
          {row.signal && `: ${text.signals[row.signal] ?? row.signal}`}
          {row.text && <p className="cell-text">{row.text}</p>}
        </>
      ),
      sort: (row) => row.kind,
      text: (row) => `${text.decisionKinds[row.kind]} ${row.text ?? ''}`,
    },
    {
      key: 'since',
      label: names.since,
      width: '110px',
      cell: (row) => dateText(row.at),
      sort: (row) => row.at,
    },
    {
      key: 'restore',
      label: '',
      name: text.restore,
      kind: 'actions',
      width: '130px',
      cell: (row) => (
        <button type="button" onClick={() => onRestore(row)}>
          {row.kind === 'note' ? text.removeNote : text.restore}
        </button>
      ),
    },
  ]
  return (
    <DataTable
      label={text.decisionsTitle(rows.length)}
      columns={columns}
      rows={rows}
      rowKey={decisionKey}
    />
  )
}
