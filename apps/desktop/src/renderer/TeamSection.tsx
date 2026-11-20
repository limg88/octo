import {
  FULL_ALLOCATION,
  type Project,
  type ProjectTeam,
  TEAM_ADDRESSES,
  TEAM_SIDES,
  type TeamPerson,
} from '@octo/domain'
import { useCallback, useEffect, useId, useState } from 'react'
import type { ErrorCode, OctoApi } from '../shared/api.ts'
import { type DataColumn, DataTable } from './DataTable.tsx'
import { FieldProblems, NotSaved } from './FieldProblems.tsx'
import { amountOf, amountText } from './forecast-text.ts'
import { errorText, messages } from './messages.ts'
import { blankRow, emptyRow, orOneRow, type Row, type RowsColumn, RowsField } from './RowsField.tsx'
import { shortDayText } from './today-text.ts'

type Props = { api: Pick<OctoApi, 'team' | 'saveTeam'>; project: Project }

const text = messages.team

type PersonKey =
  | 'name'
  | 'role'
  | 'side'
  | 'allocation'
  | 'capDays'
  | 'from'
  | 'to'
  | 'note'
  | 'address'
type PeriodKey = 'name' | 'from' | 'to'
const SIDES: readonly TeamPerson['side'][] = TEAM_SIDES

