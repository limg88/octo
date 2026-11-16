import { describe, expect, it } from 'vitest'
import {
  cleanProgressSettings,
  computeProgress,
  DEFAULT_PROGRESS_SETTINGS,
  type InvoiceLine,
  invoicedOrder,
  invoiceLineOf,
  knownSalesOrders,
  type OrderPosition,
  orderInvoices,
  type ProgressRequest,
  type ProgressSettings,
  progressFormCells,
  progressWarnings,
  suggestedSalesOrders,
  withInvoicesAsRequests,
} from '../src/index.ts'

const positions: OrderPosition[] = [
  { code: '00001', amount: 100000 },
  { code: '00002', amount: 60000 },
  { code: '00003', amount: 142000 },
  { code: '00004', amount: 38000 },
]
const request = (
  n: number,
  amount: number,
  codes: string[] = [],
  from = '2026-03-01',
  to = '2026-03-31',
): ProgressRequest => ({ n, from, to, amount, note: `Fattura ${n}`, positions: codes })

function steps(requests: ProgressRequest[], order = positions) {
  const computation = computeProgress(order, requests)
  if (!computation.ok) throw new Error(computation.problem.kind)
  return computation.steps
}

describe('the share of each position', () => {
  it('fills the positions one after the other from the running total', () => {
    const [first, second, third] = steps([request(1, 289540), request(2, 20000), request(3, 30460)])
    expect(first?.current).toEqual([1, 1, 0.9123, 0])
    expect(first?.previous).toEqual([0, 0, 0, 0])
    expect(first?.period).toEqual([1, 1, 0.9123, 0])
    expect(first?.closing).toBe(false)
    expect(first?.rebuilt).toBe(289546.6)
    expect(second?.cumulative).toBe(309540)
    expect(second?.previous).toEqual(first?.current)
    expect(second?.current).toEqual([1, 1, 1, 0.1984])
    expect(second?.period).toEqual([0, 0, 0.0877, 0.1984])
    expect(third?.closing).toBe(true)
    expect(third?.current).toEqual([1, 1, 1, 1])
    expect(third?.period).toEqual([0, 0, 0, 0.8016])
    expect(third?.rebuilt).toBe(340000)
  })

  it('closes every position at 100% on the request that reaches the total', () => {
    const order = [
      { code: 'A', amount: 100 },
      { code: 'B', amount: 0.03 },
    ]
    const [only] = steps([request(1, 100.03)], order)
    expect(only?.closing).toBe(true)
    expect(only?.current).toEqual([1, 1])
  })

  it('fills only the positions a request names, then goes on from there', () => {
    const [first, second, third] = steps([
      request(1, 50000, ['00004', '00001']),
      request(2, 30000, ['00002']),
      request(3, 71000, ['00003']),
    ])
    expect(first?.current).toEqual([0.12, 0, 0, 1])
    expect(second?.current).toEqual([0.12, 0.5, 0, 1])
    expect(third?.current).toEqual([0.12, 0.5, 0.5, 1])
    expect(third?.period).toEqual([0, 0, 0.5, 0])
  })

  it('says what makes the requests impossible', () => {
    expect(computeProgress([], [request(1, 10)])).toEqual({
      ok: false,
      total: 0,
      problem: { kind: 'no_positions' },
    })
    expect(computeProgress(positions, [request(1, 340000.5)])).toMatchObject({
      ok: false,
      problem: { kind: 'over_total', n: 1, excess: 0.5 },
    })
    expect(computeProgress(positions, [request(1, 10, ['00009', '00001'])])).toMatchObject({
      problem: { kind: 'unknown_positions', n: 1, codes: ['00009'] },
    })
    expect(computeProgress(positions, [request(1, 40000, ['00004'])])).toMatchObject({
      problem: { kind: 'over_positions', n: 1, excess: 2000 },
    })
    expect(computeProgress(positions, [])).toEqual({ ok: true, total: 340000, steps: [] })
  })
})

