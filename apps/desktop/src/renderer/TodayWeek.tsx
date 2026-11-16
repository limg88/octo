import type { TodayItem, WeekEntry, WeekView } from '@octo/domain'
import { messages } from './messages.ts'
import { shortDayText, signalText, weekdayText } from './today-text.ts'

const text = messages.today.week

type Props = {
  week: WeekView
  /** Opens the place a signal is put right in. */
  onOpen: (item: TodayItem) => void
  onOpenRisks: () => void
}

/** What a critical thing is, and what is known of it, in a title and a line. */
function wordsOf(entry: WeekEntry): { label: string; title: string; detail: string } {
  const { what } = entry
  switch (what.kind) {
    case 'point': {
      const { point } = what.entry
      return {
        label: text.kinds.point,
        title: point.title,
        detail: [
          point.owner === '' ? messages.today.points.mine : messages.today.points.of(point.owner),
          ...(point.due === null ? [messages.today.points.openFor(what.entry.openWorkdays)] : []),
        ].join(' · '),
      }
    }
    case 'risk':
      return {
        label: what.risk.severity ? text.risk(what.risk.severity) : text.kinds.risk,
        title: what.risk.title,
        detail: what.risk.note,
      }
    case 'sprint_end':
      return { label: text.kinds.sprint, title: text.sprintEnd, detail: '' }
    case 'signal': {
      const words = signalText(what.item)
      return {
        label: messages.today.kinds[what.item.facts.kind],
        title: words.title,
        detail: words.detail,
      }
    }
  }
}

function whenOf(entry: WeekEntry): string {
  if (entry.overdueDays > 0) return text.overdue(entry.overdueDays)
  if (entry.day === null) return entry.side === 'ongoing' ? text.now : text.thisWeek
  return `${weekdayText(entry.day)} ${shortDayText(entry.day).slice(0, 5)}`
}

function WeekList(
  props: { label: string; entries: WeekEntry[]; empty: string } & Omit<Props, 'week'>,
) {
  return (
    <div className="today-week-side">
      <span className="eyebrow">
        {props.label} · {props.entries.length}
      </span>
      {props.entries.length === 0 ? (
        <p className="today-empty">{props.empty}</p>
      ) : (
        <ul className="today-point-list" aria-label={props.label}>
          {props.entries.map((entry) => {
            const words = wordsOf(entry)
            const { what } = entry
            return (
              <li key={entry.key} className="today-point">
                <span
                  className={
                    entry.overdueDays > 0 ? 'today-week-when today-week-late' : 'today-week-when'
                  }
                >
                  {whenOf(entry)}
                </span>
                <div className="today-point-what">
                  <span className="pill">{words.label}</span> <strong>{words.title}</strong>
                  {words.detail !== '' && (
                    <span className="hint today-point-facts">{words.detail}</span>
                  )}
                </div>
                {what.kind === 'signal' && (
                  <button
                    type="button"
                    className="quiet"
                    aria-label={`${messages.today.open[what.item.target]}: ${words.title}`}
                    onClick={() => props.onOpen(what.item)}
                  >
                    {messages.today.open[what.item.target]}
                  </button>
                )}
                {what.kind === 'risk' && (
                  <button
                    type="button"
                    className="quiet"
                    aria-label={`${text.openRisks}: ${words.title}`}
                    onClick={props.onOpenRisks}
                  >
                    {text.openRisks}
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

/** The critical things of the week, by date: what is to put right now, and what is coming. */
export function TodayWeek({ week, onOpen, onOpenRisks }: Props) {
  if (week.ongoing.length + week.coming.length === 0) return null
  return (
    <section className="panel today-week" aria-label={text.title}>
      <h4 className="today-title" title={text.hint}>
        {text.title}
        <span className="today-count">{text.until(shortDayText(week.until))}</span>
      </h4>
      <div className="today-week-sides">
        <WeekList
          label={text.ongoing}
          entries={week.ongoing}
          empty={text.noneOngoing}
          onOpen={onOpen}
          onOpenRisks={onOpenRisks}
        />
        <WeekList
          label={text.coming}
          entries={week.coming}
          empty={text.noneComing}
          onOpen={onOpen}
          onOpenRisks={onOpenRisks}
        />
      </div>
    </section>
  )
}
