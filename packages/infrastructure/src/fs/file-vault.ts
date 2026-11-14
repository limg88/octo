import { join } from 'node:path'
import type { SecretVault } from '@octo/application'
import { DomainError } from '@octo/domain'
import { z } from 'zod'
import { readJsonOr, writeJson } from './json-file.ts'

/** What turns a secret into bytes only this user on this computer can read back. */
export interface SecretCipher {
  available(): boolean
  encrypt(value: string): Uint8Array
  decrypt(bytes: Uint8Array): string
}

const VAULT_FILE = 'secrets.json'
const PRIVATE_FILE_MODE = 0o600
const vaultSchema = z.record(z.string(), z.string())

/**
 * The credentials of the feeds in one file of the app's data folder, each encrypted by the
 * operating system's own store. Without that store nothing is saved.
 */
export function createFileVault(dataFolder: string, cipher: SecretCipher): SecretVault {
  const file = join(dataFolder, VAULT_FILE)
  const all = async (): Promise<Record<string, string>> =>
    vaultSchema.parse(await readJsonOr(file, {}))
  return {
    async get(key) {
      const stored = (await all())[key]
      if (stored === undefined || !cipher.available()) return null
      try {
        return cipher.decrypt(Buffer.from(stored, 'base64'))
      } catch {
        // Written by another user or another computer: as good as not there.
        return null
      }
    },
    async set(key, value) {
      if (!cipher.available()) throw new DomainError('secret_store_unavailable')
      const encrypted = Buffer.from(cipher.encrypt(value)).toString('base64')
      await writeJson(file, { ...(await all()), [key]: encrypted }, PRIVATE_FILE_MODE)
    },
    async remove(key) {
      const { [key]: _gone, ...rest } = await all()
      await writeJson(file, rest, PRIVATE_FILE_MODE)
    },
  }
}
