/** Who uses Octo, as the organization's own sign-in says. */
export type Identity = {
  /** The id of the person in the organization: it does not change when a name or an address does. */
  id: string
  /** The name the person signs in with, usually an address. */
  username: string
  /** The mail address; empty when the sign-in does not give one. */
  email: string
  name: string
  /** The organization the person signed in to. */
  tenant: string
}

/** How Octo is told where the organization signs in. */
export type SignInConfig = {
  /** Where the sign-in lives: `https://login.microsoftonline.com/<tenant>/v2.0`. */
  authority: string
  /** The id the organization gave Octo. */
  clientId: string
  /** The only organization whose people may enter. */
  tenantId: string
}

/** What an organization gives to let its people sign in to Octo. Neither is a secret. */
export type SignInSetup = { tenantId: string; clientId: string }

/** A tenant is named by its id: the sign-in says which organization a person belongs to with it. */
const TENANT_ID = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
const CLIENT_ID = /^[A-Za-z0-9-]{1,100}$/

/** The two ids as they are kept, trimmed; null when either is not an id an organization gives. */
export function signInSetupOf(tenantId: string, clientId: string): SignInSetup | null {
  const setup = { tenantId: tenantId.trim(), clientId: clientId.trim() }
  return TENANT_ID.test(setup.tenantId) && CLIENT_ID.test(setup.clientId) ? setup : null
}

const ADDRESS = /^[^\s@]+@[^\s@]+$/

/** The addresses the person is written to at, in lower case: the mail address and the sign-in name. */
export function identityAddresses(identity: Identity | null): string[] {
  if (identity === null) return []
  return [
    ...new Set(
      [identity.email, identity.username]
        .map((address) => address.trim().toLowerCase())
        .filter((address) => ADDRESS.test(address)),
    ),
  ]
}

/** What a sign-in says of a person, as the claims of its token. */
export type IdentityClaims = Readonly<Record<string, unknown>>

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

/**
 * The person a set of claims names, or null when they do not name one of the organization
 * expected: no id, or another tenant.
 */
export function identityOf(claims: IdentityClaims, tenantId: string): Identity | null {
  const id = text(claims.oid) || text(claims.sub)
  const tenant = text(claims.tid)
  if (id === '' || tenant === '' || tenant.toLowerCase() !== tenantId.toLowerCase()) return null
  const username = text(claims.preferred_username) || text(claims.upn) || text(claims.email)
  return {
    id,
    username,
    email: text(claims.email) || (ADDRESS.test(username) ? username : ''),
    name: text(claims.name) || username,
    tenant,
  }
}

/** Where a project stands for the person who uses Octo, by the project codes of the company system. */
export type Assignment = 'assigned' | 'not_assigned' | 'unknown'

/**
 * A project is the person's when at least one of its project codes is theirs in the company
 * system. Without codes, or without a list to compare with, nothing can be said.
 */
export function assignmentOf(
  projectCodes: readonly string[],
  assignedCodes: readonly string[] | null,
): Assignment {
  if (assignedCodes === null || projectCodes.length === 0) return 'unknown'
  const mine = new Set(assignedCodes.map((code) => code.toUpperCase()))
  return projectCodes.some((code) => mine.has(code.toUpperCase())) ? 'assigned' : 'not_assigned'
}
