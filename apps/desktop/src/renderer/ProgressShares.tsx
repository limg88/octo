import type { OrderPosition, ProgressStep } from '@octo/domain'
import { type DataColumn, DataTable } from './DataTable.tsx'
import { messages } from './messages.ts'

const text = messages.progress

type Props = { step: ProgressStep; positions: readonly OrderPosition[] }

/** A position with its place in the order: the shares of a step are read by place. */
type Line = { position: OrderPosition; index: number }

/** The share of each position before, after and because of one request. */
export function ProgressShares({ step, positions }: Props) {
  const share = (key: string, label: string, of: (index: number) => number): DataColumn<Line> => ({
    key,
    label,
    kind: 'number',
    width: '130px',
    cell: (line) => text.share(of(line.index)),
    sort: (line) => of(line.index),
  })
  const columns: DataColumn<Line>[] = [
    {
      key: 'position',
      label: text.columnPosition,
      cell: (line) => line.position.code,
      sort: (line) => line.position.code,
      text: (line) => line.position.code,
    },
    {
      key: 'amount',
      label: text.columnAmount,
      kind: 'number',
      width: '140px',
      cell: (line) => text.money(line.position.amount),
      sort: (line) => line.position.amount,
    },
    share('previous', text.columnPrevious, (index) => step.previous[index] ?? 0),
    share('current', text.columnCurrent, (index) => step.current[index] ?? 0),
    share('period', text.columnPeriod, (index) => step.period[index] ?? 0),
  ]
  return (
    <DataTable
      label={text.columnPosition}
      columns={columns}
      rows={positions.map((position, index) => ({ position, index }))}
      rowKey={(line) => line.position.code}
    />
  )
}