/** What is typed of a person: the list shows some of it, the detail beside the list all of it. */
const PERSON_COLUMNS: RowsColumn<PersonKey>[] = [
  { key: 'name', label: text.columns.name },
  { key: 'role', label: text.columns.role },
  { key: 'side', label: text.columns.side },
  { key: 'allocation', label: text.columns.allocation },
  { key: 'capDays', label: text.columns.capDays },
  { key: 'from', label: text.columns.from },
  { key: 'to', label: text.columns.to },
  { key: 'note', label: text.columns.note },
  { key: 'address', label: text.columns.address },
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
const emptyPerson = (row: Row<PersonKey>): boolean => blankRow({ ...row, side: '', address: '' })

/** The people and the calendar of the project, typed once and read by everything else. */
export function TeamSection({ api, project }: Props) {
  const [people, setPeople] = useState<Row<PersonKey>[]>([])
  const [periods, setPeriods] = useState<Row<PeriodKey>[]>([])
  const [loaded, setLoaded] = useState(false)
  const [saved, setSaved] = useState<ProjectTeam | null>(null)
  const [error, setError] = useState<ErrorCode | null>(null)
  const [problems, setProblems] = useState<{ people: string[]; periods: string[] } | null>(null)
  /** The person whose fields are in view beside the list. */
  const [chosen, setChosen] = useState(0)
  /** What was read or saved last, as typed: anything else is a change still to save. */
  const [kept, setKept] = useState('')
  const formId = useId()

  const show = useCallback((team: ProjectTeam) => {
    const shownPeople = orOneRow(
      team.people.map(({ capDays, address, ...person }) => ({
        ...person,
        address: address ?? '',
        allocation: amountText(person.allocation),
        capDays: amountText(capDays ?? null),
      })),
      PERSON_COLUMNS,
    )
    const shownPeriods = orOneRow([...team.periods], PERIOD_COLUMNS)
    setPeople(shownPeople)
    setPeriods(shownPeriods)
    setKept(JSON.stringify({ people: shownPeople, periods: shownPeriods }))
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
          side: SIDES.find((side) => side === row.side) ?? 'supplier',
          from: row.from,
          to: row.to,
          allocation: amountOf(row.allocation),
          note: row.note.trim(),
          // Written only when there is one: a person without a cap is kept as before.
          ...(amountOf(row.capDays) === null ? {} : { capDays: amountOf(row.capDays) }),
          // Written only when the PM fixed it: else who writes follows the mail already sent.
          ...TEAM_ADDRESSES.filter((address) => address === row.address).map((address) => ({
            address,
          }))[0],
        })),
      periods: periods
        .filter((row) => !blankRow(row))
        .map((row) => ({ name: row.name.trim(), from: row.from, to: row.to })),
    })
    if (!result.ok) return setError(result.code)
    show(result.value)
    setSaved(result.value)
  }

  const typed = JSON.stringify({ people, periods })
  const clean = typed === kept
  const personAt = Math.min(chosen, people.length - 1)
  const person = people[personAt]
  const setPerson = (key: PersonKey, value: string) =>
    setPeople(people.map((row, at) => (at === personAt ? { ...row, [key]: value } : row)))
  /** The name of a field of the person in view, read by who cannot see where it stands. */
  const nameOf = (key: PersonKey) => text.cell(text.personN(personAt + 1), PERSON_LABELS[key])
  const input = (key: PersonKey, kind: 'text' | 'amount' | 'date' = 'text') => (
    <label className="field">
      {PERSON_LABELS[key]}
      <input
        type={kind === 'date' ? 'date' : 'text'}
        inputMode={kind === 'amount' ? 'decimal' : undefined}
        aria-label={nameOf(key)}
        value={person?.[key] ?? ''}
        onChange={(event) => setPerson(key, event.target.value)}
      />
    </label>
  )
  const select = (key: PersonKey, options: ReadonlyArray<{ value: string; label: string }>) => (
    <label className="field">
      {PERSON_LABELS[key]}
      <select
        aria-label={nameOf(key)}
        value={person?.[key] ?? ''}
        onChange={(event) => setPerson(key, event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
  const listed = people.map((row, index) => ({ row, index }))
  const listColumns: DataColumn<(typeof listed)[number]>[] = [
    {
      key: 'name',
      label: text.columns.name,
      width: '32%',
      cell: ({ row, index }) => (
        <button
          type="button"
          className="quiet cell-button project-name"
          aria-pressed={index === personAt}
          aria-label={text.show(row.name.trim() === '' ? text.personN(index + 1) : row.name)}
          onClick={() => setChosen(index)}
        >
          {row.name.trim() === '' ? text.unnamed : row.name}
        </button>
      ),
    },
    { key: 'role', label: text.columns.role, cell: ({ row }) => row.role },
    {
      key: 'side',
      label: text.columns.side,
      width: '100px',
      cell: ({ row }) => text.sides[SIDES.find((side) => side === row.side) ?? 'supplier'],
    },
    {
      key: 'allocation',
      label: text.columns.allocation,
      kind: 'number',
      width: '110px',
      cell: ({ row }) => row.allocation || <span className="hint">{text.blank.allocation}</span>,
    },
    {
      key: 'from',
      label: text.columns.from,
      width: '100px',
      cell: ({ row }) =>
        row.from === '' ? <span className="hint">{text.blank.from}</span> : shortDayText(row.from),
    },
    {
      key: 'to',
      label: text.columns.to,
      width: '100px',
      cell: ({ row }) =>
        row.to === '' ? <span className="hint">{text.blank.to}</span> : shortDayText(row.to),
    },
  ]

  return (
    <section className="source" aria-label={text.title}>
      <div className="title-row">
        <div>
          <h3>{text.title}</h3>
          <p className="hint">{text.intro}</p>
        </div>
        {loaded && (
          <div className="actions">
            <span className="hint">
              {saved
                ? text.saved(saved.people.length, saved.periods.length)
                : clean
                  ? text.nothingToSave
                  : ''}
            </span>
            <button type="submit" form={formId} className="primary">
              {text.save}
            </button>
          </div>
        )}
      </div>
      {error && (
        <p className="warning" role="alert">
          {errorText(error)}
        </p>
      )}
      {loaded && (
        <form
          id={formId}
          className="team-form"
          onSubmit={(event) => {
            event.preventDefault()
            void save()
          }}
        >
          <div className="title-row">
            <h4>
              {text.people}{' '}
              <span className="today-count">
                {messages.rows.count(people.filter((row) => !emptyPerson(row)).length)}
              </span>
            </h4>
            <button
              type="button"
              onClick={() => {
                setPeople([...people, emptyRow(PERSON_COLUMNS)])
                setChosen(people.length)
              }}
            >
              {text.addPerson}
            </button>
          </div>
          <div className="team-people">
            <DataTable
              label={text.people}
              columns={listColumns}
              rows={listed}
              rowKey={({ index }) => String(index)}
              rowClassName={({ index }) => (index === personAt ? 'row-selected' : undefined)}
            />
            {person && (
              <section className="panel team-person" aria-label={text.personN(personAt + 1)}>
                <div className="panel-head">
                  <h4>{person.name.trim() === '' ? text.unnamed : person.name}</h4>
                  <button
                    type="button"
                    className="quiet"
                    aria-label={text.remove(text.personN(personAt + 1))}
                    onClick={() =>
                      setPeople(
                        orOneRow(
                          people.filter((_row, at) => at !== personAt),
                          PERSON_COLUMNS,
                        ),
                      )
                    }
                  >
                    ×
                  </button>
                </div>
                <div className="panel-body team-fields">
                  {input('name')}
                  {input('role')}
                  {select(
                    'side',
                    SIDES.map((side) => ({ value: side, label: text.sides[side] })),
                  )}
                  {input('allocation', 'amount')}
                  {input('capDays', 'amount')}
                  <p className="hint team-fields-wide">{text.hints.allocation}</p>
                  {input('from', 'date')}
                  {input('to', 'date')}
                  <p className="hint team-fields-wide">{text.hints.dates}</p>
                  <div className="team-fields-wide">
                    {input('note')}
                    <p className="hint">{text.hints.note}</p>
                  </div>
                  <div className="team-fields-wide">
                    {select('address', [
                      { value: '', label: text.addressAuto },
                      ...TEAM_ADDRESSES.map((address) => ({ value: address, label: address })),
                    ])}
                    <p className="hint">{text.hints.address}</p>
                  </div>
                </div>
              </section>
            )}
          </div>
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
          {problems && <NotSaved text={messages.notSaved} />}
        </form>
      )}
    </section>
  )
}

const labelsOf = <Key extends string>(columns: RowsColumn<Key>[]): Record<Key, string> =>
  Object.fromEntries(columns.map((column) => [column.key, column.label])) as Record<Key, string>
const PERSON_LABELS = labelsOf(PERSON_COLUMNS)
const PERIOD_LABELS = labelsOf(PERIOD_COLUMNS)
