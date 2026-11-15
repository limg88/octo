// A sign-in of an organization on this computer, with the shapes of OpenID Connect as Microsoft
// Entra ID speaks it: discovery, authorization with PKCE, tokens signed with a key it publishes.
// Synthetic people only; used by the tests and by the demos.
import { createHash, generateKeyPairSync, randomUUID, sign } from 'node:crypto'
import { createServer, type IncomingMessage } from 'node:http'
import type { AddressInfo } from 'node:net'

export type FakeEntraPerson = { id: string; name: string; email: string }

export type FakeEntraOptions = {
  tenantId: string
  clientId: string
  person: FakeEntraPerson
  /**
   * True: the page of the sign-in shows a button the person presses, as in a demo. False: the
   * sign-in answers at once, as a test needs.
   */
  interactive?: boolean
}

/** What a test can make the fake do wrong, to see that Octo refuses it. */
export type FakeEntraFault =
  | 'signature'
  | 'audience'
  | 'tenant'
  | 'issuer'
  | 'expired'
  | 'nonce'
  | 'algorithm'
  | 'no_tokens'

export type FakeEntra = {
  origin: string
  /** What Octo is given as the place of the sign-in. */
  authority: string
  /** The next tokens are wrong in this way; null: right again. */
  fault(next: FakeEntraFault | null): void
  /** Forgets every sign-in it renewed: the next renewal is refused. */
  revoke(): void
  close(): Promise<void>
}

const KEY_ID = 'fake-key-1'
const HOUR_S = 3600
const base64Url = (value: string | Uint8Array): string => Buffer.from(value).toString('base64url')

async function bodyOf(request: IncomingMessage): Promise<URLSearchParams> {
  let text = ''
  for await (const chunk of request) text += chunk
  return new URLSearchParams(text)
}

export async function startFakeEntra(options: FakeEntraOptions): Promise<FakeEntra> {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  const other = generateKeyPairSync('rsa', { modulusLength: 2048 })
  const codes = new Map<string, { challenge: string; nonce: string; redirectUri: string }>()
  const refreshTokens = new Set<string>()
  let fault: FakeEntraFault | null = null
  let origin = ''
  const path = `/${options.tenantId}/v2.0`
  const issuer = () => `${origin}${path}`

  function idToken(nonce: string | null): string {
    const now = Math.floor(Date.now() / 1000)
    const header = { alg: fault === 'algorithm' ? 'HS256' : 'RS256', typ: 'JWT', kid: KEY_ID }
    const claims = {
      iss: fault === 'issuer' ? 'https://altrove.example/v2.0' : issuer(),
      aud: fault === 'audience' ? 'un-altra-app' : options.clientId,
      exp: fault === 'expired' ? now - 2 * HOUR_S : now + HOUR_S,
      iat: now,
      tid: fault === 'tenant' ? '99999999-9999-9999-9999-999999999999' : options.tenantId,
      oid: options.person.id,
      name: options.person.name,
      preferred_username: options.person.email,
      email: options.person.email,
      ...(nonce === null ? {} : { nonce: fault === 'nonce' ? 'un-altro' : nonce }),
    }
    const signed = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(claims))}`
    const key = fault === 'signature' ? other.privateKey : privateKey
    return `${signed}.${base64Url(sign('RSA-SHA256', Buffer.from(signed), key))}`
  }

  const server = createServer(async (request, response) => {
    const url = new URL(request.url ?? '/', origin)
    const json = (status: number, value: unknown) =>
      response.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(value))

    if (url.pathname === `${path}/.well-known/openid-configuration`) {
      return json(200, {
        issuer: issuer(),
        authorization_endpoint: `${issuer()}/authorize`,
        token_endpoint: `${issuer()}/token`,
        jwks_uri: `${issuer()}/keys`,
      })
    }
    if (url.pathname === `${path}/keys`) {
      return json(200, {
        keys: [{ ...publicKey.export({ format: 'jwk' }), kid: KEY_ID, use: 'sig' }],
      })
    }
    if (url.pathname === `${path}/authorize`) {
      const redirectUri = url.searchParams.get('redirect_uri') ?? ''
      const wrongClient = url.searchParams.get('client_id') !== options.clientId
      if (wrongClient || !/^http:\/\/localhost:\d+$/.test(redirectUri)) {
        return response.writeHead(400).end('richiesta non valida')
      }
      const code = randomUUID()
      codes.set(code, {
        challenge: url.searchParams.get('code_challenge') ?? '',
        nonce: url.searchParams.get('nonce') ?? '',
        redirectUri,
      })
      const back = new URL(redirectUri)
      back.searchParams.set('code', code)
      back.searchParams.set('state', url.searchParams.get('state') ?? '')
      if (!options.interactive) return response.writeHead(302, { location: back.toString() }).end()
      return response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(
        `<!doctype html><html lang="it"><meta charset="utf-8"><title>Accesso (finto)</title>
<body style="font-family:system-ui;margin:3rem"><h1>Accesso dell’organizzazione (finto)</h1>
<p>Questa pagina sta al posto dell’accesso aziendale: nessuna password viene chiesta.</p>
<p><a href="${back.toString().replaceAll('&', '&amp;')}" style="font-size:1.2rem">Entra come ${options.person.name}</a></p></body></html>`,
      )
    }
    if (url.pathname === `${path}/token` && request.method === 'POST') {
      const body = await bodyOf(request)
      if (fault === 'no_tokens') return json(200, { token_type: 'Bearer' })
      if (body.get('grant_type') === 'refresh_token') {
        if (!refreshTokens.has(body.get('refresh_token') ?? '')) {
          return json(400, { error: 'invalid_grant' })
        }
        return json(200, { id_token: idToken(null) })
      }
      const asked = codes.get(body.get('code') ?? '')
      codes.delete(body.get('code') ?? '')
      const proof = base64Url(
        createHash('sha256')
          .update(body.get('code_verifier') ?? '')
          .digest(),
      )
      if (!asked || proof !== asked.challenge || body.get('redirect_uri') !== asked.redirectUri) {
        return json(400, { error: 'invalid_grant' })
      }
      const refreshToken = randomUUID()
      refreshTokens.add(refreshToken)
      return json(200, { id_token: idToken(asked.nonce), refresh_token: refreshToken })
    }
    return response.writeHead(404).end()
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`

  return {
    origin,
    authority: `${origin}${path}`,
    fault: (next) => {
      fault = next
    },
    revoke: () => refreshTokens.clear(),
    close: () => new Promise((resolve) => server.close(() => resolve())),
  }
}
