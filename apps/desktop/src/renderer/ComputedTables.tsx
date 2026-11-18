import { type CheckedTable, tableUnverified } from '@octo/domain'
import type { OpenSource } from './CitationPanel.tsx'
import { messages } from './messages.ts'

type Props = {
  tables: readonly CheckedTable[]
  onOpenSource: OpenSource
}

const text = messages.computed

/**
 * The tables Claude computed inside its fence, each with the files of the project its figures
 * come from. A figure computed is not a quote: what the code can check is that its sources are
 * there and that the file it names was written, and it says when they are not.
 */
export function ComputedTables({ tables, onOpenSource }: Props) {
  return (
    <>
      {tables.map((table) => (
        <section key={`${table.title} ${table.file}`} className="computed" aria-label={table.title}>
          <h3>{table.title}</h3>
          <div className="table-scroll">
            <table className="data" aria-label={table.title}>
              <thead>
                <tr>
                  {table.columns.map((column) => (
                    <th key={column} scope="col">
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row, index) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: the rows of a computed table have no name but their place.
                  <tr key={index}>
                    {row.map((cell, column) => (
                      // biome-ignore lint/suspicious/noArrayIndexKey: as above, for the cells of a row.
                      <td key={column}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="hint">
            {text.computedFrom}{' '}
            {table.sources.map((source) =>
              source.found ? (
                <button
                  key={source.path}
                  type="button"
                  className="source-path"
                  onClick={() => void onOpenSource(source.path)}
                >
                  {source.path}
                </button>
              ) : (
                <span key={source.path} className="status status-warning">
                  {text.sourceMissing(source.path)}
                </span>
              ),
            )}
            {table.file !== '' && table.fileWritten && <> {text.inFile(table.file)}</>}
          </p>
          {tableUnverified(table) && (
            <p className="warning">
              {table.sources.length === 0
                ? text.noSource
                : table.fileWritten
                  ? text.unverified
                  : text.fileMissing(table.file)}
            </p>
          )}
        </section>
      ))}
    </>
  )
}
