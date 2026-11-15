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
import {
  amountOf,
  amountText,
  externalLines,
  externalRateLines,
  externalRatesOf,
  externalsOf,
  rateLines,
  ratesOf,
} from './forecast-text.ts'
import { errorText, messages } from './messages.ts'

type ForecastApi = Pick<
  OctoApi,
  | 'forecastSettings'
  | 'saveForecastSettings'
  | 'forecastCandidates'
  | 'forecastView'
  | 'compileForecast'
  | 'openEvidence'
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
          <SettingsForm settings={settings} candidates={candidates} onSave={save} />
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
        <label>
          {text.month}
          <input
            type="month"
            value={month}
            onChange={(event) => {
              const { value } = event.target
              if (value === '') return
              setMonth(value)
              void loadView(value)
            }}
          />
        </label>
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
                onSave={(inputs) => saveInputs(row.code, inputs)}
              />
            </details>
          ))}
        </>
      )}
      <details className="dashboard-settings">
        <summary>{text.settings}</summary>
        <SettingsForm settings={settings} candidates={candidates} onSave={save} />
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

type InputsDraft = {
  externals: string
  toInvoice: string
  revenue: string
  budgetCosts: string
  totalCosts: string
  totalCostsBeforeMonth: boolean
  note: string
}

const inputsDraft = (inputs: ForecastRowInputs): InputsDraft => ({
  externals: externalLines(inputs.externals),
  toInvoice: amountText(inputs.toInvoice),
  revenue: amountText(inputs.revenue),
  budgetCosts: amountText(inputs.budgetCosts),
  totalCosts: amountText(inputs.totalCosts),
  totalCostsBeforeMonth: inputs.totalCostsBeforeMonth,
  note: inputs.note,
})

type AmountField = 'toInvoice' | 'revenue' | 'budgetCosts' | 'totalCosts'

function InputsForm({
  code,
  inputs,
  onSave,
}: {
  code: string
  inputs: ForecastRowInputs
  onSave: (inputs: ForecastRowInputs) => Promise<void>
}) {
  const [draft, setDraft] = useState<InputsDraft>(() => inputsDraft(inputs))
  useEffect(() => setDraft(inputsDraft(inputs)), [inputs])

  const amount = (name: AmountField, label: string) => (
    <label>
      {label}
      <input
        type="text"
        inputMode="decimal"
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
      aria-label={text.inputsTitle(code)}
      onSubmit={(event) => {
        event.preventDefault()
        void onSave({
          externals: externalsOf(draft.externals),
          toInvoice: amountOf(draft.toInvoice),
          revenue: amountOf(draft.revenue),
          budgetCosts: amountOf(draft.budgetCosts),
          totalCosts: amountOf(draft.totalCosts),
          totalCostsBeforeMonth: draft.totalCostsBeforeMonth,
          note: draft.note,
        })
      }}
    >
      <label>
        {text.externals}
        <textarea
          value={draft.externals}
          onChange={(event) => {
            const { value } = event.target
            setDraft((current) => ({ ...current, externals: value }))
          }}
        />
      </label>
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
      </div>
    </form>
  )
}

type SettingsDraft = { modelPath: string; hoursPerDay: string; rates: string; externals: string }

const settingsDraft = (settings: ForecastSettings): SettingsDraft => ({
  modelPath: settings.modelPath,
  hoursPerDay: String(settings.hoursPerDay),
  rates: rateLines(settings.rates),
  externals: externalRateLines(settings.externals),
})

function SettingsForm({
  settings,
  candidates,
  onSave,
}: {
  settings: ForecastSettings
  candidates: string[]
  onSave: (settings: ForecastSettings) => Promise<void>
}) {
  const [draft, setDraft] = useState<SettingsDraft>(() => settingsDraft(settings))
  useEffect(() => setDraft(settingsDraft(settings)), [settings])
  // The only model found is proposed without asking.
  useEffect(() => {
    setDraft((current) => ({
      ...current,
      modelPath: current.modelPath || (candidates.length === 1 ? (candidates[0] ?? '') : ''),
    }))
  }, [candidates])

  return (
    <form
      className="settings-form"
      onSubmit={(event) => {
        event.preventDefault()
        void onSave({
          ...settings,
          modelPath: draft.modelPath,
          hoursPerDay: Number(draft.hoursPerDay),
          rates: ratesOf(draft.rates),
          externals: externalRatesOf(draft.externals),
        })
      }}
    >
      <label>
        {text.modelPath}
        <input
          type="text"
          list={candidates.length > 0 ? 'forecast-models' : undefined}
          value={draft.modelPath}
          onChange={(event) => {
            const { value } = event.target
            setDraft((current) => ({ ...current, modelPath: value }))
          }}
        />
        {candidates.length > 0 && (
          <datalist id="forecast-models">
            {candidates.map((candidate) => (
              <option key={candidate} value={candidate} />
            ))}
          </datalist>
        )}
      </label>
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
      <label>
        {text.rates}
        <textarea
          value={draft.rates}
          onChange={(event) => {
            const { value } = event.target
            setDraft((current) => ({ ...current, rates: value }))
          }}
        />
      </label>
      <p className="hint">{text.ratesHint}</p>
      <label>
        {text.externalRates}
        <textarea
          value={draft.externals}
          onChange={(event) => {
            const { value } = event.target
            setDraft((current) => ({ ...current, externals: value }))
          }}
        />
      </label>
      <p className="hint">{text.externalRatesHint}</p>
      <div className="actions">
        <button type="submit" disabled={draft.modelPath.trim() === ''}>
          {text.save}
        </button>
      </div>
    </form>
  )
}