const settings: ProgressSettings = {
  modelPath: 'Moduli/Richiesta.xlsx',
  order: 'ORD-77',
  salesOrders: [],
  total: 340000,
  positions,
  requests: [
    request(1, 289540, [], '2026-03-01', '2026-03-31'),
    request(2, 20000, ['00003', '00004'], '2026-03-31', '2026-04-30'),
  ],
  form: {
    fields: [
      { ref: 'D2', text: '{n}' },
      { ref: 'C8', text: '{ordine} - pos.{posizioni}' },
      { ref: 'B13', text: 'AL : {al_precedente}' },
      { ref: 'C13', text: 'AL : {al}' },
      { ref: 'A21', text: '{dal} {ignoto}' },
      { ref: 'A24', text: '{nota}' },
      { ref: 'A6', text: 'Fornitore Uno' },
    ],
    table: { firstRow: 14, rows: 5, position: 'A', previous: 'B', current: 'C', period: 'D' },
  },
}

describe('the cells of the form', () => {
  it('replaces the names of the map and writes one row per position', () => {
    const [first, second] = steps(settings.requests)
    if (!first || !second) throw new Error('two steps')
    const cells = progressFormCells(settings, second, first.request.to)
    if (!cells.ok) throw new Error(cells.problem.kind)
    const at = (ref: string) => cells.writes.find((write) => write.ref === ref)?.cell
    expect(at('D2')).toEqual({ kind: 'number', value: 2 })
    expect(at('C8')).toEqual({ kind: 'text', value: 'ORD-77 - pos.00003:00004' })
    expect(at('B13')).toEqual({ kind: 'text', value: 'AL : 31/03/2026' })
    expect(at('C13')).toEqual({ kind: 'text', value: 'AL : 30/04/2026' })
    expect(at('A21')).toEqual({ kind: 'text', value: '31/03/2026 {ignoto}' })
    expect(at('A24')).toEqual({ kind: 'text', value: 'Fattura 2' })
    expect(at('A6')).toEqual({ kind: 'text', value: 'Fornitore Uno' })
    expect(at('A16')).toEqual({ kind: 'text', value: '00003' })
    expect(at('B16')).toEqual({ kind: 'number', value: 0.9123, percent: true })
    expect(at('C16')).toEqual({ kind: 'number', value: 1, percent: true })
    expect(at('D16')).toEqual({ kind: 'number', value: 0.0877, percent: true })
    // The row the order does not need is emptied.
    for (const ref of ['A18', 'B18', 'C18', 'D18']) expect(at(ref)).toEqual({ kind: 'empty' })
    expect(cells.writes).toHaveLength(7 + 5 * 4)
  })

  it('names every position, or the only one, when the request names none', () => {
    const [first] = steps(settings.requests)
    if (!first) throw new Error('a step')
    const all = progressFormCells(
      { ...settings, form: { ...settings.form, table: null } },
      first,
      '',
    )
    expect(all.ok && all.writes.find((write) => write.ref === 'C8')?.cell).toEqual({
      kind: 'text',
      value: 'ORD-77 - pos.00001:00004',
    })
    expect(all.ok && all.writes.find((write) => write.ref === 'B13')?.cell).toEqual({
      kind: 'text',
      value: 'AL : ',
    })
    expect(all.ok && all.writes).toHaveLength(7)
    const one = { ...first, request: { ...first.request, positions: ['00002'] } }
    const single = progressFormCells(settings, one, '')
    expect(single.ok && single.writes[1]?.cell).toEqual({
      kind: 'text',
      value: 'ORD-77 - pos.00002',
    })
  })

  it('refuses a table with fewer rows than the order has positions', () => {
    const [first] = steps(settings.requests)
    if (!first) throw new Error('a step')
    const small = {
      ...settings,
      form: { ...settings.form, table: { ...settings.form.table, rows: 3 } },
    }
    expect(progressFormCells(small as ProgressSettings, first, '')).toEqual({
      ok: false,
      problem: { kind: 'too_many_positions', rows: 3, positions: 4 },
    })
  })
})

