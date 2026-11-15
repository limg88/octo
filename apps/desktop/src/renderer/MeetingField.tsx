import type { StoredMeeting } from '@octo/domain'
import { useEffect, useState } from 'react'
import type { OctoApi } from '../shared/api.ts'
import { dateText, messages } from './messages.ts'

type Props = {
  api: OctoApi
  projectId: string
  /** The id the label of the field points to. */
  id: string
  /** The folder of an imported meeting, or the words that tell which meeting it is. */
  value: string
  onChange: (value: string) => void
}

/**
 * Which meeting a deliverable is about: one of those the project holds, picked from a list, or
 * any other, told in words.
 */
export function MeetingField({ api, projectId, id, value, onChange }: Props) {
  const [meetings, setMeetings] = useState<StoredMeeting[]>([])

  useEffect(() => {
    let current = true
    setMeetings([])
    void api.importedMeetings(projectId).then((result) => {
      if (current && result.ok) setMeetings(result.value)
    })
    return () => {
      current = false
    }
  }, [api, projectId])

  const chosen = meetings.some((meeting) => meeting.folder === value)
  return (
    <>
      {meetings.length > 0 && (
        <select
          id={chosen ? id : undefined}
          aria-label={messages.meetingField.imported}
          value={chosen ? value : ''}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">{messages.meetingField.other}</option>
          {meetings.map((meeting) => (
            <option key={meeting.id} value={meeting.folder}>
              {dateText(meeting.started)} · {meeting.title}
            </option>
          ))}
        </select>
      )}
      {!chosen && (
        <input
          id={id}
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      )}
    </>
  )
}
