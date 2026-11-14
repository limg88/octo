export const DOMAIN_ERROR_CODES = [
  'empty_question',
  'project_not_found',
  'project_already_added',
  'folder_not_readable',
  'agent_not_installed',
  'agent_not_signed_in',
  'agent_failed',
  'agent_output_invalid',
  'agent_cancelled',
  'source_not_configured',
  'source_config_invalid',
  'source_busy',
  'mail_archive_unreadable',
  'mail_reader_missing',
  'secret_missing',
  'secret_store_unavailable',
  'feed_credential_refused',
  'feed_write_access_refused',
  'feed_connection_not_secure',
  'feed_unreachable',
  'feed_not_found',
  'feed_failed',
  'secret_value_invalid',
  'private_host_invalid',
  'private_host_unknown',
  'private_host_duplicate',
  'private_hosts_too_many',
  'private_host_ca_invalid',
  'private_host_ca_too_long',
  'private_host_ca_not_verified',
] as const

export type DomainErrorCode = (typeof DOMAIN_ERROR_CODES)[number]

/** An expected failure the interface can explain to the PM by its code. */
export class DomainError extends Error {
  readonly code: DomainErrorCode

  constructor(code: DomainErrorCode, detail?: string) {
    super(detail ? `${code}: ${detail}` : code)
    this.name = 'DomainError'
    this.code = code
  }
}

export function isDomainError(error: unknown): error is DomainError {
  return error instanceof DomainError
}
