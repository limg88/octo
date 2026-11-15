import type { ProjectOverview } from '@octo/application'
import { isToDo } from '@octo/domain'
import { useEffect, useState } from 'react'
import type { ErrorCode, OctoApi } from '../shared/api.ts'
import { Failure } from './Failure.tsx'
import { dateTimeText, messages } from './messages.ts'
import { signalText } from './today-text.ts'

type Props = {
  api: Pick<OctoApi, 'todayOverview'>
  onOpen: (projectId: string) => void
}

const text = messages.overview

/** Every project in brief: how much waits in each, and what comes first. Claude is never asked. */
export function AllProjectsView({ api, onOpen }: Props) {
  const [rows, setRows] = useState<ProjectOverview[] | null>(null)
  const [error, setError] = useState<ErrorCode | null>(null)

  useEffect(() => {
    void api.todayOverview().then((result) => {
      if (result.ok) setRows(result.value)
      else setError(result.code)
    })
  }, [api])

  if (rows === null) {
    return error ? <Failure code={error} /> : <p className="progress">{text.loading}</p>
  }
  return (
    <section className="today" aria-label={text.title}>
      <header className="project-header">
        <div>
          <h2>{text.title}</h2>
          <p className="folder">{text.intro}</p>
        </div>
      </header>
      {rows.length === 0 && <p className="today-empty">{text.empty}</p>}
      <ul className="today-list">
        {rows.map(({ project, counts, first, evaluatedAt, failed }) => {
          const toDo = counts.due + counts.waiting + counts.numbers
          return (
            <li key={project.id} className="today-item">
              <p className="today-item-title">{project.name}</p>
              {failed ? (
                <p className="warning">{text.failed}</p>
              ) : (
                <>
                  <p className="today-item-detail">
                    {text.counts(toDo, counts.watch)}
                    {counts.alert > 0 && (
                      <>
                        {' '}
                        <span className="badge badge-warning">{text.alerts(counts.alert)}</span>
                      </>
                    )}
                  </p>
                  {first.length === 0 ? (
                    <p className="hint">{text.nothing}</p>
                  ) : (
                    <ul className="today-first">
                      {first.map((item) => (
                        <li key={item.key} className={isToDo(item) ? '' : 'hint'}>
                          {signalText(item).title}
                        </li>
                      ))}
                    </ul>
                  )}
                  {evaluatedAt && (
                    <p className="hint">{text.evaluated(dateTimeText(evaluatedAt))}</p>
                  )}
                </>
              )}
              <div className="actions today-item-actions">
                <button type="button" onClick={() => onOpen(project.id)}>
                  {text.openProject(project.name)}
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
