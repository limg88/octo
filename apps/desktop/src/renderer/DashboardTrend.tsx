import type { DashboardComment, DashboardRange, DashboardView as View } from '@octo/application'
import type { ErrorCode } from '../shared/api.ts'
import { Figure, OpenItem } from './DashboardParts.tsx'
import { Failure } from './Failure.tsx'
import { dateTimeText, messages } from './messages.ts'
import { BusyButton } from './Spinner.tsx'
import { TrendChart } from './TrendChart.tsx'

const text = messages.dashboard

type Props = {
  view: View
  /** The period the page shows, as whole days. */
  range: DashboardRange
  comment: DashboardComment | null
  commenting: boolean
  commentError: ErrorCode | null
  canAsk: boolean
  onComment: () => void
  onOpenItem: ((id: string) => void) | undefined
}

const sameRange = (a: DashboardRange, b: DashboardRange): boolean =>
  a.from === b.from && a.to === b.to && a.granularity === b.granularity

/** How the bugs moved over the period, where they stop, and what Claude says of it when asked. */
export function DashboardTrend({
  view,
  range,
  comment,
  commenting,
  commentError,
  canAsk,
  onComment,
  onOpenItem,
}: Props) {
  const { flow, flowBefore } = view.bugs
  const old =
    comment !== null && (comment.exportedAt !== view.exportedAt || !sameRange(comment.range, range))
  return (
    <>
      <section aria-label={text.trendTitle}>
        <h3>{text.trendTitle}</h3>
        {view.bugs.trendSource === 'approximate' && <p className="hint">{text.trendApproximate}</p>}
        <TrendChart trend={view.bugs.trend} />
      </section>
      {flow && (
        <section aria-label={text.flowTitle}>
          <div className="gaps-title">
            <h3>{text.flowTitle}</h3>
            <span className="hint">{text.flowIntro}</span>
          </div>
          <dl className="figures">
            {(['toVerify', 'toValidated', 'toClosed'] as const).map((step) => (
              <Figure
                key={step}
                label={text[step]}
                value={flow[step].median === null ? null : text.days(flow[step].median)}
                note={[
                  text.sample(flow[step].sample),
                  text.flowBefore(flowBefore?.[step].median ?? null),
                ]
                  .filter(Boolean)
                  .join(' · ')}
              />
            ))}
          </dl>
        </section>
      )}
      <section aria-label={text.commentTitle}>
        <div className="title-row">
          <h3>{text.commentTitle}</h3>
          <div className="actions">
            {!canAsk && <span className="hint">{text.needsClaude}</span>}
            <BusyButton
              busy={commenting}
              busyLabel={text.commenting}
              disabled={!canAsk}
              onClick={onComment}
            >
              {comment ? text.commentAgain : text.comment}
            </BusyButton>
          </div>
        </div>
        <p className="hint">{text.commentIntro}</p>
        {commentError && <Failure code={commentError} />}
        {comment && (
          <div className={old ? 'box box-warning' : 'box box-source'}>
            <strong>{text.commentOf(dateTimeText(comment.at))}</strong>
            {old && <p className="hint">{text.commentOld}</p>}
            {comment.sentences.length === 0 ? (
              <p className="hint">{text.commentEmpty}</p>
            ) : (
              <ul className="comment">
                {comment.sentences.map((sentence) => (
                  <li key={sentence.text}>
                    {sentence.text}
                    {sentence.ids.map((id) => (
                      <OpenItem key={id} id={id} onOpen={onOpenItem} />
                    ))}
                  </li>
                ))}
              </ul>
            )}
            {comment.dropped > 0 && <p className="hint">{text.commentDropped(comment.dropped)}</p>}
          </div>
        )}
      </section>
    </>
  )
}
