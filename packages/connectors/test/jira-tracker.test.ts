import { afterEach, describe, expect, it } from 'vitest'
import type { AdoTrackerSnapshot } from '../src/ado/tracker.ts'
import type { Issue } from '../src/jira/issues.ts'
import {
  changelogPageOf,
  historyOf,
  type JiraTrackerSnapshot,
  stateChangeOf,
  statusIdOf,
  trackerItemOf,
} from '../src/jira/tracker.ts'
import { createConnectorReader } from '../src/reader.ts'
import {
  type FakeIssue,
  type FakeJira,
  jiraChange,
  jiraComment,
  jiraIssue,
  startFakeJira,
} from './support/fake-jira.ts'

const EMAIL = 'pm@example.test'
const TOKEN = 'token-ok'
const AURORA = { id: '10000', key: 'AUR', name: 'Aurora' }
const BOREALE = { id: '10001', key: 'BOR', name: 'Boreale' }
const CONFIG = { site: 'contoso', email: EMAIL, readOnlyToken: true }

const issue = (over: Partial<Issue> = {}): Issue => ({
  id: '1',
  key: 'AUR-1',
  projectId: AURORA.id,
  projectKey: AURORA.key,
  type: 'Bug',
  status: 'In corso',
  statusCategory: 'indeterminate',
  summary: 'Login lento',
  assignee: { displayName: 'Mario Rossi' },
  priority: 'High',
  storyPoints: null,
  sprint: 'Sprint 28',
  sprints: ['Sprint 28'],
  labels: ['Squadra', 'Urgente'],
  parentKey: 'AUR-9',
  createdAt: new Date('2026-10-01T08:00:00Z'),
  updatedAt: new Date('2026-11-04T10:00:00Z'),
  resolvedAt: null,
  dueDate: null,
  description: 'Il login impiega dieci secondi.',
  mentioned: [],
  mentionsRefused: false,
  comments: [
    {
      id: '1',
      author: { displayName: 'Carla Bianchi' },
      createdAt: new Date('2026-11-03T09:00:00Z'),
      text: 'Quando lo rilasciate?',
      mentioned: [],
      mentionsRefused: false,
    },
    {
      id: '2',
      author: null,
      createdAt: null,
      text: 'senza data',
      mentioned: [],
      mentionsRefused: false,
    },
  ],
  commentTotal: 2,
  commentsInline: 2,
  ...over,
})

describe('an issue as an item of the tracker snapshot', () => {
  it('takes the names of the export the dashboard reads', () => {
    expect(trackerItemOf(issue(), '2026-11-02T10:00:00.000Z')).toEqual({
      id: 'AUR-1',
      type: 'Bug',
      title: 'Login lento',
      state: 'In corso',
      tags: ['Squadra', 'Urgente'],
      assigned_to: 'Mario Rossi',
      created_date: '2026-10-01T08:00:00.000Z',
      state_change_date: '2026-11-02T10:00:00.000Z',
      severity: 'High',
      pi: null,
      sprint: 'Sprint 28',
      parent: 'AUR-9',
      description: 'Il login impiega dieci secondi.',
      // Jira has no field for them: null, where an empty text would say they are missing.
      acceptance_criteria: null,
      // A comment without a date is not one the dashboard can order.
      discussion: [
        { by: 'Carla Bianchi', date: '2026-11-03T09:00:00.000Z', text: 'Quando lo rilasciate?' },
      ],
    })
  })

  it('leaves empty what the issue does not say', () => {
    const bare = issue({ assignee: null, createdAt: null, description: null, comments: [] })
    expect(trackerItemOf(bare, null)).toMatchObject({
      assigned_to: null,
      created_date: null,
      state_change_date: null,
      description: '',
      discussion: [],
    })
  })

  it('reads when the state last changed from the search answer', () => {
    const raw = { fields: { statuscategorychangedate: '2026-11-02T11:00:00.000+0100' } }
    expect(stateChangeOf(raw)).toBe('2026-11-02T10:00:00.000Z')
    expect(stateChangeOf({ fields: { statuscategorychangedate: 'ieri' } })).toBeNull()
    expect(stateChangeOf({ fields: {} })).toBeNull()
    expect(stateChangeOf(null)).toBeNull()
  })
})

