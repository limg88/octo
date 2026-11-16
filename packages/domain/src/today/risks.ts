import { OCTO_FOLDER } from '../extracted-document.ts'
import { shortHash } from '../mail/document.ts'
import { IMPORTANCES, type Importance, type TodayItem } from './model.ts'

/** Where a risk comes from: a file of the project and the words in it. */
export type RiskSource = { path: string; quote: string; verified: boolean }

export const RISK_STATES = ['open', 'closed'] as const
export type RiskState = (typeof RISK_STATES)[number]

/** A risk the PM took into the register of the project. */
export type Risk = {
  id: string
  title: string
  /** The day it entered the register, `YYYY-MM-DD`. */
  since: string
  state: RiskState
  source: RiskSource | null
  /** What the PM adds: who follows it, what is being done. */
  note: string
  /** The day it has to be dealt with by; null when it has none. */
  due: string | null
  /** How much it matters, as the PM says; null when not said. */
  severity: Importance | null
}

/** A risk Claude proposes, with its source: it enters the register only when the PM takes it. */
export type RiskCandidate = {
  id: string
  title: string
  why: string
  source: RiskSource
}

export type RiskRegister = {
  risks: Risk[]
  candidates: RiskCandidate[]
  /** Candidates the PM turned down: the same source is not proposed again. */
  dismissed: string[]
  /** When Claude last looked for candidates; null when never. */
  proposedAt: string | null
  /** The model that proposed the candidates now shown. */
  proposedBy: string | null
}

export const NO_RISKS: RiskRegister = {
  risks: [],
  candidates: [],
  dismissed: [],
  proposedAt: null,
  proposedBy: null,
}

/** Where the register is written for whoever answers on the project. */
export const RISKS_FILE = `${OCTO_FOLDER}/progetto/rischi.md`
export const MAX_RISK_TITLE = 200
export const MAX_RISK_NOTE = 1000
/** Days after which Claude is asked again for candidates, with the judgement of the day. */
export const RISK_PROPOSAL_DAYS = 7

const normalized = (text: string): string => text.replace(/\s+/g, ' ').trim().toLowerCase()

/** What tells a candidate from another: the words it stands on, wherever Claude found them. */
export const candidateId = (source: Pick<RiskSource, 'path' | 'quote'>): string =>
  shortHash(`${source.path}\n${normalized(source.quote)}`)

/**
 * The register with what Claude proposed now: a candidate already in the register, already
 * turned down or proposed twice is left out.
 */
export function withCandidates(
  register: RiskRegister,
  proposed: ReadonlyArray<Omit<RiskCandidate, 'id'>>,
  at: string,
  model: string | null,
): RiskRegister {
  const known = new Set([...register.dismissed, ...register.risks.map((risk) => risk.id)])
  const candidates: RiskCandidate[] = []
  for (const candidate of proposed) {
    const id = candidateId(candidate.source)
    const title = candidate.title.trim().slice(0, MAX_RISK_TITLE)
    if (title === '' || known.has(id)) continue
    known.add(id)
    candidates.push({ ...candidate, id, title })
  }
  return { ...register, candidates, proposedAt: at, proposedBy: model }
}

/** The register with a candidate taken in as a risk, under the title the PM gives it. */
export function acceptCandidate(
  register: RiskRegister,
  id: string,
  title: string,
  today: string,
): RiskRegister {
  const candidate = register.candidates.find((entry) => entry.id === id)
  if (!candidate) return register
  const risk: Risk = {
    id,
    title: title.trim().slice(0, MAX_RISK_TITLE) || candidate.title,
    since: today,
    state: 'open',
    source: candidate.source,
    note: '',
    due: null,
    severity: null,
  }
  return {
    ...register,
    risks: [...register.risks, risk],
    candidates: register.candidates.filter((entry) => entry.id !== id),
  }
}

export function dismissCandidate(register: RiskRegister, id: string): RiskRegister {
  if (!register.candidates.some((entry) => entry.id === id)) return register
  return {
    ...register,
    candidates: register.candidates.filter((entry) => entry.id !== id),
    dismissed: [...new Set([...register.dismissed, id])],
  }
}

