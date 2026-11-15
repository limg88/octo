import type { ForecastView as View } from '@octo/application'
import {
  type ForecastGap,
  type ForecastRow,
  type ForecastRowInputs,
  type ForecastSettings,
  NO_ROW_INPUTS,
} from '@octo/domain'
import { Fragment, useEffect, useState } from 'react'
import { FieldProblems, NotSaved } from './FieldProblems.tsx'
import { amountField, amountOf, amountText } from './forecast-text.ts'
import { messages } from './messages.ts'
import { blankRow, orOneRow, type Row, type RowsColumn, RowsField } from './RowsField.tsx'
import type { Section } from './sections.ts'

const text = messages.forecast

type Props = {
  view: View
  settings: ForecastSettings
  month: string
  /** Saves what the PM added for every code of the month, in one go. */
  onSaveMonth: (inputs: Record<string, ForecastRowInputs>) => Promise<void>
  /** Saves a rate or an external typed beside the datum that was missing. */
  onSaveSettings: (settings: ForecastSettings) => Promise<void>
  onOpenSection?: ((section: Section) => void) | undefined
}

type ExternalKey = 'name' | 'hours'
const EXTERNAL_COLUMNS: RowsColumn<ExternalKey>[] = [
  { key: 'name', label: text.columns.name },
  { key: 'hours', label: text.columns.hours, kind: 'amount', width: '140px' },
]

/** The columns of the table of the month, for what spans the whole row. */
const COLUMNS = 9

const AMOUNT_FIELDS = ['toInvoice', 'revenue', 'budgetCosts', 'totalCosts'] as const
type AmountField = (typeof AMOUNT_FIELDS)[number]

/** What is typed for one code of the month, as text. */
type Draft = Record<AmountField, string> & {
  externals: Row<ExternalKey>[]
  totalCostsBeforeMonth: boolean
  note: string
}
type Problems = { externals: string[]; amounts: AmountField[] }

