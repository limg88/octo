import { orderTotal, type ProgressSettings } from '@octo/domain'
import { useEffect, useRef, useState } from 'react'
import { amountOf, amountText } from './forecast-text.ts'
import { messages } from './messages.ts'

type Props = {
  settings: ProgressSettings
  /** Spreadsheets of the project that look like the form of the client. */
  candidates: string[]
  onSave: (settings: ProgressSettings) => Promise<void>
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

const EMPTY_CELL: CellDraft = { ref: '', text: '' }
const EMPTY_POSITION: PositionDraft = { code: '', amount: '' }
const EMPTY_TABLE: TableDraft = {
  firstRow: '',
  rows: '',
  position: '',
  previous: '',
  current: '',
  period: '',
}

/** An empty row waits at the end of a list that has none, so there is always where to type. */
const orOne = <T,>(rows: T[], empty: T): T[] => (rows.length === 0 ? [empty] : rows)

const draftOf = (settings: ProgressSettings): Draft => {
  const { table } = settings.form
  return {
    modelPath: settings.modelPath,
    cells: orOne([...settings.form.fields], EMPTY_CELL),
    table:
      table === null
        ? EMPTY_TABLE
        : { ...table, firstRow: String(table.firstRow), rows: String(table.rows) },
    order: settings.order,
    total: amountText(settings.total),
    positions: orOne(
      settings.positions.map(({ code, amount }) => ({ code, amount: amountText(amount) })),
      EMPTY_POSITION,
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

function Problem({ lines }: { lines: string[] }) {
  if (lines.length === 0) return null
  return (
    <ul className="field-problems" role="alert">
      {lines.map((line) => (
        <li key={line}>{line}</li>
      ))}
    </ul>
  )
}

/** What is typed once: the form of the client, where each datum goes, and the order. */
export function ProgressSetup({ settings, candidates, onSave, onClose }: Props) {
  const [draft, setDraft] = useState<Draft>(() => draftOf(settings))
  const [problems, setProblems] = useState<Problems | null>(null)
  /** The row of the map a datum is inserted into: the last one the PM typed in. */
  const [activeCell, setActiveCell] = useState(0)
  useEffect(() => setDraft(draftOf(settings)), [settings])
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
  const setPosition = (index: number, part: Partial<PositionDraft>) =>
    change({
      positions: draft.positions.map((position, at) =>
        at === index ? { ...position, ...part } : position,
      ),
    })
  const without = <T,>(rows: T[], index: number): T[] => rows.filter((_row, at) => at !== index)

  const options = candidates.includes(draft.modelPath)
    ? candidates
    : [...(draft.modelPath === '' ? [] : [draft.modelPath]), ...candidates]
  const sum = orderTotal(
    draft.positions.flatMap((position) => {
      const amount = amountOf(position.amount)
      return amount === null ? [] : [{ code: position.code, amount }]
    }),
  )
  const declared = amountOf(draft.total)

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
        {candidates.length > 0 ? (
          <label>
            {text.modelPath}
            <select
              value={draft.modelPath}
              onChange={(event) => change({ modelPath: event.target.value })}
            >
              <option value="">{text.modelChoose}</option>
              {options.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label>
            {text.modelPath}
            <input
              type="text"
              value={draft.modelPath}
              onChange={(event) => change({ modelPath: event.target.value })}
            />
          </label>
        )}
        {candidates.length === 0 && <p className="hint">{text.modelNone}</p>}
      </fieldset>

      <fieldset>
        <legend>
          {text.cellsTitle} <Status done={settings.form.table !== null} />
        </legend>
        <p className="hint">{text.cellsHint}</p>
        <div className="rows rows-cells">
          <span className="rows-head">{text.cell}</span>
          <span className="rows-head">{text.cellText}</span>
          <span />
          {draft.cells.map((cell, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: a row is its place in the list.
            <div key={index} className="rows-row">
              <input
                type="text"
                aria-label={text.cellN(index + 1)}
                value={cell.ref}
                onFocus={() => setActiveCell(index)}
                onChange={(event) => setCell(index, { ref: event.target.value })}
              />
              <input
                type="text"
                aria-label={text.cellTextN(index + 1)}
                value={cell.text}
                onFocus={() => setActiveCell(index)}
                onChange={(event) => setCell(index, { text: event.target.value })}
              />
              <button
                type="button"
                className="quiet"
                aria-label={text.removeCell(index + 1)}
                onClick={() => change({ cells: orOne(without(draft.cells, index), EMPTY_CELL) })}
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <Problem lines={problems?.cells ?? []} />
        <div className="actions">
          <button type="button" onClick={() => change({ cells: [...draft.cells, EMPTY_CELL] })}>
            {text.addCell}
          </button>
        </div>
        <div className="choices">
          <span className="hint">{text.insert}</span>
          {text.placeholders.map((placeholder) => (
            <button
              key={placeholder.token}
              type="button"
              title={placeholder.token}
              onClick={() => {
                const row = Math.min(activeCell, draft.cells.length - 1)
                setCell(row, { text: `${draft.cells[row]?.text ?? ''}${placeholder.token}` })
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
        <Problem lines={problems?.table ? [problems.table] : []} />
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
        <Problem lines={problems?.total ? [messages.lines.single.amount()] : []} />
        <h4>{text.positionsTitle}</h4>
        <div className="rows rows-positions">
          <span className="rows-head">{text.code}</span>
          <span className="rows-head">{text.amount}</span>
          <span />
          {draft.positions.map((position, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: a row is its place in the list.
            <div key={index} className="rows-row">
              <input
                type="text"
                aria-label={text.codeN(index + 1)}
                value={position.code}
                onChange={(event) => setPosition(index, { code: event.target.value })}
              />
              <input
                type="text"
                inputMode="decimal"
                className="amount"
                aria-label={text.amountN(index + 1)}
                value={position.amount}
                onChange={(event) => setPosition(index, { amount: event.target.value })}
              />
              <button
                type="button"
                className="quiet"
                aria-label={text.removePosition(index + 1)}
                onClick={() =>
                  change({ positions: orOne(without(draft.positions, index), EMPTY_POSITION) })
                }
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <Problem lines={problems?.positions ?? []} />
        <div className="actions">
          <button
            type="button"
            onClick={() => change({ positions: [...draft.positions, EMPTY_POSITION] })}
          >
            {text.addPosition}
          </button>
        </div>
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
        {problems && (
          <span className="field-problems" role="status">
            {messages.lines.notSaved}
          </span>
        )}
      </div>
    </form>
  )
}
