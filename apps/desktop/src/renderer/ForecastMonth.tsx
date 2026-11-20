import type { ForecastView as View } from '@octo/application'
import {
  type ForecastGap,
  type ForecastRow,
  type ForecastRowInputs,
  type ForecastSettings,
  NO_ROW_INPUTS,
} from '@octo/domain'
import { useEffect, useId, useState } from 'react'
import { type DataColumn, DataTable } from './DataTable.tsx'
import { FieldProblems, NotSaved } from './FieldProblems.tsx'
import { amountField, amountOf, amountText } from './forecast-text.ts'
import { messages } from './messages.ts'
import { blankRow, orOneRow, type Row, type RowsColumn, RowsField } from './RowsField.tsx'
import type { Section } from './sections.ts'
import { monthText } from './today-text.ts'
import { useSelection } from './use-selection.ts'

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

/** What makes the revenue, the costs or the margin of a row lower or higher than the true ones. */
const INCOMPLETE_KINDS: ReadonlySet<ForecastGap['kind']> = new Set([
  'no_cost',
  'no_rate',
  'no_external_rate',
  'no_ordered',
  'no_budget_costs',
  'no_fee_months',
  'unread_months',
])

type ExternalKey = 'name' | 'hours'
const EXTERNAL_COLUMNS: RowsColumn<ExternalKey>[] = [
  { key: 'name', label: text.columns.name },
  { key: 'hours', label: text.columns.hours, kind: 'amount', width: '140px' },
]

/** The form of the month: the command that saves it stands with the commands of the page. */
export const FORECAST_FORM_ID = 'forecast-month'
/**
 * Each column as wide as its heading on one line: the room the note left goes to them, and a
 * page narrower than their sum scrolls the table sideways.
 */
