// @vitest-environment jsdom
import type {
  AgentProgress,
  ProjectOverview,
  SessionView,
  TodayView as View,
} from '@octo/application'
import {
  type BriefPoint,
  type DayMeeting,
  type MailFollowWhy,
  type MailReplyWhy,
  type MeetingPrep,
  NO_RISKS,
  type OpenPoint,
  type PointBrief,
  type Project,
  type RiskRegister as Register,
  type TodayItem,
  type WeekEntry,
} from '@octo/domain'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AllProjectsView } from '../src/renderer/AllProjectsView.tsx'
import { App } from '../src/renderer/App.tsx'
import { errorText, messages } from '../src/renderer/messages.ts'
import { systemNotify } from '../src/renderer/notify.ts'
import { prepText } from '../src/renderer/prep-text.ts'
import { RiskRegister } from '../src/renderer/RiskRegister.tsx'
import { SignIn } from '../src/renderer/SignIn.tsx'
import { TodayView } from '../src/renderer/TodayView.tsx'
import { ageText, nowText, personOf, signalText } from '../src/renderer/today-text.ts'
import type { OctoApi, Result } from '../src/shared/api.ts'

const aurora: Project = { id: 'p-1', name: 'Aurora', folder: '/progetti/Aurora', addedAt: '' }
const ok = <T,>(value: T): Result<T> => ({ ok: true, value })
const text = messages.today

const item = (
  key: string,
  band: TodayItem['band'],
  facts: TodayItem['facts'],
  more = {},
): TodayItem => ({
  key,
  band,
  facts,
  weight: 1,
  target: 'dashboard',
  asOf: null,
  ...more,
})

const mail = item(
  'mail:budget',
  'waiting',
  {
    kind: 'mail_reply',
    id: 'budget',
    path: 'Posta/2026-11/budget.md',
    from: 'Carla Bianchi <carla@cliente.example>',
    subject: 'Aurora: budget',
    days: 0,
    judgement: {
      importance: 'alta',
      reason: 'Comunica un budget in più.',
      quote: 'ha approvato un budget aggiuntivo',
      quoteVerified: true,
      deadline: '2026-11-18',
    },
  },
  { target: 'mail', asOf: '2026-11-16T08:00:00.000Z' },
)
const hours = item(
  'hours:2026-10',
  'due',
  {
    kind: 'hours',
    month: '2026-10',
    people: [
      { person: 'Bianchi Anna', status: 'outlier', timesheetHours: 160, worklogHours: 80 },
      { person: 'Neri Sara', status: 'no_worklog', timesheetHours: 80, worklogHours: 0 },
      { person: 'Ugo Gialli', status: 'no_timesheet', timesheetHours: 0, worklogHours: 120 },
    ],
    tieOutOk: false,
    duplicates: 1,
  },
  { target: 'hours', dueBecause: 'month_end', returned: { why: 'worse', was: 2, now: 3 } },
)
const source = item(
  'source:Jira',
  'alert',
  { kind: 'source', source: 'Jira', reason: 'stale', days: 3, error: null },
  { target: 'sources' },
)
const bugs = item('bugs-stuck', 'watch', {
  kind: 'bugs_stuck',
  count: 6,
  stuckDays: 30,
  oldestDays: 90,
})
const risk = item(
  'risk-candidates',
  'watch',
  { kind: 'risk_candidates', count: 2 },
  { target: 'risks' },
)

const view = (overrides: Partial<View> = {}): View => ({
  day: '2026-11-16',
  items: [source, hours, mail, bugs, risk],
  agenda: { today: [], next: { day: '2026-11-17', meetings: [] } },
  points: { since: '2026-11-13', queued: [], closed: [], toConfirm: [] },
  prep: [],
  closing: { unread: 0, key: '', at: null, model: null },
  week: { until: '2026-11-22', ongoing: [], coming: [] },
  now: [],
  nowSummary: [],
  marks: {},
  count: 0,
  notify: true,
  hidden: 1,
  hiddenItems: [],
  resolvedToday: [],
  sprintEnd: null,
  muteOffers: [],
  mutedKinds: [],
  freshness: [
    { source: 'Posta', readAt: '2026-11-16T08:45:00.000Z' },
    { source: 'Jira', readAt: null },
  ],
  evaluation: { at: '2026-11-16T09:02:00.000Z', model: 'claude-fake' },
  evaluationDue: false,
  ownAddresses: ['pm@example.test'],
  addedAddresses: [],
  ...overrides,
})

function todayApi(first: View = view(), overrides: Partial<OctoApi> = {}) {
  let tell: (projectId: string, progress: AgentProgress) => void = () => {}
  let changed: (projectId: string) => void = () => {}
  const api = {
    todayView: vi.fn(async () => ok(first)),
    decideToday: vi.fn(async () => ok(view({ items: [bugs], hidden: 2 }))),
    muteTodayKind: vi.fn(async () => ok(view({ mutedKinds: ['bugs_stuck'] }))),
    setMailTurn: vi.fn(async () => ok(view({ items: [bugs] }))),
    saveOwnAddresses: vi.fn(async () => ok(view({ addedAddresses: ['altro@example.test'] }))),
    evaluateToday: vi.fn(async () => ok(first)),
    closeToday: vi.fn(async () => ok(first)),
    cancelEvaluateToday: vi.fn(async () => ok(null)),
    onTodayProgress: (listener: typeof tell) => {
      tell = listener
      return () => {}
    },
    onSourcesChanged: (listener: typeof changed) => {
      changed = listener
      return () => {}
    },
    markTodaySeen: vi.fn(async () => ok(null)),
    nextReading: vi.fn(async () => ok<string | null>(null)),
    fill: vi.fn(async () => ok([])),
    openEvidence: vi.fn(async () => ok(null)),
    assignMeeting: vi.fn(async () => ok(first)),
    addOpenPoint: vi.fn(async () => ok(first)),
    updateOpenPoint: vi.fn(async () => ok(first)),
    confirmOpenPoint: vi.fn(async () => ok(first)),
    risks: vi.fn(async () => ok<Register>(NO_RISKS)),
    proposeRisks: vi.fn(async () => ok<Register>(NO_RISKS)),
    acceptRisk: vi.fn(async () => ok<Register>(NO_RISKS)),
    dismissRisk: vi.fn(async () => ok<Register>(NO_RISKS)),
    addRisk: vi.fn(async () => ok<Register>(NO_RISKS)),
    updateRisk: vi.fn(async () => ok<Register>(NO_RISKS)),
    ...overrides,
  }
  return {
    api,
    tell: (progress: AgentProgress) => tell('p-1', progress),
    changed: () => changed('p-1'),
  }
}

afterEach(cleanup)

