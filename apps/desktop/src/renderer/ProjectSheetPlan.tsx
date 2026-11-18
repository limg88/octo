import {
  type Lifetime,
  PLAN_GROUPS,
  type PlanGroup,
  type PlanLine,
  type PlanMoney,
  type PlanView,
  planMargin,
  type SheetPlan,
} from '@octo/domain'
import { Fragment, useState } from 'react'
import { Dialog } from './Dialog.tsx'
import { amountField, amountText, shortMonthText } from './forecast-text.ts'
import { dateText, messages } from './messages.ts'
import { monthText } from './today-text.ts'

type Props = {
  /** The budget as it was planned, or the months as they are and as they are planned now. */
  mode: 'budget' | 'months'
  /** The project code as last read: its plan against what happened. */
  sheet: Lifetime
  /** The plan as the PM is typing it: kept by the page, so a change of tab loses nothing. */
  draft: SheetPlan
  /** True when the draft differs from what is saved. */
  dirty: boolean
  /** A change of the draft, told as what it does to the plan as it is when it applies. */
  onChange: (update: (plan: SheetPlan) => SheetPlan) => void
  onSave: () => void
  onPropose: () => void
  onConfirm: () => void
}

const text = messages.sheet.plan
const { money, share, hours } = messages.forecast
const BLANK = ''
const MONTHS_IN_YEAR = 12
const YEAR_LENGTH = 4
const PERCENT = 100
/** Columns before the months: the line, what a unit costs, what it is sold for. */
const LEAD_COLUMNS = 3

/** A month as the heading of its column: its name alone, the year is the one chosen above. */
const MONTH_NAME = new Intl.DateTimeFormat('it-IT', { month: 'short', timeZone: 'UTC' })
const monthLabel = (month: string): string => MONTH_NAME.format(new Date(`${month}-01T00:00:00Z`))

const monthsOf = (year: string): string[] =>
  Array.from(
    { length: MONTHS_IN_YEAR },
    (_, index) => `${year}-${String(index + 1).padStart(2, '0')}`,
  )

/** The month after a month `YYYY-MM`. */
function monthAfter(month: string): string {
  const [year, at] = month.split('-').map(Number) as [number, number]
  return new Date(Date.UTC(year, at, 1)).toISOString().slice(0, 7)
}

/** The years the grid can show: those the plan touches, the one that runs and the one after. */
function yearsOf(view: PlanView | null, draft: SheetPlan, through: string): string[] {
  const touched = [
    through,
    monthAfter(through),
    ...(view?.months ?? []),
    ...draft.lines.flatMap((line) => [...Object.keys(line.budget), ...Object.keys(line.forecast)]),
  ].map((month) => Number(month.slice(0, YEAR_LENGTH)))
  const [first, last] = [Math.min(...touched), Math.max(...touched) + 1]
  return Array.from({ length: last - first + 1 }, (_, index) => String(first + index))
}

type CellProps = {
  label: string
  value: number | null
  /** What the field shows when empty: the value that stands while nothing is typed. */
  placeholder?: string | undefined
  onCommit: (value: number | null) => void
  onWrong: (wrong: boolean) => void
}

/** A number typed in a cell of the grid: kept as typed, told to the page once it is a number. */
function NumberCell({ label, value, placeholder, onCommit, onWrong }: CellProps) {
  const [typed, setTyped] = useState(amountText(value))
  const [wrong, setWrong] = useState(false)
  return (
    <input
      className="amount"
      inputMode="decimal"
      aria-label={label}
      aria-invalid={wrong || undefined}
      placeholder={placeholder}
      value={typed}
      onChange={(event) => {
        const read = amountField(event.target.value)
        setTyped(event.target.value)
        setWrong(read.wrong)
        onWrong(read.wrong)
        if (!read.wrong) onCommit(read.value)
      }}
    />
  )
}

const withMonth = (
  quantities: Record<string, number>,
  month: string,
  value: number | null,
): Record<string, number> => {
  const { [month]: _gone, ...rest } = quantities
  return value === null ? rest : { ...rest, [month]: value }
}

