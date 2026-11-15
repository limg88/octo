import type { AgentStatus } from '@octo/application'
import { FEED_NAMES, type Project, type RestoreOutcome } from '@octo/domain'
import { useEffect, useState } from 'react'
import type { ErrorCode, OctoApi } from '../shared/api.ts'
import { AlignmentView } from './AlignmentView.tsx'
import { AskView } from './AskView.tsx'
import { DashboardView } from './DashboardView.tsx'
import { DeliverablesView } from './DeliverablesView.tsx'
import { DocumentsSection } from './DocumentsSection.tsx'
import { FeedSection } from './FeedSection.tsx'
import { ForecastView } from './ForecastView.tsx'
import { HoursView } from './HoursView.tsx'
import { ModelsSection } from './ModelsSection.tsx'
import { errorText, messages } from './messages.ts'
import { ProgressView } from './ProgressView.tsx'
import { AddProjectDialog, ManageProjectsDialog } from './ProjectDialogs.tsx'
import { ProjectSwitcher } from './ProjectSwitcher.tsx'
import { SetupGuide } from './SetupGuide.tsx'
import { SourcesView } from './SourcesView.tsx'
import { TeamSection } from './TeamSection.tsx'

type Tab =
  | 'ask'
  | 'deliverables'
  | 'dashboard'
  | 'hours'
  | 'forecast'
  | 'progress'
  | 'alignment'
  | 'sources'

type Props = {
  api: OctoApi
}

/** How many projects the number keys reach. */
const SHORTCUT_PROJECTS = 9

