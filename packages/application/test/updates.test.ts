import {
  CHECKSUMS_ASSET,
  CHECKSUMS_SIGNATURE_ASSET,
  DomainError,
  type Release,
  type UpdateProgress,
} from '@octo/domain'
import { describe, expect, it } from 'vitest'
import { createUpdates } from '../src/index.ts'

const SHA = 'a'.repeat(64)
const FILE = 'Octo-1.4.0-mac-arm64.zip'
const asset = (name: string) => ({ name, url: `https://example.test/${name}`, size: 100 })
const release: Release = {
  version: 'v1.4.0',
  notes: 'Novità.',
  assets: [asset(FILE), asset(CHECKSUMS_ASSET), asset(CHECKSUMS_SIGNATURE_ASSET)],
}

function setup(
  options: {
    release?: Release | null | Error
    checksums?: string | Error
    sha256?: string
    download?: Error
    apply?: Error
    current?: string
    /** What the publisher's key says of the list: by default the signature is theirs. */
    signed?: boolean
    hasKey?: boolean
  } = {},
) {
  const applied: string[] = []
  const asked: string[] = []
  const verified: Array<[string, string]> = []
  const updates = createUpdates({
    current: options.current ?? '1.3.0',
    target: { platform: 'darwin', arch: 'arm64' },
    feed: {
      latest: async () => {
        const given = options.release === undefined ? release : options.release
        if (given instanceof Error) throw given
        return given
      },
    },
    downloads: {
      text: async (wanted) => {
        asked.push(wanted.name)
        if (wanted.name === CHECKSUMS_SIGNATURE_ASSET) return 'firma'
        const given = options.checksums ?? `${SHA}  ${FILE}\n`
        if (given instanceof Error) throw given
        return given
      },
      file: async (wanted, onProgress) => {
        asked.push(wanted.name)
        if (options.download) throw options.download
        onProgress?.({ received: 100, total: 100 })
        return { path: `/tmp/${wanted.name}`, sha256: options.sha256 ?? SHA }
      },
    },
    verifier: {
      canVerify: options.hasKey ?? true,
      verify: (text, signature) => {
        verified.push([text, signature])
        return options.signed ?? true
      },
    },
    applier: {
      apply: async (path) => {
        if (options.apply) throw options.apply
        applied.push(path)
      },
    },
  })
  return { updates, applied, asked, verified }
}

describe('Octo that replaces itself with a newer one', () => {
  it('offers the newer version there is for this computer, or nothing', async () => {
    expect(await setup().updates.check()).toEqual({ version: '1.4.0', notes: 'Novità.' })
    expect(await setup({ current: '1.4.0' }).updates.check()).toBeNull()
    expect(await setup({ release: null }).updates.check()).toBeNull()
    await expect(setup({ release: new Error('offline') }).updates.check()).rejects.toMatchObject({
      code: 'update_check_failed',
    })
  })

  it('reads the checksums first, brings the file down, checks it and puts it in place', async () => {
    const { updates, applied, asked } = setup()
    const steps: UpdateProgress[] = []
    await updates.install((step) => steps.push(step))
    expect(asked).toEqual([CHECKSUMS_ASSET, CHECKSUMS_SIGNATURE_ASSET, FILE])
    expect(steps).toEqual([{ received: 100, total: 100 }])
    expect(applied).toEqual([`/tmp/${FILE}`])
  })

  it('never puts in place a file that is not the one the release declares', async () => {
    const tampered = setup({ sha256: 'c'.repeat(64) })
    await expect(tampered.updates.install()).rejects.toMatchObject({
      code: 'update_checksum_mismatch',
    })
    expect(tampered.applied).toEqual([])

    const unlisted = setup({ checksums: `${SHA}  altro.zip\n` })
    await expect(unlisted.updates.install()).rejects.toMatchObject({
      code: 'update_checksum_missing',
    })
    const noList = setup({
      release: { ...release, assets: [asset(FILE), asset(CHECKSUMS_SIGNATURE_ASSET)] },
    })
    await expect(noList.updates.install()).rejects.toMatchObject({
      code: 'update_checksum_missing',
    })
    expect(noList.asked).toEqual([])
    expect(unlisted.applied).toEqual([])
  })

  it('believes a list of checksums only when the publisher signed it', async () => {
    const forged = setup({ signed: false })
    await expect(forged.updates.install()).rejects.toMatchObject({
      code: 'update_signature_invalid',
    })
    // The signature is checked over the list as it came, before the file is even asked for.
    expect(forged.verified).toEqual([[`${SHA}  ${FILE}\n`, 'firma']])
    expect(forged.asked).toEqual([CHECKSUMS_ASSET, CHECKSUMS_SIGNATURE_ASSET])
    expect(forged.applied).toEqual([])

    const unsigned = setup({
      release: { ...release, assets: [asset(FILE), asset(CHECKSUMS_ASSET)] },
    })
    await expect(unsigned.updates.install()).rejects.toMatchObject({
      code: 'update_signature_missing',
    })
    expect(unsigned.asked).toEqual([])

    // An Octo built without the publisher's key offers nothing: it could accept nothing.
    const keyless = setup({ hasKey: false })
    expect(await keyless.updates.check()).toBeNull()
    await expect(keyless.updates.install()).rejects.toMatchObject({
      code: 'update_signature_invalid',
    })
  })

  it('does not take the signed list of one version for another version', async () => {
    // A release named as newer, with the files, the list and the signature of an older one put
    // under its name: the list is the publisher's, but it says nothing of a file of this version.
    const replayed = setup({
      release: {
        ...release,
        version: 'v9.9.9',
        assets: [
          asset('Octo-9.9.9-mac-arm64.zip'),
          asset(CHECKSUMS_ASSET),
          asset(CHECKSUMS_SIGNATURE_ASSET),
        ],
      },
    })
    expect(await replayed.updates.check()).toEqual({ version: '9.9.9', notes: 'Novità.' })
    await expect(replayed.updates.install()).rejects.toMatchObject({
      code: 'update_checksum_missing',
    })
    expect(replayed.applied).toEqual([])
  })

  it('says what stopped it: nothing newer, a download that failed, an app that cannot be replaced', async () => {
    await expect(setup({ current: '1.4.0' }).updates.install()).rejects.toMatchObject({
      code: 'update_unavailable',
    })
    await expect(setup({ release: null }).updates.install()).rejects.toMatchObject({
      code: 'update_unavailable',
    })
    await expect(
      setup({ checksums: new Error('offline') }).updates.install(),
    ).rejects.toMatchObject({ code: 'update_download_failed' })
    await expect(setup({ download: new Error('reset') }).updates.install()).rejects.toMatchObject({
      code: 'update_download_failed',
    })
    await expect(
      setup({ apply: new DomainError('update_not_installable') }).updates.install(),
    ).rejects.toMatchObject({ code: 'update_not_installable' })
  })
})
