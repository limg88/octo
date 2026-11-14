import type { DashboardView, ExportCandidates } from '@octo/application'
import { type DashboardSettings, PHASES, type Phase } from '@octo/domain'
import { useEffect, useState } from 'react'
import { messages } from './messages.ts'

type Props = {
  settings: DashboardSettings
  candidates: ExportCandidates
  /** What the tracker holds, once read: the states and periods to choose among. */
  view: DashboardView | null
  onSave: (settings: DashboardSettings) => Promise<void>
}

const text = messages.dashboard
const LIST_SEPARATOR = ','
const listOf = (value: string): string[] => value.split(LIST_SEPARATOR).map((part) => part.trim())
const toggled = (values: string[], value: string): string[] =>
  values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value]

/** Where the tracker export is and how to read it. Nothing here leaves the project folder. */
export function DashboardSettingsForm({ settings, candidates, view, onSave }: Props) {
  const [draft, setDraft] = useState(settings)
  const [tags, setTags] = useState(settings.tags.join(`${LIST_SEPARATOR} `))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setDraft(settings)
    setTags(settings.tags.join(`${LIST_SEPARATOR} `))
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

  async function submit() {
    setSaving(true)
    await onSave({ ...draft, tags: listOf(tags) })
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
        options={candidates.exports}
        onChange={(exportPath) => change({ exportPath })}
      />
      {candidates.exports.length === 0 && draft.exportPath === '' && (
        <p className="hint">{text.noCandidates}</p>
      )}
      <PathField
        label={text.historyPath}
        value={draft.historyPath}
        options={candidates.histories}
        onChange={(historyPath) => change({ historyPath })}
      />
      <p className="hint">{text.historyHint}</p>
      <label>
        {text.tags}
        <input value={tags} onChange={(event) => setTags(event.target.value)} />
      </label>
      <label>
        {text.stuckDays}
        <input
          type="number"
          min={1}
          value={draft.stuckDays}
          onChange={(event) => change({ stuckDays: Number(event.target.value) })}
        />
      </label>
      {view && view.periods.length > 0 && (
        <CheckList
          legend={text.periods}
          options={view.periods}
          chosen={draft.requirementPeriods}
          onToggle={(period) =>
            update((current) => ({
              requirementPeriods: toggled(current.requirementPeriods, period),
            }))
          }
        />
      )}
      {verifyStates.length > 0 && (
        <CheckList
          legend={text.handover}
          options={verifyStates.map((entry) => entry.state)}
          chosen={draft.handoverStates}
          onToggle={(state) =>
            update((current) => ({ handoverStates: toggled(current.handoverStates, state) }))
          }
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
      </div>
    </form>
  )
}

function PathField({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: string[]
  onChange: (value: string) => void
}) {
  const listId = `paths-${label}`
  return (
    <label>
      {label}
      <input list={listId} value={value} onChange={(event) => onChange(event.target.value)} />
      <datalist id={listId}>
        {options.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
    </label>
  )
}

function CheckList({
  legend,
  options,
  chosen,
  onToggle,
}: {
  legend: string
  options: string[]
  chosen: string[]
  onToggle: (option: string) => void
}) {
  return (
    <fieldset>
      <legend>{legend}</legend>
      <div className="checks">
        {options.map((option) => (
          <label key={option} className="check">
            <input
              type="checkbox"
              checked={chosen.includes(option)}
              onChange={() => onToggle(option)}
            />
            {option}
          </label>
        ))}
      </div>
    </fieldset>
  )
}
