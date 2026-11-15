import {
  DEFAULT_MODEL_SETTINGS,
  MODEL_CHOICES,
  MODEL_TASKS,
  type ModelChoice,
  type ModelSettings,
  type Project,
} from '@octo/domain'
import { useEffect, useState } from 'react'
import type { ErrorCode, OctoApi } from '../shared/api.ts'
import { errorText, messages } from './messages.ts'

type Props = { api: Pick<OctoApi, 'modelSettings' | 'saveModelSettings'>; project: Project }

const text = messages.models
const DEFAULT_OPTION = ''

const choiceOf = (value: string): ModelChoice | null =>
  MODEL_CHOICES.find((choice) => choice === value) ?? null

/** Which model answers, writes and reads again in this project. */
export function ModelsSection({ api, project }: Props) {
  const [settings, setSettings] = useState<ModelSettings>(DEFAULT_MODEL_SETTINGS)
  const [loaded, setLoaded] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<ErrorCode | null>(null)

  useEffect(() => {
    setLoaded(false)
    setSaved(false)
    setError(null)
    void api.modelSettings(project.id).then((result) => {
      if (!result.ok) return setError(result.code)
      setSettings(result.value)
      setLoaded(true)
    })
  }, [api, project.id])

  async function save() {
    setError(null)
    setSaved(false)
    const result = await api.saveModelSettings(project.id, settings)
    if (!result.ok) return setError(result.code)
    setSettings(result.value)
    setSaved(true)
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
      {loaded && (
        <form
          className="settings-form"
          onSubmit={(event) => {
            event.preventDefault()
            void save()
          }}
        >
          {MODEL_TASKS.map((task) => (
            <label key={task}>
              {text.task[task]}
              <select
                value={settings[task] ?? DEFAULT_OPTION}
                onChange={(event) => {
                  const choice = choiceOf(event.target.value)
                  setSaved(false)
                  setSettings((current) => ({ ...current, [task]: choice }))
                }}
              >
                <option value={DEFAULT_OPTION}>{text.byDefault}</option>
                {MODEL_CHOICES.map((choice) => (
                  <option key={choice} value={choice}>
                    {text.choice[choice]}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <div className="actions">
            <button type="submit">{text.save}</button>
          </div>
          {saved && <p className="badge badge-ok">{text.saved}</p>}
        </form>
      )}
    </section>
  )
}
