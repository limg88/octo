import type { ForecastFile, ForecastView as View } from '@octo/application'
import {
  FORECAST_KINDS,
  FORECAST_MONTH,
  type ForecastKind,
  type ForecastProject,
  type ForecastSettings,
  NO_FORECAST_PROJECT,
  type Project,
} from '@octo/domain'
import { useEffect, useState } from 'react'
import type { ErrorCode, OctoApi } from '../shared/api.ts'
import { Failure } from './Failure.tsx'
import { FieldProblems, NotSaved } from './FieldProblems.tsx'
import { FORECAST_FORM_ID, ForecastMonth } from './ForecastMonth.tsx'
import { ForecastRates } from './ForecastRates.tsx'
import { amountField, amountOf, amountText } from './forecast-text.ts'
import { MonthField } from './MonthField.tsx'
import { messages } from './messages.ts'
import { PathField } from './PathField.tsx'
import { Resizable } from './Resizable.tsx'
import { useSavedNote } from './SavedNote.tsx'
import { Waiting } from './Spinner.tsx'
import type { Section } from './sections.ts'

type ForecastApi = Pick<
  OctoApi,
  | 'forecastSettings'
  | 'saveForecastSettings'
  | 'forecastCandidates'
  | 'forecastView'
  | 'compileForecast'
  | 'readForecastOrders'
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
  const [showSettings, setShowSettings] = useState(false)

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
    await loadView(month)
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
      <div className="page-wait">
        <Waiting>{text.loading}</Waiting>
      </div>
    )
  }

  return (
    <div className="dashboard">
      {error && <Failure code={error} onOpen={onOpenSection} />}
      {savedNote.note}
      <div className="command-row">
        <MonthField
          label={text.month}
          value={month}
          onChange={(value) => {
            setMonth(value)
            void loadView(value)
          }}
        />
        <span className="command-row-gap" />
        <button
          type="button"
          className="quiet"
          aria-expanded={showSettings}
          onClick={() => setShowSettings(!showSettings)}
        >
          {text.settings}
        </button>
        {view && view.forecast.rows.length > 0 && settings.modelPath !== '' && (
          <button type="button" disabled={compiling} onClick={() => void compile()}>
            {text.compile}
          </button>
        )}
        {view && view.forecast.rows.length > 0 && (
          <button type="submit" form={FORECAST_FORM_ID} className="primary">
            {text.saveInputs}
          </button>
        )}
      </div>
      {showSettings && (
        <section className="dashboard-settings" aria-label={text.settings}>
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
          <ForecastRates
            settings={settings}
            codes={view?.forecast.rows.map((row) => row.code) ?? []}
            onSave={save}
          />
        </section>
      )}
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
    </div>
  )
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
  const [problems, setProblems] = useState<{ projects: string[] } | null>(null)
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
  function submit() {
    const found = {
      projects: codes.flatMap((code) => {
        const { ordered, feeMonths, startMonth } = projectOf(code)
        return amountField(ordered).wrong || !isMonths(feeMonths) || !isStartMonth(startMonth)
          ? [text.wrong.project(code)]
          : []
      }),
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
          <Resizable name={text.projects} className="table-wide">
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
                        placeholder={text.startMonthFormat}
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
          </Resizable>
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
      <div className="actions">
        <button type="submit">{text.save}</button>
        {problems && <NotSaved text={messages.notSaved} />}
      </div>
    </form>
  )
}