/** The register with a risk the PM wrote by hand. */
export function addRisk(register: RiskRegister, title: string, today: string): RiskRegister {
  const clean = title.trim().slice(0, MAX_RISK_TITLE)
  if (clean === '') return register
  const id = shortHash(`${today}\n${clean}\n${register.risks.length}`)
  return {
    ...register,
    risks: [
      ...register.risks,
      {
        id,
        title: clean,
        since: today,
        state: 'open',
        source: null,
        note: '',
        due: null,
        severity: null,
      },
    ],
  }
}

/** What the PM changes of a risk; a day or a weight given as null is taken away. */
export type RiskChange = {
  state?: RiskState
  note?: string
  due?: string | null
  severity?: Importance | null
}

const RISK_DAY = /^\d{4}-\d{2}-\d{2}$/

export function updateRisk(register: RiskRegister, id: string, change: RiskChange): RiskRegister {
  return {
    ...register,
    risks: register.risks.map((risk) =>
      risk.id === id
        ? {
            ...risk,
            ...(change.state ? { state: change.state } : {}),
            ...(change.note !== undefined
              ? { note: change.note.trim().slice(0, MAX_RISK_NOTE) }
              : {}),
            ...(change.due !== undefined
              ? { due: change.due !== null && RISK_DAY.test(change.due) ? change.due : null }
              : {}),
            ...(change.severity !== undefined
              ? {
                  severity:
                    change.severity !== null && IMPORTANCES.includes(change.severity)
                      ? change.severity
                      : null,
                }
              : {}),
          }
        : risk,
    ),
  }
}

const italianDay = (value: string): string => value.split('-').reverse().join('/')

/**
 * The register as a text of the project: whoever answers a question or writes a deliverable
 * finds the risks the PM accepted, and can cite them like any other source. Candidates are not
 * in it: nobody has accepted them.
 */
export function risksMarkdown(register: RiskRegister): string {
  const lines = ['# Registro dei rischi del progetto', '']
  lines.push(
    'Scritto da Octo: i rischi sono quelli che il PM ha accettato. Si cambia da «Oggi».',
    '',
  )
  for (const [state, title] of [
    ['open', 'Rischi aperti'],
    ['closed', 'Rischi chiusi'],
  ] as const) {
    const risks = register.risks.filter((risk) => risk.state === state)
    if (risks.length === 0) continue
    lines.push(`## ${title}`, '')
    for (const risk of risks) {
      lines.push(`- **${risk.title}** — nel registro dal ${italianDay(risk.since)}`)
      if (risk.source) lines.push(`  - Fonte: \`${risk.source.path}\`: «${risk.source.quote}»`)
      if (risk.severity) lines.push(`  - Gravità: ${risk.severity}`)
      if (risk.due) lines.push(`  - Entro il ${italianDay(risk.due)}`)
      if (risk.note !== '') lines.push(`  - Nota del PM: ${risk.note}`)
    }
    lines.push('')
  }
  if (register.risks.length === 0) lines.push('Nessun rischio nel registro.', '')
  return lines.join('\n')
}

/** The open risks and the candidates that wait, as signals of the page: watched, not due. */
export function riskItems(register: RiskRegister): TodayItem[] {
  const open = register.risks
    .filter((risk) => risk.state === 'open')
    .map(
      (risk): TodayItem => ({
        key: `risk:${risk.id}`,
        band: 'watch',
        facts: { kind: 'risk', id: risk.id, title: risk.title, since: risk.since },
        weight: 0,
        target: 'risks',
        asOf: risk.since,
      }),
    )
  if (register.candidates.length === 0) return open
  return [
    ...open,
    {
      key: 'risk-candidates',
      band: 'watch',
      facts: { kind: 'risk_candidates', count: register.candidates.length },
      weight: register.candidates.length,
      target: 'risks',
      asOf: register.proposedAt,
    },
  ]
}
