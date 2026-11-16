import {
  assertChecksum,
  CHECKSUMS_ASSET,
  CHECKSUMS_SIGNATURE_ASSET,
  checksumOf,
  DomainError,
  isDomainError,
  type Release,
  type UpdateOffer,
  type UpdateProgress,
  type UpdateTarget,
  updateAssetFor,
  updateOffer,
} from '@octo/domain'
import type { ReleaseDownloads, ReleaseFeed, ReleaseVerifier, UpdateApplier } from './ports.ts'

export type UpdatesDeps = {
  feed: ReleaseFeed
  downloads: ReleaseDownloads
  applier: UpdateApplier
  /** Who tells the publisher's own releases from anybody else's. */
  verifier: ReleaseVerifier
  /** The version of the Octo that is running. */
  current: string
  target: UpdateTarget
}

export type Updates = {
  /** The newer Octo there is for this computer; null when this one is the latest. */
  check(): Promise<UpdateOffer | null>
  /**
   * Brings down the newer Octo, checks it is the file its release declares, puts it in place of
   * this one and starts it. When it returns, this Octo is about to close.
   */
  install(onProgress?: (progress: UpdateProgress) => void): Promise<void>
}

/** Whatever goes wrong while asking is one thing to the PM: the check did not work. */
async function asked<Value>(
  step: () => Promise<Value>,
  code: 'update_check_failed' | 'update_download_failed',
): Promise<Value> {
  try {
    return await step()
  } catch (error) {
    if (isDomainError(error)) throw error
    throw new DomainError(code, error instanceof Error ? error.message : String(error))
  }
}

/**
 * Octo that replaces itself with a newer one. Nothing is installed that is not the file the
 * release lists, byte for byte, and no list is believed that the publisher did not sign: who
 * takes over the place where releases are published still cannot have theirs installed.
 */
export function createUpdates(deps: UpdatesDeps): Updates {
  const latest = (): Promise<Release | null> =>
    asked(() => deps.feed.latest(), 'update_check_failed')

  return {
    async check() {
      // An Octo built without the publisher's key could not tell a release of theirs from any
      // other: it offers none, rather than one it would then refuse.
      if (!deps.verifier.canVerify) return null
      return updateOffer(await latest(), deps.current, deps.target)
    },

    async install(onProgress) {
      // Asked all the same of an Octo without the key: nothing can be told to be the publisher's.
      if (!deps.verifier.canVerify) throw new DomainError('update_signature_invalid')
      const release = await latest()
      if (updateOffer(release, deps.current, deps.target) === null || release === null) {
        throw new DomainError('update_unavailable')
      }
      const asset = updateAssetFor(release, deps.target)
      if (asset === null) throw new DomainError('update_unavailable')
      const checksums = release.assets.find((candidate) => candidate.name === CHECKSUMS_ASSET)
      if (!checksums) throw new DomainError('update_checksum_missing')
      const signature = release.assets.find(
        (candidate) => candidate.name === CHECKSUMS_SIGNATURE_ASSET,
      )
      if (!signature) throw new DomainError('update_signature_missing')
      const list = await asked(() => deps.downloads.text(checksums), 'update_download_failed')
      const signed = await asked(() => deps.downloads.text(signature), 'update_download_failed')
      // The list is the publisher's before anything it says is believed: the file comes after.
      if (!deps.verifier.verify(list, signed)) throw new DomainError('update_signature_invalid')
      const expected = checksumOf(list, asset.name)
      const file = await asked(
        () => deps.downloads.file(asset, onProgress),
        'update_download_failed',
      )
      assertChecksum(expected, file.sha256)
      await deps.applier.apply(file.path)
    },
  }
}
