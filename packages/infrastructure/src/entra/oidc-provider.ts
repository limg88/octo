import { createHash, createPublicKey, randomBytes, verify } from 'node:crypto'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import type { IdentityProvider, SignedIn } from '@octo/application'
import { DomainError, type IdentityClaims, identityOf, type SignInConfig } from '@octo/domain'
import { z } from 'zod'

export type OidcProviderOptions = {
  /** Where the organization signs in, or null when Octo was not told. */
  config: () => Promise<SignInConfig | null>
  /** Opens an address in the system's browser: the person never types a password into Octo. */
  openBrowser: (url: string) => Promise<void>
  now?: () => Date
  /** How long the person has to sign in before Octo stops waiting. */
  signInTimeoutMs?: number
  /** Demos and tests only: a sign-in on this computer, reached without TLS. */
  allowLoopbackAuthority?: boolean
}

const SCOPE = 'openid profile email offline_access'
const SIGN_IN_TIMEOUT_MS = 5 * 60 * 1000
const REQUEST_TIMEOUT_MS = 30 * 1000
/** How far the clock of this computer may be from the one that signed the token. */
const CLOCK_SKEW_MS = 5 * 60 * 1000
const LOOPBACK = '127.0.0.1'
const LOOPBACK_V6 = '::1'
const SIGNED_WITH = 'RS256'
const DISCOVERY_PATH = '/.well-known/openid-configuration'
const MAX_BODY_CHARS = 1024 * 1024

const discoverySchema = z.object({
  issuer: z.string(),
  authorization_endpoint: z.string(),
  token_endpoint: z.string(),
  jwks_uri: z.string(),
})
const tokensSchema = z.object({
  id_token: z.string(),
  refresh_token: z.string().optional(),
})
const keysSchema = z.object({
  keys: z.array(z.object({ kid: z.string(), kty: z.string() }).loose()),
})
const tokenHeaderSchema = z.object({ alg: z.string(), kid: z.string() })

type Discovery = z.infer<typeof discoverySchema>

const failed = (detail: string): DomainError => new DomainError('sign_in_failed', detail)
const base64Url = (bytes: Uint8Array): string => Buffer.from(bytes).toString('base64url')
const random = (): string => base64Url(randomBytes(32))
const isLoopback = (url: URL): boolean => url.hostname === LOOPBACK || url.hostname === 'localhost'

/** The page the browser shows when the sign-in comes back: the rest happens in Octo. */
const DONE_PAGE = `<!doctype html><html lang="it"><meta charset="utf-8"><title>Octo</title>
<body style="font-family:system-ui;margin:3rem"><h1>Accesso ricevuto</h1>
<p>Puoi chiudere questa pagina e tornare a Octo.</p></body></html>`

/**
 * The organization's sign-in over OpenID Connect, as a desktop application does it: the person
 * signs in in the system's browser, the answer comes back to an address of this computer, and the
 * code it carries is exchanged with a proof only this run of Octo holds (PKCE). No secret of the
 * application exists. The token that says who the person is is checked here: who signed it, for
 * whom, when, and for which organization.
 */