describe('the notice of the system', () => {
  it('shows a notice and tells when it is clicked, and does nothing where there is none', () => {
    const made: Array<{ title: string; body: string | undefined; onclick: (() => void) | null }> =
      []
    class FakeNotification {
      constructor(title: string, options: { body?: string }) {
        made.push({ title, body: options.body, onclick: null })
        const notice = made[made.length - 1] as (typeof made)[number]
        Object.defineProperty(this, 'onclick', {
          set: (click: () => void) => {
            notice.onclick = click
          },
        })
      }
    }
    // Where the system has no notices, nothing is done and nothing fails.
    expect(() => systemNotify('a', 'b', () => {})).not.toThrow()
    vi.stubGlobal('Notification', FakeNotification)
    const clicked = vi.fn()
    systemNotify('Titolo', 'Aurora', clicked)
    expect(made.map(({ title, body }) => [title, body])).toEqual([['Titolo', 'Aurora']])
    made[0]?.onclick?.()
    expect(clicked).toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})

describe('the brief of the open points', () => {
  const point = (id: string, more: Partial<OpenPoint> = {}): OpenPoint => ({
    id,
    title: `Punto ${id}`,
    owner: '',
    openedOn: '2026-11-10',
    due: null,
    state: 'open',
    origin: 'pm',
    source: null,
    signalKey: null,
    signalKind: null,
    meeting: null,
    closedOn: null,
    closedBy: null,
    closing: null,
    history: [],
    check: null,
    ...more,
  })
  const queued = (id: string, more: Partial<BriefPoint> = {}, of: Partial<OpenPoint> = {}) => ({
    point: point(id, of),
    fresh: false,
    overdueDays: 0,
    openWorkdays: 4,
    raiseAt: null,
    ...more,
  })
  const source = { path: 'riunioni/sal/report.md', quote: 'ambiente entro venerdì', verified: true }
  const brief = (more: Partial<PointBrief> = {}): PointBrief => ({
    since: '2026-11-13',
    queued: [
      queued(
        'a',
        {
          overdueDays: 2,
          raiseAt: { uid: 'sal', subject: 'SAL', start: '2026-11-16T09:00:00.000Z' },
        },
        {
          title: 'Ambiente di prova',
          owner: 'Rossi',
          due: '2026-11-14',
          origin: 'claude',
          source,
          history: [{ day: '2026-11-13', text: 'Luca lo consegna lunedì', source: null }],
        },
      ),
      queued('b', { fresh: true, openWorkdays: 0 }, { due: '2026-11-20' }),
      queued('c', { openWorkdays: 1 }),
    ],
    closed: [
      point('z', {
        title: 'Stima della migrazione',
        state: 'resolved',
        closedOn: '2026-11-13',
        closedBy: 'claude',
        closing: {
          path: 'riunioni/sal/report.md',
          quote: 'confermata a 12 giorni',
          verified: true,
        },
      }),
    ],
    toConfirm: [],
    ...more,
  })
  const show = async (points: PointBrief, items: TodayItem[] = []) => {
    const { api } = todayApi(view({ points, items }))
    render(<TodayView api={api} project={aurora} canJudge onOpenSection={() => {}} />)
    const region = await screen.findByRole('region', { name: text.points.title })
    return { api, region }
  }

  it('says what is in the queue, whose it is, since when, and where to close it today', async () => {
    const { api, region } = await show(brief())
    expect(region.textContent).toContain(
      '3 in coda · 1 nuovo dal 13/11/2026 · 1 chiuso dal 13/11/2026',
    )
    const [first, second, third] = within(
      screen.getByRole('list', { name: text.points.list }),
    ).getAllByRole('listitem') as [HTMLElement, HTMLElement, HTMLElement]
    expect(first.textContent).toContain(text.points.late)
    expect(first.textContent).toContain('Ambiente di prova')
    expect(first.textContent).toContain(text.points.byClaude)
    expect(first.textContent).toContain(
      'di Rossi · aperto da 4 giorni lavorativi · era entro il 14/11/2026: scaduto da 2 giorni',
    )
    expect(first.textContent).toContain('↳ se ne parla oggi alle 10:00: SAL')
    expect(first.textContent).toContain('13/11/2026: Luca lo consegna lunedì')
    expect(second.textContent).toContain(text.points.fresh)
    expect(second.textContent).toContain('tuo · aperto oggi · entro il 20/11/2026')
    expect(third.textContent).toContain('aperto da 1 giorno lavorativo')

    fireEvent.click(
      screen.getByRole('button', { name: `${text.points.source}: Ambiente di prova` }),
    )
    await waitFor(() => expect(api.openEvidence).toHaveBeenCalledWith('p-1', source.path))
    fireEvent.click(screen.getByRole('button', { name: `${text.points.resolve}: Punto b` }))
    await waitFor(() =>
      expect(api.updateOpenPoint).toHaveBeenCalledWith('p-1', 'b', { state: 'resolved' }),
    )
    fireEvent.click(screen.getByRole('button', { name: `${text.points.drop}: Punto c` }))
    await waitFor(() =>
      expect(api.updateOpenPoint).toHaveBeenCalledWith('p-1', 'c', { state: 'dropped' }),
    )
  })

  it('changes a point, adds one by hand, and shows what was closed with the way back', async () => {
    const { api, region } = await show(brief())
    fireEvent.click(screen.getByRole('button', { name: `${text.points.edit}: Punto c` }))
    const form = screen.getByRole('form', { name: text.points.editTitle('Punto c') })
    fireEvent.change(within(form).getByLabelText(text.points.ownerLabel), {
      target: { value: 'Bianchi' },
    })
    fireEvent.change(within(form).getByLabelText(text.points.dueLabel), {
      target: { value: '2026-11-19' },
    })
    fireEvent.click(within(form).getByRole('button', { name: text.points.save }))
    await waitFor(() =>
      expect(api.updateOpenPoint).toHaveBeenCalledWith('p-1', 'c', {
        title: 'Punto c',
        owner: 'Bianchi',
        due: '2026-11-19',
      }),
    )
    // Changing one's mind leaves the point as it was.
    fireEvent.click(screen.getByRole('button', { name: `${text.points.edit}: Punto b` }))
    fireEvent.click(screen.getByRole('button', { name: text.points.cancel }))
    expect(screen.queryByRole('form', { name: text.points.editTitle('Punto b') })).toBeNull()

    const add = screen.getByRole('form', { name: text.points.addTitle })
    const button = within(add).getByRole('button', { name: text.points.add }) as HTMLButtonElement
    expect(button.disabled).toBe(true)
    fireEvent.change(within(add).getByLabelText(text.points.titleLabel), {
      target: { value: 'Verbale del collaudo' },
    })
    fireEvent.click(button)
    await waitFor(() =>
      expect(api.addOpenPoint).toHaveBeenCalledWith('p-1', {
        title: 'Verbale del collaudo',
        owner: '',
        due: null,
      }),
    )

    fireEvent.click(screen.getByRole('button', { name: text.points.closedButton(1, '13/11/2026') }))
    const closed = screen.getByRole('list', { name: text.points.closedList })
    expect(closed.textContent).toContain(
      'chiuso il 13/11/2026 · da quanto detto in riunione · «confermata a 12 giorni»',
    )
    fireEvent.click(within(closed).getByRole('button', { name: /^Fonte/ }))
    await waitFor(() => expect(api.openEvidence).toHaveBeenCalledTimes(1))
    fireEvent.click(
      screen.getByRole('button', { name: `${text.points.reopen}: Stima della migrazione` }),
    )
    await waitFor(() =>
      expect(api.updateOpenPoint).toHaveBeenCalledWith('p-1', 'z', { state: 'open' }),
    )
    // The brief folds to its first line.
    fireEvent.click(within(region).getByRole('button', { name: text.points.fold }))
    expect(screen.queryByRole('list', { name: text.points.list })).toBeNull()
    expect(within(region).getByRole('button', { name: text.points.unfold })).toBeTruthy()
  })

  it('asks the PM about what waits for a word, shows the first points only, and says a failure', async () => {
    const many = Array.from({ length: 9 }, (_, index) => queued(`p${index}`))
    const waiting = point('w', {
      check: {
        day: '2026-11-16',
        why: 'not_recorded',
        text: 'SAL non registrato: risolto?',
        meeting: 'SAL',
      },
    })
    const updateOpenPoint = vi.fn(async () => ({
      ok: false as const,
      code: 'open_point_invalid' as const,
    }))
    const { api } = todayApi(
      view({ points: brief({ queued: many, closed: [], toConfirm: [waiting] }) }),
      {
        updateOpenPoint,
      },
    )
    render(<TodayView api={api} project={aurora} canJudge onOpenSection={() => {}} />)
    const checks = await screen.findByRole('list', { name: text.points.toConfirm })
    expect(checks.textContent).toContain('«SAL» del 16/11/2026 non è stata registrata')
    fireEvent.click(within(checks).getByRole('button', { name: `${text.points.resolve}: Punto w` }))
    await waitFor(() => expect(api.confirmOpenPoint).toHaveBeenCalledWith('p-1', 'w', true))
    fireEvent.click(within(checks).getByRole('button', { name: `${text.points.stays}: Punto w` }))
    await waitFor(() => expect(api.confirmOpenPoint).toHaveBeenCalledWith('p-1', 'w', false))

    const list = screen.getByRole('list', { name: text.points.list })
    expect(within(list).getAllByRole('listitem')).toHaveLength(4)
    fireEvent.click(screen.getByRole('button', { name: text.points.more(5) }))
    expect(within(list).getAllByRole('listitem')).toHaveLength(9)
    fireEvent.click(screen.getByRole('button', { name: text.points.fewer }))
    expect(within(list).getAllByRole('listitem')).toHaveLength(4)
    fireEvent.click(screen.getByRole('button', { name: `${text.points.resolve}: Punto p0` }))
    expect(await screen.findByText(errorText('open_point_invalid'))).toBeTruthy()
  })

  it('says which meetings wait to be read, reads them by itself once, and when the PM asks', async () => {
    const waiting = {
      unread: 2,
      key: 'm-1 m-2',
      at: '2026-11-13T17:00:00.000Z',
      model: 'claude-fake',
    }
    const { api, changed } = todayApi(view({ points: brief(), closing: waiting }))
    render(<TodayView api={api} project={aurora} canJudge onOpenSection={() => {}} />)
    const region = await screen.findByRole('region', { name: text.points.title })
    expect(region.textContent).toContain('2 riunioni registrate da leggere · Riunioni lette il ')
    expect(region.textContent).toContain('(claude-fake)')
    // Nothing else is to ask Claude: the meetings are read alone, once for the same wait.
    await waitFor(() => expect(api.closeToday).toHaveBeenCalledTimes(1))
    expect(api.evaluateToday).not.toHaveBeenCalled()
    act(() => changed())
    await waitFor(() => expect(api.todayView).toHaveBeenCalledTimes(2))
    expect(api.closeToday).toHaveBeenCalledTimes(1)
    fireEvent.click(await screen.findByRole('button', { name: text.points.closeDay }))
    await waitFor(() => expect(api.closeToday).toHaveBeenCalledTimes(2))
  })

  it('reads the meetings with the evaluation of the day, not a second time', async () => {
    const waiting = { unread: 1, key: 'm-1', at: null, model: null }
    const { api } = todayApi(view({ points: brief(), closing: waiting, evaluationDue: true }))
    render(<TodayView api={api} project={aurora} canJudge onOpenSection={() => {}} />)
    const region = await screen.findByRole('region', { name: text.points.title })
    expect(region.textContent).toContain(
      `1 riunione registrata da leggere · ${text.points.neverClosed}`,
    )
    await waitFor(() => expect(api.evaluateToday).toHaveBeenCalledTimes(1))
    expect(api.closeToday).not.toHaveBeenCalled()
  })

  it('reads no meeting without Claude, and says what a point waits for in words', async () => {
    const doubt = point('d', {
      check: { day: '2026-11-16', why: 'unverified', text: 'Sembra fatto.', meeting: 'SAL' },
    })
    const bare = point('e', {
      check: { day: '2026-11-16', why: 'unverified', text: 'Sembra fatto.', meeting: null },
    })
    const missed = point('m', {
      check: { day: '2026-11-16', why: 'not_recorded', text: '', meeting: 'Stand-up' },
    })
    const waiting = { unread: 1, key: 'm-1', at: '2026-11-13T17:00:00.000Z', model: null }
    const { api } = todayApi(
      view({ points: brief({ toConfirm: [doubt, bare, missed] }), closing: waiting }),
    )
    render(<TodayView api={api} project={aurora} canJudge={false} onOpenSection={() => {}} />)
    const checks = await screen.findByRole('list', { name: text.points.toConfirm })
    expect(checks.textContent).toContain(
      'Claude lo legge chiuso in «SAL», ma la frase non è nel file: Sembra fatto.',
    )
    expect(checks.textContent).toContain('Claude lo legge chiuso, ma la frase non è nel file')
    expect(checks.textContent).toContain(
      '«Stand-up» del 16/11/2026 non è stata registrata: lì è stato risolto, o resta in coda?',
    )
    expect(screen.queryByRole('button', { name: text.points.closeDay })).toBeNull()
    expect(api.closeToday).not.toHaveBeenCalled()
  })

  it('opens a point from a signal of the page, once', async () => {
    const { api, region } = await show(brief({ queued: [], closed: [] }), [mail])
    expect(region.textContent).toContain(text.points.none)
    fireEvent.click(await screen.findByRole('button', { name: text.points.fromSignal }))
    await waitFor(() =>
      expect(api.addOpenPoint).toHaveBeenCalledWith('p-1', {
        title: signalText(mail).title,
        signal: { key: mail.key, kind: 'mail_reply' },
      }),
    )
    cleanup()
    await show(brief({ queued: [queued('s', {}, { signalKey: mail.key })], closed: [] }), [mail])
    await screen.findByRole('region', { name: text.detailTitle })
    expect(screen.queryByRole('button', { name: text.points.fromSignal })).toBeNull()
  })
})

describe('the critical things of the week', () => {
  const entry = (
    key: string,
    side: WeekEntry['side'],
    what: WeekEntry['what'],
    more = {},
  ): WeekEntry => ({
    key,
    side,
    what,
    day: null,
    overdueDays: 0,
    ...more,
  })
  const openRisk = {
    id: 'r1',
    title: 'Ambiente non pronto',
    since: '2026-11-10',
    state: 'open' as const,
    source: null,
    note: 'Lo segue Luca',
    due: null,
    severity: 'alta' as const,
  }
  const pointOf = (title: string, owner: string, due: string | null) => ({
    point: { id: title, title, owner, due, history: [], check: null } as unknown as OpenPoint,
    fresh: false,
    overdueDays: 0,
    openWorkdays: 7,
    raiseAt: null,
  })

  it('tells apart what is to put right now and what the week brings, by day', async () => {
    const riskSignal = item('risk:r1', 'watch', {
      kind: 'risk',
      id: 'r1',
      title: 'x',
      since: '2026-11-10',
    })
    const week = {
      until: '2026-11-22',
      ongoing: [
        entry(
          'point:a',
          'ongoing',
          { kind: 'point', entry: pointOf('Verbale', 'Rossi', '2026-11-13') },
          {
            day: '2026-11-13',
            overdueDays: 3,
          },
        ),
        entry('point:b', 'ongoing', { kind: 'point', entry: pointOf('Vecchio', '', null) }),
        entry('risk:r1', 'ongoing', { kind: 'risk', risk: openRisk }),
        entry('signal:bugs-stuck', 'ongoing', { kind: 'signal', item: bugs }),
      ],
      coming: [
        entry(
          'risk:r2',
          'coming',
          { kind: 'risk', risk: { ...openRisk, id: 'r2', severity: null, note: '' } },
          {
            day: '2026-11-18',
          },
        ),
        entry('sprint-end', 'coming', { kind: 'sprint_end' }, { day: '2026-11-19' }),
        entry('signal:hours', 'coming', { kind: 'signal', item: hours }),
      ],
    }
    const opened: string[] = []
    const { api } = todayApi(view({ week, items: [bugs, riskSignal, risk] }))
    render(
      <TodayView
        api={api}
        project={aurora}
        canJudge
        onOpenSection={(section) => opened.push(section)}
        onOpenBugs={(filter) => opened.push(`bugs:${filter}`)}
      />,
    )
    const region = await screen.findByRole('region', { name: text.week.title })
    expect(region.textContent).toContain('fino al 22/11/2026')
    const [late, old, critical, stuck] = within(
      within(region).getByRole('list', { name: text.week.ongoing }),
    ).getAllByRole('listitem') as HTMLElement[]
    expect(late?.textContent).toContain('scaduto da 3 giorni')
    expect(late?.textContent).toContain('Open point Verbale')
    expect(late?.textContent).toContain('di Rossi')
    expect(old?.textContent).toContain('adesso')
    expect(old?.textContent).toContain('tuo · aperto da 7 giorni lavorativi')
    expect(critical?.textContent).toContain('Rischio · gravità alta')
    expect(critical?.textContent).toContain('Lo segue Luca')
    expect(stuck?.textContent).toContain(signalText(bugs).title)
    const [dated, sprint, month] = within(
      within(region).getByRole('list', { name: text.week.coming }),
    ).getAllByRole('listitem') as HTMLElement[]
    expect(dated?.textContent).toContain('mer 18/11')
    expect(dated?.textContent).toContain('Rischio Ambiente non pronto')
    expect(sprint?.textContent).toContain('gio 19/11')
    expect(sprint?.textContent).toContain(text.week.sprintEnd)
    expect(month?.textContent).toContain(text.week.thisWeek)
    // What the week tells is not told again among what is only watched: the candidates stay.
    const watched = screen.getByRole('table', { name: text.watch })
    expect(watched.textContent).not.toContain(signalText(bugs).title)
    expect(watched.textContent).toContain(signalText(risk).title)

    fireEvent.click(within(stuck as HTMLElement).getByRole('button'))
    fireEvent.click(within(month as HTMLElement).getByRole('button'))
    expect(opened).toEqual(['bugs:stuck', 'hours'])
    fireEvent.click(within(critical as HTMLElement).getByRole('button'))
    expect(await screen.findByText(messages.risks.intro)).toBeTruthy()
  })

  it('says a side with nothing, and is not shown with nothing at all', async () => {
    const week = {
      until: '2026-11-22',
      ongoing: [],
      coming: [entry('sprint-end', 'coming', { kind: 'sprint_end' }, { day: '2026-11-19' })],
    }
    const { api } = todayApi(view({ week }))
    const { unmount } = render(
      <TodayView api={api} project={aurora} canJudge onOpenSection={() => {}} />,
    )
    const region = await screen.findByRole('region', { name: text.week.title })
    expect(region.textContent).toContain(text.week.noneOngoing)
    unmount()
    const coming = {
      ...week,
      ongoing: week.coming.map((kept) => ({ ...kept, side: 'ongoing' as const })),
      coming: [],
    }
    render(
      <TodayView
        api={todayApi(view({ week: coming })).api}
        project={aurora}
        canJudge
        onOpenSection={() => {}}
      />,
    )
    expect((await screen.findByRole('region', { name: text.week.title })).textContent).toContain(
      text.week.noneComing,
    )
    cleanup()
    render(<TodayView api={todayApi().api} project={aurora} canJudge onOpenSection={() => {}} />)
    await screen.findByRole('alert')
    expect(screen.queryByRole('region', { name: text.week.title })).toBeNull()
  })
})

describe('the meetings of the day', () => {
  const held = (uid: string, start: string, more: Partial<DayMeeting> = {}): DayMeeting => ({
    uid,
    subject: uid,
    start,
    end: null,
    location: '',
    attendees: [],
    repeats: false,
    path: `Posta/${uid}.md`,
    sentAt: '2026-11-10T09:00:00.000Z',
    ...more,
  })
  const sal = held('SAL', '2026-11-16T09:00:00.000Z', {
    end: '2026-11-16T10:00:00.000Z',
    location: 'Teams',
    repeats: true,
    attendees: [
      'Carla Bianchi <carla@cliente.example>',
      'a@x.example',
      'b@x.example',
      'c@x.example',
      'd@x.example',
    ],
  })
  const review = held('Collaudo', '2099-11-16T14:00:00.000Z', { attendees: ['a', 'b', 'c', 'd'] })

  it('lists them in the order they are held, apart from what is to do, with who is there', async () => {
    const meeting = item('meeting:Collaudo', 'due', {
      kind: 'meeting',
      subject: 'Collaudo',
      start: review.start,
      location: '',
      path: review.path,
    })
    const agenda = {
      today: [sal, review],
      next: { day: '2026-11-17', meetings: [held('Riesame', '2026-11-17T08:30:00.000Z')] },
    }
    const { api } = todayApi(view({ agenda, items: [meeting, mail] }))
    render(<TodayView api={api} project={aurora} canJudge onOpenSection={() => {}} />)

    const list = await screen.findByRole('list', { name: text.agenda.list })
    const [first, second] = within(list).getAllByRole('listitem') as [HTMLElement, HTMLElement]
    expect(first.textContent).toContain('10:00–11:00')
    expect(first.textContent).toContain(text.agenda.repeats)
    // Held hours ago: said so. Who is there by name, the others counted.
    expect(first.textContent).toContain(text.agenda.over)
    expect(first.textContent).toContain(
      'Teams · Carla Bianchi, a@x.example, b@x.example e altre 2 persone',
    )
    expect(second.textContent).toContain('a, b, c e un’altra persona')
    expect(second.textContent).not.toContain(text.agenda.over)
    expect(screen.getByText(/Prossimo giorno \(17\/11\/2026\): 09:30 Riesame/)).toBeTruthy()
    // A meeting is told in the agenda, not again among what is to do.
    expect(
      within(screen.getByRole('list', { name: text.list })).getAllByRole('button'),
    ).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: `${text.agenda.openInvite}: SAL` }))
    await waitFor(() => expect(api.openEvidence).toHaveBeenCalledWith('p-1', 'Posta/SAL.md'))
  })

  const KEY = 'meeting:Collaudo:2099-11-16T14:00:00.000Z'
  const folder = '_octo/riunioni/2026-11-09_collaudo'
  const pointOf = (title: string, more: object = {}) =>
    ({ id: title, title, owner: '', due: null, ...more }) as unknown as OpenPoint
  const card = (more: Partial<MeetingPrep> = {}): MeetingPrep => ({
    key: KEY,
    points: [
      {
        point: pointOf('Data del collaudo', { owner: 'Rossi', due: '2026-11-20' }),
        fresh: false,
        overdueDays: 2,
        openWorkdays: 4,
        raiseAt: null,
      },
    ],
    last: {
      title: 'Collaudo di Aurora',
      started: '2026-11-09T14:00:00.000Z',
      folder,
      file: `${folder}/report.md`,
      opened: [pointOf('Ambiente di prova')],
      closed: [pointOf('Stima')],
    },
    mails: [mail],
    numbers: [bugs],
    bring: [
      {
        key: KEY,
        text: 'Chiedi la data dell’ambiente.',
        path: `${folder}/report.md`,
        quote: 'Ambiente di prova entro venerdì',
        verified: true,
      },
    ],
    ...more,
  })
  const withCard = (prep: MeetingPrep[], today: DayMeeting[] = [sal, review]) =>
    view({ agenda: { today, next: { day: '2026-11-17', meetings: [] } }, prep, items: [mail] })

  it('opens the card of the next meeting: what to bring, the last time, the mail, the numbers', async () => {
    const writeText = vi.fn(async () => {})
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })
    const { api } = todayApi(withCard([card()]))
    render(<TodayView api={api} project={aurora} canJudge onOpenSection={() => {}} />)
    // The meeting still to come is prepared without a click; the one over is a click away.
    const region = await screen.findByRole('region', { name: text.prep.title('Collaudo') })
    expect(screen.getByRole('button', { name: `${text.agenda.card}: Collaudo` }).textContent).toBe(
      '4 cose da portare',
    )
    expect(screen.getByRole('button', { name: `${text.agenda.card}: SAL` }).textContent).toBe(
      text.agenda.card,
    )
    const toBring = within(region).getByRole('list', { name: `${text.prep.points}: Collaudo` })
    expect(toBring.textContent).toContain(text.points.late)
    expect(toBring.textContent).toContain(
      'Data del collaudo di Rossi · aperto da 4 giorni lavorativi · entro il 20/11/2026',
    )
    expect(region.textContent).toContain('Collaudo di Aurora, registrata il 09/11/2026')
    const left = within(region).getByRole('list', { name: `${text.prep.last}: Collaudo` })
    expect(left.textContent).toContain('Nato lì e ancora aperto: Ambiente di prova')
    expect(left.textContent).toContain('Chiuso lì: Stima')
    expect(
      within(region).getByRole('list', { name: `${text.prep.mails}: Collaudo` }).textContent,
    ).toContain(signalText(mail).title)
    expect(
      within(region).getByRole('list', { name: `${text.prep.numbers}: Collaudo` }).textContent,
    ).toContain(signalText(bugs).title)
    const notes = within(region).getByRole('list', { name: `${text.prep.bring}: Collaudo` })
    expect(notes.textContent).toContain('Chiedi la data dell’ambiente.')

    fireEvent.click(within(region).getByRole('button', { name: `${text.prep.openLast}: Collaudo` }))
    await waitFor(() => expect(api.openEvidence).toHaveBeenCalledWith('p-1', `${folder}/report.md`))
    fireEvent.click(within(notes).getByRole('button'))
    await waitFor(() => expect(api.openEvidence).toHaveBeenCalledTimes(2))
    fireEvent.click(within(region).getByRole('button', { name: /^Apri la mail/ }))
    await waitFor(() => expect(api.openEvidence).toHaveBeenCalledTimes(3))

    fireEvent.click(within(region).getByRole('button', { name: text.prep.copy }))
    expect(await within(region).findByRole('button', { name: text.prep.copied })).toBeTruthy()
    expect(writeText).toHaveBeenCalledWith(prepText(review, card()))
    expect(prepText(review, card())).toBe(
      [
        '15:00 · Collaudo',
        'a, b, c, d',
        '',
        `${text.prep.points}:`,
        '- Data del collaudo (Rossi)',
        '',
        `${text.prep.last}:`,
        '- Collaudo di Aurora, registrata il 09/11/2026',
        '- Nato lì e ancora aperto: Ambiente di prova',
        '- Chiuso lì: Stima',
        '',
        `${text.prep.mails}:`,
        `- ${signalText(mail).title}`,
        '',
        `${text.prep.numbers}:`,
        `- ${signalText(bugs).title}`,
        '',
        `${text.prep.bring}:`,
        '- Chiedi la data dell’ambiente.',
      ].join('\n'),
    )
    // The card closes, and another opens in its place.
    fireEvent.click(screen.getByRole('button', { name: `${text.agenda.card}: Collaudo` }))
    expect(screen.queryByRole('region', { name: text.prep.title('Collaudo') })).toBeNull()
    vi.unstubAllGlobals()
  })

  it('says a meeting with nothing to bring, one whose points are the PM’s, and when Claude works', async () => {
    const bare = card({ points: [], last: null, mails: [], numbers: [], bring: [] })
    const mine = card({
      key: 'meeting:SAL:2026-11-16T09:00:00.000Z',
      points: [
        { point: pointOf('Verbale'), fresh: false, overdueDays: 0, openWorkdays: 1, raiseAt: null },
      ],
      last: {
        ...(card().last as NonNullable<MeetingPrep['last']>),
        file: null,
        opened: [],
        closed: [],
      },
      mails: [],
      numbers: [],
      bring: [],
    })
    let release: (value: Result<View>) => void = () => {}
    const page = { ...withCard([mine, bare]), evaluationDue: true }
    const { api } = todayApi(page, {
      evaluateToday: vi.fn(
        () =>
          new Promise<Result<View>>((resolve) => {
            release = resolve
          }),
      ),
    })
    render(<TodayView api={api} project={aurora} canJudge onOpenSection={() => {}} />)
    const empty = await screen.findByRole('region', { name: text.prep.title('Collaudo') })
    expect(empty.textContent).toContain(text.prep.empty)
    expect(within(empty).queryByRole('button', { name: text.prep.copy })).toBeNull()
    expect(screen.getByRole('button', { name: `${text.agenda.card}: Collaudo` }).textContent).toBe(
      text.prep.nothing,
    )
    // While Claude works the card says what may still come.
    expect(await within(empty).findByText(text.prep.preparing)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: `${text.agenda.card}: SAL` }))
    const own = screen.getByRole('region', { name: text.prep.title('SAL') })
    expect(own.textContent).toContain('Verbale tuo · aperto da 1 giorno lavorativo')
    expect(within(own).queryByRole('button', { name: `${text.prep.openLast}: SAL` })).toBeNull()
    expect(prepText(sal, mine)).not.toContain(text.prep.mails)
    expect(prepText({ ...sal, attendees: [] }, bare)).toBe('10:00 · SAL')
    await act(async () => release(ok(page)))
  })

  it('says a day without meetings when only the next has some, and nothing with none', async () => {
    const next = { day: '2026-11-17', meetings: [held('Riesame', '2026-11-17T08:30:00.000Z')] }
    const { api } = todayApi(view({ agenda: { today: [], next } }))
    const { unmount } = render(
      <TodayView api={api} project={aurora} canJudge onOpenSection={() => {}} />,
    )
    expect((await screen.findByRole('region', { name: text.agenda.title })).textContent).toContain(
      'nessuna',
    )
    expect(screen.queryByRole('list', { name: text.agenda.list })).toBeNull()
    unmount()
    render(<TodayView api={todayApi().api} project={aurora} canJudge onOpenSection={() => {}} />)
    await screen.findByRole('alert')
    expect(screen.queryByRole('region', { name: text.agenda.title })).toBeNull()
  })
})

