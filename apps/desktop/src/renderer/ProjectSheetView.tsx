import {
  type Lifetime,
  NO_ROW_INPUTS,
  NO_SHEET_PLAN,
  type Project,
  REGISTRY_FIELDS,
  type SheetPlan,
  type SheetPlans,
} from '@octo/domain'
import { useEffect, useState } from 'react'
import type { ErrorCode, OctoApi, Result } from '../shared/api.ts'
import { Failure } from './Failure.tsx'
import { messages } from './messages.ts'
import { ProjectSheetBilling } from './ProjectSheetBilling.tsx'
import { ProjectSheetPlan } from './ProjectSheetPlan.tsx'
import { ProjectSheetSummary } from './ProjectSheetSummary.tsx'
import { useSavedNote } from './SavedNote.tsx'
import { Waiting } from './Spinner.tsx'
import type { Section } from './sections.ts'

type SheetApi = Pick<
  OctoApi,
  | 'projectSheets'
  | 'forecastSettings'
  | 'saveForecastSettings'
  | 'sheetPlans'
  | 'saveSheetPlans'
  | 'proposeSheetPlan'
  | 'confirmSheetBudget'
  | 'exportSheetData'
  | 'openEvidence'
>

type Props = {
  api: SheetApi
  project: Project
  /** Takes the PM to the section where an error is put right. */
  onOpenSection?: ((section: Section) => void) | undefined
}

const text = messages.sheet.summary

/** The ways of reading a project code: its figures, its budget, its months, its invoices. */
const SHEET_PARTS = ['summary', 'budget', 'months', 'billing'] as const
type SheetPart = (typeof SHEET_PARTS)[number]

/**
 * The project code each project was last read by: going to another section and back shows the
 * same one. Kept while the app is open, never written.
 */
const lastCode = new Map<string, string>()

/** A fixed price is what the sheet is kept by hand for: it is shown first when there is one. */
function firstCode(sheets: readonly Lifetime[], wanted: string | undefined): string {
  if (wanted !== undefined && sheets.some((sheet) => sheet.code === wanted)) return wanted
  return (sheets.find((sheet) => sheet.kind === 'fixed_price') ?? sheets[0])?.code ?? ''
}

const same = (a: SheetPlan, b: SheetPlan): boolean => JSON.stringify(a) === JSON.stringify(b)

/**
 * The sheet of a project code over its whole life: what was ordered and invoiced, what it cost
 * and by whom, the margins, its budget and its months. One code at a time, chosen at the top
 * when the project has more.
 */
