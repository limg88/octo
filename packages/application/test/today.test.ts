import {
  type Alignment,
  DEFAULT_ALIGNMENT_SETTINGS,
  DEFAULT_DASHBOARD_SETTINGS,
  type Deliverable,
  DomainError,
  type Identity,
  type MailSourceConfig,
  NEVER_READ,
  NO_OPEN_POINTS,
  NO_RISKS,
  NO_TEAM,
  NO_TODAY_SETTINGS,
  type OpenPointRegister,
  type Project,
  type Reconciliation,
  type RiskRegister,
  type SignInSetup,
  type TodaySettings,
} from '@octo/domain'
import { describe, expect, it } from 'vitest'
import {
  createOpenPoints,
  createRisks,
  createSession,
  createToday,
  type DayClosing,
  type IdentityProvider,
  type MeetingToPrepare,
  NO_EVALUATION,
  type NowToExplain,
  type ProposedJudgement,
  type ProposedRisk,
  type ProposedSentence,
  settingsOwnedBy,
  type TodayDeps,
  type TodayEvaluation,
  type TodayJudge,
  type TodayStore,
  type TodayView,
} from '../src/index.ts'
import {
  evidenceFrom,
  memorySourceSettings,
  memoryVault,
  memoryWriter,
  READ_HERE,
} from './fakes.ts'

const project: Project = { id: 'p-1', name: 'Aurora', folder: '/progetti/Aurora', addedAt: '' }
/** A Monday in the middle of the month. */
const NOW = new Date('2026-11-16T09:00:00.000Z')
const paola: Identity = {
  id: 'u-1',
  username: 'pm@example.test',
  email: 'pm@example.test',
  name: 'Paola Verdi',
  tenant: 't-1',
}
const mailConfig: MailSourceConfig = {
  since: '2026-11-01',
  keywords: ['Aurora'],
  folders: [],
  excludeSenders: [],
  keepQuoted: false,
  targetFolder: 'Posta',
}

const mailFile = (id: string, subject: string, from: string, at: string, more: string[] = []) =>
  [
    '---',
    'tipo: "email"',
    `oggetto: ${JSON.stringify(subject)}`,
    `da: ${JSON.stringify(from)}`,
    'a: "Paola Verdi <pm@example.test>"',
    'cc: ""',
    `data: ${JSON.stringify(at)}`,
    `id: ${JSON.stringify(id)}`,
    ...more,
    '---',
    '',
    `# ${subject}`,
    '',
    'Il comitato ha approvato un budget aggiuntivo di 8.000 euro per Aurora.',
  ].join('\n')

const BUDGET_PATH = 'Posta/2026-11/budget.md'
const FILES: Record<string, string> = {
  [BUDGET_PATH]: mailFile(
    'budget',
    'Aurora: budget',
    'Carla <carla@cliente.example>',
    '2026-11-16T08:00:00.000Z',
  ),
  'Posta/2026-11/invito.md': mailFile(
    'invito',
    'Collaudo',
    'Carla <carla@cliente.example>',
    '2026-11-12T08:00:00.000Z',
    [
      'invito: "REQUEST"',
      'riunione: "Collaudo di Aurora"',
      'riunione-id: "uid-1"',
      'riunione-inizio: "2026-11-16T14:00:00.000Z"',
      'riunione-fine: ""',
      'riunione-luogo: ""',
    ],
  ),
  'Posta/2026-11/appunti.md': '# Non una mail',
}

function memoryTodayStore(): TodayStore & { settings: TodaySettings; evaluation: TodayEvaluation } {
  const store = {
    settings: NO_TODAY_SETTINGS,
    evaluation: NO_EVALUATION,
    load: async () => store.settings,
    save: async (_folder: string, settings: TodaySettings) => {
      store.settings = settings
    },
    loadEvaluation: async () => store.evaluation,
    saveEvaluation: async (_folder: string, evaluation: TodayEvaluation) => {
      store.evaluation = evaluation
    },
  }
  return store
}

type JudgeScript = {
  mails?: (ids: string[]) => ProposedJudgement[]
  risks?: ProposedRisk[]
  summary?: (keys: string[]) => ProposedSentence[]
  summaryFails?: Error
  fails?: Error
}

function scriptedJudge(
  script: JudgeScript = {},
): TodayJudge & { asked: string[][]; riskRuns: number; explained: NowToExplain[][] } {
  const judge = {
    asked: [] as string[][],
    riskRuns: 0,
    explained: [] as NowToExplain[][],
    summary: async (request: Parameters<TodayJudge['summary']>[0]) => {
      judge.explained.push([...request.items])
      if (script.summaryFails) throw script.summaryFails
      return script.summary?.(request.items.map((item) => item.key)) ?? []
    },
    mails: async (request: Parameters<TodayJudge['mails']>[0]) => {
      judge.asked.push(request.mails.map((mail) => mail.id))
      if (script.fails) throw script.fails
      request.onModel?.('claude-fake')
      return (
        script.mails?.(request.mails.map((mail) => mail.id)) ??
        request.mails.map((mail) => ({
          id: mail.id,
          importance: 'alta' as const,
          reason: ' Comunica un budget in più. ',
          quote: 'ha approvato un budget aggiuntivo di 8.000 euro',
          deadline: null,
          addressee: 'me' as const,
          addresseeName: null,
          asksAction: true,
        }))
      )
    },
    risks: async (request: Parameters<TodayJudge['risks']>[0]) => {
      judge.riskRuns += 1
      request.onModel?.('claude-fake')
      return script.risks ?? []
    },
  }
  return judge
}

const notSet = (code: DomainError['code']) => async (): Promise<never> => {
  throw new DomainError(code)
}

function setup(overrides: Partial<TodayDeps> = {}, judgeScript: JudgeScript = {}) {
  const store = memoryTodayStore()
  const judge = scriptedJudge(judgeScript)
  const writer = memoryWriter()
  let register: RiskRegister = NO_RISKS
  let now = NOW
  const clock = { now: () => now }
  const evidence = evidenceFrom(
    Object.fromEntries(
      Object.entries(FILES).map(([path, text]) => [path, { kind: 'found', text, modifiedAt: '' }]),
    ),
  )
  const risks = createRisks({
    store: {
      load: async () => register,
      save: async (_folder, next) => {
        register = next
      },
    },
    writer,
    judge,
    evidence,
    clock,
  })
  const today = createToday({
    hours: { view: notSet('hours_sources_not_set') },
    forecasts: { view: notSet('forecast_model_not_set') },
    dashboard: {
      view: notSet('tracker_export_not_set'),
      settings: async () => DEFAULT_DASHBOARD_SETTINGS,
    },
    alignments: {
      view: notSet('alignment_sprint_not_set'),
      settings: async () => DEFAULT_ALIGNMENT_SETTINGS,
    },
    deliverables: { list: async () => [] },
    sources: {
      mail: async () => ({
        config: mailConfig,
        suggestedFolder: 'Posta',
        state: {
          cursor: null,
          lastRun: { at: '2026-11-16T08:45:00.000Z', written: 1, unchanged: 0, error: null },
        },
        ...READ_HERE,
        readableHere: true,
      }),
    },
    feeds: {
      view: async (_project, feed) => ({
        feed,
        config: null,
        suggestedFolder: '',
        hasSecret: false,
        state: NEVER_READ,
        ...READ_HERE,
      }),
    },
    team: { get: async () => NO_TEAM },
    risks,
    files: {
      under: async (_folder, folder) =>
        Object.keys(FILES).filter((path) => path.startsWith(`${folder}/`)),
      readText: async (_folder, path) => FILES[path] ?? null,
    },
    store,
    judge,
    evidence,
    clock,
    identity: () => paola,
    ...overrides,
  })
  return {
    today,
    risks,
    store,
    judge,
    writer,
    register: () => register,
    at: (iso: string) => {
      now = new Date(iso)
    },
  }
}

