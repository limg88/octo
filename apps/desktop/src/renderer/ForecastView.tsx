import type { ForecastFile, ForecastView as View } from '@octo/application'
import {
  FORECAST_KINDS,
  FORECAST_MONTH,
  type ForecastKind,
  type ForecastProject,
  type ForecastSettings,
  type Lifetime,
  NO_FORECAST_PROJECT,
  NO_ROW_INPUTS,
  type Project,
} from '@octo/domain'
import { useEffect, useState } from 'react'
import type { ErrorCode, OctoApi } from '../shared/api.ts'
import { Failure } from './Failure.tsx'
import { FieldProblems, NotSaved } from './FieldProblems.tsx'
import { ForecastLifetime } from './ForecastLifetime.tsx'
import { ForecastMonth } from './ForecastMonth.tsx'
import { amountField, amountOf, amountText } from './forecast-text.ts'
import { MonthField } from './MonthField.tsx'
import { messages } from './messages.ts'
import { PathField } from './PathField.tsx'
import { blankRow, orOneRow, type Row, type RowsColumn, RowsField } from './RowsField.tsx'
import { useSavedNote } from './SavedNote.tsx'
import type { Section } from './sections.ts'

type ForecastApi = Pick<
  OctoApi,
  | 'forecastSettings'
  | 'saveForecastSettings'
  | 'forecastCandidates'
  | 'forecastView'
  | 'compileForecast'
  | 'readForecastOrders'
  | 'forecastLifetime'
  | 'openEvidence'
  | 'chooseProjectPath'
>

type Props = {
  api: ForecastApi
  project: Project
  /** The present moment; a test passes its own. */
  now?: () => Date
  /** Takes the PM to the section where an error is put right. */
  onOpenSection?: (section: Section) => void
}

const text = messages.forecast

/** The two ways of reading the forecast: a month of every code, or a code over its whole life. */
const FORECAST_PARTS = ['month', 'lifetime'] as const
type ForecastPart = (typeof FORECAST_PARTS)[number]

/** A project sold only at a fixed price is read by its whole life first. */
function firstPart(settings: ForecastSettings): ForecastPart {
  const kinds = Object.values(settings.projects).map((project) => project.kind)
  return kinds.length > 0 && kinds.every((kind) => kind === 'fixed_price') ? 'lifetime' : 'month'
}

/** The month before a day: the last one whose hours can be complete. */
export function previousMonthOf(today: Date): string {
  const first = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1))
  return first.toISOString().slice(0, 7)
}

/**
 * The monthly forecast of the project codes of the project, computed from its timesheets; the
 * spreadsheet of the administration is filled only when the PM points at one.
 */
