import { type KeyboardEvent, type MouseEvent, useState } from 'react'

/** Where the widths the PM gave to the columns of a table are kept, on this computer. */
const storageKey = (table: string): string => `octo.colonne.${table}`
/** A column is never dragged narrower than this: its heading stays readable. */
export const MIN_COLUMN_PX = 64
/** How far an arrow key moves the edge of a column. */
const KEY_STEP_PX = 16
const STEPS: Readonly<Record<string, number>> = { ArrowLeft: -KEY_STEP_PX, ArrowRight: KEY_STEP_PX }

type Widths = Record<string, number>

function kept(table: string): Widths {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(storageKey(table)) ?? '{}')
    return parsed !== null && typeof parsed === 'object' ? (parsed as Widths) : {}
  } catch {
    return {}
  }
}

/**
 * The widths of the columns of a table as the PM dragged them, remembered for that table. The
 * edge of a heading is dragged with the mouse or moved with the arrows; a double click gives the
 * column back the width the table chose.
 */
export function useColumnWidths(table: string) {
  const [widths, setWidths] = useState<Widths>(() => kept(table))

  function keep(next: Widths) {
    setWidths(next)
    try {
      window.localStorage.setItem(storageKey(table), JSON.stringify(next))
    } catch {
      // Without a place to keep them the widths hold while the page is open.
    }
  }
  const sized = (from: Widths, key: string, px: number): Widths => ({
    ...from,
    [key]: Math.max(MIN_COLUMN_PX, Math.round(px)),
  })

  return {
    widths,
    /** What the edge of the heading of a column answers to. */
    handle(key: string) {
      const headingOf = (edge: Element): number =>
        edge.closest('th')?.getBoundingClientRect().width ?? MIN_COLUMN_PX
      return {
        onMouseDown(event: MouseEvent<HTMLElement>) {
          event.preventDefault()
          const from = event.clientX
          const start = headingOf(event.currentTarget)
          let last = widths
          const move = (moved: globalThis.MouseEvent) => {
            last = sized(widths, key, start + moved.clientX - from)
            setWidths(last)
          }
          const end = () => {
            document.removeEventListener('mousemove', move)
            document.removeEventListener('mouseup', end)
            keep(last)
          }
          document.addEventListener('mousemove', move)
          document.addEventListener('mouseup', end)
        },
        onKeyDown(event: KeyboardEvent<HTMLElement>) {
          const step = STEPS[event.key]
          if (step === undefined) return
          event.preventDefault()
          keep(sized(widths, key, (widths[key] ?? headingOf(event.currentTarget)) + step))
        },
        onDoubleClick() {
          const { [key]: _own, ...others } = widths
          keep(others)
        },
      }
    },
  }
}
