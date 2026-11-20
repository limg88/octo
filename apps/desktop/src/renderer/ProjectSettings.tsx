import { FEED_NAMES, type FeedName, type Project } from '@octo/domain'
import { useEffect, useState } from 'react'
import type { OctoApi } from '../shared/api.ts'
import { DocumentsSection } from './DocumentsSection.tsx'
import { FeedSection } from './FeedSection.tsx'
import { GlossarySection } from './GlossarySection.tsx'
import { MeetingsSection } from './MeetingsSection.tsx'
import { DECK_MODEL_TEXT, LETTERHEAD_TEXT, ModelFile } from './ModelFile.tsx'
import { ModelsSection } from './ModelsSection.tsx'
import { messages } from './messages.ts'
import { SetupGuide } from './SetupGuide.tsx'
import { SourcesView } from './SourcesView.tsx'
import { TeamSection } from './TeamSection.tsx'
import { TodaySettings } from './TodaySettings.tsx'

type Props = {
  api: OctoApi
  project: Project
  /** The part to open on, when the PM comes from a page that has its settings here. */
  part?: SettingsPart | null
}

export const SETTINGS_PARTS = ['links', 'team', 'today', 'deliverables', 'advanced'] as const
export type SettingsPart = (typeof SETTINGS_PARTS)[number]
/** Where the arrow keys go from a part: the one before or after it, round the row. */
const PART_STEPS: Readonly<Record<string, number>> = { ArrowRight: 1, ArrowLeft: -1 }
/** The source whose settings are open: one at a time, so the list stays a list. */
type Source = 'mail' | 'meetings' | FeedName

/** What is set once for a project: what feeds it, who works on it, and the rest. */
export function ProjectSettings({ api, project, part: asked = null }: Props) {
  const [part, setPart] = useState<SettingsPart>(asked ?? 'links')
  const [open, setOpen] = useState<Source | null>(null)
  // biome-ignore lint/correctness/useExhaustiveDependencies: another project starts from the list, folded.
  useEffect(() => {
    setPart(asked ?? 'links')
    setOpen(null)
  }, [project.id, asked])

  const toggle = (source: Source) => () =>
    setOpen((current) => (current === source ? null : source))

  return (
    <div className="sources-page">
      <div className="subtabs" role="tablist" aria-label={messages.settingsParts.title}>
        {SETTINGS_PARTS.map((candidate) => (
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
              const next =
                SETTINGS_PARTS[
                  (SETTINGS_PARTS.indexOf(candidate) + step + SETTINGS_PARTS.length) %
                    SETTINGS_PARTS.length
                ]
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
          <div className="panel source-list">
            <div className="source-header source-list-head" aria-hidden="true">
              <span>{messages.credential.source}</span>
              <span>{messages.credential.state}</span>
              <span>{messages.credential.title}</span>
              <span />
            </div>
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
          </div>
          {/* What a value of a column means, said once under the list. */}
          <dl className="source-notes">
            <div>
              <dt>{messages.credential.sharedTitle}</dt>
              <dd>{messages.credential.sharedNote}</dd>
            </div>
            <div>
              <dt>{messages.documentsTitle}.</dt>
              <dd>{messages.documentsIntro}</dd>
            </div>
          </dl>
        </>
      )}
      {part === 'team' && (
        <>
          <TeamSection api={api} project={project} />
          <GlossarySection api={api} project={project} />
        </>
      )}
      {part === 'today' && <TodaySettings api={api} project={project} />}
      {part === 'deliverables' && (
        <section className="source" aria-label={messages.deliverableSettings.title}>
          <div>
            <h3>{messages.settingsParts.deliverables}</h3>
            <p className="hint">{messages.deliverableSettings.intro}</p>
          </div>
          <div className="model-files">
            <ModelFile
              key={`letterhead-${project.id}`}
              text={LETTERHEAD_TEXT}
              has={() => api.hasLetterhead(project.id)}
              choose={() => api.chooseLetterhead(project.id)}
              remove={() => api.removeLetterhead(project.id)}
            />
            <ModelFile
              key={`deck-${project.id}`}
              onlyWhenSet
              text={{ ...DECK_MODEL_TEXT, hint: messages.deckModelLegacyHint }}
              has={() => api.hasDeckModel(project.id)}
              choose={() => api.chooseDeckModel(project.id)}
              remove={() => api.removeDeckModel(project.id)}
            />
          </div>
        </section>
      )}
      {part === 'advanced' && <ModelsSection api={api} project={project} />}
    </div>
  )
}
