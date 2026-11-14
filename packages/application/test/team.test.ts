import { NO_TEAM, type Project, type ProjectTeam, TEAM_FILE } from '@octo/domain'
import { describe, expect, it } from 'vitest'
import { createTeam } from '../src/index.ts'
import { memoryWriter } from './fakes.ts'

const project: Project = { id: 'p-1', name: 'Aurora', folder: '/progetti/Aurora', addedAt: '' }

describe('the people and the calendar of a project', () => {
  it('are kept tidy and written as a text the answers can read', async () => {
    let saved: ProjectTeam = NO_TEAM
    const writer = memoryWriter()
    const team = createTeam({
      store: {
        load: async () => saved,
        save: async (_folder, next) => {
          saved = next
        },
      },
      writer,
    })
    expect(await team.get(project)).toEqual(NO_TEAM)
    const clean = await team.save(project, {
      people: [
        {
          name: ' Carla Bianchi ',
          role: 'referente',
          side: 'client',
          from: '',
          to: '',
          note: 'lei',
        },
        { name: '', role: '', side: 'supplier', from: '', to: '', note: '' },
      ],
      periods: [{ name: 'Sprint 28', from: '2026-10-26', to: '2026-11-13' }],
    })
    expect(clean.people.map((person) => person.name)).toEqual(['Carla Bianchi'])
    expect(await team.get(project)).toEqual(clean)
    expect(writer.files.get(TEAM_FILE)).toContain('- **Carla Bianchi**, referente')
    expect(writer.files.get(TEAM_FILE)).toContain('| Sprint 28 | 26/10/2026 | 13/11/2026 |')
  })
})