describe('the page of the day', () => {
  it('shows what is due, where it comes from, why it is here and what Claude judged', async () => {
    const { api } = todayApi()
    const opened: string[] = []
    render(<TodayView api={api} project={aurora} canJudge onOpenSection={(s) => opened.push(s)} />)

    // A source that is not read is a warning above everything else.
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Jira: non si legge da 3 giorni')
    // A source that is a warning is not said a second time among how fresh the others are.
    expect(screen.getByText(/^Posta: [^·]*$/)).toBeTruthy()

    const list = screen.getByRole('list', { name: text.list })
    const [first, second] = within(list).getAllByRole('button') as [HTMLElement, HTMLElement]
    const detail = screen.getByRole('region', { name: text.detailTitle })
    // The list says what each thing is and where it comes from; the first one is in view.
    expect(first.textContent).toContain('Ottobre 2026: le ore di 3 persone non tornano')
    expect(first.textContent).toContain(text.kinds.hours)
    expect(first.textContent).toContain(text.dueShort.month_end)
    expect(first.getAttribute('aria-pressed')).toBe('true')
    // The hours: computed, with the people, the reason of the day and why they came back.
    expect(detail.textContent).toContain('Bianchi Anna: 160 ore di timesheet, 80 sul tracker')
    expect(detail.textContent).toContain('Neri Sara: 80 ore di timesheet, nessuna sul tracker')
    expect(detail.textContent).toContain('Ugo Gialli: 120 ore sul tracker, nessun timesheet')
    expect(detail.textContent).toContain('1 possibile doppione')
    expect(detail.textContent).toContain(text.because.month_end)
    expect(detail.textContent).toContain(text.returned.worse(2, 3))
    expect(screen.getByText(/Valutazione di Claude del .* \(claude-fake\)/)).toBeTruthy()

    // Each signal leads to where it is put right.
    fireEvent.click(within(detail).getByRole('button', { name: text.open.hours }))
    fireEvent.click(within(alert.parentElement as HTMLElement).getByRole('button'))
    expect(opened).toEqual(['hours', 'sources'])
    // The mail: that it waits is computed; how much it matters is Claude's, with its source.
    expect(second.textContent).toContain('Rispondi a Carla Bianchi · «Aurora: budget»')
    expect(second.textContent).toContain('importanza alta')
    fireEvent.click(second)
    expect(second.getAttribute('aria-pressed')).toBe('true')
    expect(first.getAttribute('aria-pressed')).toBe('false')
    expect(detail.textContent).toContain('«ha approvato un budget aggiuntivo»')
    expect(detail.textContent).toContain(text.judgement.verified)
    fireEvent.click(within(detail).getByRole('button', { name: text.open.mail }))
    expect(api.openEvidence).toHaveBeenCalledWith('p-1', 'Posta/2026-11/budget.md')
    expect(screen.getByText('6 bug fermi da più di 30 giorni')).toBeTruthy()
  })

  it('tells first what comes first now, with the rule that says why, and once only', async () => {
    const { api } = todayApi(view({ now: [{ item: hours, rule: 'due' }] }))
    render(<TodayView api={api} project={aurora} canJudge onOpenSection={() => {}} />)
    const first = await screen.findByRole('list', { name: text.nowList })
    const [row] = within(first).getAllByRole('button') as [HTMLElement]
    expect(row.textContent).toContain(text.nowWhy.due.month_end)
    expect(row.textContent).toContain('Ottobre 2026: le ore di 3 persone non tornano')
    // It is the one in view, with everything that can be done about it.
    expect(row.getAttribute('aria-pressed')).toBe('true')
    const detail = screen.getByRole('region', { name: text.detailTitle })
    expect(within(detail).getByRole('button', { name: text.done })).toBeTruthy()
    // The list below goes on without it.
    const list = screen.getByRole('list', { name: text.list })
    expect(list.textContent).not.toContain('Ottobre 2026')
    expect(list.textContent).toContain('Rispondi a Carla Bianchi')
    fireEvent.click(within(list).getByText(/Rispondi a Carla Bianchi/))
    expect(row.getAttribute('aria-pressed')).toBe('false')
  })

  it('says each rule of what comes first in the words of a PM', () => {
    const entry = (rule: Parameters<typeof nowText>[0]['rule'], minutes?: number) =>
      nowText({ item: mail, rule, ...(minutes === undefined ? {} : { minutes }) })
    expect(entry('meeting_soon', 40)).toBe('Fra 40 minuti')
    expect(entry('meeting_soon', 1)).toBe('Fra 1 minuto')
    expect(entry('meeting_soon', 60)).toBe('Fra 1 ora')
    expect(entry('meeting_soon', 120)).toBe('Fra 2 ore')
    expect(entry('meeting_soon', 95)).toBe('Fra 1 ora e 35 minuti')
    expect(entry('due')).toBe(text.nowWhy.due.deadline)
    expect(entry('later')).toBe(text.nowWhy.later)
    expect(entry('important_mail')).toBe(text.nowWhy.importantMail)
    expect(entry('worse')).toBe(text.nowWhy.worse)
  })

  it('shows what comes first also when nothing else is to do', async () => {
    const { api } = todayApi(view({ items: [hours], now: [{ item: hours, rule: 'due' }] }))
    render(<TodayView api={api} project={aurora} canJudge onOpenSection={() => {}} />)
    expect(await screen.findByRole('list', { name: text.nowList })).toBeTruthy()
    expect(screen.getByText(text.nothingElse)).toBeTruthy()
  })

  it('lists what was put away with its state, and takes it back with one click', async () => {
    const { api } = todayApi(
      view({
        items: [mail],
        hiddenItems: [
          { item: hours, state: 'later', at: '2026-11-13', until: '2026-11-20' },
          { item: bugs, state: 'done', at: '2026-11-12', until: null },
          { item: risk, state: 'muted', at: '2026-11-10', until: null },
        ],
        mutedKinds: ['meeting'],
        resolvedToday: ['draft', 'draft', 'hours'],
      }),
    )
    render(<TodayView api={api} project={aurora} canJudge onOpenSection={() => {}} />)
    // What the page closed without the PM is said, by kind.
    expect(
      await screen.findByText(text.resolvedToday(3, `${text.kinds.draft}, ${text.kinds.hours}`)),
    ).toBeTruthy()
    // The list is closed until it is asked for.
    const toggle = screen.getByRole('button', { name: text.hiddenButton(3) })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('region', { name: text.hiddenTitle })).toBeNull()
    fireEvent.click(toggle)
    const hidden = screen.getByRole('region', { name: text.hiddenTitle })
    expect(hidden.textContent).toContain(text.hiddenStates.later('20/11/2026'))
    expect(hidden.textContent).toContain('13/11/2026')
    expect(hidden.textContent).toContain(text.hiddenStates.done)
    expect(hidden.textContent).toContain(text.hiddenStates.muted)
    // The kinds not shown at all are shown again from here too.
    fireEvent.click(
      within(hidden).getByRole('button', { name: `${text.unmute}: ${text.kinds.meeting}` }),
    )
    expect(api.muteTodayKind).toHaveBeenCalledWith('p-1', 'meeting', false)
    fireEvent.click(
      within(hidden).getByRole('button', {
        name: `${text.restore}: 6 bug fermi da più di 30 giorni`,
      }),
    )
    await waitFor(() =>
      expect(api.decideToday).toHaveBeenCalledWith('p-1', 'bugs-stuck', 'open', null),
    )
  })

  it('shows only the kinds not shown when no signal is put away', async () => {
    const { api } = todayApi(view({ mutedKinds: ['meeting'] }))
    render(<TodayView api={api} project={aurora} canJudge onOpenSection={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: text.hiddenButton(0) }))
    const hidden = screen.getByRole('region', { name: text.hiddenTitle })
    expect(hidden.textContent).toContain(text.hiddenNone)
    expect(hidden.textContent).toContain(text.kinds.meeting)
    expect(text.hiddenStates.later(null)).toBe('Rimandato')
  })

  it('puts off until the end of the sprint or until a day the PM writes', async () => {
    const { api } = todayApi(view({ sprintEnd: '2026-11-27' }))
    render(<TodayView api={api} project={aurora} canJudge onOpenSection={() => {}} />)
    const detail = await screen.findByRole('region', { name: text.detailTitle })
    fireEvent.click(within(detail).getByRole('button', { name: text.later }))
    fireEvent.click(within(detail).getByRole('button', { name: text.laterSprintEnd('27/11/2026') }))
    await waitFor(() =>
      expect(api.decideToday).toHaveBeenCalledWith('p-1', 'hours:2026-10', 'later', '2026-11-27'),
    )
  })

  it('refuses a day that is not after today, and takes one that is', async () => {
    const { api } = todayApi()
    render(<TodayView api={api} project={aurora} canJudge onOpenSection={() => {}} />)
    const detail = await screen.findByRole('region', { name: text.detailTitle })
    fireEvent.click(within(detail).getByRole('button', { name: text.later }))
    // Without a sprint that is still to end, its day is not offered.
    expect(within(detail).queryByRole('button', { name: /A fine sprint/ })).toBeNull()
    const confirm = within(detail).getByRole('button', { name: text.laterDateConfirm })
    expect((confirm as HTMLButtonElement).disabled).toBe(true)
    const field = within(detail).getByLabelText(text.laterDate)
    fireEvent.change(field, { target: { value: '2026-11-16' } })
    expect((confirm as HTMLButtonElement).disabled).toBe(true)
    fireEvent.change(field, { target: { value: '2026-12-03' } })
    fireEvent.click(confirm)
    await waitFor(() =>
      expect(api.decideToday).toHaveBeenCalledWith('p-1', 'hours:2026-10', 'later', '2026-12-03'),
    )
  })

  it('shows why what comes first matters as Claude wrote it, with the way to its source', async () => {
    const { api } = todayApi(
      view({
        now: [{ item: mail, rule: 'important_mail' }],
        nowSummary: [
          {
            key: mail.key,
            text: 'Il cliente aspetta la conferma del budget.',
            path: 'Posta/2026-11/budget.md',
            quote: 'ha approvato un budget aggiuntivo',
            verified: true,
          },
        ],
      }),
    )
    render(<TodayView api={api} project={aurora} canJudge onOpenSection={() => {}} />)
    const summary = await screen.findByRole('region', { name: text.nowSummary })
    expect(summary.textContent).toContain('Il cliente aspetta la conferma del budget.')
    fireEvent.click(
      within(summary).getByRole('button', { name: `${text.nowSource}: Posta/2026-11/budget.md` }),
    )
    expect(api.openEvidence).toHaveBeenCalledWith('p-1', 'Posta/2026-11/budget.md')
  })

  it('says which mail Claude keeps away and why, apart, and takes it back as the PM’s', async () => {
    const { api } = todayApi(
      view({
        items: [bugs],
        hiddenItems: [
          { item: mail, state: 'claude', at: '2026-11-16', until: null },
          { item: hours, state: 'done', at: '2026-11-13', until: null },
        ],
      }),
    )
    render(<TodayView api={api} project={aurora} canJudge onOpenSection={() => {}} />)
    // What Claude took off the page is counted apart from what the PM put away.
    fireEvent.click(await screen.findByRole('button', { name: text.hiddenButton(1, 1) }))
    const hidden = screen.getByRole('region', { name: text.hiddenTitle })
    expect(hidden.textContent).toContain(text.hiddenStates.claude)
    expect(hidden.textContent).toContain('«ha approvato un budget aggiuntivo»')
    fireEvent.click(
      within(hidden).getByRole('button', { name: /Ripristina: Rispondi a Carla Bianchi/ }),
    )
    await waitFor(() => expect(api.setMailTurn).toHaveBeenCalledWith('p-1', mail.key, 'mine'))
    expect(api.decideToday).not.toHaveBeenCalled()
  })

  it('marks what is new or worse since the last look, and says the PM has looked', async () => {
    const counted: number[] = []
    const { api } = todayApi(
      view({
        now: [{ item: hours, rule: 'due' }],
        marks: { [hours.key]: 'worse', [mail.key]: 'new', [bugs.key]: 'new' },
        count: 2,
      }),
    )
    render(
      <TodayView
        api={api}
        project={aurora}
        canJudge
        onOpenSection={() => {}}
        onCount={(count) => counted.push(count)}
        visitAfterMs={0}
      />,
    )
    const first = await screen.findByRole('list', { name: text.nowList })
    expect(first.textContent).toContain(text.marks.worse)
    expect(screen.getByRole('list', { name: text.list }).textContent).toContain(text.marks.new)
    expect(screen.getByRole('table', { name: text.watch }).textContent).toContain(text.marks.new)
    // The page tells how much it asks, and that it stayed open long enough to be looked at.
    expect(counted).toEqual([2])
    await waitFor(() => expect(api.markTodaySeen).toHaveBeenCalledWith('p-1'))
  })

  it('says the PM has looked once, and again only when something is marked', async () => {
    const { api, changed } = todayApi()
    render(
      <TodayView api={api} project={aurora} canJudge onOpenSection={() => {}} visitAfterMs={0} />,
    )
    await waitFor(() => expect(api.markTodaySeen).toHaveBeenCalledTimes(1))
    // A reading ends and nothing is new: there is nothing more to have looked at.
    await act(async () => changed())
    await waitFor(() => expect(api.todayView).toHaveBeenCalledTimes(2))
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20))
    })
    expect(api.markTodaySeen).toHaveBeenCalledTimes(1)
  })

  it('says of many sources only the one read longest ago, and keeps each a pointer away', async () => {
    const { api } = todayApi(
      view({
        items: [bugs],
        freshness: [
          { source: 'Posta', readAt: '2026-11-16T15:57:00.000Z' },
          { source: 'Jira', readAt: '2026-11-16T14:40:00.000Z' },
          { source: 'Confluence', readAt: null },
        ],
      }),
    )
    render(<TodayView api={api} project={aurora} canJudge onOpenSection={() => {}} />)
    const line = await screen.findByText(text.freshnessOldest(3, 'Confluence', text.freshnessNever))
    expect(line.getAttribute('title')?.split('\n')).toHaveLength(3)
    expect(line.getAttribute('title')).toContain('Jira: ')
  })

  it('offers to stop showing several kinds in one notice, a button for each', async () => {
    const { api } = todayApi(view({ muteOffers: ['mail_reply', 'risk', 'mail_follow'] }))
    render(<TodayView api={api} project={aurora} canJudge onOpenSection={() => {}} />)
    expect(await screen.findByText(text.muteOffers)).toBeTruthy()
    expect(screen.queryByText(text.muteOffer(text.kinds.risk))).toBeNull()
    expect(screen.getAllByRole('button', { name: /^Non mostrare più: / })).toHaveLength(3)
    fireEvent.click(screen.getByRole('button', { name: text.muteKindNamed(text.kinds.risk) }))
    await waitFor(() => expect(api.muteTodayKind).toHaveBeenCalledWith('p-1', 'risk', true))
  })

  it('says when the sources are read next, in minutes', async () => {
    const soon = new Date(Date.now() + 12 * 60 * 1000 - 5000).toISOString()
    const { api } = todayApi(view(), { nextReading: vi.fn(async () => ok<string | null>(soon)) })
    render(<TodayView api={api} project={aurora} canJudge onOpenSection={() => {}} />)
    expect(await screen.findByText(new RegExp(`^${text.nextReading(12)} · Posta: `))).toBeTruthy()
    expect(text.nextReading(1)).toBe('Prossima lettura fra 1 minuto')
    expect(text.nextReading(0)).toBe('Prossima lettura fra poco')
  })

  it('remembers done, later and not interested, each with one gesture', async () => {
    const { api } = todayApi()
    render(<TodayView api={api} project={aurora} canJudge onOpenSection={() => {}} />)
    const detailOf = async (title: RegExp) => {
      fireEvent.click(within(await screen.findByRole('list', { name: text.list })).getByText(title))
      return screen.getByRole('region', { name: text.detailTitle })
    }
    const row = await detailOf(/Rispondi a Carla Bianchi/)

    fireEvent.click(within(row).getByRole('button', { name: text.later }))
    fireEvent.click(within(row).getByRole('button', { name: text.laterMonday }))
    await waitFor(() =>
      // The page is of a Monday: the Monday after is a week later.
      expect(api.decideToday).toHaveBeenCalledWith('p-1', 'mail:budget', 'later', '2026-11-23'),
    )
    await screen.findByText(text.nothingToDo)
    cleanup()

    const again = todayApi()
    render(<TodayView api={again.api} project={aurora} canJudge onOpenSection={() => {}} />)
    const mailRow = await detailOf(/Rispondi a Carla Bianchi/)
    fireEvent.click(within(mailRow).getByRole('button', { name: text.later }))
    fireEvent.click(within(mailRow).getByRole('button', { name: text.laterTomorrow }))
    await waitFor(() =>
      expect(again.api.decideToday).toHaveBeenCalledWith(
        'p-1',
        'mail:budget',
        'later',
        '2026-11-17',
      ),
    )
    cleanup()

    const third = todayApi()
    render(<TodayView api={third.api} project={aurora} canJudge onOpenSection={() => {}} />)
    const hoursRow = await detailOf(/le ore di 3 persone/)
    fireEvent.click(within(hoursRow).getByRole('button', { name: text.done }))
    await waitFor(() =>
      expect(third.api.decideToday).toHaveBeenCalledWith('p-1', 'hours:2026-10', 'done', null),
    )
    // What was put away comes back with one click.
    const undone = await screen.findByText(/^Segnata come fatta: Ottobre 2026/)
    fireEvent.click(
      within(undone.parentElement as HTMLElement).getByRole('button', { name: text.undo }),
    )
    await waitFor(() =>
      expect(third.api.decideToday).toHaveBeenCalledWith('p-1', 'hours:2026-10', 'open', null),
    )
    cleanup()

    const fourth = todayApi()
    render(<TodayView api={fourth.api} project={aurora} canJudge onOpenSection={() => {}} />)
    fireEvent.click(await screen.findByText(/Rispondi a Carla Bianchi/))
    fireEvent.click(screen.getByRole('button', { name: text.noAnswerNeeded }))
    await waitFor(() =>
      expect(fourth.api.decideToday).toHaveBeenCalledWith('p-1', 'mail:budget', 'muted', null),
    )
  })

  it('asks Claude once when something new waits, tells what it does and can be stopped', async () => {
    let finish: (result: Result<View>) => void = () => {}
    const waiting = view({
      items: [{ ...mail, facts: { ...mail.facts, judgement: null } as TodayItem['facts'] }],
      evaluation: { at: null, model: null },
      evaluationDue: true,
    })
    const { api, tell } = todayApi(waiting, {
      evaluateToday: vi.fn(() => new Promise<Result<View>>((resolve) => (finish = resolve))),
    })
    render(<TodayView api={api} project={aurora} canJudge onOpenSection={() => {}} />)
    expect(await screen.findByText(text.judgement.running)).toBeTruthy()
    expect(api.evaluateToday).toHaveBeenCalledWith('p-1', false)
    // While Claude weighs it, the mail says so instead of saying it has no judgement.
    expect(screen.getAllByText(new RegExp(text.judging)).length).toBeGreaterThan(0)
    act(() => tell({ kind: 'reading', target: 'Posta/2026-11/budget.md' }))
    expect(screen.getByText(/Posta\/2026-11\/budget.md/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: text.judgement.stop }))
    expect(api.cancelEvaluateToday).toHaveBeenCalledWith('p-1')
    // Stopped by the PM: the page says nothing went wrong.
    await act(async () => finish({ ok: false, code: 'agent_cancelled' }))
    expect(screen.queryByRole('alert')).toBeNull()
    expect(api.evaluateToday).toHaveBeenCalledTimes(1)
    expect(screen.getByText(`${text.judgement.title}: ${text.judgement.none}`)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: text.judgement.update }))
    expect(api.evaluateToday).toHaveBeenCalledTimes(2)
  })

  it('works without Claude, and says when Claude cannot judge', async () => {
    const noClaude = todayApi(view({ evaluationDue: true }))
    render(
      <TodayView api={noClaude.api} project={aurora} canJudge={false} onOpenSection={() => {}} />,
    )
    await screen.findByText(/Rispondi a Carla Bianchi/)
    expect(noClaude.api.evaluateToday).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: text.judgement.update })).toBeNull()
    cleanup()

    const limit = todayApi(view(), {
      evaluateToday: vi.fn(async () => ({
        ok: false as const,
        code: 'agent_limit_reached' as const,
      })),
    })
    render(<TodayView api={limit.api} project={aurora} canJudge onOpenSection={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: text.judgement.all }))
    await waitFor(() => expect(limit.api.evaluateToday).toHaveBeenCalledWith('p-1', true))
    expect((await screen.findAllByRole('alert')).length).toBeGreaterThan(1)
  })

  it('reads the sources again, follows a periodic reading and keeps the settings of the page', async () => {
    const offer = view({ muteOffers: ['bugs_stuck'], mutedKinds: ['meeting'] })
    const { api, changed } = todayApi(offer)
    const onOpenSettings = vi.fn()
    render(
      <TodayView
        api={api}
        project={aurora}
        canJudge
        onOpenSection={() => {}}
        onOpenSettings={onOpenSettings}
      />,
    )
    fireEvent.click(await screen.findByRole('button', { name: text.readNow }))
    await waitFor(() => expect(api.fill).toHaveBeenCalledWith('p-1'))
    await waitFor(() => expect(api.todayView).toHaveBeenCalledTimes(2))
    act(() => changed())
    await waitFor(() => expect(api.todayView).toHaveBeenCalledTimes(3))

    // A kind put away three times: Octo offers to stop showing it.
    expect(screen.getByText(text.muteOffer(text.kinds.bugs_stuck))).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: text.muteKind }))
    await waitFor(() => expect(api.muteTodayKind).toHaveBeenCalledWith('p-1', 'bugs_stuck', true))

    // What is set once for the page is kept with the settings of the project, one click away.
    expect(screen.queryByLabelText(text.addresses)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: text.settings }))
    expect(onOpenSettings).toHaveBeenCalledTimes(1)
    // A signal only watched is put away with its own small button.
    fireEvent.click(
      screen.getByRole('button', { name: `${text.mute}: 6 bug fermi da più di 30 giorni` }),
    )
    await waitFor(() =>
      expect(api.decideToday).toHaveBeenCalledWith('p-1', 'bugs-stuck', 'muted', null),
    )
  })

  it('says a day with nothing, shows only the first signals, and explains a failure', async () => {
    const empty = todayApi(view({ items: [], freshness: [], hidden: 0, ownAddresses: [] }))
    render(<TodayView api={empty.api} project={aurora} canJudge onOpenSection={() => {}} />)
    expect(await screen.findByText(text.nothing)).toBeTruthy()
    cleanup()

    const many = Array.from({ length: 9 }, (_, index) =>
      item(`draft:${index}`, 'waiting', {
        kind: 'draft',
        id: `d-${index}`,
        title: `Bozza ${index}`,
        status: 'review',
        days: index,
        fixFirst: false,
      }),
    )
    const full = todayApi(view({ items: many }))
    render(<TodayView api={full.api} project={aurora} canJudge onOpenSection={() => {}} />)
    await screen.findByText(text.toDoCount(7, 9))
    expect(screen.queryByText(/Bozza 8/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: text.more(2) }))
    expect(screen.getByText(/Bozza 8/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: text.fewer }))
    expect(screen.queryByText(/Bozza 8/)).toBeNull()
    cleanup()

    const broken = todayApi(view(), {
      todayView: vi.fn(async () => ({ ok: false as const, code: 'project_not_found' as const })),
    })
    render(<TodayView api={broken.api} project={aurora} canJudge onOpenSection={() => {}} />)
    expect(await screen.findByRole('alert')).toBeTruthy()
  })

  it('puts every kind of signal into words', () => {
    const words = (facts: TodayItem['facts']) => signalText(item('k', 'watch', facts))
    expect(
      words({ kind: 'source', source: 'Jira', reason: 'no_secret', days: null, error: null }).title,
    ).toContain('manca la credenziale')
    expect(
      words({ kind: 'source', source: 'Jira', reason: 'never', days: null, error: null }).title,
    ).toContain('mai letta')
    expect(
      words({ kind: 'source', source: 'Jira', reason: 'error', days: 0, error: 'feed_unreachable' })
        .detail,
    ).not.toBe('')
    expect(
      words({ kind: 'source', source: 'Jira', reason: 'error', days: 0, error: null }).detail,
    ).toBe('')
    expect(words({ kind: 'tracker_old', days: 1 }).title).toBe(
      'I dati del tracker sono di 1 giorno fa',
    )
    expect(
      words({
        kind: 'mail_waiting',
        id: 'x',
        path: '',
        to: 'luca@cliente.example',
        subject: 'Ambiente',
        days: 6,
      }).title,
    ).toBe('Aspetti una risposta da luca@cliente.example · «Ambiente»')
    expect(
      words({ kind: 'hours', month: '2026-10', people: [], tieOutOk: false, duplicates: 2 }),
    ).toEqual({
      title: 'Ottobre 2026: le ore non quadrano',
      detail: '2 possibili doppioni · la quadratura delle ore approvate non torna',
    })
    expect(
      words({
        kind: 'forecast',
        month: '2026-10',
        gaps: [
          { kind: 'no_cost', code: 'PRJ1', person: 'Rossi', hours: 1 },
          { kind: 'no_rate', code: 'PRJ1', person: 'Costa Elena', hours: 1, proposed: null },
          { kind: 'no_external_rate', code: 'PRJ1', person: 'Esterno', hours: 1 },
          { kind: 'no_total_costs', code: 'PRJ2' },
          { kind: 'no_ordered', code: 'PRJ3' },
        ],
      }),
    ).toEqual({
      title: 'Previsionale di ottobre 2026: 5 dati che mancano',
      detail:
        'Manca il costo di Rossi su PRJ1 · manca la tariffa di Costa Elena su PRJ1 · mancano costo e tariffa dell’esterno Esterno su PRJ1 · mancano i costi totali previsti di PRJ2 · manca l’ordinato di PRJ3',
    })
    expect(words({ kind: 'month_due', month: '2026-10', what: 'forecast' }).title).toContain(
      'non è ancora compilato',
    )
    expect(words({ kind: 'requirements', count: 7, ids: ['1', '2'] }).detail).toBe('Voci: 1, 2…')
    const draft = { kind: 'draft' as const, id: 'd', title: 'Stato', days: 1, fixFirst: true }
    expect(words({ ...draft, status: 'review' }).detail).toContain('da correggere prima')
    expect(words({ ...draft, status: 'review', fixFirst: false }).title).toBe(
      '«Stato» è in bozza da ieri',
    )
    expect(words({ ...draft, status: 'failed' }).title).toContain('non è riuscita')
    expect(
      words({
        kind: 'calendar',
        what: 'period_ends',
        name: 'Sprint 28',
        day: '2026-11-17',
        inDays: 1,
      }).title,
    ).toBe('Sprint 28 finisce domani')
    expect(
      words({
        kind: 'calendar',
        what: 'person_leaves',
        name: 'Neri Sara',
        day: '2026-11-20',
        inDays: 4,
      }).title,
    ).toBe('Neri Sara lascia il progetto fra 4 giorni')
    expect(
      words({
        kind: 'calendar',
        what: 'period_ends',
        name: 'Sprint 28',
        day: '2026-11-16',
        inDays: 0,
      }).title,
    ).toBe('Sprint 28 finisce oggi')
    expect(
      words({
        kind: 'meeting',
        subject: 'Collaudo',
        start: '2026-11-16T14:00:00.000Z',
        location: '',
        path: '',
      }),
    ).toEqual({
      title: 'Alle 15:00: Collaudo',
      detail: 'Dall’invito nella posta.',
    })
    expect(
      words({
        kind: 'meeting',
        subject: 'Collaudo',
        start: '2026-11-16T14:00:00.000Z',
        location: 'Sala 2',
        path: '',
      }).detail,
    ).toBe('Dove: Sala 2')
    const waiting = item('k', 'waiting', {
      kind: 'meeting_unassigned',
      id: 'm-1',
      title: 'Allineamento',
      start: '2026-11-13T14:00:00.000Z',
      minutes: 30,
      days: 3,
      elsewhere: null,
    })
    expect(signalText(waiting).title).toBe('«Allineamento» è registrata ma non ha un progetto')
    expect(signalText(waiting).detail).toContain('venerdì 13 novembre, 30 minuti')
    expect(signalText(waiting).detail).toContain('se è di questo, assegnala')
    // The people of the meeting are of another project: the PM is told before assigning it here.
    const others = item('k', 'waiting', {
      kind: 'meeting_unassigned',
      id: 'm-2',
      title: 'Daily',
      start: '2026-11-13T14:00:00.000Z',
      minutes: 15,
      days: 3,
      elsewhere: 'Borea',
    })
    expect(signalText(others).detail).toContain('i partecipanti sono persone del progetto «Borea»')
    expect(signalText(others).detail).not.toContain('se è di questo, assegnala')
    expect(ageText(waiting)).toBe('da 3 giorni')
    expect(
      words({ kind: 'risk', id: 'r', title: 'Consegna stretta', since: '2026-11-16' }).detail,
    ).toContain('16/11/2026')
    expect(words({ kind: 'risk_candidates', count: 1 }).title).toBe('1 rischio proposto da Claude')
    expect(personOf('"Carla Bianchi" <carla@cliente.example>')).toBe('Carla Bianchi')
    expect(personOf('<carla@cliente.example>')).toBe('carla@cliente.example')
  })
})

