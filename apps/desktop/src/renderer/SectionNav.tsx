import type { KeyboardEvent } from 'react'
import { SECTION_GROUPS, SECTION_LABELS, SECTIONS, type Section } from './sections.ts'

type Props = {
  current: Section
  onSelect: (section: Section) => void
  /** How many things wait in a section, said beside its name; nothing is said of zero. */
  counts?: Partial<Record<Section, { count: number; label: string }>>
}

/** Where the arrow keys go from a section: the one before or after it, round the list. */
const STEPS: Readonly<Record<string, number>> = { ArrowDown: 1, ArrowUp: -1 }

/**
 * The sections of a project in the sidebar, grouped by how often they are used. One list for the
 * keyboard: the arrows move through all of it, whatever the group.
 */
export function SectionNav({ current, onSelect, counts = {} }: Props) {
  function onKey(event: KeyboardEvent<HTMLButtonElement>, section: Section) {
    const step = STEPS[event.key]
    if (step === undefined) return
    event.preventDefault()
    const next = SECTIONS[(SECTIONS.indexOf(section) + step + SECTIONS.length) % SECTIONS.length]
    if (next === undefined) return
    onSelect(next)
    document.getElementById(tabId(next))?.focus()
  }

  return (
    <div className="section-nav">
      {SECTION_GROUPS.map((group) => (
        <div
          key={group.title}
          className="section-group"
          role="tablist"
          aria-orientation="vertical"
          aria-label={group.title}
        >
          <span className="section-group-title" aria-hidden="true">
            {group.title}
          </span>
          {group.sections.map((section) => (
            <button
              key={section}
              id={tabId(section)}
              type="button"
              role="tab"
              aria-selected={current === section}
              tabIndex={current === section ? 0 : -1}
              className={current === section ? 'nav-item nav-item-selected' : 'nav-item'}
              onClick={() => onSelect(section)}
              onKeyDown={(event) => onKey(event, section)}
            >
              {SECTION_LABELS[section]}
              {(counts[section]?.count ?? 0) > 0 && (
                <span className="nav-count" title={counts[section]?.label}>
                  {counts[section]?.count}
                </span>
              )}
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}

const tabId = (section: Section): string => `section-${section}`
