import { join } from 'node:path'
import type { SignInSetupStore } from '@octo/application'
import { type SignInConfig, signInSetupOf } from '@octo/domain'
import { z } from 'zod'
import { readJsonOr, writeJson } from '../fs/json-file.ts'

/** The file, beside the app's own state, that says where the organization signs in. */
export const SIGN_IN_FILE = 'accesso.json'
const MICROSOFT = 'https://login.microsoftonline.com'
const PRIVATE_FILE_MODE = 0o600

const fileSchema = z.object({
  tenantId: z.string(),
  clientId: z.string(),
  authority: z.string().optional(),
})

export type SignInConfigSource = {
  dataFolder: string
  /** What the environment says, which wins over the file: how an installation is prepared. */
  env: {
    tenantId?: string | undefined
    clientId?: string | undefined
    authority?: string | undefined
  }
}

/**
 * Where the organization signs in: from the environment, or from `accesso.json` in the app's data
 * folder. Null when neither says it in full: then nobody can sign in, and Octo says so. Neither
 * value is a secret, but both are the organization's: they are not part of Octo's own files.
 */
export function createSignInConfig(source: SignInConfigSource): () => Promise<SignInConfig | null> {
  return async () => {
    const parsed = fileSchema.safeParse(
      await readJsonOr(join(source.dataFolder, SIGN_IN_FILE), {}).catch(() => ({})),
    )
    const file = parsed.success ? parsed.data : null
    const setup = signInSetupOf(
      source.env.tenantId ?? file?.tenantId ?? '',
      source.env.clientId ?? file?.clientId ?? '',
    )
    if (setup === null) return null
    const { tenantId, clientId } = setup
    const authority = (source.env.authority ?? file?.authority ?? '').trim()
    return {
      tenantId,
      clientId,
      authority: authority === '' ? `${MICROSOFT}/${tenantId}/v2.0` : authority,
    }
  }
}

/** Writes `accesso.json` in the app's data folder: what the next reading of the sign-in finds. */
export function createSignInSetupStore(dataFolder: string): SignInSetupStore {
  return {
    save: (setup) => writeJson(join(dataFolder, SIGN_IN_FILE), setup, PRIVATE_FILE_MODE),
  }
}
