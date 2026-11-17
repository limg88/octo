import { orderTotal, type ProgressSettings } from '@octo/domain'
import { useEffect, useRef, useState } from 'react'
import { FieldProblems, NotSaved } from './FieldProblems.tsx'
import { amountOf, amountText } from './forecast-text.ts'
import { messages } from './messages.ts'
import { PathField } from './PathField.tsx'
import { orOneRow, type RowsColumn, RowsField } from './RowsField.tsx'

type Props = {
  settings: ProgressSettings
  /** Spreadsheets of the project that look like the form of the client. */
  candidates: string[]
  onSave: (settings: ProgressSettings) => Promise<void>
  /** Opens the dialog of the system on the spreadsheets of the project. */
  onChooseModel: () => Promise<string | null>
  /** Absent the first time: there is nothing to go back to yet. */
  onClose?: (() => void) | undefined
}

const text = messages.progress.setup
const money = messages.progress.money
const CELL = /^[A-Za-z]{1,3}[1-9]\d*$/
const COLUMN = /^[A-Za-z]{1,3}$/
const WHOLE = /^[1-9]\d*$/
const CENT = 0.01

type CellDraft = { ref: string; text: string }
type PositionDraft = { code: string; amount: string }
const TABLE_FIELDS = ['firstRow', 'rows', 'position', 'previous', 'current', 'period'] as const
type TableField = (typeof TABLE_FIELDS)[number]
type TableDraft = Record<TableField, string>

type Draft = {
  modelPath: string
  cells: CellDraft[]
  table: TableDraft
  order: string
  total: string
  positions: PositionDraft[]
}

const CELL_COLUMNS: RowsColumn<keyof CellDraft>[] = [
  { key: 'ref', label: text.cell, width: '90px' },
  { key: 'text', label: text.cellText },
]
const POSITION_COLUMNS: RowsColumn<keyof PositionDraft>[] = [
  { key: 'code', label: text.code },
  { key: 'amount', label: text.amount, kind: 'amount', width: '180px' },
]
const EMPTY_TABLE: TableDraft = {
  firstRow: '',
  rows: '',
  position: '',
  previous: '',
  current: '',
  period: '',
}

const draftOf = (settings: ProgressSettings): Draft => {
  const { table } = settings.form
  return {
    modelPath: settings.modelPath,
    cells: orOneRow([...settings.form.fields], CELL_COLUMNS),
    table:
      table === null
        ? EMPTY_TABLE
        : { ...table, firstRow: String(table.firstRow), rows: String(table.rows) },
    order: settings.order,
    total: amountText(settings.total),
    positions: orOneRow(
      settings.positions.map(({ code, amount }) => ({ code, amount: amountText(amount) })),
      POSITION_COLUMNS,
    ),
  }
}

const blank = (values: string[]): boolean => values.every((value) => value.trim() === '')

/** What cannot be saved as it is typed, in the words shown under each part. */
type Problems = { cells: string[]; table: string | null; positions: string[]; total: boolean }

function problemsOf(draft: Draft): Problems {
  const table = TABLE_FIELDS.map((field) => draft.table[field].trim())
  const [firstRow = '', rows = '', ...columns] = table
  const tableRight =
    WHOLE.test(firstRow) && WHOLE.test(rows) && columns.every((column) => COLUMN.test(column))
  return {
    cells: draft.cells.flatMap((cell, index) =>
      blank([cell.ref, cell.text]) || CELL.test(cell.ref.trim()) ? [] : [text.cellWrong(index + 1)],
    ),
    table: blank(table) || tableRight ? null : text.tableWrong,
    positions: draft.positions.flatMap((position, index) => {
      const whole = position.code.trim() !== '' && amountOf(position.amount) !== null
      return blank([position.code, position.amount]) || whole ? [] : [text.positionWrong(index + 1)]
    }),
    total: draft.total.trim() !== '' && amountOf(draft.total) === null,
  }
}

