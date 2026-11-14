import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readdir, readFile, realpath, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createFeeds, type SecretVault } from '@octo/application'
import type { AdoFeedConfig, JiraFeedConfig, Project, WarehouseFeedConfig } from '@octo/domain'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { type FakeAdo, startFakeAdo, workItem } from '../../connectors/test/support/fake-ado.ts'
import { type FakeDwsi, startFakeDwsi } from '../../connectors/test/support/fake-dwsi.ts'
import { type FakeJira, jiraIssue, startFakeJira } from '../../connectors/test/support/fake-jira.ts'
import {
  type ConnectorFeedOptions,
  createConnectorFeedReader,
  createFsMemoryWriter,
  createFsProjectFiles,
  createFsSourceSettings,
  createJsonFeedIndexes,
  createJsonSourceStates,
  jiraSite,
} from '../src/index.ts'

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
    states: createJsonSourceStates(data),
    indexes: createJsonFeedIndexes(data),
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
