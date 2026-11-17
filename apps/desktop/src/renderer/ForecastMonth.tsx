import type { ForecastView as View } from '@octo/application'
import {
  type ForecastGap,
  type ForecastRow,
  type ForecastRowInputs,
  type ForecastSettings,
  NO_ROW_INPUTS,
} from '@octo/domain'
import { useEffect, useState } from 'react'
import { type DataColumn, DataTable } from './DataTable.tsx'
import { Dialog } from './Dialog.tsx'
import { FieldProblems, NotSaved } from './FieldProblems.tsx'
import { amountField, amountOf, amountText } from './forecast-text.ts'
import { messages } from './messages.ts'
import { blankRow, orOneRow, type Row, type RowsColumn, RowsField } from './RowsField.tsx'
import type { Section } from './sections.ts'

const text = messages.forecast

/** The signs of the two things done to a note; the button says its name to who does not see them. */
const PENCIL = (
  <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4" />
  </svg>
)
const BIN = (
  <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
    <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />
  </svg>
)

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

/** How many columns Octo fills and how many the PM does: the two groups of the heading. */
const COMPUTED_COLUMNS = 9
const OWN_COLUMNS = 3
/**
 * Each column as wide as its heading on one line: the room the note left goes to them, and a
 * page narrower than their sum scrolls the table sideways.
 */
