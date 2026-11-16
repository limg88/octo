import type { UpdateOffer, UpdateProgress } from '@octo/domain'
import { useEffect, useState } from 'react'
import type { ErrorCode, OctoApi } from '../shared/api.ts'
import { errorText, messages } from './messages.ts'
import { BusyButton } from './Spinner.tsx'

type UpdateApi = Pick<
  OctoApi,
  | 'checkForUpdate'
  | 'installUpdate'
  | 'onUpdateProgress'
  | 'updateJustDone'
  | 'openDiskAccessSettings'
>

type Props = {
  api: UpdateApi
  /** How often a newer version is looked for while Octo stays open. */
  everyMs?: number
}

const text = messages.update
const SIX_HOURS_MS = 6 * 60 * 60 * 1000
const WHOLE = 100

/**
 * Says when there is a newer Octo, and replaces this one with it on a click: it comes down, is
 * checked, takes the place of this one and starts. Looking for it never gets in the way: when
 * the check fails nothing is shown, and it is tried again later.
 */
export function UpdateNotice({ api, everyMs = SIX_HOURS_MS }: Props) {
  const [offer, setOffer] = useState<UpdateOffer | null>(null)
  const [dismissed, setDismissed] = useState<string | null>(null)
  const [installing, setInstalling] = useState(false)
  const [progress, setProgress] = useState<UpdateProgress | null>(null)
  const [error, setError] = useState<ErrorCode | null>(null)

  useEffect(() => {
    let current = true
    const check = () =>
      void api.checkForUpdate().then((result) => {
        if (current && result.ok) setOffer(result.value)
      })
    check()
    const timer = setInterval(check, everyMs)
    return () => {
      current = false
      clearInterval(timer)
    }
  }, [api, everyMs])

  useEffect(() => api.onUpdateProgress(setProgress), [api])

  /** The version Octo has just been updated to, until the PM has seen what that asks of them. */
  const [updatedTo, setUpdatedTo] = useState<string | null>(null)
  useEffect(() => {
    let current = true
    void api.updateJustDone().then((result) => {
      if (current && result.ok) setUpdatedTo(result.value)
    })
    return () => {
      current = false
    }
  }, [api])

  async function install() {
    setError(null)
    setProgress(null)
    setInstalling(true)
    const result = await api.installUpdate()
    // When it worked Octo is closing: the notice stays as it is until it does.
    if (result.ok) return
    setInstalling(false)
    setError(result.code)
  }

  if (updatedTo !== null) {
    return (
      <div className="notice-bar update-notice">
        <p role="status">{messages.diskAccess.afterUpdate(updatedTo)}</p>
        <button type="button" onClick={() => void api.openDiskAccessSettings()}>
          {messages.diskAccess.open}
        </button>
        <button type="button" className="quiet" onClick={() => setUpdatedTo(null)}>
          {messages.diskAccess.done}
        </button>
      </div>
    )
  }
  if (offer === null || offer.version === dismissed) return null
  const percent =
    progress && progress.total > 0 ? Math.floor((progress.received / progress.total) * WHOLE) : null
  return (
    <div className="notice-bar update-notice">
      <div>
        <p role="status">
          <strong>{text.available(offer.version)}</strong>{' '}
          {installing
            ? percent === null
              ? text.preparing
              : percent < WHOLE
                ? text.downloading(percent)
                : text.restarting
            : text.hint}
        </p>
        {error && (
          <p className="warning" role="alert">
            {errorText(error)}
          </p>
        )}
      </div>
      <BusyButton
        type="button"
        className="primary"
        busy={installing}
        busyLabel={text.installing}
        onClick={() => void install()}
      >
        {text.install}
      </BusyButton>
      {!installing && (
        <button
          type="button"
          className="quiet"
          aria-label={text.later}
          title={text.later}
          onClick={() => setDismissed(offer.version)}
        >
          ×
        </button>
      )}
    </div>
  )
}
