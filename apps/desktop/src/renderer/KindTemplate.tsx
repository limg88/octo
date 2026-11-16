import type { DeliverableKind, Project, TemplateFormat } from '@octo/domain'
import { useEffect, useState } from 'react'
import type { ErrorCode, OctoApi } from '../shared/api.ts'
import { errorText, messages } from './messages.ts'

export type KindTemplateApi = Pick<
  OctoApi,
  'kindTemplates' | 'chooseKindTemplate' | 'removeKindTemplate'
>

type Props = { api: KindTemplateApi; project: Project; kind: DeliverableKind }

const text = messages.kindTemplate

/**
 * The template of one kind of deliverable: a Word document that gives it its sections and its
 * paper, or a presentation whose slides are filled. It belongs to the kind, so it is shown with
 * the kind and nowhere else.
 */
export function KindTemplate({ api, project, kind }: Props) {
  const [formats, setFormats] = useState<TemplateFormat[] | null>(null)
  const [error, setError] = useState<ErrorCode | null>(null)

  async function load() {
    const result = await api.kindTemplates(project.id)
    if (result.ok) setFormats(result.value[kind.id] ?? [])
  }

  // biome-ignore lint/correctness/useExhaustiveDependencies: read once for each kind of each project.
  useEffect(() => {
    setFormats(null)
    setError(null)
    void load()
  }, [api, project.id, kind.id])

  async function change(step: () => Promise<{ ok: true } | { ok: false; code: ErrorCode }>) {
    setError(null)
    const result = await step()
    if (!result.ok) setError(result.code)
    await load()
  }

  if (formats === null) return null
  return (
    <section className="kind-template" aria-label={text.title}>
      <h4>{text.title}</h4>
      {formats.length === 0 ? (
        <p className="hint">{text.none}</p>
      ) : (
        <ul className="plain-rows">
          {formats.map((format) => (
            <li key={format}>
              <span>
                <span className="badge badge-ok">{text.format[format]}</span>{' '}
                <span className="hint">{text.does[format]}</span>
              </span>
              <button
                type="button"
                className="quiet"
                aria-label={text.removeFormat(text.format[format])}
                onClick={() =>
                  void change(() => api.removeKindTemplate(project.id, kind.id, format))
                }
              >
                {text.remove}
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p className="warning" role="alert">
          {errorText(error)}
        </p>
      )}
      <div className="actions">
        <button
          type="button"
          onClick={() => void change(() => api.chooseKindTemplate(project.id, kind.id))}
        >
          {text.choose}
        </button>
      </div>
      <p className="hint">{text.hint}</p>
    </section>
  )
}
