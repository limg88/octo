import {
  DEFAULT_MODEL_SETTINGS,
  MODEL_CHOICES,
  MODEL_TASKS,
  type ModelChoice,
  type ModelSettings,
  type Project,
} from '@octo/domain'
import { useEffect, useId, useState } from 'react'
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
  /** What was read or saved last: anything else is a change still to save. */
  const [kept, setKept] = useState('')
  const formId = useId()
  const [error, setError] = useState<ErrorCode | null>(null)

  useEffect(() => {
    setLoaded(false)
    setSaved(false)
    setError(null)
    void api.modelSettings(project.id).then((result) => {
      if (!result.ok) return setError(result.code)
      setSettings(result.value)
      setKept(JSON.stringify(result.value))
      setLoaded(true)
    })
  }, [api, project.id])

  async function save() {
    setError(null)
    setSaved(false)
    const result = await api.saveModelSettings(project.id, settings)
    if (!result.ok) return setError(result.code)
    setSettings(result.value)
    setKept(JSON.stringify(result.value))
    setSaved(true)
  }

  const clean = JSON.stringify(settings) === kept
  return (
    <section className="source" aria-label={text.title}>
      <div className="title-row">
        <div>
          <h3>{text.title}</h3>
          <p className="hint">{text.intro}</p>
        </div>
        {loaded && (
          <div className="actions">
            <span className="hint">{saved ? text.saved : clean ? text.nothingToSave : ''}</span>
            <button type="submit" form={formId} className="primary">
              {text.save}
            </button>
          </div>
        )}
      </div>
      {error && (
        <p className="warning" role="alert">
          {errorText(error)}
        </p>
      )}
      {loaded && (
        <form
          id={formId}
          className="panel model-tasks"
          onSubmit={(event) => {
            event.preventDefault()
            void save()
          }}
        >
          {MODEL_TASKS.map((task) => (
            <label key={task} className="list-row">
              <strong className="list-row-text">{text.task[task]}</strong>
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
        </form>
      )}
    </section>
  )
}
