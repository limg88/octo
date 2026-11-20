import type { SheetStep } from '@octo/application'
import { type Lifetime, NO_ROW_INPUTS, type Project } from '@octo/domain'
import { useEffect, useState } from 'react'
import type { ErrorCode, OctoApi } from '../shared/api.ts'
import { Failure } from './Failure.tsx'
import { ForecastView } from './ForecastView.tsx'
import { HoursView } from './HoursView.tsx'
import { errorText, messages } from './messages.ts'
import { ProjectSheetBilling } from './ProjectSheetBilling.tsx'
import { ProjectSheetSummary } from './ProjectSheetSummary.tsx'
import { useSavedNote } from './SavedNote.tsx'
import { Waiting } from './Spinner.tsx'
import type { Section } from './sections.ts'
import { monthText } from './today-text.ts'
import { useReentry } from './use-reentry.ts'

type Props = {
  api: OctoApi
  project: Project
  /** Where the PM is: «Ore» and «Previsionale» are parts of this page with a place of their own. */
  place: 'sheet' | 'hours' | 'forecast'
  /** Takes the PM to another part of the page, or to the section where an error is put right. */
  onOpenSection: (section: Section) => void
  /** False while the page stays mounted out of sight: back in sight, it reads again. */
  active?: boolean
}

const text = messages.sheet.summary

/** The ways of reading the money of a project: its figures, its invoices, its hours, its month. */
const SHEET_PARTS = ['summary', 'billing', 'hours', 'forecast'] as const
type SheetPart = (typeof SHEET_PARTS)[number]

/**
 * The project code each project was last read by: going to another section and back shows the
 * same one. Kept while the app is open, never written.
 */
const lastCode = new Map<string, string>()

/** A fixed price is what the summary is read for first: it is shown first when there is one. */
function firstCode(sheets: readonly Lifetime[], wanted: string | undefined): string {
  if (wanted !== undefined && sheets.some((sheet) => sheet.code === wanted)) return wanted
  return (sheets.find((sheet) => sheet.kind === 'fixed_price') ?? sheets[0])?.code ?? ''
}

/** What the reading is doing, in words: the months are many in a project that starts from nothing. */
function stepText(step: SheetStep | 'start' | null): string {
  if (step === null || step === 'start') return text.loading
  if (step.kind === 'orders') return text.readingOrders
  if (step.kind === 'month') {
    return text.readingMonth(monthText(step.month), step.done + 1, step.total)
  }
  return text.loading
}

