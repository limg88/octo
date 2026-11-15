import { DomainError, type Identity, isDomainError } from '@octo/domain'
import type { IdentityProvider, SecretVault } from './ports.ts'

export type SessionDeps = {
  provider: IdentityProvider
  /** Where what renews the sign-in is kept: the system's own store, never the project folder. */
  secrets: SecretVault
}

/** What the interface is told about who is using Octo. */
export type SessionView = {
  identity: Identity | null
  /** False when Octo was not told where the organization signs in: nobody can enter. */
  configured: boolean
}

export type Session = {
  /** Who is signed in now; null when nobody is. */
  current(): Identity | null
  /** Throws `not_signed_in` when nobody is signed in: Octo does nothing for nobody. */
  require(): Identity
  view(): Promise<SessionView>
  /**
   * At every start: renews the sign-in kept on this computer without asking. When it cannot
   * (no network, access withdrawn), nobody is signed in and the person is asked again.
   */
  resume(): Promise<SessionView>
  signIn(): Promise<SessionView>
  /** Stops a sign-in that waits for the browser. */
  cancelSignIn(): void
  signOut(): Promise<SessionView>
}

export const SESSION_SECRET_KEY = 'session/refresh-token'

export function createSession(deps: SessionDeps): Session {
  let identity: Identity | null = null
  let waiting: AbortController | null = null

  async function view(): Promise<SessionView> {
    return { identity, configured: (await deps.provider.configured()) !== null }
  }

  async function keep(refreshToken: string | null): Promise<void> {
    // Without a safe store the sign-in simply lasts until Octo is closed.
    try {
      if (refreshToken === null) await deps.secrets.remove(SESSION_SECRET_KEY)
      else await deps.secrets.set(SESSION_SECRET_KEY, refreshToken)
    } catch (error) {
      if (!isDomainError(error)) throw error
    }
  }

  return {
    current: () => identity,

    require() {
      if (identity === null) throw new DomainError('not_signed_in')
      return identity
    },

    view,

    async resume() {
      identity = null
      const kept = await deps.secrets.get(SESSION_SECRET_KEY).catch(() => null)
      if (kept === null) return view()
      try {
        const signedIn = await deps.provider.renew(kept)
        identity = signedIn.identity
        await keep(signedIn.refreshToken ?? kept)
      } catch (error) {
        if (!isDomainError(error)) throw error
      }
      return view()
    },

    async signIn() {
      if ((await deps.provider.configured()) === null) {
        throw new DomainError('sign_in_not_configured')
      }
      waiting?.abort()
      const abort = new AbortController()
      waiting = abort
      try {
        const signedIn = await deps.provider.signIn(abort.signal)
        identity = signedIn.identity
        await keep(signedIn.refreshToken)
        return view()
      } finally {
        if (waiting === abort) waiting = null
      }
    },

    cancelSignIn() {
      waiting?.abort()
    },

    async signOut() {
      identity = null
      await keep(null)
      return view()
    },
  }
}
