import { type CheckedAnswer, unverifiedCount } from '@octo/domain'
import { type ReactNode, useState } from 'react'
import Markdown from 'react-markdown'
import remarkBreaks from 'remark-breaks'
import remarkGfm from 'remark-gfm'
import { linkMarkers, markerOfLink, sourceElementId, sourceTitle } from './answer-text.ts'
import { CitationPanel, type OpenSource } from './CitationPanel.tsx'
import { ComputedTables } from './ComputedTables.tsx'
import { citationStatusText, messages } from './messages.ts'

type Props = {
  answer: CheckedAnswer
  onOpenSource: OpenSource
  /** What can be done with the answer as a whole, shown under its text. */
  actions?: ReactNode
  /** What stands beside the text, above the source in view: the review of a draft. */
  side?: ReactNode
  /** True when what the code found is told beside the text, by `AnswerChecks`, and not above it. */
  checksAside?: boolean
  /**
   * The citation in view when one panel stands for several answers: the answer then shows no
   * source beside itself, and says which of its markers was chosen.
   */
  cited?: { selected: number | null; onSelect: (marker: number) => void }
}

/**
 * Tables, strike-through and task lists as people write them, and a line break where the text has
 * one: an email keeps its lines, an estimate its tables.
 */
const MARKDOWN_PLUGINS = [remarkGfm, remarkBreaks]

/** A list of sources longer than this opens on request: its markers in the text still work. */
export const SOURCES_SHOWN = 8

/**
 * The answer as the model wrote it, with what the code found about each of its sources. A marker
 * shows its source beside the text, so the answer is never left to read where it comes from.
 */
export function AnswerView({ answer, onOpenSource, actions, side, checksAside, cited }: Props) {
  const [own, setOwn] = useState<number | null>(answer.citations[0]?.n ?? null)
  const selected = cited ? cited.selected : own
  const setSelected = cited ? cited.onSelect : setOwn
  const statusOf = new Map(answer.citations.map((citation) => [citation.n, citation.status]))
  const sourcesTitle = `${messages.sources} · ${answer.citations.length}`
  const sources = (
    <ol className="sources sources-inline">
      {answer.citations.map((citation) => (
        <li key={citation.n} id={sourceElementId(citation.n)} value={citation.n}>
          <button
            type="button"
            className="source-path"
            title={citation.path}
            aria-pressed={selected === citation.n}
            onClick={() => setSelected(citation.n)}
          >
            {sourceTitle(citation.path)}
          </button>
          {citation.status !== 'verified' && (
            <span className="status status-warning">{citationStatusText(citation.status)}</span>
          )}
        </li>
      ))}
    </ol>
  )
  const folded = answer.citations.length > SOURCES_SHOWN
  return (
    <div className={cited ? 'answer' : 'answer split'}>
      <div className="answer-main">
        {!checksAside && <Summary answer={answer} />}
        <div className="answer-text">
          <Markdown
            remarkPlugins={MARKDOWN_PLUGINS}
            components={{
              a: ({ href, children }) => {
                const marker = markerOfLink(href)
                if (marker === null) return <span>{children}</span>
                const status = statusOf.get(marker)
                if (status === undefined) {
                  return (
                    <span
                      className="marker marker-warning"
                      title={messages.citation.markerMissing(marker)}
                    >
                      {marker}
                    </span>
                  )
                }
                return (
                  <button
                    type="button"
                    className={status === 'verified' ? 'marker' : 'marker marker-warning'}
                    aria-label={messages.citation.marker(marker)}
                    aria-pressed={selected === marker}
                    onClick={() => setSelected(marker)}
                  >
                    {marker}
                  </button>
                )
              },
              // A wide table scrolls inside its own frame, never the page.
              table: ({ children }) => (
                <div className="table-scroll">
                  <table>{children}</table>
                </div>
              ),
            }}
          >
            {linkMarkers(answer.text)}
          </Markdown>
        </div>
        {answer.tables && <ComputedTables tables={answer.tables} onOpenSource={onOpenSource} />}
        {answer.markersWithoutCitation.map((marker) => (
          <p key={marker} className="warning">
            {messages.citation.orphan(marker)}
          </p>
        ))}
        {!checksAside && <Missing answer={answer} boxed />}
        {/* The sources and what can be done with the answer, on one row under its text. */}
        {(answer.citations.length > 0 || actions) && (
          <div className="sources-row">
            {answer.citations.length > 0 && (
              <section className="sources-part" aria-label={messages.sources}>
                {folded ? (
                  <details className="sources-fold">
                    <summary>{sourcesTitle}</summary>
                    {sources}
                  </details>
                ) : (
                  <>
                    <h3>{sourcesTitle}</h3>
                    {sources}
                  </>
                )}
              </section>
            )}
            {actions && <div className="actions sources-actions">{actions}</div>}
          </div>
        )}
      </div>
      {!cited && (
        <div className="answer-side">
          {side}
          <CitationPanel
            citations={answer.citations}
            selected={selected}
            onSelect={setSelected}
            onOpen={onOpenSource}
          />
        </div>
      )}
    </div>
  )
}

/** What the answer says it did not find in the sources: to be confirmed by who reads. */
function Missing({ answer, boxed }: { answer: CheckedAnswer; boxed?: boolean }) {
  if (answer.missing.length === 0) return null
  return (
    <section className={boxed ? 'box box-warning' : 'missing-aside'} aria-label={messages.missing}>
      <h3>{messages.missingTitle}</h3>
      <ul className="missing">
        {answer.missing.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  )
}

/** What the code found of an answer, to stand beside it: the counts, then what is missing. */
export function AnswerChecks({ answer }: { answer: CheckedAnswer }) {
  return (
    <>
      <Summary answer={answer} />
      <Missing answer={answer} />
    </>
  )
}

function Summary({ answer }: { answer: CheckedAnswer }) {
  const toCheck = unverifiedCount(answer)
  return (
    <p className="answer-summary">
      {toCheck > 0 ? (
        <span className="badge badge-warning">{messages.toCheck(toCheck)}</span>
      ) : answer.citations.length === 0 ? (
        <span className="badge">{messages.noSources}</span>
      ) : (
        <span className="badge badge-ok">{messages.allVerified(answer.citations.length)}</span>
      )}
      {answer.missing.length > 0 && (
        <span className="badge badge-warning">{messages.missingCount(answer.missing.length)}</span>
      )}
    </p>
  )
}