describe('the page of the day', () => {
  it('opens on the points left open, and closes with its signal a point opened from one', async () => {
    let register: OpenPointRegister = NO_OPEN_POINTS
    const points = createOpenPoints({
      store: {
        load: async () => register,
        save: async (_folder, next) => {
          register = next
        },
      },
      writer: memoryWriter(),
      clock: { now: () => new Date('2026-11-13T09:00:00.000Z') },
    })
    await points.add(project, { title: 'Verbale', due: '2026-11-13' })
    await points.add(project, {
      title: 'Budget',
      signal: { key: 'mail:budget', kind: 'mail_reply' },
    })
    await points.add(project, {
      title: 'Sparita',
      signal: { key: 'mail:altra', kind: 'mail_reply' },
    })
    const { today } = setup({ points })
    const view = await today.view(project)
    expect(view.points.since).toBe('2026-11-13')
    expect(view.points.queued.map((entry) => [entry.point.title, entry.overdueDays])).toEqual([
      ['Verbale', 3],
      ['Budget', 0],
    ])
    // The mail of the third point is no longer there: closed by itself.
    expect(view.points.closed.map((point) => [point.title, point.closedBy])).toEqual([
      ['Sparita', 'signal'],
    ])
    // The meeting, the mail, and the point past its day.
    expect(view.count).toBe(3)
    // The point past its day is a critical thing of the week.
    expect(view.week.ongoing.map((entry) => entry.key)).toEqual([
      `point:${view.points.queued[0]?.point.id}`,
    ])
    // Without the register the page still works.
    expect((await setup().today.view(project)).points.queued).toEqual([])
  })

  it('reads the recorded meetings with the evaluation of the day, and when the PM asks', async () => {
    const checked = {
      ...NO_OPEN_POINTS,
      closedAt: '2026-11-13T17:00:00.000Z',
      closedBy: 'claude-fake',
    }
    let unread = ['m-1', 'm-2']
    const looks: string[][] = []
    const closes: string[][] = []
    let fails: Error | null = null
    const closing: DayClosing = {
      look: async (_project, held) => {
        looks.push(held.map((meeting) => meeting.start))
        return { register: checked, unread }
      },
      close: async (_project, input) => {
        closes.push(input.held.map((meeting) => meeting.uid))
        if (fails) throw fails
        unread = []
        return checked
      },
    }
    const { today, judge } = setup({ closing })
    const view = await today.view(project)
    // The meetings of the working day before and of today are those the recordings are told by.
    expect(looks[0]).toEqual(['2026-11-16T14:00:00.000Z'])
    expect(view.closing).toEqual({
      unread: 2,
      key: 'm-1 m-2',
      at: '2026-11-13T17:00:00.000Z',
      model: 'claude-fake',
    })
    expect(view.evaluationDue).toBe(true)
    // A reading that fails leaves the mail judged, and the meetings to read.
    fails = new DomainError('agent_failed')
    expect((await today.evaluate(project)).closing.unread).toBe(2)
    expect(judge.asked).toHaveLength(1)
    fails = null
    const closed = await today.closeDay(project)
    expect(closes).toEqual([['uid-1'], ['uid-1']])
    expect(closed.closing.unread).toBe(0)
    // With nothing to read the evaluation of the day does not read.
    await today.evaluate(project, { all: true })
    expect(closes).toHaveLength(2)
    // Something else fails: it is not hidden.
    fails = new Error('boom')
    unread = ['m-3']
    await expect(today.evaluate(project)).rejects.toThrow('boom')
    await expect(today.closeDay(project)).rejects.toThrow('boom')
    // Without the closing the page still works, and there is nothing to close.
    const plain = setup()
    expect((await plain.today.closeDay(project)).closing).toEqual({
      unread: 0,
      key: '',
      at: null,
      model: null,
    })
  })

  it('prepares the meetings still to come: the card of the code, and what Claude adds', async () => {
    const folder = '_octo/riunioni/2026-11-09_collaudo'
    const files: Record<string, string> = {
      ...FILES,
      [`${folder}/report.md`]: 'Ambiente di prova entro venerdì.',
      [`${folder}/transcript.md`]: 'Luca: lo consegno venerdì.',
    }
    const recorded = {
      id: 'm-9',
      title: 'Collaudo di Aurora',
      started: '2026-11-09T14:00:00.000Z',
      minutes: 45,
      participants: [],
      folder,
    }
    let register: OpenPointRegister = NO_OPEN_POINTS
    const points = createOpenPoints({
      store: {
        load: async () => register,
        save: async (_folder, next) => {
          register = next
        },
      },
      writer: memoryWriter(),
      clock: { now: () => new Date('2026-11-12T09:00:00.000Z') },
    })
    await points.add(project, { title: 'Data del collaudo', meeting: 'uid-1' })
    const asked: MeetingToPrepare[][] = []
    let fails: Error | null = null
    const KEY = 'meeting:uid-1:2026-11-16T14:00:00.000Z'
    const { today, at, store } = setup({
      points,
      meetings: {
        view: async () => ({ config: null }) as never,
        unassigned: async () => [],
        imported: async () => [recorded],
      },
      reader: {
        prep: async (request) => {
          asked.push([...request.meetings])
          if (fails) throw fails
          return [
            {
              key: KEY,
              text: ' Chiedi la data. ',
              path: `${folder}/report.md`,
              quote: 'Ambiente di prova entro venerdì',
            },
            {
              key: KEY,
              text: 'Inventata.',
              path: `${folder}/report.md`,
              quote: 'parole che non ci sono',
            },
            { key: KEY, text: '  ', path: `${folder}/report.md`, quote: 'Ambiente di prova' },
            {
              key: 'meeting:altra',
              text: 'Di un’altra.',
              path: `${folder}/report.md`,
              quote: 'Ambiente di prova',
            },
          ]
        },
      },
      files: {
        under: async (_folder, under) =>
          Object.keys(files).filter((path) => path.startsWith(`${under}/`)),
        readText: async (_folder, path) => files[path] ?? null,
      },
      evidence: evidenceFrom(
        Object.fromEntries(
          Object.entries(files).map(([path, text]) => [
            path,
            { kind: 'found', text, modifiedAt: '' },
          ]),
        ),
      ),
    })
    // Before Claude: the card of the code. The last recording is told by its name.
    const before = await today.view(project)
    expect(before.prep).toHaveLength(1)
    expect(before.prep[0]).toMatchObject({
      key: KEY,
      last: { title: 'Collaudo di Aurora', file: `${folder}/report.md` },
      bring: [],
    })
    expect(before.prep[0]?.points.map((entry) => entry.point.title)).toEqual(['Data del collaudo'])
    expect(before.evaluationDue).toBe(true)

    const view = await today.evaluate(project)
    expect(asked[0]).toEqual([
      {
        key: KEY,
        subject: 'Collaudo di Aurora',
        start: '2026-11-16T14:00:00.000Z',
        attendees: [],
        points: [{ id: expect.any(String), title: 'Data del collaudo', owner: '', due: null }],
        lastFiles: [`${folder}/report.md`, `${folder}/transcript.md`],
        mails: [],
      },
    ])
    // Only what the code found, on the meeting it asked about.
    expect(view.prep[0]?.bring).toEqual([
      {
        key: KEY,
        text: 'Chiedi la data.',
        path: `${folder}/report.md`,
        quote: 'Ambiente di prova entro venerdì',
        verified: true,
      },
    ])
    expect(store.evaluation.prep).toHaveLength(2)
    // A run that fails keeps the page; one after the meeting began asks nothing more.
    fails = new DomainError('agent_failed')
    expect((await today.evaluate(project)).prep[0]?.bring).toEqual([])
    fails = null
    at('2026-11-16T14:30:00.000Z')
    await today.evaluate(project)
    expect(asked).toHaveLength(2)
    // The day after, what Claude wrote is of another day.
    at('2026-11-17T08:00:00.000Z')
    expect((await today.view(project)).prep).toEqual([])
  })

  it('reads the meetings one project at a time', async () => {
    let release: () => void = () => {}
    const closing: DayClosing = {
      look: async () => ({ register: NO_OPEN_POINTS, unread: [] }),
      close: () =>
        new Promise((resolve) => {
          release = () => resolve(NO_OPEN_POINTS)
        }),
    }
    const { today } = setup({ closing })
    const running = today.closeDay(project)
    await new Promise((resolve) => setTimeout(resolve, 0))
    await expect(today.closeDay(project)).rejects.toMatchObject({ code: 'source_busy' })
    release()
    await running
  })

  it('tells the open risks of the register among the critical things of the week', async () => {
    const { today, risks } = setup()
    const register = await risks.add(project, 'Ambiente non pronto')
    const id = register.risks[0]?.id ?? ''
    expect((await today.view(project)).week.ongoing.map((entry) => entry.key)).toEqual([
      `risk:${id}`,
    ])
    await risks.update(project, id, { due: '2026-11-18', severity: 'alta' })
    const week = (await today.view(project)).week
    expect(week.until).toBe('2026-11-22')
    expect(week.coming.map((entry) => [entry.key, entry.day])).toEqual([
      [`risk:${id}`, '2026-11-18'],
    ])
  })

  it('holds the meetings of today and of the next working day, also from an old series', async () => {
    const weekly = mailFile('sal', 'SAL', 'Carla <carla@cliente.example>', '2026-03-02T08:00:00Z', [
      'invito: "REQUEST"',
      'riunione: "SAL settimanale"',
      'riunione-id: "sal"',
      'riunione-inizio: "2026-03-02T09:00:00.000Z"',
      'riunione-fine: "2026-03-02T10:00:00.000Z"',
      'riunione-luogo: "Teams"',
      'riunione-ripete: "FREQ=WEEKLY;BYDAY=MO,TU"',
      'riunione-partecipanti: "Carla <carla@cliente.example>"',
    ])
    const old: Record<string, string> = {
      ...FILES,
      'Posta/2026-03/sal.md': weekly,
      'Posta/2026-03/altro.md': mailFile(
        'x',
        'Saluti',
        'Carla <c@c.example>',
        '2026-03-03T08:00:00Z',
      ),
      // Called more than a year ago: not looked for.
      'Posta/2025-10/vecchio.md': weekly.replaceAll('sal', 'vecchio'),
    }
    const { today } = setup({
      files: {
        under: async (_folder, folder) =>
          Object.keys(old).filter((path) => path.startsWith(`${folder}/`)),
        readText: async (_folder, path) => old[path] ?? null,
      },
    })
    const view = await today.view(project)
    expect(view.agenda.today.map((held) => [held.subject, held.start, held.repeats])).toEqual([
      ['SAL settimanale', '2026-11-16T09:00:00.000Z', true],
      ['Collaudo di Aurora', '2026-11-16T14:00:00.000Z', false],
    ])
    expect(view.agenda.today[0]?.attendees).toEqual(['Carla <carla@cliente.example>'])
    expect(view.agenda.next).toMatchObject({
      day: '2026-11-17',
      meetings: [{ subject: 'SAL settimanale', start: '2026-11-17T09:00:00.000Z' }],
    })
    expect(view.items.filter((item) => item.facts.kind === 'meeting')).toHaveLength(2)
  })

  it('shows the mail that waits and the meeting of the day when no section is set up', async () => {
    const { today } = setup()
    const view = await today.view(project)
    expect(view.day).toBe('2026-11-16')
    expect(view.items.map((item) => item.key)).toEqual([
      'meeting:uid-1:2026-11-16T14:00:00.000Z',
      'mail:budget',
    ])
    expect(view.freshness).toEqual([{ source: 'Posta', readAt: '2026-11-16T08:45:00.000Z' }])
    expect(view.ownAddresses).toEqual(['pm@example.test'])
    // A mail waits that Claude has not weighed, and nothing was judged today.
    expect(view.evaluationDue).toBe(true)
    expect(view.evaluation).toEqual({ at: null, model: null })
  })

  it('gathers what every section computes, and survives a section that cannot be read', async () => {
    const reconciliation = {
      rows: [
        {
          person: 'Bianchi Anna',
          timesheetHours: 160,
          worklogHours: 80,
          deltaPct: -50,
          status: 'outlier',
        },
      ],
      possibleDuplicates: [],
      tieOut: { ok: true },
    } as unknown as Reconciliation
    const alignment = {
      missing: [{}],
      needsUpdate: [],
      duplicates: [],
      orphans: [],
    } as unknown as Alignment
    const draft = {
      id: 'd-1',
      title: 'Stato',
      status: 'review',
      createdAt: '2026-11-14T09:00:00.000Z',
      readyAt: null,
      redTeam: null,
    } as Deliverable
    const { today } = setup({
      hours: { view: async () => ({ reconciliation }) as never },
      forecasts: {
        view: async (_project, month) =>
          ({
            forecast: { month, gaps: [{ kind: 'no_ordered', code: 'PRJ000101' }] },
            modelPath: '',
          }) as never,
      },
      dashboard: {
        settings: async () => DEFAULT_DASHBOARD_SETTINGS,
        view: async () =>
          ({
            exportedAt: '2026-11-10T09:00:00.000Z',
            age: 'stale',
            bugs: { open: [{ daysInState: 45 }, { daysInState: 2 }] },
            requirements: [{ id: '2002' }],
          }) as never,
      },
      alignments: {
        settings: async () => ({ ...DEFAULT_ALIGNMENT_SETTINGS, sprint: 'Sprint 28' }),
        view: async () => ({ alignment, stateMismatches: [], exportedAt: null, tickets: 8 }),
      },
      deliverables: { list: async () => [draft] },
      // The sprint ends tomorrow: what the trackers do not agree on is due.
      team: {
        get: async () => ({
          people: [],
          periods: [{ name: 'Sprint 28', from: '2026-11-03', to: '2026-11-17' }],
        }),
      },
      feeds: {
        view: async (_project, feed) => ({
          feed,
          config: feed === 'jira' ? ({ targetFolder: 'Fonti/Jira' } as never) : null,
          suggestedFolder: '',
          hasSecret: true,
          state: {
            cursor: null,
            lastRun: { at: '2026-11-12T08:00:00.000Z', written: 0, unchanged: 0, error: null },
          },
          ...READ_HERE,
        }),
      },
    })
    const view = await today.view(project)
    expect(view.items.map((item) => item.facts.kind)).toEqual([
      'tracker_old',
      'source',
      'meeting',
      // The sprint ends tomorrow: the alignment is due.
      'alignment',
      'draft',
      'mail_reply',
      // Equally heavy: by name.
      'forecast',
      'hours',
      'calendar',
      'bugs_stuck',
      'requirements',
    ])
    expect(view.now.map((entry) => [entry.item.facts.kind, entry.rule])).toEqual([
      ['alignment', 'due'],
    ])
    expect(view.freshness.map((entry) => entry.source)).toEqual([
      'Posta',
      'Jira',
      'Tracker del cliente',
    ])
  })

  it('lets a failure that is not an expected one through', async () => {
    const { today } = setup({
      deliverables: {
        list: async () => {
          throw new Error('disk on fire')
        },
      },
    })
    await expect(today.view(project)).rejects.toThrow('disk on fire')
  })

  it('keeps requirements and alignment for the end of the sprint, and off when it is not known', async () => {
    const alignment = { missing: [{}], needsUpdate: [], duplicates: [], orphans: [] }
    const tracker = {
      dashboard: {
        settings: async () => DEFAULT_DASHBOARD_SETTINGS,
        view: async () =>
          ({
            exportedAt: null,
            age: 'fresh',
            bugs: { open: [] },
            requirements: [{ id: '1' }],
          }) as never,
      },
      alignments: {
        settings: async () => ({ ...DEFAULT_ALIGNMENT_SETTINGS, sprint: 'Sprint 28' }),
        view: async () => ({
          alignment: alignment as unknown as Alignment,
          stateMismatches: [],
          exportedAt: null,
          tickets: 1,
        }),
      },
    } satisfies Partial<TodayDeps>
    const kinds = async (overrides: Partial<TodayDeps>) =>
      (await setup({ ...tracker, ...overrides }).today.view(project)).items.map(
        (item) => item.facts.kind,
      )
    const period = (to: string) => ({
      get: async () => ({ people: [], periods: [{ name: 'Sprint 28', from: '2026-11-03', to }] }),
    })
    expect(await kinds({ team: period('2026-11-17') })).toEqual(
      expect.arrayContaining(['alignment', 'requirements']),
    )
    const quiet = ['meeting', 'mail_reply']
    // The sprint ends in two weeks: both are read in their own pages.
    expect(await kinds({ team: period('2026-11-27') })).toEqual(quiet)
    // The calendar cannot be read, or no sprint is set: when it ends is not known.
    expect(await kinds({ team: { get: notSet('team_invalid') } })).toEqual(quiet)
    expect(
      await kinds({
        team: period('2026-11-17'),
        alignments: { ...tracker.alignments, settings: notSet('alignment_sprint_not_set') },
      }),
    ).toEqual([...quiet, 'calendar'])
    await expect(
      setup({
        alignments: {
          ...tracker.alignments,
          settings: async () => {
            throw new Error('disk on fire')
          },
        },
      }).today.view(project),
    ).rejects.toThrow('disk on fire')
  })

  it('lists what was put away, takes it back, and offers the end of the sprint to put off until', async () => {
    const { today, store } = setup({
      team: {
        get: async () => ({
          people: [],
          periods: [{ name: 'Sprint 28', from: '2026-11-03', to: '2026-11-27' }],
        }),
      },
      alignments: {
        view: notSet('alignment_sprint_not_set'),
        settings: async () => ({ ...DEFAULT_ALIGNMENT_SETTINGS, sprint: 'Sprint 28' }),
      },
    })
    expect((await today.view(project)).sprintEnd).toBe('2026-11-27')
    const later = await today.decide(project, {
      key: 'mail:budget',
      state: 'later',
      until: '2026-11-27',
    })
    expect(later.hiddenItems).toMatchObject([
      { item: { key: 'mail:budget' }, state: 'later', at: '2026-11-16', until: '2026-11-27' },
    ])
    const back = await today.decide(project, { key: 'mail:budget', state: 'open' })
    expect(back.hiddenItems).toEqual([])
    expect(back.items.map((item) => item.key)).toContain('mail:budget')
    expect(store.settings.decisions).toEqual([])
  })

  it('tells what went away by itself today, and not what could not be read', async () => {
    let drafts: Deliverable[] = [
      { id: 'd-1', title: 'Stato', status: 'review', createdAt: '2026-11-14T09:00:00.000Z' },
    ] as Deliverable[]
    let broken = false
    const { today, store, at } = setup({
      deliverables: {
        list: async () => {
          if (broken) throw new DomainError('deliverable_input_missing')
          return drafts
        },
      },
    })
    const first = await today.decide(project, { key: 'draft:d-1', state: 'done' })
    expect(first.resolvedToday).toEqual([])
    // The drafts cannot be read: the draft is not gone, and what was decided of it holds.
    broken = true
    expect((await today.view(project)).resolvedToday).toEqual([])
    expect(store.settings.decisions).toHaveLength(1)
    // The draft was approved: it went away by itself, and «done» is forgotten with it.
    broken = false
    drafts = []
    expect((await today.view(project)).resolvedToday).toEqual(['draft'])
    expect(store.settings.decisions).toEqual([])
    // It comes back: it is new, and no longer among what went away.
    drafts = [
      { id: 'd-1', title: 'Stato', status: 'review', createdAt: '2026-11-14T09:00:00.000Z' },
    ] as Deliverable[]
    const again = await today.view(project)
    expect(again.resolvedToday).toEqual([])
    expect(again.items.find((item) => item.key === 'draft:d-1')?.returned).toBeUndefined()
    // The meeting of the day is over tomorrow: nothing was resolved by that.
    drafts = []
    at('2026-11-17T09:00:00.000Z')
    expect((await today.view(project)).resolvedToday).toEqual(['draft'])
    at('2026-11-18T09:00:00.000Z')
    expect((await today.view(project)).resolvedToday).toEqual([])
  })

  it('lets Claude say why what comes first matters, and shows only what the code found', async () => {
    const sentence = (key: string, quote: string, text = 'Il cliente aspetta la conferma.') => ({
      key,
      text,
      path: BUDGET_PATH,
      quote,
    })
    const found = 'ha approvato un budget aggiuntivo di 8.000 euro'
    const { today, judge, store, at } = setup(
      {},
      {
        summary: () => [
          sentence('mail:budget', found, ' Il cliente aspetta la conferma. '),
          // Twice on the same signal, on a signal the code did not choose, and with no words.
          sentence('mail:budget', found, 'Una seconda frase.'),
          sentence('mail:altra', found),
          sentence('meeting:uid-1:2026-11-16T14:00:00.000Z', found, '  '),
        ],
      },
    )
    at('2026-11-16T12:30:00.000Z')
    // The meeting comes first and Claude has not said why: that is worth a run.
    expect((await today.view(project)).evaluationDue).toBe(true)
    const view = await today.evaluate(project)
    // Claude is told what the code chose, in its order, after the mail was judged.
    expect(judge.explained[0]?.map((item) => [item.key, item.rule])).toEqual([
      ['meeting:uid-1:2026-11-16T14:00:00.000Z', 'meeting_soon'],
      ['mail:budget', 'important_mail'],
    ])
    expect(view.nowSummary).toEqual([
      {
        key: 'mail:budget',
        text: 'Il cliente aspetta la conferma.',
        path: BUDGET_PATH,
        quote: found,
        verified: true,
      },
    ])
    expect(view.evaluationDue).toBe(false)
    // The mail is put away: what was said of it is no longer shown.
    const away = await today.decide(project, { key: 'mail:budget', state: 'muted' })
    expect(away.nowSummary).toEqual([])
    await today.decide(project, { key: 'mail:budget', state: 'open' })
    // The day after, what Claude wrote is about another day.
    at('2026-11-17T09:00:00.000Z')
    expect((await today.view(project)).nowSummary).toEqual([])
    expect(store.evaluation.summary).toHaveLength(1)
  })

  it('keeps a sentence whose words are not in the file, and never shows it', async () => {
    const { today, store } = setup(
      {},
      {
        summary: (keys) =>
          keys.map((key) => ({
            key,
            text: 'Frase.',
            path: BUDGET_PATH,
            quote: 'parole inventate qui',
          })),
      },
    )
    const view = await today.evaluate(project)
    expect(store.evaluation.summary).toMatchObject([{ key: 'mail:budget', verified: false }])
    expect(view.nowSummary).toEqual([])
  })

  it('judges the mail also when Claude cannot say why, and lets other failures through', async () => {
    const quiet = setup({}, { summaryFails: new DomainError('agent_failed') })
    const view = await quiet.today.evaluate(project)
    expect(view.now.map((entry) => entry.rule)).toEqual(['important_mail'])
    expect(view.nowSummary).toEqual([])
    expect(quiet.store.evaluation.mails.budget?.importance).toBe('alta')
    const loud = setup({}, { summaryFails: new Error('disk on fire') })
    await expect(loud.today.evaluate(project)).rejects.toThrow('disk on fire')
    // Nothing comes first: Claude is not asked why.
    const none = setup({}, { mails: () => [] })
    await none.today.evaluate(project)
    expect(none.judge.explained).toEqual([])
  })

  it('marks what is new since the PM last looked, counts what is asked, and keeps the notice on or off', async () => {
    let drafts: Deliverable[] = []
    const { today, store } = setup({ deliverables: { list: async () => drafts } })
    const first = await today.view(project)
    // Never looked at: nothing is marked. The meeting of the day and the mail to answer are asked.
    expect(first.marks).toEqual({})
    expect(first.count).toBe(2)
    expect(first.notify).toBe(true)
    await today.visited(project)
    expect(store.settings.lastSeenAt).toBe('2026-11-16T09:00:00.000Z')
    expect(store.settings.seen.map((signal) => signal.key)).toEqual([
      'meeting:uid-1:2026-11-16T14:00:00.000Z',
      'mail:budget',
    ])
    drafts = [
      { id: 'd-1', title: 'Stato', status: 'review', createdAt: '2026-11-16T08:00:00.000Z' },
    ] as Deliverable[]
    const second = await today.view(project)
    expect(second.marks).toEqual({ 'draft:d-1': 'new' })
    expect(second.count).toBe(3)
    await today.visited(project)
    expect((await today.view(project)).marks).toEqual({})

    const off = await today.setNotify(project, false)
    expect(off.notify).toBe(false)
    expect(store.settings.notify).toBe(false)
    expect((await today.setNotify(project, true)).notify).toBe(true)
  })

  it('says what comes first now, by rule: a meeting about to start, what was put off', async () => {
    const { today, at } = setup()
    // At ten the meeting of four in the afternoon is far: nothing comes first.
    expect((await today.view(project)).now).toEqual([])
    at('2026-11-16T12:30:00.000Z')
    const soon = await today.view(project)
    expect(soon.now.map((entry) => [entry.item.facts.kind, entry.rule, entry.minutes])).toEqual([
      ['meeting', 'meeting_soon', 90],
    ])
    // The page keeps it in its own order too: who shows the page tells it once.
    expect(soon.items.map((item) => item.facts.kind)).toContain('meeting')
    await today.decide(project, { key: 'mail:budget', state: 'later', until: '2026-11-17' })
    at('2026-11-17T09:00:00.000Z')
    const next = await today.view(project)
    expect(next.now.map((entry) => [entry.item.key, entry.rule])).toEqual([
      ['mail:budget', 'later'],
    ])
    const [row] = await today.overview([project])
    expect(row?.first[0]?.key).toBe('mail:budget')
  })

  it('computes the page once for a decision: the mail is not read a second time', async () => {
    let read = 0
    const { today } = setup({
      files: {
        under: async (_folder, folder) =>
          Object.keys(FILES).filter((path) => path.startsWith(`${folder}/`)),
        readText: async (_folder, path) => {
          read += 1
          return FILES[path] ?? null
        },
      },
    })
    await today.view(project)
    const once = read
    read = 0
    await today.decide(project, { key: 'mail:budget', state: 'done' })
    expect(read).toBe(once)
    read = 0
    await today.muteKind(project, 'meeting', true)
    expect(read).toBe(once)
  })

  it('remembers what the PM decides and refuses what makes no sense', async () => {
    const { today, store } = setup()
    const done = await today.decide(project, { key: 'mail:budget', state: 'done' })
    expect(done.items.map((item) => item.key)).not.toContain('mail:budget')
    expect(done.hidden).toBe(1)
    // A mail the PM put away is not worth a run of Claude.
    expect(done.evaluationDue).toBe(false)
    expect(store.settings.decisions).toEqual([
      {
        key: 'mail:budget',
        kind: 'mail_reply',
        state: 'done',
        at: '2026-11-16',
        until: null,
        weight: 0,
      },
    ])
    const open = await today.decide(project, { key: 'mail:budget', state: 'open' })
    expect(open.hidden).toBe(0)
    const later = await today.decide(project, {
      key: 'mail:budget',
      state: 'later',
      until: '2026-11-18',
    })
    expect(later.hidden).toBe(1)
    expect(store.settings.decisions[0]).toMatchObject({ state: 'later', until: '2026-11-18' })

    const refused = (input: Parameters<typeof today.decide>[1]) =>
      today.decide(project, input).then(
        () => 'accepted',
        (error: DomainError) => error.code,
      )
    await today.decide(project, { key: 'mail:budget', state: 'open' })
    expect(await refused({ key: 'mail:budget', state: 'later' })).toBe('today_decision_invalid')
    expect(await refused({ key: 'mail:budget', state: 'later', until: '2026-11-16' })).toBe(
      'today_decision_invalid',
    )
    expect(await refused({ key: 'mail:budget', state: 'later', until: 'domani' })).toBe(
      'today_decision_invalid',
    )
    expect(await refused({ key: 'non-c-e', state: 'done' })).toBe('today_decision_invalid')
    expect(await refused({ key: 'mail:budget', state: 'forse' as never })).toBe(
      'today_decision_invalid',
    )
  })

  it('mutes a kind of signal, shows it again, and keeps the other addresses of the PM', async () => {
    const { today } = setup({ identity: () => null })
    // Nobody is known: no mail can be said to wait.
    expect((await today.view(project)).items.map((item) => item.facts.kind)).toEqual(['meeting'])
    const known = await today.saveAddresses(project, [' PM@example.test ', 'nulla'])
    expect(known.addedAddresses).toEqual(['pm@example.test'])
    expect(known.items.map((item) => item.facts.kind)).toEqual(['meeting', 'mail_reply'])
    const muted = await today.muteKind(project, 'meeting', true)
    expect(muted.mutedKinds).toEqual(['meeting'])
    expect(muted.items.map((item) => item.facts.kind)).toEqual(['mail_reply'])
    expect((await today.muteKind(project, 'meeting', false)).mutedKinds).toEqual([])
  })
})

