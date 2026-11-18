// @vitest-environment jsdom
import type { TodayView } from '@octo/application'
import type { Project } from '@octo/domain'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { type DataColumn, DataTable } from '../src/renderer/DataTable.tsx'
import { KnownList } from '../src/renderer/KnownList.tsx'
import { messages } from '../src/renderer/messages.ts'
import { type Row, RowsField } from '../src/renderer/RowsField.tsx'
import { TodaySettings } from '../src/renderer/TodaySettings.tsx'
import type { Result } from '../src/shared/api.ts'

const ok = <T,>(value: T): Result<T> => ({ ok: true, value })
const project: Project = { id: 'p-1', name: 'Aurora', folder: '/progetti/Aurora', addedAt: '' }

afterEach(cleanup)

type Bug = { id: string; title: string; days: number | null }
const BUGS: Bug[] = [
  { id: '10', title: 'Login lento', days: 12 },
  { id: '9', title: 'Errore di stampa', days: null },
  { id: '100', title: 'Mappa vuota', days: 3 },
  { id: '11', title: 'Filtro perso', days: 30 },
  { id: '12', title: 'Data sbagliata', days: 7 },
  { id: '13', title: 'Menu tagliato', days: 1 },
]
const COLUMNS: DataColumn<Bug>[] = [
  { key: 'id', label: 'Id', cell: (bug) => bug.id, sort: (bug) => bug.id, text: (bug) => bug.id },
  {
    key: 'title',
    label: 'Titolo',
    cell: (bug) => bug.title,
    sort: (bug) => bug.title,
    text: (bug) => bug.title,
  },
  {
    key: 'days',
    label: 'Giorni',
    kind: 'number',
    cell: (bug) => bug.days ?? '—',
    sort: (bug) => bug.days,
  },
  {
    key: 'open',
    label: '',
    name: 'Azioni',
    kind: 'actions',
    cell: (bug) => <button type="button">Apri {bug.id}</button>,
  },
]

/** The first cell of every row of the body, in the order shown. */
const firstCells = (): string[] =>
  within(screen.getByRole('table'))
    .getAllByRole('row')
    .map((row) => within(row).queryAllByRole('cell')[0]?.textContent)
    .filter((cell) => cell !== undefined)

describe('a table of data', () => {
  const table = (rows: Bug[] = BUGS) => (
    <DataTable label="Bug" columns={COLUMNS} rows={rows} rowKey={(bug) => bug.id} />
  )

  it('puts the rows in order by a heading: up, down, then as they were given', () => {
    render(table())
    expect(firstCells()).toEqual(['10', '9', '100', '11', '12', '13'])

    // Codes are read as numbers where they are numbers: 9 comes before 10, 100 last.
    const byId = screen.getByRole('button', { name: /^Id/ })
    fireEvent.click(byId)
    expect(firstCells()).toEqual(['9', '10', '11', '12', '13', '100'])
    expect(screen.getByRole('columnheader', { name: /^Id/ }).getAttribute('aria-sort')).toBe(
      'ascending',
    )
    fireEvent.click(byId)
    expect(firstCells()).toEqual(['100', '13', '12', '11', '10', '9'])
    fireEvent.click(byId)
    expect(firstCells()).toEqual(['10', '9', '100', '11', '12', '13'])

    // A cell that holds nothing is never the first row, in either direction.
    const byDays = screen.getByRole('button', { name: /^Giorni/ })
    fireEvent.click(byDays)
    expect(firstCells()).toEqual(['13', '100', '12', '10', '11', '9'])
    fireEvent.click(byDays)
    expect(firstCells()).toEqual(['11', '10', '12', '100', '13', '9'])

    // A column of buttons has a name for who cannot see it, and is not sorted.
    const actions = screen.getByRole('columnheader', { name: 'Azioni' })
    expect(actions.getAttribute('aria-sort')).toBeNull()
  })

  it('finds the rows that hold every word typed, and says how many', () => {
    render(table())
    const filter = screen.getByRole('searchbox', { name: messages.table.filterOf('Bug') })
    fireEvent.change(filter, { target: { value: 'di' } })
    expect(firstCells()).toEqual(['9'])
    expect(screen.getByRole('status').textContent).toBe(messages.table.shown(1, 6))

    fireEvent.change(filter, { target: { value: 'nulla di simile' } })
    expect(screen.getByText(messages.table.none)).toBeTruthy()
  })

  it('offers no filter while every row is in sight, and shows totals and details', () => {
    render(
      <DataTable
        label="Bug"
        columns={COLUMNS}
        rows={BUGS.slice(0, 2)}
        rowKey={(bug) => bug.id}
        groups={[
          { label: 'Che cosa', span: 2 },
          { label: 'Il resto', span: 2 },
        ]}
        detail={(bug) => bug.id === '9' && <p>Dettaglio di {bug.id}</p>}
        initialOrder={{ key: 'title', direction: 'ascending' }}
        rowClassName={(bug) => (bug.days === null ? 'muted' : undefined)}
        footer={
          <tr>
            <td colSpan={4}>Totale: 2</td>
          </tr>
        }
      />,
    )
    expect(screen.queryByRole('searchbox')).toBeNull()
    expect(screen.getByText('Che cosa')).toBeTruthy()
    expect(screen.getByText('Dettaglio di 9')).toBeTruthy()
    expect(screen.getByText('Totale: 2')).toBeTruthy()
    expect(firstCells().slice(0, 1)).toEqual(['9'])
  })
})

