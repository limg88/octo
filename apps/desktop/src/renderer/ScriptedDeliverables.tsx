import type {
  AgentProgress,
  ScriptedCorrection,
  ScriptedRun,
  ScriptedSummary,
} from '@octo/application'
import type { Project } from '@octo/domain'
import { useEffect, useState } from 'react'
import type { ErrorCode, OctoApi, Result } from '../shared/api.ts'
import { errorText, messages, progressText } from './messages.ts'
import { BusyButton, Waiting } from './Spinner.tsx'

type ScriptedApi = Pick<
  OctoApi,
  | 'scriptedDeliverables'
  | 'installScripted'
  | 'runScripted'
  | 'keepScripted'
  | 'correctScripted'
  | 'approveScripted'
  | 'onDeliverableProgress'
>
type Props = { api: ScriptedApi; project: Project }

const text = messages.scripted
type Working = 'run' | 'correct' | null

/** What a run gave: what the script said, and its files, kept in the project only when told. */
function Outcome({
  run,
  kept,
  onKeep,
}: {
  run: ScriptedRun
  kept: string | null
  onKeep: () => void
}) {
  return (
    <>
      <ul className={run.ok ? 'missing' : 'missing warning'} role={run.ok ? undefined : 'alert'}>
        {run.messages.map((message) => (
          <li key={message}>{message}</li>
        ))}
      </ul>
      {run.files.length > 0 &&
        (kept === null ? (
          <div className="actions">
            <span className="hint">{text.files(run.files.join(', '))}</span>
            <button type="button" className="primary" onClick={onKeep}>
              {text.keep}
            </button>
          </div>
        ) : (
          <p className="badge badge-ok" role="status">
            {text.kept(kept)}
          </p>
        ))}
    </>
  )
}

/** One deliverable with a script: run it, keep what it gave, correct it in words. */
function Scripted({
  api,
  project,
  summary,
  onListed,
}: Props & {
  summary: ScriptedSummary
  onListed: (list: ScriptedSummary[]) => void
}) {
  const [asked, setAsked] = useState<Record<string, string>>({})
  const [working, setWorking] = useState<Working>(null)
  const [run, setRun] = useState<ScriptedRun | null>(null)
  const [kept, setKept] = useState<string | null>(null)
  const [words, setWords] = useState('')
  const [correction, setCorrection] = useState<ScriptedCorrection | null>(null)
  const [approved, setApproved] = useState(false)
  const [error, setError] = useState<ErrorCode | null>(null)
  const { slug } = summary

  /** One step at a time: its failure is said under the deliverable it is of. */
  async function step<Value>(
    which: Working,
    work: () => Promise<Result<Value>>,
    done: (value: Value) => void,
  ) {
    setError(null)
    setWorking(which)
    const result = await work()
    setWorking(null)
    if (result.ok) done(result.value)
    else setError(result.code)
  }

  if (!summary.installed) {
    return (
      <li className="box">
        <strong>{summary.title}</strong>
        <p className="hint">{summary.about}</p>
        <div className="actions">
          <button
            type="button"
            onClick={() => void step(null, () => api.installScripted(project.id, slug), onListed)}
          >
            {text.install}
          </button>
        </div>
        {error && <p className="warning">{errorText(error)}</p>}
      </li>
    )
  }
  return (
    <li className="box">
      <section aria-label={summary.title}>
        <strong>{summary.title}</strong>
        <p className="hint">{summary.about}</p>
        <div className="settings-form">
          {summary.parameters.map((parameter) => (
            <label key={parameter.name} className="field">
              {parameter.label}
              <input
                value={asked[parameter.name] ?? ''}
                onChange={(event) => setAsked({ ...asked, [parameter.name]: event.target.value })}
              />
            </label>
          ))}
          <div className="actions">
            <BusyButton
              className="primary"
              busy={working === 'run'}
              busyLabel={text.running}
              disabled={working !== null}
              onClick={() =>
                void step(
                  'run',
                  () => api.runScripted(project.id, slug, asked),
                  (value) => {
                    setRun(value)
                    setKept(null)
                  },
                )
              }
            >
              {text.run}
            </BusyButton>
          </div>
        </div>
        {run && (
          <Outcome
            run={run}
            kept={kept}
            onKeep={() =>
              void step(
                null,
                () => api.keepScripted(project.id, slug, run.runId),
                (value) => setKept(value.folder),
              )
            }
          />
        )}
        <details className="advanced">
          <summary>{text.correct}</summary>
          <div className="fold-fields">
            <p className="hint">{text.correctHint}</p>
            <textarea
              aria-label={text.correctLabel(summary.title)}
              rows={3}
              value={words}
              onChange={(event) => setWords(event.target.value)}
            />
            <div className="actions">
              <BusyButton
                busy={working === 'correct'}
                busyLabel={text.correcting}
                disabled={working !== null || words.trim() === ''}
                onClick={() =>
                  void step(
                    'correct',
                    () => api.correctScripted(project.id, slug, words),
                    (value) => {
                      setCorrection(value)
                      setApproved(false)
                    },
                  )
                }
              >
                {text.tryCorrection}
              </BusyButton>
            </div>
            {correction && (
              <section className="box box-source" aria-label={text.correctionTitle}>
                <p>{correction.summary}</p>
                <p className="hint">
                  {correction.changed.length === 0
                    ? text.nothingChanged
                    : text.changed(correction.changed.join(', '))}
                </p>
                <Outcome run={{ ...correction, files: [] }} kept={null} onKeep={() => {}} />
                {approved ? (
                  <p className="badge badge-ok" role="status">
                    {text.approved}
                  </p>
                ) : (
                  correction.changed.length > 0 && (
                    <div className="actions">
                      <button
                        type="button"
                        className="primary"
                        onClick={() =>
                          void step(
                            null,
                            () => api.approveScripted(project.id, slug, correction.runId),
                            () => {
                              setApproved(true)
                              setWords('')
                            },
                          )
                        }
                      >
                        {text.approve}
                      </button>
                      <span className="hint">{text.approveHint}</span>
                    </div>
                  )
                )}
              </section>
            )}
          </div>
        </details>
        {error && (
          <p className="warning" role="alert">
            {errorText(error)}
          </p>
        )}
      </section>
    </li>
  )
}

/**
 * The deliverables of the project made by a script: the script and its data are files of the
 * project, Claude runs them inside its fence, and the PM corrects them in words. Nothing is
 * written in the project until the PM keeps a result or approves a correction.
 */
export function ScriptedDeliverables({ api, project }: Props) {
  const [list, setList] = useState<ScriptedSummary[] | null>(null)
  const [progress, setProgress] = useState<AgentProgress | null>(null)

  useEffect(() => {
    setList(null)
    void api
      .scriptedDeliverables(project.id)
      .then((result) => setList(result.ok ? result.value : []))
    return api.onDeliverableProgress((projectId, step) => {
      if (projectId === project.id) setProgress(step)
    })
  }, [api, project.id])

  if (list === null || list.length === 0) return null
  return (
    <section className="scripted" aria-label={text.title}>
      <h3>{text.title}</h3>
      <p className="hint">{text.intro}</p>
      {progress && <Waiting>{progressText(progress)}</Waiting>}
      <ul className="scripted-list">
        {list.map((summary) => (
          <Scripted
            key={summary.slug}
            api={api}
            project={project}
            summary={summary}
            onListed={(next) => {
              setList(next)
              setProgress(null)
            }}
          />
        ))}
      </ul>
    </section>
  )
}