export function App({ api }: Props) {
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [agent, setAgent] = useState<AgentStatus | null>(null)
  const [error, setError] = useState<ErrorCode | null>(null)
  const [tab, setTab] = useState<Tab>('ask')
  const [dialog, setDialog] = useState<'add' | 'manage' | null>(null)
  const [backupNotes, setBackupNotes] = useState<string[]>([])
  /** The project just taken off the list, while it can still be put back with one click. */
  const [removed, setRemoved] = useState<Project | null>(null)

  useEffect(() => {
    void api.agentStatus().then((result) => {
      if (result.ok) setAgent(result.value)
    })
    void api.listProjects().then((result) => {
      if (!result.ok) return setError(result.code)
      setProjects(result.value)
      setSelectedId(result.value[0]?.id ?? null)
    })
  }, [api])

  // Command or Control with a number goes to the project in that place of the list.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return
      const place = Number(event.key)
      if (!Number.isInteger(place) || place < 1 || place > SHORTCUT_PROJECTS) return
      const project = projects[place - 1]
      if (!project) return
      event.preventDefault()
      setSelectedId(project.id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [projects])

  function openDialog(next: 'add' | 'manage') {
    setError(null)
    setDialog(next)
  }

  function closeDialog() {
    setError(null)
    setDialog(null)
  }

  /** A project that enters the list is opened on what feeds it. */
  function enter(project: Project) {
    setDialog(null)
    setRemoved(null)
    setProjects((previous) => [...previous, project])
    setSelectedId(project.id)
    setTab('sources')
  }

  async function addProject() {
    setError(null)
    const result = await api.addProject()
    if (!result.ok) return setError(result.code)
    if (result.value !== null) enter(result.value)
  }

  async function createProject(name: string) {
    setError(null)
    const result = await api.createProject(name)
    if (!result.ok) return setError(result.code)
    if (result.value !== null) enter(result.value)
  }

  async function saveBackup() {
    setError(null)
    setBackupNotes([])
    const result = await api.saveBackup()
    if (!result.ok) return setError(result.code)
    if (result.value === null) return
    setDialog(null)
    setBackupNotes([messages.backup.saved(result.value.file, result.value.projects)])
  }

  async function restoreBackup() {
    setError(null)
    setBackupNotes([])
    const result = await api.restoreBackup()
    if (!result.ok) return setError(result.code)
    if (result.value === null) return
    setDialog(null)
    setBackupNotes(restoreNotes(result.value))
    const listed = await api.listProjects()
    if (!listed.ok) return setError(listed.code)
    setProjects(listed.value)
    setSelectedId((current) => current ?? listed.value[0]?.id ?? null)
  }

  async function removeProject(project: Project) {
    setError(null)
    const result = await api.removeProject(project.id)
    if (!result.ok) return setError(result.code)
    const remaining = projects.filter((candidate) => candidate.id !== project.id)
    setProjects(remaining)
    if (project.id === selectedId) setSelectedId(remaining[0]?.id ?? null)
    setDialog(null)
    setRemoved(project)
  }

  async function putBack(project: Project) {
    setError(null)
    const result = await api.restoreProject(project.id)
    if (!result.ok) return setError(result.code)
    setRemoved(null)
    setProjects((previous) => [...previous, result.value])
    setSelectedId(result.value.id)
  }

  const selected = projects.find((project) => project.id === selectedId) ?? null

  return (
    <div className="shell">
      <nav className="sidebar" aria-label={messages.projects}>
        <h1>{messages.appName}</h1>
        <h2>{messages.project}</h2>
        <ProjectSwitcher
          projects={projects}
          selectedId={selectedId}
          onSelect={setSelectedId}
          onAdd={() => openDialog('add')}
          onManage={() => openDialog('manage')}
        />
        {agent?.available && <p className="agent">{messages.agentReady(agent.version)}</p>}
      </nav>
      <main>
        {error && dialog === null && (
          <div className="notice-bar notice-bar-warning">
            <p role="alert">{errorText(error)}</p>
            <CloseButton onClose={() => setError(null)} />
          </div>
        )}
        {backupNotes.length > 0 && (
          <div className="notice-bar">
            <div role="status">
              {backupNotes.map((note) => (
                <p key={note}>{note}</p>
              ))}
            </div>
            <CloseButton onClose={() => setBackupNotes([])} />
          </div>
        )}
        {removed && (
          <div className="notice-bar">
            <p role="status">{messages.manage.removed(removed.name)}</p>
            <button type="button" onClick={() => void putBack(removed)}>
              {messages.manage.undo}
            </button>
            <CloseButton onClose={() => setRemoved(null)} />
          </div>
        )}
        {agent?.available === false && (
          <div className="notice" role="alert">
            <h2>{messages.agentMissingTitle}</h2>
            <p>{messages.agentMissingBody}</p>
          </div>
        )}
        {selected ? (
          <>
            <header className="project-header">
              <div>
                <h2>{selected.name}</h2>
                <p className="folder">{selected.folder}</p>
              </div>
            </header>
            <div className="tabs" role="tablist">
              <TabButton current={tab} tab="ask" label={messages.ask} onSelect={setTab} />
              <TabButton
                current={tab}
                tab="deliverables"
                label={messages.deliverablesTab}
                onSelect={setTab}
              />
              <TabButton
                current={tab}
                tab="dashboard"
                label={messages.dashboardTab}
                onSelect={setTab}
              />
              <TabButton current={tab} tab="hours" label={messages.hoursTab} onSelect={setTab} />
              <TabButton
                current={tab}
                tab="forecast"
                label={messages.forecastTab}
                onSelect={setTab}
              />
              <TabButton
                current={tab}
                tab="progress"
                label={messages.progressTab}
                onSelect={setTab}
              />
              <TabButton
                current={tab}
                tab="alignment"
                label={messages.alignmentTab}
                onSelect={setTab}
              />
              <TabButton
                current={tab}
                tab="sources"
                label={messages.sourcesTab}
                onSelect={setTab}
              />
            </div>
            {tab === 'ask' ? (
              <AskView api={api} project={selected} />
            ) : tab === 'deliverables' ? (
              <DeliverablesView api={api} project={selected} />
            ) : tab === 'dashboard' ? (
              <DashboardView api={api} project={selected} />
            ) : tab === 'hours' ? (
              <HoursView api={api} project={selected} />
            ) : tab === 'forecast' ? (
              <ForecastView api={api} project={selected} />
            ) : tab === 'progress' ? (
              <ProgressView api={api} project={selected} />
            ) : tab === 'alignment' ? (
              <AlignmentView api={api} project={selected} />
            ) : (
              <div className="sources-page">
                <SetupGuide api={api} project={selected} />
                <SourcesView api={api} project={selected} />
                {FEED_NAMES.map((feed) => (
                  <FeedSection key={feed} api={api} project={selected} feed={feed} />
                ))}
                <DocumentsSection api={api} project={selected} />
                <TeamSection api={api} project={selected} />
                <ModelsSection api={api} project={selected} />
              </div>
            )}
          </>
        ) : (
          <div className="notice">
            <h2>{messages.noProjectTitle}</h2>
            <p>{messages.noProjectBody}</p>
            <div className="actions">
              <button type="button" className="primary" onClick={() => openDialog('add')}>
                {messages.addProject}
              </button>
            </div>
          </div>
        )}
      </main>
      {dialog === 'add' && (
        <AddProjectDialog
          error={error}
          onClose={closeDialog}
          onAddFolder={() => void addProject()}
          onCreate={(name) => void createProject(name)}
        />
      )}
      {dialog === 'manage' && (
        <ManageProjectsDialog
          projects={projects}
          error={error}
          onClose={closeDialog}
          onRemove={(project) => void removeProject(project)}
          onSaveBackup={() => void saveBackup()}
          onRestoreBackup={() => void restoreBackup()}
        />
      )}
    </div>
  )
}

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button type="button" className="quiet" aria-label={messages.close} onClick={onClose}>
      ×
    </button>
  )
}

/** What a restore did, one line for each thing the PM has to know. */
function restoreNotes(outcome: RestoreOutcome): string[] {
  const { restored, alreadyHere, skipped } = outcome
  if (restored.length + alreadyHere.length + skipped.length === 0) return [messages.backup.nothing]
  return [
    ...(restored.length > 0 ? [messages.backup.restored(restored)] : []),
    ...(alreadyHere.length > 0 ? [messages.backup.alreadyHere(alreadyHere)] : []),
    ...(skipped.length > 0 ? [messages.backup.skipped(skipped)] : []),
    ...(restored.length > 0 ? [messages.backup.credentials] : []),
  ]
}

function TabButton({
  current,
  tab,
  label,
  onSelect,
}: {
  current: Tab
  tab: Tab
  label: string
  onSelect: (tab: Tab) => void
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={current === tab}
      className={current === tab ? 'tab tab-selected' : 'tab'}
      onClick={() => onSelect(tab)}
    >
      {label}
    </button>
  )
}
