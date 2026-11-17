import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readdir, readFile, realpath, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createFeeds, type SecretVault } from '@octo/application'
import {
  type AdoFeedConfig,
  type ConfluenceFeedConfig,
  type JiraFeedConfig,
  type Project,
  parseTimesheetExport,
  parseTrackerExport,
  parseTrackerHistory,
  type WarehouseFeedConfig,
} from '@octo/domain'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { type FakeAdo, startFakeAdo, workItem } from '../../connectors/test/support/fake-ado.ts'
import {
  type FakeConfluence,
  startFakeConfluence,
} from '../../connectors/test/support/fake-confluence.ts'
import { type FakeDwsi, startFakeDwsi } from '../../connectors/test/support/fake-dwsi.ts'
import { type FakeJira, jiraIssue, startFakeJira } from '../../connectors/test/support/fake-jira.ts'
import {
  type ConnectorFeedOptions,
  createAdoTrackerReader,
  createConnectorFeedReader,
  createFsFeedIndexes,
  createFsMemoryWriter,
  createFsProjectFiles,
  createFsSourceSettings,
  createJiraHoursReader,
  createWarehouseTimesheetReader,
  jiraSite,
} from '../src/index.ts'
import { fsReadings } from './support/readings.ts'

const HAS_TEST_DATABASE =
  Boolean(process.env.DATABASE_OWNER_URL) ||
  existsSync(fileURLToPath(new URL('../../../.env.local', import.meta.url)))
const PAT = 'pat-ok'
const SINCE = '2026-11-01'
/** The warehouse is named, never addressed: in the tests the name leads to this computer. */
const WAREHOUSE_HOST = 'dwsi.example.test'
const LOCAL_WAREHOUSE: ConnectorFeedOptions = {
  allowLoopback: true,
  resolveHost: async () => [{ address: '127.0.0.1', family: 4 }],
}

let root: string
let count = 0

beforeAll(async () => {
  root = await realpath(await mkdtemp(join(tmpdir(), 'octo-feeds-')))
})

afterAll(async () => {
  await rm(root, { recursive: true, force: true })
})

function memoryVault(): SecretVault {
  const all = new Map<string, string>()
  return {
    get: async (key) => all.get(key) ?? null,
    set: async (key, value) => void all.set(key, value),
    remove: async (key) => void all.delete(key),
  }
}

async function setup(options: ConnectorFeedOptions) {
  count += 1
  const folder = join(root, `progetto-${count}`)
  await mkdir(folder)
  const project: Project = { id: `p-${count}`, name: 'Aurora', folder, addedAt: '' }
  const data = join(root, `dati-${count}`)
  const feeds = createFeeds({
    settings: createFsSourceSettings(),
    readings: fsReadings(data, { now: () => new Date('2026-11-14T10:00:00.000Z') }),
    indexes: createFsFeedIndexes(),
    secrets: memoryVault(),
    reader: createConnectorFeedReader(options),
    writer: createFsMemoryWriter(),
    files: createFsProjectFiles(),
    clock: { now: () => new Date('2026-11-14T10:00:00.000Z') },
  })
  const names = async (sub: string) => (await readdir(join(folder, sub))).sort()
  const text = (path: string) => readFile(join(folder, path), 'utf8')
  return { feeds, project, names, text }
}

