import { join } from 'node:path'
import {
  NO_EVALUATION,
  type OpenPointStore,
  type RiskRegisterStore,
  type TodayEvaluation,
  type TodayStore,
} from '@octo/application'
import {
  cleanTodaySettings,
  DECISION_STATES,
  IMPORTANCES,
  MAIL_ADDRESSEES,
  MAIL_TURNS,
  NO_OPEN_POINTS,
  NO_RISKS,
  NO_TODAY_SETTINGS,
  OCTO_FOLDER,
  OPEN_POINT_CLOSERS,
  OPEN_POINT_ORIGINS,
  OPEN_POINT_STATES,
  type OpenPointRegister,
  POINT_CHECK_REASONS,
  RISK_STATES,
  type RiskRegister,
  type TodayKind,
  type TodaySettings,
} from '@octo/domain'
import { z } from 'zod'
import { readJsonOr, writeJson } from './json-file.ts'
import { PROJECT_SETTINGS_FOLDER } from './project-files.ts'

const TODAY_FILE = 'oggi.json'
const RISKS_SETTINGS_FILE = 'rischi.json'
const OPEN_POINTS_SETTINGS_FILE = 'open-point.json'
/**
 * What Claude judged is kept in a hidden folder of its own: it is neither a setting of the PM
 * nor a source, and the agent's search skips hidden folders.
 */
const EVALUATION_FILE = `${OCTO_FOLDER}/.oggi/valutazione.json`

const settingsSchema = z.object({
  decisions: z
    .array(
      z.object({
        key: z.string(),
        kind: z.string(),
        state: z.enum(DECISION_STATES),
        at: z.string(),
        until: z.string().nullable().default(null),
        weight: z.number().default(0),
      }),
    )
    .default([]),
  mutedKinds: z.array(z.string()).default([]),
  ownAddresses: z.array(z.string()).default([]),
  mailTurns: z
    .array(z.object({ conversation: z.string(), turn: z.enum(MAIL_TURNS), at: z.string() }))
    .default([]),
  present: z.array(z.object({ key: z.string(), kind: z.string(), weight: z.number() })).default([]),
  resolved: z.array(z.object({ key: z.string(), kind: z.string(), day: z.string() })).default([]),
  lastSeenAt: z.string().nullable().default(null),
  seen: z.array(z.object({ key: z.string(), kind: z.string(), weight: z.number() })).default([]),
  notify: z.boolean().default(true),
})

const evaluationSchema = z.object({
  at: z.string().nullable().default(null),
  model: z.string().nullable().default(null),
  mails: z
    .record(
      z.string(),
      z.object({
        importance: z.enum(IMPORTANCES),
        reason: z.string(),
        quote: z.string(),
        quoteVerified: z.boolean(),
        deadline: z.string().nullable().default(null),
        addressee: z.enum(MAIL_ADDRESSEES).optional(),
        addresseeName: z.string().nullable().optional(),
        asksAction: z.boolean().optional(),
        judgedAt: z.string().optional(),
      }),
    )
    .default({}),
  summary: z
    .array(
      z.object({
        key: z.string(),
        text: z.string(),
        path: z.string(),
        quote: z.string(),
        verified: z.boolean(),
      }),
    )
    .default([]),
  prep: z
    .array(
      z.object({
        key: z.string(),
        text: z.string(),
        path: z.string(),
        quote: z.string(),
        verified: z.boolean(),
      }),
    )
    .default([]),
})

const sourceSchema = z.object({ path: z.string(), quote: z.string(), verified: z.boolean() })
const registerSchema = z.object({
  risks: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        since: z.string(),
        state: z.enum(RISK_STATES).default('open'),
        source: sourceSchema.nullable().default(null),
        note: z.string().default(''),
        due: z.string().nullable().default(null),
        severity: z.enum(IMPORTANCES).nullable().default(null),
      }),
    )
    .default([]),
  candidates: z
    .array(z.object({ id: z.string(), title: z.string(), why: z.string(), source: sourceSchema }))
    .default([]),
  dismissed: z.array(z.string()).default([]),
  proposedAt: z.string().nullable().default(null),
  proposedBy: z.string().nullable().default(null),
})

