import { type DayMeeting, type MeetingPrep, prepCount, type TodayItem } from '@octo/domain'
import { useState } from 'react'
import { messages } from './messages.ts'
import { prepText } from './prep-text.ts'
import { shortDayText, signalText } from './today-text.ts'

const text = messages.today.prep
const points = messages.today.points

type Props = {
  meeting: DayMeeting
  prep: MeetingPrep
  /** True while Claude works for the page: what it adds may still come. */
  judging: boolean
  onOpenFile: (key: string, path: string) => void
  /** Opens the place a signal is put right in. */
  onOpen: (item: TodayItem) => void
}

/** In a line, how much there is to take to a meeting. */
export function prepSummary(prep: MeetingPrep): string {
  const count = prepCount(prep)
  return count === 0 ? text.nothing : text.count(count)
}

/**
 * The card of a meeting: the points to close there, what was left the last time, the mail of
 * who is invited, the numbers, and what Claude adds with its sources.
 */
export function TodayPrep({ meeting, prep, judging, onOpenFile, onOpen }: Props) {
  const [copied, setCopied] = useState(false)
  const empty = prepCount(prep) === 0 && prep.last === null && prep.numbers.length === 0
  // A mail listed among those of who takes part is opened from there: not again as a source.
  const mailPaths = new Set(
    prep.mails.flatMap((item) => ('path' in item.facts ? [item.facts.path] : [])),
  )

  async function copy() {
    await navigator.clipboard?.writeText(prepText(meeting, prep))
    setCopied(true)
  }

  return (
    <section className="today-prep" aria-label={text.title(meeting.subject)}>
      {empty && <p className="today-empty">{text.empty}</p>}
      {prep.points.length > 0 && (
        <div>
          <span className="eyebrow">{text.points}</span>
          <ul aria-label={`${text.points}: ${meeting.subject}`}>
            {prep.points.map((entry) => (
              <li key={entry.point.id}>
                {entry.overdueDays > 0 && <span className="pill pill-late">{points.late}</span>}{' '}
                <strong>{entry.point.title}</strong>{' '}
                <span className="hint">
                  {[
                    entry.point.owner === '' ? points.mine : points.of(entry.point.owner),
                    points.openFor(entry.openWorkdays),
                    ...(entry.point.due ? [points.dueBy(shortDayText(entry.point.due))] : []),
                  ].join(' · ')}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {prep.last && (
        <div>
          <span className="eyebrow">{text.last}</span>
          <p>
            {text.lastWhen(prep.last.title, shortDayText(prep.last.started.slice(0, 10)))}{' '}
            {prep.last.file && (
              <button
                type="button"
                className="quiet"
                aria-label={`${text.openLast}: ${meeting.subject}`}
                onClick={() => onOpenFile(prep.key, prep.last?.file ?? '')}
              >
                {text.openLast}
              </button>
            )}
          </p>
          {prep.last.opened.length + prep.last.closed.length > 0 && (
            <ul aria-label={`${text.last}: ${meeting.subject}`}>
              {prep.last.opened.map((point) => (
                <li key={point.id}>{text.stillOpen(point.title)}</li>
              ))}
              {prep.last.closed.map((point) => (
                <li key={point.id} className="hint">
                  {text.closedThere(point.title)}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {prep.mails.length > 0 && (
        <div>
          <span className="eyebrow">{text.mails}</span>
          <ul aria-label={`${text.mails}: ${meeting.subject}`}>
            {prep.mails.map((item) => (
              <li key={item.key}>
                {signalText(item).title}{' '}
                <button
                  type="button"
                  className="quiet"
                  aria-label={`${messages.today.open[item.target]}: ${signalText(item).title}`}
                  onClick={() => onOpen(item)}
                >
                  {messages.today.open[item.target]}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {prep.numbers.length > 0 && (
        <div>
          <span className="eyebrow">{text.numbers}</span>
          <ul aria-label={`${text.numbers}: ${meeting.subject}`}>
            {prep.numbers.map((item) => (
              <li key={item.key}>
                {signalText(item).title} <span className="hint">{signalText(item).detail}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {prep.bring.length > 0 && (
        <div>
          <span className="eyebrow">{text.bring}</span>
          <ul aria-label={`${text.bring}: ${meeting.subject}`}>
            {prep.bring.map((note) => (
              <li key={`${note.path}\n${note.quote}`}>
                <span title={`«${note.quote}»`}>{note.text}</span>{' '}
                {!mailPaths.has(note.path) && (
                  <button
                    type="button"
                    className="quiet"
                    aria-label={`${messages.today.nowSource}: ${note.text}`}
                    onClick={() => onOpenFile(prep.key, note.path)}
                  >
                    {messages.today.nowSource}
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {judging && prep.bring.length === 0 && (
        <p className="hint" role="status">
          {text.preparing}
        </p>
      )}
      {!empty && (
        <div className="actions">
          <button type="button" className="quiet" onClick={() => void copy()}>
            {copied ? text.copied : text.copy}
          </button>
        </div>
      )}
    </section>
  )
}