describe('the judgement of Claude', () => {
  it('weighs the mail that waits once, checks the quote, and looks for risks once a week', async () => {
    const { today, judge, store, register, at } = setup(
      {},
      {
        risks: [
          {
            title: 'Budget non confermato',
            why: 'Manca la conferma.',
            path: BUDGET_PATH,
            quote: 'un budget aggiuntivo di 8.000 euro',
          },
        ],
      },
    )
    const view = await today.evaluate(project)
    const mail = view.items.find((item) => item.key === 'mail:budget')
    expect(mail?.facts).toMatchObject({
      judgement: {
        importance: 'alta',
        reason: 'Comunica un budget in più.',
        quoteVerified: true,
        deadline: null,
      },
    })
    expect(view.evaluation).toEqual({ at: NOW.toISOString(), model: 'claude-fake' })
    expect(view.evaluationDue).toBe(false)
    expect(judge.asked).toEqual([['budget']])
    // The risks proposed wait for the PM: one signal says so.
    expect(register().candidates).toMatchObject([
      { title: 'Budget non confermato', source: { verified: true } },
    ])
    expect(view.items.map((item) => item.facts.kind)).toContain('risk_candidates')

    // The same day again: nothing new to weigh, no run for the mail, none for the risks.
    await today.evaluate(project)
    expect(judge.asked).toEqual([['budget']])
    expect(judge.riskRuns).toBe(1)
    // Asked for all: the mail is weighed again.
    await today.evaluate(project, { all: true })
    expect(judge.asked).toEqual([['budget'], ['budget']])
    // A week later Claude is asked for the risks again.
    at('2026-11-23T09:00:00.000Z')
    await today.evaluate(project)
    expect(judge.riskRuns).toBe(2)
    expect(Object.keys(store.evaluation.mails)).toEqual(['budget'])
  })

  it('marks a quote it does not find, drops a day that is not one and ignores a mail not asked', async () => {
    const { today } = setup(
      {},
      {
        mails: () => [
          {
            id: 'budget',
            importance: 'media',
            reason: 'Da confermare.',
            quote: 'una frase che nella mail non c’è',
            deadline: 'venerdì',
          },
          { id: 'altra', importance: 'alta', reason: '', quote: '', deadline: null },
        ],
      },
    )
    const view = await today.evaluate(project)
    const facts = view.items.find((item) => item.key === 'mail:budget')?.facts
    expect(facts).toMatchObject({ judgement: { quoteVerified: false, deadline: null } })
    expect(view.items.filter((item) => item.facts.kind === 'mail_reply')).toHaveLength(1)
  })

  it('moves a mail that asks an answer by tomorrow among what is due', async () => {
    const { today } = setup(
      {},
      {
        mails: (ids) =>
          ids.map((id) => ({
            id,
            importance: 'alta',
            reason: 'Scade.',
            quote: 'ha approvato un budget',
            deadline: '2026-11-17',
          })),
      },
    )
    const view = await today.evaluate(project)
    expect(view.items.find((item) => item.key === 'mail:budget')).toMatchObject({
      band: 'due',
      dueBecause: 'deadline',
    })
  })

  it('says when Claude cannot judge, and never runs twice at once for a project', async () => {
    const failing = setup({}, { fails: new DomainError('agent_limit_reached') })
    await expect(failing.today.evaluate(project)).rejects.toMatchObject({
      code: 'agent_limit_reached',
    })
    // The page still works: the mail waits, without a judgement.
    const view = await failing.today.view(project)
    expect(view.items.find((item) => item.key === 'mail:budget')?.facts).toMatchObject({
      judgement: null,
    })

    let release: () => void = () => {}
    const slow = setup(
      {},
      {
        mails: () => {
          throw new Error('not reached')
        },
      },
    )
    slow.judge.mails = () => new Promise((resolve) => (release = () => resolve([])))
    const first = slow.today.evaluate(project)
    await new Promise((resolve) => setTimeout(resolve, 0))
    await expect(slow.today.evaluate(project)).rejects.toMatchObject({ code: 'source_busy' })
    release()
    await first
  })
})

