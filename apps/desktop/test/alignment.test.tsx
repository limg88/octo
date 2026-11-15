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
import { AlignmentView } from '../src/renderer/AlignmentView.tsx'
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
  | 'chooseProjectPath'
  | 'alignmentChoices'
  | 'alignmentSettings'
  | 'saveAlignmentSettings'
  | 'alignmentView'
  | 'exportMissingTickets'
  | 'openEvidence'
>

function fakeApi(overrides: Partial<Api> = {}) {
  const api: Api = {
    chooseProjectPath: vi.fn(async () => ok<string | null>('scelto/qui')),
    alignmentChoices: vi.fn(async () =>
      ok({
        sprints: ['Sprint 27', 'Sprint 28'],
        periods: ['PI7', 'PI8'],
        tags: ['Squadra', 'Altri'],
      }),
    ),
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
    // What the export holds is chosen, not typed again: sprint and period from a menu, tags ticked.
    expect(screen.getByLabelText<HTMLSelectElement>(text.sprint).options).toHaveLength(3)
    fireEvent.click(screen.getByLabelText('Squadra'))
    fireEvent.click(screen.getByLabelText('Altri'))
    fireEvent.click(screen.getByLabelText('Altri'))
    fireEvent.click(screen.getByLabelText('Altri'))
    type(text.referencePrefixes, 'AZDO')
    const group = (column: string, row: number) =>
      screen.getByLabelText(text.groupCell(column, row))
    fireEvent.change(group(text.groupColumns.name, 1), { target: { value: 'in corso' } })
    fireEvent.change(group(text.groupColumns.item, 1), { target: { value: 'In Progress' } })
    fireEvent.click(save)
    // A group that names the states of one tracker only is told, and nothing is saved.
    expect(screen.getByText(text.groupWrong(1))).toBeTruthy()
    expect(api.saveAlignmentSettings).not.toHaveBeenCalled()
    fireEvent.change(group(text.groupColumns.ticket, 1), { target: { value: 'In corso' } })
    fireEvent.click(screen.getByRole('button', { name: text.addGroup }))
    // The export and the folder of the tickets can be chosen from the dialog of the system.
    fireEvent.click(
      screen.getByRole('button', { name: `${messages.choosePath}: ${text.exportPath}` }),
    )
    await waitFor(() => expect(api.chooseProjectPath).toHaveBeenCalledWith('p-1', 'file', ['json']))
    fireEvent.click(
      screen.getByRole('button', { name: `${messages.choosePath}: ${text.ticketFolder}` }),
    )
    await waitFor(() => expect(api.chooseProjectPath).toHaveBeenCalledWith('p-1', 'folder', []))
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

  it('lets sprint, period and tags be typed while the export is not known, and keeps what is in use', async () => {
    const api = fakeApi({
      alignmentSettings: vi.fn(async () => ok(DEFAULT_ALIGNMENT_SETTINGS)),
      alignmentChoices: vi.fn(async () => ({ ok: false as const, code: 'unexpected' as const })),
    })
    const view = render(<AlignmentView api={api} project={project} />)
    fireEvent.change(await screen.findByLabelText(text.tags), { target: { value: 'Squadra, ' } })
    expect(screen.getByLabelText<HTMLInputElement>(text.tags).value).toBe('Squadra, ')
    expect(screen.getByLabelText(text.sprint).tagName).toBe('INPUT')
    expect(screen.getByText(messages.commaList)).toBeTruthy()
    view.unmount()

    // A sprint and a tag saved before, no longer in the export, stay among the choices.
    const saved = {
      ...DEFAULT_ALIGNMENT_SETTINGS,
      sprint: 'Sprint 1',
      period: 'PI1',
      tags: ['Vecchio'],
    }
    render(
      <AlignmentView
        api={fakeApi({ alignmentSettings: vi.fn(async () => ok(saved)) })}
        project={project}
      />,
    )
    const sprint = await screen.findByLabelText<HTMLSelectElement>(text.sprint)
    await waitFor(() => expect(sprint.tagName).toBe('SELECT'))
    expect([...sprint.options].map((option) => option.value)).toEqual([
      '',
      'Sprint 1',
      'Sprint 27',
      'Sprint 28',
    ])
    expect(screen.getByLabelText<HTMLSelectElement>(text.period).value).toBe('PI1')
    expect(screen.getByLabelText<HTMLInputElement>('Vecchio').checked).toBe(true)
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
    const onOpenSection = vi.fn()
    render(<AlignmentView api={api} project={project} onOpenSection={onOpenSection} />)
    expect((await screen.findByRole('alert')).textContent).toMatch(/in «Cruscotto»/)
    // An error that is put right elsewhere leads there.
    fireEvent.click(
      screen.getByRole('button', { name: messages.openSection(messages.dashboardTab) }),
    )
    expect(onOpenSection).toHaveBeenCalledWith('dashboard')
    fireEvent.click(screen.getByRole('button', { name: text.save }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toMatch(/non sono valide/))
  })
})