export function ForecastView({ api, project, now = () => new Date(), onOpenSection }: Props) {
  const [settings, setSettings] = useState<ForecastSettings | null>(null)
  const [candidates, setCandidates] = useState<string[]>([])
  const [view, setView] = useState<View | null>(null)
  const [month, setMonth] = useState(() => previousMonthOf(now()))
  const [error, setError] = useState<ErrorCode | null>(null)
  const savedNote = useSavedNote()
  const [compiling, setCompiling] = useState(false)
  const [file, setFile] = useState<ForecastFile | null>(null)
  const [readingOrders, setReadingOrders] = useState(false)
  const [part, setPart] = useState<ForecastPart>('month')
  const [saves, setSaves] = useState(0)

  /** The forecast of a month; the project codes it holds, or null when it could not be computed. */
  async function loadView(wanted: string): Promise<string[] | null> {
    setError(null)
    setFile(null)
    const result = await api.forecastView(project.id, wanted)
    if (result.ok) {
      setView(result.value)
      return result.value.forecast.rows.map((row) => row.code)
    }
    setView(null)
    setError(result.code)
    return null
  }

  /**
   * A project code the settings know nothing of is asked to the company's system, once and
   * without a word: its name, what was ordered and how it is sold. A system that is not linked
   * or does not answer changes nothing: the PM can still ask with the button, and is told why.
   */
  async function learnNewCodes(known: ForecastSettings, codes: readonly string[]) {
    // A fixed price whose start is not known is asked too: its months before are needed.
    const learned = (code: string): boolean => {
      const project = known.projects[code]
      return (
        project !== undefined && (project.kind !== 'fixed_price' || project.startMonth !== null)
      )
    }
    if (codes.every(learned)) return
    const result = await api.readForecastOrders(project.id)
    if (!result.ok) return
    setSettings(result.value.settings)
    await loadView(month)
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new project starts from its settings; the month is followed by its own handler.
  useEffect(() => {
    setSettings(null)
    setView(null)
    setError(null)
    setFile(null)
    void api.forecastSettings(project.id).then(async (result) => {
      if (!result.ok) return setError(result.code)
      setSettings(result.value)
      setPart(firstPart(result.value))
      if (result.value.modelPath === '') {
        const found = await api.forecastCandidates(project.id)
        if (found.ok) setCandidates(found.value)
      }
      const codes = await loadView(month)
      if (codes !== null) await learnNewCodes(result.value, codes)
    })
  }, [api, project.id])

  async function save(next: ForecastSettings) {
    setError(null)
    savedNote.clear()
    const result = await api.saveForecastSettings(project.id, next)
    if (!result.ok) return setError(result.code)
    setSettings(result.value)
    savedNote.saved()
    setSaves((count) => count + 1)
    await loadView(month)
  }

  /**
   * The costs at budget the caps of the people propose, kept because the PM said so: from the
   * month the code began when none was ever written, so every month since counts on them; else
   * from the month that runs, as a budget seen again.
   */
  async function useBudget(life: Lifetime, costs: number) {
    if (settings === null) return
    const start = settings.projects[life.code]?.startMonth ?? null
    const at = life.budgetCosts === null && start !== null ? start : life.through
    const rows = settings.months[at] ?? {}
    await save({
      ...settings,
      months: {
        ...settings.months,
        [at]: {
          ...rows,
          [life.code]: { ...(rows[life.code] ?? NO_ROW_INPUTS), budgetCosts: costs },
        },
      },
    })
  }

  /** Name and ordered amount of the project codes, as the company's system has them now. */
  async function readOrders() {
    setReadingOrders(true)
    setError(null)
    const result = await api.readForecastOrders(project.id)
    setReadingOrders(false)
    if (!result.ok) return setError(result.code)
    setSettings(result.value.settings)
    savedNote.saved()
    await loadView(month)
  }

  async function compile() {
    setCompiling(true)
    setError(null)
    setFile(null)
    const result = await api.compileForecast(project.id, month)
    setCompiling(false)
    if (result.ok) setFile(result.value)
    else setError(result.code)
  }

  /** The model is a spreadsheet of the project: chosen from the dialog of the system. */
  async function chooseModel(): Promise<string | null> {
    setError(null)
    const result = await api.chooseProjectPath(project.id, 'file', ['xlsx'])
    if (result.ok) return result.value
    setError(result.code)
    return null
  }

  if (settings === null) {
    return error ? (
      <Failure code={error} onOpen={onOpenSection} />
    ) : (
      <p className="progress">{text.loading}</p>
    )
  }

  return (
    <div className="dashboard">
      {error && <Failure code={error} onOpen={onOpenSection} />}
      {savedNote.note}
      <details className="dashboard-settings">
        <summary>{text.settings}</summary>
        <p className="hint">{text.setupIntro}</p>
        <div className="actions">
          <button type="button" disabled={readingOrders} onClick={() => void readOrders()}>
            {text.readOrders}
          </button>
          <span className="hint">{readingOrders ? text.readingOrders : text.readOrdersHint}</span>
        </div>
        <SettingsForm
          settings={settings}
          candidates={candidates}
          codes={view?.forecast.rows.map((row) => row.code) ?? []}
          onSave={save}
          onChooseModel={chooseModel}
        />
      </details>
      <p className="badge badge-warning">{text.internal}</p>
      <div className="dashboard-tabs" role="tablist" aria-label={text.partsLabel}>
        {FORECAST_PARTS.map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            aria-selected={part === name}
            className={part === name ? 'tab tab-selected' : 'tab'}
            onClick={() => setPart(name)}
          >
            {text.parts[name]}
          </button>
        ))}
      </div>
      {part === 'lifetime' ? (
        <ForecastLifetime
          api={api}
          project={project}
          onOpenSection={onOpenSection}
          onUseBudget={useBudget}
          version={saves}
        />
      ) : (
        <>
          <div className="range-fields">
            <MonthField
              label={text.month}
              value={month}
              onChange={(value) => {
                setMonth(value)
                void loadView(value)
              }}
            />
            {view && view.forecast.rows.length > 0 && settings.modelPath !== '' && (
              <button
                type="button"
                className="primary"
                disabled={compiling}
                onClick={() => void compile()}
              >
                {text.compile}
              </button>
            )}
          </div>
          {compiling && (
            <p className="progress" role="status">
              {text.compiling}
            </p>
          )}
          {file && (
            <p className="badge badge-ok">
              {text.compiled(file.path)}{' '}
              <button
                type="button"
                className="quiet"
                onClick={() => void api.openEvidence(project.id, file.path)}
              >
                {text.open}
              </button>
              {file.notInModel.length > 0 && <> {text.notInModel(file.notInModel.join(', '))}</>}
            </p>
          )}
          {view && (
            <ForecastMonth
              view={view}
              settings={settings}
              month={month}
              onSaveMonth={(inputs) =>
                save({ ...settings, months: { ...settings.months, [month]: inputs } })
              }
              onSaveSettings={save}
              onOpenSection={onOpenSection}
            />
          )}
        </>
      )}
    </div>
  )
}