export function ProjectSheetView({ api, project, onOpenSection }: Props) {
  const [sheets, setSheets] = useState<Lifetime[] | null>(null)
  const [plans, setPlans] = useState<SheetPlans>({})
  /** The plan of each code as the PM is typing it: kept across the tabs until it is saved. */
  const [drafts, setDrafts] = useState<SheetPlans>({})
  /** Counts the times the plans were read: a grid shows what was read, then what is typed. */
  const [reads, setReads] = useState(0)
  const [code, setCode] = useState('')
  const [part, setPart] = useState<SheetPart>('summary')
  const [error, setError] = useState<ErrorCode | null>(null)
  const [exported, setExported] = useState<string | null>(null)
  const savedNote = useSavedNote()

  async function load() {
    const [read, kept] = await Promise.all([
      api.projectSheets(project.id),
      api.sheetPlans(project.id),
    ])
    if (!read.ok) return setError(read.code)
    if (!kept.ok) return setError(kept.code)
    setSheets(read.value)
    setPlans(kept.value)
    setReads((count) => count + 1)
    setCode(firstCode(read.value, lastCode.get(project.id)))
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: a new project starts from its own codes.
  useEffect(() => {
    setSheets(null)
    setDrafts({})
    setError(null)
    setExported(null)
    void load()
  }, [api, project.id])

  function choose(next: string) {
    lastCode.set(project.id, next)
    setCode(next)
    setExported(null)
  }

  /** After a change of the plans kept: the draft of the code is done, the sheet is read again. */
  async function kept(result: Result<SheetPlans>, done: string): Promise<void> {
    if (!result.ok) return setError(result.code)
    setDrafts(({ [done]: _saved, ...rest }) => rest)
    savedNote.saved()
    await load()
  }

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
      <div className="page-wait">
        <Waiting>{text.loading}</Waiting>
      </div>
    )
  }

  const sheet = sheets.find((entry) => entry.code === code)
  if (sheet === undefined) {
    return (
      <div className="dashboard">
        {error && <Failure code={error} onOpen={onOpenSection} />}
        <p className="badge badge-warning">{messages.forecast.internal}</p>
        <p className="hint">{messages.forecast.noRows}</p>
      </div>
    )
  }

  const savedPlan = plans[sheet.code] ?? NO_SHEET_PLAN
  const draft = drafts[sheet.code] ?? savedPlan
  const dirty = !same(draft, savedPlan)
  /** A change applies to the draft as it is then: two in a row never undo each other. */
  const change = (update: (plan: SheetPlan) => SheetPlan) =>
    setDrafts((known) => ({ ...known, [sheet.code]: update(known[sheet.code] ?? savedPlan) }))
  const start = () => {
    setError(null)
    savedNote.clear()
  }
  const save = async () => {
    start()
    await kept(await api.saveSheetPlans(project.id, { ...plans, [sheet.code]: draft }), sheet.code)
  }
  const propose = async () => {
    start()
    await kept(await api.proposeSheetPlan(project.id, sheet.code), sheet.code)
  }
  const confirm = async () => {
    start()
    await kept(await api.confirmSheetBudget(project.id, sheet.code), sheet.code)
  }
  const exportData = async () => {
    start()
    setExported(null)
    const result = await api.exportSheetData(project.id, sheet.code)
    if (result.ok) setExported(result.value.path)
    else setError(result.code)
  }

  return (
    <div className="dashboard">
      {error && <Failure code={error} onOpen={onOpenSection} />}
      {savedNote.note}
      <details className="dashboard-settings">
        <summary>{messages.sheet.registry.title}</summary>
        <p className="hint">{messages.sheet.registry.intro}</p>
        <div className="settings-form">
          {REGISTRY_FIELDS.map((field) => (
            <label key={field} className="field">
              {messages.sheet.registry.fields[field]}
              <input
                value={draft.registry[field]}
                onChange={(event) =>
                  change((plan) => ({
                    ...plan,
                    registry: { ...plan.registry, [field]: event.target.value },
                  }))
                }
              />
            </label>
          ))}
          <div className="actions">
            <button type="button" disabled={!dirty} onClick={() => void save()}>
              {messages.sheet.registry.save}
            </button>
          </div>
        </div>
      </details>
      <p className="badge badge-warning">{messages.forecast.internal}</p>
      <header className="sheet-header">
        <h3>
          {sheet.code}
          {sheet.description !== '' && <> · {sheet.description}</>}{' '}
          <span className="hint">({messages.forecast.kinds[sheet.kind]})</span>
        </h3>
        {sheets.length > 1 && (
          <label>
            {text.code}{' '}
            <select value={code} onChange={(event) => choose(event.target.value)}>
              {sheets.map((entry) => (
                <option key={entry.code} value={entry.code}>
                  {entry.description === '' ? entry.code : `${entry.code} · ${entry.description}`}
                </option>
              ))}
            </select>
          </label>
        )}
      </header>
      <div className="dashboard-tabs" role="tablist" aria-label={messages.sheet.partsLabel}>
        {SHEET_PARTS.map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            aria-selected={part === name}
            className={part === name ? 'tab tab-selected' : 'tab'}
            onClick={() => setPart(name)}
          >
            {messages.sheet.parts[name]}
          </button>
        ))}
      </div>
      {part === 'summary' ? (
        <>
          <ProjectSheetSummary sheet={sheet} onUseBudget={keepBudget} />
          {sheet.plan !== null && sheet.plan.months.length > 0 && (
            <div className="actions">
              <button type="button" onClick={() => void exportData()}>
                {messages.sheet.exportData}
              </button>
              {exported !== null && (
                <span className="badge badge-ok" role="status">
                  {messages.sheet.exported(exported)}{' '}
                  <button
                    type="button"
                    className="quiet"
                    onClick={() => void api.openEvidence(project.id, exported)}
                  >
                    {messages.sheet.open}
                  </button>
                </span>
              )}
            </div>
          )}
        </>
      ) : part === 'billing' ? (
        <ProjectSheetBilling
          key={`${sheet.code} ${reads}`}
          sheet={sheet}
          draft={draft}
          dirty={dirty}
          onChange={change}
          onSave={() => void save()}
          onOpenSection={onOpenSection}
        />
      ) : (
        <ProjectSheetPlan
          // Plans read again are a new grid: its cells show what was read, then what is typed.
          key={`${sheet.code} ${part} ${reads}`}
          mode={part}
          sheet={sheet}
          draft={draft}
          dirty={dirty}
          onChange={change}
          onSave={() => void save()}
          onPropose={() => void propose()}
          onConfirm={() => void confirm()}
        />
      )}
    </div>
  )
}