/** The figures of the project codes over their whole life, one code at a time. */
function CodeSheets({
  api,
  project,
  billing,
  onOpenSection,
  active = true,
}: Omit<Props, 'place'> & { billing: boolean }) {
  const [sheets, setSheets] = useState<Lifetime[] | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState<ErrorCode | null>(null)
  /** What the reading is doing now; null when nothing is being read. */
  const [step, setStep] = useState<SheetStep | 'start' | null>(null)
  /** Why the months that miss were not all read, when the company's system said no. */
  const [missed, setMissed] = useState<ErrorCode | null>(null)
  const savedNote = useSavedNote()

  async function load() {
    setStep('start')
    setMissed(null)
    const read = await api.projectSheets(project.id)
    setStep(null)
    if (!read.ok) return setError(read.code)
    setSheets(read.value)
    setCode((current) => firstCode(read.value, lastCode.get(project.id) ?? current))
  }

  useEffect(
    () =>
      api.onSheetStep((projectId, next) => {
        if (projectId !== project.id) return
        if (next.kind === 'missed') setMissed(next.code)
        else setStep(next)
      }),
    [api, project.id],
  )
  useReentry(active, () => void load())

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new project starts from its own codes.
  useEffect(() => {
    setSheets(null)
    setError(null)
    void load()
  }, [api, project.id])

  /**
   * The costs at budget the caps of the people propose, kept because the PM said so: from the
   * month the code began when none was ever written, so every month since counts on them; else
   * from the month that runs, as a budget seen again.
   */
  async function keepBudget(sheet: Lifetime, costs: number) {
    setError(null)
    savedNote.clear()
    const loaded = await api.forecastSettings(project.id)
    if (!loaded.ok) return setError(loaded.code)
    const settings = loaded.value
    const start = settings.projects[sheet.code]?.startMonth ?? null
    const at = sheet.budgetCosts === null && start !== null ? start : sheet.through
    const rows = settings.months[at] ?? {}
    const saved = await api.saveForecastSettings(project.id, {
      ...settings,
      months: {
        ...settings.months,
        [at]: {
          ...rows,
          [sheet.code]: { ...(rows[sheet.code] ?? NO_ROW_INPUTS), budgetCosts: costs },
        },
      },
    })
    if (!saved.ok) return setError(saved.code)
    savedNote.saved()
    await load()
  }

  if (sheets === null) {
    return error ? (
      <Failure code={error} onOpen={onOpenSection} />
    ) : (
      <Waiting>{stepText(step)}</Waiting>
    )
  }
  const reading = step !== null && <Waiting>{stepText(step)}</Waiting>
  const stopped = missed !== null && step === null && (
    <p className="warning" role="alert">
      {text.missed(errorText(missed))}{' '}
      <button type="button" className="quiet" onClick={() => void load()}>
        {text.resume}
      </button>
    </p>
  )
  const sheet = sheets.find((entry) => entry.code === code)
  if (sheet === undefined) {
    return (
      <>
        {error && <Failure code={error} onOpen={onOpenSection} />}
        {reading}
        {stopped}
        <p className="hint">{messages.forecast.noRows}</p>
      </>
    )
  }
  return (
    <>
      {error && <Failure code={error} onOpen={onOpenSection} />}
      {reading}
      {stopped}
      {savedNote.note}
      <header className="sheet-header">
        <h3>
          {sheet.code}
          {sheet.description !== '' && <> · {sheet.description}</>}{' '}
          <span className="hint">({messages.forecast.kinds[sheet.kind]})</span>
        </h3>
        {sheets.length > 1 && (
          <label>
            {text.code}{' '}
            <select
              value={code}
              onChange={(event) => {
                lastCode.set(project.id, event.target.value)
                setCode(event.target.value)
              }}
            >
              {sheets.map((entry) => (
                <option key={entry.code} value={entry.code}>
                  {entry.description === '' ? entry.code : `${entry.code} · ${entry.description}`}
                </option>
              ))}
            </select>
          </label>
        )}
      </header>
      {billing ? (
        <ProjectSheetBilling sheet={sheet} onOpenSection={onOpenSection} />
      ) : (
        <ProjectSheetSummary
          sheet={sheet}
          onUseBudget={keepBudget}
          onOpenForecast={() => onOpenSection('forecast')}
        />
      )}
    </>
  )
}

/**
 * The money of a project in one place, to keep it in view and to answer about it: the figures
 * of each project code over its whole life, its invoices, the hours of the month against the
 * tracker, the forecast of the month for the administration. Octo shows and exports: budget,
 * months and plans are kept in the sheets of the administration.
 */
export function ProjectSheetView({ api, project, place, onOpenSection, active = true }: Props) {
  const [billing, setBilling] = useState(false)
  /** How many times the page came back in sight: hours and forecast start again each time. */
  const [entries, setEntries] = useState(0)
  useReentry(active, () => setEntries((count) => count + 1))
  const part: SheetPart = place === 'sheet' ? (billing ? 'billing' : 'summary') : place

  function open(next: SheetPart) {
    setBilling(next === 'billing')
    onOpenSection(next === 'hours' || next === 'forecast' ? next : 'sheet')
  }

  return (
    <div className="dashboard">
      <div className="dashboard-tabs" role="tablist" aria-label={messages.sheet.partsLabel}>
        {SHEET_PARTS.map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            aria-selected={part === name}
            className={part === name ? 'tab tab-selected' : 'tab'}
            onClick={() => open(name)}
          >
            {messages.sheet.parts[name]}
          </button>
        ))}
      </div>
      <p className="badge badge-warning">{messages.forecast.internal}</p>
      {part === 'hours' ? (
        <HoursView
          key={entries}
          api={api}
          project={project}
          onOpenSources={() => onOpenSection('sources')}
        />
      ) : part === 'forecast' ? (
        <ForecastView key={entries} api={api} project={project} onOpenSection={onOpenSection} />
      ) : (
        <CodeSheets
          api={api}
          project={project}
          billing={part === 'billing'}
          onOpenSection={onOpenSection}
          active={active}
        />
      )}
    </div>
  )
}