/** The rows that hold something, each checked: what is wrong, by its place in the list. */
function wrongRows<Key extends string>(
  rows: ReadonlyArray<Row<Key>>,
  right: (row: Row<Key>) => boolean,
  message: (n: number) => string,
): string[] {
  return rows.flatMap((row, index) => (blankRow(row) || right(row) ? [] : [message(index + 1)]))
}

const filled = (...values: string[]): boolean => values.every((value) => value.trim() !== '')
const isAmount = (typed: string): boolean => amountOf(typed) !== null

type RateKey = 'person' | 'code' | 'rate'
type ExternalRateKey = 'name' | 'code' | 'cost' | 'rate'
const RATE_COLUMNS: RowsColumn<RateKey>[] = [
  { key: 'person', label: text.columns.person },
  { key: 'code', label: text.columns.codeOrAll, width: '200px' },
  { key: 'rate', label: text.columns.rate, kind: 'amount', width: '150px' },
]
const EXTERNAL_RATE_COLUMNS: RowsColumn<ExternalRateKey>[] = [
  { key: 'name', label: text.columns.name },
  { key: 'code', label: text.columns.code, width: '160px' },
  { key: 'cost', label: text.columns.cost, kind: 'amount', width: '140px' },
  { key: 'rate', label: text.columns.rate, kind: 'amount', width: '140px' },
]

type HourlyCostKey = 'person' | 'hourly'
const HOURLY_COST_COLUMNS: RowsColumn<HourlyCostKey>[] = [
  { key: 'person', label: text.columns.person },
  { key: 'hourly', label: text.columnHourlyCost, kind: 'amount', width: '160px' },
]
const HOURLY_COST_LABELS: Record<HourlyCostKey, string> = {
  person: text.columns.person,
  hourly: text.columnHourlyCost,
}

type ProjectDraft = {
  kind: ForecastKind
  description: string
  ordered: string
  feeMonths: string
  startMonth: string
  /** Read from the company's system and never typed: kept as they are through a save. */
  invoiced: number | null
  recognized: number | null
}
type SettingsDraft = {
  modelPath: string
  projects: Record<string, ProjectDraft>
  hoursPerDay: string
  rates: Row<RateKey>[]
  externals: Row<ExternalRateKey>[]
  hourlyCosts: Row<HourlyCostKey>[]
}

const projectDraft = (project: ForecastProject): ProjectDraft => ({
  kind: project.kind,
  description: project.description,
  ordered: amountText(project.ordered),
  feeMonths: project.feeMonths === null ? '' : String(project.feeMonths),
  startMonth: project.startMonth ?? '',
  invoiced: project.invoiced,
  recognized: project.recognized,
})
const NO_PROJECT_DRAFT = projectDraft(NO_FORECAST_PROJECT)
const isMonths = (typed: string): boolean => typed.trim() === '' || /^[1-9]\d*$/.test(typed.trim())
const isStartMonth = (typed: string): boolean =>
  typed.trim() === '' || FORECAST_MONTH.test(typed.trim())

const settingsDraft = (settings: ForecastSettings): SettingsDraft => ({
  modelPath: settings.modelPath,
  projects: Object.fromEntries(
    Object.entries(settings.projects).map(([code, project]) => [code, projectDraft(project)]),
  ),
  hoursPerDay: String(settings.hoursPerDay),
  rates: orOneRow(
    settings.rates.map((rate) => ({
      person: rate.person,
      code: rate.code ?? '',
      rate: amountText(rate.ratePerDay),
    })),
    RATE_COLUMNS,
  ),
  externals: orOneRow(
    settings.externals.map((external) => ({
      name: external.name,
      code: external.code,
      cost: amountText(external.costPerDay),
      rate: amountText(external.ratePerDay),
    })),
    EXTERNAL_RATE_COLUMNS,
  ),
  hourlyCosts: orOneRow(
    settings.hourlyCosts.map((entry) => ({
      person: entry.person,
      hourly: amountText(entry.costPerHour),
    })),
    HOURLY_COST_COLUMNS,
  ),
})

