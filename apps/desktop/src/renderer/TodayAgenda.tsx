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

/** The meetings of the day in the order they are held, and those of the next working day. */
export function TodayAgenda({ agenda, now, opening, onOpen, summary, children }: Props) {
  /** The card in view; before the PM chooses, that of the next meeting still to come. */
  const [chosen, setChosen] = useState<string | null | undefined>(undefined)
  if (agenda.today.length === 0 && agenda.next.meetings.length === 0) return null
  const next = agenda.today.find((meeting) => Date.parse(meeting.start) > now)
  const shownKey = chosen === undefined ? (next ? agendaKey(next) : null) : chosen
  return (
    <section className="panel today-agenda" aria-label={text.title}>
      <h4 className="today-title">
        {text.title}
        <span className="today-count">{text.count(agenda.today.length)}</span>
      </h4>
      {agenda.today.length > 0 && (
        <ul className="today-meetings" aria-label={text.list}>
          {agenda.today.map((meeting) => {
            const key = agendaKey(meeting)
            const over = endOf(meeting) <= now
            const shown = children !== undefined && shownKey === key
            const words = summary?.(meeting) ?? null
            return (
              <li key={key} className={over ? 'today-meeting today-meeting-over' : 'today-meeting'}>
                <div className="today-meeting-row">
                  <span className="today-meeting-hours">{hoursOf(meeting)}</span>
                  <span className="today-meeting-what">
                    <strong>{meeting.subject}</strong>{' '}
                    {meeting.repeats && <span className="pill">{text.repeats}</span>}{' '}
                    {over && <span className="pill">{text.over}</span>}
                    <span className="hint today-meeting-who">
                      {[meeting.location, attendeesText(meeting.attendees)]
                        .filter((part) => part !== '')
                        .join(' · ')}
                    </span>
                  </span>
                  {children && (
                    <button
                      type="button"
                      className={shown ? 'quiet' : undefined}
                      aria-expanded={shown}
                      aria-label={`${text.card}: ${meeting.subject}`}
                      onClick={() => setChosen(shown ? null : key)}
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
        <p className="hint today-agenda-next">
          {text.next(
            shortDayText(agenda.next.day),
            agenda.next.meetings
              .map((meeting) => `${hourText(meeting.start)} ${meeting.subject}`)
              .join(' · '),
          )}
        </p>
      )}
    </section>
  )
}
