import { meetingMinutes, type RecordedMeeting } from '../meetings/model.ts'
import type { TodayItem } from './model.ts'

const DAY_MS = 24 * 60 * 60 * 1000

export const unassignedMeetingKey = (id: string): string => `meeting-unassigned:${id}`

/** The recorded meetings no project could be told for: they wait for the PM to place them. */
export function unassignedMeetingItems(
  meetings: readonly RecordedMeeting[],
  now: Date,
): TodayItem[] {
  return meetings.map((meeting): TodayItem => {
    const days = Math.max(0, Math.floor((now.getTime() - Date.parse(meeting.started)) / DAY_MS))
    return {
      key: unassignedMeetingKey(meeting.id),
      band: 'waiting',
      facts: {
        kind: 'meeting_unassigned',
        id: meeting.id,
        title: meeting.title,
        start: meeting.started,
        minutes: meetingMinutes(meeting),
        days,
      },
      weight: days,
      target: 'sources',
      asOf: null,
    }
  })
}
