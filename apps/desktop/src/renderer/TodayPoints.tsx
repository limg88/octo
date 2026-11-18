import type { TodayClosing } from '@octo/application'
import type { BriefPoint, OpenPoint, OpenPointChange, PointBrief } from '@octo/domain'
import { type FormEvent, useState } from 'react'
import type { OpenPointDraft } from '../shared/api.ts'
import { dateTimeText, messages } from './messages.ts'
import { BusyButton } from './Spinner.tsx'
import { hourText, shortDayText } from './today-text.ts'

const text = messages.today.points
/** Points read every morning: the others are a click away. */
export const POINTS_LIMIT = 4

type Props = {
  brief: PointBrief
  /** Today, `YYYY-MM-DD`: a point is due from tomorrow on. */
  day: string
  closing: TodayClosing
  /** False when Claude Code is not on this computer: the meetings are not read. */
  canJudge: boolean
  /** True while Claude works for the page. */
  judging: boolean
  onClose: () => void
  onAdd: (point: OpenPointDraft) => void
  onUpdate: (pointId: string, change: OpenPointChange) => void
  onConfirm: (pointId: string, resolved: boolean) => void
  onOpenFile: (key: string, path: string) => void
}

/** What the register says of a point in one line: whose it is, since when, by when. */
function factsOf(entry: BriefPoint): string {
  const { point } = entry
  return [
    point.owner === '' ? text.mine : text.of(point.owner),
    text.openFor(entry.openWorkdays),
    ...(point.due === null
      ? []
      : [
          entry.overdueDays > 0
            ? text.overdue(shortDayText(point.due), entry.overdueDays)
            : text.dueBy(shortDayText(point.due)),
        ]),
  ].join(' · ')
}

function PointRow(props: {
  entry: BriefPoint
  onUpdate: Props['onUpdate']
  onOpenFile: Props['onOpenFile']
}) {
  const { point } = props.entry
  const [editing, setEditing] = useState(false)
  const [title, setTitle] = useState(point.title)
  const [owner, setOwner] = useState(point.owner)
  const [due, setDue] = useState(point.due ?? '')

  function save(event: FormEvent) {
    event.preventDefault()
    props.onUpdate(point.id, { title, owner, due: due === '' ? null : due })
    setEditing(false)
  }

  if (editing) {
    return (
      <form className="today-point-form" aria-label={text.editTitle(point.title)} onSubmit={save}>
        <input
          aria-label={text.titleLabel}
          value={title}
          required
          onChange={(event) => setTitle(event.target.value)}
        />
        <input
          aria-label={text.ownerLabel}
          placeholder={text.ownerHint}
          value={owner}
          onChange={(event) => setOwner(event.target.value)}
        />
        <input
          type="date"
          aria-label={text.dueLabel}
          value={due}
          onChange={(event) => setDue(event.target.value)}
        />
        <button type="submit" className="primary">
          {text.save}
        </button>
        <button type="button" className="quiet" onClick={() => setEditing(false)}>
          {text.cancel}
        </button>
      </form>
    )
  }
  return (
    <div className="today-point">
      <div className="today-point-what">
        {props.entry.overdueDays > 0 && <span className="pill pill-late">{text.late}</span>}{' '}
        {props.entry.fresh && <span className="pill pill-new">{text.fresh}</span>}{' '}
        <strong>{point.title}</strong>{' '}
        {point.origin === 'claude' && <span className="pill">{text.byClaude}</span>}
        <span className="hint today-point-facts">{factsOf(props.entry)}</span>
        {props.entry.raiseAt && (
          <span className="hint today-point-facts">
            {text.raiseAt(hourText(props.entry.raiseAt.start), props.entry.raiseAt.subject)}
          </span>
        )}
        {point.history.slice(-1).map((note) => (
          <span key={note.day} className="hint today-point-facts">
            {text.lastSaid(shortDayText(note.day), note.text)}
          </span>
        ))}
      </div>
      <div className="actions">
        <button
          type="button"
          aria-label={`${text.resolve}: ${point.title}`}
          onClick={() => props.onUpdate(point.id, { state: 'resolved' })}
        >
          {text.resolve}
        </button>
        <button
          type="button"
          className="quiet"
          aria-label={`${text.edit}: ${point.title}`}
          onClick={() => setEditing(true)}
        >
          {text.edit}
        </button>
        {point.source && (
          <button
            type="button"
            className="quiet"
            title={`«${point.source.quote}»`}
            aria-label={`${text.source}: ${point.title}`}
            onClick={() => props.onOpenFile(point.id, point.source?.path ?? '')}
          >
            {text.source}
          </button>
        )}
        <button
          type="button"
          className="quiet"
          title={text.dropHint}
          aria-label={`${text.drop}: ${point.title}`}
          onClick={() => props.onUpdate(point.id, { state: 'dropped' })}
        >
          ×
        </button>
      </div>
    </div>
  )
}

function ClosedRow(props: {
  point: OpenPoint
  onUpdate: Props['onUpdate']
  onOpenFile: Props['onOpenFile']
}) {
  const { point } = props
  return (
    <div className="today-point">
      <div className="today-point-what">
        <span>{point.title}</span>
        <span className="hint today-point-facts">
          {[
            text.closedOn(shortDayText(point.closedOn ?? '')),
            point.closedBy ? text.closedBy[point.closedBy] : '',
            point.closing ? `«${point.closing.quote}»` : '',
          ]
            .filter((part) => part !== '')
            .join(' · ')}
        </span>
      </div>
      <div className="actions">
        {point.closing && (
          <button
            type="button"
            className="quiet"
            aria-label={`${text.source}: ${point.title}`}
            onClick={() => props.onOpenFile(point.id, point.closing?.path ?? '')}
          >
            {text.source}
          </button>
        )}
        <button
          type="button"
          className="quiet"
          aria-label={`${text.reopen}: ${point.title}`}
          onClick={() => props.onUpdate(point.id, { state: 'open' })}
        >
          {text.reopen}
        </button>
      </div>
    </div>
  )
}

