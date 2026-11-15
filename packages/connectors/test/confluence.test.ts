import { afterEach, describe, expect, it } from 'vitest'
import {
  type BlockedCall,
  type ConfluenceConfig,
  type ConfluenceCursor,
  type ConnectorContext,
  ConnectorError,
  createConfluenceConnector,
  createNetGuard,
  createSafeHttp,
  rulesAllow,
} from '../src/index.ts'
import { SecretValue } from '../src/secret-value.ts'
import {
  type FakeConfluence,
  type FakeConfluenceOptions,
  type FakePage,
  startFakeConfluence,
} from './support/fake-confluence.ts'
import { assertRulesConfined } from './support/rules-contract.ts'

const EMAIL = 'pm@example.test'
const TOKEN = 'token-di-prova'
const AURORA = { id: '100', key: 'AUR', name: 'Aurora' }
const BOREA = { id: '200', key: 'BOR', name: 'Borea' }
const NOW = new Date('2026-11-15T09:00:00.000Z')
const config: ConfluenceConfig = { site: 'contoso', email: EMAIL, readOnlyToken: true }

const page = (id: string, spaceId: string, changedAt: string, over: Partial<FakePage> = {}) => ({
  id,
  spaceId,
  title: `Pagina ${id}`,
  changedAt,
  version: 1,
  paragraphs: [`Testo della pagina ${id}.`],
  ...over,
})

const PAGES: FakePage[] = [
  page('1', AURORA.id, '2026-10-01T10:00:00.000Z', {
    title: 'Decisioni di progetto',
    version: 3,
    paragraphs: ['Il collaudo è fissato al 17 dicembre.', 'Il canone resta invariato.'],
  }),
  page('2', AURORA.id, '2026-11-02T10:00:00.000Z'),
  page('3', BOREA.id, '2026-11-03T10:00:00.000Z'),
]

const fakes: FakeConfluence[] = []
afterEach(async () => {
  await Promise.all(fakes.splice(0).map((fake) => fake.server.close()))
})

async function setup(extra: Partial<FakeConfluenceOptions> = {}, secret: string | null = TOKEN) {
  const fake = await startFakeConfluence({
    email: EMAIL,
    token: TOKEN,
    spaces: [AURORA, BOREA],
    pages: PAGES,
    ...extra,
  })
  fakes.push(fake)
  const connector = createConfluenceConnector({
    endpoint: () => ({
      origin: fake.server.origin,
      host: fake.server.host,
      prefix: ['wiki'],
      browse: 'https://contoso.atlassian.net',
    }),
  })
  const blocked: BlockedCall[] = []
  const onBlocked = async (call: BlockedCall) => void blocked.push(call)
  const signal = new AbortController().signal
  const ctx = (perimeter: string[]): ConnectorContext<ConfluenceConfig> => ({
    config,
    perimeter,
    secret: secret === null ? null : new SecretValue(secret),
    http: createSafeHttp({ rules: connector.rules(config), onBlocked, allowLoopbackHttp: true }),
    net: createNetGuard({ privateHosts: [], onBlocked, allowLoopback: true }),
    signal,
    now: () => NOW,
  })
  const limits = { maxItems: 100, signal }
  return { fake, connector, ctx, blocked, limits }
}

const text = (bytes: Uint8Array | undefined) => new TextDecoder().decode(bytes)

