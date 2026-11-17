import { afterEach, describe, expect, it } from 'vitest'
import { addUpdates, commentsOf, inPool, planningOf, trackerItemOf } from '../src/ado/tracker.ts'
import { createConnectorReader } from '../src/index.ts'
import { type FakeAdo, startFakeAdo, workItem } from './support/fake-ado.ts'

const PROJECT = 'Borea'
const OPTIONS = {
  organization: 'contoso',
  projectId: '6ce954b1-ce1f-45d1-b94d-e6bf2464ba2c',
  projectName: PROJECT,
  pat: 'pat-ok',
  areas: [{ name: 'Team A' }, { name: 'Team B' }],
  iterations: [{ name: 'PI7', children: [{ name: 'Sprint 28' }] }],
}
const CONFIG = { organization: 'contoso', host: 'dev.azure.com', readOnlyToken: true }
const changedAt = '2026-11-04T10:00:00Z'
const update = (at: string, fields: Record<string, unknown>) => ({
  revisedDate: '9999-01-01T00:00:00Z',
  fields: { 'System.ChangedDate': { newValue: at }, ...fields },
})
const comment = (name: string, at: string, text: string) => ({
  createdBy: { displayName: name },
  createdDate: at,
  text,
})

describe('a snapshot of Azure DevOps', () => {
  let fake: FakeAdo
  afterEach(() => fake?.server.close())

  async function snapshot(items: ReturnType<typeof workItem>[], areas: string[] = []) {
    fake = await startFakeAdo({ ...OPTIONS, items })
    const reader = createConnectorReader({ devEndpoints: { ado: fake.server.origin } })
    const source = await reader.connect('ado', CONFIG, 'pat-ok', [PROJECT, ...areas])
    return reader.tracker(
      { kind: 'ado', ...source, secret: 'pat-ok' },
      { detailTypes: ['bug'] },
      new AbortController().signal,
    )
  }

  it('reads every work item as it is now, with the history and comments of the bugs', async () => {
    const bug = workItem(7, {
      area: `${PROJECT}\\Team A`,
      iteration: `${PROJECT}\\PI7\\Sprint 28`,
      changedAt,
      type: 'Bug',
      title: ' Errore IVA ',
      state: 'Ready for Test',
      tags: 'Squadra; Urgente',
      createdAt: '2026-10-01T08:00:00Z',
      parent: 3,
      description: '<p>Il totale è <b>sbagliato</b></p>',
    })
    bug.fields['Microsoft.VSTS.Common.StateChangeDate'] = '2026-11-03T09:00:00Z'
    bug.fields['Microsoft.VSTS.Common.Severity'] = '2 - High'
    bug.fields['Microsoft.VSTS.Common.AcceptanceCriteria'] = '<ul><li>Totale giusto</li></ul>'
    bug.fields['System.CommentCount'] = 2
    bug.updates = [
      update('2026-10-01T08:00:00Z', {
        'System.CreatedDate': { newValue: '2026-10-01T08:00:00Z' },
        'System.State': { newValue: 'New' },
        'System.Tags': { newValue: 'Urgente' },
      }),
      update('2026-10-20T08:00:00Z', { 'System.Tags': { oldValue: 'Urgente' } }),
      update('2026-11-03T09:00:00Z', { 'System.State': { newValue: 'Ready for Test' } }),
      // An update of something else, and one without fields: neither is a change of state.
      update('2026-11-04T10:00:00Z', { 'System.Title': { newValue: 'Errore IVA' } }),
      { revisedDate: '2026-11-04T10:00:00Z' },
    ]
    bug.comments = [
      comment('Mario Rossi', '2026-10-02T08:00:00Z', '<div>Lo guardo io</div>'),
      comment('Anna Verdi', '2026-11-03T09:05:00Z', 'Pronto per il test'),
    ]
    const story = workItem(3, { area: PROJECT, iteration: PROJECT, changedAt, assignedTo: null })
    story.fields['System.CommentCount'] = 4
    fake = undefined as unknown as FakeAdo

    const read = await snapshot([story, bug])

    expect(read.exportedAt).toBe('2026-11-05T09:00:00.000Z')
    expect(read.items).toEqual([
      {
        id: 3,
        type: 'User Story',
        title: 'Storia 3',
        state: 'Active',
        tags: [],
        assigned_to: null,
        created_date: null,
        state_change_date: null,
        severity: null,
        pi: null,
        sprint: null,
        parent: null,
        description: '',
        acceptance_criteria: '',
        discussion: [],
      },
      {
        id: 7,
        type: 'Bug',
        title: 'Errore IVA',
        state: 'Ready for Test',
        tags: ['Squadra', 'Urgente'],
        assigned_to: 'Mario Rossi',
        created_date: '2026-10-01T08:00:00Z',
        state_change_date: '2026-11-03T09:00:00Z',
        severity: '2 - High',
        pi: 'PI7',
        sprint: 'Sprint 28',
        parent: 3,
        description: 'Il totale è sbagliato',
        acceptance_criteria: expect.stringContaining('Totale giusto'),
        discussion: [
          { by: 'Mario Rossi', date: '2026-10-02T08:00:00Z', text: 'Lo guardo io' },
          { by: 'Anna Verdi', date: '2026-11-03T09:05:00Z', text: 'Pronto per il test' },
        ],
      },
    ])
    // Only the bug has a history: the story, with its comments, was not asked.
    expect(read.history).toEqual({
      '7': {
        created: '2026-10-01T08:00:00Z',
        states: [
          ['2026-10-01T08:00:00Z', 'New'],
          ['2026-11-03T09:00:00Z', 'Ready for Test'],
        ],
        tags: [
          ['2026-10-01T08:00:00Z', 'Urgente'],
          ['2026-10-20T08:00:00Z', ''],
        ],
      },
    })
    // The work items are asked as of the instant of the query, with the declared fields only.
    const batch = fake.bodies.find((sent) => sent.path.endsWith('/workitemsbatch'))
    expect(batch?.body).toMatchObject({ asOf: '2026-11-05T09:00:00.000Z', errorPolicy: 'omit' })
  })

  it('keeps to the areas named and drops what the system returns outside them', async () => {
    const items = [
      workItem(1, { area: `${PROJECT}\\Team A`, iteration: PROJECT, changedAt }),
      workItem(2, { area: `${PROJECT}\\Team B`, iteration: PROJECT, changedAt }),
    ]
    expect((await snapshot(items, ['Team A'])).items.map((item) => item.id)).toEqual([1])
    fake.server.close()

    fake = await startFakeAdo({ ...OPTIONS, items })
    fake.leakPerimeter = true
    const reader = createConnectorReader({ devEndpoints: { ado: fake.server.origin } })
    const source = await reader.connect('ado', CONFIG, 'pat-ok', [PROJECT, 'Team A'])
    const read = await reader.tracker(
      { kind: 'ado', ...source, secret: 'pat-ok' },
      { detailTypes: [] },
      new AbortController().signal,
    )
    expect(read.items.map((item) => item.id)).toEqual([1])
  })

  it('reads a long history page by page and skips an item the token cannot read', async () => {
    const bug = workItem(9, { area: PROJECT, iteration: PROJECT, changedAt, type: 'Bug' })
    bug.updates = Array.from({ length: 201 }, (_, n) =>
      update(new Date(Date.UTC(2026, 0, 1, 0, n)).toISOString(), {
        'System.State': { newValue: `S${n}` },
      }),
    )
    const hidden = workItem(10, { area: PROJECT, iteration: PROJECT, changedAt, type: 'Bug' })
    fake = await startFakeAdo({ ...OPTIONS, items: [bug, hidden] })
    fake.unreadable.add(10)
    const reader = createConnectorReader({ devEndpoints: { ado: fake.server.origin } })
    const source = await reader.connect('ado', CONFIG, 'pat-ok', [PROJECT])
    const read = await reader.tracker(
      { kind: 'ado', ...source, secret: 'pat-ok' },
      { detailTypes: ['Bug'] },
      new AbortController().signal,
    )
    expect(read.items.map((item) => item.id)).toEqual([9])
    expect((read.history['9']?.states ?? []).length).toBe(201)
  })

  it('fails with a code when the credential is refused', async () => {
    fake = await startFakeAdo({ ...OPTIONS, items: [] })
    const reader = createConnectorReader({ devEndpoints: { ado: fake.server.origin } })
    await expect(reader.connect('ado', CONFIG, 'wrong', [PROJECT])).rejects.toMatchObject({
      code: 'source_auth_failed',
    })
  })
})

