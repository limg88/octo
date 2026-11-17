import type { SessionView } from '@octo/application'
import { type FormEvent, useState } from 'react'
import type { ErrorCode, OctoApi } from '../shared/api.ts'
import { Logo } from './Logo.tsx'
import { errorText, messages } from './messages.ts'

type Props = {
  api: Pick<OctoApi, 'signIn' | 'cancelSignIn' | 'configureSignIn'>
  /** Null while Octo is still finding out whether somebody is signed in. */
  session: SessionView | null
  error: ErrorCode | null
  /** Told the session as it is after a sign-in, or after Octo learnt where to sign in. */
  onSignedIn: (session: SessionView) => void
}

const text = messages.session

/** The only page of Octo while nobody is signed in: the sign-in itself happens in the browser. */
export function SignIn({ api, session, error, onSignedIn }: Props) {
  const [waiting, setWaiting] = useState(false)
  const [failure, setFailure] = useState<ErrorCode | null>(null)
  const [tenantId, setTenantId] = useState('')
  const [clientId, setClientId] = useState('')

  async function signIn() {
    setWaiting(true)
    setFailure(null)
    const result = await api.signIn()
    setWaiting(false)
    if (result.ok) onSignedIn(result.value)
    else setFailure(result.code)
  }

  async function configure(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFailure(null)
    const result = await api.configureSignIn(tenantId, clientId)
    if (result.ok) onSignedIn(result.value)
    else setFailure(result.code)
  }

  const shown = failure ?? error
  return (
    <div className="shell shell-alone">
      <main>
        <div className="notice">
          <div className="brand brand-alone">
            <Logo size={32} />
            <h1>{messages.brand}</h1>
          </div>
          <h2>{text.title}</h2>
          {session === null ? (
            <p className="progress">{text.checking}</p>
          ) : !session.configured ? (
            <form className="source-form" onSubmit={(event) => void configure(event)}>
              <p>{text.notConfigured}</p>
              <label>
                {text.tenantId}
                <input
                  value={tenantId}
                  spellCheck={false}
                  onChange={(event) => setTenantId(event.target.value)}
                />
              </label>
              <label>
                {text.clientId}
                <input
                  value={clientId}
                  spellCheck={false}
                  onChange={(event) => setClientId(event.target.value)}
                />
              </label>
              <p className="hint">{text.whereToFind}</p>
              {failure && (
                <p className="warning" role="alert">
                  {errorText(failure)}
                </p>
              )}
              <div className="actions">
                <button
                  type="submit"
                  className="primary"
                  disabled={tenantId.trim() === '' || clientId.trim() === ''}
                >
                  {text.configure}
                </button>
              </div>
            </form>
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
