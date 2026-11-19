import { type KeyboardEvent, type MouseEvent, type ReactNode, useLayoutEffect, useRef } from 'react'

/** Where the widths the PM gave to the columns of a table are kept, on this computer. */
const storageKey = (table: string): string => `octo.colonne.${table}`
/** A column is never dragged narrower than this: its heading stays readable. */
export const MIN_COLUMN_PX = 64
/** How far an arrow key moves the edge of a column. */
const KEY_STEP_PX = 16
/** How near the right edge of a heading the mouse takes hold of it. */
const GRIP_PX = 7
const STEPS: Readonly<Record<string, number>> = { ArrowLeft: -KEY_STEP_PX, ArrowRight: KEY_STEP_PX }
const GRIP_CLASS = 'column-grip'

function kept(table: string): number[] | null {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(storageKey(table)) ?? 'null')
    return Array.isArray(parsed) && parsed.every((px) => typeof px === 'number') ? parsed : null
  } catch {
    return null
  }
}

function keep(table: string, widths: number[] | null) {
  try {
    if (widths === null) window.localStorage.removeItem(storageKey(table))
    else window.localStorage.setItem(storageKey(table), JSON.stringify(widths))
  } catch {
    // Without a place to keep them the widths hold while the page is open.
  }
}

/** The cells that stand one for each column: those of the longest row no cell of which spans. */
function columnCells(table: HTMLTableElement): HTMLTableCellElement[] {
  let best: HTMLTableCellElement[] = []
  for (const row of table.rows) {
    const cells = [...row.cells]
    if (cells.length > best.length && cells.every((cell) => cell.colSpan === 1)) best = cells
  }
  return best
}

const columnsOf = (table: HTMLTableElement): HTMLElement[] =>
  [...table.querySelectorAll<HTMLElement>('col')].filter((col) => col.closest('table') === table)

/** Gives the columns their widths: the table is then as wide as their sum, and scrolls if it must. */
function apply(wrapper: HTMLElement, table: HTMLTableElement, widths: readonly number[]) {
  let cols = columnsOf(table)
  if (cols.length !== widths.length) {
    const group = document.createElement('colgroup')
    group.dataset.resize = ''
    group.append(...widths.map(() => document.createElement('col')))
    table.prepend(group)
    cols = [...group.children] as HTMLElement[]
  }
  cols.forEach((col, at) => {
    // What the table itself asked for the column is given back when the PM lets go of it.
    col.dataset.own ??= col.style.width
    col.style.width = `${widths[at]}px`
  })
  const whole = widths.reduce((sum, px) => sum + px, 0)
  table.style.tableLayout = 'fixed'
  table.style.width = `${whole}px`
  table.style.minWidth = '0'
  wrapper.style.overflowX = whole > wrapper.clientWidth ? 'auto' : ''
}

function clear(wrapper: HTMLElement, table: HTMLTableElement) {
  for (const col of columnsOf(table)) {
    if (col.parentElement?.dataset.resize !== undefined) continue
    col.style.width = col.dataset.own ?? ''
    delete col.dataset.own
  }
  table.querySelector('colgroup[data-resize]')?.remove()
  table.style.tableLayout = ''
  table.style.width = ''
  table.style.minWidth = ''
  wrapper.style.overflowX = ''
}

/** The heading whose right edge an event is on, and the column that edge closes. */
function edgeOf(target: EventTarget, clientX: number | null) {
  const heading = (target as Element).closest?.('thead th') as HTMLTableCellElement | null
  const table = heading?.closest('table')
  if (!heading || !table) return null
  const right = heading.getBoundingClientRect().right
  const onEdge = (target as Element).closest('.column-edge') !== null
  if (!onEdge && (clientX === null || right - clientX > GRIP_PX || clientX > right)) return null
  const cells = columnCells(table)
  // The column of the edge: the last one that ends where the heading ends.
  const ends = cells.map((cell) => Math.abs(cell.getBoundingClientRect().right - right))
  const own = cells.indexOf(heading)
  const at = own >= 0 ? own : ends.lastIndexOf(Math.min(...ends))
  return at < 0 ? null : { heading, table, cells, at }
}

