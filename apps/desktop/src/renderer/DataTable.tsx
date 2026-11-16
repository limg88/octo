import { Fragment, type ReactNode, useId, useMemo, useState } from 'react'
import { messages } from './messages.ts'

/** What a column is put in order by: words, a number, or nothing (always last). */
export type SortValue = string | number | null

export type DataColumn<Row> = {
  key: string
  /** The heading; empty for a column of buttons, which then needs `name`. */
  label: string
  /** What the column is called to who cannot see it, when the heading is empty. */
  name?: string | undefined
  cell: (row: Row) => ReactNode
  /** What the rows are put in order by; without it the column cannot be sorted. */
  sort?: (row: Row) => SortValue
  /** What the filter reads of the cell; without it the column is not searched. */
  text?: (row: Row) => string
  /** Numbers are set against the right edge, and the buttons of a row stay on one line. */
  kind?: 'text' | 'number' | 'actions'
  /** A CSS width; a column without one shares the room left. */
  width?: string | undefined
}

type Direction = 'ascending' | 'descending'
type Order = { key: string; direction: Direction } | null

type Props<Row> = {
  /** What the table holds, read by who cannot see it and named in its filter. */
  label: string
  columns: ReadonlyArray<DataColumn<Row>>
  rows: readonly Row[]
  rowKey: (row: Row) => string
  rowClassName?: (row: Row) => string | undefined
  /** Rows below the others that are never sorted or filtered: totals. */
  footer?: ReactNode
  /** A heading row above the columns, for the columns that go together. */
  groups?: ReadonlyArray<{ label: string; span: number }>
  /** What opens under a row across the whole table; null: nothing under that row. */
  detail?: (row: Row) => ReactNode
  /** The order the table opens in; none: the order of the rows as given. */
  initialOrder?: { key: string; direction: Direction }
}

const text = messages.table
/** With fewer rows than this everything is in sight: a filter would only take room. */
const FILTER_FROM_ROWS = 6
const COLLATOR = new Intl.Collator('it', { numeric: true, sensitivity: 'base' })
const MARK: Record<Direction, string> = { ascending: '▲', descending: '▼' }

/** Nothing sorts after everything, in both directions: an empty cell is never the first row. */
function compare(a: SortValue, b: SortValue, direction: Direction): number {
  if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1
  const order =
    typeof a === 'number' && typeof b === 'number' ? a - b : COLLATOR.compare(String(a), String(b))
  return direction === 'ascending' ? order : -order
}

function nextOrder(current: Order, key: string): Order {
  if (current?.key !== key) return { key, direction: 'ascending' }
  return current.direction === 'ascending' ? { key, direction: 'descending' } : null
}

/**
 * A table of the project's data: every column stays in its place whatever its cells hold, a
 * click on a heading puts the rows in order, and a field above finds the rows that hold a word.
 */
export function DataTable<Row>({
  label,
  columns,
  rows,
  rowKey,
  rowClassName,
  footer,
  groups,
  detail,
  initialOrder,
}: Props<Row>) {
  const filterId = useId()
  const [typed, setTyped] = useState('')
  const [order, setOrder] = useState<Order>(initialOrder ?? null)
  const searched = columns.some((column) => column.text)
  const filterable = searched && rows.length >= FILTER_FROM_ROWS

  const shown = useMemo(() => {
    const words = typed.trim().toLocaleLowerCase('it').split(/\s+/).filter(Boolean)
    const kept =
      !filterable || words.length === 0
        ? [...rows]
        : rows.filter((row) => {
            const line = columns
              .map((column) => column.text?.(row) ?? '')
              .join(' ')
              .toLocaleLowerCase('it')
            return words.every((word) => line.includes(word))
          })
    const sortOf = order && columns.find((column) => column.key === order.key)?.sort
    if (!order || !sortOf) return kept
    return kept.sort((a, b) => compare(sortOf(a), sortOf(b), order.direction))
  }, [rows, columns, typed, order, filterable])

  const classOf = (column: DataColumn<Row>): string | undefined =>
    column.kind === 'number' ? 'number' : column.kind === 'actions' ? 'row-actions' : undefined

  return (
    <div className="data-table">
      {filterable && (
        <div className="table-filter">
          <input
            id={filterId}
            type="search"
            aria-label={text.filterOf(label)}
            placeholder={text.filter}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
          />
          {typed.trim() !== '' && (
            <span className="hint" role="status">
              {text.shown(shown.length, rows.length)}
            </span>
          )}
        </div>
      )}
      <table className="data data-fixed" aria-label={label}>
        <colgroup>
          {columns.map((column) => (
            <col key={column.key} style={column.width ? { width: column.width } : undefined} />
          ))}
        </colgroup>
        <thead>
          {groups && (
            <tr className="column-groups">
              {groups.map((group, at) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: a group is its place among the columns.
                <th key={at} colSpan={group.span} scope="colgroup">
                  {group.label}
                </th>
              ))}
            </tr>
          )}
          <tr>
            {columns.map((column) => {
              const direction = order?.key === column.key ? order.direction : undefined
              return (
                <th
                  key={column.key}
                  scope="col"
                  className={classOf(column)}
                  aria-sort={column.sort ? (direction ?? 'none') : undefined}
                  aria-label={column.label === '' ? column.name : undefined}
                >
                  {column.sort ? (
                    <button
                      type="button"
                      className="sort"
                      title={text.sortBy(column.label)}
                      onClick={() => setOrder(nextOrder(order, column.key))}
                    >
                      {column.label}
                      <span aria-hidden="true" className="sort-mark">
                        {direction ? MARK[direction] : ''}
                      </span>
                    </button>
                  ) : (
                    column.label
                  )}
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {shown.map((row) => {
            const under = detail?.(row)
            return (
              <Fragment key={rowKey(row)}>
                <tr className={rowClassName?.(row)}>
                  {columns.map((column) => (
                    <td key={column.key} className={classOf(column)}>
                      {column.cell(row)}
                    </td>
                  ))}
                </tr>
                {under && (
                  <tr className="row-details">
                    <td colSpan={columns.length}>{under}</td>
                  </tr>
                )}
              </Fragment>
            )
          })}
          {shown.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="hint">
                {text.none}
              </td>
            </tr>
          )}
        </tbody>
        {footer && <tfoot>{footer}</tfoot>}
      </table>
    </div>
  )
}