export function createOidcIdentityProvider(options: OidcProviderOptions): IdentityProvider {
  const now = options.now ?? (() => new Date())

  /** An address of the sign-in: of the same site as the authority, and over TLS. */
  function checked(address: string, authority: URL): URL {
    let url: URL
    try {
      url = new URL(address)
    } catch {
      throw failed('address')
    }
    const local = options.allowLoopbackAuthority === true && isLoopback(url)
    if (url.origin !== authority.origin || (url.protocol !== 'https:' && !local)) {
      throw failed('address')
    }
    return url
  }

  async function getJson(url: URL, init?: RequestInit): Promise<unknown> {
    let response: Response
    try {
      response = await fetch(url, {
        ...init,
        redirect: 'error',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
    } catch {
      throw failed('unreachable')
    }
    const body = (await response.text()).slice(0, MAX_BODY_CHARS)
    if (!response.ok) throw failed(`status ${response.status}`)
    try {
      return JSON.parse(body)
    } catch {
      throw failed('answer')
    }
  }

  async function discover(config: SignInConfig): Promise<{ authority: URL; found: Discovery }> {
    let authority: URL
    try {
      authority = new URL(config.authority)
    } catch {
      throw new DomainError('sign_in_not_configured', 'authority')
    }
    const path = `${authority.pathname.replace(/\/$/, '')}${DISCOVERY_PATH}`
    const document = checked(new URL(path, authority).toString(), authority)
    const parsed = discoverySchema.safeParse(await getJson(document))
    if (!parsed.success) throw failed('discovery')
    return { authority, found: parsed.data }
  }

  /** The claims of a token, once its signature, its issuer, its audience and its time hold. */
  async function claimsOf(
    token: string,
    config: SignInConfig,
    authority: URL,
    found: Discovery,
    nonce: string | null,
  ): Promise<IdentityClaims> {
    const [rawHeader, rawClaims, rawSignature] = token.split('.')
    if (!rawHeader || !rawClaims || !rawSignature) throw failed('token')
    let header: z.infer<typeof tokenHeaderSchema>
    let claims: Record<string, unknown>
    try {
      header = tokenHeaderSchema.parse(JSON.parse(Buffer.from(rawHeader, 'base64url').toString()))
      claims = z
        .record(z.string(), z.unknown())
        .parse(JSON.parse(Buffer.from(rawClaims, 'base64url').toString()))
    } catch {
      throw failed('token')
    }
    if (header.alg !== SIGNED_WITH) throw failed('token algorithm')
    const keys = keysSchema.safeParse(await getJson(checked(found.jwks_uri, authority)))
    const key = keys.success ? keys.data.keys.find((entry) => entry.kid === header.kid) : undefined
    if (!key) throw failed('token key')
    const signed = verify(
      'RSA-SHA256',
      Buffer.from(`${rawHeader}.${rawClaims}`),
      createPublicKey({ key, format: 'jwk' }),
      Buffer.from(rawSignature, 'base64url'),
    )
    if (!signed) throw failed('token signature')
    const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud]
    const expires = typeof claims.exp === 'number' ? claims.exp * 1000 : 0
    if (claims.iss !== found.issuer || !audience.includes(config.clientId)) throw failed('token')
    if (expires + CLOCK_SKEW_MS < now().getTime()) throw failed('token expired')
    if (nonce !== null && claims.nonce !== nonce) throw failed('token nonce')
    return claims
  }

  async function signedIn(
    body: Record<string, string>,
    config: SignInConfig,
    authority: URL,
    found: Discovery,
    nonce: string | null,
  ): Promise<SignedIn> {
    const answer = await getJson(checked(found.token_endpoint, authority), {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: config.clientId, scope: SCOPE, ...body }).toString(),
    })
    const tokens = tokensSchema.safeParse(answer)
    if (!tokens.success) throw failed('tokens')
    const claims = await claimsOf(tokens.data.id_token, config, authority, found, nonce)
    const identity = identityOf(claims, config.tenantId)
    // A person of another organization signed in well, and is not let in.
    if (identity === null) throw new DomainError('sign_in_refused')
    return { identity, refreshToken: tokens.data.refresh_token ?? null }
  }

  /** Waits on this computer for the browser to come back with the code of the sign-in. */
  function waitForCode(
    state: string,
    signal: AbortSignal,
  ): Promise<{ redirectUri: string; code: Promise<string>; close: () => void }> {
    return new Promise((resolve, reject) => {
      let settle: { ok: (code: string) => void; no: (error: Error) => void } | null = null
      const code = new Promise<string>((ok, no) => {
        settle = { ok, no }
      })
      // Nobody may be waiting for the code yet when it fails: the failure is not lost for that.
      code.catch(() => {})
      const servers: Server[] = []
      const close = () => {
        for (const server of servers) server.close()
      }
      const handler: Parameters<typeof createServer>[1] = (request, response) => {
        const url = new URL(request.url ?? '/', `http://${LOOPBACK}`)
        if (url.searchParams.get('state') !== state) {
          response.writeHead(400).end()
          return
        }
        response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(DONE_PAGE)
        const given = url.searchParams.get('code')
        if (given) settle?.ok(given)
        else settle?.no(failed(url.searchParams.get('error') ?? 'no code'))
      }
      const first = createServer(handler)
      servers.push(first)
      first.once('error', () => reject(failed('listen')))
      first.listen(0, LOOPBACK, () => {
        const { port } = first.address() as AddressInfo
        // A browser may reach `localhost` over IPv6: the same port answers there too, when it can.
        const second = createServer(handler)
        second.once('error', () => {})
        second.listen(port, LOOPBACK_V6, () => servers.push(second))
        const timer = setTimeout(
          () => settle?.no(new DomainError('sign_in_cancelled', 'timeout')),
          options.signInTimeoutMs ?? SIGN_IN_TIMEOUT_MS,
        )
        signal.addEventListener('abort', () => settle?.no(new DomainError('sign_in_cancelled')))
        void code.finally(() => clearTimeout(timer)).catch(() => {})
        resolve({ redirectUri: `http://localhost:${port}`, code, close })
      })
    })
  }

  return {
    configured: () => options.config(),

    async signIn(signal) {
      const config = await options.config()
      if (config === null) throw new DomainError('sign_in_not_configured')
      const { authority, found } = await discover(config)
      const state = random()
      const nonce = random()
      const verifier = random()
      const challenge = base64Url(createHash('sha256').update(verifier).digest())
      const waiting = await waitForCode(state, signal)
      try {
        const page = checked(found.authorization_endpoint, authority)
        const asked = {
          client_id: config.clientId,
          response_type: 'code',
          response_mode: 'query',
          redirect_uri: waiting.redirectUri,
          scope: SCOPE,
          state,
          nonce,
          code_challenge: challenge,
          code_challenge_method: 'S256',
          prompt: 'select_account',
        }
        for (const [name, value] of Object.entries(asked)) page.searchParams.set(name, value)
        await options.openBrowser(page.toString())
        const code = await waiting.code
        return await signedIn(
          {
            grant_type: 'authorization_code',
            code,
            redirect_uri: waiting.redirectUri,
            code_verifier: verifier,
          },
          config,
          authority,
          found,
          nonce,
        )
      } finally {
        waiting.close()
      }
    },

    async renew(refreshToken) {
      const config = await options.config()
      if (config === null) throw new DomainError('sign_in_not_configured')
      const { authority, found } = await discover(config)
      const body = { grant_type: 'refresh_token', refresh_token: refreshToken }
      return signedIn(body, config, authority, found, null)
    },
  }
}

/** Demos and tests only: a person who is always signed in, without any organization asked. */
export function createFixedIdentityProvider(person: {
  name: string
  email: string
}): IdentityProvider {
  const tenant = 'demo'
  const signedIn: SignedIn = {
    identity: {
      id: `demo:${person.email.toLowerCase()}`,
      username: person.email,
      email: person.email,
      name: person.name,
      tenant,
    },
    refreshToken: null,
  }
  return {
    configured: async () => ({ authority: 'demo', clientId: 'demo', tenantId: tenant }),
    signIn: async () => signedIn,
    renew: async () => signedIn,
  }
}

const PERSON = /^\s*(.*?)\s*<([^<>\s@]+@[^<>\s@]+)>\s*$/

/** `Paola Verdi <pm@example.test>` as a person; null when the text is not written so. */
export function fixedPersonOf(text: string | undefined): { name: string; email: string } | null {
  const found = PERSON.exec(text ?? '')
  if (!found) return null
  return { name: found[1] || (found[2] as string), email: found[2] as string }
}