describe('the register of the risks', () => {
  const register: Register = {
    ...NO_RISKS,
    risks: [
      {
        id: 'r1',
        title: 'Ambiente di prova non disponibile',
        since: '2026-11-10',
        state: 'open',
        source: { path: 'wiki/stato.md', quote: 'ambiente non ancora pronto', verified: false },
        note: '',
        due: null,
        severity: null,
      },
      {
        id: 'r2',
        title: 'Rischio passato',
        since: '2026-10-01',
        state: 'closed',
        source: null,
        note: '',
        due: null,
        severity: null,
      },
    ],
    candidates: [
      {
        id: 'c1',
        title: 'Consegna a ridosso del collaudo',
        why: 'Restano pochi giorni.',
        source: { path: 'wiki/stato.md', quote: 'fissata al 12 dicembre 2026', verified: true },
      },
    ],
    proposedAt: '2026-11-16T09:00:00.000Z',
    proposedBy: 'claude-fake',
  }
  const words = messages.risks

  it('opens from the page of the day and comes back to it', async () => {
    const { api } = todayApi(view(), { risks: vi.fn(async () => ok(register)) })
    render(<TodayView api={api} project={aurora} canJudge onOpenSection={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: text.open.risks }))
    expect(await screen.findByRole('heading', { name: words.title })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: words.back }))
    expect(await screen.findByText(/Rispondi a Carla Bianchi/)).toBeTruthy()
  })

  it('takes in a proposal under the title the PM gives it, or turns it down', async () => {
    const { api } = todayApi(view(), { risks: vi.fn(async () => ok(register)) })
    render(<RiskRegister api={api} project={aurora} canJudge onBack={() => {}} />)
    const title = await screen.findByLabelText(words.titleLabel('Consegna a ridosso del collaudo'))
    expect(screen.getByText(/Proposti il .* \(claude-fake\)/)).toBeTruthy()
    expect(screen.getByText(words.verified)).toBeTruthy()
    expect(screen.getByText(words.unverified)).toBeTruthy()
    fireEvent.change(title, { target: { value: 'Consegna stretta' } })
    fireEvent.click(screen.getByRole('button', { name: words.accept }))
    await waitFor(() =>
      expect(api.acceptRisk).toHaveBeenCalledWith('p-1', 'c1', 'Consegna stretta'),
    )
    cleanup()

    const again = todayApi(view(), { risks: vi.fn(async () => ok(register)) })
    render(<RiskRegister api={again.api} project={aurora} canJudge onBack={() => {}} />)
    // The command is short; the path is under the pointer, and it is the one that is opened.
    const [source] = await screen.findAllByRole('button', { name: words.source })
    expect(source?.title).toBe('wiki/stato.md')
    fireEvent.click(source as HTMLElement)
    expect(again.api.openEvidence).toHaveBeenCalledWith('p-1', 'wiki/stato.md')
    fireEvent.click(await screen.findByRole('button', { name: words.dismiss }))
    await waitFor(() => expect(again.api.dismissRisk).toHaveBeenCalledWith('p-1', 'c1'))
  })

  it('keeps notes, closes and reopens a risk, adds one by hand and asks Claude for more', async () => {
    let finish: (result: Result<Register>) => void = () => {}
    const { api, tell } = todayApi(view(), {
      risks: vi.fn(async () => ok(register)),
      updateRisk: vi.fn(async () => ok(register)),
      addRisk: vi.fn(async () => ok(register)),
      proposeRisks: vi.fn(() => new Promise<Result<Register>>((resolve) => (finish = resolve))),
    })
    render(<RiskRegister api={api} project={aurora} canJudge onBack={() => {}} />)
    const note = await screen.findByLabelText(`${words.note}: Ambiente di prova non disponibile`)
    fireEvent.change(note, { target: { value: 'Lo segue il cliente' } })
    fireEvent.click(screen.getByRole('button', { name: words.saveNote }))
    await waitFor(() =>
      expect(api.updateRisk).toHaveBeenCalledWith('p-1', 'r1', { note: 'Lo segue il cliente' }),
    )
    fireEvent.click(screen.getByRole('button', { name: words.close }))
    await waitFor(() =>
      expect(api.updateRisk).toHaveBeenCalledWith('p-1', 'r1', { state: 'closed' }),
    )
    fireEvent.change(
      screen.getByLabelText(`${messages.risks.severity}: Ambiente di prova non disponibile`),
      { target: { value: 'alta' } },
    )
    await waitFor(() =>
      expect(api.updateRisk).toHaveBeenCalledWith('p-1', 'r1', { severity: 'alta' }),
    )
    fireEvent.change(
      screen.getByLabelText(`${messages.risks.severity}: Ambiente di prova non disponibile`),
      { target: { value: '' } },
    )
    await waitFor(() =>
      expect(api.updateRisk).toHaveBeenCalledWith('p-1', 'r1', { severity: null }),
    )
    const dueField = screen.getByLabelText(
      `${messages.risks.due}: Ambiente di prova non disponibile`,
    )
    fireEvent.change(dueField, { target: { value: '2026-11-20' } })
    await waitFor(() =>
      expect(api.updateRisk).toHaveBeenCalledWith('p-1', 'r1', { due: '2026-11-20' }),
    )
    fireEvent.click(screen.getByRole('button', { name: words.reopen }))
    await waitFor(() => expect(api.updateRisk).toHaveBeenCalledWith('p-1', 'r2', { state: 'open' }))

    fireEvent.change(screen.getByLabelText(words.addLabel), {
      target: { value: 'Ferie di dicembre' },
    })
    fireEvent.click(screen.getByRole('button', { name: words.add }))
    await waitFor(() => expect(api.addRisk).toHaveBeenCalledWith('p-1', 'Ferie di dicembre'))

    fireEvent.click(screen.getByRole('button', { name: words.propose }))
    expect(await screen.findByText(words.proposing)).toBeTruthy()
    act(() => tell({ kind: 'searching', target: 'rischi' }))
    fireEvent.click(screen.getByRole('button', { name: text.judgement.stop }))
    expect(api.cancelEvaluateToday).toHaveBeenCalledWith('p-1')
    await act(async () => finish({ ok: false, code: 'agent_limit_reached' }))
    expect(await screen.findByRole('alert')).toBeTruthy()
  })

  it('says an empty register, and a register it cannot open', async () => {
    const empty = todayApi()
    render(<RiskRegister api={empty.api} project={aurora} canJudge={false} onBack={() => {}} />)
    expect(await screen.findByText(words.none)).toBeTruthy()
    expect(screen.getByText(new RegExp(words.neverProposed))).toBeTruthy()
    expect(screen.queryByRole('button', { name: words.propose })).toBeNull()
    cleanup()
    const broken = todayApi(view(), {
      risks: vi.fn(async () => ({ ok: false as const, code: 'project_not_found' as const })),
    })
    render(<RiskRegister api={broken.api} project={aurora} canJudge onBack={() => {}} />)
    expect(await screen.findByRole('alert')).toBeTruthy()
  })
})