describe('the Confluence connector', () => {
  it('reads a configuration as it is saved, and refuses one that is not', () => {
    const { parseConfig } = createConfluenceConnector()
    expect(parseConfig({ site: 'Contoso', email: EMAIL, readOnlyToken: true })).toEqual(config)
    for (const raw of [
      null,
      [],
      { ...config, readOnlyToken: false },
      { ...config, site: 'contoso.atlassian.net' },
      { ...config, site: 'a/b' },
      { ...config, email: 'senza-chiocciola' },
      { ...config, email: 'a:b@example.test' },
      { ...config, email: 7 },
    ]) {
      expect(() => parseConfig(raw)).toThrow(ConnectorError)
    }
  })

  it('allows four reads on the site of the configuration, and nothing else', () => {
    const rules = createConfluenceConnector().rules(config)
    expect(rules.every((rule) => rule.method === 'GET')).toBe(true)
    const allows = (method: string, path: string, host = 'contoso.atlassian.net') =>
      rulesAllow(rules, method, new URL(`https://${host}${path}`))
    expect(allows('GET', '/wiki/rest/api/user/current')).toBe(true)
    expect(allows('GET', '/wiki/api/v2/spaces')).toBe(true)
    expect(allows('GET', '/wiki/api/v2/spaces/100/pages')).toBe(true)
    expect(allows('GET', '/wiki/api/v2/pages/1')).toBe(true)
    expect(allows('POST', '/wiki/api/v2/pages/1')).toBe(false)
    expect(allows('GET', '/wiki/api/v2/pages/1/attachments')).toBe(false)
    expect(allows('GET', '/wiki/rest/api/content/search')).toBe(false)
    expect(allows('GET', '/wiki/api/v2/spaces', 'altro.atlassian.net')).toBe(false)
    // Whatever the site holds, the rules are those of a plain name, or none at all.
    assertRulesConfined(createConfluenceConnector().rules, (site) => ({ ...config, site }))
  })

  it('checks the credential and lists the spaces the account sees, page by page', async () => {
    const { connector, ctx } = await setup({ pageSize: 1 })
    expect(await connector.test(ctx([]))).toEqual({ ok: true })
    expect(await connector.perimeterOptions(ctx([]))).toEqual([
      { id: 'space:100', label: 'Aurora (AUR)' },
      { id: 'space:200', label: 'Borea (BOR)' },
    ])
    const wrong = await setup({}, 'sbagliato')
    expect(await wrong.connector.test(wrong.ctx([]))).toEqual({
      ok: false,
      code: 'source_auth_failed',
    })
    const none = await setup({}, null)
    expect(await none.connector.test(none.ctx([]))).toEqual({
      ok: false,
      code: 'source_credentials_missing',
    })
  })

  it('reads the pages of the chosen spaces as text, and then only what changes', async () => {
    const { connector, ctx, fake, limits } = await setup()
    const first = await connector.sync(ctx(['space:100']), null, limits)
    expect(first.done).toBe(true)
    expect(first.dataAsOf).toEqual(NOW)
    expect(first.items.map((item) => item.externalId)).toEqual(['page:1', 'page:2'])
    const decisions = first.items[0]
    expect(decisions).toMatchObject({
      title: 'Decisioni di progetto',
      version: '3',
      mediaType: 'text/markdown; charset=utf-8',
      perimeter: ['space:100'],
      url: 'https://contoso.atlassian.net/wiki/spaces/100/pages/1',
      author: null,
    })
    expect(decisions?.originAt).toEqual(new Date('2026-10-01T10:00:00.000Z'))
    expect(text(decisions?.bytes)).toBe(
      '# Decisioni di progetto\n\nIl collaudo è fissato al 17 dicembre.\nIl canone resta invariato.\n',
    )
    expect(first.nextCursor).toEqual({
      since: '2026-11-02T10:00:00.000Z',
      space: 0,
      next: null,
      seen: '2026-11-02T10:00:00.000Z',
    })
    // Never a page of a space that was not chosen, never an attachment, never a write.
    expect(fake.server.received.every((request) => request.method === 'GET')).toBe(true)
    expect(fake.server.received.some((request) => request.url.includes('/spaces/200/'))).toBe(false)

    const again = await connector.sync(ctx(['space:100']), first.nextCursor, limits)
    expect(again.items).toEqual([])
    fake.options.pages = [...PAGES, page('4', AURORA.id, '2026-11-10T08:00:00.000Z')]
    const later = await connector.sync(ctx(['space:100']), first.nextCursor, limits)
    expect(later.items.map((item) => item.externalId)).toEqual(['page:4'])
    expect(later.nextCursor?.since).toBe('2026-11-10T08:00:00.000Z')
  })

  it('goes on from where a batch stopped, across the pages of a list and the spaces', async () => {
    const many = Array.from({ length: 5 }, (_unused, index) =>
      page(String(10 + index), AURORA.id, `2026-11-0${index + 1}T10:00:00.000Z`),
    )
    const { connector, ctx, limits } = await setup({
      pages: [...many, PAGES[2] as FakePage],
      pageSize: 2,
    })
    const perimeter = ['space:100', 'space:200', 'area:non-uno-spazio']
    const read: string[] = []
    let cursor: ConfluenceCursor = null
    let batches = 0
    for (;;) {
      const batch = await connector.sync(ctx(perimeter), cursor, { ...limits, maxItems: 3 })
      read.push(...batch.items.map((item) => item.externalId))
      cursor = connector.parseCursor(JSON.parse(JSON.stringify(batch.nextCursor)))
      batches += 1
      if (batch.done) break
      // While a sync runs the cursor keeps the watermark of the one before.
      expect(cursor?.since).toBe(new Date(0).toISOString())
    }
    expect(batches).toBeGreaterThan(1)
    expect(read).toEqual(['page:10', 'page:11', 'page:12', 'page:13', 'page:14', 'page:3'])
    expect(cursor?.since).toBe('2026-11-05T10:00:00.000Z')
  })

  it('takes from the link to the next page only where it starts, never where it points', async () => {
    const { connector, ctx, fake, blocked, limits } = await setup({ pageSize: 1 })
    fake.hostileNext = true
    const batch = await connector.sync(ctx(['space:100']), null, limits)
    expect(batch.items).toHaveLength(2)
    expect(blocked).toEqual([])
    expect(fake.server.received.every((request) => request.url.startsWith('/wiki/'))).toBe(true)
  })

  it('leaves out a page that names more people than it can hide, and reads one with no body', async () => {
    const mention = (n: number) => ({
      type: 'mention',
      attrs: { id: `u${n}`, text: `@Persona ${n}` },
    })
    const crowded = page('7', AURORA.id, '2026-11-04T10:00:00.000Z', {
      paragraphs: [Array.from({ length: 60 }, (_unused, n) => mention(n))],
    })
    const empty = page('8', AURORA.id, '2026-11-05T10:00:00.000Z', { paragraphs: [] })
    const { connector, ctx, limits } = await setup({ pages: [crowded, empty] })
    const batch = await connector.sync(ctx(['space:100']), null, limits)
    expect(batch.items.find((item) => item.externalId === 'page:7')?.peopleIncomplete).toBe(true)
    expect(text(batch.items.find((item) => item.externalId === 'page:8')?.bytes)).toBe(
      '# Pagina 8\n\n\n',
    )
  })

  it('refuses a cursor it did not write and an answer it cannot read', async () => {
    const { connector, ctx, fake, limits } = await setup()
    for (const raw of [
      7,
      { since: 'ieri', space: 0, next: null, seen: '2026-01-01T00:00:00.000Z' },
      {
        since: '2026-01-01T00:00:00.000Z',
        space: -1,
        next: null,
        seen: '2026-01-01T00:00:00.000Z',
      },
      { since: '2026-01-01T00:00:00.000Z', space: 0, next: 5, seen: '2026-01-01T00:00:00.000Z' },
    ]) {
      expect(() => connector.parseCursor(raw)).toThrow(TypeError)
    }
    expect(connector.parseCursor(null)).toBeNull()
    fake.server.route((_req, res) => {
      res.writeHead(200, { 'content-type': 'application/json' }).end('{"results":"no"}')
    })
    await expect(connector.sync(ctx(['space:100']), null, limits)).rejects.toMatchObject({
      code: 'source_bad_response',
    })
    await expect(connector.perimeterOptions(ctx([]))).rejects.toMatchObject({
      code: 'source_bad_response',
    })
  })
})
