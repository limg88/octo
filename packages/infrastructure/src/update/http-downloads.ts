import { createHash } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { mkdir, rm } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { finished } from 'node:stream/promises'
import type { ReleaseDownloads } from '@octo/application'
import { UPDATE_USER_AGENT } from './github-release-feed.ts'

export type DownloadsConfig = {
  /** Where a downloaded file is kept until it is installed. */
  folder: string
  fetch?: typeof fetch
}

/** A list of checksums is a few lines: more than this is not one. */
const MAX_TEXT_BYTES = 1024 * 1024
/** An installer of Octo is some hundred megabytes: more than this is refused. */
const MAX_FILE_BYTES = 1024 * 1024 * 1024
const HEADERS = { accept: 'application/octet-stream', 'user-agent': UPDATE_USER_AGENT }

/** Brings down the files of a release over HTTP, counting and hashing what arrives. */
export function createHttpDownloads(config: DownloadsConfig): ReleaseDownloads {
  const ask = config.fetch ?? fetch

  async function open(url: string): Promise<Response> {
    const response = await ask(url, { headers: HEADERS, redirect: 'follow' })
    if (!response.ok || response.body === null) throw new Error(`download: ${response.status}`)
    return response
  }

  return {
    async text(asset) {
      const response = await open(asset.url)
      const bytes = new Uint8Array(await response.arrayBuffer())
      if (bytes.length > MAX_TEXT_BYTES) throw new Error('download: too large')
      return new TextDecoder().decode(bytes)
    },

    async file(asset, onProgress) {
      const response = await open(asset.url)
      const total = asset.size || Number(response.headers.get('content-length') ?? 0)
      if (total > MAX_FILE_BYTES) throw new Error('download: too large')
      await mkdir(config.folder, { recursive: true })
      // Only the name of the file: a release cannot choose where on the disk it is written.
      const path = join(config.folder, basename(asset.name))
      await rm(path, { force: true })
      const hash = createHash('sha256')
      const target = createWriteStream(path)
      let received = 0
      try {
        for await (const chunk of response.body as unknown as AsyncIterable<Uint8Array>) {
          received += chunk.length
          if (received > MAX_FILE_BYTES) throw new Error('download: too large')
          hash.update(chunk)
          if (!target.write(chunk))
            await new Promise<void>((resolve) => target.once('drain', () => resolve()))
          onProgress?.({ received, total: Math.max(total, received) })
        }
        target.end()
        await finished(target)
      } catch (error) {
        target.destroy()
        await rm(path, { force: true })
        throw error
      }
      return { path, sha256: hash.digest('hex') }
    },
  }
}
