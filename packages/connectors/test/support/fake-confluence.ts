import type { IncomingMessage, ServerResponse } from 'node:http'
import { type FakeServer, json, startFakeServer } from './fake-server.ts'

/**
 * A fake Confluence Cloud site on loopback, with the shapes the connector reads:
 *
 * - `GET /wiki/rest/api/user/current`: `{ type, accountId, email, displayName }`;
 * - `GET /wiki/api/v2/spaces?limit&cursor`: `{ results: [{ id, key, name, type, status }],
 *   _links: { next? } }`;
 * - `GET /wiki/api/v2/spaces/{id}/pages?limit&sort&cursor`: `{ results: [{ id, status, title,
 *   spaceId, version: { number, createdAt }, _links: { webui } }], _links: { next? } }`, oldest
 *   change first, without bodies;
 * - `GET /wiki/api/v2/pages/{id}?body-format=atlas_doc_format`: the page with
 *   `body.atlas_doc_format.value`, the document as a JSON text.
 *
 * The credentials are checked as Basic `email:token`: none or wrong gives 401. Any other method
 * or path answers 405 or 404. Every request is recorded.
 */

export interface FakeSpace {
  id: string
  key: string
  name: string
}

export interface FakePage {
  id: string
  spaceId: string
  title: string
  /** When the page was last changed, as an ISO instant. */
  changedAt: string
  version: number
  /** The paragraphs of the page; a paragraph may be a list of ADF nodes instead of a text. */
  paragraphs: Array<string | unknown[]>
}

export interface FakeConfluenceOptions {
  email: string
  token: string
  spaces: FakeSpace[]
  pages: FakePage[]
  /** Entries per page of a list, whatever is asked. */
  pageSize?: number
}

export interface FakeConfluence {
  server: FakeServer
  options: FakeConfluenceOptions
  /** Gives, as the link to the next page of a list, an address on another host. */
  hostileNext: boolean
}

const adf = (page: FakePage): string =>
  JSON.stringify({
    type: 'doc',
    version: 1,
    content: page.paragraphs.map((paragraph) => ({
      type: 'paragraph',
      content: typeof paragraph === 'string' ? [{ type: 'text', text: paragraph }] : paragraph,
    })),
  })

const listed = (page: FakePage) => ({
  id: page.id,
  status: 'current',
  title: page.title,
  spaceId: page.spaceId,
  version: { number: page.version, createdAt: page.changedAt },
  _links: { webui: `/spaces/${page.spaceId}/pages/${page.id}` },
})

export async function startFakeConfluence(options: FakeConfluenceOptions): Promise<FakeConfluence> {
  const expected = `Basic ${Buffer.from(`${options.email}:${options.token}`).toString('base64')}`
  const server = await startFakeServer()
  const fake: FakeConfluence = { server, options, hostileNext: false }

  /** One page of a list, with the link to the next when there is one. */
  function slice<T>(entries: T[], url: URL, path: string) {
    const size = options.pageSize ?? Number(url.searchParams.get('limit') ?? '25')
    const from = Number(url.searchParams.get('cursor') ?? '0')
    const more = from + size < entries.length
    const next = fake.hostileNext
      ? `https://evil.example/steal?cursor=${from + size}`
      : `${path}?cursor=${from + size}`
    return { results: entries.slice(from, from + size), _links: more ? { next } : {} }
  }

  server.route((req: IncomingMessage, res: ServerResponse) => {
    if (req.method !== 'GET') return void res.writeHead(405).end()
    if (req.headers.authorization !== expected) return json(res, 401, { message: 'Unauthorized' })
    const url = new URL(req.url ?? '/', server.origin)
    const parts = url.pathname.split('/').filter((part) => part !== '')
    const at = (...names: string[]) =>
      parts.length === names.length && names.every((name, i) => name === '*' || name === parts[i])

    if (at('wiki', 'rest', 'api', 'user', 'current')) {
      return json(res, 200, { type: 'known', accountId: 'a1', email: options.email })
    }
    if (at('wiki', 'api', 'v2', 'spaces')) {
      const spaces = options.spaces.map((space) => ({
        ...space,
        type: 'global',
        status: 'current',
      }))
      return json(res, 200, slice(spaces, url, url.pathname))
    }
    if (at('wiki', 'api', 'v2', 'spaces', '*', 'pages')) {
      const pages = options.pages
        .filter((page) => page.spaceId === parts[4])
        .sort((a, b) => a.changedAt.localeCompare(b.changedAt))
        .map(listed)
      return json(res, 200, slice(pages, url, url.pathname))
    }
    if (at('wiki', 'api', 'v2', 'pages', '*')) {
      const page = options.pages.find((candidate) => candidate.id === parts[4])
      if (!page) return json(res, 404, { message: 'Not found' })
      return json(res, 200, {
        ...listed(page),
        body: { atlas_doc_format: { value: adf(page), representation: 'atlas_doc_format' } },
      })
    }
    res.writeHead(404).end()
  })
  return fake
}