const CODE_WIDTH = '260px'
const ORDERED_WIDTH = '104px'
const FIGURE_WIDTH = { internal: '104px', external: '104px', revenue: '92px', margin: '118px' }
const QUANTITY_WIDTH = '116px'

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
  const ownTitleId = useId()
  const saved = settings.months[month]
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [problems, setProblems] = useState<Record<string, Problems>>({})
  /** The code whose data of the month are in view under its row; before a choice, the first. */
  const [chosen, setChosen] = useState<string | null>(null)
  const selected = useSelection(
    rows.map((row) => row.code),
    chosen,
  )
  /** The code whose less used data are open too. */
  const [open, setOpen] = useState<string | null>(null)
  /** Shows a code with its less used data: where a missing datum is put right. */
  const openCode = (code: string) => {
    setChosen(code)
    setOpen(code)
  }
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

  /** Saves the month as typed; `changed` holds what was just decided and is not in the state yet. */
  function save(changed: Record<string, Draft> = {}) {
    const typed = (code: string): Draft => changed[code] ?? draftFor(code)
    const found = Object.fromEntries(rows.map((row) => [row.code, problemsOf(typed(row.code))]))
    setProblems(found)
    // A figure that is not understood is told: saved as empty, it would change the forecast.
    const firstWrong = rows.find((row) => {
      const of = found[row.code]
      return of !== undefined && of.externals.length + of.amounts.length > 0
    })
    if (firstWrong) return openCode(firstWrong.code)
    void onSaveMonth(Object.fromEntries(rows.map((row) => [row.code, inputsOf(typed(row.code))])))
  }

  const amountInput = (row: ForecastRow, name: AmountField, label: string) => (
    <label className="field">
      {label}
      <input
        type="text"
        inputMode="decimal"
        className="amount"
        aria-label={text.forCode(label, row.code)}
        value={draftFor(row.code)[name]}
        onChange={(event) => change(row.code, { [name]: event.target.value })}
      />
      <FieldProblems
        lines={problems[row.code]?.amounts.includes(name) ? [messages.amountWrong] : []}
      />
    </label>
  )
  /** A figure nothing tells is said to be missing: never a dash to be guessed. */
  const missing = <span className="pill pill-warning">{text.missing}</span>
  const figure = <Value extends number | null>(
    key: string,
    label: string,
    width: string,
    of: (row: ForecastRow) => Value,
    show: (value: Value) => string,
  ): DataColumn<ForecastRow> => ({
    key,
    label,
    kind: 'number',
    width,
    cell: (row) => (of(row) === null ? missing : show(of(row))),
    sort: (row) => of(row),
  })
  // A column of dashes says nothing: days and progress are there when a code of the month has them.
  const showDays = rows.some((row) => !row.values.quantityIsShare)
  const showProgress = rows.some((row) => row.values.quantityIsShare)
  const daysColumn: DataColumn<ForecastRow> = {
    key: 'days',
    label: text.columnDays,
    kind: 'number',
    width: QUANTITY_WIDTH,
    cell: ({ values }) => (values.quantityIsShare ? text.none : text.days(values.quantity)),
    sort: (row) => (row.values.quantityIsShare ? null : row.values.quantity),
  }
  const progressColumn: DataColumn<ForecastRow> = {
    key: 'progress',
    label: text.columnProgress,
    kind: 'number',
    width: QUANTITY_WIDTH,
    cell: ({ values }) => (values.quantityIsShare ? text.share(values.quantity) : text.none),
    sort: (row) => (row.values.quantityIsShare ? row.values.quantity : null),
  }
  const columns: DataColumn<ForecastRow>[] = [
    {
      key: 'code',
      label: text.columnProject,
      width: CODE_WIDTH,
      cell: (row) => (
        <>
          <button
            type="button"
            className="quiet cell-button project-name"
            aria-pressed={selected === row.code}
            title={text.projectName(row.description, row.code, text.kinds[row.revenueKind])}
            onClick={() => setChosen(row.code)}
          >
            {text.project(row.description, row.code)}
          </button>
          {incomplete.has(row.code) && (
            <span className="pill pill-late" title={text.incompleteHint}>
              {text.incomplete}
            </span>
          )}
        </>
      ),
      sort: (row) => text.project(row.description, row.code),
      text: (row) => `${row.code} ${row.description}`,
    },
    {
      key: 'ordered',
      label: text.columnOrdered,
      kind: 'number',
      width: ORDERED_WIDTH,
      cell: (row) => (row.ordered === null ? missing : text.money(row.ordered)),
      sort: (row) => row.ordered,
    },
    figure(
      'internal',
      text.columnInternal,
      FIGURE_WIDTH.internal,
      (row) => row.values.internalCosts,
      text.money,
    ),
    figure(
      'external',
      text.columnExternal,
      FIGURE_WIDTH.external,
      (row) => row.values.externalCosts,
      text.money,
    ),
    figure(
      'revenue',
      text.columnRevenue,
      FIGURE_WIDTH.revenue,
      (row) => row.values.revenue,
      text.money,
    ),
    // Days sold and progress of a fixed price are two things: a column each, never one for both.
    ...(showDays ? [daysColumn] : []),
    ...(showProgress ? [progressColumn] : []),
    figure(
      'marginMonth',
      text.columnMarginMonth,
      FIGURE_WIDTH.margin,
      (row) => row.values.marginMonth,
      text.share,
    ),
    figure(
      'marginEnd',
      text.columnMarginEnd,
      FIGURE_WIDTH.margin,
      (row) => row.values.marginEnd,
      text.share,
    ),
  ]

  // A row whose figures miss something says so itself: the list of what is missing is below.
  const incomplete = new Set(
    view.forecast.gaps.filter((gap) => INCOMPLETE_KINDS.has(gap.kind)).map((gap) => gap.code),
  )
  const sum = (of: (row: ForecastRow) => number): number =>
    rows.reduce((total, row) => total + of(row), 0)
  const revenue = sum((row) => row.values.revenue)
  const costs = sum((row) => row.values.internalCosts + row.values.externalCosts)
  const totals = {
    ordered: rows.some((row) => row.ordered !== null) ? sum((row) => row.ordered ?? 0) : null,
    internal: sum((row) => row.values.internalCosts),
    external: sum((row) => row.values.externalCosts),
    revenue,
    days: sum((row) => (row.values.quantityIsShare ? 0 : row.values.quantity)),
    margin: revenue === 0 ? null : (revenue - costs) / revenue,
  }

  const gaps = (
    <Gaps
      view={view}
      settings={settings}
      onSaveSettings={onSaveSettings}
      onOpenCode={openCode}
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
        id={FORECAST_FORM_ID}
        aria-label={text.monthData}
        className="forecast-month"
        onSubmit={(event) => {
          event.preventDefault()
          save()
        }}
      >
        <div className="panel">
          <div className="panel-head panel-head-slim">
            <span className="eyebrow">{text.groupComputed}</span>
          </div>
          <div className="table-wide">
            <DataTable
              label={text.monthData}
              columns={columns}
              rows={rows}
              rowKey={(row) => row.code}
              rowClassName={(row) => (row.code === selected ? 'row-selected' : undefined)}
              footer={
                rows.length > 1 ? (
                  <tr>
                    <th scope="row">{text.totalRow}</th>
                    <td className="number">
                      {totals.ordered === null ? text.none : text.money(totals.ordered)}
                    </td>
                    <td className="number">{text.money(totals.internal)}</td>
                    <td className="number">{text.money(totals.external)}</td>
                    <td className="number">{text.money(totals.revenue)}</td>
                    {showDays && (
                      <td className="number">
                        {totals.days === 0 ? text.none : text.days(totals.days)}
                      </td>
                    )}
                    {showProgress && <td />}
                    <td className="number">{text.share(totals.margin)}</td>
                    <td />
                  </tr>
                ) : undefined
              }
              detail={(row) =>
                row.code === selected ? (
                  <section className="own-data" aria-labelledby={`${ownTitleId}-${row.code}`}>
                    <div className="title-row">
                      <h4 id={`${ownTitleId}-${row.code}`}>
                        {text.ownTitle(text.project(row.description, row.code), monthText(month))}
                      </h4>
                      <button
                        type="button"
                        className="quiet"
                        aria-expanded={open === row.code}
                        aria-label={text.forCode(text.moreData, row.code)}
                        onClick={() => setOpen(open === row.code ? null : row.code)}
                      >
                        {text.moreData}
                      </button>
                    </div>
                    <div className="own-fields">
                      {amountInput(row, 'revenue', text.columnOwnRevenue)}
                      {amountInput(row, 'toInvoice', text.toInvoice)}
                      <label className="field">
                        {text.columnOwnNote}
                        <input
                          type="text"
                          aria-label={text.forCode(text.columnOwnNote, row.code)}
                          value={draftFor(row.code).note}
                          onChange={(event) => change(row.code, { note: event.target.value })}
                        />
                      </label>
                    </div>
                    <p className="hint">{text.inputsHint}</p>
                    {open === row.code && (
                      <>
                        {row.note !== '' && (
                          <p className="hint row-note">
                            {text.howComputed} {row.note}
                          </p>
                        )}
                        <CodeDetails
                          code={row.code}
                          wholeFirst={row.revenueKind === 'fixed_price'}
                          draft={draftFor(row.code)}
                          problems={problems[row.code]}
                          externalNames={settings.externals
                            .filter((external) => external.code === row.code)
                            .map((external) => external.name)}
                          onChange={(part) => change(row.code, part)}
                        />
                      </>
                    )}
                  </section>
                ) : null
              }
            />
          </div>
        </div>
        {wrong && <NotSaved text={messages.notSaved} />}
      </form>
      {gaps}
    </>
  )
}