describe('all the projects in brief', () => {
  it('counts what waits in each project and never asks Claude', async () => {
    const { today, judge } = setup()
    const broken: Project = { ...project, id: 'p-2', name: 'Boreale' }
    const rows = await today.overview([project, broken])
    expect(rows[0]).toMatchObject({
      project,
      counts: { alert: 0, due: 1, waiting: 1, numbers: 0, watch: 0 },
      failed: false,
      evaluatedAt: null,
    })
    expect(rows[0]?.first.map((item) => item.key)).toEqual([
      'meeting:uid-1:2026-11-16T14:00:00.000Z',
      'mail:budget',
    ])
    expect(judge.asked).toEqual([])

    const failing = setup({
      sources: {
        mail: async () => {
          throw new DomainError('source_config_invalid')
        },
      },
    })
    expect((await failing.today.overview([broken]))[0]).toMatchObject({ failed: true, first: [] })
  })
})

describe('the register of the risks', () => {
  it('writes as a text of the project only what the PM accepted', async () => {
    const { risks, writer } = setup(
      {},
      {
        risks: [
          {
            title: 'Budget non confermato',
            why: 'Manca la conferma.',
            path: BUDGET_PATH,
            quote: 'un budget aggiuntivo di 8.000 euro',
          },
          {
            title: 'Senza fonte',
            why: 'Non c’è.',
            path: 'non/esiste.md',
            quote: 'una frase qualunque del progetto',
          },
        ],
      },
    )
    const proposed = await risks.propose(project)
    expect(proposed.candidates.map((candidate) => candidate.source.verified)).toEqual([true, false])
    expect(proposed.proposedBy).toBe('claude-fake')
    expect(writer.files.size).toBe(0)

    const [first, second] = proposed.candidates
    const accepted = await risks.accept(project, first?.id ?? '', 'Budget da confermare al cliente')
    expect(accepted.risks[0]).toMatchObject({
      title: 'Budget da confermare al cliente',
      since: '2026-11-16',
    })
    expect(writer.files.get('_octo/progetto/rischi.md')).toContain(
      'Budget da confermare al cliente',
    )
    const dismissed = await risks.dismiss(project, second?.id ?? '')
    expect(dismissed.candidates).toEqual([])
    expect(writer.files.get('_octo/progetto/rischi.md')).not.toContain('Senza fonte')

    const added = await risks.add(project, 'Ambiente di prova')
    const mine = added.risks.find((risk) => risk.title === 'Ambiente di prova')
    const closed = await risks.update(project, mine?.id ?? '', { state: 'closed', note: 'Risolto' })
    expect(closed.risks.find((risk) => risk.id === mine?.id)).toMatchObject({
      state: 'closed',
      note: 'Risolto',
    })
    expect(writer.files.get('_octo/progetto/rischi.md')).toContain('## Rischi chiusi')
    expect(await risks.register(project)).toEqual(closed)

    for (const attempt of [
      risks.accept(project, 'non-c-e', ''),
      risks.dismiss(project, 'non-c-e'),
      risks.add(project, '  '),
      risks.update(project, 'non-c-e', { note: '' }),
    ]) {
      await expect(attempt).rejects.toMatchObject({ code: 'risk_invalid' })
    }
  })
})