/**
 * The brief the page opens on: the points left open, those closed since the working day before,
 * those that wait for a word of the PM. Composed by the code from the register.
 */
export function TodayPoints(props: Props) {
  const { brief, day, closing, onAdd, onUpdate, onConfirm, onOpenFile } = props
  const [open, setOpen] = useState(true)
  const [all, setAll] = useState(false)
  const [showClosed, setShowClosed] = useState(false)
  const [title, setTitle] = useState('')
  const [owner, setOwner] = useState('')
  const [due, setDue] = useState('')
  const since = shortDayText(brief.since)
  const fresh = brief.queued.filter((entry) => entry.fresh).length
  const shown = all ? brief.queued : brief.queued.slice(0, POINTS_LIMIT)

  function add(event: FormEvent) {
    event.preventDefault()
    if (title.trim() === '') return
    onAdd({ title, owner, due: due === '' ? null : due })
    setTitle('')
    setOwner('')
    setDue('')
  }

  return (
    <section className="panel today-points" aria-label={text.title}>
      <h4 className="today-title">
        {text.title}
        <span className="today-count">
          {[
            text.queued(brief.queued.length),
            ...(fresh > 0 ? [text.freshCount(fresh, since)] : []),
            ...(brief.closed.length > 0 ? [text.closedCount(brief.closed.length, since)] : []),
            ...(brief.toConfirm.length > 0 ? [text.toConfirmCount(brief.toConfirm.length)] : []),
          ].join(' · ')}
        </span>
        <button
          type="button"
          className="quiet today-points-toggle"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? text.fold : text.unfold}
        </button>
      </h4>
      {open && (
        <>
          {brief.toConfirm.length > 0 && (
            <ul className="today-point-list" aria-label={text.toConfirm}>
              {brief.toConfirm.map((point) => (
                <li key={point.id} className="today-point today-point-check">
                  <div className="today-point-what">
                    <span className="pill">{text.toConfirmPill}</span>{' '}
                    <strong>{point.title}</strong>
                    <span className="hint today-point-facts">
                      {point.check?.why === 'not_recorded'
                        ? text.notRecorded(point.check.meeting ?? '', shortDayText(point.check.day))
                        : text.unverified(point.check?.text ?? '', point.check?.meeting ?? null)}
                    </span>
                  </div>
                  <div className="actions">
                    <button
                      type="button"
                      aria-label={`${text.resolve}: ${point.title}`}
                      onClick={() => onConfirm(point.id, true)}
                    >
                      {text.resolve}
                    </button>
                    <button
                      type="button"
                      className="quiet"
                      aria-label={`${text.stays}: ${point.title}`}
                      onClick={() => onConfirm(point.id, false)}
                    >
                      {text.stays}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {brief.queued.length === 0 ? (
            <p className="today-empty">{text.none}</p>
          ) : (
            <ul className="today-point-list" aria-label={text.list}>
              {shown.map((entry) => (
                <li key={entry.point.id}>
                  <PointRow entry={entry} onUpdate={onUpdate} onOpenFile={onOpenFile} />
                </li>
              ))}
            </ul>
          )}
          {brief.queued.length > POINTS_LIMIT && (
            <button type="button" className="quiet" onClick={() => setAll(!all)}>
              {all ? text.fewer : text.more(brief.queued.length - POINTS_LIMIT)}
            </button>
          )}
          {brief.others.length > 0 && (
            <details className="today-aside">
              <summary>{text.others(brief.others.length)}</summary>
              <ul className="today-point-list" aria-label={text.othersList}>
                {brief.others.map((entry) => (
                  <li key={entry.point.id}>
                    <PointRow entry={entry} onUpdate={onUpdate} onOpenFile={onOpenFile} />
                  </li>
                ))}
              </ul>
            </details>
          )}
          {brief.closed.length > 0 && (
            <>
              <button
                type="button"
                className="quiet"
                aria-expanded={showClosed}
                onClick={() => setShowClosed(!showClosed)}
              >
                {text.closedButton(brief.closed.length, since)}
              </button>
              {showClosed && (
                <ul className="today-point-list" aria-label={text.closedList}>
                  {brief.closed.map((point) => (
                    <li key={point.id}>
                      <ClosedRow point={point} onUpdate={onUpdate} onOpenFile={onOpenFile} />
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
          <div className="actions today-closing">
            <span className="hint">
              {[
                ...(closing.unread > 0 ? [text.unread(closing.unread)] : []),
                closing.at === null
                  ? text.neverClosed
                  : text.closedAt(dateTimeText(closing.at), closing.model),
              ].join(' · ')}
            </span>
            {props.canJudge && (
              <BusyButton
                className="quiet"
                busy={props.judging}
                busyLabel={text.closing}
                onClick={props.onClose}
              >
                {text.closeDay}
              </BusyButton>
            )}
          </div>
          <form className="today-point-form" aria-label={text.addTitle} onSubmit={add}>
            <input
              aria-label={text.titleLabel}
              placeholder={text.addHint}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
            <input
              aria-label={text.ownerLabel}
              placeholder={text.ownerHint}
              value={owner}
              onChange={(event) => setOwner(event.target.value)}
            />
            <input
              type="date"
              aria-label={text.dueLabel}
              min={day}
              value={due}
              onChange={(event) => setDue(event.target.value)}
            />
            <button type="submit" disabled={title.trim() === ''}>
              {text.add}
            </button>
          </form>
        </>
      )}
    </section>
  )
}