describe('the shapes of a snapshot', () => {
  it('takes period and sprint from the levels under the project', () => {
    expect(planningOf('P\\PI7\\Sprint 28\\[X] Sprint 28')).toEqual({
      pi: 'PI7',
      sprint: 'Sprint 28',
    })
    expect(planningOf('P\\PI7')).toEqual({ pi: 'PI7', sprint: null })
    expect(planningOf('P')).toEqual({ pi: null, sprint: null })
    expect(planningOf('')).toEqual({ pi: null, sprint: null })
  })

  it('refuses what is not a work item, a page of updates or a page of comments', () => {
    const history = { created: null, states: [], tags: [] }
    for (const wrong of [null, {}, { id: 1 }, { id: 0, fields: {} }, { id: 1.5, fields: {} }]) {
      expect(() => trackerItemOf(wrong)).toThrow()
    }
    expect(() => addUpdates(history, { value: 'no' })).toThrow()
    expect(() => addUpdates(history, { value: ['no'] })).toThrow()
    expect(() => commentsOf({})).toThrow()
    expect(() => commentsOf({ comments: ['no'] })).toThrow()
  })

  it('leaves out an update or a comment without a readable date', () => {
    const history = { created: null, states: [], tags: [] }
    expect(
      addUpdates(history, {
        value: [
          { fields: { 'System.State': { newValue: 'New' } } },
          { revisedDate: '2026-01-02T00:00:00Z', fields: { 'System.State': { newValue: 7 } } },
          { revisedDate: '2026-01-03T00:00:00Z', fields: { 'System.State': { newValue: 'Done' } } },
        ],
      }),
    ).toBe(3)
    expect(history).toEqual({
      created: null,
      states: [['2026-01-03T00:00:00Z', 'Done']],
      tags: [],
    })
    expect(
      commentsOf({ comments: [{ text: 'x' }, { createdDate: '2026-01-01T00:00:00Z', text: 5 }] }),
    ).toEqual([{ by: '', date: '2026-01-01T00:00:00Z', text: '' }])
  })

  it('runs a few at a time and stops at the first failure', async () => {
    const seen: number[] = []
    await inPool([1, 2, 3, 4, 5], 2, async (n) => {
      seen.push(n)
    })
    expect(seen.sort()).toEqual([1, 2, 3, 4, 5])
    await inPool([], 2, async () => {
      throw new Error('never')
    })
    await expect(
      inPool([1, 2], 2, async () => {
        throw new Error('stop')
      }),
    ).rejects.toThrow('stop')
  })
})
