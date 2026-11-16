import type { ReleaseFeed } from '@octo/application'
import type { Release, ReleaseAsset } from '@octo/domain'

export type ReleaseFeedConfig = {
  /** `owner/name` of the repository whose releases are Octo's. */
  repository: string
  /** Where the releases are asked; another address only for a demo or a test on this computer. */
  baseUrl?: string
  fetch?: typeof fetch
}

export const GITHUB_API = 'https://api.github.com'
/** Says what is asking, and nothing about who: no name, no address, no project. */
export const UPDATE_USER_AGENT = 'octo-desktop'
const TIMEOUT_MS = 20 * 1000
const NOT_FOUND = 404
const SECURE = 'https:'

type Listed = { tag_name?: unknown; body?: unknown; assets?: unknown }

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

/**
 * A file of a release, when it can be trusted to come from where the release does: over HTTPS,
 * or from the very address the releases are asked at (a demo on this computer).
 */
function assetOf(listed: unknown, base: URL): ReleaseAsset | null {
  if (!isObject(listed)) return null
  const { name, browser_download_url: address, size } = listed
  if (typeof name !== 'string' || typeof address !== 'string') return null
  let url: URL
  try {
    url = new URL(address)
  } catch {
    return null
  }
  if (url.protocol !== SECURE && url.origin !== base.origin) return null
  return { name, url: url.toString(), size: typeof size === 'number' ? size : 0 }
}

/** The releases of Octo as GitHub lists them: read without any credential. */
export function createGithubReleaseFeed(config: ReleaseFeedConfig): ReleaseFeed {
  const base = new URL(config.baseUrl ?? GITHUB_API)
  const ask = config.fetch ?? fetch
  return {
    async latest() {
      const response = await ask(new URL(`/repos/${config.repository}/releases/latest`, base), {
        headers: { accept: 'application/vnd.github+json', 'user-agent': UPDATE_USER_AGENT },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      })
      // A repository with no release yet answers that there is none: not a failure.
      if (response.status === NOT_FOUND) return null
      if (!response.ok) throw new Error(`releases: ${response.status}`)
      const listed = (await response.json()) as Listed
      if (typeof listed.tag_name !== 'string') throw new Error('releases: no version')
      const assets = Array.isArray(listed.assets) ? listed.assets : []
      const release: Release = {
        version: listed.tag_name,
        notes: typeof listed.body === 'string' ? listed.body : '',
        assets: assets.flatMap((asset) => assetOf(asset, base) ?? []),
      }
      return release
    },
  }
}
