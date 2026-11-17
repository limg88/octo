import type { DashboardView } from '@octo/application'
import { DEFAULT_HOURS_PER_DAY } from '@octo/domain'
import { useState } from 'react'
import { dateTimeText, messages } from './messages.ts'

type Props = {
  view: Pick<DashboardView, 'activities'>
  onOpenItem?: ((id: string) => void) | undefined
}

const text = messages.dashboard.activities
const hoursText = (value: number): string =>
  value.toLocaleString('it-IT', { maximumFractionDigits: 1 })
const shareText = (value: number): string =>
  `${(value * 100).toLocaleString('it-IT', { maximumFractionDigits: 0 })}%`
/** The hours of a day of work, as the caps of the people are turned into hours. */
const HOURS_PER_DAY = DEFAULT_HOURS_PER_DAY
/** The start of a comment shown in a row of the table: the whole of it is in the diary. */
const COMMENT_PREVIEW_CHARS = 90
const preview = (comment: string): string => {
  const plain = comment
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  return plain.length > COMMENT_PREVIEW_CHARS ? `${plain.slice(0, COMMENT_PREVIEW_CHARS)}…` : plain
}

/**
 * A tracker read as a register of activities: every item with the hours logged on it and its
 * last comment, the comments of each as a diary, and the hours person by person.
 */
export function DashboardActivities({ view, onOpenItem }: Props) {
  const [diaryOf, setDiaryOf] = useState<string | null>(null)
  const { rows, people, hours, otherHours } = view.activities
  // The column of the caps is there only when somebody has one.
  const capped = people.some((person) => person.capHours !== null)
  return (
    <section aria-label={text.title}>
      <p className="hint">{text.intro}</p>
      <div className="table-wide table-intrinsic">
        <table className="data" aria-label={text.title}>
          <thead>
            <tr>
              <th scope="col">{text.columnItem}</th>
              <th scope="col">{text.columnTitle}</th>
              <th scope="col">{text.columnState}</th>
              <th scope="col">{text.columnAssignee}</th>
              <th scope="col" className="number">
                {text.columnHours}
              </th>
              <th scope="col">{text.columnLast}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const [last] = row.comments
              const open = diaryOf === row.id
              return (
                <tr key={row.id}>
                  <th scope="row">
                    {onOpenItem ? (
                      <button type="button" className="quiet" onClick={() => onOpenItem(row.id)}>
                        {row.id}
                      </button>
                    ) : (
                      row.id
                    )}{' '}
                    <span className="hint">{row.type}</span>
                  </th>
                  <td>{row.title}</td>
                  <td>{row.state}</td>
                  <td>{row.assignee ?? messages.dashboard.unassigned}</td>
                  <td className="number">{hoursText(row.hours)}</td>
                  <td>
                    {last === undefined ? (
                      text.noComment
                    ) : (
                      <>
                        <span className="hint">
                          {text.commentOf(last.by, dateTimeText(last.at))}
                        </span>{' '}
                        {!open && `«${preview(last.text)}»`}{' '}
                        <button
                          type="button"
                          className="quiet"
                          aria-expanded={open}
                          aria-label={open ? text.close(row.id) : text.open(row.id)}
                          onClick={() => setDiaryOf(open ? null : row.id)}
                        >
                          {text.diary(row.id, row.comments.length)}
                        </button>
                        {open && (
                          <ol
                            className="activity-diary"
                            aria-label={text.diary(row.id, row.comments.length)}
                          >
                            {row.comments.map((comment) => (
                              <li key={`${comment.at} ${comment.by}`}>
                                <span className="hint">
                                  {text.commentOf(comment.by, dateTimeText(comment.at))}
                                </span>
                                <br />
                                {comment.text.replace(/<[^>]+>/g, ' ')}
                              </li>
                            ))}
                          </ol>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" colSpan={4}>
                {text.total}
              </th>
              <td className="number">{hoursText(hours)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
      {otherHours > 0 && <p className="hint">{text.otherHours(hoursText(otherHours))}</p>}
      <h3>{text.people}</h3>
      {people.length === 0 ? (
        <p className="hint">{text.noHours}</p>
      ) : (
        <div className="table-wide table-intrinsic">
          <table className="data" aria-label={text.people}>
            <thead>
              <tr>
                <th scope="col">{text.columnPerson}</th>
                <th scope="col" className="number">
                  {text.columnHours}
                </th>
                {capped && <th scope="col">{text.columnCap}</th>}
              </tr>
            </thead>
            <tbody>
              {people.map((person) => (
                <tr key={person.person}>
                  <th scope="row">{person.person}</th>
                  <td className="number">{hoursText(person.hours)}</td>
                  {capped && (
                    <td>
                      {person.capHours === null ? (
                        text.noCap
                      ) : (
                        <>
                          {text.cap(
                            hoursText(person.capHours),
                            hoursText(person.capHours / HOURS_PER_DAY),
                            shareText(person.hours / person.capHours),
                          )}
                          {person.hours > person.capHours && (
                            <>
                              {' '}
                              <span className="pill pill-late">{text.overCap}</span>
                            </>
                          )}
                        </>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
