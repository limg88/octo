// @vitest-environment jsdom
import { NO_TEAM, type Project, type ProjectTeam } from '@octo/domain'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { messages } from '../src/renderer/messages.ts'
import { TeamSection } from '../src/renderer/TeamSection.tsx'
import { dayOf, peopleLines, peopleOf, periodLines, periodsOf } from '../src/renderer/team-text.ts'
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
      note: '',
    },
    {
      name: 'Carla Bianchi',
      role: 'referente',
      side: 'client',
      from: '',
      to: '',
      note: 'dare del lei; prima la richiesta',
    },
  ],
  periods: [{ name: 'Sprint 28', from: '2026-10-26', to: '2026-11-13' }],
}

afterEach(cleanup)

describe('people and calendar as typed', () => {
  it('reads days written the Italian way', () => {
    expect(dayOf('1/3/2026')).toBe('2026-03-01')
    expect(dayOf('31-12-26')).toBe('2026-12-31')
    expect(dayOf(' 2026-03-01 ')).toBe('2026-03-01')
    expect(dayOf('marzo')).toBe('')
    expect(dayOf('')).toBe('')
  })

  it('reads people and periods one per line and writes them back', () => {
    const people = peopleOf(
      'Rossi Mario; sviluppatore; nostra; 01/03/2026\n\nCarla Bianchi; referente; Cliente; ; ; dare del lei; prima la richiesta\nSolo Nome',
    )
    expect(people.slice(0, 2)).toEqual(team.people)
    expect(people[2]).toEqual({
      name: 'Solo Nome',
      role: '',
      side: 'supplier',
      from: '',
      to: '',
      note: '',
    })
    expect(peopleLines(team.people)).toBe(
      'Rossi Mario; sviluppatore; nostra; 01/03/2026; ; \nCarla Bianchi; referente; cliente; ; ; dare del lei; prima la richiesta',
    )
    expect(periodsOf('Sprint 28; 26/10/2026; 13/11/2026\nSenza date')).toEqual([
      ...team.periods,
      { name: 'Senza date', from: '', to: '' },
    ])
    expect(periodLines(team.periods)).toBe('Sprint 28; 26/10/2026; 13/11/2026')
  })
})

describe('the section of people and calendar', () => {
  it('shows what is kept and saves what is typed', async () => {
    const api = {
      team: vi.fn(async () => ok(team)),
      saveTeam: vi.fn(async (_id: string, next: ProjectTeam) => ok(next)),
    }
    render(<TeamSection api={api} project={project} />)
    const people = (await screen.findByLabelText(text.people)) as HTMLTextAreaElement
    expect(people.value).toContain('Carla Bianchi; referente; cliente')
    fireEvent.change(people, { target: { value: 'Verdi Luca; ; ; ; 31/05/2026' } })
    fireEvent.change(screen.getByLabelText(text.periods), {
      target: { value: 'Sprint 29; 16/11/2026; 04/12/2026' },
    })
    fireEvent.click(screen.getByRole('button', { name: text.save }))
    await waitFor(() =>
      expect(api.saveTeam).toHaveBeenCalledWith('p-1', {
        people: [
          { name: 'Verdi Luca', role: '', side: 'supplier', from: '', to: '2026-05-31', note: '' },
        ],
        periods: [{ name: 'Sprint 29', from: '2026-11-16', to: '2026-12-04' }],
      }),
    )
    expect(await screen.findByText(text.saved(1, 1))).toBeTruthy()
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
    expect(screen.queryByLabelText(text.people)).toBeNull()
    unmount()
    const api = { team: vi.fn(async () => ok(NO_TEAM)), saveTeam: vi.fn(async () => failing) }
    render(<TeamSection api={api} project={project} />)
    fireEvent.click(await screen.findByRole('button', { name: text.save }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/non sono leggibili/)
  })
})
