import type { OrderPosition, ProgressStep } from '@octo/domain'
import { messages } from './messages.ts'

const text = messages.progress

type Props = { step: ProgressStep; positions: readonly OrderPosition[] }

/** The share of each position before, after and because of one request. */
export function ProgressShares({ step, positions }: Props) {
  return (
    <table className="data">
      <thead>
        <tr>
          <th>{text.columnPosition}</th>
          <th className="number">{text.columnAmount}</th>
          <th className="number">{text.columnPrevious}</th>
          <th className="number">{text.columnCurrent}</th>
          <th className="number">{text.columnPeriod}</th>
        </tr>
      </thead>
      <tbody>
        {positions.map((position, index) => (
          <tr key={position.code}>
            <td>{position.code}</td>
            <td className="number">{text.money(position.amount)}</td>
            <td className="number">{text.share(step.previous[index] ?? 0)}</td>
            <td className="number">{text.share(step.current[index] ?? 0)}</td>
            <td className="number">{text.share(step.period[index] ?? 0)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