type Props = {
  /** What the table is called: its widths are remembered under this name. */
  name: string
  className?: string
  children: ReactNode
}

/**
 * A table whose columns the PM makes wider or narrower: the right edge of any heading is dragged
 * with the mouse, or moved with the arrows where it can take the focus; a double click gives the
 * table back the widths it chose. The widths are remembered for that table on this computer.
 */
export function Resizable({ name, className, children }: Props) {
  const wrapper = useRef<HTMLDivElement>(null)
  const widths = useRef<number[] | null | undefined>(undefined)
  const gripped = useRef<Element | null>(null)
  /** True right after a drag: the click that ends it is not a click on the heading. */
  const dragged = useRef(false)

  // After every render: the table may have new rows, and its columns keep the widths given.
  useLayoutEffect(() => {
    const table = wrapper.current?.querySelector('table')
    if (!wrapper.current || !table) return
    if (widths.current === undefined) widths.current = kept(name)
    const known = widths.current
    if (known && known.length === columnCells(table).length) apply(wrapper.current, table, known)
  })

  function resize(edge: NonNullable<ReturnType<typeof edgeOf>>, px: (from: number) => number) {
    if (!wrapper.current) return null
    // The first time every column takes the width it has: only the one moved changes after.
    const from =
      widths.current?.length === edge.cells.length
        ? widths.current
        : edge.cells.map((cell) => Math.max(MIN_COLUMN_PX, cell.getBoundingClientRect().width))
    const next = from.map((width, at) =>
      at === edge.at ? Math.max(MIN_COLUMN_PX, Math.round(px(width))) : Math.round(width),
    )
    apply(wrapper.current, edge.table, next)
    return next
  }

  function onMouseMove(event: MouseEvent) {
    const heading = edgeOf(event.target, event.clientX)?.heading ?? null
    if (gripped.current === heading) return
    gripped.current?.classList.remove(GRIP_CLASS)
    heading?.classList.add(GRIP_CLASS)
    gripped.current = heading
  }

  function onMouseDown(event: MouseEvent) {
    const edge = edgeOf(event.target, event.clientX)
    if (!edge) return
    event.preventDefault()
    const from = event.clientX
    let start: number | null = null
    let last: number[] | null = null
    const move = (moved: globalThis.MouseEvent) => {
      dragged.current = true
      last = resize(edge, (width) => {
        start ??= width
        return start + moved.clientX - from
      })
      if (last) widths.current = last
    }
    const end = () => {
      document.removeEventListener('mousemove', move)
      document.removeEventListener('mouseup', end)
      if (last) keep(name, last)
      // The click that ends the drag comes before this: the next one is a click again.
      setTimeout(() => {
        dragged.current = false
      }, 0)
    }
    document.addEventListener('mousemove', move)
    document.addEventListener('mouseup', end)
  }

  function onKeyDown(event: KeyboardEvent) {
    const step = STEPS[event.key]
    const edge = step === undefined ? null : edgeOf(event.target, null)
    if (!edge || step === undefined) return
    event.preventDefault()
    const next = resize(edge, (width) => width + step)
    if (!next) return
    widths.current = next
    keep(name, next)
  }

  function onDoubleClick(event: MouseEvent) {
    const edge = edgeOf(event.target, event.clientX)
    if (!edge || !wrapper.current) return
    clear(wrapper.current, edge.table)
    widths.current = null
    keep(name, null)
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: the edges of the headings inside are what is dragged.
    <div
      ref={wrapper}
      className={className ? `resizable ${className}` : 'resizable'}
      onMouseMove={onMouseMove}
      onMouseDown={onMouseDown}
      onKeyDown={onKeyDown}
      onDoubleClick={onDoubleClick}
      onClickCapture={(event) => {
        if (dragged.current) event.stopPropagation()
      }}
    >
      {children}
    </div>
  )
}
