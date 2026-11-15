import {
  type Alignment,
  DEFAULT_ALIGNMENT_SETTINGS,
  DEFAULT_DASHBOARD_SETTINGS,
  type Deliverable,
  DomainError,
  type Identity,
  type MailSourceConfig,
  NEVER_READ,
  NO_RISKS,
  NO_TEAM,
  NO_TODAY_SETTINGS,
  type Project,
  type Reconciliation,
  type RiskRegister,
  type TodaySettings,
} from '@octo/domain'
import { describe, expect, it } from 'vitest'
import {
  createRisks,
  createSession,
  createToday,
  type IdentityProvider,
  NO_EVALUATION,
  type ProposedJudgement,
  type ProposedRisk,
  settingsOwnedBy,
  type TodayDeps,
  type TodayEvaluation,
  type TodayJudge,
  type TodayStore,
} from '../src/index.ts'
import { evidenceFrom, memorySourceSettings, memoryVault, memoryWriter } from './fakes.ts'

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
  fails?: Error
}

function scriptedJudge(
  script: JudgeScript = {},
): TodayJudge & { asked: string[][]; riskRuns: number } {
  const judge = {
    asked: [] as string[][],
    riskRuns: 0,
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
      }),
    },
    feeds: {
      view: async (_project, feed) => ({
        feed,
        config: null,
        suggestedFolder: '',
        hasSecret: false,
        state: NEVER_READ,
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
        view: async () => ({ alignment, exportedAt: null, tickets: 8 }),
      },
      deliverables: { list: async () => [draft] },
      team: {
        get: async () => {
          throw new DomainError('team_invalid')
        },
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
        }),
      },
    })
    const view = await today.view(project)
    expect(view.items.map((item) => item.facts.kind)).toEqual([
      'tracker_old',
      'source',
      'meeting',
      'draft',
      'mail_reply',
      // Equally heavy: by name.
      'alignment',
      'forecast',
      'hours',
      'bugs_stuck',
      'requirements',
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