describe('Azure DevOps as files of the project', () => {
  const PROJECT = 'Aurora'
  const config: AdoFeedConfig = {
    organization: 'contoso',
    project: PROJECT,
    areas: [],
    since: SINCE,
    targetFolder: 'Fonti/ADO',
  }
  const item = (id: number, changedAt: string, title: string, state = 'Active') =>
    workItem(id, { area: PROJECT, iteration: PROJECT, changedAt, title, state })
  let fake: FakeAdo
  afterEach(() => fake?.server.close())

  async function start(items: ReturnType<typeof workItem>[]) {
    fake = await startFakeAdo({
      organization: 'contoso',
      projectId: '6ce954b1-ce1f-45d1-b94d-e6bf2464ba2c',
      projectName: PROJECT,
      pat: PAT,
      areas: [{ name: 'Team A' }],
      iterations: [{ name: 'Sprint 1' }],
      items,
    })
    return setup({ devEndpoints: { ado: fake.server.origin } })
  }

  it('reads the tracker as it is now, in the shape the dashboard reads', async () => {
    const bug = workItem(7, {
      area: PROJECT,
      iteration: `${PROJECT}\\Sprint 1`,
      changedAt: '2026-11-05T10:00:00Z',
      createdAt: '2026-10-01T08:00:00Z',
      type: 'Bug',
      title: 'Errore IVA',
      state: 'Ready for Test',
      tags: 'Squadra',
    })
    bug.updates = [
      {
        fields: {
          'System.ChangedDate': { newValue: '2026-10-01T08:00:00Z' },
          'System.CreatedDate': { newValue: '2026-10-01T08:00:00Z' },
          'System.State': { newValue: 'New' },
        },
      },
    ]
    const old = workItem(8, {
      area: PROJECT,
      iteration: PROJECT,
      changedAt: '2026-10-01T10:00:00Z',
      createdAt: '2026-09-01T08:00:00Z',
    })
    await start([bug, old])
    const reader = createAdoTrackerReader({ devEndpoints: { ado: fake.server.origin } })
    const signal = new AbortController().signal

    const snapshot = await reader.read(config, PAT, ['Bug'], signal)

    // Whatever its change date: a snapshot is the whole tracker, not what changed since a day.
    const parsed = parseTrackerExport({ exported_at: snapshot.exportedAt, items: snapshot.items })
    expect(parsed?.items.map((entry) => [entry.id, entry.type, entry.period])).toEqual([
      ['7', 'Bug', 'Sprint 1'],
      ['8', 'User Story', null],
    ])
    expect(parsed?.items[0]).toMatchObject({ tags: ['Squadra'], createdAt: '2026-10-01T08:00:00Z' })
    const history = parseTrackerHistory({ bugs: snapshot.history })
    expect(history?.get('7')?.states).toEqual([{ at: '2026-10-01T08:00:00Z', state: 'New' }])
    expect(history?.has('8')).toBe(false)
    await expect(reader.read(config, 'wrong', ['Bug'], signal)).rejects.toMatchObject({
      code: 'feed_credential_refused',
    })
  })

  it('writes one file per work item changed since the first day, then only what changes', async () => {
    const { feeds, project, names, text } = await start([
      item(1, '2026-11-04T10:00:00Z', 'Login con SSO'),
      item(2, '2026-11-05T10:00:00Z', 'Export in PDF', 'Blocked'),
      item(3, '2026-10-01T10:00:00Z', 'Vecchia attività'),
    ])
    const itemFiles = async () =>
      (await names('Fonti/ADO')).filter((name) => /^\d+-[0-9a-f]{8}\.md$/.test(name))

    await feeds.save(project, 'ado', config, PAT)
    const first = await feeds.sync(project, 'ado')

    expect(first).toMatchObject({ unchanged: 0, error: null })
    const files = await itemFiles()
    expect(files.map((name) => name.split('-')[0])).toEqual(['1', '2'])
    const blocked = await text(`Fonti/ADO/${files[1]}`)
    expect(blocked).toContain('Export in PDF')
    expect(blocked).toContain('Blocked')
    expect(await text('Fonti/ADO/_lettura.md')).toContain('fonte: "Azure DevOps"')

    fake.options.items.push(item(4, '2026-11-13T10:00:00Z', 'Nuova richiesta'))
    expect((await feeds.sync(project, 'ado')).error).toBeNull()
    expect((await itemFiles()).map((name) => name.split('-')[0])).toEqual(['1', '2', '4'])
  })

  it('lists the projects the token sees and, once one is named, its areas', async () => {
    const { feeds, project } = await start([])
    const choices = (name: string) =>
      feeds.choices(project, 'ado', { ...config, project: name }, PAT)

    expect(await choices('')).toEqual({
      projects: [{ value: PROJECT, label: PROJECT }],
      areas: [],
    })
    expect((await choices('aurora')).areas).toEqual([{ value: 'Team A', label: 'Team A' }])
    await expect(feeds.choices(project, 'ado', config, 'pat-sbagliato')).rejects.toMatchObject({
      code: 'feed_credential_refused',
    })
  })

  it('refuses a wrong token and a project or an area the account does not see', async () => {
    const { feeds, project } = await start([])
    const save = (changes: Partial<AdoFeedConfig>, secret = PAT) =>
      feeds.save(project, 'ado', { ...config, ...changes }, secret)

    await expect(save({}, 'pat-sbagliato')).rejects.toMatchObject({
      code: 'feed_credential_refused',
    })
    await expect(save({ project: 'Inesistente' })).rejects.toMatchObject({ code: 'feed_not_found' })
    await expect(save({ areas: ['Team Z'] })).rejects.toMatchObject({ code: 'feed_not_found' })
  })
})

