// @vitest-environment jsdom
import type { AlignmentView as View } from '@octo/application'
import {
  type AlignItem,
  type AlignmentSettings,
  type AlignTicket,
  DEFAULT_ALIGNMENT_SETTINGS,
  type Project,
} from '@octo/domain'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AlignmentView, stateGroupLines, stateGroupsOf } from '../src/renderer/AlignmentView.tsx'
import { messages } from '../src/renderer/messages.ts'
import type { OctoApi, Result } from '../src/shared/api.ts'

const project: Project = { id: 'p-1', name: 'Aurora', folder: '/progetti/Aurora', addedAt: '' }
const ok = <T,>(value: T): Result<T> => ({ ok: true, value })
const text = messages.alignment

const item = (id: string, title: string): AlignItem => ({
  id,
  title,
  type: 'User Story',
  state: 'In Progress',
  sprint: 'Sprint 28',
  period: null,
  tags: [],
  assignee: null,
  description: '',
})
const ticket = (key: string, title: string, sprint: string | null = 'Sprint 28'): AlignTicket => ({
  key,
  title,
  type: 'Story',
  status: 'In corso',
  sprint,
  sprints: [],
  assignee: null,
})
const pair = (
  id: string,
  keys: string[],
  coherent: boolean | null,
  sprint: string | null = 'Sprint 28',
) => ({
  item: item(id, `Voce ${id}`),
  tickets: keys.map((key) => ticket(key, `Ticket ${key}`, sprint)),
  via: 'title' as const,
  itemGroup: null,
  ticketGroup: null,
  coherent,
})

const configured: AlignmentSettings = { ...DEFAULT_ALIGNMENT_SETTINGS, sprint: 'Sprint 28' }
const view: View = {
  exportedAt: '2026-11-13T08:00:00Z',
  tickets: 42,
  sprints: ['Sprint 27', 'Sprint 28'],
  alignment: {
    total: 6,
    linked: [
      pair('101', ['AUR-1'], true),
      pair('102', ['AUR-2'], false),
      pair('104', ['AUR-3', 'AUR-4'], null),
    ],
    needsUpdate: [pair('103', ['AUR-5'], true, 'Sprint 27'), pair('105', ['AUR-6'], null, null)],
    missing: [item('106', 'Importazione listino')],
    duplicates: [pair('104', ['AUR-3', 'AUR-4'], null)],
    orphans: [
      { ticket: ticket('AUR-7', 'Voce sparita'), ids: ['999'], reason: 'unknown' },
      { ticket: ticket('AUR-8', 'Altro sprint'), ids: ['201'], reason: 'out_of_scope' },
    ],
    unreferenced: [ticket('AUR-9', 'Riunione')],
    suggestions: [
      {
        item: item('106', 'Importazione listino'),
        ticket: ticket('AUR-10', 'Import listino'),
        score: 0.87,
        confidence: 'medium',
      },
    ],
    adds: true,
  },
}

type Api = Pick<
  OctoApi,
  | 'alignmentSettings'
  | 'saveAlignmentSettings'
  | 'alignmentView'
  | 'exportMissingTickets'
  | 'openEvidence'
>

function fakeApi(overrides: Partial<Api> = {}) {
  const api: Api = {
    alignmentSettings: vi.fn(async () => ok(configured)),
    saveAlignmentSettings: vi.fn(async (_id: string, settings: AlignmentSettings) => ok(settings)),
    alignmentView: vi.fn(async () => ok(view)),
    exportMissingTickets: vi.fn(async () =>
      ok({ path: '_octo/allineamento/mancanti_sprint-28.csv', rows: 1 }),
    ),
    openEvidence: vi.fn(async () => ok(null)),
    ...overrides,
  }
  return api
}

afterEach(cleanup)

describe('groups of states as typed', () => {
  it('are read one per line and written back', () => {
    const groups = stateGroupsOf(
      'in corso: In Progress, Active = In corso\nsenza uguale: x\nsenza nome\nchiuso: Closed = Completata, Chiusa',
    )
    expect(groups.values).toEqual([
      { name: 'in corso', item: ['In Progress', 'Active'], ticket: ['In corso'] },
      { name: 'chiuso', item: ['Closed'], ticket: ['Completata', 'Chiusa'] },
    ])
    expect(groups.problems).toEqual([
      { line: 2, text: 'senza uguale: x', reason: 'shape' },
      { line: 3, text: 'senza nome', reason: 'shape' },
    ])
    expect(stateGroupLines(groups.values)).toBe(
      'in corso: In Progress, Active = In corso\nchiuso: Closed = Completata, Chiusa',
    )
  })
})