const CODE_WIDTH = '190px'
const ORDERED_WIDTH = '104px'
const FIGURE_WIDTH = { internal: '104px', external: '104px', revenue: '92px', margin: '118px' }
const QUANTITY_WIDTH = '100px'
const INPUT_WIDTH = '116px'
const NOTE_WIDTH = '140px'

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
  /** The note being written in its window, with the code it is of. */
  const [noting, setNoting] = useState<{ code: string; typed: string } | null>(null)
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
    if (firstWrong) return setOpen(firstWrong.code)
    void onSaveMonth(Object.fromEntries(rows.map((row) => [row.code, inputsOf(typed(row.code))])))
  }

  /** A note written or taken off in its window is kept at once, with the rest of the month. */
  function saveNote(code: string, note: string) {
    const next = { ...draftFor(code), note: note.trim() }
    change(code, next)
    setNoting(null)
    save({ [code]: next })
  }

  const amountCell = (row: ForecastRow, name: AmountField, label: string) => (
    <>
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
    </>
  )
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
    cell: (row) => show(of(row)),
    sort: (row) => of(row),
  })
  const columns: DataColumn<ForecastRow>[] = [
    {
      key: 'code',
      label: text.columnCode,
      width: CODE_WIDTH,
      cell: (row) => (
        <>
          {/* biome-ignore lint/a11y/noNoninteractiveTabindex: the name of the project is read with the keyboard too. */}
          <span className="tip" tabIndex={0} aria-describedby={`forecast-name-${row.code}`}>
            {row.code}
            <span role="tooltip" id={`forecast-name-${row.code}`}>
              {text.projectName(row.description, text.kinds[row.revenueKind])}
            </span>
          </span>
          {row.description !== '' && <span className="hint code-name">{row.description}</span>}
          {incomplete.has(row.code) && (
            <span className="pill pill-late" title={text.incompleteHint}>
              {text.incomplete}
            </span>
          )}
          <button
            type="button"
            className="quiet cell-button"
            aria-expanded={open === row.code}
            aria-label={text.forCode(text.moreData, row.code)}
            onClick={() => setOpen(open === row.code ? null : row.code)}
          >
            {text.moreData}
          </button>
        </>
      ),
      sort: (row) => row.code,
      text: (row) => `${row.code} ${row.description}`,
    },
    {
      key: 'ordered',
      label: text.columnOrdered,
      kind: 'number',
      width: ORDERED_WIDTH,
      cell: (row) => (row.ordered === null ? text.none : text.money(row.ordered)),
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
    {
      key: 'days',
      label: text.columnDays,
      kind: 'number',
      width: QUANTITY_WIDTH,
      cell: ({ values }) => (values.quantityIsShare ? text.none : text.days(values.quantity)),
      sort: (row) => (row.values.quantityIsShare ? null : row.values.quantity),
    },
    {
      key: 'progress',
      label: text.columnProgress,
      kind: 'number',
      width: QUANTITY_WIDTH,
      cell: ({ values }) => (values.quantityIsShare ? text.share(values.quantity) : text.none),
      sort: (row) => (row.values.quantityIsShare ? row.values.quantity : null),
    },
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
    {
      key: 'ownRevenue',
      label: text.columnOwnRevenue,
      kind: 'number',
      width: INPUT_WIDTH,
      cell: (row) => amountCell(row, 'revenue', text.revenue),
    },
    {
      key: 'toInvoice',
      label: text.columnToInvoice,
      kind: 'number',
      width: INPUT_WIDTH,
      cell: (row) => amountCell(row, 'toInvoice', text.toInvoice),
    },
    {
      key: 'ownNote',
      label: text.columnOwnNote,
      width: NOTE_WIDTH,
      cell: (row) => {
        const { note } = draftFor(row.code)
        const write = () => setNoting({ code: row.code, typed: note })
        if (note === '') {
          return (
            <button
              type="button"
              className="quiet cell-button"
              aria-label={text.forCode(text.addNote, row.code)}
              onClick={write}
            >
              {text.addNote}
            </button>
          )
        }
        return (
          <>
            <p className="note-text" title={note}>
              {note}
            </p>
            <span className="row-actions">
              <button
                type="button"
                className="quiet icon-button"
                aria-label={text.forCode(text.editNote, row.code)}
                title={text.editNote}
                onClick={write}
              >
                {PENCIL}
              </button>
              <button
                type="button"
                className="quiet icon-button"
                aria-label={text.forCode(text.removeNote, row.code)}
                title={text.removeNote}
                onClick={() => saveNote(row.code, '')}
              >
                {BIN}
              </button>
            </span>
          </>
        )
      },
    },
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
        <p className="hint">{text.inputsHint}</p>
        <div className="table-wide">
          <DataTable
            label={text.monthData}
            groups={[
              { label: text.groupComputed, span: COMPUTED_COLUMNS },
              { label: text.groupOwn, span: OWN_COLUMNS },
            ]}
            columns={columns}
            rows={rows}
            rowKey={(row) => row.code}
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
                  <td className="number">
                    {totals.days === 0 ? text.none : text.days(totals.days)}
                  </td>
                  <td />
                  <td className="number">{text.share(totals.margin)}</td>
                  <td colSpan={OWN_COLUMNS + 1} />
                </tr>
              ) : undefined
            }
            detail={(row) => (
              <>
                {row.note !== '' && (
                  <p className="hint row-note">
                    {text.howComputed} {row.note}
                  </p>
                )}
                {open === row.code && (
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
                )}
              </>
            )}
          />
        </div>
        <div className="actions">
          <button type="submit" className="quiet-submit">
            {text.saveInputs}
          </button>
          {wrong && <NotSaved text={messages.notSaved} />}
        </div>
      </form>
      {noting && (
        <Dialog title={text.noteTitle(noting.code)} onClose={() => setNoting(null)}>
          <form
            className="dialog-form"
            onSubmit={(event) => {
              event.preventDefault()
              saveNote(noting.code, noting.typed)
            }}
          >
            <label className="field">
              {text.note}
              <textarea
                rows={6}
                value={noting.typed}
                onChange={(event) => setNoting({ ...noting, typed: event.target.value })}
              />
            </label>
            <p className="hint">{text.noteHint}</p>
            <footer className="dialog-footer">
              {draftFor(noting.code).note !== '' && (
                <button
                  type="button"
                  className="danger dialog-footer-start"
                  onClick={() => saveNote(noting.code, '')}
                >
                  {text.removeNote}
                </button>
              )}
              <button type="button" onClick={() => setNoting(null)}>
                {messages.cancel}
              </button>
              <button type="submit" className="primary">
                {text.noteSave}
              </button>
            </footer>
          </form>
        </Dialog>
      )}
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
    </>
  )
  return (
    // biome-ignore lint/a11y/useSemanticElements: the fields of one code, grouped under its row.
    <div className="settings-form" role="group" aria-label={text.inputsTitle(code)}>
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
    <section aria-label={text.gapsTitle}>
      <h3>{text.gapsTitle}</h3>
      {gaps.length + notes.length === 0 ? (
        <p className="badge badge-ok">{text.noGaps}</p>
      ) : (
        <>
          <p className="hint">{text.gapsIntro}</p>
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