describe('a list of known values', () => {
  function Tags({ known, start = [] }: { known: string[]; start?: string[] }) {
    const [chosen, setChosen] = useState<string[]>(start)
    return <KnownList label="Tag" known={known} chosen={chosen} onChange={setChosen} />
  }
  const MANY = Array.from({ length: 40 }, (_unused, at) => `CAES-${3000 + at}`)

  it('takes typed values one per line while nothing is known, commas and all', () => {
    const seen: string[][] = []
    function People() {
      const [chosen, setChosen] = useState<string[]>(['Rossi, Mario'])
      seen.push(chosen)
      return <KnownList label="Persone" known={[]} chosen={chosen} onChange={setChosen} />
    }
    render(<People />)
    const field = screen.getByLabelText<HTMLTextAreaElement>('Persone')
    expect(field.value).toBe('Rossi, Mario')
    expect(screen.getByText(messages.lineList)).toBeTruthy()

    fireEvent.change(field, { target: { value: ' Rossi, Mario \n\nBianchi, Anna\n' } })

    expect(seen.at(-1)).toEqual(['Rossi, Mario', 'Bianchi, Anna'])
  })

  it('keeps many values in a list that is searched, with the chosen ones above it', () => {
    render(<Tags known={MANY} start={['CAES-3001', 'vecchio']} />)
    const chosen = screen.getByRole('list', { name: messages.knownList.chosen('Tag') })
    expect(within(chosen).getByText('CAES-3001')).toBeTruthy()
    // What was chosen before and is no longer known stays, so it can be taken off.
    expect(within(chosen).getByText('vecchio')).toBeTruthy()
    expect(screen.getAllByRole('checkbox')).toHaveLength(41)

    const search = screen.getByRole('searchbox', { name: messages.knownList.searchIn('Tag') })
    fireEvent.change(search, { target: { value: '3039' } })
    expect(screen.getAllByRole('checkbox')).toHaveLength(1)
    fireEvent.click(screen.getByLabelText('CAES-3039'))
    expect(within(chosen).getByText('CAES-3039')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: messages.knownList.remove('vecchio') }))
    expect(within(chosen).queryByText('vecchio')).toBeNull()

    fireEvent.change(search, { target: { value: 'niente' } })
    expect(screen.getByText(messages.knownList.nothingFound)).toBeTruthy()
  })

  it('folds a long list in a form, leaving in sight what is chosen and how to take it off', () => {
    function Folded({ known }: { known: string[] }) {
      const [chosen, setChosen] = useState<string[]>(['CAES-3001', 'vecchio'])
      return (
        <KnownList label="Tag" known={known} chosen={chosen} onChange={setChosen} foldOptions />
      )
    }
    const long = render(<Folded known={MANY} />)
    const chosen = screen.getByRole('list', { name: messages.knownList.chosen('Tag') })
    const fold = screen.getByText(messages.knownList.showOptions(41)).parentElement
    expect((fold as HTMLDetailsElement).open).toBe(false)
    // What is chosen is outside the line that opens; the search and the values are inside.
    expect(fold?.contains(chosen)).toBe(false)
    const inside = within(fold as HTMLElement)
    expect(inside.getByRole('searchbox', { name: messages.knownList.searchIn('Tag') })).toBeTruthy()
    fireEvent.click(inside.getByLabelText('CAES-3039'))
    expect(within(chosen).getByText('CAES-3039')).toBeTruthy()
    // A value of before, no longer among the known ones, is still taken off from above.
    fireEvent.click(screen.getByRole('button', { name: messages.knownList.remove('vecchio') }))
    expect(within(chosen).queryByText('vecchio')).toBeNull()
    long.unmount()
    // A short list stays in sight, folded or not.
    render(<Folded known={['BE', 'FE']} />)
    expect(screen.queryByText(/^Scegli tra/)).toBeNull()
    expect(screen.getByLabelText('FE').closest('details')).toBeNull()
  })

  it('shows a few values all at once, and says when nothing is chosen among many', () => {
    const few = render(<Tags known={['BE', 'FE']} />)
    expect(screen.queryByRole('searchbox')).toBeNull()
    fireEvent.click(screen.getByLabelText('FE'))
    expect(screen.getByLabelText<HTMLInputElement>('FE').checked).toBe(true)
    few.unmount()

    render(<Tags known={MANY} />)
    expect(screen.getByText(messages.knownList.noneChosen)).toBeTruthy()
  })
})

