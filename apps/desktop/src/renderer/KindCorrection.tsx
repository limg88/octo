import type { KindCorrection as Correction } from '@octo/application'
import type { DeliverableKind, Project } from '@octo/domain'
import { useEffect, useState } from 'react'
import type { ErrorCode, OctoApi, Result } from '../shared/api.ts'
import { errorText, messages } from './messages.ts'
import { BusyButton } from './Spinner.tsx'

export type KindCorrectionApi = Pick<
  OctoApi,
  'correctKind' | 'approveKindCorrection' | 'restoreKind'
>

type Props = {
  api: KindCorrectionApi
  project: Project
  kind: DeliverableKind
  /** The kind changed in the project: who shows the catalog reads it again. */
  onChanged: () => void
}

const text = messages.kindCorrection

/**
 * How a kind of Octo is written, corrected in words: Claude writes the instructions again, the
 * PM reads them whole and only then they are kept, for this project. The way back is one press.
 */
export function KindCorrection({ api, project, kind, onChanged }: Props) {
  const [words, setWords] = useState('')
  const [busy, setBusy] = useState(false)
  const [proposal, setProposal] = useState<Correction | null>(null)
  const [done, setDone] = useState<string | null>(null)
  const [error, setError] = useState<ErrorCode | null>(null)

  // biome-ignore lint/correctness/useExhaustiveDependencies: another kind or project starts clean.
  useEffect(() => {
    setWords('')
    setProposal(null)
    setDone(null)
    setError(null)
  }, [project.id, kind.id])

  async function ask() {
    setBusy(true)
    setError(null)
    setDone(null)
    const result = await api.correctKind(project.id, kind.id, words)
    setBusy(false)
    if (result.ok) setProposal(result.value)
    else setError(result.code)
  }

  async function settle(step: Promise<Result<null>>, said: string) {
    setError(null)
    const result = await step
    if (!result.ok) return setError(result.code)
    setProposal(null)
    setWords('')
    setDone(said)
    onChanged()
  }

  return (
    <details className="project-instructions">
      <summary>{text.title}</summary>
      <p className="hint">{text.intro}</p>
      {kind.corrected && (
        <p className="hint">
          {text.corrected}{' '}
          <button
            type="button"
            className="quiet"
            onClick={() => void settle(api.restoreKind(project.id, kind.id), text.restored)}
          >
            {text.restore}
          </button>
        </p>
      )}
      <details>
        <summary>{text.now}</summary>
        <pre className="scripted-file">{kind.instructions}</pre>
      </details>
      <textarea
        aria-label={text.words}
        placeholder={text.words}
        rows={3}
        value={words}
        onChange={(event) => setWords(event.target.value)}
      />
      <div className="actions">
        <BusyButton
          type="button"
          busy={busy}
          busyLabel={text.asking}
          disabled={words.trim() === ''}
          onClick={() => void ask()}
        >
          {text.ask}
        </BusyButton>
      </div>
      {proposal && (
        <section aria-label={text.proposed}>
          <h4>{text.proposed}</h4>
          <p>{proposal.summary}</p>
          <pre className="scripted-file">{proposal.instructions}</pre>
          <div className="actions">
            <button
              type="button"
              className="primary"
              onClick={() =>
                void settle(
                  api.approveKindCorrection(project.id, kind.id, proposal.id),
                  text.approved,
                )
              }
            >
              {text.approve}
            </button>
            <button type="button" className="quiet" onClick={() => setProposal(null)}>
              {text.discard}
            </button>
          </div>
        </section>
      )}
      {done && <p className="hint">{done}</p>}
      {error && <p className="warning">{errorText(error)}</p>}
    </details>
  )
}
