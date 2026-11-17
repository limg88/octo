import type { Project } from '@octo/domain'
import { useState } from 'react'
import type { ErrorCode } from '../shared/api.ts'
import { Dialog } from './Dialog.tsx'
import { messages } from './messages.ts'

type AddProps = {
  error: ErrorCode | null
  onClose: () => void
  onAddFolder: () => void
  onCreate: (name: string) => void
}

/** The two ways into Octo: a folder that exists, or a new one made by Octo. */
export function AddProjectDialog({ error, onClose, onAddFolder, onCreate }: AddProps) {
  const [name, setName] = useState('')
  const text = messages.addDialog
  return (
    <Dialog title={text.title} error={error} onClose={onClose}>
      <section className="dialog-choice" aria-label={text.existingTitle}>
        <h3>{text.existingTitle}</h3>
        <p className="hint">{text.existingHint}</p>
        <div className="actions">
          <button type="button" className="primary" onClick={onAddFolder}>
            {text.existingChoose}
          </button>
        </div>
      </section>
      <form
        className="dialog-choice"
        aria-label={text.newTitle}
        onSubmit={(event) => {
          event.preventDefault()
          onCreate(name)
        }}
      >
        <h3>{text.newTitle}</h3>
        <p className="hint">{messages.newProjectHint}</p>
        <label className="field">
          {messages.newProjectName}
          <input type="text" value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <div className="actions">
          <button type="submit" disabled={name.trim() === ''}>
            {messages.newProjectCreate}
          </button>
        </div>
      </form>
      <footer className="dialog-footer">
        <button type="button" onClick={onClose}>
          {messages.cancel}
        </button>
      </footer>
    </Dialog>
  )
}

type ManageProps = {
  projects: Project[]
  error: ErrorCode | null
  onClose: () => void
  onRemove: (project: Project) => void
  /** The folder of the project was moved: the PM says where it is now. */
  onRelocate: (project: Project) => void
  onSaveBackup: () => void
  onRestoreBackup: () => void
}

/** The list of the projects and what is done rarely: taking one off, moving to another computer. */
export function ManageProjectsDialog({
  projects,
  error,
  onClose,
  onRemove,
  onRelocate,
  onSaveBackup,
  onRestoreBackup,
}: ManageProps) {
  const [leaving, setLeaving] = useState<Project | null>(null)
  const text = messages.manage

  if (leaving) {
    return (
      <Dialog
        title={text.confirmTitle(leaving.name)}
        error={error}
        onClose={() => setLeaving(null)}
      >
        <p>{text.confirmBody}</p>
        <p className="hint">{leaving.folder}</p>
        <footer className="dialog-footer">
          <button type="button" onClick={() => setLeaving(null)}>
            {messages.cancel}
          </button>
          <button type="button" className="danger" onClick={() => onRemove(leaving)}>
            {text.confirm}
          </button>
        </footer>
      </Dialog>
    )
  }

  return (
    <Dialog title={text.title} error={error} onClose={onClose}>
      {projects.length === 0 ? (
        <p className="hint">{text.none}</p>
      ) : (
        <ul className="managed">
          {projects.map((project) => (
            <li key={project.id}>
              <div>
                <strong>{project.name}</strong>
                <p className="hint folder-path">{project.folder}</p>
              </div>
              <button
                type="button"
                aria-label={text.relocateOf(project.name)}
                onClick={() => onRelocate(project)}
              >
                {text.relocate}
              </button>
              <button
                type="button"
                aria-label={text.removeOf(project.name)}
                onClick={() => setLeaving(project)}
              >
                {text.remove}
              </button>
            </li>
          ))}
        </ul>
      )}
      <section className="dialog-choice" aria-label={messages.backup.title}>
        <h3>{messages.backup.title}</h3>
        <p className="hint">{messages.backup.hint}</p>
        <div className="actions">
          <button type="button" onClick={onSaveBackup}>
            {messages.backup.save}
          </button>
          <button type="button" onClick={onRestoreBackup}>
            {messages.backup.restore}
          </button>
        </div>
      </section>
      <footer className="dialog-footer">
        <button type="button" onClick={onClose}>
          {messages.close}
        </button>
      </footer>
    </Dialog>
  )
}
