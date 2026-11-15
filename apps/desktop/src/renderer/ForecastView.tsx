import type { ForecastFile, ForecastView as View } from '@octo/application'
import type { ForecastSettings, Project } from '@octo/domain'
import { useEffect, useState } from 'react'
import type { ErrorCode, OctoApi } from '../shared/api.ts'
import { Failure } from './Failure.tsx'
import { FieldProblems, NotSaved } from './FieldProblems.tsx'
import { ForecastMonth } from './ForecastMonth.tsx'
import { amountOf, amountText } from './forecast-text.ts'
import { MonthField } from './MonthField.tsx'
import { messages } from './messages.ts'
import { PathField } from './PathField.tsx'
import { blankRow, orOneRow, type Row, type RowsColumn, RowsField } from './RowsField.tsx'
import type { Section } from './sections.ts'

type ForecastApi = Pick<
  OctoApi,
  | 'forecastSettings'
  | 'saveForecastSettings'
  | 'forecastCandidates'
  | 'forecastView'
  | 'compileForecast'
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

/** The month before a day: the last one whose hours can be complete. */
export function previousMonthOf(today: Date): string {
  const first = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1))
  return first.toISOString().slice(0, 7)
}

/** The monthly forecast of the administration, filled on its own spreadsheet. */
export function ForecastView({ api, project, now = () => new Date(), onOpenSection }: Props) {
  const [settings, setSettings] = useState<ForecastSettings | null>(null)
  const [candidates, setCandidates] = useState<string[]>([])
  const [view, setView] = useState<View | null>(null)
  const [month, setMonth] = useState(() => previousMonthOf(now()))
  const [error, setError] = useState<ErrorCode | null>(null)
  const [compiling, setCompiling] = useState(false)
  const [file, setFile] = useState<ForecastFile | null>(null)

  async function loadView(wanted: string) {
    setError(null)
    setFile(null)
    const result = await api.forecastView(project.id, wanted)
    if (result.ok) setView(result.value)
    else {
      setView(null)
      setError(result.code)
    }
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
      if (result.value.modelPath !== '') return loadView(month)
      const found = await api.forecastCandidates(project.id)
      if (found.ok) setCandidates(found.value)
    })
  }, [api, project.id])

  async function save(next: ForecastSettings) {
    setError(null)
    const result = await api.saveForecastSettings(project.id, next)
    if (!result.ok) return setError(result.code)
    setSettings(result.value)
    if (result.value.modelPath !== '') await loadView(month)
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

  if (settings.modelPath === '') {
    return (
      <div className="dashboard">
        {error && <Failure code={error} onOpen={onOpenSection} />}
        <section aria-label={text.setupTitle}>
          <h3>{text.setupTitle}</h3>
          <p className="hint">{text.setupIntro}</p>
          <SettingsForm
            settings={settings}
            candidates={candidates}
            codes={[]}
            onSave={save}
            onChooseModel={chooseModel}
          />
        </section>
      </div>
    )
  }

  return (
    <div className="dashboard">
      {error && <Failure code={error} onOpen={onOpenSection} />}
      <details className="dashboard-settings">
        <summary>{text.settings}</summary>
        <SettingsForm
          settings={settings}
          candidates={candidates}
          codes={view?.forecast.rows.map((row) => row.code) ?? []}
          onSave={save}
          onChooseModel={chooseModel}
        />
      </details>
      <p className="badge badge-warning">{text.internal}</p>
      <div className="range-fields">
        <MonthField
          label={text.month}
          value={month}
          onChange={(value) => {
            setMonth(value)
            void loadView(value)
          }}
        />
        {view && view.forecast.rows.length > 0 && (
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

type SettingsDraft = {
  modelPath: string
  hoursPerDay: string
  rates: Row<RateKey>[]
  externals: Row<ExternalRateKey>[]
}

const settingsDraft = (settings: ForecastSettings): SettingsDraft => ({
  modelPath: settings.modelPath,
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
  /** The project codes the model lists: proposed where a code is typed. */
  codes: string[]
  onSave: (settings: ForecastSettings) => Promise<void>
  onChooseModel: () => Promise<string | null>
}) {
  const [draft, setDraft] = useState<SettingsDraft>(() => settingsDraft(settings))
  const [problems, setProblems] = useState<{ rates: string[]; externals: string[] } | null>(null)
  useEffect(() => setDraft(settingsDraft(settings)), [settings])
  // The only model found is proposed without asking.
  useEffect(() => {
    setDraft((current) => ({
      ...current,
      modelPath: current.modelPath || (candidates.length === 1 ? (candidates[0] ?? '') : ''),
    }))
  }, [candidates])
  const withCodes = <Key extends string>(columns: RowsColumn<Key>[]): RowsColumn<Key>[] =>
    columns.map((column) => (column.key === 'code' ? { ...column, suggestions: codes } : column))

  function submit() {
    const found = {
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
    }
    if (found.rates.length + found.externals.length > 0) return setProblems(found)
    setProblems(null)
    void onSave({
      ...settings,
      modelPath: draft.modelPath,
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
      <div className="actions">
        <button type="submit" disabled={draft.modelPath.trim() === ''}>
          {text.save}
        </button>
        {draft.modelPath.trim() === '' && <span className="hint">{text.saveNeeds}</span>}
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
