import type { Glossary, GlossaryEntry, Project } from '@octo/domain'
import { useEffect, useState } from 'react'
import type { ErrorCode, OctoApi } from '../shared/api.ts'
import { errorText, messages } from './messages.ts'
import { blankRow, orOneRow, type Row, type RowsColumn, RowsField } from './RowsField.tsx'
import { useSavedNote } from './SavedNote.tsx'
import { BusyButton } from './Spinner.tsx'

type Props = {
  api: Pick<OctoApi, 'glossary' | 'saveGlossary' | 'proposeGlossary'>
  project: Project
}

const text = messages.glossary
type PairKey = keyof GlossaryEntry
const COLUMNS: RowsColumn<PairKey>[] = [
  { key: 'heard', label: text.heard },
  { key: 'right', label: text.right },
]
const rowsOf = (entries: readonly GlossaryEntry[]): Row<PairKey>[] =>
  orOneRow([...entries], COLUMNS)

/**
 * The words the transcripts of the project hear badly, each with its right form. The PM writes
 * the pairs or approves those Claude proposes; they are put right in the transcripts that enter
 * and told to who writes.
 */
export function GlossarySection({ api, project }: Props) {
  const [rows, setRows] = useState<Row<PairKey>[]>([])
  const [proposed, setProposed] = useState<GlossaryEntry[]>([])
  const [error, setError] = useState<ErrorCode | null>(null)
  const [asking, setAsking] = useState(false)
  const savedNote = useSavedNote()

  const show = (glossary: Glossary) => {
    setRows(rowsOf(glossary.entries))
    setProposed(glossary.proposed)
  }
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new project starts from its own glossary.
  useEffect(() => {
    setError(null)
    void api.glossary(project.id).then((result) => {
      if (result.ok) show(result.value)
      else setError(result.code)
    })
  }, [api, project.id])

  /** Keeps the pairs as they are now; `left` are the proposals still to decide. */
  async function save(entries: readonly GlossaryEntry[], left: readonly GlossaryEntry[]) {
    setError(null)
    const result = await api.saveGlossary(project.id, {
      entries: [...entries],
      proposed: [...left],
    })
    if (!result.ok) return setError(result.code)
    show(result.value)
    savedNote.saved()
  }
  const typed = (): GlossaryEntry[] => rows.filter((row) => !blankRow(row))
  const without = (pair: GlossaryEntry): GlossaryEntry[] =>
    proposed.filter((other) => other.heard !== pair.heard)

  async function propose() {
    setAsking(true)
    setError(null)
    const result = await api.proposeGlossary(project.id)
    setAsking(false)
    if (result.ok) show(result.value)
    else setError(result.code)
  }

  return (
    <section className="source" aria-label={text.title}>
      <h3>{text.title}</h3>
      <p className="hint">{text.intro}</p>
      {error && (
        <p className="warning" role="alert">
          {errorText(error)}
        </p>
      )}
      <RowsField
        label={text.title}
        columns={COLUMNS}
        rows={rows}
        onChange={setRows}
        addLabel={text.add}
        cellLabel={(column, row) => text.cell(text[column], row)}
        removeLabel={text.remove}
      />
      <div className="actions">
        <button type="button" className="primary" onClick={() => void save(typed(), proposed)}>
          {text.save}
        </button>
        <BusyButton busy={asking} busyLabel={text.asking} onClick={() => void propose()}>
          {text.propose}
        </BusyButton>
        {savedNote.note}
      </div>
      {proposed.length > 0 && (
        <ul className="today-muted" aria-label={text.proposed}>
          {proposed.map((pair) => (
            <li key={pair.heard}>
              <span>{text.pair(pair.heard, pair.right)}</span>
              <button
                type="button"
                className="quiet"
                aria-label={text.acceptOf(pair.heard)}
                onClick={() => void save([...typed(), pair], without(pair))}
              >
                {text.accept}
              </button>
              <button
                type="button"
                className="quiet"
                aria-label={text.dismissOf(pair.heard)}
                onClick={() => void save(typed(), without(pair))}
              >
                {text.dismiss}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
