import type { ForecastFile, ForecastView as View } from '@octo/application'
import {
  type ForecastGap,
  type ForecastRow,
  type ForecastRowInputs,
  type ForecastSettings,
  NO_ROW_INPUTS,
  type Project,
} from '@octo/domain'
import { useEffect, useState } from 'react'
import type { ErrorCode, OctoApi } from '../shared/api.ts'
import { FieldProblems, NotSaved } from './FieldProblems.tsx'
import { amountField, amountOf, amountText } from './forecast-text.ts'
import { MonthField } from './MonthField.tsx'
import { errorText, messages } from './messages.ts'
import { PathField } from './PathField.tsx'
import { blankRow, orOneRow, type Row, type RowsColumn, RowsField } from './RowsField.tsx'

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
}

const text = messages.forecast

/** The month before a day: the last one whose hours can be complete. */
export function previousMonthOf(today: Date): string {
  const first = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1))
  return first.toISOString().slice(0, 7)
}

/** The monthly forecast of the administration, filled on its own spreadsheet. */
export function ForecastView({ api, project, now = () => new Date() }: Props) {
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
    return error ? <Failure code={error} /> : <p className="progress">{text.loading}</p>
  }

  if (settings.modelPath === '') {
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
            onSave={save}
            onChooseModel={chooseModel}
          />
        </section>
      </div>
    )
  }

  const saveInputs = (code: string, inputs: ForecastRowInputs) =>
    save({
      ...settings,
      months: { ...settings.months, [month]: { ...settings.months[month], [code]: inputs } },
    })

  return (
    <div className="dashboard">
      {error && <Failure code={error} />}
      <p className="hint">{text.internal}</p>
      <div className="range-fields">
        <MonthField
          label={text.month}
          value={month}
          onChange={(value) => {
            setMonth(value)
            void loadView(value)
          }}
        />
      </div>
      {view && (
        <>
          <Table rows={view.forecast.rows} />
          <Gaps view={view} />
          <div className="actions">
            <button
              type="button"
              className="primary"
              disabled={compiling}
              onClick={() => void compile()}
            >
              {text.compile}
            </button>
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
          {view.forecast.rows.map((row) => (
            <details key={row.code} className="dashboard-settings">
              <summary>{text.inputsTitle(row.code)}</summary>
              <InputsForm
                code={row.code}
                inputs={settings.months[month]?.[row.code] ?? NO_ROW_INPUTS}
                externalNames={settings.externals
                  .filter((external) => external.code === row.code)
                  .map((external) => external.name)}
                onSave={(inputs) => saveInputs(row.code, inputs)}
              />
            </details>
          ))}
        </>
      )}
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

function Table({ rows }: { rows: ForecastRow[] }) {
  if (rows.length === 0) return <p className="hint">{text.noRows}</p>
  return (
    <table className="data">
      <thead>
        <tr>
          <th>{text.columnCode}</th>
          <th className="number">{text.columnInternal}</th>
          <th className="number">{text.columnExternal}</th>
          <th className="number">{text.columnRevenue}</th>
          <th className="number">{text.columnQuantity}</th>
          <th className="number">{text.columnMarginMonth}</th>
          <th className="number">{text.columnMarginEnd}</th>
          <th className="number">{text.columnToInvoice}</th>
          <th>{text.columnNote}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(({ code, description, values, note }) => (
          <tr key={code}>
            <td title={description}>{code}</td>
            <td className="number">{text.money(values.internalCosts)}</td>
            <td className="number">{text.money(values.externalCosts)}</td>
            <td className="number">{text.money(values.revenue)}</td>
            <td className="number">
              {values.quantityIsShare ? text.share(values.quantity) : text.days(values.quantity)}
            </td>
            <td className="number">{text.share(values.marginMonth)}</td>
            <td className="number">{text.share(values.marginEnd)}</td>
            <td className="number">{text.money(values.toInvoice)}</td>
            <td>{note}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function gapText(gap: ForecastGap): string {
  switch (gap.kind) {
    case 'no_cost':
      return text.gap.no_cost(gap.code, gap.person, text.hours(gap.hours))
    case 'no_rate':
      return text.gap.no_rate(gap.code, gap.person, text.hours(gap.hours))
    case 'no_external_rate':
      return text.gap.no_external_rate(gap.code, gap.person, text.hours(gap.hours))
    case 'no_total_costs':
      return text.gap.no_total_costs(gap.code)
    case 'no_ordered':
      return text.gap.no_ordered(gap.code)
  }
}

function Gaps({ view }: { view: View }) {
  const { gaps, notApprovedHours, otherCodes } = view.forecast
  const lines = [
    ...gaps.map(gapText),
    ...(notApprovedHours > 0 ? [text.notApproved(text.hours(notApprovedHours))] : []),
    ...(otherCodes.length > 0 ? [text.otherCodes(otherCodes.join(', '))] : []),
  ]
  return (
    <section aria-label={text.gapsTitle}>
      <h3>{text.gapsTitle}</h3>
      {lines.length === 0 ? (
        <p className="badge badge-ok">{text.noGaps}</p>
      ) : (
        <>
          <p className="hint">{text.gapsIntro}</p>
          <ul className="missing">
            {lines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

type ExternalKey = 'name' | 'hours'
const EXTERNAL_COLUMNS: RowsColumn<ExternalKey>[] = [
  { key: 'name', label: text.columns.name },
  { key: 'hours', label: text.columns.hours, kind: 'amount', width: '140px' },
]

type InputsDraft = {
  externals: Row<ExternalKey>[]
  toInvoice: string
  revenue: string
  budgetCosts: string
  totalCosts: string
  totalCostsBeforeMonth: boolean
  note: string
}

const inputsDraft = (inputs: ForecastRowInputs): InputsDraft => ({
  externals: orOneRow(
    inputs.externals.map(({ name, hours }) => ({ name, hours: amountText(hours) })),
    EXTERNAL_COLUMNS,
  ),
  toInvoice: amountText(inputs.toInvoice),
  revenue: amountText(inputs.revenue),
  budgetCosts: amountText(inputs.budgetCosts),
  totalCosts: amountText(inputs.totalCosts),
  totalCostsBeforeMonth: inputs.totalCostsBeforeMonth,
  note: inputs.note,
})

const AMOUNT_FIELDS = ['toInvoice', 'revenue', 'budgetCosts', 'totalCosts'] as const
type AmountField = (typeof AMOUNT_FIELDS)[number]

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

function InputsForm({
  code,
  inputs,
  externalNames,
  onSave,
}: {
  code: string
  inputs: ForecastRowInputs
  /** The externals declared for this code: proposed while typing. */
  externalNames: string[]
  onSave: (inputs: ForecastRowInputs) => Promise<void>
}) {
  const [draft, setDraft] = useState<InputsDraft>(() => inputsDraft(inputs))
  const [problems, setProblems] = useState<{ externals: string[]; amounts: AmountField[] } | null>(
    null,
  )
  useEffect(() => setDraft(inputsDraft(inputs)), [inputs])

  const amount = (name: AmountField, label: string) => (
    <>
      <label>
        {label}
        <input
          type="text"
          inputMode="decimal"
          className="amount"
          value={draft[name]}
          onChange={(event) => {
            const { value } = event.target
            setDraft((current) => ({ ...current, [name]: value }))
          }}
        />
      </label>
      <FieldProblems lines={problems?.amounts.includes(name) ? [messages.amountWrong] : []} />
    </>
  )

  function submit() {
    const found = {
      externals: wrongRows(
        draft.externals,
        (row) => filled(row.name) && isAmount(row.hours),
        text.wrong.hours,
      ),
      amounts: AMOUNT_FIELDS.filter((name) => amountField(draft[name]).wrong),
    }
    // A figure that is not understood is told: saved as empty, it would change the forecast.
    if (found.externals.length + found.amounts.length > 0) return setProblems(found)
    setProblems(null)
    void onSave({
      externals: draft.externals
        .filter((row) => !blankRow(row))
        .map((row) => ({ name: row.name.trim(), hours: amountOf(row.hours) ?? 0 })),
      toInvoice: amountOf(draft.toInvoice),
      revenue: amountOf(draft.revenue),
      budgetCosts: amountOf(draft.budgetCosts),
      totalCosts: amountOf(draft.totalCosts),
      totalCostsBeforeMonth: draft.totalCostsBeforeMonth,
      note: draft.note,
    })
  }

  return (
    <form
      className="settings-form"
      aria-label={text.inputsTitle(code)}
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <h4>{text.externals}</h4>
      <RowsField
        label={text.externals}
        columns={EXTERNAL_COLUMNS.map((column) =>
          column.key === 'name' ? { ...column, suggestions: externalNames } : column,
        )}
        rows={draft.externals}
        onChange={(externals) => setDraft((current) => ({ ...current, externals }))}
        addLabel={text.add.external}
        cellLabel={(column, row) => text.cell(text.columns[column], row)}
        removeLabel={text.removeRow}
      />
      <FieldProblems lines={problems?.externals ?? []} />
      {amount('toInvoice', text.toInvoice)}
      {amount('revenue', text.revenue)}
      {amount('budgetCosts', text.budgetCosts)}
      {amount('totalCosts', text.totalCosts)}
      <label className="check">
        <input
          type="checkbox"
          checked={draft.totalCostsBeforeMonth}
          onChange={(event) => {
            const { checked } = event.target
            setDraft((current) => ({ ...current, totalCostsBeforeMonth: checked }))
          }}
        />
        {text.totalCostsBeforeMonth}
      </label>
      <label>
        {text.note}
        <input
          type="text"
          value={draft.note}
          onChange={(event) => {
            const { value } = event.target
            setDraft((current) => ({ ...current, note: value }))
          }}
        />
      </label>
      <div className="actions">
        <button type="submit">{text.saveInputs}</button>
        {problems && <NotSaved text={messages.notSaved} />}
      </div>
    </form>
  )
}

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