describe('the changelog of an issue', () => {
  it('keeps the changes of state and of labels, and nothing else', () => {
    const page = changelogPageOf({
      total: 7,
      values: [
        jiraChange(
          '2026-10-05T09:00:00.000+0000',
          { field: 'status', from: 'Da completare', to: 'In corso' },
          { field: 'assignee', from: null, to: 'Mario Rossi' },
        ),
        jiraChange('2026-10-06T09:00:00.000+0000', {
          field: 'labels',
          from: '',
          to: 'Squadra Urgente',
        }),
        // A change without a date, or without its fields, tells nothing.
        { created: 'mai', items: [{ field: 'status', toString: 'Chiuso' }] },
        { created: '2026-10-07T09:00:00.000+0000' },
        { created: '2026-10-08T09:00:00.000+0000', items: ['x'] },
      ],
    })
    expect(page).toEqual({
      states: [{ at: '2026-10-05T09:00:00.000Z', from: 'Da completare', to: 'In corso' }],
      tags: [{ at: '2026-10-06T09:00:00.000Z', from: '', to: 'Squadra Urgente' }],
      read: 5,
      total: 7,
    })
    // Without a total, the page is all there is.
    expect(changelogPageOf({ values: [] })).toMatchObject({ read: 0, total: 0 })
  })

  it('refuses an answer that is not a page of changes', () => {
    expect(() => changelogPageOf({})).toThrow()
    expect(() => changelogPageOf({ values: [3] })).toThrow()
  })

  it('tells the state and the labels the issue was born with from its first change', () => {
    const item = trackerItemOf(issue({ status: 'Chiuso', labels: ['Squadra'] }), null)
    const history = historyOf(item, {
      // Out of order: the history is told as it happened.
      states: [
        { at: '2026-10-09T09:00:00.000Z', from: 'In corso', to: 'Chiuso' },
        { at: '2026-10-05T09:00:00.000Z', from: 'Da completare', to: 'In corso' },
      ],
      tags: [{ at: '2026-10-06T09:00:00.000Z', from: 'Urgente', to: 'Squadra  Urgente' }],
    })
    expect(history).toEqual({
      created: '2026-10-01T08:00:00.000Z',
      states: [
        ['2026-10-01T08:00:00.000Z', 'Da completare'],
        ['2026-10-05T09:00:00.000Z', 'In corso'],
        ['2026-10-09T09:00:00.000Z', 'Chiuso'],
      ],
      tags: [
        ['2026-10-01T08:00:00.000Z', 'Urgente'],
        ['2026-10-06T09:00:00.000Z', 'Squadra; Urgente'],
      ],
    })
  })

  it('calls every state as the issues call it, by the id Jira gives the state', () => {
    // The changelog writes the states in the language of the site, with their ids beside.
    const page = changelogPageOf({
      values: [
        {
          created: '2026-10-05T09:00:00.000+0000',
          items: [
            {
              field: 'status',
              from: '10000',
              fromString: 'To Do',
              to: '3',
              toString: 'In Progress',
            },
          ],
        },
        {
          created: '2026-10-09T09:00:00.000+0000',
          items: [
            {
              field: 'status',
              from: '3',
              fromString: 'In Progress',
              to: '10002',
              toString: 'Done',
            },
          ],
        },
      ],
    })
    expect(page.states[0]).toEqual({
      at: '2026-10-05T09:00:00.000Z',
      from: 'To Do',
      to: 'In Progress',
      fromId: '10000',
      toId: '3',
    })
    const item = trackerItemOf(issue({ status: 'Completata' }), null)
    // The issues read carry «Da completare» and «Completata»; nobody is «In Progress» now.
    const names = new Map([
      ['10000', 'Da completare'],
      ['10002', 'Completata'],
    ])
    expect(historyOf(item, page, names).states.map(([, state]) => state)).toEqual([
      'Da completare',
      'In Progress',
      'Completata',
    ])
    // Without the names, the changelog is told as it is written.
    expect(historyOf(item, page).states.map(([, state]) => state)).toEqual([
      'To Do',
      'In Progress',
      'Done',
    ])
    expect(statusIdOf({ fields: { status: { id: '10002', name: 'Completata' } } })).toBe('10002')
    expect(statusIdOf({ fields: {} })).toBeNull()
    expect(statusIdOf(null)).toBeNull()
  })

  it('takes what the issue has now for one that never changed', () => {
    const labelled = trackerItemOf(issue(), null)
    expect(historyOf(labelled, { states: [], tags: [] })).toEqual({
      created: '2026-10-01T08:00:00.000Z',
      states: [['2026-10-01T08:00:00.000Z', 'In corso']],
      tags: [['2026-10-01T08:00:00.000Z', 'Squadra; Urgente']],
    })
    const plain = trackerItemOf(issue({ labels: [] }), null)
    expect(historyOf(plain, { states: [], tags: [] }).tags).toEqual([])
    // Born with no label, labelled later.
    expect(
      historyOf(plain, {
        states: [],
        tags: [{ at: '2026-10-06T09:00:00.000Z', from: '', to: 'A' }],
      }).tags,
    ).toEqual([['2026-10-06T09:00:00.000Z', 'A']])
    // Without the day it was created nothing places its first state.
    const undated = trackerItemOf(issue({ createdAt: null }), null)
    expect(historyOf(undated, { states: [], tags: [] })).toEqual({
      created: null,
      states: [],
      tags: [],
    })
  })
})