describe('the settings of the progress requests', () => {
  it('warn about what the PM should look at', () => {
    expect(progressWarnings(settings)).toEqual([])
    expect(
      progressWarnings({
        ...settings,
        total: 350000,
        requests: [
          { ...request(1, 10), to: '' },
          { ...request(2, 10, [], '2026-05-01'), note: '' },
          request(3, 10, [], '2026-04-01', '2026-04-30'),
        ],
      }),
    ).toEqual([
      { kind: 'total_differs', declared: 350000, positions: 340000 },
      { kind: 'dates_missing', n: 1 },
      { kind: 'note_missing', n: 2 },
      { kind: 'dates_not_chained', n: 3 },
    ])
    expect(progressWarnings({ ...settings, total: null })).toEqual([])
  })

  it('are made tidy: positions once, requests numbered, a map that names real cells', () => {
    const clean = cleanProgressSettings({
      modelPath: ' Moduli/Richiesta.xlsx ',
      order: ' ORD-77 ',
      salesOrders: [' SO-1 ', 'SO-1', ''],
      total: -1,
      positions: [
        { code: ' 1 ', amount: 100.004 },
        { code: '1', amount: 5 },
        { code: '', amount: 5 },
        { code: '2', amount: 0 },
      ],
      requests: [
        { n: 7, from: '31/03/2026', to: ' 2026-03-31 ', amount: 0, note: '', positions: [] },
        {
          n: 9,
          from: '2026-03-31',
          to: 'x',
          amount: 50.005,
          note: ' nota ',
          positions: [' 1 ', '1', ''],
        },
      ],
      form: {
        fields: [
          { ref: ' d2 ', text: ' {n} ' },
          { ref: 'D', text: 'x' },
          { ref: 'A1', text: ' ' },
        ],
        table: { firstRow: 14, rows: 6, position: ' a ', previous: 'b', current: 'c', period: 'd' },
      },
    })
    expect(clean).toEqual({
      modelPath: 'Moduli/Richiesta.xlsx',
      order: 'ORD-77',
      salesOrders: ['SO-1'],
      total: null,
      positions: [{ code: '1', amount: 100 }],
      requests: [
        { n: 1, from: '2026-03-31', to: '', amount: 50.01, note: 'nota', positions: ['1'] },
      ],
      form: {
        fields: [{ ref: 'D2', text: '{n}' }],
        table: { firstRow: 14, rows: 6, position: 'A', previous: 'B', current: 'C', period: 'D' },
      },
    })
    const table = { firstRow: 14, rows: 6, position: 'A', previous: 'B', current: 'C', period: 'D' }
    for (const wrong of [{ firstRow: 0 }, { rows: 1.5 }, { rows: 500 }, { period: 'D4' }]) {
      const form = { fields: [], table: { ...table, ...wrong } }
      expect(cleanProgressSettings({ ...DEFAULT_PROGRESS_SETTINGS, form }).form.table).toBeNull()
    }
    expect(cleanProgressSettings({ ...DEFAULT_PROGRESS_SETTINGS, total: 10.004 }).total).toBe(10)
  })
})