const pointsSchema = z.object({
  points: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        owner: z.string().default(''),
        openedOn: z.string(),
        due: z.string().nullable().default(null),
        state: z.enum(OPEN_POINT_STATES).default('open'),
        origin: z.enum(OPEN_POINT_ORIGINS).default('pm'),
        source: sourceSchema.nullable().default(null),
        signalKey: z.string().nullable().default(null),
        signalKind: z.string().nullable().default(null),
        meeting: z.string().nullable().default(null),
        closedOn: z.string().nullable().default(null),
        closedBy: z.enum(OPEN_POINT_CLOSERS).nullable().default(null),
        closing: sourceSchema.nullable().default(null),
        history: z
          .array(
            z.object({
              day: z.string(),
              text: z.string(),
              source: sourceSchema.nullable().default(null),
            }),
          )
          .default([]),
        check: z
          .object({
            day: z.string(),
            why: z.enum(POINT_CHECK_REASONS),
            text: z.string(),
            meeting: z.string().nullable().default(null),
          })
          .nullable()
          .default(null),
      }),
    )
    .default([]),
  readMeetings: z.array(z.string()).default([]),
  closedDay: z.string().nullable().default(null),
  closedAt: z.string().nullable().default(null),
  closedBy: z.string().nullable().default(null),
})

/** What the PM decided on the page of the day and what Claude judged, in the project folder. */
export function createFsTodayStore(): TodayStore {
  const settingsFile = (projectFolder: string) =>
    join(projectFolder, PROJECT_SETTINGS_FOLDER, TODAY_FILE)
  const evaluationFile = (projectFolder: string) => join(projectFolder, EVALUATION_FILE)
  return {
    async load(projectFolder): Promise<TodaySettings> {
      // A file that cannot be read as settings loses nothing of the project: the page starts over.
      const parsed = settingsSchema.safeParse(await readJsonOr(settingsFile(projectFolder), {}))
      if (!parsed.success) return NO_TODAY_SETTINGS
      return cleanTodaySettings({
        ...parsed.data,
        decisions: parsed.data.decisions.map((decision) => ({
          ...decision,
          kind: decision.kind as TodayKind,
        })),
        mutedKinds: parsed.data.mutedKinds as TodayKind[],
        present: parsed.data.present.map((signal) => ({
          ...signal,
          kind: signal.kind as TodayKind,
        })),
        resolved: parsed.data.resolved.map((signal) => ({
          ...signal,
          kind: signal.kind as TodayKind,
        })),
        seen: parsed.data.seen.map((signal) => ({ ...signal, kind: signal.kind as TodayKind })),
      })
    },
    save: (projectFolder, settings) => writeJson(settingsFile(projectFolder), settings),
    async loadEvaluation(projectFolder): Promise<TodayEvaluation> {
      const parsed = evaluationSchema.safeParse(await readJsonOr(evaluationFile(projectFolder), {}))
      return parsed.success ? parsed.data : NO_EVALUATION
    },
    saveEvaluation: (projectFolder, evaluation) =>
      writeJson(evaluationFile(projectFolder), evaluation),
  }
}

/** The register of the risks, kept with Octo's settings of the project. */
export function createFsRiskRegisterStore(): RiskRegisterStore {
  const fileOf = (projectFolder: string) =>
    join(projectFolder, PROJECT_SETTINGS_FOLDER, RISKS_SETTINGS_FILE)
  return {
    async load(projectFolder): Promise<RiskRegister> {
      const parsed = registerSchema.safeParse(await readJsonOr(fileOf(projectFolder), {}))
      return parsed.success ? parsed.data : NO_RISKS
    },
    save: (projectFolder, register) => writeJson(fileOf(projectFolder), register),
  }
}

/** The register of the open points, kept with Octo's settings of the project. */
export function createFsOpenPointStore(): OpenPointStore {
  const fileOf = (projectFolder: string) =>
    join(projectFolder, PROJECT_SETTINGS_FOLDER, OPEN_POINTS_SETTINGS_FILE)
  return {
    async load(projectFolder): Promise<OpenPointRegister> {
      const parsed = pointsSchema.safeParse(await readJsonOr(fileOf(projectFolder), {}))
      if (!parsed.success) return NO_OPEN_POINTS
      return {
        ...parsed.data,
        points: parsed.data.points.map((point) => ({
          ...point,
          signalKind: point.signalKind as TodayKind | null,
        })),
      }
    },
    save: (projectFolder, register) => writeJson(fileOf(projectFolder), register),
  }
}
