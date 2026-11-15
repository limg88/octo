import { type CheckedAnswer, unverifiedCount } from '@octo/domain'
import { type ReactNode, useState } from 'react'
import Markdown from 'react-markdown'
import remarkBreaks from 'remark-breaks'
import remarkGfm from 'remark-gfm'
import { linkMarkers, markerOfLink, sourceElementId, sourceTitle } from './answer-text.ts'
import { CitationPanel, type OpenSource } from './CitationPanel.tsx'
import { citationStatusText, messages } from './messages.ts'

type Props = {
  answer: CheckedAnswer
  onOpenSource: OpenSource
  /** What can be done with the answer as a whole, shown under its text. */
  actions?: ReactNode
  /** What stands beside the text, above the source in view: the review of a draft. */
  side?: ReactNode
}

/**
 * Tables, strike-through and task lists as people write them, and a line break where the text has
 * one: an email keeps its lines, an estimate its tables.
 */
const MARKDOWN_PLUGINS = [remarkGfm, remarkBreaks]

/**
 * The answer as the model wrote it, with what the code found about each of its sources. A marker
 * shows its source beside the text, so the answer is never left to read where it comes from.
 */
export function AnswerView({ answer, onOpenSource, actions, side }: Props) {
  const [selected, setSelected] = useState<number | null>(answer.citations[0]?.n ?? null)
  const statusOf = new Map(answer.citations.map((citation) => [citation.n, citation.status]))
  return (
    <div className="answer split">
      <div className="answer-main">
        <Summary answer={answer} />
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
        {answer.markersWithoutCitation.map((marker) => (
          <p key={marker} className="warning">
            {messages.citation.orphan(marker)}
          </p>
        ))}
        {answer.missing.length > 0 && (
          <section className="box box-warning" aria-label={messages.missing}>
            <h3>{messages.missingTitle}</h3>
            <ul className="missing">
              {answer.missing.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>
        )}
        {actions && <div className="actions">{actions}</div>}
        {answer.citations.length > 0 && (
          <section aria-label={messages.sources}>
            <h3>
              {messages.sources} · {answer.citations.length}
            </h3>
            <ol className="sources">
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
                    <span className="status status-warning">
                      {citationStatusText(citation.status)}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>
      <div className="answer-side">
        {side}
        <CitationPanel
          citations={answer.citations}
          selected={selected}
          onSelect={setSelected}
          onOpen={onOpenSource}
        />
      </div>
    </div>
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