describe('all the projects in brief', () => {
  const counts = { alert: 1, due: 1, waiting: 1, numbers: 0, watch: 1 }
  const rows: ProjectOverview[] = [
    {
      project: aurora,
      counts,
      first: [hours, mail, bugs],
      evaluatedAt: '2026-11-16T09:02:00.000Z',
      failed: false,
    },
    {
      project: { ...aurora, id: 'p-2', name: 'Boreale' },
      counts: { alert: 0, due: 0, waiting: 0, numbers: 0, watch: 0 },
      first: [],
      evaluatedAt: null,
      failed: false,
    },
    {
      project: { ...aurora, id: 'p-3', name: 'Cometa' },
      counts,
      first: [],
      evaluatedAt: null,
      failed: true,
    },
  ]
  const words = messages.overview

  it('says how much waits in each project and opens the day of the one chosen', async () => {
    const opened: string[] = []
    render(
      <AllProjectsView
        api={{ todayOverview: async () => ok(rows) }}
        onOpen={(id) => opened.push(id)}
      />,
    )
    const [first, second, third] = await screen
      .findAllByRole('listitem')
      .then((items) => items.filter((entry) => entry.className === 'today-item'))
    expect(first?.textContent).toContain(words.counts(2, 1))
    expect(first?.textContent).toContain(words.alerts(1))
    expect(first?.textContent).toContain('Rispondi a Carla Bianchi')
    expect(second?.textContent).toContain(words.nothing)
    expect(third?.textContent).toContain(words.failed)
    fireEvent.click(screen.getByRole('button', { name: words.openProject('Boreale') }))
    expect(opened).toEqual(['p-2'])
  })

  it('says when there is no project, and when it cannot look', async () => {
    render(<AllProjectsView api={{ todayOverview: async () => ok([]) }} onOpen={() => {}} />)
    expect(await screen.findByText(words.empty)).toBeTruthy()
    cleanup()
    render(
      <AllProjectsView
        api={{ todayOverview: async () => ({ ok: false, code: 'unexpected' }) }}
        onOpen={() => {}}
      />,
    )
    expect(await screen.findByRole('alert')).toBeTruthy()
  })
})

