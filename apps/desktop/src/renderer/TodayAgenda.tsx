import type { TodayAgenda as Agenda } from '@octo/application'
import type { DayMeeting } from '@octo/domain'
import { type ReactNode, useState } from 'react'
import { messages } from './messages.ts'
import { hourText, personOf, shortDayText } from './today-text.ts'

const text = messages.today.agenda
/** People of a meeting named in its row: the others are counted. */
const NAMED_ATTENDEES = 3
/** How long a meeting is taken to last when its invitation does not say. */
const DEFAULT_MEETING_MS = 60 * 60 * 1000

type Props = {
  agenda: Agenda
  /** The instant it is now: a meeting that is over is said so. */
  now: number
  /** The file being handed to the system, by the key of its meeting. */
  opening: string | null
  onOpen: (key: string, path: string) => void
  /** Why a meeting comes first now, when it does: said before anything else in its row. */
  mark?: (meeting: DayMeeting) => string | null
  /** How much there is to take to a meeting of today, in a few words; null when not known. */
  summary?: (meeting: DayMeeting) => string | null
  /** The card of a meeting of today: what to bring to it. */
  children?: (meeting: DayMeeting) => ReactNode
}

export const agendaKey = (meeting: DayMeeting): string => `${meeting.uid}:${meeting.start}`

const endOf = (meeting: DayMeeting): number =>
  meeting.end === null ? Date.parse(meeting.start) + DEFAULT_MEETING_MS : Date.parse(meeting.end)

const hoursOf = (meeting: DayMeeting): string =>
  meeting.end === null
    ? hourText(meeting.start)
    : `${hourText(meeting.start)}–${hourText(meeting.end)}`

function attendeesText(attendees: readonly string[]): string {
  const named = attendees.slice(0, NAMED_ATTENDEES).map(personOf).join(', ')
  const others = attendees.length - NAMED_ATTENDEES
  return others > 0 ? text.andOthers(named, others) : named
}

/**
 * The meetings of the day as rows of what comes now, in the order they are held, and a line on
 * those of the next working day. The card of a meeting opens under its row.
 */
export function TodayAgenda({ agenda, now, opening, onOpen, mark, summary, children }: Props) {
  const [shownKey, setShownKey] = useState<string | null>(null)
  return (
    <>
      {agenda.today.length > 0 && (
        <ul className="entries" aria-label={text.list}>
          {agenda.today.map((meeting) => {
            const key = agendaKey(meeting)
            const over = endOf(meeting) <= now
            const shown = children !== undefined && shownKey === key
            const words = summary?.(meeting) ?? null
            const why = mark?.(meeting) ?? null
            const facts = [meeting.location, attendeesText(meeting.attendees)].filter(
              (part) => part !== '',
            )
            return (
              <li key={key} className={over ? 'today-meeting today-meeting-over' : 'today-meeting'}>
                <div className="list-row">
                  <span className="list-row-lead">
                    {over ? (
                      <span className="pill">{text.over}</span>
                    ) : (
                      why !== null && <span className="pill pill-warning">{why}</span>
                    )}
                  </span>
                  <span className="list-row-text">
                    <span className="today-meeting-hours">{hoursOf(meeting)}</span>
                    {' · '}
                    <strong>{meeting.subject}</strong>
                    {facts.length > 0 && <span className="hint"> · {facts.join(' · ')}</span>}
                  </span>
                  {meeting.repeats && <span className="pill">{text.repeats}</span>}
                  <span className="pill pill-source">{messages.today.kinds.meeting}</span>
                  {children && (
                    <button
                      type="button"
                      className="quiet"
                      aria-expanded={shown}
                      aria-label={`${text.card}: ${meeting.subject}`}
                      onClick={() => setShownKey(shown ? null : key)}
                    >
                      {words ?? text.card}
                    </button>
                  )}
                  <button
                    type="button"
                    className="quiet"
                    disabled={opening === key}
                    aria-label={`${text.openInvite}: ${meeting.subject}`}
                    onClick={() => onOpen(key, meeting.path)}
                  >
                    {text.openInvite}
                  </button>
                </div>
                {shown && children?.(meeting)}
              </li>
            )
          })}
        </ul>
      )}
      {agenda.next.meetings.length > 0 && (
        <p className="hint">
          {text.next(
            shortDayText(agenda.next.day),
            agenda.next.meetings
              .map((meeting) => `${hourText(meeting.start)} ${meeting.subject}`)
              .join(' · '),
          )}
        </p>
      )}
    </>
  )
}