const none = (problems: Problems): boolean =>
  problems.cells.length === 0 &&
  problems.table === null &&
  problems.positions.length === 0 &&
  !problems.total

/** What the draft says, with the rows left empty taken out. Called only when nothing is wrong. */
function settingsOf(settings: ProgressSettings, draft: Draft): ProgressSettings {
  const { table } = draft
  return {
    ...settings,
    modelPath: draft.modelPath.trim(),
    order: draft.order.trim(),
    total: amountOf(draft.total),
    positions: draft.positions.flatMap((position) => {
      const amount = amountOf(position.amount)
      return amount === null ? [] : [{ code: position.code.trim(), amount }]
    }),
    form: {
      fields: draft.cells
        .filter((cell) => cell.ref.trim() !== '')
        .map((cell) => ({ ref: cell.ref.trim().toUpperCase(), text: cell.text.trim() })),
      table: blank(Object.values(table))
        ? null
        : {
            firstRow: Number(table.firstRow),
            rows: Number(table.rows),
            position: table.position.trim().toUpperCase(),
            previous: table.previous.trim().toUpperCase(),
            current: table.current.trim().toUpperCase(),
            period: table.period.trim().toUpperCase(),
          },
    },
  }
}

function Status({ done }: { done: boolean }) {
  return (
    <span className={done ? 'status status-ok' : 'status status-warning'}>
      {done ? text.done : text.todo}
    </span>
  )
}

