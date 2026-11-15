import { afterEach, describe, expect, it } from 'vitest'
import { createConnectorReader } from '../src/index.ts'
import { customFieldsOf } from '../src/jira/connector.ts'
import { type FakeJira, jiraIssue, startFakeJira } from './support/fake-jira.ts'

const EMAIL = 'pm@example.test'
const TOKEN = 'token-ok'
const AURORA = { id: '10000', key: 'AUR', name: 'Aurora' }
const CONFIG = { site: 'contoso', email: EMAIL, readOnlyToken: true }

describe('Jira through the connector reader', () => {
  let fake: FakeJira
  afterEach(() => fake?.server.close())

  const start = async () => {
    fake = await startFakeJira({
      email: EMAIL,
      token: TOKEN,
      projects: [AURORA],
      issues: [
        jiraIssue(1, 'AUR-1', AURORA, {
          updated: '2026-11-04T10:00:00.000+0000',
          storyPoints: 5,
          sprints: [
            { name: 'Sprint 27', state: 'closed' },
            { name: 'Sprint 28', state: 'active' },
          ],
        }),
      ],
    })
    return createConnectorReader({ devEndpoints: { jira: fake.server.origin } })
  }
  const firstRecord = async (reader: ReturnType<typeof createConnectorReader>) => {
    const { config, perimeter } = await reader.connect('jira', CONFIG, TOKEN, ['AUR'])
    const read = await reader.pull(
      { kind: 'jira', config, perimeter, secret: TOKEN },
      null,
      new AbortController().signal,
    )
    return { config, record: read.records[0]?.record }
  }

  it('learns from the site which fields hold the sprint and the estimate, and reads them', async () => {
    const { config, record } = await firstRecord(await start())
    expect(config).toMatchObject({
      sprintField: 'customfield_10020',
      storyPointsField: 'customfield_10016',
    })
    expect(record).toMatchObject({
      sprint: 'Sprint 28',
      sprints: ['Sprint 27', 'Sprint 28'],
      storyPoints: 5,
    })
  })

  it('reads the issues without sprint when the site does not show its fields', async () => {
    const reader = await start()
    fake.hideFields = true
    const { config, record } = await firstRecord(reader)
    expect(config).toMatchObject({ sprintField: null, storyPointsField: null })
    expect(record).toMatchObject({ sprint: null, sprints: [], storyPoints: null })
  })

  it('keeps the fields the settings already name', async () => {
    const reader = await start()
    const named = {
      ...CONFIG,
      sprintField: 'customfield_10099',
      storyPointsField: 'customfield_10098',
    }
    const { config } = await reader.connect('jira', named, TOKEN, ['AUR'])
    expect(config).toMatchObject({
      sprintField: 'customfield_10099',
      storyPointsField: 'customfield_10098',
    })
  })
})

describe('the fields of a Jira site', () => {
  const sprint = { type: 'array', custom: 'com.pyxis.greenhopper.jira:gh-sprint' }
  it('finds the sprint by its type and the estimate by its type or its name', () => {
    expect(
      customFieldsOf([
        { id: 'summary', name: 'Summary' },
        { id: 'customfield_1', name: 'Sprint', schema: sprint },
        { id: 'customfield_2', name: 'Altro sprint', schema: sprint },
        { id: 'customfield_3', name: ' Story Points ' },
        {
          id: 'customfield_4',
          name: 'Story point estimate',
          schema: { custom: 'com.pyxis.greenhopper.jira:jsw-story-points' },
        },
        { id: 'customfield_x', name: 'Sprint', schema: sprint },
        'noise',
      ]),
    ).toEqual({ sprintField: 'customfield_1', storyPointsField: 'customfield_4' })
    expect(customFieldsOf([{ id: 'customfield_3', name: 'Story Point' }])).toEqual({
      sprintField: null,
      storyPointsField: 'customfield_3',
    })
    expect(customFieldsOf([])).toEqual({ sprintField: null, storyPointsField: null })
    expect(() => customFieldsOf({ values: [] })).toThrow()
  })
})
