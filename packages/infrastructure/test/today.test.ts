import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { NO_EVALUATION } from '@octo/application'
import { type DomainError, NO_RISKS, NO_TODAY_SETTINGS, type SignInConfig } from '@octo/domain'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  createClaudeTodayJudge,
  createFixedIdentityProvider,
  createFsRiskRegisterStore,
  createFsTodayStore,
  createOidcIdentityProvider,
  createSignInConfig,
  fixedPersonOf,
  parseEmlx,
} from '../src/index.ts'
import { type FakeEntra, startFakeEntra } from './support/fake-entra.ts'
import { emlx } from './support/mail-folder.ts'

const TENANT = '11111111-2222-3333-4444-555555555555'
const CLIENT = 'octo-client'
const PERSON = { id: 'u-1', name: 'Paola Verdi', email: 'pm@example.test' }
const here = fileURLToPath(new URL('.', import.meta.url))

const codeOf = (promise: Promise<unknown>): Promise<string> =>
  promise.then(
    () => 'no failure',
    (error: DomainError) => error.code,
  )

describe('the sign-in of the organization', () => {
  let entra: FakeEntra
  let config: SignInConfig
  /** The system's browser: it goes where it is sent and follows the way back to Octo. */
  const browser = async (url: string) => {
    await fetch(url)
  }
  const provider = (overrides: Partial<Parameters<typeof createOidcIdentityProvider>[0]> = {}) =>
    createOidcIdentityProvider({
      config: async () => config,
      openBrowser: browser,
      allowLoopbackAuthority: true,
      ...overrides,
    })
  const signIn = (overrides = {}) => provider(overrides).signIn(new AbortController().signal)

  beforeAll(async () => {
    entra = await startFakeEntra({ tenantId: TENANT, clientId: CLIENT, person: PERSON })
    config = { authority: entra.authority, clientId: CLIENT, tenantId: TENANT }
  })
  afterAll(() => entra.close())

  it('signs a person in through the browser and renews the sign-in without asking', async () => {
    const signedIn = await signIn()
    expect(signedIn.identity).toEqual({
      id: 'u-1',
      username: 'pm@example.test',
      email: 'pm@example.test',
      name: 'Paola Verdi',
      tenant: TENANT,
    })
    expect(signedIn.refreshToken).toEqual(expect.any(String))
    const renewed = await provider().renew(signedIn.refreshToken ?? '')
    expect(renewed.identity.id).toBe('u-1')
    expect(renewed.refreshToken).toBeNull()
    // The organization withdrew the sign-in: it is not renewed.
    entra.revoke()
    expect(await codeOf(provider().renew(signedIn.refreshToken ?? ''))).toBe('sign_in_failed')
  })

  it('refuses a token that is not signed, addressed, timed or issued as it must be', async () => {
    for (const fault of [
      'signature',
      'audience',
      'issuer',
      'expired',
      'nonce',
      'algorithm',
      'no_tokens',
    ] as const) {
      entra.fault(fault)
      expect(await codeOf(signIn()), fault).toBe('sign_in_failed')
    }
    // A person of another organization signs in well, and is not let in.
    entra.fault('tenant')
    expect(await codeOf(signIn())).toBe('sign_in_refused')
    entra.fault(null)
    // A clock an hour behind still takes a token just issued; one two days ahead does not.
    const days = (count: number) => () => new Date(Date.now() + count * 24 * 60 * 60 * 1000)
    expect((await signIn({ now: days(0) })).identity.id).toBe('u-1')
    expect(await codeOf(signIn({ now: days(2) }))).toBe('sign_in_failed')
  })

  it('refuses a sign-in that is not where it says, not secure, or not configured', async () => {
    // Without the permission of a demo, a sign-in on this computer over plain HTTP is refused.
    expect(await codeOf(signIn({ allowLoopbackAuthority: false }))).toBe('sign_in_failed')
    const elsewhere = { ...config, authority: 'http://127.0.0.1:1/x/v2.0' }
    expect(await codeOf(signIn({ config: async () => elsewhere }))).toBe('sign_in_failed')
    expect(
      await codeOf(signIn({ config: async () => ({ ...config, authority: 'non un indirizzo' }) })),
    ).toBe('sign_in_not_configured')
    expect(await codeOf(signIn({ config: async () => null }))).toBe('sign_in_not_configured')
    expect(await codeOf(provider({ config: async () => null }).renew('x'))).toBe(
      'sign_in_not_configured',
    )
    expect(await provider().configured()).toEqual(config)
  })

  it('stops waiting when the person gives up, takes too long, or the answer is not for it', async () => {
    const abort = new AbortController()
    const waiting = provider({ openBrowser: async () => abort.abort() }).signIn(abort.signal)
    expect(await codeOf(waiting)).toBe('sign_in_cancelled')
    const never = signIn({ openBrowser: async () => {}, signInTimeoutMs: 20 })
    expect(await codeOf(never)).toBe('sign_in_cancelled')
    // The organization answers with an error instead of a code.
    const refused = signIn({
      openBrowser: async (url: string) => {
        const asked = new URL(url)
        const back = new URL(asked.searchParams.get('redirect_uri') ?? '')
        // Somebody else's answer, with another state, is not taken.
        const stray = await fetch(`${back.origin}/?state=altro&code=x`)
        expect(stray.status).toBe(400)
        back.searchParams.set('state', asked.searchParams.get('state') ?? '')
        back.searchParams.set('error', 'access_denied')
        await fetch(back)
      },
    })
    expect(await codeOf(refused)).toBe('sign_in_failed')
  })
})