describe('the way into Octo', () => {
  const words = messages.session
  const out: SessionView = { identity: null, configured: true }
  const paola: SessionView = {
    identity: {
      id: 'u-1',
      username: 'pm@example.test',
      email: 'pm@example.test',
      name: 'Paola Verdi',
      tenant: 't',
    },
    configured: true,
  }

  it('asks to sign in, waits for the browser, and can stop waiting', async () => {
    let finish: (result: Result<SessionView>) => void = () => {}
    const api = {
      signIn: vi.fn(() => new Promise<Result<SessionView>>((resolve) => (finish = resolve))),
      cancelSignIn: vi.fn(async () => ok(null)),
      configureSignIn: vi.fn(),
    }
    const entered: SessionView[] = []
    render(
      <SignIn api={api} session={out} error={null} onSignedIn={(next) => entered.push(next)} />,
    )
    fireEvent.click(screen.getByRole('button', { name: words.signIn }))
    expect(await screen.findByText(words.waiting)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: words.cancel }))
    expect(api.cancelSignIn).toHaveBeenCalled()
    await act(async () => finish({ ok: false, code: 'sign_in_cancelled' }))
    expect(screen.getByRole('alert').textContent).toContain('Accesso interrotto')
    fireEvent.click(screen.getByRole('button', { name: words.signIn }))
    await act(async () => finish(ok(paola)))
    expect(entered).toEqual([paola])
  })

  it('says when Octo is still finding out, and asks where to sign in when nobody told it', async () => {
    const api = {
      signIn: vi.fn(),
      cancelSignIn: vi.fn(),
      configureSignIn: vi
        .fn<OctoApi['configureSignIn']>()
        .mockResolvedValueOnce({ ok: false, code: 'sign_in_setup_invalid' })
        .mockResolvedValue(ok(out)),
    }
    const told: SessionView[] = []
    const { rerender } = render(
      <SignIn api={api} session={null} error={null} onSignedIn={() => {}} />,
    )
    expect(screen.getByText(words.checking)).toBeTruthy()
    rerender(
      <SignIn
        api={api}
        session={{ identity: null, configured: false }}
        error={null}
        onSignedIn={(next) => told.push(next)}
      />,
    )
    expect(screen.getByText(words.notConfigured)).toBeTruthy()
    expect(screen.queryByRole('button', { name: words.signIn })).toBeNull()
    // An Octo just installed is told by who uses it, with the two ids a colleague passes on.
    const save = screen.getByRole<HTMLButtonElement>('button', { name: words.configure })
    expect(save.disabled).toBe(true)
    fireEvent.change(screen.getByLabelText(words.tenantId), { target: { value: 'sbagliato' } })
    fireEvent.change(screen.getByLabelText(words.clientId), { target: { value: 'app-1' } })
    fireEvent.click(save)
    expect((await screen.findByRole('alert')).textContent).toContain('non è scritto bene')
    expect(told).toEqual([])
    fireEvent.click(save)
    await waitFor(() => expect(told).toEqual([out]))
    expect(api.configureSignIn).toHaveBeenLastCalledWith('sbagliato', 'app-1')
  })
})

