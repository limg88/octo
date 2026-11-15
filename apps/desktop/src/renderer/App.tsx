import type { AgentStatus, SessionView } from '@octo/application'
import type { Assignment, Project, RestoreOutcome } from '@octo/domain'
import { useEffect, useState } from 'react'
import type { ErrorCode, OctoApi } from '../shared/api.ts'
import { AlignmentView } from './AlignmentView.tsx'
import { AllProjectsView } from './AllProjectsView.tsx'
import { AskView } from './AskView.tsx'
import {
  type DashboardFocus,
  type Handoff,
  NO_DASHBOARD_FOCUS,
  NO_TODAY_FOCUS,
  type TodayFocus,
} from './context.ts'
import { DashboardView } from './DashboardView.tsx'
import { DeliverablesView } from './DeliverablesView.tsx'
import { ForecastView } from './ForecastView.tsx'
import { HoursView } from './HoursView.tsx'
import { Logo } from './Logo.tsx'
import { errorText, messages } from './messages.ts'
import { ProgressView } from './ProgressView.tsx'
import { AddProjectDialog, ManageProjectsDialog } from './ProjectDialogs.tsx'
import { ProjectSettings } from './ProjectSettings.tsx'
import { ProjectSwitcher } from './ProjectSwitcher.tsx'
import { SectionNav } from './SectionNav.tsx'
import { SignIn } from './SignIn.tsx'
import { SECTION_LABELS, type Section } from './sections.ts'
import { ThemeToggle } from './ThemeToggle.tsx'
import { TodayView } from './TodayView.tsx'
import { useTheme } from './use-theme.ts'

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
  const [tab, setTab] = useState<Section>('today')
  const [session, setSession] = useState<SessionView | null>(null)
  /** The page above the projects, shown in place of a project. */
  const [overview, setOverview] = useState(false)
  const [assignment, setAssignment] = useState<Assignment>('unknown')
  const [dialog, setDialog] = useState<'add' | 'manage' | null>(null)
  const [backupNotes, setBackupNotes] = useState<string[]>([])
  /** The project just taken off the list, while it can still be put back with one click. */
  const [removed, setRemoved] = useState<Project | null>(null)
  const theme = useTheme(api)
  /** What goes with the PM from a section to the next one, inside the same project. */
  const [askSeed, setAskSeed] = useState<string | null>(null)
  const [handoff, setHandoff] = useState<Handoff | null>(null)
  const [todayFocus, setTodayFocus] = useState<TodayFocus>(NO_TODAY_FOCUS)
  const [dashboardFocus, setDashboardFocus] = useState<DashboardFocus>(NO_DASHBOARD_FOCUS)

  // Nothing of a project follows the PM into another one.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the project is what is watched.
  useEffect(() => {
    setAskSeed(null)
    setHandoff(null)
    setTodayFocus(NO_TODAY_FOCUS)
    setDashboardFocus(NO_DASHBOARD_FOCUS)
  }, [selectedId])

  useEffect(() => {
    void api.session().then((result) => {
      if (result.ok) setSession(result.value)
      else setError(result.code)
    })
  }, [api])

  const signedIn = session?.identity != null
  // Nothing is asked of Octo before somebody is signed in: it would be refused.
  useEffect(() => {
    if (!signedIn) return
    void api.agentStatus().then((result) => {
      if (result.ok) setAgent(result.value)
    })
    void api.listProjects().then((result) => {
      if (!result.ok) return setError(result.code)
      setProjects(result.value)
      setSelectedId(result.value[0]?.id ?? null)
    })
  }, [api, signedIn])

  // Whether the project is the person's in the company system: asked once per project.
  useEffect(() => {
    setAssignment('unknown')
    if (!signedIn || selectedId === null) return
    let current = true
    void api.assignment(selectedId).then((result) => {
      if (current && result.ok) setAssignment(result.value)
    })
    return () => {
      current = false
    }
  }, [api, signedIn, selectedId])

  async function signOut() {
    setError(null)
    const result = await api.signOut()
    if (!result.ok) return setError(result.code)
    setProjects([])
    setSelectedId(null)
    setOverview(false)
    setTab('today')
    setSession(result.value)
  }

  /** Choosing a project leaves the page of all the projects. */
  function selectProject(projectId: string) {
    setOverview(false)
    setSelectedId(projectId)
  }

  // Command or Control with a number goes to the project in that place of the list.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return
      const place = Number(event.key)
      if (!Number.isInteger(place) || place < 1 || place > SHORTCUT_PROJECTS) return
      const project = projects[place - 1]
      if (!project) return
      event.preventDefault()
      setOverview(false)
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
    setOverview(false)
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

  /** Opens «Chiedi» with a question about something of the project, for the PM to send. */
  function askAbout(question: string) {
    setAskSeed(question)
    setTab('ask')
  }

  if (!signedIn) {
    return (
      <SignIn
        api={api}
        session={session}
        error={error}
        onSignedIn={(next) => {
          setError(null)
          setSession(next)
        }}
      />
    )
  }

  return (
    <div className="shell">
      <nav className="sidebar" aria-label={messages.projects}>
        <div className="brand">
          <Logo />
          <h1>{messages.brand}</h1>
          <ThemeToggle shown={theme.shown} onChoose={theme.choose} />
        </div>
        <h2>{messages.project}</h2>
        <ProjectSwitcher
          projects={projects}
          selectedId={selectedId}
          onSelect={selectProject}
          onAdd={() => openDialog('add')}
          onManage={() => openDialog('manage')}
          onOverview={() => setOverview(true)}
        />
        {selected && !overview && <SectionNav current={tab} onSelect={setTab} />}
        <div className="sidebar-foot">
          {session?.identity && (
            <p className="agent">
              {messages.session.signedInAs(session.identity.name)}{' '}
              <button type="button" className="quiet" onClick={() => void signOut()}>
                {messages.session.signOut}
              </button>
            </p>
          )}
          {agent?.available && <p className="agent">{messages.agentReady(agent.version)}</p>}
        </div>
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
        {overview ? (
          <AllProjectsView
            api={api}
            onOpen={(projectId) => {
              selectProject(projectId)
              setTab('today')
            }}
          />
        ) : selected ? (
          <>
            <header className="project-header">
              <div className="page-title">
                <h2 className="eyebrow">{selected.name}</h2>
                <h3 className="page-heading">{SECTION_LABELS[tab]}</h3>
              </div>
              <details className="folder-detail">
                <summary>{messages.shell.folder}</summary>
                <p className="folder mono">{selected.folder}</p>
              </details>
            </header>
            {assignment === 'not_assigned' && (
              <p className="warning" role="status">
                {messages.assignment.notAssigned}
              </p>
            )}
            {tab === 'today' ? (
              <TodayView
                api={api}
                project={selected}
                canJudge={agent?.available === true}
                onOpenSection={setTab}
                onOpenBugs={(filter) => {
                  setDashboardFocus({ filter, bugId: null })
                  setTab('dashboard')
                }}
                onAsk={askAbout}
                focus={todayFocus}
                onFocus={setTodayFocus}
              />
            ) : tab === 'ask' ? (
              <AskView
                api={api}
                project={selected}
                seed={askSeed}
                onSeedUsed={() => setAskSeed(null)}
                onDraft={(next) => {
                  setHandoff(next)
                  setTab('deliverables')
                }}
              />
            ) : tab === 'deliverables' ? (
              <DeliverablesView
                api={api}
                project={selected}
                handoff={handoff}
                onHandoffDone={() => setHandoff(null)}
              />
            ) : tab === 'dashboard' ? (
              <DashboardView
                api={api}
                project={selected}
                onOpenSources={() => setTab('sources')}
                onAsk={askAbout}
                focus={dashboardFocus}
                onFocus={setDashboardFocus}
              />
            ) : tab === 'hours' ? (
              <HoursView api={api} project={selected} onOpenSources={() => setTab('sources')} />
            ) : tab === 'forecast' ? (
              <ForecastView api={api} project={selected} onOpenSection={setTab} />
            ) : tab === 'progress' ? (
              <ProgressView api={api} project={selected} />
            ) : tab === 'alignment' ? (
              <AlignmentView api={api} project={selected} onOpenSection={setTab} />
            ) : (
              <ProjectSettings api={api} project={selected} />
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