describe('a snapshot of Jira', () => {
  let fake: FakeJira
  afterEach(() => fake?.server.close())

  async function snapshot(
    issues: FakeIssue[],
    options: { changelogPageSize?: number; scope?: string[] } = {},
  ): Promise<AdoTrackerSnapshot | JiraTrackerSnapshot> {
    fake = await startFakeJira({
      email: EMAIL,
      token: TOKEN,
      projects: [AURORA, BOREALE],
      issues,
      ...(options.changelogPageSize ? { changelogPageSize: options.changelogPageSize } : {}),
    })
    const reader = createConnectorReader({ devEndpoints: { jira: fake.server.origin } })
    const source = await reader.connect('jira', CONFIG, TOKEN, options.scope ?? ['AUR'])
    return reader.tracker(
      { kind: 'jira', ...source, secret: TOKEN },
      { detailTypes: ['bug'] },
      new AbortController().signal,
    )
  }

  const bug = jiraIssue(1, 'AUR-1', AURORA, {
    type: 'Bug',
    summary: 'Login lento',
    status: 'In test',
    labels: ['Squadra'],
    created: '2026-10-01T08:00:00.000+0000',
    updated: '2026-11-04T10:00:00.000+0000',
    stateChanged: '2026-10-20T08:00:00.000+0000',
    sprints: [{ name: 'Sprint 28', state: 'active' }],
    comments: [jiraComment(1, '2026-11-03T09:00:00.000+0000', 'Quando lo rilasciate?')],
    changelog: [
      jiraChange('2026-10-05T09:00:00.000+0000', {
        field: 'status',
        from: 'Da completare',
        to: 'In corso',
      }),
      jiraChange('2026-10-21T09:00:00.000+0000', {
        field: 'status',
        from: 'In corso',
        to: 'In test',
      }),
    ],
  })
  const story = jiraIssue(2, 'AUR-2', AURORA, {
    type: 'Story',
    status: 'Da completare',
    updated: '2026-11-05T10:00:00.000+0000',
    stateChanged: '2026-10-02T08:00:00.000+0000',
    changelog: [
      jiraChange('2026-10-02T08:00:00.000+0000', { field: 'status', from: 'X', to: 'Y' }),
    ],
  })
  const elsewhere = jiraIssue(3, 'BOR-1', BOREALE, {
    type: 'Bug',
    updated: '2026-11-05T10:00:00.000+0000',
  })

  it('holds every issue of the chosen projects, with the history of the types asked', async () => {
    const read = await snapshot([story, bug, elsewhere])

    expect(read.items.map((item) => [item.id, item.type, item.state, item.sprint])).toEqual([
      ['AUR-1', 'Bug', 'In test', 'Sprint 28'],
      ['AUR-2', 'Story', 'Da completare', null],
    ])
    expect(read.items[0]).toMatchObject({
      tags: ['Squadra'],
      created_date: '2026-10-01T08:00:00.000Z',
      // The last change of state, finer than the change of its category.
      state_change_date: '2026-10-21T09:00:00.000Z',
      discussion: [{ by: 'Mario Rossi', text: 'Quando lo rilasciate?' }],
    })
    // The story is not of a type asked: what the search says of its state stays, no history.
    expect(read.items[1]?.state_change_date).toBe('2026-10-02T08:00:00.000Z')
    expect(read.history).toEqual({
      'AUR-1': {
        created: '2026-10-01T08:00:00.000Z',
        states: [
          ['2026-10-01T08:00:00.000Z', 'Da completare'],
          ['2026-10-05T09:00:00.000Z', 'In corso'],
          ['2026-10-21T09:00:00.000Z', 'In test'],
        ],
        tags: [['2026-10-01T08:00:00.000Z', 'Squadra']],
      },
    })
    expect(Number.isNaN(Date.parse(read.exportedAt))).toBe(false)
  })

  it('reads the changelog page by page, and the comments the search cut', async () => {
    const chatty = jiraIssue(1, 'AUR-1', AURORA, {
      type: 'Bug',
      updated: '2026-11-04T10:00:00.000+0000',
      comments: [
        jiraComment(1, '2026-11-01T09:00:00.000+0000', 'primo'),
        jiraComment(2, '2026-11-02T09:00:00.000+0000', 'secondo'),
      ],
      changelog: [
        jiraChange('2026-10-05T09:00:00.000+0000', { field: 'status', from: 'A', to: 'B' }),
        jiraChange('2026-10-06T09:00:00.000+0000', { field: 'status', from: 'B', to: 'C' }),
        jiraChange('2026-10-07T09:00:00.000+0000', { field: 'status', from: 'C', to: 'D' }),
      ],
    })
    fake = await startFakeJira({
      email: EMAIL,
      token: TOKEN,
      projects: [AURORA],
      issues: [chatty],
      changelogPageSize: 2,
    })
    fake.inlineComments = 1
    const reader = createConnectorReader({ devEndpoints: { jira: fake.server.origin } })
    const source = await reader.connect('jira', CONFIG, TOKEN, ['AUR'])
    const read = await reader.tracker(
      { kind: 'jira', ...source, secret: TOKEN },
      { detailTypes: ['Bug'] },
      new AbortController().signal,
    )
    expect(read.history['AUR-1']?.states.map(([, state]) => state)).toEqual(['A', 'B', 'C', 'D'])
    expect(read.items[0]?.discussion.map((comment) => comment.text)).toEqual(['primo', 'secondo'])
  })

  it('drops what the system returns outside the chosen projects', async () => {
    fake = await startFakeJira({
      email: EMAIL,
      token: TOKEN,
      projects: [AURORA, BOREALE],
      issues: [bug, elsewhere],
    })
    fake.leakPerimeter = true
    const reader = createConnectorReader({ devEndpoints: { jira: fake.server.origin } })
    const source = await reader.connect('jira', CONFIG, TOKEN, ['AUR'])
    const read = await reader.tracker(
      { kind: 'jira', ...source, secret: TOKEN },
      { detailTypes: [] },
      new AbortController().signal,
    )
    expect(read.items.map((item) => item.id)).toEqual(['AUR-1'])
    expect(read.history).toEqual({})
  })

  it('fails on a search that says there is more and gives no way to it', async () => {
    const many = Array.from({ length: 101 }, (_, at) =>
      jiraIssue(at + 1, `AUR-${at + 1}`, AURORA, { updated: '2026-11-04T10:00:00.000+0000' }),
    )
    fake = await startFakeJira({ email: EMAIL, token: TOKEN, projects: [AURORA], issues: many })
    const reader = createConnectorReader({ devEndpoints: { jira: fake.server.origin } })
    const source = await reader.connect('jira', CONFIG, TOKEN, ['AUR'])
    const all = await reader.tracker(
      { kind: 'jira', ...source, secret: TOKEN },
      { detailTypes: [] },
      new AbortController().signal,
    )
    expect(all.items).toHaveLength(101)
    fake.dropNextPageToken = true
    await expect(
      reader.tracker(
        { kind: 'jira', ...source, secret: TOKEN },
        { detailTypes: [] },
        new AbortController().signal,
      ),
    ).rejects.toMatchObject({ code: 'source_bad_response' })
  })
})
