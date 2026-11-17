import { FULL_ALLOCATION, type Project, type ProjectTeam, type TeamPerson } from '@octo/domain'
import { useCallback, useEffect, useState } from 'react'
import type { ErrorCode, OctoApi } from '../shared/api.ts'
import { FieldProblems, NotSaved } from './FieldProblems.tsx'
import { amountOf, amountText } from './forecast-text.ts'
import { errorText, messages } from './messages.ts'
import { blankRow, orOneRow, type Row, type RowsColumn, RowsField } from './RowsField.tsx'

type Props = { api: Pick<OctoApi, 'team' | 'saveTeam'>; project: Project }

const text = messages.team

type PersonKey = 'name' | 'role' | 'side' | 'allocation' | 'capDays' | 'from' | 'to' | 'note'
type PeriodKey = 'name' | 'from' | 'to'
const SIDES: TeamPerson['side'][] = ['supplier', 'client']

const PERSON_COLUMNS: RowsColumn<PersonKey>[] = [
  { key: 'name', label: text.columns.name, width: 'minmax(150px, 1.2fr)' },
  { key: 'role', label: text.columns.role, width: 'minmax(200px, 1.8fr)' },
  {
    key: 'side',
    label: text.columns.side,
    kind: 'select',
    width: '110px',
    options: SIDES.map((side) => ({ value: side, label: text.sides[side] })),
  },
  { key: 'allocation', label: text.columns.allocation, kind: 'amount', width: '110px' },
  { key: 'capDays', label: text.columns.capDays, kind: 'amount', width: '110px' },
  { key: 'from', label: text.columns.from, kind: 'date', width: '150px' },
  { key: 'to', label: text.columns.to, kind: 'date', width: '150px' },
  { key: 'note', label: text.columns.note, width: 'minmax(130px, 1fr)' },
]
const PERIOD_COLUMNS: RowsColumn<PeriodKey>[] = [
  { key: 'name', label: text.columns.period, width: 'minmax(200px, 1fr)' },
  { key: 'from', label: text.columns.from, kind: 'date', width: '150px' },
  { key: 'to', label: text.columns.to, kind: 'date', width: '150px' },
]

/** Nothing typed, or a share of time: more than nothing and at most all of it. */
/** Nothing typed is no cap; anything else must be a number of days greater than nothing. */
function capRight(typed: string): boolean {
  const days = amountOf(typed)
  return typed.trim() === '' || (days !== null && days > 0)
}

function allocationRight(typed: string): boolean {
  if (typed.trim() === '') return true
  const value = amountOf(typed)
  return value !== null && value > 0 && value <= FULL_ALLOCATION
}

/** A row where only the side is set holds nothing yet: the side always has a value. */
const emptyPerson = (row: Row<PersonKey>): boolean => blankRow({ ...row, side: '' })

/** The people and the calendar of the project, typed once and read by everything else. */
export function TeamSection({ api, project }: Props) {
  const [people, setPeople] = useState<Row<PersonKey>[]>([])
  const [periods, setPeriods] = useState<Row<PeriodKey>[]>([])
  const [loaded, setLoaded] = useState(false)
  const [saved, setSaved] = useState<ProjectTeam | null>(null)
  const [error, setError] = useState<ErrorCode | null>(null)
  const [problems, setProblems] = useState<{ people: string[]; periods: string[] } | null>(null)

  const show = useCallback((team: ProjectTeam) => {
    setPeople(
      orOneRow(
        team.people.map(({ capDays, ...person }) => ({
          ...person,
          allocation: amountText(person.allocation),
          capDays: amountText(capDays ?? null),
        })),
        PERSON_COLUMNS,
      ),
    )
    setPeriods(orOneRow([...team.periods], PERIOD_COLUMNS))
  }, [])

  useEffect(() => {
    setLoaded(false)
    setSaved(null)
    setError(null)
    setProblems(null)
    void api.team(project.id).then((result) => {
      if (!result.ok) return setError(result.code)
      show(result.value)
      setLoaded(true)
    })
  }, [api, project.id, show])

  async function save() {
    setError(null)
    setSaved(null)
    const found = {
      people: people.flatMap((row, index) => {
        if (emptyPerson(row)) return []
        return [
          ...(row.name.trim() === '' ? [text.personWrong(index + 1)] : []),
          ...(allocationRight(row.allocation) ? [] : [text.allocationWrong(index + 1)]),
          ...(capRight(row.capDays) ? [] : [text.capWrong(index + 1)]),
        ]
      }),
      periods: periods.flatMap((row, index) =>
        blankRow(row) || (row.name.trim() !== '' && row.from !== '' && row.to !== '')
          ? []
          : [text.periodWrong(index + 1)],
      ),
    }
    // A row that lacks what makes it a person or a period is told, never dropped.
    if (found.people.length + found.periods.length > 0) return setProblems(found)
    setProblems(null)
    const result = await api.saveTeam(project.id, {
      people: people
        .filter((row) => !emptyPerson(row))
        .map((row) => ({
          name: row.name.trim(),
          role: row.role.trim(),
          side: row.side === 'client' ? 'client' : 'supplier',
          from: row.from,
          to: row.to,
          allocation: amountOf(row.allocation),
          note: row.note.trim(),
          // Written only when there is one: a person without a cap is kept as before.
          ...(amountOf(row.capDays) === null ? {} : { capDays: amountOf(row.capDays) }),
        })),
      periods: periods
        .filter((row) => !blankRow(row))
        .map((row) => ({ name: row.name.trim(), from: row.from, to: row.to })),
    })
    if (!result.ok) return setError(result.code)
    show(result.value)
    setSaved(result.value)
  }

  return (
    <section className="source" aria-label={text.title}>
      <h3>{text.title}</h3>
      <p className="hint">{text.intro}</p>
      {error && (
        <p className="warning" role="alert">
          {errorText(error)}
        </p>
      )}
      {loaded && (
        <form
          className="settings-form wide-form team-form"
          onSubmit={(event) => {
            event.preventDefault()
            void save()
          }}
        >
          <h4>{text.people}</h4>
          <p className="hint">{text.peopleHint}</p>
          <RowsField
            label={text.people}
            columns={PERSON_COLUMNS}
            rows={people}
            onChange={setPeople}
            addLabel={text.addPerson}
            cellLabel={(column, row) => text.cell(text.personN(row), PERSON_LABELS[column])}
            removeLabel={(row) => text.remove(text.personN(row))}
          />
          <FieldProblems lines={problems?.people ?? []} />
          <h4>{text.periods}</h4>
          <div className="calendar-rows">
            <RowsField
              label={text.periods}
              columns={PERIOD_COLUMNS}
              rows={periods}
              onChange={setPeriods}
              addLabel={text.addPeriod}
              cellLabel={(column, row) => text.cell(text.periodN(row), PERIOD_LABELS[column])}
              removeLabel={(row) => text.remove(text.periodN(row))}
            />
          </div>
          <FieldProblems lines={problems?.periods ?? []} />
          <div className="actions">
            <button type="submit">{text.save}</button>
            {problems && <NotSaved text={messages.notSaved} />}
          </div>
          {saved && (
            <p className="badge badge-ok">
              {text.saved(saved.people.length, saved.periods.length)}
            </p>
          )}
        </form>
      )}
    </section>
  )
}

const labelsOf = <Key extends string>(columns: RowsColumn<Key>[]): Record<Key, string> =>
  Object.fromEntries(columns.map((column) => [column.key, column.label])) as Record<Key, string>
const PERSON_LABELS = labelsOf(PERSON_COLUMNS)
const PERIOD_LABELS = labelsOf(PERIOD_COLUMNS)