describe('where the organization signs in', () => {
  it('reads it from the environment or from its file, and gives nothing when it is incomplete', async () => {
    const dataFolder = mkdtempSync(join(tmpdir(), 'octo-accesso-'))
    const from = (env: object) => createSignInConfig({ dataFolder, env })()
    expect(await from({})).toBeNull()
    expect(await from({ tenantId: TENANT })).toBeNull()
    expect(await from({ tenantId: 'non-un-id', clientId: CLIENT })).toBeNull()
    expect(await from({ tenantId: TENANT, clientId: CLIENT })).toEqual({
      tenantId: TENANT,
      clientId: CLIENT,
      authority: `https://login.microsoftonline.com/${TENANT}/v2.0`,
    })
    writeFileSync(
      join(dataFolder, 'accesso.json'),
      JSON.stringify({ tenantId: TENANT, clientId: 'dal-file' }),
    )
    expect((await from({}))?.clientId).toBe('dal-file')
    // The environment wins over the file.
    expect(await from({ clientId: CLIENT, authority: 'http://127.0.0.1:9/x' })).toMatchObject({
      clientId: CLIENT,
      authority: 'http://127.0.0.1:9/x',
    })
    writeFileSync(join(dataFolder, 'accesso.json'), '{"tenantId": 3}')
    expect(await from({})).toBeNull()
  })

  it('has a person always signed in for demos and tests', async () => {
    expect(fixedPersonOf('Paola Verdi <pm@example.test>')).toEqual({
      name: 'Paola Verdi',
      email: 'pm@example.test',
    })
    expect(fixedPersonOf('<pm@example.test>')).toEqual({
      name: 'pm@example.test',
      email: 'pm@example.test',
    })
    expect(fixedPersonOf('Paola Verdi')).toBeNull()
    expect(fixedPersonOf(undefined)).toBeNull()
    const fixed = createFixedIdentityProvider({ name: 'Paola Verdi', email: 'PM@example.test' })
    expect(await fixed.configured()).not.toBeNull()
    const signedIn = await fixed.signIn(new AbortController().signal)
    expect(signedIn.identity).toMatchObject({ id: 'demo:pm@example.test', name: 'Paola Verdi' })
    expect(await fixed.renew('x')).toEqual(signedIn)
  })
})

