import type { SessionView } from '@octo/application'
import { useState } from 'react'
import type { ErrorCode, OctoApi } from '../shared/api.ts'
import { errorText, messages } from './messages.ts'

type Props = {
  api: Pick<OctoApi, 'signIn' | 'cancelSignIn'>
  /** Null while Octo is still finding out whether somebody is signed in. */
  session: SessionView | null
  error: ErrorCode | null
  onSignedIn: (session: SessionView) => void
}

const text = messages.session

/** The only page of Octo while nobody is signed in: the sign-in itself happens in the browser. */
export function SignIn({ api, session, error, onSignedIn }: Props) {
  const [waiting, setWaiting] = useState(false)
  const [failure, setFailure] = useState<ErrorCode | null>(null)

  async function signIn() {
    setWaiting(true)
    setFailure(null)
    const result = await api.signIn()
    setWaiting(false)
    if (result.ok) onSignedIn(result.value)
    else setFailure(result.code)
  }

  const shown = failure ?? error
  return (
    <div className="shell shell-alone">
      <main>
        <div className="notice">
          <h1>{messages.appName}</h1>
          <h2>{text.title}</h2>
          {session === null ? (
            <p className="progress">{text.checking}</p>
          ) : !session.configured ? (
            <p className="warning" role="alert">
              {text.notConfigured}
            </p>
          ) : (
            <>
              <p>{text.body}</p>
              {shown && (
                <p className="warning" role="alert">
                  {errorText(shown)}
                </p>
              )}
              {waiting ? (
                <>
                  <p className="progress">{text.waiting}</p>
                  <div className="actions">
                    <button type="button" onClick={() => void api.cancelSignIn()}>
                      {text.cancel}
                    </button>
                  </div>
                </>
              ) : (
                <div className="actions">
                  <button type="button" className="primary" onClick={() => void signIn()}>
                    {text.signIn}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  )
}