/** What is typed once: the form of the client, where each datum goes, and the order. */
export function ProgressSetup({ settings, candidates, onSave, onChooseModel, onClose }: Props) {
  const [draft, setDraft] = useState<Draft>(() => draftOf(settings))
  const [problems, setProblems] = useState<Problems | null>(null)
  /** The row of the map a datum is inserted into: the one the PM typed in last, none at first. */
  const [activeCell, setActiveCell] = useState<number | null>(null)
  useEffect(() => {
    setDraft(draftOf(settings))
    setActiveCell(null)
  }, [settings])
  // The only form found is proposed without asking.
  useEffect(() => {
    setDraft((current) => ({
      ...current,
      modelPath: current.modelPath || (candidates.length === 1 ? (candidates[0] ?? '') : ''),
    }))
  }, [candidates])
  // The form is long: the first thing to correct is brought into view.
  const form = useRef<HTMLFormElement>(null)
  useEffect(() => {
    if (problems) {
      form.current?.querySelector('[role="alert"]')?.scrollIntoView?.({ block: 'center' })
    }
  }, [problems])

  const change = (part: Partial<Draft>) => setDraft((current) => ({ ...current, ...part }))
  const setCell = (index: number, part: Partial<CellDraft>) =>
    change({ cells: draft.cells.map((cell, at) => (at === index ? { ...cell, ...part } : cell)) })

  const sum = orderTotal(
    draft.positions.flatMap((position) => {
      const amount = amountOf(position.amount)
      return amount === null ? [] : [{ code: position.code, amount }]
    }),
  )
  const declared = amountOf(draft.total)

  // A datum goes into a cell that is named: the row chosen, when its reference is one.
  const target =
    activeCell === null ? '' : (draft.cells[activeCell]?.ref.trim().toUpperCase() ?? '')
  const insertInto = activeCell !== null && CELL.test(target) ? activeCell : null
  /** The rows after the one taken off move up by one: the row chosen is followed, or forgotten. */
  const followRemoved = (removed: number) =>
    setActiveCell((current) => {
      if (current === null || current === removed) return null
      return current > removed ? current - 1 : current
    })

  function submit() {
    const found = problemsOf(draft)
    // Nothing is saved while something typed is not understood: it would change the figures.
    if (!none(found)) return setProblems(found)
    setProblems(null)
    void onSave(settingsOf(settings, draft))
  }

  return (
    <form
      ref={form}
      className="settings-form progress-setup"
      aria-label={text.title}
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <fieldset>
        <legend>
          {text.moduleTitle} <Status done={settings.modelPath !== ''} />
        </legend>
        <p className="hint">{text.moduleHint}</p>
        <PathField
          label={text.modelPath}
          value={draft.modelPath}
          candidates={candidates}
          onChange={(modelPath) => change({ modelPath })}
          onChoose={onChooseModel}
        />
        {candidates.length === 0 && <p className="hint">{text.modelNone}</p>}
      </fieldset>

      <fieldset>
        <legend>
          {text.cellsTitle} <Status done={settings.form.table !== null} />
        </legend>
        <p className="hint">{text.cellsHint}</p>
        <RowsField
          label={text.cellsTitle}
          columns={CELL_COLUMNS}
          rows={draft.cells}
          onChange={(cells) => change({ cells })}
          addLabel={text.addCell}
          cellLabel={(column, row) => (column === 'ref' ? text.cellN(row) : text.cellTextN(row))}
          removeLabel={text.removeCell}
          onFocusRow={setActiveCell}
          onRemoveRow={followRemoved}
        />
        <FieldProblems lines={problems?.cells ?? []} />
        <div className="choices">
          <span className="hint">
            {insertInto === null ? text.insert : text.insertInto(target)}
          </span>
          {text.placeholders.map((placeholder) => (
            <button
              key={placeholder.token}
              type="button"
              title={placeholder.token}
              disabled={insertInto === null}
              onClick={() => {
                if (insertInto === null) return
                setCell(insertInto, {
                  text: `${draft.cells[insertInto]?.text ?? ''}${placeholder.token}`,
                })
              }}
            >
              {placeholder.label}
            </button>
          ))}
        </div>
        <h4>{text.tableTitle}</h4>
        <p className="hint">{text.tableHint}</p>
        <div className="range-fields">
          {TABLE_FIELDS.map((field) => (
            <label key={field}>
              {text[field]}
              <input
                type="text"
                className="short"
                value={draft.table[field]}
                onChange={(event) =>
                  change({ table: { ...draft.table, [field]: event.target.value } })
                }
              />
            </label>
          ))}
        </div>
        <FieldProblems lines={problems?.table ? [problems.table] : []} />
      </fieldset>

      <fieldset>
        <legend>
          {text.orderTitle} <Status done={settings.positions.length > 0} />
        </legend>
        <label>
          {text.order}
          <input
            type="text"
            value={draft.order}
            onChange={(event) => change({ order: event.target.value })}
          />
        </label>
        <label>
          {text.total}
          <input
            type="text"
            inputMode="decimal"
            className="amount"
            value={draft.total}
            onChange={(event) => change({ total: event.target.value })}
          />
        </label>
        <FieldProblems lines={problems?.total ? [messages.amountWrong] : []} />
        <h4>{text.positionsTitle}</h4>
        <RowsField
          label={text.positionsTitle}
          columns={POSITION_COLUMNS}
          rows={draft.positions}
          onChange={(positions) => change({ positions })}
          addLabel={text.addPosition}
          cellLabel={(column, row) => (column === 'code' ? text.codeN(row) : text.amountN(row))}
          removeLabel={text.removePosition}
        />
        <FieldProblems lines={problems?.positions ?? []} />
        {declared !== null && Math.abs(declared - sum) >= CENT ? (
          <p className="badge badge-warning">{text.sumDiffers(money(sum), money(declared))}</p>
        ) : (
          sum > 0 && <p className="hint">{text.sum(money(sum))}</p>
        )}
      </fieldset>

      <div className="actions">
        <button type="submit">{text.save}</button>
        {onClose && (
          <button type="button" onClick={onClose}>
            {text.close}
          </button>
        )}
        {problems && <NotSaved text={messages.notSaved} />}
      </div>
    </form>
  )
}
