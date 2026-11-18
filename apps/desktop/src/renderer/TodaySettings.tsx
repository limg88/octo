import type { TodayView } from '@octo/application'
import type { Project, TodayKind } from '@octo/domain'
import { useEffect, useState } from 'react'
import type { ErrorCode, OctoApi } from '../shared/api.ts'
import { Failure } from './Failure.tsx'
import { messages } from './messages.ts'
import { notifyRefused } from './notify.ts'
import { useSavedNote } from './SavedNote.tsx'

type TodaySettingsApi = Pick<
  OctoApi,
  'todayView' | 'muteTodayKind' | 'saveOwnAddresses' | 'setTodayNotify'
>

type Props = { api: TodaySettingsApi; project: Project }

const text = messages.today

/** What is set once for the page of the day: whose mail is the PM's, what is not shown. */
export function TodaySettings({ api, project }: Props) {
  const [view, setView] = useState<TodayView | null>(null)
  const [addresses, setAddresses] = useState('')
  const [error, setError] = useState<ErrorCode | null>(null)
  const savedNote = useSavedNote()

  function show(next: TodayView) {
    setView(next)
    setAddresses(next.addedAddresses.join('\n'))
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: another project starts from its own settings.
  useEffect(() => {
    let current = true
    setView(null)
    setError(null)
    savedNote.clear()
    void api.todayView(project.id).then((result) => {
      if (!current) return
      if (result.ok) show(result.value)
      else setError(result.code)
    })
    return () => {
      current = false
    }
  }, [api, project.id])

  async function saveAddresses() {
    setError(null)
    savedNote.clear()
    const lines = addresses.split('\n').filter((line) => line.trim() !== '')
    const result = await api.saveOwnAddresses(project.id, lines)
    if (!result.ok) return setError(result.code)
    show(result.value)
    savedNote.saved()
  }

  async function unmute(kind: TodayKind) {
    setError(null)
    const result = await api.muteTodayKind(project.id, kind, false)
    if (result.ok) show(result.value)
    else setError(result.code)
  }

  async function notify(on: boolean) {
    setError(null)
    const result = await api.setTodayNotify(project.id, on)
    if (result.ok) show(result.value)
    else setError(result.code)
  }

  if (view === null) {
    return error ? <Failure code={error} /> : <p className="progress">{text.loading}</p>
  }

  return (
    <section className="panel settings-panel" aria-label={text.settings}>
      <h3>{text.settings}</h3>
      {error && <Failure code={error} />}
      {savedNote.note}
      <p className="hint">
        {view.ownAddresses.length > 0
          ? text.addressesKnown(view.ownAddresses.join(', '))
          : text.addressesNone}
      </p>
      <div className="field">
        <label htmlFor="today-addresses">{text.addresses}</label>
        <textarea
          id="today-addresses"
          rows={3}
          value={addresses}
          onChange={(event) => setAddresses(event.target.value)}
        />
        <span className="hint">{text.addressesHint}</span>
      </div>
      <div className="actions">
        <button type="button" onClick={() => void saveAddresses()}>
          {text.saveAddresses}
        </button>
      </div>
      <div className="field">
        <label className="check">
          <input
            type="checkbox"
            checked={view.notify}
            onChange={(event) => void notify(event.target.checked)}
          />{' '}
          {text.notifyLabel}
        </label>
        <span className="hint">{text.notifyHint}</span>
        {view.notify && notifyRefused() && (
          <span className="warning" role="status">
            {text.notifyRefused}
          </span>
        )}
      </div>
      <h4>{text.mutedTitle}</h4>
      {view.mutedKinds.length === 0 ? (
        <p className="hint">{text.mutedNone}</p>
      ) : (
        <ul className="plain-rows">
          {view.mutedKinds.map((kind) => (
            <li key={kind}>
              <span>{text.kinds[kind]}</span>
              <button type="button" className="quiet" onClick={() => void unmute(kind)}>
                {text.unmute}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
