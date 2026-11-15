import type { ErrorCode } from '../shared/api.ts'
import { errorText, messages } from './messages.ts'
import { SECTION_LABELS, type Section } from './sections.ts'

/** The errors that are put right in another section: where the PM has to go. */
const WAYS: Partial<Record<ErrorCode, Section>> = {
  forecast_timesheet_not_set: 'hours',
  alignment_items_missing: 'dashboard',
  alignment_tickets_missing: 'sources',
  tracker_export_not_set: 'dashboard',
}

type Props = {
  code: ErrorCode
  /** Takes the PM to another section; without it the error only says where to go. */
  onOpen?: ((section: Section) => void) | undefined
}

/** What went wrong, in words, with the way to where it is put right when there is one. */
export function Failure({ code, onOpen }: Props) {
  const way = WAYS[code]
  return (
    <p className="warning" role="alert">
      {errorText(code)}
      {way && onOpen && (
        <>
          {' '}
          <button type="button" className="quiet" onClick={() => onOpen(way)}>
            {messages.openSection(SECTION_LABELS[way])}
          </button>
        </>
      )}
    </p>
  )
}