describe('what the page of the day keeps in the project', () => {
  it('keeps decisions, judgements and risks, and starts over from a file it cannot read', async () => {
    const folder = mkdtempSync(join(tmpdir(), 'octo-oggi-'))
    const store = createFsTodayStore()
    expect(await store.load(folder)).toEqual(NO_TODAY_SETTINGS)
    expect(await store.loadEvaluation(folder)).toEqual(NO_EVALUATION)
    const settings = {
      decisions: [
        {
          key: 'mail:x',
          kind: 'mail_reply' as const,
          state: 'later' as const,
          at: '2026-11-16',
          until: '2026-11-18',
          weight: 2,
        },
      ],
      mutedKinds: ['meeting' as const],
      ownAddresses: ['pm@example.test'],
      mailTurns: [{ conversation: 'aurora: budget', turn: 'not_mine' as const, at: '2026-11-16' }],
      present: [{ key: 'bugs-stuck', kind: 'bugs_stuck' as const, weight: 3 }],
      resolved: [{ key: 'hours:2026-10', kind: 'hours' as const, day: '2026-11-16' }],
      lastSeenAt: '2026-11-16T09:00:00.000Z',
      seen: [{ key: 'bugs-stuck', kind: 'bugs_stuck' as const, weight: 2 }],
      notify: false,
    }
    await store.save(folder, settings)
    expect(await store.load(folder)).toEqual(settings)
    const evaluation = {
      at: '2026-11-16T09:00:00.000Z',
      model: 'claude-fake',
      mails: {
        x: {
          importance: 'alta' as const,
          reason: 'r',
          quote: 'q',
          quoteVerified: true,
          deadline: null,
          asksAction: false,
          judgedAt: '2026-11-16T09:00:00.000Z',
        },
      },
      summary: [
        {
          key: 'mail:x',
          text: 'Il budget va confermato al cliente.',
          path: 'Posta/2026-11/x.md',
          quote: 'budget aggiuntivo',
          verified: true,
        },
      ],
    }
    await store.saveEvaluation(folder, evaluation)
    expect(await store.loadEvaluation(folder)).toEqual(evaluation)
    writeFileSync(join(folder, '_octo', '.impostazioni', 'oggi.json'), '{"decisions": "tutte"}')
    writeFileSync(join(folder, '_octo', '.oggi', 'valutazione.json'), '{"mails": 3}')
    expect(await store.load(folder)).toEqual(NO_TODAY_SETTINGS)
    expect(await store.loadEvaluation(folder)).toEqual(NO_EVALUATION)

    const risks = createFsRiskRegisterStore()
    expect(await risks.load(folder)).toEqual(NO_RISKS)
    const register = {
      ...NO_RISKS,
      risks: [
        {
          id: 'r1',
          title: 'Rischio',
          since: '2026-11-16',
          state: 'open' as const,
          source: null,
          note: '',
        },
      ],
    }
    await risks.save(folder, register)
    expect(await risks.load(folder)).toEqual(register)
    writeFileSync(join(folder, '_octo', '.impostazioni', 'rischi.json'), '{"risks": 1}')
    expect(await risks.load(folder)).toEqual(NO_RISKS)
  })
})

describe('Claude as the one who judges', () => {
  const folder = mkdtempSync(join(tmpdir(), 'octo-giudizio-'))
  writeFileSync(
    join(folder, 'mail.md'),
    [
      '---',
      'tipo: "email"',
      '---',
      '',
      '# Aurora: budget',
      '',
      'Il comitato ha approvato il budget.',
    ].join('\n'),
  )
  const PM = 'pm@example.test'
  const mailFile = (name: string, firstLine: string) =>
    writeFileSync(
      join(folder, name),
      ['---', 'tipo: "email"', 'id: "x"', '---', '', '# Aurora', '', firstLine].join('\n'),
    )
  mailFile('a-tutti.md', 'Ciao a tutti, di seguito il recap della sessione.')
  mailFile('a-carla.md', 'Carla, ci confermi la data del collaudo entro venerdì?')
  const judge = createClaudeTodayJudge({
    command: process.execPath,
    prefixArgs: [join(here, 'fake-claude.mjs')],
    env: process.env,
  })

  it('weighs each mail given, with words copied from its file', async () => {
    const models: string[] = []
    const judged = await judge.mails({
      projectFolder: folder,
      mails: [
        { id: 'a', path: 'mail.md', subject: 'Aurora: budget', to: PM, mails: 1 },
        {
          id: 'b',
          path: 'non-c-e.md',
          subject: 'Aurora: saluti',
          to: `${PM}, altri@x.test`,
          mails: 2,
        },
        {
          id: 'c',
          path: 'a-tutti.md',
          subject: 'Aurora: recap',
          to: `${PM}, altri@x.test`,
          mails: 1,
        },
        {
          id: 'd',
          path: 'a-carla.md',
          subject: 'Aurora: data',
          to: `${PM}, carla@x.test`,
          mails: 1,
        },
      ],
      pm: { name: 'Paola Verdi', addresses: [PM] },
      onModel: (model) => models.push(model),
    })
    expect(judged).toEqual([
      {
        id: 'a',
        importance: 'alta',
        reason: expect.any(String),
        quote: 'Il comitato ha approvato il budget.',
        deadline: null,
        addressee: 'me',
        addresseeName: null,
        asksAction: true,
      },
      {
        id: 'b',
        importance: 'media',
        reason: expect.any(String),
        quote: '',
        deadline: null,
        addressee: 'me',
        addresseeName: null,
        asksAction: true,
      },
      // Whom a mail asks is read in its words: the whole group, or another person by name.
      expect.objectContaining({ id: 'c', addressee: 'everyone', addresseeName: null }),
      expect.objectContaining({ id: 'd', addressee: 'someone_else', addresseeName: 'Carla' }),
    ])
    expect(models).toEqual(['claude-fake-default'])
    // Nothing to weigh: Claude is not run at all.
    expect(await judge.mails({ projectFolder: '/non/esiste', mails: [] })).toEqual([])
  })

  it('proposes the risks the register does not hold yet', async () => {
    const risks = await judge.risks({ projectFolder: folder, known: [] })
    expect(risks).toEqual([
      {
        title: expect.any(String),
        why: expect.any(String),
        path: 'wiki/stato.md',
        quote: 'fissata al 12 dicembre 2026',
      },
    ])
    expect(await judge.risks({ projectFolder: folder, known: [risks[0]?.title ?? ''] })).toEqual([])
  })

  it('says of a mail that only thanks that it asks nothing, with the words that show it', async () => {
    mailFile('grazie.md', 'Grazie a te per il lavoro di ieri, tutto a posto.')
    const [judged] = await judge.mails({
      projectFolder: folder,
      mails: [{ id: 'g', path: 'grazie.md', subject: 'Aurora: grazie', to: PM, mails: 1 }],
    })
    expect(judged).toMatchObject({
      id: 'g',
      importance: 'bassa',
      asksAction: false,
      quote: 'Grazie a te per il lavoro di ieri, tutto a posto.',
    })
  })

  it('says why what comes first matters, a sentence for a signal, and nothing for nothing', async () => {
    mkdirSync(join(folder, 'wiki'), { recursive: true })
    writeFileSync(join(folder, 'wiki', 'stato.md'), 'La consegna è fissata al 12 dicembre 2026.')
    expect(await judge.summary({ projectFolder: folder, day: '2026-11-16', items: [] })).toEqual([])
    const sentences = await judge.summary({
      projectFolder: folder,
      day: '2026-11-16',
      items: [
        {
          key: 'mail:a',
          rule: 'important_mail',
          facts: {
            kind: 'mail_reply',
            id: 'a',
            path: 'mail.md',
            from: 'Carla',
            subject: 'Aurora: budget',
            days: 0,
            judgement: null,
          },
        },
        {
          key: 'hours:2026-10',
          rule: 'due',
          facts: { kind: 'month_due', month: '2026-10', what: 'forecast' },
        },
      ],
    })
    expect(sentences).toEqual([
      {
        key: 'mail:a',
        text: expect.any(String),
        path: 'mail.md',
        quote: 'Il comitato ha approvato il budget.',
      },
      {
        key: 'hours:2026-10',
        text: expect.any(String),
        path: 'wiki/stato.md',
        quote: 'fissata al 12 dicembre 2026',
      },
    ])
  })
})