const draftOf = (inputs: ForecastRowInputs): Draft => ({
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

function problemsOf(draft: Draft): Problems {
  return {
    externals: draft.externals.flatMap((row, index) =>
      blankRow(row) || (row.name.trim() !== '' && amountOf(row.hours) !== null)
        ? []
        : [text.wrong.hours(index + 1)],
    ),
    amounts: AMOUNT_FIELDS.filter((name) => amountField(draft[name]).wrong),
  }
}

const inputsOf = (draft: Draft): ForecastRowInputs => ({
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

/**
 * The month of the forecast, one row per project code: what is computed is read, what the PM
 * adds is typed in the same row, and everything is saved together. Under it, what is missing,
 * each with what puts it right.
 */
export function ForecastMonth({
  view,
  settings,
  month,
  onSaveMonth,
  onSaveSettings,
  onOpenSection,
}: Props) {
  const { rows } = view.forecast
  const saved = settings.months[month]
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [problems, setProblems] = useState<Record<string, Problems>>({})
  /** The code whose less used data are open under its row. */
  const [open, setOpen] = useState<string | null>(null)
  // What is typed follows what is saved: another month, or a save, starts from there.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the codes of the model change only with the view of the month.
  useEffect(() => {
    setDrafts(
      Object.fromEntries(
        rows.map((row) => [row.code, draftOf(saved?.[row.code] ?? NO_ROW_INPUTS)]),
      ),
    )
    setProblems({})
  }, [saved, month, view])

  const draftFor = (code: string): Draft => drafts[code] ?? draftOf(NO_ROW_INPUTS)
  const change = (code: string, part: Partial<Draft>) =>
    setDrafts((current) => ({ ...current, [code]: { ...draftFor(code), ...part } }))
  const wrong = Object.values(problems).some(
    (found) => found.externals.length + found.amounts.length > 0,
  )

  function save() {
    const found = Object.fromEntries(rows.map((row) => [row.code, problemsOf(draftFor(row.code))]))
    setProblems(found)
    // A figure that is not understood is told: saved as empty, it would change the forecast.
    const firstWrong = rows.find((row) => {
      const of = found[row.code]
      return of !== undefined && of.externals.length + of.amounts.length > 0
    })
    if (firstWrong) return setOpen(firstWrong.code)
    void onSaveMonth(
      Object.fromEntries(rows.map((row) => [row.code, inputsOf(draftFor(row.code))])),
    )
  }

  const gaps = (
    <Gaps
      view={view}
      settings={settings}
      onSaveSettings={onSaveSettings}
      onOpenCode={setOpen}
      onOpenSection={onOpenSection}
    />
  )
  if (rows.length === 0) {
    return (
      <>
        <p className="hint">{text.noRows}</p>
        {gaps}
      </>
    )
  }
  return (
    <>
      <form
        aria-label={text.monthData}
        className="forecast-month"
        onSubmit={(event) => {
          event.preventDefault()
          save()
        }}
      >
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
            {rows.map((row) => (
              <Fragment key={row.code}>
                <CodeRow
                  row={row}
                  draft={draftFor(row.code)}
                  problems={problems[row.code]}
                  open={open === row.code}
                  onChange={(part) => change(row.code, part)}
                  onToggle={() => setOpen(open === row.code ? null : row.code)}
                />
                {open === row.code && (
                  <tr className="row-details">
                    <td colSpan={COLUMNS}>
                      <CodeDetails
                        code={row.code}
                        draft={draftFor(row.code)}
                        problems={problems[row.code]}
                        externalNames={settings.externals
                          .filter((external) => external.code === row.code)
                          .map((external) => external.name)}
                        onChange={(part) => change(row.code, part)}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
        <div className="actions">
          <button type="submit" className="quiet-submit">
            {text.saveInputs}
          </button>
          {wrong && <NotSaved text={messages.notSaved} />}
        </div>
      </form>
      {gaps}
    </>
  )
}

/** One code: what is computed, and in the same row what the PM decides for the month. */
function CodeRow({
  row,
  draft,
  problems,
  open,
  onChange,
  onToggle,
}: {
  row: ForecastRow
  draft: Draft
  problems: Problems | undefined
  open: boolean
  onChange: (part: Partial<Draft>) => void
  onToggle: () => void
}) {
  const { code, description, values, note } = row
  const amountCell = (name: AmountField, label: string, placeholder = '') => (
    <>
      <input
        type="text"
        inputMode="decimal"
        className="amount"
        aria-label={text.forCode(label, code)}
        placeholder={placeholder}
        value={draft[name]}
        onChange={(event) => onChange({ [name]: event.target.value })}
      />
      <FieldProblems lines={problems?.amounts.includes(name) ? [messages.amountWrong] : []} />
    </>
  )
  return (
    <tr>
      <td title={description}>
        {code}
        <button
          type="button"
          className="quiet"
          aria-expanded={open}
          aria-label={text.forCode(text.moreData, code)}
          onClick={onToggle}
        >
          {text.moreData}
        </button>
      </td>
      <td className="number">{text.money(values.internalCosts)}</td>
      <td className="number">{text.money(values.externalCosts)}</td>
      <td className="number">
        {text.money(values.revenue)}
        {amountCell('revenue', text.revenue, text.revenueComputed)}
      </td>
      <td className="number">
        {values.quantityIsShare
          ? text.share(values.quantity)
          : text.daysWithUnit(text.days(values.quantity))}
      </td>
      <td className="number">{text.share(values.marginMonth)}</td>
      <td className="number">{text.share(values.marginEnd)}</td>
      <td className="number">{amountCell('toInvoice', text.toInvoice)}</td>
      <td>
        <span className="cell-text">{note}</span>
        <input
          type="text"
          aria-label={text.forCode(text.note, code)}
          placeholder={text.note}
          value={draft.note}
          onChange={(event) => onChange({ note: event.target.value })}
        />
      </td>
    </tr>
  )
}

/** What is typed less often for a code: the hours of the externals and the costs of the whole. */
function CodeDetails({
  code,
  draft,
  problems,
  externalNames,
  onChange,
}: {
  code: string
  draft: Draft
  problems: Problems | undefined
  /** The externals declared for this code: proposed while typing. */
  externalNames: string[]
  onChange: (part: Partial<Draft>) => void
}) {
  const amount = (name: AmountField, label: string) => (
    <>
      <label>
        {label}
        <input
          type="text"
          inputMode="decimal"
          className="amount"
          value={draft[name]}
          onChange={(event) => onChange({ [name]: event.target.value })}
        />
      </label>
      <FieldProblems lines={problems?.amounts.includes(name) ? [messages.amountWrong] : []} />
    </>
  )
  return (
    // biome-ignore lint/a11y/useSemanticElements: the fields of one code, grouped under its row.
    <div className="settings-form" role="group" aria-label={text.inputsTitle(code)}>
      <h4>{text.externals}</h4>
      <RowsField
        label={text.externals}
        columns={EXTERNAL_COLUMNS.map((column) =>
          column.key === 'name' ? { ...column, suggestions: externalNames } : column,
        )}
        rows={draft.externals}
        onChange={(externals) => onChange({ externals })}
        addLabel={text.add.external}
        cellLabel={(column, row) => text.cell(text.columns[column], row)}
        removeLabel={text.removeRow}
      />
      <FieldProblems lines={problems?.externals ?? []} />
      {amount('budgetCosts', text.budgetCosts)}
      {amount('totalCosts', text.totalCosts)}
      <label className="check">
        <input
          type="checkbox"
          checked={draft.totalCostsBeforeMonth}
          onChange={(event) => onChange({ totalCostsBeforeMonth: event.target.checked })}
        />
        {text.totalCostsBeforeMonth}
      </label>
    </div>
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

/** What is missing, each with what puts it right beside it. Nothing is ever estimated. */
function Gaps({
  view,
  settings,
  onSaveSettings,
  onOpenCode,
  onOpenSection,
}: {
  view: View
  settings: ForecastSettings
  onSaveSettings: (settings: ForecastSettings) => Promise<void>
  onOpenCode: (code: string) => void
  onOpenSection?: ((section: Section) => void) | undefined
}) {
  const { gaps, notApprovedHours, otherCodes } = view.forecast
  const notes = [
    ...(notApprovedHours > 0 ? [text.notApproved(text.hours(notApprovedHours))] : []),
    ...(otherCodes.length > 0 ? [text.otherCodes(otherCodes.join(', '))] : []),
  ]
  return (
    <section aria-label={text.gapsTitle}>
      <h3>{text.gapsTitle}</h3>
      {gaps.length + notes.length === 0 ? (
        <p className="badge badge-ok">{text.noGaps}</p>
      ) : (
        <>
          <p className="hint">{text.gapsIntro}</p>
          <ul className="missing gaps">
            {gaps.map((gap) => (
              <li key={gapText(gap)}>
                {gapText(gap)}
                <Remedy
                  gap={gap}
                  settings={settings}
                  onSaveSettings={onSaveSettings}
                  onOpenCode={onOpenCode}
                  onOpenSection={onOpenSection}
                />
              </li>
            ))}
            {notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </>
      )}
    </section>
  )
}

/** What puts a missing datum right, where it is said to be missing. */
function Remedy({
  gap,
  settings,
  onSaveSettings,
  onOpenCode,
  onOpenSection,
}: {
  gap: ForecastGap
  settings: ForecastSettings
  onSaveSettings: (settings: ForecastSettings) => Promise<void>
  onOpenCode: (code: string) => void
  onOpenSection?: ((section: Section) => void) | undefined
}) {
  const [rate, setRate] = useState('')
  const [cost, setCost] = useState('')
  const [refused, setRefused] = useState(false)
  if (gap.kind === 'no_ordered') return null
  if (gap.kind === 'no_total_costs') {
    return (
      <button type="button" className="quiet" onClick={() => onOpenCode(gap.code)}>
        {text.remedy.openCode(gap.code)}
      </button>
    )
  }
  if (gap.kind === 'no_cost') {
    return onOpenSection ? (
      <button type="button" className="quiet" onClick={() => onOpenSection('hours')}>
        {messages.openSection(messages.hoursTab)}
      </button>
    ) : null
  }
  const external = gap.kind === 'no_external_rate'
  const { person, code } = gap
  const who = text.remedy.of(person, code)

  function save() {
    const ratePerDay = amountOf(rate)
    const costPerDay = amountOf(cost)
    if (ratePerDay === null || (external && costPerDay === null)) return setRefused(true)
    setRefused(false)
    void onSaveSettings(
      external
        ? {
            ...settings,
            externals: [
              ...settings.externals,
              { name: person, code, costPerDay: costPerDay ?? 0, ratePerDay },
            ],
          }
        : {
            ...settings,
            rates: [...settings.rates, { person, code: null, ratePerDay }],
          },
    )
  }

  return (
    <span className="remedy">
      {external && (
        <input
          type="text"
          inputMode="decimal"
          className="amount"
          aria-label={`${text.columns.cost}, ${who}`}
          placeholder={text.columns.cost}
          value={cost}
          onChange={(event) => setCost(event.target.value)}
        />
      )}
      <input
        type="text"
        inputMode="decimal"
        className="amount"
        aria-label={`${text.columns.rate}, ${who}`}
        placeholder={text.columns.rate}
        value={rate}
        onChange={(event) => setRate(event.target.value)}
      />
      <button type="button" aria-label={`${text.remedy.save}: ${who}`} onClick={save}>
        {text.remedy.save}
      </button>
      {refused && (
        <span className="field-problems" role="alert">
          {messages.amountWrong}
        </span>
      )}
    </span>
  )
}
