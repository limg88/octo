import { FEED_NAMES, type FeedName, type Project } from '@octo/domain'
import { useEffect, useState } from 'react'
import type { OctoApi } from '../shared/api.ts'
import { DocumentsSection } from './DocumentsSection.tsx'
import { FeedSection } from './FeedSection.tsx'
import { MeetingsSection } from './MeetingsSection.tsx'
import { ModelsSection } from './ModelsSection.tsx'
import { messages } from './messages.ts'
import { SetupGuide } from './SetupGuide.tsx'
import { SourcesView } from './SourcesView.tsx'
import { TeamSection } from './TeamSection.tsx'

type Props = { api: OctoApi; project: Project }

const PARTS = ['links', 'team', 'advanced'] as const
type Part = (typeof PARTS)[number]
/** Where the arrow keys go from a part: the one before or after it, round the row. */
const PART_STEPS: Readonly<Record<string, number>> = { ArrowRight: 1, ArrowLeft: -1 }
/** The source whose settings are open: one at a time, so the list stays a list. */
type Source = 'mail' | 'meetings' | FeedName

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
            id={`settings-part-${candidate}`}
            aria-selected={part === candidate}
            tabIndex={part === candidate ? 0 : -1}
            className={part === candidate ? 'tab tab-selected' : 'tab'}
            onClick={() => setPart(candidate)}
            onKeyDown={(event) => {
              const step = PART_STEPS[event.key]
              if (step === undefined) return
              event.preventDefault()
              const next = PARTS[(PARTS.indexOf(candidate) + step + PARTS.length) % PARTS.length]
              if (next === undefined) return
              setPart(next)
              document.getElementById(`settings-part-${next}`)?.focus()
            }}
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
          <MeetingsSection
            api={api}
            project={project}
            open={open === 'meetings'}
            onToggle={toggle('meetings')}
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