describe('Confluence as files of the project', () => {
  const aurora = { id: '100', key: 'AUR', name: 'Aurora' }
  const zefiro = { id: '200', key: 'ZEF', name: 'Zefiro' }
  const config: ConfluenceFeedConfig = {
    site: 'contoso.atlassian.net',
    email: 'pm@example.test',
    spaces: ['AUR'],
    since: SINCE,
    targetFolder: 'Fonti/Confluence',
  }
  const page = (id: string, spaceId: string, changedAt: string, title: string, body: string) => ({
    id,
    spaceId,
    title,
    changedAt,
    version: 1,
    paragraphs: [body],
  })
  let fake: FakeConfluence
  afterEach(() => fake?.server.close())

  async function start() {
    fake = await startFakeConfluence({
      email: config.email,
      token: PAT,
      spaces: [aurora, zefiro],
      pages: [
        page('1', aurora.id, '2026-10-20T10:00:00.000Z', 'Vecchia', 'Prima del primo giorno.'),
        page(
          '2',
          aurora.id,
          '2026-11-04T10:00:00.000Z',
          'Decisioni',
          'Il collaudo è il 17 dicembre.',
        ),
        page('3', zefiro.id, '2026-11-05T10:00:00.000Z', 'Altro spazio', 'Non richiesto.'),
      ],
    })
    return setup({ devEndpoints: { confluence: fake.server.origin } })
  }

  it('writes one file per page of the spaces named, changed since the first day, then only what changes', async () => {
    const { feeds, project, names, text } = await start()
    await feeds.save(project, 'confluence', config, PAT)
    expect((await feeds.sync(project, 'confluence')).error).toBeNull()

    const pages = async () =>
      (await names('Fonti/Confluence')).filter((name) => !name.startsWith('_'))
    const files = await pages()
    expect(files).toHaveLength(1)
    expect(files[0]).toMatch(/^2026-11-04-decisioni-/)
    const written = await text(`Fonti/Confluence/${files[0]}`)
    expect(written).toContain('Il collaudo è il 17 dicembre.')
    expect(written).toContain('/wiki/spaces/100/pages/2')
    expect(await text('Fonti/Confluence/_lettura.md')).toContain('fonte: "Confluence"')

    fake.options.pages.push(
      page('4', aurora.id, '2026-11-10T09:00:00.000Z', 'Verbale', 'Azioni assegnate.'),
    )
    const again = await feeds.sync(project, 'confluence')
    expect(again).toMatchObject({ error: null, written: 1 })
    expect(await pages()).toHaveLength(2)
    // Never a write, never a page of a space that was not named.
    expect(fake.server.received.every((request) => request.method === 'GET')).toBe(true)
    expect(fake.server.received.some((request) => request.url.includes('/spaces/200/'))).toBe(false)
  })

  it('lists the spaces of the account by their key, and refuses what it cannot read', async () => {
    const { feeds, project } = await start()
    expect(await feeds.choices(project, 'confluence', config, PAT)).toEqual({
      projects: [
        { value: 'AUR', label: 'Aurora (AUR)' },
        { value: 'ZEF', label: 'Zefiro (ZEF)' },
      ],
      areas: [],
    })
    await expect(feeds.save(project, 'confluence', config, 'sbagliato')).rejects.toMatchObject({
      code: 'feed_credential_refused',
    })
    await expect(
      feeds.save(project, 'confluence', { ...config, spaces: ['Inesistente'] }, PAT),
    ).rejects.toMatchObject({ code: 'feed_not_found' })
    await expect(
      feeds.save(project, 'confluence', { ...config, spaces: [] }, PAT),
    ).rejects.toMatchObject({ code: 'source_config_invalid' })
  })
})

