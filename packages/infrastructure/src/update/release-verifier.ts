import { createPublicKey, type KeyObject, verify } from 'node:crypto'
import type { ReleaseVerifier } from '@octo/application'

/**
 * Tells the publisher's signature with Ed25519 keys given as the app carries them: the public
 * key in the SPKI form, in base64. A key that cannot be read is left out, never guessed.
 */
export function createEd25519Verifier(publicKeys: readonly string[]): ReleaseVerifier {
  const keys: KeyObject[] = publicKeys.flatMap((encoded) => {
    try {
      const key = createPublicKey({
        key: Buffer.from(encoded.trim(), 'base64'),
        format: 'der',
        type: 'spki',
      })
      return key.asymmetricKeyType === 'ed25519' ? [key] : []
    } catch {
      return []
    }
  })
  return {
    canVerify: keys.length > 0,
    verify(text, signature) {
      const signed = Buffer.from(signature.trim(), 'base64')
      const data = Buffer.from(text, 'utf8')
      return keys.some((key) => {
        try {
          return verify(null, data, key, signed)
        } catch {
          return false
        }
      })
    },
  }
}