describe('Octo opened by a person', () => {
  /** An interface that answers only what these tests ask of it. */
  function appApi(overrides: Partial<OctoApi>): OctoApi {
    const { api } = todayApi()
    const never = () => new Promise<never>(() => {})
    return new Proxy({ ...api, ...overrides } as unknown as OctoApi, {
      get: (target, name: string) =>
        (target as unknown as Record<string, unknown>)[name] ??
        (name.startsWith('on') ? () => () => {} : never),
    })
  }
  const paola: SessionView = {
    identity: {
      id: 'u-1',
      username: 'pm@example.test',
      email: 'pm@example.test',
      name: 'Paola Verdi',
      tenant: 't',
    },
    configured: true,
  }
  const boreale = { ...aurora, id: 'p-2', name: 'Boreale' }

  it('shows nothing but the way in until somebody signs in, then opens on the day', async () => {
    const listProjects = vi.fn(async () => ok([aurora]))
    const api = appApi({
      session: vi.fn(async () => ok<SessionView>({ identity: null, configured: true })),
      signIn: vi.fn(async () => ok(paola)),
      listProjects,
      agentStatus: vi.fn(async () =>
        ok({ available: false as const, reason: 'not_installed' as const }),
      ),
      assignment: vi.fn(async () => ok('not_assigned' as const)),
    })
    render(<App api={api} />)
    fireEvent.click(await screen.findByRole('button', { name: messages.session.signIn }))
    // Nothing was asked of Octo before the sign-in.
    expect(await screen.findByText(/Rispondi a Carla Bianchi/)).toBeTruthy()
    expect(listProjects).toHaveBeenCalledTimes(1)
    expect(
      screen.getByText(messages.session.signedInAs('Paola Verdi'), { exact: false }),
    ).toBeTruthy()
    // The project is not the person's in the company system: said, not forbidden.
    expect(await screen.findByText(messages.assignment.notAssigned)).toBeTruthy()
  })

  it('goes to the page of all the projects and back, and signs out', async () => {
    const signOut = vi.fn(async () => ok<SessionView>({ identity: null, configured: true }))
    const api = appApi({
      session: vi.fn(async () => ok(paola)),
      listProjects: vi.fn(async () => ok([aurora, boreale])),
      agentStatus: vi.fn(async () => ok({ available: true as const, version: '2.1' })),
      assignment: vi.fn(async () => ok('unknown' as const)),
      todayOverview: vi.fn(async () =>
        ok<ProjectOverview[]>([
          {
            project: boreale,
            counts: { alert: 0, due: 0, waiting: 0, numbers: 0, watch: 0 },
            first: [],
            evaluatedAt: null,
            failed: false,
          },
        ]),
      ),
      signOut,
    })
    render(<App api={api} />)
    await screen.findByText(/Rispondi a Carla Bianchi/)
    fireEvent.click(screen.getByRole('button', { name: 'Aurora' }))
    fireEvent.click(screen.getByRole('menuitem', { name: messages.overview.open }))
    expect(await screen.findByRole('heading', { name: messages.overview.title })).toBeTruthy()
    // The sections are of a project: above the projects there are none.
    expect(screen.queryByRole('tab', { name: messages.ask })).toBeNull()
    fireEvent.click(
      await screen.findByRole('button', { name: messages.overview.openProject('Boreale') }),
    )
    expect(await screen.findByRole('heading', { name: 'Boreale' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: messages.todayTab, selected: true })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: messages.session.signOut }))
    expect(await screen.findByRole('button', { name: messages.session.signIn })).toBeTruthy()
    expect(signOut).toHaveBeenCalled()
  })
})

