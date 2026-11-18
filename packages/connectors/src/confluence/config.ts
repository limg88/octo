import { ConnectorError } from '../errors.ts'
import type { HttpRule, PathPart } from '../rules.ts'
import { ATLASSIAN_GATEWAY, cloudIdOf } from '../shared/atlassian.ts'

/**
 * How a source reads Confluence Cloud. The site and the credentials are those of Jira: the email
 * of the account and an API token (the secret), which the PM declares read-only when linking,
 * since Atlassian gives no way to read the scopes of a token with the token itself. A token with
 * scopes is used through the Atlassian API gateway (`api.atlassian.com/ex/confluence/<cloudId>`):
 * the configuration then names the site's cloud id.
 */
export interface ConfluenceConfig {
  /** The site name, as in `<site>.atlassian.net`. */
  site: string
  /** The cloud id of the site, to reach it through the API gateway; null for the site itself. */
  cloudId: string | null
  /** The email of the account the token belongs to. */
  email: string
  /** The PM declared the token read-only. */
  readOnlyToken: true
}

/** Where the API of a site is: origin, host for the rules, path before the API, links' origin. */
export interface ConfluenceEndpoint {
  origin: string
  host: string
  prefix: readonly string[]
  /** The origin of the links to pages (`<origin>/wiki/spaces/…`). */
  browse: string
}

// Site names: lowercase letters, digits and hyphens, starting and ending with a letter or digit.
const SITE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/
// The user of Basic authorization never holds a colon.
const EMAIL = /^[^\s@:]+@[^\s@:]+\.[^\s@:]+$/
const MAX_EMAIL_LENGTH = 254
/** The first segment of every Confluence path on an Atlassian site. */
const WIKI = 'wiki'

const notConfigured = (): never => {
  throw new ConnectorError('source_not_configured')
}

export function parseConfluenceConfig(raw: unknown): ConfluenceConfig {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return notConfigured()
  const cfg = raw as Record<string, unknown>
  if (cfg.readOnlyToken !== true) return notConfigured()
  const site = typeof cfg.site === 'string' ? cfg.site.toLowerCase() : ''
  if (!SITE.test(site)) return notConfigured()
  const { email } = cfg
  if (typeof email !== 'string' || email.length > MAX_EMAIL_LENGTH || !EMAIL.test(email)) {
    return notConfigured()
  }
  return { site, cloudId: cloudIdOf(cfg.cloudId), email, readOnlyToken: true }
}

/** The public endpoint of the site: never anything the configuration could widen. */
export function confluenceEndpoint(cfg: ConfluenceConfig): ConfluenceEndpoint {
  const parsed = parseConfluenceConfig(cfg)
  const site = `${parsed.site}.atlassian.net`
  if (parsed.cloudId === null) {
    return { origin: `https://${site}`, host: site, prefix: [WIKI], browse: `https://${site}` }
  }
  return {
    origin: `https://${ATLASSIAN_GATEWAY}`,
    host: ATLASSIAN_GATEWAY,
    prefix: ['ex', 'confluence', parsed.cloudId, WIKI],
    browse: `https://${site}`,
  }
}

const lit = (...names: readonly string[]): PathPart[] => names.map((literal) => ({ literal }))

/**
 * The calls of the connector, all GET: the account (connection test), the list of the spaces,
 * the pages of one space (its id in the path) and one page (its id in the path). Nothing else:
 * no attachment, no comment, no search, and never a write.
 */
export function confluenceRules(endpoint: ConfluenceEndpoint): HttpRule[] {
  const { host } = endpoint
  const at = (...parts: PathPart[]): PathPart[] => [...lit(...endpoint.prefix), ...parts]
  return [
    { method: 'GET', host, path: at(...lit('rest', 'api', 'user', 'current')) },
    { method: 'GET', host, path: at(...lit('api', 'v2', 'spaces')) },
    { method: 'GET', host, path: at(...lit('api', 'v2', 'spaces'), 'segment', ...lit('pages')) },
    { method: 'GET', host, path: at(...lit('api', 'v2', 'pages'), 'segment') },
  ]
}

/** A URL of the site: the endpoint, its prefix, the segments and the query. */
export function confluenceUrl(
  endpoint: ConfluenceEndpoint,
  segments: readonly string[],
  query: [string, string][] = [],
): string {
  const path = [...endpoint.prefix, ...segments].map(encodeURIComponent).join('/')
  const search = new URLSearchParams(query).toString()
  return `${endpoint.origin}/${path}${search === '' ? '' : `?${search}`}`
}
