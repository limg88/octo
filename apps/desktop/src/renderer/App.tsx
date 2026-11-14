import type { AgentStatus } from '@octo/application'
import type { Project } from '@octo/domain'
import { useEffect, useState } from 'react'
import type { ErrorCode, OctoApi } from '../shared/api.ts'
import { AskView } from './AskView.tsx'
import { errorText, messages } from './messages.ts'
import { SourcesView } from './SourcesView.tsx'

type Tab = 'ask' | 'sources'

type Props = {
  api: OctoApi
}

export function App({ api }: Props) {
  const [projects, setProjects] = useState<Project[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [agent, setAgent] = useState<AgentStatus | null>(null)
  const [error, setError] = useState<ErrorCode | null>(null)
  const [tab, setTab] = useState<Tab>('ask')

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

  async function addProject() {
    setError(null)
    const result = await api.addProject()
    if (!result.ok) return setError(result.code)
    const added = result.value
    if (added === null) return
    setProjects((previous) => [...previous, added])
    setSelectedId(added.id)
  }

  async function removeProject(project: Project) {
    const result = await api.removeProject(project.id)
    if (!result.ok) return setError(result.code)
    const remaining = projects.filter((candidate) => candidate.id !== project.id)
    setProjects(remaining)
    setSelectedId(remaining[0]?.id ?? null)
  }

  const selected = projects.find((project) => project.id === selectedId) ?? null

  return (
    <div className="shell">
      <nav className="sidebar" aria-label={messages.projects}>
        <h1>{messages.appName}</h1>
        <h2>{messages.projects}</h2>
        <ul>
          {projects.map((project) => (
            <li key={project.id}>
              <button
                type="button"
                className={project.id === selectedId ? 'project project-selected' : 'project'}
                aria-current={project.id === selectedId}
                title={project.folder}
                onClick={() => setSelectedId(project.id)}
              >
                {project.name}
              </button>
            </li>
          ))}
        </ul>
        <button type="button" className="add-project" onClick={() => void addProject()}>
          {messages.addProject}
        </button>
        {agent?.available && <p className="agent">{messages.agentReady(agent.version)}</p>}
      </nav>
      <main>
        {error && (
          <p className="warning" role="alert">
            {errorText(error)}
          </p>
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
              <button
                type="button"
                className="quiet"
                title={messages.removeProjectHint}
                onClick={() => void removeProject(selected)}
              >
                {messages.removeProject}
              </button>
            </header>
            <div className="tabs" role="tablist">
              <TabButton current={tab} tab="ask" label={messages.ask} onSelect={setTab} />
              <TabButton
                current={tab}
                tab="sources"
                label={messages.sourcesTab}
                onSelect={setTab}
              />
            </div>
            {tab === 'ask' ? (
              <AskView api={api} project={selected} />
            ) : (
              <SourcesView api={api} project={selected} />
            )}
          </>
        ) : (
          <div className="notice">
            <h2>{messages.noProjectTitle}</h2>
            <p>{messages.noProjectBody}</p>
          </div>
        )}
      </main>
    </div>
  )
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