function SettingsForm({
  settings,
  candidates,
  codes,
  onSave,
  onChooseModel,
}: {
  settings: ForecastSettings
  candidates: string[]
  /** The project codes of the project: one line each, and proposed where a code is typed. */
  codes: string[]
  onSave: (settings: ForecastSettings) => Promise<void>
  onChooseModel: () => Promise<string | null>
}) {
  const [draft, setDraft] = useState<SettingsDraft>(() => settingsDraft(settings))
  const [problems, setProblems] = useState<{
    projects: string[]
    rates: string[]
    externals: string[]
    hourlyCosts: string[]
  } | null>(null)
  const projectOf = (code: string): ProjectDraft => draft.projects[code] ?? NO_PROJECT_DRAFT
  const changeProject = (code: string, part: Partial<ProjectDraft>) =>
    setDraft((current) => ({
      ...current,
      projects: { ...current.projects, [code]: { ...projectOf(code), ...part } },
    }))
  // What is typed follows what is saved; with no model saved, the only one found is proposed.
  useEffect(() => {
    const saved = settingsDraft(settings)
    const proposed = candidates.length === 1 ? (candidates[0] ?? '') : ''
    setDraft({ ...saved, modelPath: saved.modelPath || proposed })
  }, [settings, candidates])
  // The rates of the people tell the revenue of what is sold by the day only: with no such code
  // they are not asked. Those already written stay, and are saved as they are.
  const byTheDay =
    codes.length === 0 || codes.some((code) => projectOf(code).kind === 'time_material')
  const withCodes = <Key extends string>(columns: RowsColumn<Key>[]): RowsColumn<Key>[] =>
    columns.map((column) => (column.key === 'code' ? { ...column, suggestions: codes } : column))

  function submit() {
    const found = {
      projects: codes.flatMap((code) => {
        const { ordered, feeMonths, startMonth } = projectOf(code)
        return amountField(ordered).wrong || !isMonths(feeMonths) || !isStartMonth(startMonth)
          ? [text.wrong.project(code)]
          : []
      }),
      rates: wrongRows(
        draft.rates,
        (row) => filled(row.person) && isAmount(row.rate),
        text.wrong.rate,
      ),
      externals: wrongRows(
        draft.externals,
        (row) => filled(row.name, row.code) && isAmount(row.cost) && isAmount(row.rate),
        text.wrong.external,
      ),
      hourlyCosts: wrongRows(
        draft.hourlyCosts,
        (row) => filled(row.person) && (amountOf(row.hourly) ?? 0) > 0,
        text.wrong.hourlyCost,
      ),
    }
    if (Object.values(found).some((lines) => lines.length > 0)) return setProblems(found)
    setProblems(null)
    void onSave({
      ...settings,
      modelPath: draft.modelPath,
      projects: Object.fromEntries(
        Object.entries(draft.projects).map(([code, project]) => [
          code,
          {
            kind: project.kind,
            description: project.description,
            ordered: amountOf(project.ordered),
            feeMonths: project.feeMonths.trim() === '' ? null : Number(project.feeMonths),
            startMonth: project.startMonth.trim() === '' ? null : project.startMonth.trim(),
            invoiced: project.invoiced,
            recognized: project.recognized,
          },
        ]),
      ),
      hoursPerDay: Number(draft.hoursPerDay),
      rates: draft.rates
        .filter((row) => !blankRow(row))
        .map((row) => ({
          person: row.person.trim(),
          code: row.code.trim() === '' ? null : row.code.trim().toUpperCase(),
          ratePerDay: amountOf(row.rate) ?? 0,
        })),
      externals: draft.externals
        .filter((row) => !blankRow(row))
        .map((row) => ({
          name: row.name.trim(),
          code: row.code.trim().toUpperCase(),
          costPerDay: amountOf(row.cost) ?? 0,
          ratePerDay: amountOf(row.rate) ?? 0,
        })),
      hourlyCosts: draft.hourlyCosts
        .filter((row) => !blankRow(row))
        .map((row) => ({ person: row.person.trim(), costPerHour: amountOf(row.hourly) ?? 0 })),
    })
  }

  return (
    <form
      className="settings-form wide-form"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      {codes.length > 0 && (
        <>
          <h4>{text.projects}</h4>
          <p className="hint">{text.projectsHint}</p>
          <div className="table-wide">
            <table aria-label={text.projects}>
              <thead>
                <tr>
                  <th scope="col">{text.columnCode}</th>
                  <th scope="col">{text.columnKind}</th>
                  <th scope="col">{text.columnOrdered}</th>
                  <th scope="col">{text.columnFeeMonths}</th>
                  <th scope="col">{text.columnStartMonth}</th>
                </tr>
              </thead>
              <tbody>
                {codes.map((code) => (
                  <tr key={code}>
                    <th scope="row">
                      {code}
                      {projectOf(code).description !== '' && (
                        <span className="hint"> {projectOf(code).description}</span>
                      )}
                    </th>
                    <td>
                      <select
                        aria-label={text.forCode(text.columnKind, code)}
                        value={projectOf(code).kind}
                        onChange={(event) =>
                          changeProject(code, { kind: event.target.value as ForecastKind })
                        }
                      >
                        {FORECAST_KINDS.map((kind) => (
                          <option key={kind} value={kind}>
                            {text.kinds[kind]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        type="text"
                        inputMode="decimal"
                        className="amount"
                        aria-label={text.forCode(text.columnOrdered, code)}
                        value={projectOf(code).ordered}
                        onChange={(event) => changeProject(code, { ordered: event.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        inputMode="numeric"
                        className="amount"
                        aria-label={text.forCode(text.columnFeeMonths, code)}
                        disabled={projectOf(code).kind !== 'fee'}
                        value={projectOf(code).feeMonths}
                        onChange={(event) => changeProject(code, { feeMonths: event.target.value })}
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        className="amount"
                        placeholder="2026-09"
                        aria-label={text.forCode(text.columnStartMonth, code)}
                        value={projectOf(code).startMonth}
                        onChange={(event) =>
                          changeProject(code, { startMonth: event.target.value })
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      <FieldProblems lines={problems?.projects ?? []} />
      <PathField
        label={text.modelPath}
        value={draft.modelPath}
        candidates={candidates}
        onChange={(modelPath) => setDraft((current) => ({ ...current, modelPath }))}
        onChoose={onChooseModel}
      />
      <label>
        {text.hoursPerDay}
        <input
          type="number"
          value={draft.hoursPerDay}
          onChange={(event) => {
            const { value } = event.target
            setDraft((current) => ({ ...current, hoursPerDay: value }))
          }}
        />
      </label>
      {byTheDay ? (
        <>
          <h4>{text.rates}</h4>
          <p className="hint">{text.ratesHint}</p>
          <RowsField
            label={text.rates}
            columns={withCodes(RATE_COLUMNS)}
            rows={draft.rates}
            onChange={(rates) => setDraft((current) => ({ ...current, rates }))}
            addLabel={text.add.rate}
            cellLabel={(column, row) => text.cell(RATE_LABELS[column], row)}
            removeLabel={text.removeRow}
          />
          <FieldProblems lines={problems?.rates ?? []} />
        </>
      ) : (
        <p className="hint">{text.noRatesNeeded}</p>
      )}
      <h4>{text.externalRates}</h4>
      <p className="hint">{text.externalRatesHint}</p>
      <RowsField
        label={text.externalRates}
        columns={withCodes(EXTERNAL_RATE_COLUMNS)}
        rows={draft.externals}
        onChange={(externals) => setDraft((current) => ({ ...current, externals }))}
        addLabel={text.add.external}
        cellLabel={(column, row) => text.cell(text.columns[column], row)}
        removeLabel={text.removeRow}
      />
      <FieldProblems lines={problems?.externals ?? []} />
      <h4>{text.hourlyCosts}</h4>
      <p className="hint">{text.hourlyCostsHint}</p>
      <RowsField
        label={text.hourlyCosts}
        columns={HOURLY_COST_COLUMNS}
        rows={draft.hourlyCosts}
        onChange={(hourlyCosts) => setDraft((current) => ({ ...current, hourlyCosts }))}
        addLabel={text.add.hourlyCost}
        cellLabel={(column, row) => text.cell(HOURLY_COST_LABELS[column], row)}
        removeLabel={text.removeRow}
      />
      <FieldProblems lines={problems?.hourlyCosts ?? []} />
      <div className="actions">
        <button type="submit">{text.save}</button>
        {problems && <NotSaved text={messages.notSaved} />}
      </div>
    </form>
  )
}

const RATE_LABELS: Record<RateKey, string> = {
  person: text.columns.person,
  code: text.columns.code,
  rate: text.columns.rate,
}
