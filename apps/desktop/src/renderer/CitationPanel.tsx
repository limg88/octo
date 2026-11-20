import type { CheckedCitation } from '@octo/domain'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import type { Result } from '../shared/api.ts'
import { provenanceOf, sourceTitle } from './answer-text.ts'
import { citationStatusText, dateText, messages } from './messages.ts'
import { BusyButton } from './Spinner.tsx'

const text = messages.citation

/** Hands the original to the system; says whether it could. */
export type OpenSource = (path: string, quote?: string) => Promise<Result<null>>

type Props = {
  citations: readonly CheckedCitation[]
  /** The marker of the citation in view; null when none was chosen. */
  selected: number | null
  onSelect: (marker: number) => void
  onOpen: OpenSource
  /** Which answer the citation in view is of, where the panel stands for more than one. */
  note?: ReactNode
}

/** A file that is not there, or not of the project, cannot be handed to the system. */
const CANNOT_OPEN: ReadonlySet<CheckedCitation['status']> = new Set([
  'file_not_found',
  'outside_project',
])

function provenanceText(path: string): string {
  const from = provenanceOf(path)
  return from.kind === 'feed' ? text.provenance.feed(from.name) : text.provenance[from.kind]
}

/**
 * The source of one citation, beside the answer that cites it: what the file is, where it comes
 * from, the sentence quoted and what the check found. The answer stays in view.
 */
export function CitationPanel({ citations, selected, onSelect, onOpen, note }: Props) {
  const [opening, setOpening] = useState(false)
  const [failed, setFailed] = useState(false)
  /** The latest opening asked: an older one that ends later says nothing here. */
  const asked = useRef(0)
  const at = citations.findIndex((citation) => citation.n === selected)
  const citation = citations[at]

  // biome-ignore lint/correctness/useExhaustiveDependencies: another source in view starts clean; what was asked for the one before is no longer told.
  useEffect(() => {
    asked.current += 1
    setOpening(false)
    setFailed(false)
  }, [selected])
  useEffect(
    () => () => {
      asked.current += 1
    },
    [],
  )

  async function open(path: string, quote: string) {
    asked.current += 1
    const mine = asked.current
    setOpening(true)
    setFailed(false)
    const result = await onOpen(path, quote)
    if (mine !== asked.current) return
    setOpening(false)
    setFailed(!result.ok)
  }

  if (citations.length === 0) {
    return (
      <aside className="panel citation-panel" aria-label={text.panel}>
        <div className="panel-head">
          <h4>{text.panel}</h4>
        </div>
        <p className="box box-warning panel-body">{text.noSources}</p>
      </aside>
    )
  }
  if (!citation) {
    return (
      <aside className="panel citation-panel" aria-label={text.panel}>
        <div className="panel-head">
          <h4>{text.panel}</h4>
        </div>
        <p className="hint panel-body">{text.none}</p>
      </aside>
    )
  }

  const verified = citation.status === 'verified'
  const others = citations
    .filter((other) => other.path === citation.path && other.n !== citation.n)
    .map((other) => `[${other.n}]`)
  const step = (by: number) => {
    const next = citations[(at + by + citations.length) % citations.length]
    if (next) onSelect(next.n)
  }

  return (
    <aside className="panel citation-panel" aria-label={text.panel}>
      <div className="panel-head">
        <h4>{text.panel}</h4>
        <span className="panel-steps">
          <button
            type="button"
            className="quiet step"
            aria-label={text.previous}
            title={text.previous}
            disabled={citations.length < 2}
            onClick={() => step(-1)}
          >
            ‹
          </button>
          <span className="mono">{messages.detail.position(at + 1, citations.length)}</span>
          <button
            type="button"
            className="quiet step"
            aria-label={text.next}
            title={text.next}
            disabled={citations.length < 2}
            onClick={() => step(1)}
          >
            ›
          </button>
        </span>
      </div>
      <div className="panel-body" aria-live="polite" aria-busy={opening || undefined}>
        {note}
        <p>
          <span className="pill pill-source">
            {provenanceText(citation.path)} ·{' '}
            {citation.modifiedAt ? dateText(citation.modifiedAt) : text.undated}
          </span>
        </p>
        <h4 className="detail-title">
          <span className="mono">[{citation.n}]</span> {sourceTitle(citation.path)}
        </h4>
        <blockquote className="box box-source quote">«{citation.quote}»</blockquote>
        <p>
          <span className={verified ? 'badge badge-ok' : 'badge badge-warning'}>
            {citationStatusText(citation.status)}
          </span>
        </p>
        <p className="hint">{verified ? text.foundNote : text.notFoundNote}</p>
        {others.length > 0 && <p className="hint">{text.sameFile(others.join(', '))}</p>}
        <div className="title-row citation-open">
          <details className="path-detail">
            <summary>{text.path}</summary>
            <p className="mono folder-path">{citation.path}</p>
          </details>
          <BusyButton
            busy={opening}
            busyLabel={messages.wait.opening}
            disabled={CANNOT_OPEN.has(citation.status)}
            onClick={() => void open(citation.path, citation.quote)}
          >
            {text.open}
          </BusyButton>
        </div>
        {opening && (
          <span className="visually-hidden" role="status">
            {text.opening}
          </span>
        )}
        {failed && (
          <p className="warning" role="alert">
            {text.openFailed}{' '}
            <button
              type="button"
              className="quiet"
              onClick={() => void open(citation.path, citation.quote)}
            >
              {messages.wait.retry}
            </button>
          </p>
        )}
      </div>
    </aside>
  )
}
