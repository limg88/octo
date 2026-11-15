import { FEED_NAMES, type FeedName, type Project } from '@octo/domain'
import { useEffect, useState } from 'react'
import type { OctoApi } from '../shared/api.ts'
import { DocumentsSection } from './DocumentsSection.tsx'
import { FeedSection } from './FeedSection.tsx'
import { ModelsSection } from './ModelsSection.tsx'
import { messages } from './messages.ts'
import { SetupGuide } from './SetupGuide.tsx'
import { SourcesView } from './SourcesView.tsx'
import { TeamSection } from './TeamSection.tsx'

type Props = { api: OctoApi; project: Project }

const PARTS = ['links', 'team', 'advanced'] as const
type Part = (typeof PARTS)[number]
/** The source whose settings are open: one at a time, so the list stays a list. */
type Source = 'mail' | FeedName

/** What is set once for a project: what feeds it, who works on it, and the rest. */
export function ProjectSettings({ api, project }: Props) {
  const [part, setPart] = useState<Part>('links')
  const [open, setOpen] = useState<Source | null>(null)
  // biome-ignore lint/correctness/useExhaustiveDependencies: another project starts from the list, folded.
  useEffect(() => {
    setPart('links')
    setOpen(null)
  }, [project.id])

  const toggle = (source: Source) => () =>
    setOpen((current) => (current === source ? null : source))

  return (
    <div className="sources-page">
      <div className="subtabs" role="tablist" aria-label={messages.settingsParts.title}>
        {PARTS.map((candidate) => (
          <button
            key={candidate}
            type="button"
            role="tab"
            aria-selected={part === candidate}
            className={part === candidate ? 'tab tab-selected' : 'tab'}
            onClick={() => setPart(candidate)}
          >
            {messages.settingsParts[candidate]}
          </button>
        ))}
      </div>
      {part === 'links' && (
        <>
          <SetupGuide api={api} project={project} />
          <SourcesView
            api={api}
            project={project}
            open={open === 'mail'}
            onToggle={toggle('mail')}
          />
          {FEED_NAMES.map((feed) => (
            <FeedSection
              key={feed}
              api={api}
              project={project}
              feed={feed}
              open={open === feed}
              onToggle={toggle(feed)}
            />
          ))}
          <DocumentsSection api={api} project={project} />
        </>
      )}
      {part === 'team' && <TeamSection api={api} project={project} />}
      {part === 'advanced' && <ModelsSection api={api} project={project} />}
    </div>
  )
}