describe('a mail that answers another, or invites to a meeting', () => {
  const message = (headers: string[], body: string) => emlx([...headers, '', body, ''].join('\n'))

  it('keeps what it answers and the conversation before it', async () => {
    const mail = await parseEmlx(
      message(
        [
          'Message-ID: <risposta@example.test>',
          'In-Reply-To: <budget@cliente.example>',
          'References: <primo@cliente.example> <budget@cliente.example>',
          'From: Paola Verdi <pm@example.test>',
          'To: Carla Bianchi <carla@cliente.example>',
          'Subject: R: Aurora: budget',
          'Content-Type: text/plain; charset=utf-8',
        ],
        'Confermo.',
      ),
    )
    expect(mail).toMatchObject({
      inReplyTo: 'budget@cliente.example',
      references: ['primo@cliente.example', 'budget@cliente.example'],
      meeting: null,
    })
    const plain = await parseEmlx(
      message(['From: a@example.test', 'Subject: x', 'Content-Type: text/plain'], 'Testo.'),
    )
    expect(plain).toMatchObject({ inReplyTo: null, references: [] })
  })

  it('reads the meeting of an invitation', async () => {
    const calendar = [
      'BEGIN:VCALENDAR',
      'METHOD:REQUEST',
      'BEGIN:VEVENT',
      'UID:uid-1',
      'SUMMARY:Collaudo di Aurora',
      'DTSTART:20261116T140000Z',
      'DTEND:20261116T150000Z',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\n')
    const mail = await parseEmlx(
      message(
        [
          'From: Carla Bianchi <carla@cliente.example>',
          'Subject: Aurora: collaudo',
          'Content-Type: text/calendar; method=REQUEST; charset=utf-8',
        ],
        calendar,
      ),
    )
    expect(mail.calendarMethod).toBe('REQUEST')
    expect(mail.meeting).toEqual({
      uid: 'uid-1',
      summary: 'Collaudo di Aurora',
      start: '2026-11-16T14:00:00.000Z',
      end: '2026-11-16T15:00:00.000Z',
      location: '',
    })
  })
})
