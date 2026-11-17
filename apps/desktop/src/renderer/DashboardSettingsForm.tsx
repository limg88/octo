import type { DashboardView, ExportCandidates } from '@octo/application'
import { type DashboardSettings, PHASES, type Phase } from '@octo/domain'
import { useEffect, useRef, useState } from 'react'
import { KnownList } from './KnownList.tsx'
import { messages } from './messages.ts'
import { PathField } from './PathField.tsx'

type Props = {
  settings: DashboardSettings
  candidates: ExportCandidates
  /** What the tracker holds, once read: the states and periods to choose among. */
  view: DashboardView | null
  onSave: (settings: DashboardSettings) => Promise<void>
  /** Opens the dialog of the system on the JSON files of the project. */
  onChooseFile: () => Promise<string | null>
}

const text = messages.dashboard
/** Where the tracker export is and how to read it. Nothing here leaves the project folder. */
export function DashboardSettingsForm({ settings, candidates, view, onSave, onChooseFile }: Props) {
  const [draft, setDraft] = useState(settings)
  const [saving, setSaving] = useState(false)

  // Only when other settings arrive: what is typed right after the form opens is never undone.
  const shown = useRef(settings)
  useEffect(() => {
    if (shown.current === settings) return
    shown.current = settings
    setDraft(settings)
  }, [settings])

  // The only export of the folder is proposed without asking.
  useEffect(() => {
    setDraft((current) => ({
      ...current,
      exportPath:
        current.exportPath ||
        (candidates.exports.length === 1 ? (candidates.exports[0] ?? '') : ''),
      historyPath:
        current.historyPath ||
        (candidates.histories.length === 1 ? (candidates.histories[0] ?? '') : ''),
    }))
  }, [candidates])

  // Always from the latest draft: two quick changes never lose the first.
  const update = (part: (current: DashboardSettings) => Partial<DashboardSettings>) =>
    setDraft((current) => ({ ...current, ...part(current) }))
  const change = (part: Partial<DashboardSettings>) => update(() => part)
  const verifyStates = view?.states.filter((entry) => entry.phase === 'verify') ?? []
  const typesRead = view?.types.map((entry) => entry.type) ?? []

  async function submit() {
    setSaving(true)
    await onSave(draft)
    setSaving(false)
  }

  return (
    <form
      className="settings-form"
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
    >
      <PathField
        label={text.exportPath}
        value={draft.exportPath}
        candidates={candidates.exports}
        onChange={(exportPath) => change({ exportPath })}
        onChoose={onChooseFile}
      />
      {candidates.exports.length === 0 && draft.exportPath === '' && (
        <p className="hint">{text.noCandidates}</p>
      )}
      <PathField
        label={text.historyPath}
        value={draft.historyPath}
        candidates={candidates.histories}
        onChange={(historyPath) => change({ historyPath })}
        onChoose={onChooseFile}
      />
      <p className="hint">{text.historyHint}</p>
      <KnownList
        label={text.tags}
        known={view?.tags ?? []}
        chosen={draft.tags}
        onChange={(tags) => change({ tags })}
      />
      <KnownList
        label={text.bugTypes}
        known={typesRead}
        chosen={draft.bugTypes}
        onChange={(bugTypes) => change({ bugTypes })}
      />
      <KnownList
        label={text.storyTypes}
        known={typesRead}
        chosen={draft.storyTypes}
        onChange={(storyTypes) => change({ storyTypes })}
      />
      {view && view.types.length > 0 && (
        <p className="hint">
          {text.typesHint(view.types.map(({ type, count }) => `${type} (${count})`).join(', '))}
        </p>
      )}
      <label className="check">
        <input
          type="checkbox"
          checked={draft.ownPeopleOnly}
          onChange={(event) => change({ ownPeopleOnly: event.target.checked })}
        />
        {messages.ownPeopleOnly.label}
      </label>
      <p className="hint">{messages.ownPeopleOnly.hint}</p>
      <label>
        {text.stuckDays}
        <input
          type="number"
          min={1}
          value={draft.stuckDays}
          onChange={(event) => change({ stuckDays: Number(event.target.value) })}
        />
      </label>
      <label>
        {text.answerWorkdays}
        <input
          type="number"
          min={0}
          value={draft.answerWorkdays}
          onChange={(event) => change({ answerWorkdays: Number(event.target.value) })}
        />
      </label>
      {view && view.periods.length > 0 && (
        <KnownList
          label={text.periods}
          known={view.periods}
          chosen={draft.requirementPeriods}
          onChange={(requirementPeriods) => change({ requirementPeriods })}
        />
      )}
      {verifyStates.length > 0 && (
        <KnownList
          label={text.handover}
          known={verifyStates.map((entry) => entry.state)}
          chosen={draft.handoverStates}
          onChange={(handoverStates) => change({ handoverStates })}
        />
      )}
      {view && view.states.length > 0 && (
        <fieldset>
          <legend>{text.phasesTitle}</legend>
          <p className="hint">{text.phasesHint}</p>
          {view.states.map((entry) => (
            <label key={entry.state} className="phase-row">
              <span>
                {entry.state} ({entry.count})
              </span>
              <select
                value={draft.phases[entry.state] ?? entry.phase}
                onChange={(event) =>
                  update((current) => ({
                    phases: { ...current.phases, [entry.state]: event.target.value as Phase },
                  }))
                }
              >
                {PHASES.map((phase) => (
                  <option key={phase} value={phase}>
                    {text.phase[phase]}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </fieldset>
      )}
      <div className="actions">
        <button type="submit" disabled={saving || draft.exportPath.trim() === ''}>
          {text.save}
        </button>
        {draft.exportPath.trim() === '' && <span className="hint">{text.saveNeeds}</span>}
      </div>
    </form>
  )
}
