import { type CheckedAnswer, type CheckedCitation, unverifiedCount } from '@octo/domain'
import Markdown from 'react-markdown'
import remarkBreaks from 'remark-breaks'
import remarkGfm from 'remark-gfm'
import { linkMarkers, markerOfLink, sourceElementId } from './answer-text.ts'
import { citationStatusText, dateText, messages } from './messages.ts'

type Props = {
  answer: CheckedAnswer
  onOpenSource: (path: string) => void
}

/**
 * Tables, strike-through and task lists as people write them, and a line break where the text has
 * one: an email keeps its lines, an estimate its tables.
 */
const MARKDOWN_PLUGINS = [remarkGfm, remarkBreaks]

/** The answer as the model wrote it, with what the code found about each of its sources. */
export function AnswerView({ answer, onOpenSource }: Props) {
  const statusOf = new Map(answer.citations.map((citation) => [citation.n, citation.status]))
  return (
    <div className="answer">
      <Summary answer={answer} />
      <div className="answer-text">
        <Markdown
          remarkPlugins={MARKDOWN_PLUGINS}
          components={{
            a: ({ href, children }) => {
              const marker = markerOfLink(href)
              if (marker === null) return <span>{children}</span>
              const verified = statusOf.get(marker) === 'verified'
              return (
                <a
                  href={`#${sourceElementId(marker)}`}
                  className={verified ? 'marker' : 'marker marker-warning'}
                >
                  {marker}
                </a>
              )
            },
          }}
        >
          {linkMarkers(answer.text)}
        </Markdown>
      </div>
      {answer.citations.length > 0 && (
        <section aria-label={messages.sources}>
          <h3>{messages.sources}</h3>
          <ol className="sources">
            {answer.citations.map((citation) => (
              <Source key={citation.n} citation={citation} onOpen={onOpenSource} />
            ))}
          </ol>
        </section>
      )}
      {answer.markersWithoutCitation.map((marker) => (
        <p key={marker} className="warning">
          {messages.markerWithoutSource(marker)}
        </p>
      ))}
      {answer.missing.length > 0 && (
        <section aria-label={messages.missing}>
          <h3>{messages.missing}</h3>
          <ul className="missing">
            {answer.missing.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function Summary({ answer }: { answer: CheckedAnswer }) {
  const toCheck = unverifiedCount(answer)
  if (toCheck > 0) return <p className="badge badge-warning">{messages.toCheck(toCheck)}</p>
  if (answer.citations.length === 0) return <p className="badge">{messages.noSources}</p>
  return <p className="badge badge-ok">{messages.allVerified(answer.citations.length)}</p>
}

function Source({
  citation,
  onOpen,
}: {
  citation: CheckedCitation
  onOpen: (path: string) => void
}) {
  const verified = citation.status === 'verified'
  return (
    <li id={sourceElementId(citation.n)} value={citation.n}>
      <button
        type="button"
        className="source-path"
        title={messages.openSource}
        onClick={() => onOpen(citation.path)}
      >
        {citation.path}
      </button>
      <span className={verified ? 'status status-ok' : 'status status-warning'}>
        {citationStatusText(citation.status)}
      </span>
      {citation.modifiedAt && (
        <span className="source-date">
          {messages.modified} {dateText(citation.modifiedAt)}
        </span>
      )}
      <blockquote>{citation.quote}</blockquote>
    </li>
  )
}
