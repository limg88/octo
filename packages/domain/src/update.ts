import { DomainError } from './errors.ts'

/** A file published with a release of Octo. */
export type ReleaseAsset = { name: string; url: string; size: number }

/** A release of Octo as its publisher lists it. */
export type Release = { version: string; notes: string; assets: ReleaseAsset[] }

/** The computer Octo runs on: what decides which file of a release is its own. */
export type UpdateTarget = { platform: string; arch: string }

/** What the PM is told: there is a newer Octo, and which. */
export type UpdateOffer = { version: string; notes: string }

/** How much of the new version has come down. */
export type UpdateProgress = { received: number; total: number }

/** The file that lists the SHA-256 of every other file of a release, as `shasum` writes it. */
export const CHECKSUMS_ASSET = 'SHA256SUMS'

const VERSION = /^v?(\d+)\.(\d+)\.(\d+)$/
const CHECKSUM_LINE = /^([0-9a-f]{64})\s+\*?(.+)$/i
/** The systems Octo can replace itself on, with the kind of file each takes. */
const ASSET_OF: Readonly<Record<string, { system: string; extension: string }>> = {
  darwin: { system: 'mac', extension: 'zip' },
  win32: { system: 'win', extension: 'exe' },
}

/** `v1.4.0` or `1.4.0` as three numbers; null for anything else, a pre-release included. */
export function parseVersion(text: string): [number, number, number] | null {
  const match = VERSION.exec(text.trim())
  if (!match) return null
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

/** True when `candidate` is a version after `current`. What is not a version is never newer. */
export function isNewerVersion(candidate: string, current: string): boolean {
  const next = parseVersion(candidate)
  const now = parseVersion(current)
  if (!next || !now) return false
  for (const [at, part] of next.entries()) {
    const other = now[at] ?? 0
    if (part !== other) return part > other
  }
  return false
}

/** The name of the file of a version for a computer: `Octo-1.4.0-mac-arm64.zip`. */
export function updateAssetName(version: string, target: UpdateTarget): string | null {
  const kind = ASSET_OF[target.platform]
  const numbers = parseVersion(version)
  if (!kind || !numbers) return null
  return `Octo-${numbers.join('.')}-${kind.system}-${target.arch}.${kind.extension}`
}

/** The file of a release for this computer; null when the release has none for it. */
export function updateAssetFor(release: Release, target: UpdateTarget): ReleaseAsset | null {
  const name = updateAssetName(release.version, target)
  return release.assets.find((asset) => asset.name === name) ?? null
}

/** The SHA-256 the list of a release gives for a file, in lower case; null when it has none. */
export function checksumOf(checksums: string, fileName: string): string | null {
  for (const line of checksums.split('\n')) {
    const match = CHECKSUM_LINE.exec(line.trim())
    if (match?.[2]?.trim() === fileName) return (match[1] ?? '').toLowerCase()
  }
  return null
}

/**
 * The newer version a release offers to this computer. Null when the release is not newer, or
 * has no file for this computer: there is nothing the PM could do with it.
 */
export function updateOffer(
  release: Release | null,
  current: string,
  target: UpdateTarget,
): UpdateOffer | null {
  if (release === null || !isNewerVersion(release.version, current)) return null
  if (updateAssetFor(release, target) === null) return null
  const numbers = parseVersion(release.version)
  return { version: numbers ? numbers.join('.') : release.version, notes: release.notes }
}

/** Refuses a file that is not the one the release declares: it is never installed. */
export function assertChecksum(expected: string | null, actual: string): void {
  if (expected === null) throw new DomainError('update_checksum_missing')
  if (expected !== actual.toLowerCase()) throw new DomainError('update_checksum_mismatch')
}
