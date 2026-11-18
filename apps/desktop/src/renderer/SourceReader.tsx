import { useEffect, useRef, useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { OctoApi } from '../shared/api.ts'
import { Dialog } from './Dialog.tsx'
import { messages } from './messages.ts'
import { Waiting } from './Spinner.tsx'
import { quotedBlock, sourceBlocks } from './source-text.ts'

const text = messages.reader
const PLUGINS = [remarkGfm]

/** A source asked to be read: the file, and the sentence quoted from it when there is one. */
export type SourceAsked = { projectId: string; path: string; quote: string | null }

type Props = {
  api: Pick<OctoApi, 'readEvidence' | 'openEvidence'>
  source: SourceAsked
  onClose: () => void
}

/**
 * A source of the project read inside Octo: the file laid out, opened on the sentence that was
 * quoted, which is marked. The original is still one click away, with the program of the system.
 */
export function SourceReader({ api, source, onClose }: Props) {
  const [content, setContent] = useState<string | null | undefined>(undefined)
  const quoted = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let current = true
    setContent(undefined)
    void api.readEvidence(source.projectId, source.path).then((result) => {
      if (current) setContent(result.ok ? result.value : null)
    })
    return () => {
      current = false
    }
  }, [api, source.projectId, source.path])

  const blocks = content ? sourceBlocks(content) : []
  const at = source.quote === null ? -1 : quotedBlock(blocks, source.quote)
  // biome-ignore lint/correctness/useExhaustiveDependencies: the sentence is brought in view when the text arrives.
  useEffect(() => {
    quoted.current?.scrollIntoView?.({ block: 'center' })
  }, [content, at])

  return (
    <Dialog title={source.path} wide onClose={onClose}>
      <div className="actions">
        <button type="button" onClick={() => void api.openEvidence(source.projectId, source.path)}>
          {text.openWithSystem}
        </button>
        {content && source.quote !== null && at < 0 && (
          <span className="hint" role="status">
            {text.quoteNotFound}
          </span>
        )}
      </div>
      {content === undefined && <Waiting>{text.loading}</Waiting>}
      {content === null && (
        <p className="warning" role="alert">
          {text.unreadable}
        </p>
      )}
      <article className="source-reader" aria-label={text.content}>
        {blocks.map((block, index) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: the blocks of a file never change place.
            key={index}
            ref={index === at ? quoted : undefined}
            className={index === at ? 'source-quoted' : undefined}
          >
            {block.kind === 'header' ? (
              <pre className="hint">{block.text}</pre>
            ) : (
              <Markdown remarkPlugins={PLUGINS}>{block.text}</Markdown>
            )}
          </div>
        ))}
      </article>
    </Dialog>
  )
}
