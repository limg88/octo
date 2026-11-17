import type { Project, StoredMeeting } from '@octo/domain'
import { useCallback, useEffect, useState } from 'react'
import type { ErrorCode, OctoApi } from '../shared/api.ts'
import { dateTimeText, errorText, messages } from './messages.ts'

type Props = {
  api: Pick<
    OctoApi,
    'importedMeetings' | 'meetingDestinations' | 'moveMeeting' | 'onSourcesChanged'
  >
  project: Project
}

/** In the list of where a meeting goes, the choice that gives it to no project. */
const NO_PROJECT = ''
type Destination = { id: string; name: string }
/** The meeting the PM is about to move, and where to: asked once more before it is done. */
type Pending = { meetingId: string; target: string }

/**
 * The meetings the project holds, each with a way out: to another project, or back among those
 * no project has. What Octo took from the meeting (its open points) goes away with it.
 */
export function MeetingsHeld({ api, project }: Props) {
  const text = messages.meetingsHeld
  const [meetings, setMeetings] = useState<StoredMeeting[]>([])
  const [destinations, setDestinations] = useState<Destination[]>([])
  const [targets, setTargets] = useState<Record<string, string>>({})
  const [pending, setPending] = useState<Pending | null>(null)
  const [busy, setBusy] = useState(false)
  const [moved, setMoved] = useState<string | null>(null)
  const [error, setError] = useState<ErrorCode | null>(null)

  const reload = useCallback(async () => {
    const held = await api.importedMeetings(project.id)
    if (held.ok) setMeetings(held.value)
    const others = await api.meetingDestinations(project.id)
    if (others.ok) setDestinations(others.value)
  }, [api, project.id])

  useEffect(() => {
    setMeetings([])
    setPending(null)
    setMoved(null)
    setError(null)
    void reload()
    return api.onSourcesChanged((projectId) => {
      if (projectId === project.id) void reload()
    })
  }, [api, project.id, reload])

  const nameOf = (target: string): string =>
    destinations.find((destination) => destination.id === target)?.name ?? ''

  async function move({ meetingId, target }: Pending) {
    setBusy(true)
    setError(null)
    const result = await api.moveMeeting(
      project.id,
      meetingId,
      target === NO_PROJECT ? null : target,
    )
    setBusy(false)
    setPending(null)
    if (!result.ok) return setError(result.code)
    setMeetings(result.value)
    setMoved(target === NO_PROJECT ? text.released : text.moved(nameOf(target)))
  }

  if (meetings.length === 0 && moved === null && error === null) return null
  return (
    <section aria-label={text.title}>
      <h4>{text.title}</h4>
      <p className="hint">{text.intro}</p>
      {error && (
        <p className="warning" role="alert">
          {errorText(error)}
        </p>
      )}
      {moved && (
        <p className="hint" role="status">
          {moved}
        </p>
      )}
      <ul className="held-meetings">
        {meetings.map((meeting) => {
          const target = targets[meeting.id] ?? NO_PROJECT
          const asking = pending?.meetingId === meeting.id
          return (
            <li key={meeting.id}>
              <span>
                «{meeting.title}» <span className="hint">{dateTimeText(meeting.started)}</span>
              </span>
              <select
                aria-label={text.targetOf(meeting.title)}
                value={target}
                disabled={busy}
                onChange={(event) => {
                  setPending(null)
                  setTargets({ ...targets, [meeting.id]: event.target.value })
                }}
              >
                <option value={NO_PROJECT}>{text.noProject}</option>
                {destinations.map((destination) => (
                  <option key={destination.id} value={destination.id}>
                    {destination.name}
                  </option>
                ))}
              </select>
              {asking ? (
                <>
                  <span className="warning">
                    {target === NO_PROJECT ? text.confirmRelease : text.confirmMove(nameOf(target))}
                  </span>
                  <button type="button" disabled={busy} onClick={() => void move(pending)}>
                    {text.confirm}
                  </button>
                  <button
                    type="button"
                    className="quiet"
                    disabled={busy}
                    onClick={() => setPending(null)}
                  >
                    {text.cancel}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="quiet"
                  disabled={busy}
                  aria-label={text.moveOf(meeting.title)}
                  onClick={() => setPending({ meetingId: meeting.id, target })}
                >
                  {target === NO_PROJECT ? text.release : text.move}
                </button>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