describe('the alignment', () => {
  it('shows every list with its count and whether the numbers add up', async () => {
    render(<AlignmentView api={fakeApi()} project={project} />)
    expect(await screen.findByText(text.summary(6, 3, 2, 1))).toBeTruthy()
    expect(screen.getByText(text.adds)).toBeTruthy()
    expect(screen.getByText(/42 ticket letti/)).toBeTruthy()
    const section = (title: string) => within(screen.getByRole('region', { name: title }))
    expect(section(text.linkedTitle).getByText(`${text.linkedTitle} (3)`)).toBeTruthy()
    expect(section(text.linkedTitle).getByText(text.coherent.yes)).toBeTruthy()
    expect(section(text.linkedTitle).getByText(text.coherent.no)).toBeTruthy()
    expect(section(text.linkedTitle).getByText('AUR-3, AUR-4')).toBeTruthy()
    expect(section(text.needsUpdateTitle).getByText('Sprint 27')).toBeTruthy()
    expect(section(text.needsUpdateTitle).getByText(text.noSprint)).toBeTruthy()
    expect(section(text.missingTitle).getByText('Importazione listino')).toBeTruthy()
    expect(section(text.duplicatesTitle).getByText('Voce 104')).toBeTruthy()
    expect(section(text.orphansTitle).getByText(text.reason.unknown)).toBeTruthy()
    expect(section(text.orphansTitle).getByText(text.reason.out_of_scope)).toBeTruthy()
    expect(section(text.suggestionsTitle).getByText('87% (media)')).toBeTruthy()
    expect(section(text.suggestionsTitle).getByText(text.suggestionsIntro)).toBeTruthy()
    expect(section(text.unreferencedTitle).getByText('Riunione')).toBeTruthy()
  })

  it('warns when the lists do not add up, and says so for empty lists', async () => {
    const broken: View = {
      ...view,
      exportedAt: null,
      alignment: { ...view.alignment, adds: false, missing: [], suggestions: [], orphans: [] },
    }
    render(
      <AlignmentView
        api={fakeApi({ alignmentView: vi.fn(async () => ok(broken)) })}
        project={project}
      />,
    )
    expect((await screen.findByRole('alert')).textContent).toBe(text.doesNotAdd)
    expect(screen.getByText(new RegExp(text.noDate))).toBeTruthy()
    expect(screen.getAllByText(text.none)).toHaveLength(3)
    expect(screen.queryByRole('button', { name: text.exportMissing })).toBeNull()
  })

  it('writes the import file of the missing tickets and opens it', async () => {
    const api = fakeApi()
    render(<AlignmentView api={api} project={project} />)
    fireEvent.click(await screen.findByRole('button', { name: text.exportMissing }))
    const path = '_octo/allineamento/mancanti_sprint-28.csv'
    expect(await screen.findByText(new RegExp(path))).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: text.open }))
    expect(api.openEvidence).toHaveBeenCalledWith('p-1', path)
  })

  it('says why the file could not be written', async () => {
    const api = fakeApi({
      exportMissingTickets: vi.fn(async () => ({
        ok: false as const,
        code: 'alignment_tickets_missing' as const,
      })),
    })
    render(<AlignmentView api={api} project={project} />)
    fireEvent.click(await screen.findByRole('button', { name: text.exportMissing }))
    expect((await screen.findByRole('alert')).textContent).toMatch(/Non trovo ticket/)
  })

  it('asks for the sprint first and saves what is typed', async () => {
    const api = fakeApi({ alignmentSettings: vi.fn(async () => ok(DEFAULT_ALIGNMENT_SETTINGS)) })
    render(<AlignmentView api={api} project={project} />)
    const save = (await screen.findByRole('button', { name: text.save })) as HTMLButtonElement
    expect(save.disabled).toBe(true)
    expect(screen.getByText(text.saveNeeds)).toBeTruthy()
    expect(api.alignmentView).not.toHaveBeenCalled()
    const type = (label: string, value: string) =>
      fireEvent.change(screen.getByLabelText(label), { target: { value } })
    type(text.sprint, 'Sprint 28')
    type(text.period, 'PI7')
    type(text.tags, 'Squadra, Altri')
    type(text.referencePrefixes, 'AZDO')
    type(text.stateGroups, 'in corso: In Progress')
    fireEvent.click(save)
    expect(
      screen.getByText(
        messages.lines.line(1, 'in corso: In Progress', 'shape', text.shapes.stateGroups),
      ),
    ).toBeTruthy()
    expect(api.saveAlignmentSettings).not.toHaveBeenCalled()
    type(text.stateGroups, 'in corso: In Progress = In corso')
    type(text.ticketFolder, 'ticket')
    type(text.exportPath, 'dati/sprint.json')
    fireEvent.click(save)
    await waitFor(() =>
      expect(api.saveAlignmentSettings).toHaveBeenCalledWith('p-1', {
        ...DEFAULT_ALIGNMENT_SETTINGS,
        sprint: 'Sprint 28',
        period: 'PI7',
        tags: ['Squadra', 'Altri'],
        exportPath: 'dati/sprint.json',
        ticketFolder: 'ticket',
        referencePrefixes: ['AZDO'],
        stateGroups: [{ name: 'in corso', item: ['In Progress'], ticket: ['In corso'] }],
      }),
    )
    expect(await screen.findByText(text.summary(6, 3, 2, 1))).toBeTruthy()
  })

  it('shows why the settings cannot be read, saved or the trackers compared', async () => {
    const failing = { ok: false as const, code: 'alignment_settings_invalid' as const }
    render(
      <AlignmentView
        api={fakeApi({ alignmentSettings: vi.fn(async () => failing) })}
        project={project}
      />,
    )
    expect((await screen.findByRole('alert')).textContent).toMatch(/non sono valide/)
    cleanup()
    const noExport = { ok: false as const, code: 'alignment_items_missing' as const }
    const api = fakeApi({
      alignmentView: vi.fn(async () => noExport),
      saveAlignmentSettings: vi.fn(async () => failing),
    })
    render(<AlignmentView api={api} project={project} />)
    expect((await screen.findByRole('alert')).textContent).toMatch(/scheda «Cruscotto»/)
    fireEvent.click(screen.getByRole('button', { name: text.save }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/non sono valide/))
  })
})
