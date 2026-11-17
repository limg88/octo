import { useId, useState } from 'react'
import { messages } from './messages.ts'

/** What a column holds: it decides the field the PM types in. */
export type RowsColumn<Key extends string> = {
  key: Key
  label: string
  kind?: 'text' | 'textarea' | 'amount' | 'date' | 'select'
  /** The choices of a `select` column, as value and words. */
  options?: ReadonlyArray<{ value: string; label: string }>
  /** Values the field proposes while typing: what Octo already knows. */
  suggestions?: readonly string[]
  /** A CSS width for the column; without it the column takes the room left. */
  width?: string
}

export type Row<Key extends string> = Record<Key, string>

type Props<Key extends string> = {
  /** What the rows are, read by who cannot see the table. */
  label: string
  columns: ReadonlyArray<RowsColumn<Key>>
  rows: ReadonlyArray<Row<Key>>
  onChange: (rows: Row<Key>[]) => void
  addLabel: string
  /** The name of the field of a column in a row, counted from 1. */
  cellLabel: (column: Key, row: number) => string
  removeLabel: (row: number) => string
  /** The row the PM is typing in, for what is inserted from outside the table. */
  onFocusRow?: (row: number) => void
  /** The row taken off, as it was counted before: who points at a row follows the others. */
  onRemoveRow?: (row: number) => void
}

/** A list typed in a row is read whole: it wraps on this many lines before it scrolls. */
const TEXTAREA_ROWS = 2

const REMOVE_WIDTH = '30px'
/** With fewer rows than this all are in sight: a filter would only take room. */
const FILTER_FROM_ROWS = 8
const text = messages.rows

/** A row with nothing typed in it. */
export const emptyRow = <Key extends string>(columns: ReadonlyArray<RowsColumn<Key>>): Row<Key> =>
  Object.fromEntries(columns.map((column) => [column.key, ''])) as Row<Key>

/** True when nothing is typed in the row: it is not a value, and not a mistake either. */
export const blankRow = (row: Record<string, string>): boolean =>
  Object.values(row).every((value) => value.trim() === '')

/** At least one row to type in, whatever was saved. */
export const orOneRow = <Key extends string>(
  rows: Row<Key>[],
  columns: ReadonlyArray<RowsColumn<Key>>,
): Row<Key>[] => (rows.length === 0 ? [emptyRow(columns)] : rows)

/**
 * Values typed one per row with a field for each: a small table that grows and shrinks. It
 * replaces the lines with separators, where the place of a value had to be remembered.
 */
export function RowsField<Key extends string>({
  label,
  columns,
  rows,
  onChange,
  addLabel,
  cellLabel,
  removeLabel,
  onFocusRow,
  onRemoveRow,
}: Props<Key>) {
  const id = useId()
  const [typed, setTyped] = useState('')
  const filterable = rows.length >= FILTER_FROM_ROWS
  const words = filterable ? typed.trim().toLocaleLowerCase('it') : ''
  /** A row that holds the words typed, or an empty one: what is being added stays in sight. */
  const inSight = (row: Row<Key>): boolean =>
    words === '' ||
    blankRow(row) ||
    Object.values<string>(row).some((value) => value.toLocaleLowerCase('it').includes(words))
  const set = (index: number, key: Key, value: string) =>
    onChange(rows.map((row, at) => (at === index ? { ...row, [key]: value } : row)))
  const template = [...columns.map((column) => column.width ?? '1fr'), REMOVE_WIDTH].join(' ')

  return (
    // biome-ignore lint/a11y/useSemanticElements: a group of fields laid out in rows, not a table of data.
    <div className="rows-field" role="group" aria-label={label}>
      <div className="rows-bar">
        <span className="hint">{text.count(rows.filter((row) => !blankRow(row)).length)}</span>
        {filterable && (
          <input
            type="search"
            aria-label={messages.table.filterOf(label)}
            placeholder={messages.table.filter}
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
          />
        )}
      </div>
      <div className="rows-scroll">
        <div className="rows" style={{ gridTemplateColumns: template }}>
          {columns.map((column) => (
            <span key={column.key} className="rows-head">
              {column.label}
            </span>
          ))}
          <span className="rows-head" />
          {rows.map((row, index) =>
            inSight(row) ? (
              // biome-ignore lint/suspicious/noArrayIndexKey: a row is its place in the list.
              <div key={index} className="rows-row">
                {columns.map((column) => {
                  const name = cellLabel(column.key, index + 1)
                  const common = {
                    'aria-label': name,
                    title: row[column.key],
                    value: row[column.key],
                    onFocus: () => onFocusRow?.(index),
                  }
                  if (column.kind === 'select') {
                    return (
                      <select
                        key={column.key}
                        {...common}
                        onChange={(event) => set(index, column.key, event.target.value)}
                      >
                        {(column.options ?? []).map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    )
                  }
                  if (column.kind === 'textarea') {
                    return (
                      <textarea
                        key={column.key}
                        {...common}
                        rows={TEXTAREA_ROWS}
                        onChange={(event) => set(index, column.key, event.target.value)}
                      />
                    )
                  }
                  const list = column.suggestions?.length ? `${id}-${column.key}` : undefined
                  return (
                    <input
                      key={column.key}
                      {...common}
                      type={column.kind === 'date' ? 'date' : 'text'}
                      inputMode={column.kind === 'amount' ? 'decimal' : undefined}
                      className={column.kind === 'amount' ? 'amount' : undefined}
                      list={list}
                      onChange={(event) => set(index, column.key, event.target.value)}
                    />
                  )
                })}
                <button
                  type="button"
                  className="quiet"
                  aria-label={removeLabel(index + 1)}
                  onClick={() => {
                    onRemoveRow?.(index)
                    onChange(
                      orOneRow(
                        rows.filter((_row, at) => at !== index),
                        columns,
                      ),
                    )
                  }}
                >
                  ×
                </button>
              </div>
            ) : null,
          )}
        </div>
      </div>
      {columns.map(
        (column) =>
          (column.suggestions?.length ?? 0) > 0 && (
            <datalist key={column.key} id={`${id}-${column.key}`}>
              {(column.suggestions ?? []).map((suggestion) => (
                <option key={suggestion} value={suggestion} />
              ))}
            </datalist>
          ),
      )}
      <div className="actions">
        <button type="button" onClick={() => onChange([...rows, emptyRow(columns)])}>
          {addLabel}
        </button>
      </div>
    </div>
  )
}
