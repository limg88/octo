import { useId } from 'react'

/** What a column holds: it decides the field the PM types in. */
export type RowsColumn<Key extends string> = {
  key: Key
  label: string
  kind?: 'text' | 'amount' | 'date' | 'select'
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
}

const REMOVE_WIDTH = '30px'

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
}: Props<Key>) {
  const id = useId()
  const set = (index: number, key: Key, value: string) =>
    onChange(rows.map((row, at) => (at === index ? { ...row, [key]: value } : row)))
  const template = [...columns.map((column) => column.width ?? '1fr'), REMOVE_WIDTH].join(' ')

  return (
    // biome-ignore lint/a11y/useSemanticElements: a group of fields laid out in rows, not a table of data.
    <div className="rows-field" role="group" aria-label={label}>
      <div className="rows" style={{ gridTemplateColumns: template }}>
        {columns.map((column) => (
          <span key={column.key} className="rows-head">
            {column.label}
          </span>
        ))}
        <span />
        {rows.map((row, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: a row is its place in the list.
          <div key={index} className="rows-row">
            {columns.map((column) => {
              const name = cellLabel(column.key, index + 1)
              const common = {
                'aria-label': name,
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
              onClick={() =>
                onChange(
                  orOneRow(
                    rows.filter((_row, at) => at !== index),
                    columns,
                  ),
                )
              }
            >
              ×
            </button>
          </div>
        ))}
      </div>
      {columns.map(
        (column) =>
          column.suggestions?.length && (
            <datalist key={column.key} id={`${id}-${column.key}`}>
              {column.suggestions.map((suggestion) => (
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