describe('rows typed one field each', () => {
  type Key = 'name' | 'from'
  const columns = [
    { key: 'name' as const, label: 'Periodo' },
    { key: 'from' as const, label: 'Dal', kind: 'date' as const },
  ]
  function Periods({ start }: { start: Row<Key>[] }) {
    const [rows, setRows] = useState(start)
    return (
      <RowsField
        label="Periodi"
        columns={columns}
        rows={rows}
        onChange={setRows}
        addLabel="Aggiungi"
        cellLabel={(column, row) => `${column} ${row}`}
        removeLabel={(row) => `Togli ${row}`}
      />
    )
  }

  it('counts the rows and finds those that hold what is typed, keeping their place', () => {
    const start = Array.from({ length: 10 }, (_unused, at) => ({
      name: `Sprint ${at + 17}`,
      from: '',
    }))
    render(<Periods start={start} />)
    expect(screen.getByText(messages.rows.count(10))).toBeTruthy()

    const filter = screen.getByRole('searchbox', { name: messages.table.filterOf('Periodi') })
    fireEvent.change(filter, { target: { value: 'sprint 2' } })
    expect(screen.getAllByRole('textbox')).toHaveLength(7)
    // The row found is still the row it was: what is typed in it goes to its own place.
    expect(screen.getByLabelText<HTMLInputElement>('name 4').value).toBe('Sprint 20')

    // A row being added holds nothing yet: it stays in sight whatever is searched.
    fireEvent.click(screen.getByRole('button', { name: 'Aggiungi' }))
    expect(screen.getByLabelText<HTMLInputElement>('name 11').value).toBe('')
  })

  it('offers no filter for a few rows', () => {
    render(<Periods start={[{ name: 'PI4', from: '2026-01-26' }]} />)
    expect(screen.queryByRole('searchbox')).toBeNull()
    expect(screen.getByText(messages.rows.count(1))).toBeTruthy()
  })
})