/** What is typed less often for a code: the hours of the externals and the costs of the whole. */
function CodeDetails({
  code,
  wholeFirst,
  draft,
  problems,
  externalNames,
  onChange,
}: {
  code: string
  /**
   * A fixed price is told by the costs of the whole project: they come before the externals,
   * which are what is typed first for a code sold by the day.
   */
  wholeFirst: boolean
  draft: Draft
  problems: Problems | undefined
  /** The externals declared for this code: proposed while typing. */
  externalNames: string[]
  onChange: (part: Partial<Draft>) => void
}) {
  const hintId = useId()
  const amount = (name: AmountField, label: string, hint: string) => (
    <>
      <label className="code-figure">
        {label}
        <input
          type="text"
          inputMode="decimal"
          className="amount"
          aria-describedby={`${hintId}-${name}`}
          value={draft[name]}
          onChange={(event) => onChange({ [name]: event.target.value })}
        />
      </label>
      <p id={`${hintId}-${name}`} className="hint code-hint">
        {hint}
      </p>
      <FieldProblems lines={problems?.amounts.includes(name) ? [messages.amountWrong] : []} />
    </>
  )
  const externals = (
    <>
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
    </>
  )
  const whole = (
    <>
      {amount('budgetCosts', text.budgetCosts, text.budgetCostsHint)}
      {amount('totalCosts', text.totalCosts, text.totalCostsHint)}
      <label className="check code-tick">
        <input
          type="checkbox"
          checked={draft.totalCostsBeforeMonth}
          onChange={(event) => onChange({ totalCostsBeforeMonth: event.target.checked })}
        />
        {text.totalCostsBeforeMonth}
      </label>
    </>
  )
  return (
    // biome-ignore lint/a11y/useSemanticElements: the fields of one code, grouped under its row.
    <div className="settings-form code-details" role="group" aria-label={text.inputsTitle(code)}>
      {wholeFirst ? whole : externals}
      {wholeFirst ? externals : whole}
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
    case 'no_budget_costs':
      return text.gap.no_budget_costs(gap.code)
    case 'no_fee_months':
      return text.gap.no_fee_months(gap.code)
    case 'unread_months':
      return text.gap.unread_months(gap.code, gap.months.join(', '))
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
  const { gaps, notApprovedHours, otherCodes, unreadMonths, orphanCodes } = view.forecast
  // The rates a new code can take from the one before, code by code: one press for all of them.
  const proposals = new Map<string, Array<{ person: string; code: string; ratePerDay: number }>>()
  for (const gap of gaps) {
    if (gap.kind !== 'no_rate' || gap.proposed === null) continue
    const from = gap.proposed.code
    proposals.set(`${gap.code} ${from}`, [
      ...(proposals.get(`${gap.code} ${from}`) ?? []),
      { person: gap.person, code: gap.code, ratePerDay: gap.proposed.ratePerDay },
    ])
  }
  const notes = [
    ...(orphanCodes.length > 0 ? [text.orphanCodes(orphanCodes.join(', '))] : []),
    ...(unreadMonths.length > 0 ? [text.unreadMonths(unreadMonths.join(', '))] : []),
    ...(notApprovedHours > 0 ? [text.notApproved(text.hours(notApprovedHours))] : []),
    ...(otherCodes.length > 0 ? [text.otherCodes(otherCodes.join(', '))] : []),
  ]
  return (
    <section className="gaps-part" aria-label={text.gapsTitle}>
      <div className="gaps-title">
        <h3>{text.gapsTitle}</h3>
        {gaps.length + notes.length > 0 && <span className="hint">{text.gapsIntro}</span>}
      </div>
      {gaps.length + notes.length === 0 ? (
        <p className="badge badge-ok">{text.noGaps}</p>
      ) : (
        <>
          {proposals.size > 0 && (
            <div className="actions">
              {[...proposals.entries()].map(([key, rates]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() =>
                    void onSaveSettings({ ...settings, rates: [...settings.rates, ...rates] })
                  }
                >
                  {text.copyRates(rates.length, key.split(' ')[1] ?? '', key.split(' ')[0] ?? '')}
                </button>
              ))}
              <span className="hint">{text.copyRatesHint}</span>
            </div>
          )}
          <ol className="entries gaps" aria-label={text.gapsTitle}>
            {gaps.map((gap) => (
              <li key={gapText(gap)} className="list-row">
                <span className="pill pill-warning">{text.missing}</span>
                <span className="gap-text">{gapText(gap)}</span>
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
              <li key={note} className="list-row">
                <span className="gap-text">{note}</span>
              </li>
            ))}
          </ol>
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
  if (gap.kind === 'no_ordered' || gap.kind === 'no_fee_months') return null
  if (gap.kind === 'unread_months') {
    return onOpenSection ? (
      <button type="button" className="quiet" onClick={() => onOpenSection('hours')}>
        {messages.openSection(messages.hoursTab)}
      </button>
    ) : null
  }
  if (gap.kind === 'no_total_costs' || gap.kind === 'no_budget_costs') {
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
  const proposed = gap.kind === 'no_rate' ? gap.proposed : null
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
      {proposed && (
        <button
          type="button"
          className="quiet"
          aria-label={`${text.proposedRate(text.money(proposed.ratePerDay), proposed.code)}: ${who}`}
          onClick={() =>
            void onSaveSettings({
              ...settings,
              rates: [...settings.rates, { person, code, ratePerDay: proposed.ratePerDay }],
            })
          }
        >
          {text.proposedRate(text.money(proposed.ratePerDay), proposed.code)}
        </button>
      )}
      {refused && (
        <span className="field-problems" role="alert">
          {messages.amountWrong}
        </span>
      )}
    </span>
  )
}
