import { useEffect, useState } from 'react'
import type { ErrorCode, Result } from '../shared/api.ts'
import { errorText, messages } from './messages.ts'

export type ModelText = { title: string; none: string; set: string; hint: string; choose: string }
export const LETTERHEAD_TEXT: ModelText = {
  title: messages.letterheadTitle,
  none: messages.letterheadNone,
  set: messages.letterheadSet,
  hint: messages.letterheadHint,
  choose: messages.letterheadChoose,
}
export const DECK_MODEL_TEXT: ModelText = {
  title: messages.deckModelTitle,
  none: messages.deckModelNone,
  set: messages.deckModelSet,
  hint: messages.deckModelHint,
  choose: messages.deckModelChoose,
}

/** A file of the PM the deliverables of the project are written on, chosen once. */
export function ModelFile({
  text,
  has,
  choose,
  remove,
  onlyWhenSet = false,
}: {
  /** Shown only while there is a file: one of before, that can be kept or taken away. */
  onlyWhenSet?: boolean
  text: ModelText
  has: () => Promise<Result<boolean>>
  choose: () => Promise<Result<unknown>>
  remove: () => Promise<Result<unknown>>
}) {
  const [present, setPresent] = useState<boolean | null>(null)
  const [error, setError] = useState<ErrorCode | null>(null)

  // biome-ignore lint/correctness/useExhaustiveDependencies: the readers are made anew at each render; the file is read once.
  useEffect(() => {
    void has().then((result) => {
      if (result.ok) setPresent(result.value)
    })
  }, [])

  async function change(step: () => Promise<Result<unknown>>) {
    setError(null)
    const result = await step()
    if (!result.ok) setError(result.code)
    const now = await has()
    if (now.ok) setPresent(now.value)
  }

  if (present === null || (onlyWhenSet && !present)) return null
  return (
    <>
      <section className="list-row model-file" aria-label={text.title}>
        <h4>{text.title}</h4>
        <span className={present ? 'status status-ok' : 'status'}>
          {present ? text.set : text.none}
        </span>
        <span className="command-row-gap" />
        {!onlyWhenSet && (
          <button type="button" onClick={() => void change(choose)}>
            {text.choose}
          </button>
        )}
        {present && (
          <button type="button" className="quiet" onClick={() => void change(remove)}>
            {messages.letterheadRemove}
          </button>
        )}
      </section>
      {error && (
        <p className="warning model-note" role="alert">
          {errorText(error)}
        </p>
      )}
      <p className="hint model-note">
        <strong>{text.title}.</strong> {text.hint}
      </p>
    </>
  )
}
