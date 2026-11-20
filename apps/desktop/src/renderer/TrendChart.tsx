import type { TrendBucket } from '@octo/domain'
import { dateText, messages } from './messages.ts'

const text = messages.dashboard
const WIDTH = 720
const HEIGHT = 200
const PAD = { top: 12, right: 12, bottom: 22, left: 34 }
const BAR_SHARE = 0.36
/** More labels than this under the chart would overlap. */
const MAX_LABELS = 9

/** What entered and what left in every step, as bars, and the open bugs at its end, as a line. */
export function TrendChart({ trend }: { trend: TrendBucket[] }) {
  if (trend.length === 0) return null
  const top = Math.max(1, ...trend.flatMap((step) => [step.entered, step.closed, step.openAtEnd]))
  const innerWidth = WIDTH - PAD.left - PAD.right
  const innerHeight = HEIGHT - PAD.top - PAD.bottom
  const slot = innerWidth / trend.length
  const bar = slot * BAR_SHARE
  const y = (value: number) => PAD.top + innerHeight - (value / top) * innerHeight
  const center = (index: number) => PAD.left + slot * index + slot / 2
  const line = trend.map((step, index) => `${center(index)},${y(step.openAtEnd)}`).join(' ')
  const labelEvery = Math.ceil(trend.length / MAX_LABELS)
  return (
    <div className="trend">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={text.trendTitle}>
        <line className="trend-axis" x1={PAD.left} x2={WIDTH - PAD.right} y1={y(0)} y2={y(0)} />
        <line className="trend-grid" x1={PAD.left} x2={WIDTH - PAD.right} y1={y(top)} y2={y(top)} />
        <text className="trend-label" x={PAD.left - 6} y={y(top) + 4} textAnchor="end">
          {top}
        </text>
        <text className="trend-label" x={PAD.left - 6} y={y(0) + 4} textAnchor="end">
          0
        </text>
        {trend.map((step, index) => (
          <g key={step.from}>
            <rect
              className="trend-entered"
              x={center(index) - bar}
              y={y(step.entered)}
              width={bar}
              height={y(0) - y(step.entered)}
            />
            <rect
              className="trend-closed"
              x={center(index)}
              y={y(step.closed)}
              width={bar}
              height={y(0) - y(step.closed)}
            />
            {index % labelEvery === 0 && (
              <text className="trend-label" x={center(index)} y={HEIGHT - 6} textAnchor="middle">
                {step.from.slice(8, 10)}/{step.from.slice(5, 7)}
              </text>
            )}
          </g>
        ))}
        <polyline className="trend-open" points={line} />
      </svg>
      <ul className="trend-legend">
        <li className="legend-entered">{text.entered}</li>
        <li className="legend-closed">{text.closedInStep}</li>
        <li className="legend-open">{text.openAtEnd}</li>
      </ul>
      <details className="trend-numbers">
        <summary>{text.trendNumbers}</summary>
        <table className="data">
          <thead>
            <tr>
              <th>{text.stepFrom}</th>
              <th className="number">{text.entered}</th>
              <th className="number">{text.closedInStep}</th>
              <th className="number">{text.openAtEnd}</th>
            </tr>
          </thead>
          <tbody>
            {trend.map((step) => (
              <tr key={step.from}>
                <td>{dateText(step.from)}</td>
                <td className="number">{step.entered}</td>
                <td className="number">{step.closed}</td>
                <td className="number">{step.openAtEnd}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  )
}