describe('Jira as files of the project', () => {
  const aurora = { id: '10001', key: 'AUR', name: 'Aurora' }
  const zefiro = { id: '10002', key: 'ZEF', name: 'Zefiro' }
  const config: JiraFeedConfig = {
    site: 'https://contoso.atlassian.net/',
    email: 'pm@example.test',
    projects: ['AUR'],
    since: SINCE,
    targetFolder: 'Fonti/Jira',
  }
  let fake: FakeJira
  afterEach(() => fake?.server.close())

  it('writes one file per issue of the projects named', async () => {
    const updated = '2026-11-04T10:00:00.000+0000'
    fake = await startFakeJira({
      email: config.email,
      token: PAT,
      projects: [aurora, zefiro],
      issues: [
        jiraIssue(1, 'AUR-1', aurora, { updated, summary: 'Bug sul login' }),
        jiraIssue(2, 'ZEF-1', zefiro, { updated }),
      ],
    })
    fake.now = new Date('2026-11-14T10:00:00.000Z')
    const { feeds, project, names, text } = await setup({
      devEndpoints: { jira: fake.server.origin },
    })

    await feeds.save(project, 'jira', config, PAT)
    expect((await feeds.sync(project, 'jira')).error).toBeNull()

    const files = await names('Fonti/Jira')
    const issue = files.find((name) => name.startsWith('aur-1-'))
    expect(issue).toBeDefined()
    expect(files.some((name) => name.startsWith('zef-'))).toBe(false)
    expect(await text(`Fonti/Jira/${issue}`)).toContain('Bug sul login')
  })

  it('reads the hours logged on the issues of the projects named, when asked', async () => {
    const issue = jiraIssue(1, 'AUR-1', aurora, { updated: '2026-06-04T10:00:00.000+0000' })
    issue.fields.worklog = {
      worklogs: [
        {
          started: '2026-06-03T09:00:00.000+0200',
          timeSpentSeconds: 5400,
          author: { displayName: 'Mario Rossi' },
        },
        {
          started: '2026-07-01T09:00:00.000+0200',
          timeSpentSeconds: 3600,
          author: { displayName: 'Mario Rossi' },
        },
      ],
    }
    const other = jiraIssue(2, 'ZEF-1', zefiro, { updated: '2026-06-04T10:00:00.000+0000' })
    other.fields.worklog = {
      worklogs: [
        {
          started: '2026-06-03T09:00:00.000+0200',
          timeSpentSeconds: 3600,
          author: { displayName: 'Altro' },
        },
      ],
    }
    fake = await startFakeJira({
      email: config.email,
      token: PAT,
      projects: [aurora, zefiro],
      issues: [issue, other],
    })
    const reader = createJiraHoursReader({ devEndpoints: { jira: fake.server.origin } })
    const june = { from: '2026-06-01', to: '2026-06-30' }
    const signal = new AbortController().signal
    expect(await reader.read(config, PAT, june, signal)).toEqual([
      { person: 'Mario Rossi', day: '2026-06-03', hours: 1.5, issue: 'AUR-1' },
    ])
    await expect(reader.read(config, 'wrong', june, signal)).rejects.toMatchObject({
      code: 'feed_credential_refused',
    })
  })

  it('lists the projects of the account by their key', async () => {
    fake = await startFakeJira({
      email: config.email,
      token: PAT,
      projects: [aurora, zefiro],
      issues: [],
    })
    const { feeds, project } = await setup({ devEndpoints: { jira: fake.server.origin } })

    const choices = await feeds.choices(project, 'jira', { ...config, projects: [] }, PAT)

    expect(choices.projects.map((choice) => choice.value)).toEqual(['AUR', 'ZEF'])
    expect(choices.areas).toEqual([])
  })

  it('reads the site however it is written', () => {
    expect(jiraSite(' https://Contoso.atlassian.net/jira/x ')).toBe('Contoso')
    expect(jiraSite('contoso')).toBe('contoso')
  })
})