describe('the sign-in', () => {
  function provider(overrides: Partial<IdentityProvider> = {}): IdentityProvider {
    return {
      configured: async () => ({ authority: 'a', clientId: 'c', tenantId: 't-1' }),
      signIn: async () => ({ identity: paola, refreshToken: 'r-1' }),
      renew: async () => ({ identity: paola, refreshToken: null }),
      ...overrides,
    }
  }

  it('is told where the organization signs in, once, by an Octo just installed', async () => {
    const saved: SignInSetup[] = []
    let known: SignInSetup | null = null
    const session = createSession({
      provider: provider({
        configured: async () => (known ? { ...known, authority: 'a' } : null),
      }),
      secrets: memoryVault(),
      setup: {
        save: async (setup) => {
          saved.push(setup)
          known = setup
        },
      },
    })
    const TENANT = '11111111-2222-3333-4444-555555555555'
    expect(await session.view()).toEqual({ identity: null, configured: false })
    await expect(session.signIn()).rejects.toMatchObject({ code: 'sign_in_not_configured' })
    await expect(session.configure('non un id', 'app-1')).rejects.toMatchObject({
      code: 'sign_in_setup_invalid',
    })
    await expect(session.configure(TENANT, 'con spazi dentro')).rejects.toMatchObject({
      code: 'sign_in_setup_invalid',
    })
    expect(saved).toEqual([])

    expect(await session.configure(` ${TENANT} `, ' app-1 ')).toEqual({
      identity: null,
      configured: true,
    })
    expect(saved).toEqual([{ tenantId: TENANT, clientId: 'app-1' }])
    // An Octo that knows is not told again: nobody is sent to sign in somewhere else.
    await session.configure('99999999-2222-3333-4444-555555555555', 'altra-app')
    expect(saved).toHaveLength(1)
    expect((await session.signIn()).identity).toEqual(paola)

    // Without a place to keep it, as in a demo, there is nothing to be told.
    const fixed = createSession({
      provider: provider({ configured: async () => null }),
      secrets: memoryVault(),
    })
    expect(await fixed.configure(TENANT, 'app-1')).toEqual({ identity: null, configured: false })
  })

  it('lets nobody in until the person signs in, and renews the sign-in at the next start', async () => {
    const secrets = memoryVault()
    const session = createSession({ provider: provider(), secrets })
    expect(session.current()).toBeNull()
    expect(() => session.require()).toThrow(DomainError)
    // Nothing is kept on this computer: nobody is in.
    expect(await session.resume()).toEqual({ identity: null, configured: true })
    expect(await session.signIn()).toEqual({ identity: paola, configured: true })
    expect(session.require()).toEqual(paola)
    expect([...secrets.all.values()]).toEqual(['r-1'])

    // Another start: the sign-in kept is renewed without asking, and stays kept.
    const again = createSession({ provider: provider(), secrets })
    expect((await again.resume()).identity).toEqual(paola)
    expect([...secrets.all.values()]).toEqual(['r-1'])
    expect(await again.signOut()).toEqual({ identity: null, configured: true })
    expect(secrets.all.size).toBe(0)
  })

  it('opens for nobody when the sign-in cannot be renewed, is not set up or is stopped', async () => {
    const secrets = memoryVault()
    secrets.all.set('session/refresh-token', 'scaduto')
    const offline = createSession({
      provider: provider({
        renew: async () => {
          throw new DomainError('sign_in_failed')
        },
      }),
      secrets,
    })
    expect((await offline.resume()).identity).toBeNull()

    const unset = createSession({ provider: provider({ configured: async () => null }), secrets })
    expect(await unset.view()).toEqual({ identity: null, configured: false })
    await expect(unset.signIn()).rejects.toMatchObject({ code: 'sign_in_not_configured' })

    const waiting = createSession({
      provider: provider({
        signIn: (signal) =>
          new Promise((_resolve, reject) =>
            signal.addEventListener('abort', () => reject(new DomainError('sign_in_cancelled'))),
          ),
      }),
      secrets,
    })
    const attempt = waiting.signIn()
    await new Promise((resolve) => setTimeout(resolve, 0))
    waiting.cancelSignIn()
    await expect(attempt).rejects.toMatchObject({ code: 'sign_in_cancelled' })
    expect(waiting.current()).toBeNull()
  })

  it('keeps the person in for this run when the computer has no safe store', async () => {
    const session = createSession({
      provider: provider(),
      secrets: {
        get: async () => null,
        set: async () => {
          throw new DomainError('secret_store_unavailable')
        },
        remove: async () => {},
      },
    })
    expect((await session.signIn()).identity).toEqual(paola)
  })

  it('reads the company system as who is signed in, whatever address was saved', async () => {
    const dwsi = { ownerEmail: 'scritto@a.mano', projectCodes: ['PRJ000101'] } as never
    const settings = memorySourceSettings({
      mail: null,
      meetings: null,
      ado: null,
      jira: null,
      confluence: null,
      dwsi,
    })
    let who: Identity | null = paola
    const owned = settingsOwnedBy(settings, () => who)
    expect((await owned.load('/x')).dwsi?.ownerEmail).toBe('pm@example.test')
    // Signed in without an address: bound to nothing, never to the address kept in the project.
    who = { ...paola, email: '' }
    expect((await owned.load('/x')).dwsi?.ownerEmail).toBe('')
    who = null
    expect((await owned.load('/x')).dwsi?.ownerEmail).toBe('scritto@a.mano')
  })
})

