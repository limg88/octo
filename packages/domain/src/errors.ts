export const DOMAIN_ERROR_CODES = [
  'empty_question',
  'project_not_found',
  'project_already_added',
  'folder_not_readable',
  'agent_not_installed',
  'agent_not_signed_in',
  'agent_failed',
  'agent_limit_reached',
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
  'deliverable_input_missing',
  'deliverable_kind_unknown',
  'deliverable_kind_invalid',
  'deliverable_not_found',
  'deliverable_not_ready',
  'deliverable_busy',
  'request_empty',
  'tracker_export_not_set',
  'tracker_export_missing',
  'tracker_export_unreadable',
  'dashboard_range_invalid',
  'dashboard_settings_invalid',
  'hours_sources_not_set',
  'hours_timesheet_missing',
  'hours_worklog_missing',
  'hours_period_invalid',
  'hours_settings_invalid',
  'forecast_model_not_set',
  'forecast_model_missing',
  'forecast_model_invalid',
  'forecast_month_invalid',
  'forecast_settings_invalid',
  'forecast_timesheet_not_set',
  'deck_model_invalid',
  'alignment_sprint_not_set',
  'alignment_items_missing',
  'alignment_tickets_missing',
  'alignment_settings_invalid',
  'progress_model_not_set',
  'progress_model_missing',
  'progress_model_invalid',
  'progress_settings_invalid',
  'progress_not_computable',
  'progress_request_missing',
  'letterhead_invalid',
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