describe.runIf(HAS_TEST_DATABASE)('the NetSuite warehouse as files of the project', () => {
  let fake: FakeDwsi
  beforeAll(async () => {
    fake = await startFakeDwsi()
  })
  afterAll(async () => {
    await fake?.drop()
  })

  const config = (): WarehouseFeedConfig => ({
    host: WAREHOUSE_HOST,
    port: fake.port,
    database: fake.database,
    user: fake.reader.user,
    ownerEmail: 'marta.neri@example.test',
    projectCodes: ['prj000101'],
    tls: 'plaintext',
    since: '2026-01-01',
    targetFolder: 'Fonti/NetSuite',
  })

  it('reads the timesheets of a period as an export the hours comparison reads', async () => {
    const reader = createWarehouseTimesheetReader(LOCAL_WAREHOUSE)
    const signal = new AbortController().signal
    const october = { from: '2026-10-01', to: '2026-10-31' }

    // The settings of a source are kept clean: the codes in upper case.
    const clean = { ...config(), projectCodes: ['PRJ000101'] }

    const rows = await reader.read(clean, fake.reader.password, october, signal)

    expect(parseTimesheetExport({ rows })).toEqual([
      {
        person: 'Anna Riva',
        day: '2026-10-05',
        hours: 7.5,
        project: 'PRJ000101',
        approved: true,
        id: '9001',
        cost: 309,
      },
      {
        person: 'Bruno Sala',
        day: '2026-10-06',
        hours: 8,
        project: 'PRJ000101',
        approved: false,
        id: '9002',
        cost: 304,
      },
    ])
    expect(JSON.stringify(rows)).not.toMatch(/laborcosthh|memo/)
    await expect(reader.read(clean, 'sbagliata', october, signal)).rejects.toMatchObject({
      code: 'feed_credential_refused',
    })
  })

  it('writes the rows of each view of the project, and finds them unchanged afterwards', async () => {
    const { feeds, project, names, text } = await setup(LOCAL_WAREHOUSE)

    await feeds.save(project, 'dwsi', config(), fake.reader.password)
    const first = await feeds.sync(project, 'dwsi')
    expect(first.error).toBeNull()
    expect(first.written).toBeGreaterThan(0)

    expect(await names('Fonti/NetSuite')).toContain('v-timesheet-all')
    const timesheet = await text('Fonti/NetSuite/v-timesheet-all/prj-prj000101.md')
    expect(timesheet).toContain('Anna Riva')
    expect(timesheet).not.toContain('Carla Fumi')

    const second = await feeds.sync(project, 'dwsi')
    expect(second.error).toBeNull()
    expect(second.unchanged).toBeGreaterThan(0)
  })

  it('refuses a wrong password and an account that can write', async () => {
    const { feeds, project } = await setup(LOCAL_WAREHOUSE)

    await expect(feeds.save(project, 'dwsi', config(), 'sbagliata')).rejects.toMatchObject({
      code: 'feed_credential_refused',
    })
    await expect(
      feeds.save(project, 'dwsi', { ...config(), user: fake.writer.user }, fake.writer.password),
    ).rejects.toMatchObject({ code: 'feed_write_access_refused' })
  })
})
