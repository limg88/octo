import type { DayMeeting, MeetingPrep } from '@octo/domain'
import { messages } from './messages.ts'
import { hourText, personOf, shortDayText, signalText } from './today-text.ts'

const text = messages.today.prep

/** The card of a meeting as plain text: what the PM pastes into their notes. */
export function prepText(meeting: DayMeeting, prep: MeetingPrep): string {
  const section = (title: string, lines: string[]): string[] =>
    lines.length === 0 ? [] : ['', `${title}:`, ...lines.map((line) => `- ${line}`)]
  return [
    `${hourText(meeting.start)} · ${meeting.subject}`,
    ...(meeting.attendees.length === 0 ? [] : [meeting.attendees.map(personOf).join(', ')]),
    ...section(
      text.points,
      prep.points.map(({ point }) =>
        point.owner === '' ? point.title : `${point.title} (${point.owner})`,
      ),
    ),
    ...section(
      text.last,
      prep.last === null
        ? []
        : [
            text.lastWhen(prep.last.title, shortDayText(prep.last.started.slice(0, 10))),
            ...prep.last.opened.map((point) => text.stillOpen(point.title)),
            ...prep.last.closed.map((point) => text.closedThere(point.title)),
          ],
    ),
    ...section(
      text.mails,
      prep.mails.map((item) => signalText(item).title),
    ),
    ...section(
      text.numbers,
      prep.numbers.map((item) => signalText(item).title),
    ),
    ...section(
      text.bring,
      prep.bring.map((note) => note.text),
    ),
  ].join('\n')
}
