import type { Project, ProjectTeam } from '@octo/domain'
import { useCallback, useEffect, useState } from 'react'
import type { ErrorCode, OctoApi } from '../shared/api.ts'
import { LineProblems } from './LineProblems.tsx'
import { type LineProblem, noProblems } from './lines.ts'
import { errorText, messages } from './messages.ts'
import { peopleLines, peopleOf, periodLines, periodsOf } from './team-text.ts'

type Props = { api: Pick<OctoApi, 'team' | 'saveTeam'>; project: Project }

const text = messages.team

/** The people and the calendar of the project, typed once and read by everything else. */
export function TeamSection({ api, project }: Props) {
  const [people, setPeople] = useState('')
  const [periods, setPeriods] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [saved, setSaved] = useState<ProjectTeam | null>(null)
  const [error, setError] = useState<ErrorCode | null>(null)
  const [unread, setUnread] = useState<{ people: LineProblem[]; periods: LineProblem[] } | null>(
    null,
  )

  const show = useCallback((team: ProjectTeam) => {
    setPeople(peopleLines(team.people))
    setPeriods(periodLines(team.periods))
  }, [])

  useEffect(() => {
    setLoaded(false)
    setSaved(null)
    setUnread(null)
    setError(null)
    void api.team(project.id).then((result) => {
      if (!result.ok) return setError(result.code)
      show(result.value)
      setLoaded(true)
    })
  }, [api, project.id, show])

  async function save() {
    setError(null)
    setSaved(null)
    const read = { people: peopleOf(people), periods: periodsOf(periods) }
    // A line that is not understood is told, never dropped: nothing is saved until it is right.
    if (!noProblems(read.people, read.periods)) {
      return setUnread({ people: read.people.problems, periods: read.periods.problems })
    }
    setUnread(null)
    const team = { people: read.people.values, periods: read.periods.values }
    const result = await api.saveTeam(project.id, team)
    if (!result.ok) return setError(result.code)
    show(result.value)
    setSaved(result.value)
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
          <label>
            {text.people}
            <textarea value={people} onChange={(event) => setPeople(event.target.value)} />
          </label>
          <LineProblems problems={unread?.people ?? []} shape={text.shapes.people} />
          <p className="hint">{text.peopleHint}</p>
          <label>
            {text.periods}
            <textarea value={periods} onChange={(event) => setPeriods(event.target.value)} />
          </label>
          <LineProblems problems={unread?.periods ?? []} shape={text.shapes.periods} />
          <div className="actions">
            <button type="submit">{text.save}</button>
            {unread && (
              <span className="field-problems" role="status">
                {messages.lines.notSaved}
              </span>
            )}
          </div>
          {saved && (
            <p className="badge badge-ok">
              {text.saved(saved.people.length, saved.periods.length)}
            </p>
          )}
        </form>
      )}
    </section>
  )
}