describe('the order as the company system billed it', () => {
  const line = (
    invoiceId: string,
    amount: number,
    salesOrder: string,
    date = '2026-09-30',
  ): InvoiceLine => ({ invoiceId, date, amount, status: 'Open', salesOrder })
  const lines = [
    line('2026/01797', 60000, 'SO-5320', '2026-10-31'),
    // One invoice on two project codes: its lines are one amount.
    line('2026/01530', 70000, 'SO-5320'),
    line('2026/01530', 30000, 'SO-5320'),
    line('2026/00582', 60000, 'SO-4697', '2026-03-31'),
    line('2026/01244', -60000, '', '2026-07-31'),
  ]
  const linked = { ...settings, requests: [], salesOrders: ['SO-5320'] }

  it('reads a line of an invoice from a row of the view, or nothing', () => {
    expect(
      invoiceLineOf({
        invoiceid: '2026/01530',
        invoicedate: '2026-09-30T00:00:00.000Z',
        amount: '42130.0000',
        status: 'Open',
        salesorder: 'SO2026_5320',
      }),
    ).toEqual({
      invoiceId: '2026/01530',
      date: '2026-09-30',
      amount: 42130,
      status: 'Open',
      salesOrder: 'SO2026_5320',
    })
    expect(invoiceLineOf({ invoiceid: '2026/1', amount: 10 })).toMatchObject({
      date: '',
      salesOrder: '',
    })
    expect(invoiceLineOf({ invoiceid: '', amount: 10 })).toBeNull()
    expect(invoiceLineOf({ invoiceid: '2026/1', amount: 'molti' })).toBeNull()
    expect(invoiceLineOf({ invoiceid: '2026/1', amount: null })).toBeNull()
  })

  it('lists the sales orders, and proposes those billed for the amounts of the positions', () => {
    expect(knownSalesOrders(lines)).toEqual(['SO-4697', 'SO-5320'])
    // Both have an invoice of 60000, the amount of a position: the PM says which is the order.
    expect(suggestedSalesOrders(lines, positions)).toEqual(['SO-4697', 'SO-5320'])
    expect(suggestedSalesOrders(lines, [{ code: 'A', amount: 1 }])).toEqual([])
  })

  it('adds up the invoices of the orders given, oldest first', () => {
    expect(orderInvoices(lines, ['SO-5320'])).toEqual([
      {
        id: '2026/01530',
        date: '2026-09-30',
        amount: 100000,
        status: 'Open',
        salesOrder: 'SO-5320',
      },
      {
        id: '2026/01797',
        date: '2026-10-31',
        amount: 60000,
        status: 'Open',
        salesOrder: 'SO-5320',
      },
    ])
    expect(orderInvoices(lines, [])).toEqual([])
  })

  it('compares nothing until the PM says which sales orders are the order', () => {
    expect(invoicedOrder(settings, lines)).toBeNull()
  })

  it('says what is billed, which position has its invoice and what Octo does not know', () => {
    const invoiced = invoicedOrder(linked, lines)
    expect(invoiced).toMatchObject({ invoiced: 160000, remaining: 180000, fulfilled: false })
    expect(invoiced?.positions.map((position) => position.invoice?.id ?? null)).toEqual([
      '2026/01530',
      '2026/01797',
      null,
      null,
    ])
    expect(invoiced?.unregistered.map((invoice) => invoice.id)).toEqual([
      '2026/01530',
      '2026/01797',
    ])

    // A request that names an invoice as its reference is that invoice, already known.
    const known = invoicedOrder(
      { ...linked, requests: [{ ...request(1, 100000), note: 'Fattura 2026/01530' }] },
      lines,
    )
    expect(known?.unregistered.map((invoice) => invoice.id)).toEqual(['2026/01797'])
  })

  it('says an order fulfilled when what is billed reaches its total', () => {
    const all = [...lines, line('2026/02000', 180000, 'SO-5320', '2026-11-30')]
    expect(invoicedOrder(linked, all)).toMatchObject({ remaining: 0, fulfilled: true })
    expect(invoicedOrder({ ...linked, positions: [] }, all)).toMatchObject({ fulfilled: false })
  })

  it('takes the invoices it did not know as requests, each to the position of its amount', () => {
    const invoiced = invoicedOrder(linked, [
      ...lines,
      line('2026/01900', 500, 'SO-5320', '2026-11-15'),
    ])
    if (invoiced === null) throw new Error('not linked')
    const { requests } = cleanProgressSettings(withInvoicesAsRequests(linked, invoiced))
    expect(requests).toEqual([
      {
        n: 1,
        from: '2026-09-01',
        to: '2026-09-30',
        amount: 100000,
        note: '2026/01530',
        positions: ['00001'],
      },
      {
        n: 2,
        from: '2026-09-30',
        to: '2026-10-31',
        amount: 60000,
        note: '2026/01797',
        positions: ['00002'],
      },
      // An invoice of no position's amount fills the order from its first open position.
      {
        n: 3,
        from: '2026-10-31',
        to: '2026-11-15',
        amount: 500,
        note: '2026/01900',
        positions: [],
      },
    ])
    expect(computeProgress(linked.positions, requests)).toMatchObject({ ok: true })
    expect(invoicedOrder({ ...linked, requests }, lines)?.unregistered).toEqual([])
  })
})
