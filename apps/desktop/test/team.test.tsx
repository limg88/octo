// @vitest-environment jsdom
import { NO_TEAM, type Project, type ProjectTeam } from '@octo/domain'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { messages } from '../src/renderer/messages.ts'
import { TeamSection } from '../src/renderer/TeamSection.tsx'
import type { Result } from '../src/shared/api.ts'

const project: Project = { id: 'p-1', name: 'Aurora', folder: '/progetti/Aurora', addedAt: '' }
const ok = <T,>(value: T): Result<T> => ({ ok: true, value })
const text = messages.team

const team: ProjectTeam = {
  people: [
    {
      name: 'Rossi Mario',
      role: 'sviluppatore',
      side: 'supplier',
      from: '2026-03-01',
      to: '',
      allocation: 80,
      note: '',
    },
    {
      name: 'Carla Bianchi',
      role: 'referente',
      side: 'client',
      from: '',
      to: '',
      allocation: null,
      note: 'dare del lei; prima la richiesta',
    },
  ],
  periods: [{ name: 'Sprint 28', from: '2026-10-26', to: '2026-11-13' }],
}

afterEach(cleanup)

describe('the section of people and calendar', () => {
  const cell = (row: string, column: string) =>
    screen.getByLabelText(text.cell(row, column)) as HTMLInputElement
  const set = (row: string, column: string, value: string) =>
    fireEvent.change(cell(row, column), { target: { value } })
  const columns = text.columns

  it('shows what is kept, one field for each value, and saves what is typed', async () => {
    const api = {
      team: vi.fn(async () => ok(team)),
      saveTeam: vi.fn(async (_id: string, next: ProjectTeam) => ok(next)),
    }
    render(<TeamSection api={api} project={project} />)
    await screen.findByRole('group', { name: text.people })
    expect(cell(text.personN(2), columns.name).value).toBe('Carla Bianchi')
    expect(cell(text.personN(2), columns.side).value).toBe('client')
    expect(cell(text.personN(1), columns.from).value).toBe('2026-03-01')
    expect(cell(text.periodN(1), columns.period).value).toBe('Sprint 28')

    // A row that lacks what makes it a person or a period is told, and nothing is saved.
    fireEvent.click(screen.getByRole('button', { name: text.addPerson }))
    set(text.personN(3), columns.role, 'analista')
    set(text.periodN(1), columns.to, '')
    fireEvent.click(screen.getByRole('button', { name: text.save }))
    expect(screen.getByText(text.personWrong(3))).toBeTruthy()
    expect(screen.getByText(text.periodWrong(1))).toBeTruthy()
    expect(screen.getByRole('status').textContent).toBe(messages.notSaved)
    expect(api.saveTeam).not.toHaveBeenCalled()

    // An allocation is a share of time: 150% and words are told, and nothing is saved.
    expect(cell(text.personN(1), columns.allocation).value).toBe('80')
    set(text.personN(3), columns.name, ' Verdi Luca ')
    set(text.personN(3), columns.allocation, '150')
    fireEvent.click(screen.getByRole('button', { name: text.save }))
    expect(screen.getByText(text.allocationWrong(3))).toBeTruthy()
    set(text.personN(3), columns.allocation, 'metà')
    fireEvent.click(screen.getByRole('button', { name: text.save }))
    expect(screen.getByText(text.allocationWrong(3))).toBeTruthy()
    expect(api.saveTeam).not.toHaveBeenCalled()
    set(text.personN(3), columns.allocation, '37,5')
    set(text.personN(3), columns.to, '2026-05-31')
    fireEvent.click(screen.getByRole('button', { name: text.remove(text.personN(1)) }))
    fireEvent.click(screen.getByRole('button', { name: text.remove(text.personN(1)) }))
    set(text.periodN(1), columns.to, '2026-12-04')
    // A row added and left empty is not a period, and not a mistake either.
    fireEvent.click(screen.getByRole('button', { name: text.addPeriod }))
    fireEvent.click(screen.getByRole('button', { name: text.save }))
    await waitFor(() =>
      expect(api.saveTeam).toHaveBeenCalledWith('p-1', {
        people: [
          {
            name: 'Verdi Luca',
            role: 'analista',
            side: 'supplier',
            from: '',
            to: '2026-05-31',
            allocation: 37.5,
            note: '',
          },
        ],
        periods: [{ name: 'Sprint 28', from: '2026-10-26', to: '2026-12-04' }],
      }),
    )
    expect(await screen.findByText(text.saved(1, 1))).toBeTruthy()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('starts with one empty row to type in, and keeps the side chosen', async () => {
    const api = {
      team: vi.fn(async () => ok(NO_TEAM)),
      saveTeam: vi.fn(async (_id: string, next: ProjectTeam) => ok(next)),
    }
    render(<TeamSection api={api} project={project} />)
    await screen.findByRole('group', { name: text.people })
    set(text.personN(1), columns.name, 'Carla Bianchi')
    set(text.personN(1), columns.side, 'client')
    fireEvent.click(screen.getByRole('button', { name: text.save }))
    await waitFor(() => expect(api.saveTeam).toHaveBeenCalled())
    expect(api.saveTeam.mock.calls[0]?.[1]).toEqual({
      people: [
        {
          name: 'Carla Bianchi',
          role: '',
          side: 'client',
          from: '',
          to: '',
          allocation: null,
          note: '',
        },
      ],
      periods: [],
    })
  })

  it('lets a person be marked as a consultant, and keeps it', async () => {
    const api = {
      team: vi.fn(async () => ok(NO_TEAM)),
      saveTeam: vi.fn(async (_id: string, next: ProjectTeam) => ok(next)),
    }
    render(<TeamSection api={api} project={project} />)
    await screen.findByRole('group', { name: text.people })
    const side = cell(text.personN(1), columns.side) as unknown as HTMLSelectElement
    expect([...side.options].map((option) => option.text)).toEqual([
      text.sides.supplier,
      text.sides.consultant,
      text.sides.client,
    ])
    set(text.personN(1), columns.name, 'Studio Blu')
    set(text.personN(1), columns.side, 'consultant')
    fireEvent.click(screen.getByRole('button', { name: text.save }))
    await waitFor(() => expect(api.saveTeam).toHaveBeenCalled())
    expect(api.saveTeam.mock.calls[0]?.[1].people[0]).toMatchObject({
      name: 'Studio Blu',
      side: 'consultant',
    })
  })

  it('keeps the most days a person is to spend on the project, when the PM writes them', async () => {
    const api = {
      team: vi.fn(async () =>
        ok({
          ...team,
          people: team.people.map((entry, n) => (n === 0 ? { ...entry, capDays: 8 } : entry)),
        }),
      ),
      saveTeam: vi.fn(async (_id: string, next: ProjectTeam) => ok(next)),
    }
    render(<TeamSection api={api} project={project} />)
    await screen.findByRole('group', { name: text.people })
    expect(cell(text.personN(1), columns.capDays).value).toBe('8')
    expect(cell(text.personN(2), columns.capDays).value).toBe('')
    set(text.personN(2), columns.capDays, 'tanti')
    fireEvent.click(screen.getByRole('button', { name: text.save }))
    expect(await screen.findByText(text.capWrong(2))).toBeTruthy()
    expect(api.saveTeam).not.toHaveBeenCalled()
    set(text.personN(1), columns.capDays, '1,5')
    set(text.personN(2), columns.capDays, '')
    fireEvent.click(screen.getByRole('button', { name: text.save }))
    await waitFor(() => expect(api.saveTeam).toHaveBeenCalled())
    const saved = api.saveTeam.mock.calls[0]?.[1]
    expect(saved?.people[0]).toMatchObject({ capDays: 1.5 })
    // Who has no cap is kept as before: no field for it.
    expect(saved?.people[1]).not.toHaveProperty('capDays')
  })

  it('fixes how a person is addressed only when the PM says so', async () => {
    const api = {
      team: vi.fn(async () =>
        ok({
          ...team,
          people: team.people.map((entry, n) =>
            n === 0 ? { ...entry, address: 'tu' as const } : entry,
          ),
        }),
      ),
      saveTeam: vi.fn(async (_id: string, next: ProjectTeam) => ok(next)),
    }
    render(<TeamSection api={api} project={project} />)
    await screen.findByRole('group', { name: text.people })
    expect(cell(text.personN(1), columns.address).value).toBe('tu')
    expect(cell(text.personN(2), columns.address).value).toBe('')
    set(text.personN(1), columns.address, 'lei')
    fireEvent.click(screen.getByRole('button', { name: text.save }))
    await waitFor(() => expect(api.saveTeam).toHaveBeenCalled())
    const saved = api.saveTeam.mock.calls[0]?.[1]
    expect(saved?.people[0]).toMatchObject({ address: 'lei' })
    // Left as in the mail: no field, and who writes follows the mail already sent.
    expect(saved?.people[1]).not.toHaveProperty('address')
  })

  it('says why it cannot read or save', async () => {
    const failing = { ok: false as const, code: 'team_invalid' as const }
    const { unmount } = render(
      <TeamSection
        api={{ team: vi.fn(async () => failing), saveTeam: vi.fn() }}
        project={project}
      />,
    )
    expect((await screen.findByRole('alert')).textContent).toMatch(/non sono leggibili/)
    expect(screen.queryByRole('group', { name: text.people })).toBeNull()
    unmount()
    const api = { team: vi.fn(async () => ok(NO_TEAM)), saveTeam: vi.fn(async () => failing) }
    render(<TeamSection api={api} project={project} />)
    fireEvent.click(await screen.findByRole('button', { name: text.save }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/non sono leggibili/)
  })
})