describe('the settings of the page of the day', () => {
  const text = messages.today
  const view = (part: Partial<TodayView>): TodayView =>
    ({ ownAddresses: [], addedAddresses: [], mutedKinds: [], notify: true, ...part }) as TodayView

  it('shows whose mail is the PM’s, saves other addresses, and shows a kind again', async () => {
    const api = {
      todayView: vi.fn(async () =>
        ok(view({ ownAddresses: ['paola@octo.example'], mutedKinds: ['mail_waiting'] })),
      ),
      saveOwnAddresses: vi.fn(async (_id: string, addresses: string[]) =>
        ok(view({ addedAddresses: addresses, mutedKinds: ['mail_waiting'] })),
      ),
      muteTodayKind: vi.fn(async () => ok(view({}))),
      setTodayNotify: vi.fn(async (_id: string, notify: boolean) =>
        ok(view({ notify, ownAddresses: ['paola@octo.example'], mutedKinds: ['mail_waiting'] })),
      ),
    }
    render(<TodaySettings api={api} project={project} />)
    expect(await screen.findByText(text.addressesKnown('paola@octo.example'))).toBeTruthy()

    // The notice of the system is on until the PM turns it off.
    const notice = screen.getByLabelText(text.notifyLabel) as HTMLInputElement
    expect(notice.checked).toBe(true)
    fireEvent.click(notice)
    await waitFor(() => expect(api.setTodayNotify).toHaveBeenCalledWith('p-1', false))
    await waitFor(() => expect(notice.checked).toBe(false))

    fireEvent.change(screen.getByLabelText(text.addresses), {
      target: { value: 'p.rossi@cliente.example\n\n' },
    })
    fireEvent.click(screen.getByRole('button', { name: text.saveAddresses }))
    await waitFor(() =>
      expect(api.saveOwnAddresses).toHaveBeenCalledWith('p-1', ['p.rossi@cliente.example']),
    )
    expect(await screen.findByText(text.addressesNone)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: text.unmute }))
    await waitFor(() =>
      expect(api.muteTodayKind).toHaveBeenCalledWith('p-1', 'mail_waiting', false),
    )
    expect(await screen.findByText(text.mutedNone)).toBeTruthy()
  })

  it('says why when the settings cannot be read or saved', async () => {
    const failing = {
      todayView: vi.fn(async (): Promise<Result<TodayView>> => ({ ok: false, code: 'unexpected' })),
      saveOwnAddresses: vi.fn(),
      muteTodayKind: vi.fn(),
      setTodayNotify: vi.fn(),
    }
    const first = render(<TodaySettings api={failing} project={project} />)
    expect(await screen.findByRole('alert')).toBeTruthy()
    first.unmount()

    const api = {
      todayView: vi.fn(async () => ok(view({ mutedKinds: ['mail_waiting'] }))),
      saveOwnAddresses: vi.fn(
        async (): Promise<Result<TodayView>> => ({ ok: false, code: 'unexpected' }),
      ),
      muteTodayKind: vi.fn(
        async (): Promise<Result<TodayView>> => ({ ok: false, code: 'unexpected' }),
      ),
      setTodayNotify: vi.fn(
        async (): Promise<Result<TodayView>> => ({ ok: false, code: 'unexpected' }),
      ),
    }
    render(<TodaySettings api={api} project={project} />)
    fireEvent.click(await screen.findByRole('button', { name: text.saveAddresses }))
    expect(await screen.findByRole('alert')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: text.unmute }))
    await waitFor(() => expect(api.muteTodayKind).toHaveBeenCalled())
    fireEvent.click(screen.getByLabelText(text.notifyLabel))
    await waitFor(() => expect(api.setTodayNotify).toHaveBeenCalled())
    expect(await screen.findByRole('alert')).toBeTruthy()
  })
})
