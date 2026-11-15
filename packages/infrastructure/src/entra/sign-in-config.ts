import { join } from 'node:path'
import type { SignInConfig } from '@octo/domain'
import { z } from 'zod'
import { readJsonOr } from '../fs/json-file.ts'

/** The file, beside the app's own state, that says where the organization signs in. */
export const SIGN_IN_FILE = 'accesso.json'
const MICROSOFT = 'https://login.microsoftonline.com'
/** A tenant is named by its id: the sign-in says which organization a person belongs to with it. */
const TENANT_ID = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
const CLIENT_ID = /^[A-Za-z0-9-]{1,100}$/

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
    const tenantId = (source.env.tenantId ?? file?.tenantId ?? '').trim()
    const clientId = (source.env.clientId ?? file?.clientId ?? '').trim()
    if (!TENANT_ID.test(tenantId) || !CLIENT_ID.test(clientId)) return null
    const authority = (source.env.authority ?? file?.authority ?? '').trim()
    return {
      tenantId,
      clientId,
      authority: authority === '' ? `${MICROSOFT}/${tenantId}/v2.0` : authority,
    }
  }
}
