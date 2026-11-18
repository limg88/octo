import { ConnectorError } from '../errors.ts'
import { createSafeHttp } from '../safe-http.ts'

/**
 * Where Atlassian answers an API token that has scopes: such a token is refused by the site
 * itself (`<site>.atlassian.net`) and works only here, under the cloud id of the site.
 */
export const ATLASSIAN_GATEWAY = 'api.atlassian.com'

// Site names: lowercase letters, digits and hyphens, starting and ending with a letter or digit.
const SITE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

/** The cloud id as a configuration may hold it: a GUID in lower case, or null when absent. */
export function cloudIdOf(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string' || !GUID.test(value.toLowerCase())) {
    throw new ConnectorError('source_not_configured')
  }
  return value.toLowerCase()
}

/**
 * The cloud id of an Atlassian site, as the site itself tells anybody who asks: one GET, with no
 * credential, to the one path that says it. Null when the site does not say.
 */
export async function atlassianCloudId(site: string, signal?: AbortSignal): Promise<string | null> {
  const name = site.toLowerCase()
  if (!SITE.test(name)) return null
  const host = `${name}.atlassian.net`
  const http = createSafeHttp({
    rules: [{ method: 'GET', host, path: [{ literal: '_edge' }, { literal: 'tenant_info' }] }],
    onBlocked: async () => {},
    ...(signal ? { signal } : {}),
  })
  try {
    const res = await http.request({
      method: 'GET',
      url: `https://${host}/_edge/tenant_info`,
      headers: { accept: 'application/json' },
    })
    if (res.status < 200 || res.status >= 300) return null
    const body = res.json()
    const id =
      typeof body === 'object' && body !== null ? (body as { cloudId?: unknown }).cloudId : null
    return typeof id === 'string' && GUID.test(id.toLowerCase()) ? id.toLowerCase() : null
  } catch (error) {
    if (error instanceof ConnectorError) return null
    throw error
  } finally {
    http.close()
  }
}
