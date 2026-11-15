import type { Project } from '@octo/domain'
import { useState } from 'react'
import { messages } from './messages.ts'

type Props = {
  projects: Project[]
  selectedId: string | null
  onSelect: (projectId: string) => void
  onAdd: () => void
  onManage: () => void
}

/** The project the PM is working on, and the way to another one. */
export function ProjectSwitcher({ projects, selectedId, onSelect, onAdd, onManage }: Props) {
  const [open, setOpen] = useState(false)
  const selected = projects.find((project) => project.id === selectedId)
  const choose = (action: () => void) => () => {
    setOpen(false)
    action()
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: the list closes when the focus leaves it or with Escape.
    <div
      className="switcher"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') setOpen(false)
      }}
    >
      <button
        type="button"
        className="switcher-button"
        aria-haspopup="menu"
        aria-expanded={open}
        title={selected?.folder}
        onClick={() => setOpen(!open)}
      >
        <span className="switcher-name">{selected?.name ?? messages.noProjectTitle}</span>
        <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="switcher-menu" role="menu" aria-label={messages.projects}>
          {projects.map((project) => (
            <button
              key={project.id}
              type="button"
              role="menuitemradio"
              aria-checked={project.id === selectedId}
              className="switcher-item"
              title={project.folder}
              onClick={choose(() => onSelect(project.id))}
            >
              <span aria-hidden="true">{project.id === selectedId ? '✓' : ''}</span>
              {project.name}
            </button>
          ))}
          {projects.length > 0 && <hr />}
          <button type="button" role="menuitem" className="switcher-item" onClick={choose(onAdd)}>
            <span aria-hidden="true">+</span>
            {messages.addProject}
          </button>
          <button
            type="button"
            role="menuitem"
            className="switcher-item"
            onClick={choose(onManage)}
          >
            <span aria-hidden="true" />
            {messages.manage.open}
          </button>
          {projects.length > 1 && <p className="hint switcher-hint">{messages.projectShortcut}</p>}
        </div>
      )}
    </div>
  )
}
