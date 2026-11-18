import type { ForecastSettings } from '@octo/domain'
import { useEffect, useState } from 'react'
import { FieldProblems } from './FieldProblems.tsx'
import { amountOf, amountText } from './forecast-text.ts'
import { messages } from './messages.ts'
import { blankRow, orOneRow, type Row, type RowsColumn, RowsField } from './RowsField.tsx'

const text = messages.forecast
const TABLES = ['rates', 'externals', 'hourlyCosts'] as const
type Table = (typeof TABLES)[number]
type Rows = Record<Table, Row<string>[]>

const filled = (...values: Array<string | undefined>): boolean =>
  values.every((value) => (value ?? '').trim() !== '')
const isAmount = (typed: string | undefined): boolean => amountOf(typed ?? '') !== null
const word = (typed: string | undefined): string => (typed ?? '').trim()
const amount = (typed: string | undefined): number => amountOf(typed ?? '') ?? 0

/** What each table asks, and when a row of it says what it must. */
const SHAPES: Record<
  Table,
  { columns: RowsColumn<string>[]; right: (row: Row<string>) => boolean }
> = {
  rates: {
    columns: [
      { key: 'person', label: text.columns.person },
      { key: 'code', label: text.columns.codeOrAll, width: '200px' },
      { key: 'rate', label: text.columns.rate, kind: 'amount', width: '150px' },
    ],
    right: (row) => filled(row.person) && isAmount(row.rate),
  },
  externals: {
    columns: [
      { key: 'name', label: text.columns.name },
      { key: 'code', label: text.columns.code, width: '160px' },
      { key: 'cost', label: text.columns.cost, kind: 'amount', width: '140px' },
      { key: 'rate', label: text.columns.rate, kind: 'amount', width: '140px' },
    ],
    right: (row) => filled(row.name, row.code) && isAmount(row.cost) && isAmount(row.rate),
  },
  hourlyCosts: {
    columns: [
      { key: 'person', label: text.columns.person },
      { key: 'hourly', label: text.columnHourlyCost, kind: 'amount', width: '160px' },
    ],
    right: (row) => filled(row.person) && amount(row.hourly) > 0,
  },
}

const typed = (settings: ForecastSettings): Rows => ({
  rates: settings.rates.map((rate) => ({
    person: rate.person,
    code: rate.code ?? '',
    rate: amountText(rate.ratePerDay),
  })),
  externals: settings.externals.map((external) => ({
    name: external.name,
    code: external.code,
    cost: amountText(external.costPerDay),
    rate: amountText(external.ratePerDay),
  })),
  hourlyCosts: settings.hourlyCosts.map((entry) => ({
    person: entry.person,
    hourly: amountText(entry.costPerHour),
  })),
})

type Props = {
  settings: ForecastSettings
  /** The project codes of the project: proposed where a code is typed. */
  codes: readonly string[]
  onSave: (settings: ForecastSettings) => Promise<void>
}

/**
 * What a day of each person is sold for, and what who has no timesheet costs: the only figures
 * of the forecast the company's system does not tell. Written once, kept out of what Claude reads.
 */
export function ForecastRates({ settings, codes, onSave }: Props) {
  const [rows, setRows] = useState<Rows>(() => typed(settings))
  const [problems, setProblems] = useState<string[]>([])
  useEffect(() => setRows(typed(settings)), [settings])

  function save() {
    const kept = Object.fromEntries(
      TABLES.map((table) => [table, rows[table].filter((row) => !blankRow(row))]),
    ) as Rows
    const found = TABLES.flatMap((table) =>
      kept[table].flatMap((row, index) =>
        SHAPES[table].right(row) ? [] : [text.wrong[table](index + 1)],
      ),
    )
    setProblems(found)
    if (found.length > 0) return
    void onSave({
      ...settings,
      rates: kept.rates.map((row) => ({
        person: word(row.person),
        code: word(row.code) === '' ? null : word(row.code).toUpperCase(),
        ratePerDay: amount(row.rate),
      })),
      externals: kept.externals.map((row) => ({
        name: word(row.name),
        code: word(row.code).toUpperCase(),
        costPerDay: amount(row.cost),
        ratePerDay: amount(row.rate),
      })),
      hourlyCosts: kept.hourlyCosts.map((row) => ({
        person: word(row.person),
        costPerHour: amount(row.hourly),
      })),
    })
  }

  return (
    <details className="advanced">
      <summary>{text.ratesTitle}</summary>
      <div className="fold-fields">
        {TABLES.map((table) => {
          const columns = SHAPES[table].columns.map((column) =>
            column.key === 'code' ? { ...column, suggestions: codes } : column,
          )
          return (
            <section key={table} aria-label={text.tables[table].title}>
              <h4>{text.tables[table].title}</h4>
              <p className="hint">{text.tables[table].hint}</p>
              <RowsField
                label={text.tables[table].title}
                columns={columns}
                rows={orOneRow(rows[table], columns)}
                onChange={(next) => setRows((current) => ({ ...current, [table]: next }))}
                addLabel={text.tables[table].add}
                cellLabel={(column, row) =>
                  text.cell(columns.find((entry) => entry.key === column)?.label ?? column, row)
                }
                removeLabel={text.removeRow}
              />
            </section>
          )
        })}
        <FieldProblems lines={problems} />
        <div className="actions">
          <button type="button" onClick={save}>
            {text.saveRates}
          </button>
        </div>
      </div>
    </details>
  )
}