describe('whose turn a mail is, on the page of the day', () => {
  const RECAP_PATH = 'Posta/2026-11/recap.md'
  const recap = mailFile(
    'recap',
    'Aurora: recap UAT',
    'Luca Neri <luca@cliente.example>',
    '2026-11-15T08:00:00.000Z',
  ).replace(
    'a: "Paola Verdi <pm@example.test>"',
    'a: "Paola Verdi <pm@example.test>, Mario Rossi <m.rossi@fornitore.example>"',
  )
  const files: Record<string, string> = { ...FILES, [RECAP_PATH]: recap }
  /** A project with one mail to the PM alone and one written to the PM and to another. */
  function withRecap(addressee: 'me' | 'everyone' | undefined, asksAction = true) {
    const requests: Array<Parameters<TodayJudge['mails']>[0]> = []
    const judge: TodayJudge = {
      mails: async (request) => {
        requests.push(request)
        return request.mails.map((mail) => ({
          id: mail.id,
          importance: 'media' as const,
          reason: 'Recap della sessione.',
          quote: 'ha approvato un budget aggiuntivo di 8.000 euro',
          deadline: null,
          ...(addressee ? { addressee, addresseeName: ' ', asksAction } : {}),
        }))
      },
      risks: async () => [],
      summary: async () => [],
    }
    const made = setup({
      judge,
      files: {
        under: async (_folder, folder) =>
          Object.keys(files).filter((path) => path.startsWith(`${folder}/`)),
        readText: async (_folder, path) => files[path] ?? null,
      },
      evidence: evidenceFrom(
        Object.fromEntries(
          Object.entries(files).map(([path, text]) => [
            path,
            { kind: 'found', text, modifiedAt: '' },
          ]),
        ),
      ),
    })
    return { ...made, requests }
  }
  const kindOf = (view: TodayView, id: string) =>
    view.items.find((item) => 'id' in item.facts && item.facts.id === id)?.facts.kind

  it('follows a mail written to many until Claude reads whom it asks, and tells Claude who the PM is', async () => {
    const { today, requests } = withRecap('everyone')
    const before = await today.view(project)
    expect(kindOf(before, 'budget')).toBe('mail_reply')
    expect(kindOf(before, 'recap')).toBe('mail_follow')
    // A mail nobody read yet is worth a run, though it asks no answer for now.
    expect(before.evaluationDue).toBe(true)

    const after = await today.evaluate(project)
    expect(requests[0]?.pm).toEqual({ name: 'Paola Verdi', addresses: ['pm@example.test'] })
    expect(requests[0]?.mails.find((mail) => mail.id === 'recap')).toEqual({
      id: 'recap',
      path: RECAP_PATH,
      subject: 'Aurora: recap UAT',
      to: 'Paola Verdi <pm@example.test>, Mario Rossi <m.rossi@fornitore.example>',
      mails: 1,
    })
    const followed = after.items.find((item) => item.facts.kind === 'mail_follow')
    expect(followed).toMatchObject({
      key: 'mail:c:aurora: recap uat',
      band: 'watch',
      facts: { why: 'everyone', judgement: { addressee: 'everyone', addresseeName: null } },
    })
    expect(after.evaluationDue).toBe(false)
  })

  it('takes back a decision taken when the signal had another key', async () => {
    const { today, store } = withRecap('everyone')
    // The mail is written to many: its signal is told by the conversation, and the decision the
    // PM took when it was told by the mail still holds.
    store.settings = {
      ...NO_TODAY_SETTINGS,
      decisions: [
        {
          key: 'mail:recap',
          kind: 'mail_follow',
          state: 'muted',
          at: '2026-11-13',
          until: null,
          weight: 0,
        },
      ],
    }
    const [hidden] = (await today.view(project)).hiddenItems
    expect(hidden).toMatchObject({ item: { key: 'mail:c:aurora: recap uat' }, state: 'muted' })
    const back = await today.decide(project, { key: 'mail:c:aurora: recap uat', state: 'open' })
    expect(back.hiddenItems).toEqual([])
    expect(store.settings.decisions).toEqual([])
  })

  it('keeps away a mail Claude reads as asking nothing, with the words found in it', async () => {
    const { today, store } = withRecap('me', false)
    const view = await today.evaluate(project)
    // Neither among what is to answer nor among what is followed: away, and said by whom.
    expect(view.items.filter((item) => item.target === 'mail' && 'id' in item.facts)).toEqual([])
    expect(view.hiddenItems.map((hidden) => [hidden.item.key, hidden.state, hidden.at])).toEqual([
      ['mail:budget', 'claude', '2026-11-16'],
      ['mail:c:aurora: recap uat', 'claude', '2026-11-16'],
    ])
    expect(store.evaluation.mails.recap).toMatchObject({
      asksAction: false,
      judgedAt: '2026-11-16T09:00:00.000Z',
    })
    // The PM's word comes before Claude's: the mail is theirs, and stays so when judged again.
    const back = await today.mailTurn(project, 'mail:c:aurora: recap uat', 'mine')
    expect(back.hiddenItems.map((hidden) => hidden.item.key)).toEqual(['mail:budget'])
    expect(
      back.items.find((item) => 'id' in item.facts && item.facts.id === 'recap'),
    ).toMatchObject({ facts: { kind: 'mail_reply', why: 'chosen' } })
    const again = await today.evaluate(project, { all: true })
    expect(again.hiddenItems.map((hidden) => hidden.item.key)).toEqual(['mail:budget'])
  })

  it('takes nothing off the page on words the code did not find in the mail', async () => {
    const { today } = setup(
      {},
      {
        mails: (ids) =>
          ids.map((id) => ({
            id,
            importance: 'bassa' as const,
            reason: 'Ringrazia soltanto.',
            quote: 'parole che nella mail non ci sono',
            deadline: null,
            addressee: 'me' as const,
            addresseeName: null,
            asksAction: false,
          })),
      },
    )
    const view = await today.evaluate(project)
    expect(view.hiddenItems).toEqual([])
    expect(view.items.map((item) => item.key)).toContain('mail:budget')
  })

  it('reads again a mail judged before Claude was asked whether it asks something', async () => {
    const { today, judge, store } = setup()
    store.evaluation = {
      ...NO_EVALUATION,
      at: '2026-11-15T09:00:00.000Z',
      mails: {
        budget: {
          importance: 'alta',
          reason: 'r',
          quote: 'q',
          quoteVerified: false,
          deadline: null,
          addressee: 'me',
        },
      },
    }
    // Nothing goes away until Claude has read it again.
    const before = await today.view(project)
    expect(before.items.map((item) => item.key)).toContain('mail:budget')
    expect(before.evaluationDue).toBe(true)
    await today.evaluate(project)
    expect(judge.asked).toEqual([['budget']])
  })

  it('asks an answer of a mail to many that Claude reads as the PM’s', async () => {
    const { today } = withRecap('me')
    const view = await today.evaluate(project)
    expect(
      view.items.find((item) => 'id' in item.facts && item.facts.id === 'recap'),
    ).toMatchObject({
      band: 'waiting',
      facts: { kind: 'mail_reply', why: 'judged' },
    })
  })

  it('judges again what was judged before Claude was asked whom a mail is for', async () => {
    const { today, requests, store } = withRecap(undefined)
    await today.evaluate(project)
    expect(store.evaluation.mails.recap?.addressee).toBeUndefined()
    // Not said whom it is for: it is still to be read, the next time Claude is asked.
    await today.evaluate(project)
    expect(requests).toHaveLength(2)
  })

  it('keeps the PM’s word on whose turn a conversation is, and takes it back', async () => {
    const { today, store } = withRecap('everyone')
    await today.evaluate(project)
    const mine = await today.mailTurn(project, 'mail:c:aurora: recap uat', 'mine')
    expect(kindOf(mine, 'recap')).toBe('mail_reply')
    expect(store.settings.mailTurns).toEqual([
      { conversation: 'aurora: recap uat', turn: 'mine', at: '2026-11-16' },
    ])
    // A mail to the PM alone can be said not theirs: the conversation is then only followed.
    const notMine = await today.mailTurn(project, 'mail:budget', 'not_mine')
    expect(kindOf(notMine, 'budget')).toBe('mail_follow')
    const back = await today.mailTurn(project, 'mail:c:aurora: recap uat', null)
    expect(kindOf(back, 'recap')).toBe('mail_follow')
    // Only a signal of the mail that is on the page has a turn.
    await expect(today.mailTurn(project, 'mail:non-c-e', 'mine')).rejects.toThrow(
      'today_decision_invalid',
    )
    const meeting = back.items.find((item) => item.facts.kind === 'meeting')
    await expect(today.mailTurn(project, meeting?.key ?? '', 'mine')).rejects.toThrow(
      'today_decision_invalid',
    )
  })
})