describe('the day as a list with its detail', () => {
  const waiting = item(
    'mail:sal',
    'waiting',
    {
      kind: 'mail_waiting',
      id: 'sal',
      path: 'Posta/2026-11/sal.md',
      to: 'Marco Verdi <marco@cliente.example>',
      subject: 'SAL di ottobre',
      days: 5,
    },
    { target: 'mail' },
  )
  const rows = () => within(screen.getByRole('list', { name: text.list })).getAllByRole('button')
  const detail = () => screen.getByRole('region', { name: text.detailTitle })

  it('filters by where the signals come from, with counts that are the rows listed', async () => {
    const { api } = todayApi(view({ items: [hours, mail, waiting] }))
    render(<TodayView api={api} project={aurora} canJudge onOpenSection={() => {}} />)
    const filters = await screen.findByRole('group', { name: text.filters })
    expect(within(filters).getByRole('button', { name: `${text.filterAll} 3` })).toBeTruthy()
    expect(rows()).toHaveLength(3)
    expect(detail().textContent).toContain('le ore di 3 persone')

    // The row in view is not of the mail: the first of what is left takes its place.
    fireEvent.click(within(filters).getByRole('button', { name: `${text.groups.mail} 2` }))
    expect(rows()).toHaveLength(2)
    expect(detail().textContent).toContain('Rispondi a Carla Bianchi')
    expect(rows()[1]?.textContent).toContain('da 5 giorni')

    fireEvent.click(within(filters).getByRole('button', { name: `${text.groups.numbers} 1` }))
    expect(rows()).toHaveLength(1)
    expect(detail().textContent).toContain('le ore di 3 persone')
  })

  it('keeps the filter and the row in view for who shows the page, and leads on with the context', async () => {
    const { api } = todayApi(view({ items: [hours, mail, bugs] }))
    const focus = vi.fn()
    const asked: string[] = []
    const opened: string[] = []
    render(
      <TodayView
        api={api}
        project={aurora}
        canJudge
        onOpenSection={() => {}}
        focus={{ group: 'mail', key: 'mail:budget' }}
        onFocus={focus}
        onAsk={(question) => asked.push(question)}
        onOpenBugs={(filter) => opened.push(filter)}
      />,
    )
    await screen.findByRole('group', { name: text.filters })
    expect(rows()).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: text.askAboutMail }))
    expect(asked).toEqual([text.mailSeed('Carla Bianchi', 'Aurora: budget')])
    // The stuck bugs open the dashboard on the stuck ones.
    fireEvent.click(screen.getByRole('button', { name: text.open.dashboard }))
    expect(opened).toEqual(['stuck'])
    fireEvent.click(screen.getByRole('button', { name: `${text.filterAll} 2` }))
    expect(focus).toHaveBeenCalledWith({ group: 'all', key: 'mail:budget' })
  })

  it('shows nothing of a project the PM has left, whenever its answer comes back', async () => {
    let finish: (result: Result<View>) => void = () => {}
    const { api } = todayApi(view(), {
      todayView: vi.fn((projectId: string) =>
        projectId === 'p-1'
          ? new Promise<Result<View>>((resolve) => (finish = resolve))
          : Promise.resolve(ok(view({ items: [mail] }))),
      ),
    })
    const boreale: Project = { ...aurora, id: 'p-2', name: 'Boreale' }
    const page = (project: Project) => (
      <TodayView api={api} project={project} canJudge onOpenSection={() => {}} />
    )
    const { rerender } = render(page(aurora))
    rerender(page(boreale))
    expect((await screen.findAllByText(/Rispondi a Carla Bianchi/)).length).toBeGreaterThan(0)
    await act(async () => finish(ok(view({ items: [hours] }))))
    expect(screen.queryByText(/le ore di 3 persone/)).toBeNull()
    expect(rows()).toHaveLength(1)
  })

  it('gives a recorded meeting without a project to this one, when the PM says so', async () => {
    const waiting = item(
      'meeting-unassigned:m-1',
      'waiting',
      {
        kind: 'meeting_unassigned',
        id: 'm-1',
        title: 'Allineamento',
        start: '2026-11-13T14:00:00.000Z',
        minutes: 30,
        days: 3,
        elsewhere: null,
      },
      { target: 'sources' },
    )
    const assignMeeting = vi
      .fn<OctoApi['assignMeeting']>()
      .mockResolvedValueOnce({ ok: false, code: 'meeting_not_found' })
      .mockResolvedValue(ok(view({ items: [] })))
    const { api } = todayApi(view({ items: [waiting] }), { assignMeeting })
    const onOpenSection = vi.fn()
    render(<TodayView api={api} project={aurora} canJudge onOpenSection={onOpenSection} />)

    const assign = await screen.findByRole('button', { name: text.assignMeeting })
    expect(screen.getByRole('button', { name: text.notThisProject })).toBeTruthy()
    fireEvent.click(assign)
    expect(await screen.findByText(errorText('meeting_not_found'))).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: text.assignMeeting }))

    await waitFor(() => expect(screen.queryByText(/Allineamento/)).toBeNull())
    expect(assignMeeting).toHaveBeenCalledWith('p-1', 'm-1')
    // The meeting is placed from the page itself: no other section is opened.
    expect(onOpenSection).not.toHaveBeenCalled()
  })

  it('says that a file is being opened on the button that opens it, without changing its place', async () => {
    let finish: (result: Result<null>) => void = () => {}
    const { api } = todayApi(view({ items: [mail] }), {
      openEvidence: vi.fn(() => new Promise<Result<null>>((resolve) => (finish = resolve))),
    })
    render(<TodayView api={api} project={aurora} canJudge onOpenSection={() => {}} />)
    const open = await screen.findByRole('button', { name: new RegExp(text.open.mail) })
    fireEvent.click(open)
    expect(open.getAttribute('aria-busy')).toBe('true')
    expect(open.textContent).toContain(messages.wait.opening)
    // A second press while it works asks nothing more.
    fireEvent.click(open)
    expect(api.openEvidence).toHaveBeenCalledTimes(1)
    await act(async () => finish(ok(null)))
    expect(open.getAttribute('aria-busy')).toBeNull()
  })

  describe('the mail the PM is written to with others', () => {
    const judgement = {
      importance: 'alta' as const,
      reason: 'Recap della sessione.',
      quote: 'Ciao a tutti, di seguito il recap',
      quoteVerified: true,
      deadline: null,
      addressee: 'everyone' as const,
      addresseeName: null,
    }
    const follow = (
      id: string,
      why: MailFollowWhy,
      more: { who?: string | null; mails?: number; judged?: boolean } = {},
    ) =>
      item(
        `mail:c:${id}`,
        'watch',
        {
          kind: 'mail_follow',
          id,
          path: `Posta/2026-11/${id}.md`,
          from: 'Racis, Claudia <claudia@cliente.example>',
          subject: `Aurora: ${id}`,
          days: 3,
          judgement: more.judged ? judgement : null,
          why,
          who: more.who ?? null,
          conversation: `aurora: ${id}`,
          mails: more.mails ?? 1,
          recipients: 12,
        },
        { target: 'mail' },
      )
    const reply = (why: MailReplyWhy) =>
      signalText({ ...mail, facts: { ...mail.facts, why } as TodayItem['facts'] }).detail

    it('is said to be followed, with whom it is for, and never asked an answer of', () => {
      const words = (entry: TodayItem) => signalText(entry)
      expect(words(follow('recap', 'everyone', { judged: true, mails: 4 }))).toEqual({
        title: 'Da seguire: «Aurora: recap» · Racis, Claudia',
        detail:
          'Rivolta a tutti, senza chiedere a te. Claude: importanza alta. 4 mail in questa conversazione.',
      })
      expect(words(follow('data', 'someone_else', { who: 'Cristian Lena' })).detail).toBe(
        'Rivolta a Cristian Lena.',
      )
      expect(words(follow('data', 'someone_else')).detail).toBe('Rivolta a un’altra persona.')
      expect(words(follow('piano', 'answered_by_own', { who: 'Rossi, Mario' })).detail).toBe(
        'Ha già risposto Rossi, Mario.',
      )
      expect(words(follow('piano', 'answered_by_own')).detail).toBe(
        'Ha già risposto uno dei nostri.',
      )
      expect(words(follow('verbale', 'nobody')).detail).toBe('Non chiede nulla: è per conoscenza.')
      expect(words(follow('x', 'chosen')).detail).toBe('Hai detto tu che non tocca a te.')
      expect(words(follow('x', 'unjudged')).detail).toBe(
        'Sei fra 12 destinatari: Claude non l’ha ancora letta.',
      )
      expect(ageText(follow('x', 'unjudged'))).toBe('da 3 giorni')
      // A mail that is the PM's says why it is.
      expect(reply('only_me')).toBe('Aspetta da oggi. Sei l’unico destinatario.')
      expect(reply('judged')).toBe('Aspetta da oggi. Claude: la richiesta è rivolta a te.')
      expect(reply('chosen')).toBe('Aspetta da oggi. Hai detto tu che tocca a te.')
    })

    it('is taken as the PM’s own, or given away, with one click', async () => {
      const followed = follow('recap', 'everyone', { judged: true })
      const { api } = todayApi(view({ items: [hours, mail, followed] }))
      render(<TodayView api={api} project={aurora} canJudge onOpenSection={() => {}} />)
      // Only what is the PM's counts as mail to do.
      expect(
        (await screen.findByRole('button', { name: new RegExp(`^${text.groups.mail}`) }))
          .textContent,
      ).toContain('1')
      const watched = screen.getByRole('table', { name: text.watch })
      expect(within(watched).getByText('Da seguire: «Aurora: recap» · Racis, Claudia')).toBeTruthy()
      fireEvent.click(
        within(watched).getByRole('button', {
          name: `${text.mine}: Da seguire: «Aurora: recap» · Racis, Claudia`,
        }),
      )
      await waitFor(() =>
        expect(api.setMailTurn).toHaveBeenCalledWith('p-1', 'mail:c:recap', 'mine'),
      )
    })

    it('lets the PM say a mail asked of them is not theirs, and says a failure', async () => {
      const refused = vi.fn(
        async (): Promise<Result<View>> => ({ ok: false, code: 'today_decision_invalid' }),
      )
      const { api } = todayApi(view({ items: [mail] }), { setMailTurn: refused })
      render(<TodayView api={api} project={aurora} canJudge onOpenSection={() => {}} />)
      fireEvent.click(await screen.findByRole('button', { name: text.notMine }))
      await waitFor(() => expect(refused).toHaveBeenCalledWith('p-1', 'mail:budget', 'not_mine'))
      expect(await screen.findByRole('alert')).toBeTruthy()
    })
  })
})