const NEW_LINE: Omit<PlanLine, 'group' | 'name'> = {
  unitCost: null,
  unitPrice: null,
  budget: {},
  forecast: {},
  declared: {},
}

/** A line of the grid: the line itself, its place among those of the plan, whether it is of it. */
type GridRow = { line: PlanLine; index: number; unplanned: boolean }

/**
 * The plan of a project code as a grid of lines and months: the budget to write, or the months
 * as they went and as they are planned now. One year at a time; only the table scrolls.
 */
export function ProjectSheetPlan({
  mode,
  sheet,
  draft,
  dirty,
  onChange,
  onSave,
  onPropose,
  onConfirm,
}: Props) {
  const view = sheet.plan
  // The month that runs is not a fact yet: without a view the one before it is the last.
  const through = view?.through ?? sheet.through
  const [year, setYear] = useState(through.slice(0, YEAR_LENGTH))
  const [wrongCells, setWrongCells] = useState<ReadonlySet<string>>(new Set())
  const [reopening, setReopening] = useState(false)
  const months = monthsOf(year)
  const budgeting = mode === 'budget'

  const markWrong = (cell: string, wrong: boolean) =>
    setWrongCells((known) => {
      const next = new Set(known)
      if (wrong) next.add(cell)
      else next.delete(cell)
      return next
    })
  const changeLine = (index: number, more: (line: PlanLine) => Partial<PlanLine>) =>
    onChange((plan) => ({
      ...plan,
      lines: plan.lines.map((line, at) => (at === index ? { ...line, ...more(line) } : line)),
    }))

  if (!budgeting && draft.lines.length === 0 && (view?.lines.length ?? 0) === 0) {
    return <p className="hint">{text.emptyMonths}</p>
  }

  const viewLines = view?.lines ?? []
  /** The lines shown: those typed, and in the months those of who has hours and no line. */
  const typedRows: GridRow[] = draft.lines.map((line, index) => ({ line, index, unplanned: false }))
  const rows: GridRow[] = budgeting
    ? typedRows
    : [
        ...typedRows,
        ...viewLines
          .filter((line) => line.unplanned)
          .map((line, at) => ({
            line: { ...NEW_LINE, group: line.group, name: line.name, unitCost: line.unitCost },
            index: draft.lines.length + at,
            unplanned: true,
          })),
      ]
  const unplanned = viewLines.filter((line) => line.unplanned).map((line) => line.name)

  function monthCell(row: GridRow, month: string) {
    const { line, index } = row
    const saved = viewLines[index]
    if (budgeting) {
      return (
        <NumberCell
          label={text.cellOf(line.name, shortMonthText(month))}
          value={line.budget[month] ?? null}
          onCommit={(value) =>
            changeLine(index, (kept) => ({ budget: withMonth(kept.budget, month, value) }))
          }
          onWrong={(wrong) => markWrong(`${index} ${month}`, wrong)}
        />
      )
    }
    // A month that is a fact, for who has timesheets: what they say, never typed.
    const fact = line.group === 'internal' && month <= through
    if (fact || row.unplanned) {
      const quantity = saved?.current[month]
      return quantity === undefined ? BLANK : hours(quantity)
    }
    const planned = line.budget[month]
    return (
      <NumberCell
        label={text.cellOf(line.name, shortMonthText(month))}
        value={line.forecast[month] ?? null}
        placeholder={planned === undefined ? undefined : amountText(planned)}
        onCommit={(value) =>
          changeLine(index, (kept) => ({ forecast: withMonth(kept.forecast, month, value) }))
        }
        onWrong={(wrong) => markWrong(`${index} ${month}`, wrong)}
      />
    )
  }

  const lineTotal = (row: GridRow): string => {
    const quantities = budgeting ? row.line.budget : (viewLines[row.index]?.current ?? {})
    const total = Object.values(quantities).reduce((sum, quantity) => sum + quantity, 0)
    return total === 0 ? BLANK : hours(total)
  }

  /** A row of totals: a figure for each month of the year, and the one of the whole plan. */
  const totalRow = (label: string, of: (month: string) => string, whole: string, key = label) => (
    <tr key={key}>
      <th scope="row" colSpan={LEAD_COLUMNS}>
        {label}
      </th>
      {months.map((month) => (
        <td key={month} className="number">
          {of(month)}
        </td>
      ))}
      <td className="number">{whole}</td>
    </tr>
  )
  const band = (title: string) => (
    <tr key={`band ${title}`} className="plan-band">
      <th scope="rowgroup" colSpan={LEAD_COLUMNS + MONTHS_IN_YEAR + 1}>
        {title}
      </th>
    </tr>
  )
  const moneyRows = (
    title: string,
    monthly: Record<string, PlanMoney>,
    whole: PlanMoney,
    withMargin: boolean,
  ) => [
    band(title),
    totalRow(
      text.totals.revenue,
      (month) => (monthly[month] ? money(monthly[month].revenue) : BLANK),
      money(whole.revenue),
      `${title} revenue`,
    ),
    totalRow(
      text.totals.costs,
      (month) => (monthly[month] ? money(monthly[month].costs) : BLANK),
      money(whole.costs),
      `${title} costs`,
    ),
    ...(withMargin
      ? [
          totalRow(
            text.totals.margin,
            (month) => (monthly[month] ? share(planMargin(monthly[month])) : BLANK),
            share(planMargin(whole)),
            `${title} margin`,
          ),
        ]
      : []),
  ]

  function totals(saved: PlanView) {
    if (budgeting) return moneyRows(text.totals.budget, saved.budget, saved.totals.budget, true)
    const ledger = sheet.economics?.ledgerMonths
    const difference = (of: (money: PlanMoney) => number) => (month: string) =>
      saved.current[month] === undefined && saved.budget[month] === undefined
        ? BLANK
        : money(
            (saved.current[month] ? of(saved.current[month]) : 0) -
              (saved.budget[month] ? of(saved.budget[month]) : 0),
          )
    return [
      ...moneyRows(text.totals.computed, saved.current, saved.totals.atEnd, true),
      ...(ledger
        ? [
            band(text.totals.netsuite),
            totalRow(
              text.totals.revenue,
              (month) => (ledger[month] ? money(ledger[month].revenue) : BLANK),
              money(sheet.economics?.ledger.revenue ?? 0),
              'netsuite revenue',
            ),
            totalRow(
              text.totals.costs,
              (month) => (ledger[month] ? money(ledger[month].costs) : BLANK),
              money(sheet.economics?.ledger.costs ?? 0),
              'netsuite costs',
            ),
          ]
        : []),
      band(text.totals.variance),
      totalRow(
        text.totals.revenue,
        difference((entry) => entry.revenue),
        money(saved.totals.atEnd.revenue - saved.totals.budget.revenue),
        'variance revenue',
      ),
      totalRow(
        text.totals.costs,
        difference((entry) => entry.costs),
        money(saved.totals.atEnd.costs - saved.totals.budget.costs),
        'variance costs',
      ),
      band(text.totals.progress),
      totalRow(
        text.totals.progress,
        (month) => (saved.progress[month] === undefined ? BLANK : share(saved.progress[month])),
        BLANK,
      ),
      <tr key="declared progress">
        <th scope="row" colSpan={LEAD_COLUMNS}>
          {text.totals.declaredProgress}
        </th>
        {months.map((month) => {
          const declared = draft.declaredProgress[month]
          return (
            <td key={month} className="number">
              <NumberCell
                label={text.totals.declaredOf(shortMonthText(month))}
                value={declared === undefined ? null : declared * PERCENT}
                onCommit={(value) =>
                  onChange((plan) => ({
                    ...plan,
                    declaredProgress: withMonth(
                      plan.declaredProgress,
                      month,
                      value === null ? null : value / PERCENT,
                    ),
                  }))
                }
                onWrong={(wrong) => markWrong(`progress ${month}`, wrong)}
              />
            </td>
          )
        })}
        <td />
      </tr>,
    ]
  }

  const groupRows = (group: PlanGroup) => rows.filter((row) => row.line.group === group)
  const shownGroups = PLAN_GROUPS.filter((group) => budgeting || groupRows(group).length > 0)
  const figures: Array<[string, PlanMoney]> = view
    ? [
        [text.figures.actual, view.totals.actual],
        [text.figures.forecast, view.totals.forecast],
        [text.figures.atEnd, view.totals.atEnd],
      ]
    : []

  return (
    <section aria-label={budgeting ? text.budgetTitle : text.monthsTitle}>
      <p className="hint">
        {budgeting
          ? text.budgetIntro
          : text.monthsIntro(monthText(through), monthText(monthAfter(through)))}
      </p>
      {budgeting && draft.confirmedOn !== null && (
        <p className="badge badge-ok">
          {text.confirmed(dateText(draft.confirmedOn))}{' '}
          <button type="button" className="quiet" onClick={() => setReopening(true)}>
            {text.reopen}
          </button>
        </p>
      )}
      {budgeting && draft.lines.length === 0 && (
        <div className="notice">
          <p>{text.empty}</p>
          <p className="hint">{text.proposeHint}</p>
          <div className="actions">
            <button type="button" className="primary" onClick={onPropose}>
              {text.propose}
            </button>
          </div>
        </div>
      )}
      {!budgeting && view && (
        <dl className="figures">
          {figures.map(([label, total]) => (
            <div key={label} className="figure">
              <dt>{label}</dt>
              <dd>
                {share(planMargin(total))}
                <span className="figure-note">
                  {text.figures.revenueCosts(money(total.revenue), money(total.costs))}
                </span>
              </dd>
            </div>
          ))}
        </dl>
      )}
      {unplanned.length > 0 && (
        <p className="warning">
          {text.unplannedWarning(unplanned.join(', '))}{' '}
          {budgeting && (
            <button type="button" onClick={onPropose}>
              {text.proposeMore}
            </button>
          )}
        </p>
      )}
      {(view?.withoutCost.length ?? 0) > 0 && (
        <p className="warning">{text.withoutCost((view?.withoutCost ?? []).join(', '))}</p>
      )}
      <div className="range-fields">
        <label>
          {text.year}{' '}
          <select value={year} onChange={(event) => setYear(event.target.value)}>
            {yearsOf(view, draft, through).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className={dirty ? 'primary' : undefined}
          disabled={!dirty || wrongCells.size > 0}
          onClick={onSave}
        >
          {text.save}
        </button>
        {budgeting && draft.lines.length > 0 && draft.confirmedOn === null && (
          <button type="button" disabled={dirty} title={text.confirmHint} onClick={onConfirm}>
            {text.confirm}
          </button>
        )}
      </div>
      {wrongCells.size > 0 && (
        <p className="warning" role="alert">
          {text.wrong}
        </p>
      )}
      {dirty && wrongCells.size === 0 && (
        <p className="hint" role="status">
          {text.unsaved}
        </p>
      )}
      <div className="table-wide plan-grid">
        {/* A new year, a line more or less: a new grid, each cell showing its own month. */}
        <table
          key={`${year} ${draft.lines.length}`}
          className="data"
          aria-label={budgeting ? text.budgetTitle : text.monthsTitle}
        >
          <thead>
            <tr>
              <th scope="col">{text.line}</th>
              <th scope="col" className="number">
                {text.unitCost}
              </th>
              <th scope="col" className="number">
                {text.unitPrice}
              </th>
              {months.map((month) => (
                <th
                  key={month}
                  scope="col"
                  aria-label={shortMonthText(month)}
                  className={month === through ? 'number plan-through' : 'number'}
                  title={month === through ? text.figures.actual : undefined}
                >
                  {monthLabel(month)}
                </th>
              ))}
              <th scope="col" className="number">
                {text.total}
              </th>
            </tr>
          </thead>
          <tbody>
            {shownGroups.map((group) => (
              <Fragment key={group}>
                <tr className="plan-band">
                  <th scope="rowgroup" colSpan={LEAD_COLUMNS + MONTHS_IN_YEAR + 1}>
                    {text.groups[group]}{' '}
                    {budgeting && (
                      <button
                        type="button"
                        className="quiet"
                        onClick={() =>
                          onChange((plan) => ({
                            ...plan,
                            lines: [...plan.lines, { ...NEW_LINE, group, name: text.newLine }],
                          }))
                        }
                      >
                        {text.addLine(text.groups[group])}
                      </button>
                    )}
                  </th>
                </tr>
                {groupRows(group).map((row, at) => {
                  const { line, index } = row
                  const today = viewLines[index]?.unitCost ?? null
                  const priceInUse = viewLines[index]?.unitPrice ?? null
                  return (
                    <tr key={`${group} ${index}`}>
                      <th scope="row">
                        {budgeting ? (
                          <span className="plan-name">
                            <input
                              aria-label={text.nameOf(text.groups[group], at + 1)}
                              value={line.name}
                              onChange={(event) =>
                                changeLine(index, () => ({ name: event.target.value }))
                              }
                            />
                            <button
                              type="button"
                              className="quiet icon-button"
                              aria-label={text.removeLine(line.name)}
                              onClick={() =>
                                onChange((plan) => ({
                                  ...plan,
                                  lines: plan.lines.filter((_line, other) => other !== index),
                                }))
                              }
                            >
                              ×
                            </button>
                          </span>
                        ) : (
                          <>
                            {line.name}
                            {row.unplanned && (
                              <>
                                {' '}
                                <span className="status status-neutral">{text.unplanned}</span>
                              </>
                            )}
                          </>
                        )}
                      </th>
                      <td className="number">
                        {budgeting ? (
                          <NumberCell
                            label={text.costOf(line.name)}
                            value={line.unitCost}
                            placeholder={
                              line.unitCost !== null || today === null
                                ? undefined
                                : group === 'internal'
                                  ? text.followsToday(money(today))
                                  : text.inUse(money(today))
                            }
                            onCommit={(value) => changeLine(index, () => ({ unitCost: value }))}
                            onWrong={(wrong) => markWrong(`${index} cost`, wrong)}
                          />
                        ) : today === null ? (
                          BLANK
                        ) : (
                          money(today)
                        )}
                      </td>
                      <td className="number">
                        {budgeting ? (
                          <NumberCell
                            label={text.priceOf(line.name)}
                            value={line.unitPrice}
                            placeholder={
                              line.unitPrice === null && priceInUse !== null
                                ? text.inUse(money(priceInUse))
                                : undefined
                            }
                            onCommit={(value) => changeLine(index, () => ({ unitPrice: value }))}
                            onWrong={(wrong) => markWrong(`${index} price`, wrong)}
                          />
                        ) : priceInUse === null ? (
                          BLANK
                        ) : (
                          money(priceInUse)
                        )}
                      </td>
                      {months.map((month) => (
                        <td key={month} className="number">
                          {monthCell(row, month)}
                        </td>
                      ))}
                      <td className="number">{lineTotal(row)}</td>
                    </tr>
                  )
                })}
              </Fragment>
            ))}
          </tbody>
          {view && (budgeting ? Object.keys(view.budget).length : view.months.length) > 0 && (
            <tfoot>{totals(view)}</tfoot>
          )}
        </table>
      </div>
      {reopening && (
        <Dialog title={text.reopenTitle} onClose={() => setReopening(false)}>
          <p>{text.reopenBody}</p>
          <footer className="dialog-footer">
            <button type="button" onClick={() => setReopening(false)}>
              {text.cancel}
            </button>
            <button
              type="button"
              className="primary"
              onClick={() => {
                setReopening(false)
                onChange((plan) => ({ ...plan, confirmedOn: null }))
              }}
            >
              {text.reopen}
            </button>
          </footer>
        </Dialog>
      )}
    </section>
  )
}
